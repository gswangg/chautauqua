// DEC-725 (wave-18 amendment): insertActiveParticipants's exemption comment
// claimed "this function's one caller (pushContactsToEvent) always calls it
// in the same request that just createSubmission'd submissionId" -- false,
// because src/server/repo/contacts/push.ts's attachOrCreateRosterSession
// attaches to a PRE-EXISTING submission (its exact-title-match branch) that
// nothing else in that request touches. This pins the WRITE half against a
// real (in-memory) SQLite engine via node:sqlite + drizzle's sqlite-proxy
// driver -- same technique as test/sessionboard-participant-touch-sqlite.test.ts
// -- because a hand-rolled fake Db never proves the real
// `UPDATE submission SET updated_at = ...` statement lands: import a
// participant onto an EXISTING submission and assert submission.updated_at
// moved, since both src/sync/airtable.ts's `gt(submission.updatedAt,
// lookbackMark)` watermark and src/server/repo/overview.ts's
// `desc(updatedAt)` worklist ordering depend on it.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { insertActiveParticipants } from "../src/server/repo/participants";
import type { Db } from "../src/server/context";

const DDL = `
create table submission (
  id text primary key,
  event_id text not null,
  seq integer,
  title text,
  status text,
  external_ref text,
  created_at integer,
  updated_at integer not null,
  origin text NOT NULL DEFAULT 'cfp'
);
create table participant (
  id text primary key,
  submission_id text not null,
  contact_id text not null,
  role text not null default 'speaker',
  "order" integer not null default 0,
  visible integer not null default 0,
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
create unique index participant_submission_id_contact_id_idx on participant (submission_id, contact_id);
`;

const T0 = 1_700_000_000_000;
const EVENT_ID = "event-1";

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

function seedSubmission(sqlite: DatabaseSync, id: string, updatedAt: number): void {
  sqlite
    .prepare(`insert into submission (id, event_id, seq, title, status, created_at, updated_at)
      values (?, ?, 1, 'Existing session', 'accepted', ?, ?)`)
    .run(id, EVENT_ID, T0, updatedAt);
}

function readSubmissionUpdatedAt(sqlite: DatabaseSync, id: string): number {
  const row = sqlite.prepare(`select updated_at from submission where id = ?`).get(id) as { updated_at: number } | undefined;
  if (!row) throw new Error(`submission ${id} vanished`);
  return row.updated_at;
}

describe("DEC-725 (wave-18 amendment): insertActiveParticipants stamps its submission, even a pre-existing one", () => {
  it("attaching a contact onto an EXISTING submission (the attachOrCreateRosterSession shape) advances updated_at", async () => {
    const { db, sqlite } = makeTestDb();
    seedSubmission(sqlite, "sub-existing", T0);

    await insertActiveParticipants(db, "sub-existing", [
      { contactId: "contact-1", role: "speaker", order: 0, titleAtTime: null, orgAtTime: null },
    ]);

    expect(readSubmissionUpdatedAt(sqlite, "sub-existing")).toBeGreaterThan(T0);

    // The row write itself also landed (the touch didn't replace it).
    const row = sqlite.prepare(`select contact_id from participant where submission_id = ?`).get("sub-existing") as {
      contact_id: string;
    };
    expect(row.contact_id).toBe("contact-1");
  });

  it("attaching a second batch onto a submission with no prior participants also stamps it", async () => {
    const { db, sqlite } = makeTestDb();
    seedSubmission(sqlite, "sub-fresh", T0);

    await insertActiveParticipants(db, "sub-fresh", [
      { contactId: "contact-a", role: "speaker", order: 1, titleAtTime: "Engineer", orgAtTime: "Acme" },
      { contactId: "contact-b", role: "speaker", order: 2, titleAtTime: null, orgAtTime: null },
    ]);

    expect(readSubmissionUpdatedAt(sqlite, "sub-fresh")).toBeGreaterThan(T0);
    const count = sqlite.prepare(`select count(*) as n from participant where submission_id = ?`).get("sub-fresh") as {
      n: number;
    };
    expect(count.n).toBe(2);
  });

  it("an empty contacts list is a no-op: no write, no stamp", async () => {
    const { db, sqlite } = makeTestDb();
    seedSubmission(sqlite, "sub-noop", T0);

    await insertActiveParticipants(db, "sub-noop", []);

    expect(readSubmissionUpdatedAt(sqlite, "sub-noop")).toBe(T0);
  });
});
