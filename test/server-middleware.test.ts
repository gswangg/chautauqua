import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import {
  resolveAuth,
  checkDoubleSubmitCsrf,
  noStoreApi,
  sessionLoader,
  requireOrganizer,
  csrfForm,
  csrfFormOrHeader,
} from "../src/server/middleware";
import type { SessionLookup, UserLookup, SessionRow, UserRow } from "../src/server/middleware";
import { hashToken, newSessionToken, newApiToken } from "../src/auth/tokens";
import { CSRF_COOKIE_NAME } from "../src/auth/cookies";
import type { AppEnv } from "../src/server/env";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";

class FakeSessions implements SessionLookup {
  constructor(private readonly rows: Map<string, SessionRow>) {}
  async findByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    return this.rows.get(tokenHash) ?? null;
  }
}

class FakeUsers implements UserLookup {
  constructor(private readonly rows: Map<string, UserRow>) {}
  async findById(userId: string): Promise<UserRow | null> {
    return this.rows.get(userId) ?? null;
  }
}

describe("resolveAuth", () => {
  it("returns undefined when there's no token", async () => {
    const sessions = new FakeSessions(new Map());
    const users = new FakeUsers(new Map());
    await expect(resolveAuth(undefined, sessions, users, Date.now())).resolves.toBeUndefined();
  });

  it("resolves a live session to AuthInfo", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "u1", expiresAt: now + 1000 }]]));
    const users = new FakeUsers(
      new Map([["u1", { id: "u1", orgId: "o1", role: "organizer", contactId: null }]]),
    );
    const auth = await resolveAuth(token, sessions, users, now);
    expect(auth).toEqual({ userId: "u1", role: "organizer", orgId: "o1", contactId: undefined });
  });

  it("returns undefined for an expired session", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "u1", expiresAt: now - 1000 }]]));
    const users = new FakeUsers(
      new Map([["u1", { id: "u1", orgId: "o1", role: "organizer", contactId: null }]]),
    );
    await expect(resolveAuth(token, sessions, users, now)).resolves.toBeUndefined();
  });

  it("returns undefined for an unknown token", async () => {
    const sessions = new FakeSessions(new Map());
    const users = new FakeUsers(new Map());
    await expect(resolveAuth("no-such-token", sessions, users, Date.now())).resolves.toBeUndefined();
  });

  it("returns undefined when the session's user no longer exists", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "ghost", expiresAt: now + 1000 }]]));
    const users = new FakeUsers(new Map());
    await expect(resolveAuth(token, sessions, users, now)).resolves.toBeUndefined();
  });

  it("carries contactId through for speaker users", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "u2", expiresAt: now + 1000 }]]));
    const users = new FakeUsers(
      new Map([["u2", { id: "u2", orgId: "o1", role: "speaker", contactId: "c1" }]]),
    );
    const auth = await resolveAuth(token, sessions, users, now);
    expect(auth?.contactId).toBe("c1");
  });

  it("throws loudly on an unknown role literal (data corruption)", async () => {
    const token = newSessionToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const sessions = new FakeSessions(new Map([[tokenHash, { userId: "u3", expiresAt: now + 1000 }]]));
    const users = new FakeUsers(
      new Map([["u3", { id: "u3", orgId: "o1", role: "admin", contactId: null }]]),
    );
    await expect(resolveAuth(token, sessions, users, now)).rejects.toThrow(/unknown user role/i);
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

// w1-e: every /api/v1 GET response carries Cache-Control: no-store, mirroring
// src/server/app.ts's `app.use("/api/v1", noStoreApi)` / `app.use("/api/v1/*",
// noStoreApi)` registration — admin/API data must never be edge- or
// browser-cached; that staleness class is why the Files library P3 (rows
// appearing "10 min later") reproduced.
describe("noStoreApi", () => {
  it("adds Cache-Control: no-store to a GET response that doesn't set one", async () => {
    const app = new Hono<AppEnv>();
    app.use("/api/v1/*", noStoreApi);
    app.get("/api/v1/widgets", (c) => c.json({ items: [] }));

    const res = await app.request("/api/v1/widgets");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not override a route's own explicit Cache-Control", async () => {
    const app = new Hono<AppEnv>();
    app.use("/api/v1/*", noStoreApi);
    app.get("/api/v1/special", (c) => {
      c.header("Cache-Control", "public, max-age=60");
      return c.json({ ok: true });
    });

    const res = await app.request("/api/v1/special");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});

// DEC-276: a bearer token minted while its user was an organizer must stop
// authenticating the instant that user is demoted, without any expiry
// column — sessionLoader re-resolves the minting user on every request.
describe("sessionLoader + requireOrganizer with a bearer token whose minting user was demoted (DEC-276)", () => {
  it("401s an organizer-only route for a token whose minting user is now a reviewer", async () => {
    const token = newApiToken();

    // Minimal fake drizzle db: dispatches by which table .from() names,
    // covering the two lookups sessionLoader performs (apiToken, then
    // user) plus the best-effort last_used_at update.
    const fakeDb = {
      select() {
        return {
          from(table: unknown) {
            return {
              where() {
                return {
                  limit: async () => {
                    if (table === schema.apiToken) {
                      return [{ id: "tok1", orgId: "org-1", createdByUserId: "u-1" }];
                    }
                    if (table === schema.user) {
                      return [{ id: "u-1", orgId: "org-1", role: "reviewer", contactId: null }];
                    }
                    return [];
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
            return { where: async () => undefined };
          },
        };
      },
    } as unknown as AppEnv["Variables"]["db"];

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
});
