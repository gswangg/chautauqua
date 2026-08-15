// DEC-552 amendment (findings wave 14): createUser (src/server/repo/
// users.ts) and createEvent (src/server/repo/events.ts) each guard a real
// UNIQUE index (user_email_idx / event_slug_idx) with a SELECT-then-INSERT
// whose pre-read is documented as authoritative but isn't -- a racer can
// land its INSERT between the read and the write, previously surfacing as a
// raw D1 UNIQUE-violation 500 instead of the route's documented refusal.
// This file proves the INSERT itself is now the authority: it exercises the
// atomic onConflictDoNothing path directly, both via the ordinary "pre-read
// sees the row" case and via a genuine post-read race (two createUser calls
// issued concurrently with Promise.all, no intervening read to short-circuit
// either one), asserting the SAME ApiError shape either way.
//
// Harness: the real in-memory SQLite-through-drizzle-sqlite-proxy technique
// test/fresh-event-no-seed.test.ts already uses -- DDL concatenated from
// every migrations/*.sql file on disk, so this exercises the real
// user_email_idx / event_slug_idx constraints, not a hand-rolled subset.

import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { newId } from "../src/domain/ids";
import { createUser } from "../src/server/repo/users";
import { createEvent } from "../src/server/repo/events";
import { ApiError } from "../src/server/http";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
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

async function isApiConflictError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error("expected an ApiError to be thrown");
}

describe("DEC-552 amendment (wave 14): createUser races user_email_idx", () => {
  let db: Db;
  let orgId: string;

  beforeEach(async () => {
    ({ db } = makeTestDb());
    orgId = newId();
    const now = new Date();
    await db.insert(schema.org).values({ id: orgId, name: "Race Org", createdAt: now, updatedAt: now });
  });

  it("throws the documented 409 shape when the pre-read sees the row (sequential duplicate)", async () => {
    const email = `dup-${newId()}@example.test`;
    await createUser(db, { orgId, email, role: "reviewer", passwordHash: "hash-a" });

    const err = await isApiConflictError(
      createUser(db, { orgId, email, role: "reviewer", passwordHash: "hash-b" }),
    );
    expect(err.code).toBe("conflict");
    expect(err.message).toBe("A user with this email already exists");
    expect(err.fields).toEqual({ email: "already in use" });
  });

  it("throws the SAME 409 shape when two calls race with no intervening read (concurrent duplicate)", async () => {
    const email = `race-${newId()}@example.test`;

    // Both calls start before either one's pre-read has a chance to see the
    // other's row -- this is exactly the race the amendment targets: the
    // pre-read is a fast path, not the gate, so this must resolve via the
    // atomic INSERT ... ON CONFLICT DO NOTHING branch, not the pre-check.
    const results = await Promise.allSettled([
      createUser(db, { orgId, email, role: "reviewer", passwordHash: "hash-a" }),
      createUser(db, { orgId, email, role: "reviewer", passwordHash: "hash-b" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const rejection = rejected[0] as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(ApiError);
    const err = rejection.reason as ApiError;
    expect(err.code).toBe("conflict");
    expect(err.message).toBe("A user with this email already exists");
    expect(err.fields).toEqual({ email: "already in use" });

    // Exactly one row landed -- the loser did not also insert.
    const rows = await db.select().from(schema.user).where(eq(schema.user.email, email));
    expect(rows.length).toBe(1);
  });
});

describe("DEC-552 amendment (wave 14): createEvent races event_slug_idx", () => {
  let db: Db;
  let orgId: string;

  beforeEach(async () => {
    ({ db } = makeTestDb());
    orgId = newId();
    const now = new Date();
    await db.insert(schema.org).values({ id: orgId, name: "Race Org", createdAt: now, updatedAt: now });
  });

  it("throws the documented 'invalid'/'Already in use' shape rather than an unhandled error", async () => {
    const slug = `slug-${newId()}`;
    await createEvent(db, {
      orgId,
      name: "First Event",
      slug,
      startDate: "2027-05-01",
      endDate: "2027-05-03",
      timezone: "America/Chicago",
    });

    const err = await isApiConflictError(
      createEvent(db, {
        orgId,
        name: "Second Event",
        slug,
        startDate: "2027-06-01",
        endDate: "2027-06-03",
        timezone: "America/Chicago",
      }),
    );
    expect(err.code).toBe("invalid");
    expect(err.message).toBe("Slug is already in use");
    expect(err.fields).toEqual({ slug: "Already in use" });
  });

  it("throws the same shape when two creates race with no intervening read", async () => {
    const slug = `slug-race-${newId()}`;

    const results = await Promise.allSettled([
      createEvent(db, {
        orgId,
        name: "Racer A",
        slug,
        startDate: "2027-05-01",
        endDate: "2027-05-03",
        timezone: "America/Chicago",
      }),
      createEvent(db, {
        orgId,
        name: "Racer B",
        slug,
        startDate: "2027-06-01",
        endDate: "2027-06-03",
        timezone: "America/Chicago",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const rejection = rejected[0] as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(ApiError);
    const err = rejection.reason as ApiError;
    expect(err.code).toBe("invalid");
    expect(err.message).toBe("Slug is already in use");
    expect(err.fields).toEqual({ slug: "Already in use" });
  });
});
