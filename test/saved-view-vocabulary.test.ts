// DEC-538: saved view config validation must accept exactly the canonical
// submission status and sort-order vocabularies, not a hand-copied subset
// that silently drifts (as happened when DEC-341 added the 'worklist' sort
// to SORT_ORDERS at submissions/query.ts without updating the local copy
// that used to live in views.ts). This test derives its cases from the
// canonical exports so a future vocabulary addition is caught automatically
// instead of requiring a third hand-maintained list here.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { isValidSavedViewConfig, listSavedViews } from "../src/server/repo/views";
import { SUBMISSION_STATUSES } from "../src/domain/status";
import { SORT_ORDERS } from "../src/server/repo/submissions/query";

function baseConfig(overrides: Partial<{ sort: string; status: string[] }>) {
  return {
    q: "",
    status: [],
    trackId: null,
    sort: "newest",
    columns: [],
    ...overrides,
  };
}

describe("isValidSavedViewConfig vocabulary", () => {
  for (const sort of SORT_ORDERS) {
    it(`accepts canonical sort order '${sort}'`, () => {
      expect(isValidSavedViewConfig(baseConfig({ sort }))).toBe(true);
    });
  }

  for (const status of SUBMISSION_STATUSES) {
    it(`accepts canonical submission status '${status}'`, () => {
      expect(isValidSavedViewConfig(baseConfig({ status: [status] }))).toBe(true);
    });
  }

  it("rejects a bogus sort value", () => {
    expect(isValidSavedViewConfig(baseConfig({ sort: "definitely-not-a-sort" }))).toBe(false);
  });

  it("rejects a bogus status value", () => {
    expect(isValidSavedViewConfig(baseConfig({ status: ["definitely-not-a-status"] }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DEC-031 (wave-81 amendment): the row reader (views.ts toRecord) spends the
// module's own isValidSavedViewConfig validator instead of casting the
// parsed JSON straight through. Exercised against a real (in-memory) SQLite
// row so a malformed config_json actually reaches the reader, not just the
// validator directly.
// ---------------------------------------------------------------------------

const DDL = `
create table saved_view (
  id text primary key,
  event_id text,
  name text,
  config_json text,
  created_by_user_id text,
  shared integer not null default 1,
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

describe("views.ts toRecord spends isValidSavedViewConfig on read (DEC-031 wave-81 amendment)", () => {
  it("throws a named error reading a row whose config_json has a bogus sort", async () => {
    const db = makeTestDb();
    await db.insert(schema.savedView).values({
      id: "sv-bad-sort",
      eventId: "event-1",
      name: "Bad sort",
      configJson: JSON.stringify({ q: "", status: [], trackId: null, sort: "bogus", columns: [] }),
      createdByUserId: "user-1",
      shared: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(listSavedViews(db, "event-1", "user-1")).rejects.toThrow(/sv-bad-sort\.config_json/);
  });

  it("throws a named error reading a row whose config_json has a bogus status token", async () => {
    const db = makeTestDb();
    await db.insert(schema.savedView).values({
      id: "sv-bad-status",
      eventId: "event-1",
      name: "Bad status",
      configJson: JSON.stringify({ q: "", status: ["bogus"], trackId: null, sort: "newest", columns: [] }),
      createdByUserId: "user-1",
      shared: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(listSavedViews(db, "event-1", "user-1")).rejects.toThrow(/sv-bad-status\.config_json/);
  });
});
