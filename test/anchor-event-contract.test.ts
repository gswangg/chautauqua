// DEC-013 (wave-26 amendment): pins the ordering contract that
// getAnchorEventForOrg shares with listEventsForOrg's default ordering --
// most recent startDate desc, ties broken by id asc -- and that the anchor
// query never materialises more than one row. Real in-memory SQLite via
// drizzle-sqlite-proxy against DDL concatenated from every migrations/*.sql
// file, same technique as test/tokens-list-createdat.test.ts /
// test/fresh-event-no-seed.test.ts.

import { afterAll, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { newId } from "../src/domain/ids";
import { getAnchorEventForOrg } from "../src/server/repo/events";

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

async function insertOrg(db: Db, orgId: string): Promise<void> {
  await db.insert(schema.org).values({ id: orgId, name: `Org ${orgId}`, createdAt: new Date(), updatedAt: new Date() });
}

async function insertEvent(
  db: Db,
  args: { id: string; orgId: string; name: string; startDate: string },
): Promise<void> {
  const now = new Date();
  await db.insert(schema.event).values({
    id: args.id,
    orgId: args.orgId,
    name: args.name,
    slug: args.id,
    startDate: args.startDate,
    endDate: args.startDate,
    location: null,
    timezone: "UTC",
    recordPrefix: "SES",
    brandingJson: null,
    createdAt: now,
    updatedAt: now,
  });
}

describe("getAnchorEventForOrg (DEC-013 wave-26 amendment)", () => {
  let sqlite: DatabaseSync;

  afterAll(() => {
    sqlite?.close();
  });

  it("returns undefined for an org with zero events", async () => {
    const made = makeSqliteDb();
    sqlite = made.sqlite;
    const orgId = newId();
    await insertOrg(made.db, orgId);

    const anchor = await getAnchorEventForOrg(made.db, orgId);
    expect(anchor).toBeUndefined();
  });

  it("picks the event with the most recent startDate", async () => {
    const made = makeSqliteDb();
    sqlite = made.sqlite;
    const orgId = newId();
    await insertOrg(made.db, orgId);

    const older = newId();
    const newer = newId();
    await insertEvent(made.db, { id: older, orgId, name: "Older", startDate: "2025-01-01" });
    await insertEvent(made.db, { id: newer, orgId, name: "Newer", startDate: "2026-06-01" });

    const anchor = await getAnchorEventForOrg(made.db, orgId);
    expect(anchor?.id).toBe(newer);
    expect(anchor?.name).toBe("Newer");
  });

  it("breaks ties on the same startDate by ascending id", async () => {
    const made = makeSqliteDb();
    sqlite = made.sqlite;
    const orgId = newId();
    await insertOrg(made.db, orgId);

    // Deliberately insert the lexicographically-larger id first so a
    // last-write/insertion-order fallback would fail this assertion.
    const idB = "evt-zzzz-tie";
    const idA = "evt-aaaa-tie";
    await insertEvent(made.db, { id: idB, orgId, name: "Tie B", startDate: "2026-03-01" });
    await insertEvent(made.db, { id: idA, orgId, name: "Tie A", startDate: "2026-03-01" });

    const anchor = await getAnchorEventForOrg(made.db, orgId);
    expect(anchor?.id).toBe(idA);
  });

  it("never materialises more than one row (query issued with limit 1)", async () => {
    const made = makeSqliteDb();
    sqlite = made.sqlite;
    const orgId = newId();
    await insertOrg(made.db, orgId);

    for (let i = 0; i < 5; i++) {
      await insertEvent(made.db, { id: newId(), orgId, name: `Event ${i}`, startDate: `2026-0${i + 1}-01` });
    }

    const allSpy = vi.spyOn(sqlite, "prepare");
    await getAnchorEventForOrg(made.db, orgId);
    const selectCall = allSpy.mock.calls.find(([sql]) => typeof sql === "string" && /select/i.test(sql));
    expect(selectCall?.[0]).toMatch(/limit/i);
    allSpy.mockRestore();
  });

  it("scopes strictly to the given org (does not leak another org's newest event)", async () => {
    const made = makeSqliteDb();
    sqlite = made.sqlite;
    const orgA = newId();
    const orgB = newId();
    await insertOrg(made.db, orgA);
    await insertOrg(made.db, orgB);

    const eventA = newId();
    const eventBNewer = newId();
    await insertEvent(made.db, { id: eventA, orgId: orgA, name: "Org A Event", startDate: "2025-01-01" });
    await insertEvent(made.db, { id: eventBNewer, orgId: orgB, name: "Org B Event", startDate: "2030-01-01" });

    const anchor = await getAnchorEventForOrg(made.db, orgA);
    expect(anchor?.id).toBe(eventA);
  });
});
