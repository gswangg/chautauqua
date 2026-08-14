import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import {
  resolveAuth,
  checkDoubleSubmitCsrf,
  noStoreByDefault,
  sessionLoader,
  requireOrganizer,
  csrfForm,
  csrfFormOrHeader,
} from "../src/server/middleware";
import type { SessionUserLookup, SessionUserRow } from "../src/server/middleware";
import { hashToken, newSessionToken, newApiToken } from "../src/auth/tokens";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";

class FakeSessionUsers implements SessionUserLookup {
  private calls = 0;
  constructor(private readonly rows: Map<string, SessionUserRow>) {}
  async findSessionUser(tokenHash: string): Promise<SessionUserRow | null> {
    this.calls++;
    return this.rows.get(tokenHash) ?? null;
  }
  get callCount(): number {
    return this.calls;
  }
}

describe("resolveAuth", () => {
  it("returns undefined when there's no token", async () => {
    const lookup = new FakeSessionUsers(new Map());
    await expect(resolveAuth(undefined, lookup, Date.now())).resolves.toBeUndefined();
  });

  it("resolves a live session to AuthInfo with exactly one lookup call", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const lookup = new FakeSessionUsers(
      new Map([
        [
          tokenHash,
          { expiresAt: now + 1000, user: { id: "u1", orgId: "o1", role: "organizer", contactId: null } },
        ],
      ]),
    );
    const auth = await resolveAuth(token, lookup, now);
    expect(auth).toEqual({ userId: "u1", role: "organizer", orgId: "o1", contactId: undefined });
    expect(lookup.callCount).toBe(1);
  });

  it("returns undefined for an expired session", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const lookup = new FakeSessionUsers(
      new Map([
        [
          tokenHash,
          { expiresAt: now - 1000, user: { id: "u1", orgId: "o1", role: "organizer", contactId: null } },
        ],
      ]),
    );
    await expect(resolveAuth(token, lookup, now)).resolves.toBeUndefined();
  });

  it("returns undefined for an unknown token", async () => {
    const lookup = new FakeSessionUsers(new Map());
    await expect(resolveAuth("no-such-token", lookup, Date.now())).resolves.toBeUndefined();
  });

  it("returns undefined when the session's user no longer exists (join yields no row)", async () => {
    const lookup = new FakeSessionUsers(new Map());
    await expect(resolveAuth("some-token", lookup, Date.now())).resolves.toBeUndefined();
  });

  it("carries contactId through for speaker users", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const lookup = new FakeSessionUsers(
      new Map([
        [tokenHash, { expiresAt: now + 1000, user: { id: "u2", orgId: "o1", role: "speaker", contactId: "c1" } }],
      ]),
    );
    const auth = await resolveAuth(token, lookup, now);
    expect(auth?.contactId).toBe("c1");
  });

  it("throws loudly on an unknown role literal (data corruption)", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const lookup = new FakeSessionUsers(
      new Map([
        [tokenHash, { expiresAt: now + 1000, user: { id: "u3", orgId: "o1", role: "admin", contactId: null } }],
      ]),
    );
    await expect(resolveAuth(token, lookup, now)).rejects.toThrow(/unknown user role/i);
  });
});

describe("checkDoubleSubmitCsrf", () => {
  it("passes when cookie and form token match", () => {
    expect(checkDoubleSubmitCsrf("abc123", "abc123")).toBe(true);
  });

  it("fails when the cookie is missing", () => {
    expect(checkDoubleSubmitCsrf(undefined, "abc123")).toBe(false);
  });

  it("fails when tokens differ", () => {
    expect(checkDoubleSubmitCsrf("abc123", "xyz789")).toBe(false);
  });

  it("fails when the form field is missing or not a string", () => {
    expect(checkDoubleSubmitCsrf("abc123", undefined)).toBe(false);
    expect(checkDoubleSubmitCsrf("abc123", ["abc123"])).toBe(false);
  });
});

// DEC-544: csrfForm and csrfFormOrHeader must delegate their comparison to
// checkDoubleSubmitCsrf rather than re-inlining it — exercised here through
// real Hono apps (not the bare helper) so a broken inline copy would fail
// these tests even if checkDoubleSubmitCsrf itself stayed correct.
describe.each([
  ["csrfForm", csrfForm],
  ["csrfFormOrHeader", csrfFormOrHeader],
])("%s middleware (DEC-544 delegates to checkDoubleSubmitCsrf)", (_name, middleware) => {
  function buildApp() {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.post("/submit", middleware, (c) => c.json({ ok: true }));
    return app;
  }

  it("throws 'Missing CSRF cookie' when there's no cookie", async () => {
    const app = buildApp();
    const body = new URLSearchParams({ [CSRF_COOKIE_NAME]: "abc123" });
    const res = await app.request("/submit", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    expect(res.status).toBe(400);
    // DEC-626: csrfForm/csrfFormOrHeader mark the request htmlSurface as
    // their first statement, so a thrown ApiError renders HTML, not JSON.
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const responseBody = await res.text();
    expect(responseBody).toContain("Missing CSRF cookie");
  });

  it("succeeds when the cookie and form field match", async () => {
    const app = buildApp();
    const body = new URLSearchParams({ [CSRF_COOKIE_NAME]: "abc123" });
    const res = await app.request("/submit", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${CSRF_COOKIE_NAME}=abc123`,
      },
      body: body.toString(),
    });
    expect(res.status).toBe(200);
  });

  it("throws 'CSRF token mismatch' when the cookie and form field differ", async () => {
    const app = buildApp();
    const body = new URLSearchParams({ [CSRF_COOKIE_NAME]: "xyz789" });
    const res = await app.request("/submit", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `${CSRF_COOKIE_NAME}=abc123`,
      },
      body: body.toString(),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const responseBody = await res.text();
    expect(responseBody).toContain("CSRF token mismatch");
  });

  it("throws 'CSRF token mismatch' when the form field is present but not a string", async () => {
    const app = buildApp();
    const formData = new FormData();
    formData.set(CSRF_COOKIE_NAME, new Blob(["abc123"]), "not-a-string.txt");
    const res = await app.request("/submit", {
      method: "POST",
      headers: { cookie: `${CSRF_COOKIE_NAME}=abc123` },
      body: formData,
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("CSRF token mismatch");
  });
});

// DEC-544: the double-submit comparison must live in exactly one place —
// checkDoubleSubmitCsrf. A source scan guards against a fourth inline copy
// landing in a future edit to src/server/**.
describe("DEC-544 source scan: no inline CSRF comparison outside checkDoubleSubmitCsrf", () => {
  it("finds the comparison only inside checkDoubleSubmitCsrf's own body", () => {
    const root = join(__dirname, "..", "src", "server");
    const files: string[] = [];
    (function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) walk(full);
        else if (entry.endsWith(".ts")) files.push(full);
      }
    })(root);

    const comparisonPattern = /formToken\s*!==\s*cookieToken|!==\s*cookieToken/;
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Isolate checkDoubleSubmitCsrf's own function body so its legitimate
      // comparison doesn't trip the scan, then check everything else.
      const fnStart = src.indexOf("function checkDoubleSubmitCsrf");
      let outside = src;
      if (fnStart !== -1) {
        const bodyStart = src.indexOf("{", fnStart);
        // Find the matching closing brace for the function body.
        let depth = 0;
        let bodyEnd = bodyStart;
        for (let i = bodyStart; i < src.length; i++) {
          if (src[i] === "{") depth++;
          else if (src[i] === "}") {
            depth--;
            if (depth === 0) {
              bodyEnd = i;
              break;
            }
          }
        }
        outside = src.slice(0, fnStart) + src.slice(bodyEnd + 1);
      }
      if (comparisonPattern.test(outside)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});

// DEC-658: every response app-wide carries Cache-Control: no-store unless it
// already set its own — see test/cache-control-default.test.ts for the
// full app-wide coverage (mirrors src/server/app.ts's single
// `app.use("*", noStoreByDefault)` registration). This staleness class is
// why the Files library P3 (rows appearing "10 min later") reproduced.
describe("noStoreByDefault", () => {
  it("adds Cache-Control: no-store to a response that doesn't set one", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", noStoreByDefault);
    app.get("/api/v1/widgets", (c) => c.json({ items: [] }));

    const res = await app.request("/api/v1/widgets");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not override a route's own explicit Cache-Control", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", noStoreByDefault);
    app.get("/api/v1/special", (c) => {
      c.header("Cache-Control", "public, max-age=60");
      return c.json({ ok: true });
    });

    const res = await app.request("/api/v1/special");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});

// Minimal fake drizzle db exercising sessionLoader's single joined lookup
// (apiToken innerJoin user) plus the best-effort last_used_at update, for
// the bearer-token path (no cookie present, so resolveAuth short-circuits
// on the missing token without touching the db).
function fakeBearerDb(
  joinedRow: unknown[],
  opts: { updateThrows?: boolean } = {},
): AppEnv["Variables"]["db"] {
  return {
    select() {
      return {
        from(table: unknown) {
          return {
            innerJoin() {
              return {
                where() {
                  return {
                    limit: async () => (table === schema.apiToken ? joinedRow : []),
                  };
                },
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set() {
          return {
            where: async () => {
              if (opts.updateThrows) {
                throw new Error("D1 write failed");
              }
              return undefined;
            },
          };
        },
      };
    },
  } as unknown as AppEnv["Variables"]["db"];
}

// DEC-276: a bearer token minted while its user was an organizer must stop
// authenticating the instant that user is demoted, without any expiry
// column — sessionLoader re-resolves the minting user on every request via
// a single joined lookup.
describe("sessionLoader + requireOrganizer with a bearer token whose minting user was demoted (DEC-276)", () => {
  it("(c) 401s an organizer-only route for a token whose minting user is now a reviewer", async () => {
    const token = newApiToken();
    const fakeDb = fakeBearerDb([
      { tokenOrgId: "org-1", userId: "u-1", userOrgId: "org-1", role: "reviewer", contactId: null },
    ]);

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", fakeDb);
      await next();
    });
    app.use("*", sessionLoader);
    app.get("/api/v1/organizer-only", requireOrganizer, (c) => c.json({ ok: true }));

    const res = await app.request("/api/v1/organizer-only", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("(d) a throwing last_used_at write leaves the request authenticated and does not reject", async () => {
    const token = newApiToken();
    const fakeDb = fakeBearerDb(
      [{ tokenOrgId: "org-1", userId: "u-1", userOrgId: "org-1", role: "organizer", contactId: null }],
      { updateThrows: true },
    );

    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", fakeDb);
      await next();
    });
    app.use("*", sessionLoader);
    app.get("/api/v1/organizer-only", requireOrganizer, (c) => c.json({ ok: true, auth: c.var.auth }));

    const res = await app.request("/api/v1/organizer-only", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; auth: { userId: string } };
    expect(body.auth.userId).toBe("u-1");
  });
});
