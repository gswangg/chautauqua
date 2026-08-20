// Eval regression (MINOR, speaker-management/CRM): "merging the speakers.csv
// row overwrote Marcus Okafor's stored email with the imported value."
//
// Root cause: DEC-663's wave-64 amendment RULED the overwrite -- "the CSV
// row's email REPLACES the target's stored email (that is the whole point --
// same person, new address)" -- and applyImportRows implemented it literally,
// forcing `email: key` onto the merged commit row. Two things make that
// ruling wrong in practice: describeImportOverwrites structurally excludes
// `email`, so DEC-663's own dry run cannot name the one value the merge
// destroys; and DEC-456/DEC-479's login cascade, which patchContact and
// mergeContacts both run when a contact's address changes, has no counterpart
// on this path -- so the overwrite also silently desynced the speaker's
// sign-in address. DEC-663 (amendment, wave 115) reverses it: a merge FILLS a
// blank stored email and never replaces a non-blank one.
//
// This pins the WRITE half against a real (in-memory) SQLite engine via
// node:sqlite + drizzle's sqlite-proxy driver -- the same technique as
// test/portal-invite-mints-invited.test.ts -- because the ordinary
// import-merge suite drives a hand-rolled fake Db that never executes the
// `insert ... on conflict (id) do update set email = excluded.email` the
// flush actually issues. A bug living in that SET list is invisible to a
// simulated store and visible here.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { applyImportRows } from "../src/server/repo/contacts/import";
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
  title_at_time text,
  org_at_time text,
  name_at_time text,
  created_at integer,
  updated_at integer
);
`;

const T0 = 1_700_000_000_000;
const ORG = "org-a";

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

function seedContact(sqlite: DatabaseSync, row: { id: string; firstName: string; lastName: string; email: string; company: string | null }): void {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, phone, company, title, bio, notes, custom_fields_json, created_at, updated_at)
       values (?, ?, ?, ?, ?, null, ?, null, null, null, null, ?, ?)`,
    )
    .run(row.id, ORG, row.firstName, row.lastName, row.email, row.company, T0, T0);
}

function readEmail(sqlite: DatabaseSync, id: string): string {
  const row = sqlite.prepare(`select email from contact where id = ?`).get(id) as { email: string } | undefined;
  if (!row) throw new Error(`contact ${id} vanished`);
  return row.email;
}

/** One CSV row, already parsed+mapped the way the route's mapImportRow leaves
 * it before applyImportRows sees it. */
function row(line: number, parsed: Record<string, unknown>) {
  return { line, parsed };
}

describe("DEC-663 (amendment, wave 115): an import-merge never replaces a stored, non-blank email", () => {
  it("keeps the target's org-wide email, reports the offered one, and still applies the row's other fields", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, {
      id: "ct_marcus",
      firstName: "Marcus",
      lastName: "Okafor",
      email: "marcus@cloudreach.example.com",
      company: "Cloudreach Labs",
    });

    const result = await applyImportRows(
      db,
      ORG,
      [row(2, { email: "m.okafor@newmail.example.com", firstName: "Marcus", lastName: "Okafor", company: "Cloudreach Labs", title: "Staff Engineer" })],
      { mergeLines: [{ line: 2, contactId: "ct_marcus" }] },
    );

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    // THE regression: read back through the real engine, after the real
    // `on conflict do update set email = excluded.email` statement ran.
    expect(readEmail(sqlite, "ct_marcus")).toBe("marcus@cloudreach.example.com");
    expect(result.emailConflicts).toEqual([
      { line: 2, contactId: "ct_marcus", kept: "marcus@cloudreach.example.com", offered: "m.okafor@newmail.example.com" },
    ]);
    // The merge is not a no-op: everything the plan CAN show as an overwrite
    // still lands.
    const stored = sqlite.prepare(`select title from contact where id = ?`).get("ct_marcus") as { title: string | null };
    expect(stored.title).toBe("Staff Engineer");
    // …and no second contact was minted for the offered address.
    const count = sqlite.prepare(`select count(*) as n from contact`).get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("FILLS a blank stored email — nothing is being replaced, so the file's address lands", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_blank", firstName: "Ruth", lastName: "Adeyemi", email: "", company: "Meridian Tools" });

    const result = await applyImportRows(
      db,
      ORG,
      [row(2, { email: "ruth@meridian.example.com", firstName: "Ruth", lastName: "Adeyemi", company: "Meridian Tools" })],
      { mergeLines: [{ line: 2, contactId: "ct_blank" }] },
    );

    expect(result.updated).toBe(1);
    expect(result.emailConflicts).toEqual([]);
    expect(readEmail(sqlite, "ct_blank")).toBe("ruth@meridian.example.com");
  });

  it("a plain (non-merge) email-matched update still leaves the stored email exactly as it was", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, {
      id: "ct_priya",
      firstName: "Priya",
      lastName: "Raman",
      email: "priya@latticework.example.com",
      company: "Latticework Systems",
    });

    const result = await applyImportRows(
      db,
      ORG,
      [row(2, { email: "PRIYA@Latticework.Example.com", firstName: "Priya", lastName: "Raman", title: "Principal" })],
      {},
    );

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.emailConflicts).toEqual([]);
    expect(readEmail(sqlite, "ct_priya")).toBe("priya@latticework.example.com");
  });
});
