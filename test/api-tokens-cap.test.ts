// DEC-027 wave-51 amendment (J12 DATA-OUT): bearer API tokens were the one
// mint door with no per-org cap at all -- every sibling door (saved views,
// saved embeds, form fields, ...) already refuses at a bound before
// writing. Covers the POST refusal at MAX_API_TOKENS_PER_ORG, the
// one-below-cap success, the per-org (not global) scope of the count, and
// GET's envelope `max`.

import { describe, expect, it, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { tokensRoutes } from "../src/routes/api/tokens";
import { MAX_API_TOKENS_PER_ORG } from "../src/auth/tokens";
import { overCapCountMessage } from "../src/domain/cap-copy";
import { newId } from "../src/domain/ids";

const DDL = `
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
const ORG_B = "org-b";
const AUTH_A: AuthInfo = { userId: "u-a", role: "organizer", orgId: ORG_A };
const AUTH_B: AuthInfo = { userId: "u-b", role: "organizer", orgId: ORG_B };

function appWithAuth(db: Db, auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db as unknown as AppEnv["Variables"]["db"]);
    c.set("auth", auth);
    await next();
  });
  app.route("/", tokensRoutes);
  return app;
}

function createRequest(name: string) {
  return new Request("http://local/api/v1/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ name }),
  });
}

async function seedTokens(db: Db, orgId: string, count: number) {
  const now = new Date(1000);
  for (let i = 0; i < count; i++) {
    await db.insert(schema.apiToken).values({
      id: newId(),
      orgId,
      name: `Token ${i}`,
      tokenHash: `hash-${orgId}-${i}`,
      tokenPrefix: "chq_aaaaaaaa",
      createdByUserId: "seed-user",
      createdAt: now,
      updatedAt: now,
    });
  }
}

describe("POST /api/v1/tokens (DEC-027 wave-51 per-org cap)", () => {
  let db: Db;

  beforeEach(() => {
    db = makeTestDb();
  });

  it("refuses at MAX_API_TOKENS_PER_ORG with a conflict envelope, writing nothing", async () => {
    await seedTokens(db, ORG_A, MAX_API_TOKENS_PER_ORG);

    const res = await appWithAuth(db, AUTH_A).fetch(createRequest("One too many"));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toContain(
      overCapCountMessage(MAX_API_TOKENS_PER_ORG + 1, MAX_API_TOKENS_PER_ORG, "API token"),
    );
    expect(body.error.message).toMatch(/revoke one/i);

    const orgRows = (await db.select().from(schema.apiToken)).filter((r) => r.orgId === ORG_A);
    expect(orgRows.length).toBe(MAX_API_TOKENS_PER_ORG);
  });

  it("allows creation one below the cap", async () => {
    await seedTokens(db, ORG_A, MAX_API_TOKENS_PER_ORG - 1);

    const res = await appWithAuth(db, AUTH_A).fetch(createRequest("Last one"));
    expect(res.status).toBe(201);

    const orgRows = (await db.select().from(schema.apiToken)).filter((r) => r.orgId === ORG_A);
    expect(orgRows.length).toBe(MAX_API_TOKENS_PER_ORG);
  });

  it("is per-org: a second org at cap does not block the first from creating", async () => {
    await seedTokens(db, ORG_B, MAX_API_TOKENS_PER_ORG);
    await seedTokens(db, ORG_A, 1);

    const res = await appWithAuth(db, AUTH_A).fetch(createRequest("Org A token"));
    expect(res.status).toBe(201);

    const orgARows = (await db.select().from(schema.apiToken)).filter((r) => r.orgId === ORG_A);
    expect(orgARows.length).toBe(2);
  });

  it("also refuses a second org's own request once IT is at cap", async () => {
    await seedTokens(db, ORG_A, 1);
    await seedTokens(db, ORG_B, MAX_API_TOKENS_PER_ORG);

    const res = await appWithAuth(db, AUTH_B).fetch(createRequest("Org B one too many"));
    expect(res.status).toBe(409);

    const orgBRows = (await db.select().from(schema.apiToken)).filter((r) => r.orgId === ORG_B);
    expect(orgBRows.length).toBe(MAX_API_TOKENS_PER_ORG);
  });
});

describe("GET /api/v1/tokens (DEC-027 wave-51 envelope max)", () => {
  it("reports max alongside items/total/page/perPage", async () => {
    const db = makeTestDb();
    await seedTokens(db, ORG_A, 2);

    const res = await appWithAuth(db, AUTH_A).fetch(
      new Request("http://local/api/v1/tokens", { method: "GET" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; max: number };
    expect(body.max).toBe(MAX_API_TOKENS_PER_ORG);
    expect(body.total).toBe(2);
  });
});
