// DEC-949: a password reset revokes the target's bearer tokens too, and
// reports how many. Drives the real usersRoutes sub-app plus the real
// sessionLoader over an in-memory sqlite db (DatabaseSync + drizzle
// sqlite-proxy, pattern copied from test/api-tokens-cap.test.ts) so the
// bearer-auth resolution path is exercised for real, not mocked away --
// this is exactly the defect: DELETE /api/v1/tokens/:id can't clean up a
// stray token because it needs the cookie session the reset just destroyed,
// so the only honest test authenticates a real request with the real token
// hash before and after the reset.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { usersRoutes } from "../src/routes/api/users";
import { sessionLoader, requireOrganizer } from "../src/server/middleware";
import { newApiToken, hashToken, apiTokenDisplayPrefix } from "../src/auth/tokens";
import { newId } from "../src/domain/ids";

const DDL = `
create table user (
  id text primary key,
  org_id text,
  email text,
  name text,
  password_hash text,
  role text,
  contact_id text,
  created_at integer,
  updated_at integer
);
create table api_token (
  id text primary key,
  org_id text,
  name text,
  token_hash text,
  token_prefix text,
  created_by_user_id text,
  last_used_at integer,
  created_at integer,
  updated_at integer
);
create table auth_session (
  id text primary key,
  user_id text,
  token_hash text,
  expires_at integer,
  created_at integer,
  updated_at integer
);
`;

function makeTestDb(): Db {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return db as unknown as Db;
}

const ORG_A = "org-a";

async function insertUser(db: Db, id: string, orgId: string, role: string) {
  await db.insert(schema.user).values({
    id,
    orgId,
    email: `${id}@org.test`,
    name: null,
    passwordHash: "old-hash",
    role,
    contactId: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  });
}

async function insertApiToken(db: Db, createdByUserId: string, orgId: string): Promise<{ token: string; tokenHash: string }> {
  const token = newApiToken();
  const tokenHash = await hashToken(token);
  await db.insert(schema.apiToken).values({
    id: newId(),
    orgId,
    name: "integration token",
    tokenHash,
    tokenPrefix: apiTokenDisplayPrefix(token),
    createdByUserId,
    lastUsedAt: null,
    createdAt: new Date(1000),
    updatedAt: new Date(1000),
  });
  return { token, tokenHash };
}

// No-op fake KV: revokeResetTokenForUser just needs to run without throwing.
function fakeKV() {
  return { get: async () => null, put: async () => {}, delete: async () => {} };
}

function buildApp(db: Db) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    c.env = { KV: fakeKV() } as never;
    await next();
  });
  app.use("*", sessionLoader);
  app.route("/", usersRoutes);
  // Minimal bearer-reachable probe route, mirroring GET /api/v1/users'
  // guard shape (requireOrganizer only, no requireCookieSession) so a
  // bearer token can be asserted to authenticate -- or not -- for real.
  app.get("/probe", requireOrganizer, (c) => c.json({ ok: true, userId: c.var.auth?.userId }));
  return app;
}

function cookieAuthHeaders() {
  return { "content-type": "application/json", "x-chq-csrf": "1" };
}

describe("DEC-949: reset-password revokes the target's bearer tokens too", () => {
  it("deletes the target's api_token rows, reports the count, and the old token stops authenticating -- while another user's token in the same org survives", async () => {
    const db = makeTestDb();
    await insertUser(db, "organizer-1", ORG_A, "organizer");
    // Bearer auth (resolveBearerAuth, DEC-276) requires the token's minting
    // user to currently hold role='organizer', so both token-minting users
    // here are organizers too.
    await insertUser(db, "target-1", ORG_A, "organizer");
    await insertUser(db, "other-1", ORG_A, "organizer");

    const targetToken = await insertApiToken(db, "target-1", ORG_A);
    const otherToken = await insertApiToken(db, "other-1", ORG_A);

    const app = buildApp(db);

    // Sanity: the target's bearer token authenticates BEFORE the reset.
    const beforeRes = await app.request("/probe", {
      headers: { authorization: `Bearer ${targetToken.token}` },
    });
    expect(beforeRes.status).toBe(200);
    const before = (await beforeRes.json()) as { ok: boolean; userId: string };
    expect(before.userId).toBe("target-1");

    // Cookie-session organizer resets the target's password. Built as a
    // fresh app (rather than reusing buildApp's sessionLoader-based one) so
    // the stamped auth is unconditional, matching how a real cookie-session
    // request would resolve.
    const organizerAuth: AuthInfo = { userId: "organizer-1", role: "organizer", orgId: ORG_A };
    const resetApp = new Hono<AppEnv>();
    registerErrorHandler(resetApp);
    resetApp.use("*", async (c, next) => {
      c.set("db", db as unknown as AppEnv["Variables"]["db"]);
      c.env = { KV: fakeKV() } as never;
      c.set("auth", organizerAuth);
      await next();
    });
    resetApp.route("/", usersRoutes);

    const resetRes = await resetApp.request("/api/v1/users/target-1/reset-password", {
      method: "POST",
      headers: cookieAuthHeaders(),
      body: "{}",
    });
    expect(resetRes.status).toBe(200);
    const resetBody = (await resetRes.json()) as { revokedApiTokens: number };
    expect(resetBody.revokedApiTokens).toBe(1);

    // The target's api_token row is gone.
    const allTokens = await db.select().from(schema.apiToken);
    expect(allTokens.some((r) => r.tokenHash === targetToken.tokenHash)).toBe(false);
    // The other user's token in the same org survives untouched.
    expect(allTokens.some((r) => r.tokenHash === otherToken.tokenHash)).toBe(true);

    // The old token no longer authenticates a request.
    const afterApp = buildApp(db);
    const afterRes = await afterApp.request("/probe", {
      headers: { authorization: `Bearer ${targetToken.token}` },
    });
    expect(afterRes.status).toBe(401);

    // The other user's token still authenticates.
    const otherRes = await afterApp.request("/probe", {
      headers: { authorization: `Bearer ${otherToken.token}` },
    });
    expect(otherRes.status).toBe(200);
  });
});
