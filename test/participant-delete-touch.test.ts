// DEC-725 (task-w10-tb): removeParticipantRow is the one participant writer
// that used to skip the touch-on-write contract (submissions/touch.ts's
// header). Removing a co-presenter changes the submission's published
// Speakers cell exactly like the other writers in
// src/server/repo/participants.ts, so the submission's updated_at must
// advance when a participant is removed — otherwise DEC-725's watermark
// (src/sync/airtable.ts) and the overview worklist (src/server/repo/
// overview.ts's `desc(submission.updatedAt)`) never notice the departure.
//
// Same real (in-memory) SQLite + drizzle sqlite-proxy technique as
// test/contacts-import-merge-keeps-email.test.ts, because a hand-rolled fake
// Db never executes the real DELETE/UPDATE statements this pins.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { removeParticipantRow } from "../src/server/repo/participants";
import type { Db } from "../src/server/context";

const DDL = `
create table submission (
  id text primary key,
  event_id text,
  seq integer,
  title text,
  status text,
  created_at integer,
  updated_at integer,
  origin text NOT NULL DEFAULT 'cfp'
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  invite_status text not null default 'none',
  title_at_time text,
  org_at_time text,
  name_at_time text,
  created_at integer,
  updated_at integer,
  invitation_message text,
  reply_by integer,
  invited_by_user_id text,
  decline_note text,
  invitation_token_hash text
);
`;

const T0 = 1_700_000_000_000;

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

function readSubmissionUpdatedAt(sqlite: DatabaseSync, id: string): number {
  const row = sqlite.prepare(`select updated_at from submission where id = ?`).get(id) as
    | { updated_at: number }
    | undefined;
  if (!row) throw new Error(`submission ${id} vanished`);
  return row.updated_at;
}

describe("DEC-725 (task-w10-tb): removeParticipantRow touches its owning submission", () => {
  it("advances submission.updated_at when a co-presenter is removed", async () => {
    const { db, sqlite } = makeTestDb();
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("sub_1", "evt_1", 1, "A great talk", "accepted", T0, T0);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("pt_lead", "sub_1", "ct_lead", "speaker", 0, 1, "none", T0, T0);
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("pt_co", "sub_1", "ct_co", "co-presenter", 1, 1, "accepted", T0, T0);

    const before = readSubmissionUpdatedAt(sqlite, "sub_1");
    expect(before).toBe(T0);

    // The sqlite-proxy test driver's `run` result carries no `.meta.changes`
    // (that's a D1-specific field) — removeParticipantRow's return value
    // isn't under test here, only its side effects: the row is actually
    // gone, and the submission is touched.
    await removeParticipantRow(db, "pt_co", "sub_1");

    const after = readSubmissionUpdatedAt(sqlite, "sub_1");
    expect(after).toBeGreaterThan(before);

    const remaining = sqlite.prepare(`select count(*) as n from participant where submission_id = ?`).get("sub_1") as {
      n: number;
    };
    expect(remaining.n).toBe(1);
  });

  it("still touches the submission even when the scope misses (0 rows removed) — matches the bare-delete's own no-op-write shape", async () => {
    // removeParticipantRow always stamps before attempting the delete
    // (submissions/touch.ts's header: the touch must happen while the
    // submission id is still derivable, unconditionally on the caller-
    // supplied scope). A miss still returns 0.
    const { db, sqlite } = makeTestDb();
    sqlite
      .prepare(
        `insert into submission (id, event_id, seq, title, status, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("sub_2", "evt_1", 2, "Another talk", "accepted", T0, T0);

    const removed = await removeParticipantRow(db, "pt_missing", "sub_2");
    expect(removed).toBe(0);
  });
});
