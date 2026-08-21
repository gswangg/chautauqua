// Cut-3 eval judge item 1 (comms recipient dedup, speaker-management minor):
// "bulk compose builds its recipient list per-submission, so a speaker with N
// submissions appears N times as recipient rows." The domain-level collapse
// (expandRecipients, DEC-936 wave-19) is already pinned in pure-unit form by
// test/compose-recipient-dedup.test.ts, but that test hand-builds its
// ComposeSubmission[] input directly -- it never exercises the REAL query
// (src/server/repo/comms.ts's loadComposeSubmissions) that produces that
// input in production. A bug in the join/ordering there (e.g. a duplicate
// participant row, or a status filter admitting a row twice) would be
// invisible to the pure-domain test and invisible to comms-batched-
// lookups.test.ts's hand-rolled fake db (which never runs real SQL).
//
// This pins the READ half against a real (in-memory) SQLite engine via
// node:sqlite + drizzle's sqlite-proxy driver -- the same technique
// test/contacts-import-merge-keeps-email.test.ts uses for the write half of
// this exact eval regression family -- so the query and the dedupe run
// together, against one contact seeded onto two submissions, the way
// production data actually looks.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { loadComposeSubmissions } from "../src/server/repo/comms";
import { expandRecipients } from "../src/domain/compose";
import type { Db } from "../src/server/context";

const DDL = `
create table contact (
  id text primary key,
  org_id text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  company text,
  title text,
  bio text,
  notes text,
  headshot_url text,
  headshot_file_id text,
  social_links_json text,
  external_ref text,
  custom_fields_json text,
  user_id text,
  created_at integer not null,
  updated_at integer not null
);
create table submission (
  id text primary key,
  event_id text not null,
  form_id text,
  seq integer not null,
  title text not null,
  description text,
  track_id text,
  additional_track_ids_json text,
  status text not null default 'pending',
  content_status text not null default 'pending',
  accepted_at integer,
  ics_sequence integer not null default 0,
  external_ref text,
  created_at integer not null,
  updated_at integer not null
);
create table participant (
  id text primary key,
  submission_id text not null,
  contact_id text not null,
  role text not null default 'speaker',
  "order" integer not null default 0,
  visible integer not null default 1,
  invite_status text not null default 'none',
  title_at_time text,
  org_at_time text,
  name_at_time text,
  created_at integer not null,
  updated_at integer not null
);
`;

const T0 = 1_700_000_000_000;
const ORG = "org-a";
const EVENT = "ev_dedup";

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

function seedContact(sqlite: DatabaseSync, row: { id: string; firstName: string; lastName: string; email: string }): void {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, ORG, row.firstName, row.lastName, row.email, T0, T0);
}

function seedSubmission(sqlite: DatabaseSync, row: { id: string; seq: number; title: string }): void {
  sqlite
    .prepare(
      `insert into submission (id, event_id, seq, title, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, EVENT, row.seq, row.title, T0, T0);
}

function seedParticipant(
  sqlite: DatabaseSync,
  row: { id: string; submissionId: string; contactId: string; order: number; inviteStatus?: string },
): void {
  sqlite
    .prepare(
      `insert into participant (id, submission_id, contact_id, "order", invite_status, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.submissionId, row.contactId, row.order, row.inviteStatus ?? "accepted", T0, T0);
}

describe("comms recipient dedup (Cut-3 eval item, DEC-936 wave-19): real query + real dedupe", () => {
  it("a speaker on 2 submissions comes back from loadComposeSubmissions as 2 participant rows for 1 contact, and expandRecipients collapses them to exactly 1 recipient for a generic (non per-submission) message", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_ada", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });
    seedSubmission(sqlite, { id: "sub_1", seq: 1, title: "On Engines" });
    seedSubmission(sqlite, { id: "sub_2", seq: 2, title: "On Looms" });
    seedParticipant(sqlite, { id: "pt_1", submissionId: "sub_1", contactId: "ct_ada", order: 0 });
    seedParticipant(sqlite, { id: "pt_2", submissionId: "sub_2", contactId: "ct_ada", order: 0 });

    const submissions = await loadComposeSubmissions(db, EVENT, ["sub_1", "sub_2"]);

    // THE query returns the pre-collapse shape: one participant row per
    // submission, both pointing at the same contactId -- exactly the input
    // expandRecipients is built to collapse.
    expect(submissions).toHaveLength(2);
    expect(submissions.flatMap((s) => s.participants.map((p) => p.contactId))).toEqual(["ct_ada", "ct_ada"]);

    const generic = expandRecipients(submissions, { perSubmissionVarsSpent: false });
    expect(generic.ok).toBe(true);
    if (!generic.ok) throw new Error("expected ok");
    // The eval regression, pinned end-to-end: the visible/sent recipient
    // list for a generic message has exactly ONE row for this speaker, not
    // one per submission.
    expect(generic.recipients).toHaveLength(1);
    expect(generic.recipients[0]).toEqual({
      contactId: "ct_ada",
      submissionId: "sub_1",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
    expect(generic.withheld).toEqual([
      { contactId: "ct_ada", submissionId: "sub_2", email: "ada@example.com", name: "Ada Lovelace" },
    ]);

    // A message that spends a per-submission field (e.g. {talk_title})
    // legitimately keeps both rows -- the two submissions differ in the one
    // thing the send actually says, so collapsing would silently drop a
    // talk update. Visible count and actual send agree here too: 2 rows in,
    // 2 rows out, none withheld.
    const perSubmission = expandRecipients(submissions, { perSubmissionVarsSpent: true });
    expect(perSubmission.ok).toBe(true);
    if (!perSubmission.ok) throw new Error("expected ok");
    expect(perSubmission.recipients).toHaveLength(2);
    expect(perSubmission.withheld).toEqual([]);
  });

  it("a declined participant is excluded from the query entirely, so it never reaches the dedupe step", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_bo", firstName: "Bo", lastName: "Peep", email: "bo@example.com" });
    seedSubmission(sqlite, { id: "sub_3", seq: 3, title: "On Sheep" });
    seedParticipant(sqlite, { id: "pt_3", submissionId: "sub_3", contactId: "ct_bo", order: 0, inviteStatus: "declined" });

    const submissions = await loadComposeSubmissions(db, EVENT, ["sub_3"]);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.participants).toEqual([]);
  });
});
