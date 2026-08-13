import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { hashPassword, verifyPassword } from "../src/auth/password";
import { newSessionToken, hashToken } from "../src/auth/tokens";
import {
  buildSessionCookie,
  clearSessionCookie,
  parseCookies,
  newCsrfToken,
  CSRF_HEADER,
  CSRF_COOKIE_NAME,
} from "../src/auth/cookies";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/auth/claim";

const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const GOLDEN_FORMAT_RE = /^pbkdf2\$v1\$100000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/;

describe("password", () => {
  it("round-trips hash/verify", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("throws on malformed stored hash", async () => {
    await expect(verifyPassword("anything", "not-a-valid-hash")).rejects.toThrow();
    await expect(verifyPassword("anything", "pbkdf2$v1$600000$onlysalt")).rejects.toThrow();
    await expect(verifyPassword("anything", "bcrypt$v1$600000$salt$hash")).rejects.toThrow();
  });

  it("matches the golden format exactly, for seed-script interop", async () => {
    const hash = await hashPassword("some-password");
    expect(hash).toMatch(GOLDEN_FORMAT_RE);
    const [, , , salt, digest] = hash.split("$");
    expect(salt).toMatch(B64URL_RE);
    expect(digest).toMatch(B64URL_RE);
  });

  it("produces distinct salts across calls", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("tokens", () => {
  it("newSessionToken is b64url alphabet", () => {
    const token = newSessionToken();
    expect(token).toMatch(B64URL_RE);
    expect(token.length).toBeGreaterThan(0);
  });

  it("hashToken produces sha-256 hex", async () => {
    const token = newSessionToken();
    const hashed = await hashToken(token);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashToken is deterministic for the same token", async () => {
    const token = "fixed-token-value";
    const a = await hashToken(token);
    const b = await hashToken(token);
    expect(a).toBe(b);
  });
});

describe("cookies", () => {
  it("buildSessionCookie sets DEC-004 attributes (insecure)", () => {
    const cookie = buildSessionCookie("tok123", { secure: false });
    expect(cookie).toContain("chq_session=tok123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    expect(cookie).not.toContain("Secure");
  });

  it("buildSessionCookie adds Secure when requested", () => {
    const cookie = buildSessionCookie("tok123", { secure: true });
    expect(cookie).toContain("Secure");
  });

  it("clearSessionCookie expires the cookie", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain("chq_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("parseCookies parses a cookie header", () => {
    const parsed = parseCookies("chq_session=abc123; chq_csrf=def456");
    expect(parsed).toEqual({ chq_session: "abc123", chq_csrf: "def456" });
  });

  it("parseCookies returns empty object for null header", () => {
    expect(parseCookies(null)).toEqual({});
  });

  it("newCsrfToken is b64url alphabet", () => {
    const token = newCsrfToken();
    expect(token).toMatch(B64URL_RE);
  });

  it("CSRF_HEADER constant matches DEC-004", () => {
    expect(CSRF_HEADER).toBe("x-chq-csrf");
  });
});

// DEC-181: POST /logout requires CSRF proof — either the JSON-style
// 'x-chq-csrf: 1' header (admin SPA) or the double-submit chq_csrf cookie
// pair (portal/auth SSR forms). Route-level coverage against a fake db.
describe("POST /logout (route-level, DEC-181)", () => {
  const SESSION_TOKEN = "session-tok-abc";

  function makeFakeDb() {
    let deleteCalled = false;
    const db = {
      delete(table: unknown) {
        return {
          where() {
            deleteCalled = true;
            return Promise.resolve();
          },
        };
      },
    } as unknown as AppEnv["Variables"]["db"];
    return { db, wasDeleted: () => deleteCalled };
  }

  function buildApp(db: AppEnv["Variables"]["db"]) {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);
    return app;
  }

  it("rejects a request with neither the CSRF header nor a valid cookie/field pair; session is not deleted", async () => {
    const { db, wasDeleted } = makeFakeDb();
    const app = buildApp(db);

    const res = await app.request("/logout", {
      method: "POST",
      headers: {
        cookie: `chq_session=${SESSION_TOKEN}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "",
    });

    expect(res.status).toBe(400);
    // DEC-626: /logout is a plain-form surface (the portal/auth sign-out
    // forms post to it), so csrfFormOrHeader marks the request htmlSurface
    // and the shared error handler answers with a rendered page, never a
    // JSON blob. The status and the "session survives" invariant are
    // unchanged; only the media type of the refusal is.
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toMatch(/^<!doctype html>/i);
    expect(body).not.toMatch(/\{"error"/);
    expect(wasDeleted()).toBe(false);
  });

  it("succeeds with the x-chq-csrf: 1 header, no cookie pair needed", async () => {
    const { db, wasDeleted } = makeFakeDb();
    const app = buildApp(db);

    const res = await app.request("/logout", {
      method: "POST",
      headers: {
        cookie: `chq_session=${SESSION_TOKEN}`,
        [CSRF_HEADER]: "1",
      },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
    expect(wasDeleted()).toBe(true);
  });

  it("succeeds with a valid chq_csrf cookie + matching form field", async () => {
    const { db, wasDeleted } = makeFakeDb();
    const app = buildApp(db);
    const csrf = newCsrfToken();

    const form = new URLSearchParams({ [CSRF_COOKIE_NAME]: csrf });
    const res = await app.request("/logout", {
      method: "POST",
      headers: {
        cookie: `chq_session=${SESSION_TOKEN}; ${CSRF_COOKIE_NAME}=${csrf}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
    expect(wasDeleted()).toBe(true);
  });
});

// w1-i (docs/eval-findings.md Section D): the ~1-3s PBKDF2 round-trip on
// login must not read as a no-op first click — the submit button disables
// itself and swaps to a "Signing in…" label on submit.
describe("GET /login markup carries the pending-state hook", () => {
  it("renders a submit button with an onsubmit hook that disables it and shows 'Signing in…'", async () => {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      // DEC-583: GET /login now queries demoIdentitiesPresent, so it needs a
      // (empty-result) fake db — this test doesn't care about the demo block.
      c.set("db", {
        // DEC-740: the login door now also queries getHubOrg/listHubEvents
        // for its single-event subtitle/footer -- chain needs orderBy() too
        // (org has no `where` clause), not just where()/limit().
        select: () => {
          const chain: any = { from: () => chain, where: () => chain, orderBy: () => chain, limit: async () => [] };
          return chain;
        },
      } as unknown as AppEnv["Variables"]["db"]);
      await next();
    });
    app.route("/", authRoutes);

    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('id="chq-login-submit"');
    expect(body).toContain("Signing in…");
    expect(body).toMatch(/onsubmit="[^"]*chq-login-submit[^"]*disabled[^"]*"/);
  });
});

// DEC-180: POST /login rate limiting counts only failures — a successful
// login must not consume the shared budget, and success clears the
// per-email budget entirely.
describe("POST /login rate limiting (DEC-180)", () => {
  const EMAIL = "user@example.test";
  const PASSWORD = "correct-password-123";

  class InMemoryKV implements KVStore {
    private readonly store = new Map<string, string>();

    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }

    async put(key: string, value: string): Promise<void> {
      this.store.set(key, value);
    }

    async delete(key: string): Promise<void> {
      this.store.delete(key);
    }
  }

  // DEC-948: extracts the right-hand-side value of a real drizzle eq(col,
  // value) condition tree (unwrapping the Param wrapper), so the rate_limit
  // fake below can key its store by the same `key` column peekScopedLimit
  // etc. actually filter on -- rather than discarding the condition.
  function extractEqValue(cond: unknown): unknown {
    const chunks = (cond as { queryChunks: unknown[] }).queryChunks;
    const raw = chunks[3];
    return raw && typeof raw === "object" && "value" in (raw as object) ? (raw as { value: unknown }).value : raw;
  }

  async function buildApp() {
    const passwordHash = await hashPassword(PASSWORD);
    const users = [
      {
        id: "u_1",
        orgId: "org_1",
        email: EMAIL,
        passwordHash,
        role: "organizer",
        contactId: null,
      },
    ];
    const sessions: unknown[] = [];
    // DEC-948: the login door's rate limiter now upserts/reads/deletes a D1
    // rate_limit row instead of KV -- real per-key state so this describe
    // block's cap-crossing and success-reset assertions still hold.
    const rateLimits = new Map<string, { count: number; expiresAt: number }>();
    const db = {
      select() {
        return {
          from(table: unknown) {
            let whereCond: unknown;
            const chain: any = {
              where(cond: unknown) {
                whereCond = cond;
                return chain;
              },
              orderBy: () => chain,
              limit() {
                if (table === schema.user) return Promise.resolve(users);
                if (table === schema.org) return Promise.resolve([]);
                if (table === schema.rateLimit) {
                  const key = extractEqValue(whereCond);
                  const row = rateLimits.get(key as string);
                  return Promise.resolve(row ? [{ count: row.count }] : []);
                }
                throw new Error("unexpected table in fake db select");
              },
            };
            return chain;
          },
        };
      },
      insert(table: unknown) {
        return {
          values(row: any) {
            if (table === schema.authSession) {
              sessions.push(row);
              return Promise.resolve();
            }
            if (table === schema.rateLimit) {
              const existing = rateLimits.get(row.key);
              return {
                onConflictDoUpdate: () => ({
                  returning: async () => {
                    if (existing) {
                      existing.count += 1;
                      return [{ count: existing.count }];
                    }
                    rateLimits.set(row.key, { count: row.count, expiresAt: row.expiresAt });
                    return [{ count: row.count }];
                  },
                  then: (resolve: (v: undefined) => void) => {
                    if (existing) existing.count += 1;
                    else rateLimits.set(row.key, { count: row.count, expiresAt: row.expiresAt });
                    resolve(undefined);
                  },
                }),
              };
            }
            return Promise.resolve();
          },
        };
      },
      delete(table: unknown) {
        return {
          where(cond: unknown) {
            if (table === schema.rateLimit) {
              const key = extractEqValue(cond);
              rateLimits.delete(key as string);
            }
            return Promise.resolve();
          },
        };
      },
    } as unknown as AppEnv["Variables"]["db"];

    const kv = new InMemoryKV();
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
    return { app, kv, env, sessions };
  }

  async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }) {
    const res = await app.request("/login", {}, env);
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on /login`);
    return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
  }

  async function postLogin(
    app: Hono<AppEnv>,
    env: { KV: AppEnv["Bindings"]["KV"] },
    fields: { email: string; password: string },
  ) {
    const { csrf, cookie } = await getCsrf(app, env);
    const form = new URLSearchParams({
      [CSRF_COOKIE_NAME]: csrf,
      email: fields.email,
      password: fields.password,
    });
    return app.request(
      "/login",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: form.toString(),
      },
      env,
    );
  }

  it("20 failed logins for one email then a 429", async () => {
    const { app, env } = await buildApp();
    for (let i = 0; i < 20; i++) {
      const res = await postLogin(app, env, { email: EMAIL, password: "wrong" });
      expect(res.status).toBe(401);
    }
    const res21 = await postLogin(app, env, { email: EMAIL, password: "wrong" });
    expect(res21.status).toBe(429);
  });

  it("a successful login does not increment the budget: 19 failures, then success, then a failure is still allowed", async () => {
    const { app, env } = await buildApp();
    for (let i = 0; i < 19; i++) {
      const res = await postLogin(app, env, { email: EMAIL, password: "wrong" });
      expect(res.status).toBe(401);
    }
    const successRes = await postLogin(app, env, { email: EMAIL, password: PASSWORD });
    expect(successRes.status).toBe(302);

    // The per-email budget was at 19 failures pre-success; since success
    // resets it, one more failure must still be allowed (not 429).
    const afterSuccess = await postLogin(app, env, { email: EMAIL, password: "wrong" });
    expect(afterSuccess.status).toBe(401);
  });

  it("success clears the email budget: 19 failures, success, then 19 more failures are allowed", async () => {
    const { app, env } = await buildApp();
    for (let i = 0; i < 19; i++) {
      const res = await postLogin(app, env, { email: EMAIL, password: "wrong" });
      expect(res.status).toBe(401);
    }
    const successRes = await postLogin(app, env, { email: EMAIL, password: PASSWORD });
    expect(successRes.status).toBe(302);

    for (let i = 0; i < 19; i++) {
      const res = await postLogin(app, env, { email: EMAIL, password: "wrong" });
      expect(res.status).toBe(401);
    }
    // Budget was reset by the success, so this is only the 20th failure
    // post-reset — still allowed, not yet capped.
    const res20AfterReset = await postLogin(app, env, { email: EMAIL, password: "wrong" });
    expect(res20AfterReset.status).toBe(401);
    const res21AfterReset = await postLogin(app, env, { email: EMAIL, password: "wrong" });
    expect(res21AfterReset.status).toBe(429);
  });
});
