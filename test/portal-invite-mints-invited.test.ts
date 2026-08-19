// Eval regression (MAJOR, speaker-management): "'Send portal invite' reports
// success and logs the email in Comms history, but the speaker's
// participation badge remains 'Not invited' after a FULL PAGE RELOAD."
//
// Root cause: DEC-869 removed 'invited' from the three states the
// participation menu lets an organizer PICK -- "Send portal invite" occupies
// that slot as an ACTION whose caption promises "Emails a claim link and sets
// this to Invited" -- but nothing ever wrote the status, so the only door to
// 'invited' was closed while the send stayed a pure mail fan-out.
//
// This pins the write half: markParticipantsInvited, run against a real
// (in-memory) SQLite engine via node:sqlite + drizzle's sqlite-proxy driver
// (same technique as test/submission-touch-on-write.test.ts), so the actual
// SELECT/UPDATE statements are exercised rather than hand-simulated.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { markParticipantsInvited } from "../src/server/repo/participants";
import type { Db } from "../src/server/context";

const DDL = `
create table event (
  id text primary key,
  org_id text,
  record_prefix text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  seq integer,
  title text,
  status text,
  created_at integer,
  updated_at integer
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  role text,
  "order" integer,
  visible integer,
  invite_status text not null default 'none',
  created_at integer,
  updated_at integer,
  unique (submission_id, contact_id)
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

/** Two events, and one participation per (submission, contact) pair listed. */
function seed(sqlite: DatabaseSync, rows: { id: string; submissionId: string; contactId: string; status: string; eventId: string }[]) {
  sqlite.exec(`
    insert into event (id, org_id, record_prefix, created_at, updated_at)
      values ('event-1', 'org-a', 'SES', ${T0}, ${T0}), ('event-2', 'org-a', 'OTH', ${T0}, ${T0});
  `);
  const submissions = new Map<string, string>();
  for (const r of rows) submissions.set(r.submissionId, r.eventId);
  for (const [submissionId, eventId] of submissions) {
    sqlite
      .prepare(`insert into submission (id, event_id, seq, title, status, created_at, updated_at) values (?, ?, 1, 'Talk', 'accepted', ?, ?)`)
      .run(submissionId, eventId, T0, T0);
  }
  for (const r of rows) {
    sqlite
      .prepare(
        `insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at) values (?, ?, ?, 'speaker', 0, 1, ?, ?, ?)`,
      )
      .run(r.id, r.submissionId, r.contactId, r.status, T0, T0);
  }
}

function statusOf(sqlite: DatabaseSync, participantId: string): string {
  const row = sqlite.prepare(`select invite_status from participant where id = ?`).get(participantId) as
    | { invite_status: string }
    | undefined;
  return row!.invite_status;
}

describe("markParticipantsInvited — the portal-invite send mints invite_status='invited'", () => {
  it("writes 'invited' onto every 'none' participation the contact holds in this event", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, [
      { id: "p-1", submissionId: "sub-1", contactId: "ct-1", status: "none", eventId: "event-1" },
      { id: "p-2", submissionId: "sub-2", contactId: "ct-1", status: "none", eventId: "event-1" },
    ]);

    await markParticipantsInvited(db, "event-1", ["ct-1"]);

    expect(statusOf(sqlite, "p-1")).toBe("invited");
    expect(statusOf(sqlite, "p-2")).toBe("invited");
  });

  it("never walks a speaker's own answer backwards: 'accepted' and 'declined' survive a re-send", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, [
      { id: "p-acc", submissionId: "sub-1", contactId: "ct-1", status: "accepted", eventId: "event-1" },
      { id: "p-dec", submissionId: "sub-2", contactId: "ct-1", status: "declined", eventId: "event-1" },
      { id: "p-new", submissionId: "sub-3", contactId: "ct-1", status: "none", eventId: "event-1" },
    ]);

    await markParticipantsInvited(db, "event-1", ["ct-1"]);

    expect(statusOf(sqlite, "p-acc")).toBe("accepted");
    expect(statusOf(sqlite, "p-dec")).toBe("declined");
    expect(statusOf(sqlite, "p-new")).toBe("invited");
  });

  it("is scoped to THIS event: a participation on another event's submission is untouched", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, [
      { id: "p-here", submissionId: "sub-1", contactId: "ct-1", status: "none", eventId: "event-1" },
      { id: "p-there", submissionId: "sub-9", contactId: "ct-1", status: "none", eventId: "event-2" },
    ]);

    await markParticipantsInvited(db, "event-1", ["ct-1"]);

    expect(statusOf(sqlite, "p-here")).toBe("invited");
    expect(statusOf(sqlite, "p-there")).toBe("none");
  });

  it("only touches the contacts it was given", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, [
      { id: "p-1", submissionId: "sub-1", contactId: "ct-1", status: "none", eventId: "event-1" },
      { id: "p-2", submissionId: "sub-1", contactId: "ct-2", status: "none", eventId: "event-1" },
    ]);

    await markParticipantsInvited(db, "event-1", ["ct-1"]);

    expect(statusOf(sqlite, "p-1")).toBe("invited");
    expect(statusOf(sqlite, "p-2")).toBe("none");
  });

  it("bumps the owning submission's updated_at (DEC-725: the published Speakers cell changed)", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, [{ id: "p-1", submissionId: "sub-1", contactId: "ct-1", status: "none", eventId: "event-1" }]);

    await markParticipantsInvited(db, "event-1", ["ct-1"]);

    const row = sqlite.prepare(`select updated_at from submission where id = 'sub-1'`).get() as { updated_at: number };
    expect(row.updated_at).toBeGreaterThan(T0);
  });

  it("is a no-op for an empty recipient list (a send where nobody succeeded)", async () => {
    const { db, sqlite } = makeTestDb();
    seed(sqlite, [{ id: "p-1", submissionId: "sub-1", contactId: "ct-1", status: "none", eventId: "event-1" }]);

    await markParticipantsInvited(db, "event-1", []);

    expect(statusOf(sqlite, "p-1")).toBe("none");
    const row = sqlite.prepare(`select updated_at from submission where id = 'sub-1'`).get() as { updated_at: number };
    expect(row.updated_at).toBe(T0);
  });
});
