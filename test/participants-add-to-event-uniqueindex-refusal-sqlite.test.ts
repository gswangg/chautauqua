// DEC-909 (wave-26 amendment): insertActiveParticipants inserted with no
// onConflictDoNothing clause, unlike its sibling inviteParticipant one
// function up in the same file, which already guards
// participant_submission_id_contact_id_idx (migrations/0019) and returns
// DUPLICATE_PARTICIPANT. attachOrCreateRosterSession's exact-title branch
// (src/server/repo/contacts/push.ts) re-adding a contact already on that
// session therefore broke the real unique index and raised a raw
// DrizzleQueryError, not an ApiError, where src/server/repo/portal-edit.ts's
// comment for the same class of door promises "never a 500".
//
// test/contacts-add-to-event.test.ts uses a fake Db with NO unique index,
// which is why this went uncaught -- this pins the WRITE half against a
// real (in-memory) SQLite engine via node:sqlite + drizzle's sqlite-proxy
// driver (same technique as test/insert-active-participants-touch-sqlite.test.ts
// and test/unique-index-refusals.test.ts), with the real
// participant_submission_id_contact_id_idx present, so a re-add through
// attachOrCreateRosterSession's exact-title branch is exercised against the
// actual constraint, not a fake store that never had one.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { attachOrCreateRosterSession } from "../src/server/repo/contacts/push";
import { ApiError } from "../src/server/http";
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
  updated_at integer not null
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
  updated_at integer
);
create unique index participant_submission_id_contact_id_idx on participant (submission_id, contact_id);
`;

const T0 = 1_700_000_000_000;
const EVENT_ID = "event-1";
const SUBMISSION_ID = "sub-existing";
const CONTACT_ID = "contact-1";
const TITLE = "Existing session";

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

function seedSubmissionWithParticipant(sqlite: DatabaseSync): void {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, status, created_at, updated_at)
       values (?, ?, 1, ?, 'accepted', ?, ?)`,
    )
    .run(SUBMISSION_ID, EVENT_ID, TITLE, T0, T0);
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
       values ('participant-1', ?, ?, 'speaker', 0, 1, 'none', ?, ?)`,
    )
    .run(SUBMISSION_ID, CONTACT_ID, T0, T0);
}

describe("DEC-909 (wave-26 amendment): attachOrCreateRosterSession's exact-title branch honors participant_submission_id_contact_id_idx", () => {
  it("re-adding a contact already attached to the matched session throws the named refusal, never a raw DrizzleQueryError", async () => {
    const { db, sqlite } = makeTestDb();
    seedSubmissionWithParticipant(sqlite);

    const contact = {
      id: CONTACT_ID,
      email: "person@example.test",
      firstName: "Person",
      lastName: "One",
      title: null,
      company: null,
    };

    await expect(attachOrCreateRosterSession(db, EVENT_ID, "org-1", contact, TITLE)).rejects.toMatchObject({
      code: "invalid",
      message: "This contact is already a participant on this submission",
      fields: { contactId: "Already invited" },
    });

    // Never a raw DrizzleQueryError -- specifically an ApiError.
    let caught: unknown;
    try {
      await attachOrCreateRosterSession(db, EVENT_ID, "org-1", contact, TITLE);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);

    // No second participant row landed -- the refusal fired instead of a
    // half-applied write.
    const rows = sqlite.prepare(`select id from participant where submission_id = ? and contact_id = ?`).all(SUBMISSION_ID, CONTACT_ID) as {
      id: string;
    }[];
    expect(rows).toHaveLength(1);
  });

  it("re-adding a DIFFERENT contact to the same matched session still succeeds (the index only guards the (submission, contact) pair)", async () => {
    const { db, sqlite } = makeTestDb();
    seedSubmissionWithParticipant(sqlite);

    const otherContact = {
      id: "contact-2",
      email: "other@example.test",
      firstName: "Other",
      lastName: "Person",
      title: null,
      company: null,
    };

    const submissionId = await attachOrCreateRosterSession(db, EVENT_ID, "org-1", otherContact, TITLE);
    expect(submissionId).toBe(SUBMISSION_ID);

    const rows = sqlite.prepare(`select contact_id from participant where submission_id = ? order by contact_id`).all(SUBMISSION_ID) as {
      contact_id: string;
    }[];
    expect(rows.map((r) => r.contact_id)).toEqual(["contact-1", "contact-2"]);
  });
});
