// w49-g: discharges the FOUR server-side items of docs/eval-findings.md's
// "STILL UNFALSIFIABLE (batch B remainder)" list re-homed (unowned) by
// task-w47-h. For three of the four (reviewer plan window + file-authz
// twin, DEC-018; sessionboard participant cap, DEC-604; send.ts intra-batch
// dedupe collapse, DEC-238) re-confirming the claim TRUE at runtime found
// each ALREADY has a real, exercised, non-tautological falsifying check
// in-tree -- see docs/mandates/w41-falsifiability-batch-b.md for the exact
// citations (test/review-plan-window-reads.test.ts,
// test/sessionboard-participant-cap.test.ts, test/comms-send-dedupe.test.ts).
// This file adds ONE genuinely new check: the `updateEvent` slug guard
// (DEC-111, src/server/repo/events.ts:224-259), whose only existing test
// (test/events-update-slug-race.test.ts) exercises the translation through
// a route with a FAKE thrown error mimicking a D1 unique-violation shape.
// This file instead drives the REAL sqlite UNIQUE index
// (`event_slug_idx`), the actual constraint the production D1 binding
// enforces, through the real (unmocked) updateEvent function directly --
// an independent, DB-level falsifying check at a different layer than the
// existing route-level one.

import { describe, expect, it, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { updateEvent } from "../src/server/repo/events";
import type { ApiError } from "../src/server/http";

const DDL = `
create table event (
  id text primary key,
  org_id text not null,
  name text not null,
  slug text not null,
  start_date text not null,
  end_date text not null,
  location text,
  timezone text not null,
  record_prefix text not null default 'SES',
  branding_json text,
  created_at integer,
  updated_at integer
);
create unique index event_slug_idx on event (slug);
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
      return { rows: rows as unknown[][] };
    },
    { schema, casing: "snake_case" },
  );
  return db as unknown as Db;
}

const ORG_A = "org-a";

function insertEvent(db: Db, id: string, slug: string) {
  const now = new Date(0);
  return db
    .insert(schema.event)
    .values({
      id,
      orgId: ORG_A,
      name: `Event ${id}`,
      slug,
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      location: null,
      timezone: "UTC",
      recordPrefix: "EV",
      brandingJson: null,
      createdAt: now,
      updatedAt: now,
    });
}

describe("DEC-111: updateEvent slug guard -- real sqlite UNIQUE index, not a mocked error shape", () => {
  let db: Db;

  beforeEach(async () => {
    db = makeTestDb();
    await insertEvent(db, "event-a", "event-a-slug");
    await insertEvent(db, "event-b", "event-b-slug");
  });

  it("renaming event-a's slug to event-b's ALREADY-TAKEN slug is caught and translated into ApiError('invalid', fields.slug), never an unhandled DB error", async () => {
    await expect(updateEvent(db, "event-a", ORG_A, { slug: "event-b-slug" })).rejects.toMatchObject({
      code: "invalid",
      fields: { slug: "Already in use" },
    } satisfies Partial<ApiError> & { fields: unknown });

    // The row must be UNCHANGED -- a caught constraint violation still ran
    // inside the same statement, so nothing should have partially applied.
    const rows = await db.select().from(schema.event);
    const eventA = rows.find((r) => r.id === "event-a");
    expect(eventA?.slug).toBe("event-a-slug");
  });

  it("renaming event-a to a genuinely free slug succeeds and the row reflects the new slug", async () => {
    const updated = await updateEvent(db, "event-a", ORG_A, { slug: "brand-new-slug" });
    expect(updated.slug).toBe("brand-new-slug");
  });

  it("a rename that changes name only (no slug) is unaffected by the unique index at all", async () => {
    const updated = await updateEvent(db, "event-a", ORG_A, { name: "Renamed Event" });
    expect(updated.name).toBe("Renamed Event");
    expect(updated.slug).toBe("event-a-slug");
  });
});
