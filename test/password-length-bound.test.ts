// DEC-740 amendment: no path on main bounded a caller-supplied password.
// MAX_PASSWORD_LENGTH now lives in src/domain/auth-copy.ts and is enforced
// at the one chokepoint, src/auth/password.ts. This file covers: (1) the
// chokepoint itself (hashPassword throws, verifyPassword refuses without
// hashing), (2) one route-level refusal (POST /claim/:token), and (3) that
// the SSR password controls declare the bound via maxlength.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { hashPassword, verifyPassword } from "../src/auth/password";
import { MAX_PASSWORD_LENGTH } from "../src/domain/auth-copy";
import { createClaimToken } from "../src/auth/claim";
import type { KVStore } from "../src/auth/claim";
import { authRoutes } from "../src/routes/auth";
import { registerErrorHandler } from "../src/server/http";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import * as schema from "../src/db/schema";
import type { AppEnv } from "../src/server/env";
import { ClaimPage, ResetPasswordPage } from "../src/routes/auth-views";
import { PasswordPage as AccountPasswordPage } from "../src/routes/account";

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

describe("hashPassword/verifyPassword ceiling (DEC-740 amendment)", () => {
  it("hashPassword throws for a password over MAX_PASSWORD_LENGTH", async () => {
    const overLong = "a".repeat(MAX_PASSWORD_LENGTH + 1);
    await expect(hashPassword(overLong)).rejects.toThrow();
  });

  it("hashPassword succeeds at exactly MAX_PASSWORD_LENGTH", async () => {
    const atLimit = "a".repeat(MAX_PASSWORD_LENGTH);
    await expect(hashPassword(atLimit)).resolves.toBeTruthy();
  });

  it("verifyPassword returns false for a password over MAX_PASSWORD_LENGTH, without hashing", async () => {
    // A stored hash for the first MAX_PASSWORD_LENGTH characters of the
    // over-long candidate — if verifyPassword truncated instead of
    // refusing outright, this WOULD match. It must not.
    const prefix = "a".repeat(MAX_PASSWORD_LENGTH);
    const overLong = prefix + "b".repeat(50);
    const storedForPrefix = await hashPassword(prefix);

    expect(await verifyPassword(overLong, storedForPrefix)).toBe(false);
  });
});

describe("POST /claim/:token refuses an over-long password (route-level, DEC-740 amendment)", () => {
  const CONTACT_ID = "ct_1";
  const ORG_ID = "org_1";
  const CONTACT_EMAIL = "speaker@example.test";

  function makeFakeDb(opts: { contacts: unknown[]; users: unknown[] }) {
    const state = { contacts: [...opts.contacts], users: [...opts.users] };
    const rateLimitRows = new Map<string, { count: number; expiresAt: number }>();
    return {
      db: {
        select() {
          return {
            from(table: unknown) {
              return {
                where() {
                  return {
                    limit() {
                      if (table === schema.contact) return Promise.resolve(state.contacts);
                      if (table === schema.user) return Promise.resolve(state.users);
                      if (table === schema.rateLimit) return Promise.resolve([]);
                      throw new Error("unexpected table in fake db select");
                    },
                  };
                },
              };
            },
          };
        },
        insert(table: unknown) {
          return {
            values(row: unknown) {
              if (table === schema.rateLimit) {
                const vals = row as { key: string; count: number; expiresAt: number };
                return {
                  onConflictDoUpdate: () => ({
                    returning: async () => {
                      const existing = rateLimitRows.get(vals.key);
                      if (existing) {
                        existing.count += 1;
                        return [{ count: existing.count }];
                      }
                      rateLimitRows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
                      return [{ count: vals.count }];
                    },
                    then: (resolve: (v: undefined) => void) => {
                      const existing = rateLimitRows.get(vals.key);
                      if (existing) existing.count += 1;
                      else rateLimitRows.set(vals.key, { count: vals.count, expiresAt: vals.expiresAt });
                      resolve(undefined);
                    },
                  }),
                };
              }
              if (table === schema.user) state.users.push(row);
              return Promise.resolve();
            },
          };
        },
        delete(table: unknown) {
          return {
            where() {
              if (table === schema.rateLimit) return Promise.resolve();
              if (table === schema.authSession) return Promise.resolve();
              throw new Error("unexpected table in fake db delete");
            },
          };
        },
        // DEC-949 (wave 46 amendment): POST /claim/:token now issues
        // refundScopedLimit (db.update) once the token resolves.
        update(table: unknown) {
          return {
            set() {
              return {
                where() {
                  if (table === schema.rateLimit) return Promise.resolve();
                  throw new Error("unexpected table in fake db update");
                },
              };
            },
          };
        },
      } as unknown as AppEnv["Variables"]["db"],
    };
  }

  function buildApp(db: AppEnv["Variables"]["db"]) {
    const kv = new InMemoryKV();
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", db);
      await next();
    });
    app.route("/", authRoutes);
    const env = { KV: kv as unknown as AppEnv["Bindings"]["KV"] };
    return { app, kv, env };
  }

  async function getCsrf(app: Hono<AppEnv>, env: { KV: AppEnv["Bindings"]["KV"] }, path: string) {
    const res = await app.request(path, {}, env);
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (!match) throw new Error(`no ${CSRF_COOKIE_NAME} cookie set on ${path}`);
    return { csrf: match[1]!, cookie: `${CSRF_COOKIE_NAME}=${match[1]}` };
  }

  it("an over-long password is rejected without consuming the token", async () => {
    const { db } = makeFakeDb({
      contacts: [{ id: CONTACT_ID, orgId: ORG_ID, email: CONTACT_EMAIL }],
      users: [],
    });
    const { app, kv, env } = buildApp(db);
    const token = await createClaimToken(kv, { contactId: CONTACT_ID, eventId: "ev_1" });

    const { csrf, cookie } = await getCsrf(app, env, `/claim/${token}`);
    const form = new URLSearchParams({
      [CSRF_COOKIE_NAME]: csrf,
      password: "a".repeat(MAX_PASSWORD_LENGTH + 1),
    });
    const res = await app.request(
      `/claim/${token}`,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie }, body: form.toString() },
      env,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    // Link is still claimable — the token was never consumed.
    const followUpGet = await app.request(`/claim/${token}`, {}, env);
    expect(followUpGet.status).toBe(200);
  });
});

describe("SSR password controls declare the maxlength bound (DEC-740 amendment)", () => {
  it("ClaimPage's password input carries maxlength", () => {
    const html = ClaimPage({ csrfToken: "tok" }).toString();
    expect(html).toContain(`maxlength="${MAX_PASSWORD_LENGTH}"`);
  });

  it("ResetPasswordPage's password inputs carry maxlength", () => {
    const html = ResetPasswordPage({ csrfToken: "tok", email: "a@example.test" }).toString();
    const occurrences = html.split(`maxlength="${MAX_PASSWORD_LENGTH}"`).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("account PasswordPage's new-password inputs carry maxlength", () => {
    const html = AccountPasswordPage({ csrfToken: "tok", backHref: "/portal" }).toString();
    const occurrences = html.split(`maxlength="${MAX_PASSWORD_LENGTH}"`).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
