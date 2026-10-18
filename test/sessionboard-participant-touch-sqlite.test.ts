// DEC-725 (wave-17 amendment): the sessionboard `participants` import branch
// was the last participant writer that skipped the touch-on-write contract
// (src/server/repo/submissions/touch.ts's header) -- it inserted new
// participant rows and updated existing ones without ever stamping the
// submissions those rows belong to, so a Sessionboard-driven co-presenter
// add/remove/reorder never re-selected under DEC-725's incremental watermark
// (`gt(schema.submission.updatedAt, mark)`) and stayed permanently stale in
// the pushed Airtable Speakers cell.
//
// This pins the WRITE half against a real (in-memory) SQLite engine via
// node:sqlite + drizzle's sqlite-proxy driver -- same technique as
// test/contacts-import-merge-keeps-email.test.ts and
// test/compose-recipient-dedup-sqlite.test.ts -- because a hand-rolled fake
// Db (as in test/sessionboard-participant-updates.test.ts) never proves the
// real `UPDATE submission SET updated_at = ...` statement lands.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { applySessionboardPlans } from "../src/server/repo/import/sessionboard";
import { externalRef, SESSIONBOARD_SOURCE } from "../src/domain/sessionboard";
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
create table contact (
  id text primary key,
  org_id text not null,
  first_name text,
  last_name text,
  email text,
  title text,
  company text,
  external_ref text,
  created_at integer,
  updated_at integer
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
`;

const T0 = 1_700_000_000_000;
const ORG_ID = "org-a";
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

function seedSubmission(sqlite: DatabaseSync, id: string, extRef: string, updatedAt: number): void {
  sqlite
    .prepare(`insert into submission (id, event_id, seq, title, status, external_ref, created_at, updated_at)
      values (?, ?, 1, 'Title', 'pending', ?, ?, ?)`)
    .run(id, EVENT_ID, extRef, T0, updatedAt);
}

function seedContact(sqlite: DatabaseSync, id: string, extRef: string): void {
  sqlite
    .prepare(`insert into contact (id, org_id, first_name, last_name, email, title, company, external_ref, created_at, updated_at)
      values (?, ?, 'Speaker', 'Name', 'speaker@example.com', null, null, ?, ?, ?)`)
    .run(id, ORG_ID, extRef, T0, T0);
}

function seedParticipant(sqlite: DatabaseSync, id: string, submissionId: string, contactId: string, updatedAt: number): void {
  sqlite
    .prepare(`insert into participant (id, submission_id, contact_id, role, "order", visible, invite_status, created_at, updated_at)
      values (?, ?, ?, 'speaker', 0, 0, 'none', ?, ?)`)
    .run(id, submissionId, contactId, T0, updatedAt);
}

function readSubmissionUpdatedAt(sqlite: DatabaseSync, id: string): number {
  const row = sqlite.prepare(`select updated_at from submission where id = ?`).get(id) as { updated_at: number } | undefined;
  if (!row) throw new Error(`submission ${id} vanished`);
  return row.updated_at;
}

describe("DEC-725 (wave-17 amendment): sessionboard participants import stamps the submissions it touches", () => {
  const SUB_A_EXT = externalRef(SESSIONBOARD_SOURCE, "sb-sess-A");
  const SUB_B_EXT = externalRef(SESSIONBOARD_SOURCE, "sb-sess-B");
  const SUB_C_EXT = externalRef(SESSIONBOARD_SOURCE, "sb-sess-C");
  const CONTACT_EXISTING_EXT = externalRef(SESSIONBOARD_SOURCE, "sb-spk-existing");
  const CONTACT_NEW_EXT = externalRef(SESSIONBOARD_SOURCE, "sb-spk-new");

  function seedAll(sqlite: DatabaseSync) {
    seedSubmission(sqlite, "sub-a", SUB_A_EXT, T0);
    seedSubmission(sqlite, "sub-b", SUB_B_EXT, T0);
    seedSubmission(sqlite, "sub-c", SUB_C_EXT, T0); // untouched sibling
    seedContact(sqlite, "contact-existing", CONTACT_EXISTING_EXT);
    seedContact(sqlite, "contact-new", CONTACT_NEW_EXT);
    // Existing participant on sub-a, to be UPDATEd (role change).
    seedParticipant(sqlite, "participant-existing", "sub-a", "contact-existing", T0);
  }

  function plans(): Array<{ row: number; externalRef: string | null; values: Record<string, string> }> {
    return [
      // Update: contact-existing already participates in sub-a; role differs.
      {
        row: 2,
        externalRef: null,
        values: { sessionExternalId: "sb-sess-A", speakerExternalId: "sb-spk-existing", role: "moderator" },
      },
      // Create: contact-new joins sub-b for the first time.
      {
        row: 3,
        externalRef: null,
        values: { sessionExternalId: "sb-sess-B", speakerExternalId: "sb-spk-new", role: "speaker" },
      },
    ];
  }

  it("advances updated_at on every submission whose participant set changed, and leaves an untouched sibling alone", async () => {
    const { db, sqlite } = makeTestDb();
    seedAll(sqlite);

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "participants",
      dryRun: false,
      plans: plans() as any,
    });

    expect(result.skipped).toEqual([]);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);

    expect(readSubmissionUpdatedAt(sqlite, "sub-a")).toBeGreaterThan(T0);
    expect(readSubmissionUpdatedAt(sqlite, "sub-b")).toBeGreaterThan(T0);
    // The sibling submission, never referenced by any plan row, is untouched.
    expect(readSubmissionUpdatedAt(sqlite, "sub-c")).toBe(T0);

    // The actual row writes landed too (the touch didn't replace them).
    const role = sqlite.prepare(`select role from participant where id = ?`).get("participant-existing") as { role: string };
    expect(role.role).toBe("moderator");
    const created = sqlite.prepare(`select count(*) as n from participant where submission_id = 'sub-b'`).get() as { n: number };
    expect(created.n).toBe(1);
  });

  it("a dry run leaves every submission's updated_at unchanged", async () => {
    const { db, sqlite } = makeTestDb();
    seedAll(sqlite);

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "participants",
      dryRun: true,
      plans: plans() as any,
    });

    expect(result.skipped).toEqual([]);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);

    expect(readSubmissionUpdatedAt(sqlite, "sub-a")).toBe(T0);
    expect(readSubmissionUpdatedAt(sqlite, "sub-b")).toBe(T0);
    expect(readSubmissionUpdatedAt(sqlite, "sub-c")).toBe(T0);

    // No participant row was actually created or changed either.
    const role = sqlite.prepare(`select role from participant where id = ?`).get("participant-existing") as { role: string };
    expect(role.role).toBe("speaker");
    const created = sqlite.prepare(`select count(*) as n from participant where submission_id = 'sub-b'`).get() as { n: number };
    expect(created.n).toBe(0);
  });
});
