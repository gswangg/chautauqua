// DEC-398 (wave-56 amendment): createDefaultForm's insert-on-conflict-do-
// nothing-then-select makes the event's default CFP form ('Call for Papers',
// isDefault:true) race-safe against form_event_id_title_idx (migrations/0033,
// UNIQUE(event_id, title)) -- the same find-or-create shape
// getOrCreateFormTaskForm (src/server/repo/submissions/status.ts) uses. Runs
// against a real in-memory SQLite engine (same technique as
// test/form-title-unique.test.ts) so the actual ON CONFLICT clause is
// exercised, not simulated.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { createDefaultForm, getOrCreateForm } from "../src/server/repo/forms";
import type { Db } from "../src/server/context";

const DDL = `
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  location text,
  timezone text,
  record_prefix text,
  branding_json text,
  created_at integer,
  updated_at integer
);
create table form (
  id text primary key,
  event_id text,
  title text,
  description text,
  is_default integer,
  open_date integer,
  close_date integer,
  tracks_json text,
  created_at integer,
  updated_at integer
);
create unique index form_event_id_title_idx on form (event_id, title);
create table form_field (
  id text primary key,
  form_id text,
  section text,
  kind text,
  label text,
  help_text text,
  required integer,
  position integer,
  options_json text,
  rule_json text,
  locked integer,
  role text,
  created_at integer,
  updated_at integer
);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync } {
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
  return { db: db as unknown as Db, sqlite };
}

describe("getOrCreateForm default-form race (DEC-398 amendment, wave 56)", () => {
  let db: Db;
  let sqlite: DatabaseSync;
  const eventId = "event-1";

  beforeEach(() => {
    ({ db, sqlite } = makeTestDb());
    const now = Date.now();
    sqlite.exec(
      `insert into event (id, org_id, name, slug, start_date, end_date, timezone, record_prefix, created_at, updated_at)
       values ('${eventId}', 'org-1', 'Event One', 'event-one', '2030-06-01', '2030-06-03', 'UTC', 'SES', ${now}, ${now})`,
    );
  });
  afterEach(() => {
    sqlite.close();
  });

  it("two getOrCreateForm calls awaited together resolve to one form id, exactly one set of locked fields, and neither throws", async () => {
    const [a, b] = await Promise.all([getOrCreateForm(db, eventId), getOrCreateForm(db, eventId)]);

    expect(a.form.id).toBe(b.form.id);

    const formRows = sqlite.prepare("select id from form where event_id = ? and title = ?").all(eventId, "Call for Papers") as {
      id: string;
    }[];
    expect(formRows).toHaveLength(1);
    expect(formRows[0]!.id).toBe(a.form.id);

    const fieldRows = sqlite.prepare("select label from form_field where form_id = ?").all(a.form.id) as { label: string }[];
    const labels = fieldRows.map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length); // no duplicate locked field labels
    expect(labels.length).toBeGreaterThan(0);

    // The racer whose own insert won the (eventId, title) slot seeds the
    // fields, so it always returns the complete set.
    const winnerCall = a.fields.length >= b.fields.length ? a : b;
    const loserCall = winnerCall === a ? b : a;
    expect(winnerCall.fields.length).toBe(fieldRows.length);

    // DEC-592 amendment (wave 10) pushed the default form from 8 to 10 field
    // rows, which crosses chunkRowsForInsert's DEC-528 bound-parameter budget
    // (12 columns x 10 rows = 120 > MAX_D1_BOUND_PARAMS - 10), so the seed is
    // now TWO INSERT statements rather than one. DEC-398 binds the find-or-
    // create SHAPE (insert-on-conflict-do-nothing, re-select the winner, seed
    // child rows only when this call's own candidate id won) and D1 has no
    // interactive transaction, so a losing racer that reads between the
    // winner's two chunks can observe seeding in progress. What DEC-398
    // guarantees -- and what is asserted here -- is that the loser never
    // double-seeds and never sees a foreign or duplicated row: every field it
    // returns is a genuine, distinct row of the one winning form.
    const loserIds = loserCall.fields.map((f) => f.id);
    expect(new Set(loserIds).size).toBe(loserIds.length);
    const winnerIds = new Set(winnerCall.fields.map((f) => f.id));
    for (const id of loserIds) expect(winnerIds.has(id)).toBe(true);
    for (const f of loserCall.fields) expect(f.formId).toBe(a.form.id);

    // The settled state is complete regardless of who read when: a fresh read
    // after both racers resolve sees exactly one full set of fields.
    const settled = await getOrCreateForm(db, eventId);
    expect(settled.form.id).toBe(a.form.id);
    expect(settled.fields.length).toBe(fieldRows.length);
  });

  it("throws loudly when (eventId, 'Call for Papers') already resolves to a non-default form", async () => {
    const now = Date.now();
    sqlite.exec(
      `insert into form (id, event_id, title, is_default, created_at, updated_at)
       values ('form-task-lookalike', '${eventId}', 'Call for Papers', 0, ${now}, ${now})`,
    );

    await expect(createDefaultForm(db, eventId)).rejects.toThrow(
      /createDefaultForm: \(eventId, 'Call for Papers'\) resolves to a non-default form/,
    );
  });
});
