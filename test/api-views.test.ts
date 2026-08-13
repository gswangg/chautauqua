/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import {
  countSavedViews,
  createSavedView,
  isValidSavedViewConfig,
  listSavedViews,
  type SavedViewConfig,
} from "../src/server/repo/views";

describe("isValidSavedViewConfig (DEC-031 config_json shape validation)", () => {
  it("accepts a well-formed config", () => {
    expect(
      isValidSavedViewConfig({
        q: "keynote",
        status: ["pending", "accepted"],
        trackId: "trk1",
        sort: "title",
        columns: ["field1", "field2"],
      }),
    ).toBe(true);
  });

  it("accepts null trackId and empty arrays/strings", () => {
    expect(
      isValidSavedViewConfig({ q: "", status: [], trackId: null, sort: "newest", columns: [] }),
    ).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(isValidSavedViewConfig(null)).toBe(false);
    expect(isValidSavedViewConfig(undefined)).toBe(false);
    expect(isValidSavedViewConfig("nope")).toBe(false);
    expect(isValidSavedViewConfig(42)).toBe(false);
    expect(isValidSavedViewConfig([])).toBe(false);
  });

  it("rejects a missing/non-string q", () => {
    expect(isValidSavedViewConfig({ status: [], trackId: null, sort: "newest", columns: [] })).toBe(false);
    expect(isValidSavedViewConfig({ q: 1, status: [], trackId: null, sort: "newest", columns: [] })).toBe(false);
  });

  it("rejects an unknown status literal", () => {
    expect(
      isValidSavedViewConfig({ q: "", status: ["bogus"], trackId: null, sort: "newest", columns: [] }),
    ).toBe(false);
  });

  it("rejects a non-string, non-null trackId", () => {
    expect(isValidSavedViewConfig({ q: "", status: [], trackId: 5, sort: "newest", columns: [] })).toBe(false);
  });

  it("rejects an invalid sort literal", () => {
    expect(
      isValidSavedViewConfig({ q: "", status: [], trackId: null, sort: "bogus", columns: [] }),
    ).toBe(false);
  });

  it("rejects a non-array columns or non-string entries", () => {
    expect(isValidSavedViewConfig({ q: "", status: [], trackId: null, sort: "newest", columns: "nope" })).toBe(
      false,
    );
    expect(isValidSavedViewConfig({ q: "", status: [], trackId: null, sort: "newest", columns: [1, 2] })).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// DEC-904: a saved view is private until its author shares it. Runs the
// real listSavedViews/countSavedViews/createSavedView against a real
// (in-memory) SQLite engine via node:sqlite + drizzle-orm's sqlite-proxy
// driver (the onboarding-roster-set.test.ts pattern) so the
// `shared = 1 OR created_by_user_id = <viewer>` WHERE predicate is actually
// evaluated, not merely asserted as SQL text.
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

const CONFIG: SavedViewConfig = { q: "", status: [], trackId: null, sort: "newest", columns: [] };

describe("DEC-904: saved-view sharing (listSavedViews/countSavedViews predicate)", () => {
  it("a private view is invisible to a second organizer, visible to its author, and the paged total agrees", async () => {
    const db = makeTestDb();
    const eventId = "event-1";
    const author = "user-author";
    const other = "user-other";

    // Author's own private (unshared) view.
    await createSavedView(db, eventId, "My scratch view", CONFIG, author, false);
    // A shared view from a different organizer -- visible to everyone.
    await createSavedView(db, eventId, "Team view", CONFIG, other, true);
    // Another organizer's own private view -- invisible to the author.
    await createSavedView(db, eventId, "Other's scratch view", CONFIG, other, false);

    const authorViews = await listSavedViews(db, eventId, author);
    expect(authorViews.map((v) => v.name).sort()).toEqual(["My scratch view", "Team view"]);

    const otherViews = await listSavedViews(db, eventId, other);
    expect(otherViews.map((v) => v.name).sort()).toEqual(["Other's scratch view", "Team view"]);

    const authorTotal = await countSavedViews(db, eventId, author);
    const otherTotal = await countSavedViews(db, eventId, other);
    expect(authorTotal).toBe(authorViews.length);
    expect(otherTotal).toBe(otherViews.length);

    // Paged total agrees with the unpaged list length too.
    const authorPaged = await listSavedViews(db, eventId, author, { limit: 1, offset: 0 });
    expect(authorPaged.length).toBe(1);
    expect(authorTotal).toBe(2);
  });

  it("createSavedView writes createdByUserId and shared through to the record", async () => {
    const db = makeTestDb();
    const view = await createSavedView(db, "event-1", "Mine", CONFIG, "user-1", false);
    expect(view.createdByUserId).toBe("user-1");
    expect(view.shared).toBe(false);

    const fetched = await listSavedViews(db, "event-1", "user-1");
    expect(fetched[0]?.createdByUserId).toBe("user-1");
    expect(fetched[0]?.shared).toBe(false);
  });
});
