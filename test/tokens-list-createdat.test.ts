// DEC-027 amendment (wave 47, task w47-e): GET /api/v1/tokens now selects
// schema.apiToken.createdAt and emits `createdAt: <epoch ms>` on each item
// alongside id/name/tokenPrefix/lastUsedAt. This is a route-level test (not
// a hand-typed shape assertion) so it exercises the real select against a
// real in-memory D1-shaped db -- same technique as
// test/cross-org-event-scope-probe.test.ts (DatabaseSync + drizzle
// sqlite-proxy against DDL concatenated from every migrations/*.sql file).

import { describe, expect, it, afterAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { tokensRoutes } from "../src/routes/api/tokens";
import { hashToken, newApiToken, apiTokenDisplayPrefix } from "../src/auth/tokens";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

function loadFullDdl(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")).join("\n");
}

function makeSqliteDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadFullDdl());
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
  return { db: db as unknown as Db, sqlite };
}

const ORG = "org-tokens-createdat";
const USER = "user-tokens-createdat";

describe("GET /api/v1/tokens carries createdAt (DEC-027 wave-47 amendment)", () => {
  let sqlite: DatabaseSync;

  afterAll(() => {
    sqlite?.close();
  });

  it("emits createdAt as a number for a freshly minted token, alongside id/name/tokenPrefix/lastUsedAt", async () => {
    const built = makeSqliteDb();
    sqlite = built.sqlite;
    const db = built.db;
    const now = new Date(1_700_000_000_000);

    await db.insert(schema.org).values({ id: ORG, name: "Org", createdAt: now, updatedAt: now });
    await db.insert(schema.user).values({
      id: USER,
      orgId: ORG,
      email: "organizer@example.test",
      passwordHash: "not-a-real-hash",
      role: "organizer",
      contactId: null,
      createdAt: now,
      updatedAt: now,
    });

    const plaintext = newApiToken();
    const tokenHash = await hashToken(plaintext);
    const createdAt = new Date(1_700_000_500_000);
    await db.insert(schema.apiToken).values({
      id: "token-createdat-probe",
      orgId: ORG,
      name: "CI pipeline",
      tokenHash,
      tokenPrefix: apiTokenDisplayPrefix(plaintext),
      createdByUserId: USER,
      lastUsedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    const app = new Hono<AppEnv>();
    const auth: AuthInfo = { userId: USER, role: "organizer", orgId: ORG };
    app.use("*", async (c, next) => {
      c.set("db", db);
      c.set("auth", auth);
      await next();
    });
    registerErrorHandler(app);
    app.route("/", tokensRoutes);

    const res = await app.request("/api/v1/tokens", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    const item = body.items[0]!;
    expect(item).toEqual({
      id: "token-createdat-probe",
      name: "CI pipeline",
      tokenPrefix: apiTokenDisplayPrefix(plaintext),
      lastUsedAt: null,
      createdAt: createdAt.getTime(),
    });
    expect(typeof item.createdAt).toBe("number");
  });
});
