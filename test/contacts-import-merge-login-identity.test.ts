// DEC-456 (worker w22-g; the brief's cited "DEC-994" collides with an
// unrelated existing ruling -- see src/server/repo/contacts/import.ts's
// decisions import): the CSV merge-FILL path owes both halves of DEC-456,
// the same login-identity contract patchContact enforces on every other
// contact email write:
//
//  (i) a conflict check -- refuse (before any write) when the address a
//      fill would write is already owned by a `user` row linked to a
//      DIFFERENT contact;
//  (ii) a cascade -- once a fill lands, push the new address onto the
//       merge target's own linked `user` row so login identity never
//       drifts from the CRM record.
//
// test/contacts-import-merge.test.ts (a hand-rolled schema.contact-only
// fake) and test/contacts-import-merge-keeps-email.test.ts (a real
// node:sqlite engine whose DDL has no `user` table) both predate this fix
// and don't model schema.user at all -- that is WHY this exact gap was
// invisible (see the DEC-994 task brief). This file seeds a real `user`
// table via node:sqlite + drizzle's sqlite-proxy driver, the same technique
// contacts-import-merge-keeps-email.test.ts already uses, so the real
// `select ... from user where lower(email) in (...)` pre-pass and the
// `update user set email = ...` cascade both execute for real.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { applyImportRows } from "../src/server/repo/contacts/import";
import { ApiError } from "../src/server/http";
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
create table user (
  id text primary key,
  org_id text not null,
  email text not null,
  name text,
  password_hash text not null,
  role text not null,
  contact_id text,
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

function seedUser(sqlite: DatabaseSync, row: { id: string; email: string; contactId: string | null }): void {
  sqlite
    .prepare(
      `insert into user (id, org_id, email, name, password_hash, role, contact_id, created_at, updated_at)
       values (?, ?, ?, null, 'hash', 'speaker', ?, ?, ?)`,
    )
    .run(row.id, ORG, row.email, row.contactId, T0, T0);
}

function readEmail(sqlite: DatabaseSync, id: string): string {
  const row = sqlite.prepare(`select email from contact where id = ?`).get(id) as { email: string } | undefined;
  if (!row) throw new Error(`contact ${id} vanished`);
  return row.email;
}

function readUserEmail(sqlite: DatabaseSync, userId: string): string {
  const row = sqlite.prepare(`select email from user where id = ?`).get(userId) as { email: string } | undefined;
  if (!row) throw new Error(`user ${userId} vanished`);
  return row.email;
}

function row(line: number, parsed: Record<string, unknown>) {
  return { line, parsed };
}

describe("DEC-456: a CSV merge-FILL owes the same login-identity contract patchContact enforces", () => {
  it("(a) refuses a fill onto an address a DIFFERENT contact's user account already owns -- nothing is written", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_blank", firstName: "Ruth", lastName: "Adeyemi", email: "", company: "Meridian Tools" });
    seedContact(sqlite, { id: "ct_other", firstName: "Someone", lastName: "Else", email: "someone@other.example.com", company: null });
    seedUser(sqlite, { id: "usr_other", email: "ruth@meridian.example.com", contactId: "ct_other" });

    let caught: unknown;
    try {
      await applyImportRows(
        db,
        ORG,
        [row(2, { email: "ruth@meridian.example.com", firstName: "Ruth", lastName: "Adeyemi", company: "Meridian Tools" })],
        { mergeLines: [{ line: 2, contactId: "ct_blank" }] },
      );
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as InstanceType<typeof ApiError>;
    expect(err.code).toBe("invalid");
    expect(err.fields).toEqual({ mergeLines: "line 2: email belongs to another account" });

    // Nothing was written: the target's email is still blank, and the
    // other account's own row is untouched.
    expect(readEmail(sqlite, "ct_blank")).toBe("");
    expect(readUserEmail(sqlite, "usr_other")).toBe("ruth@meridian.example.com");
  });

  it("(b) fills onto a contact with its OWN linked user row -- the write lands and the user row's email cascades", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_blank", firstName: "Ruth", lastName: "Adeyemi", email: "", company: "Meridian Tools" });
    seedUser(sqlite, { id: "usr_ruth", email: "ruth-old@meridian.example.com", contactId: "ct_blank" });

    const result = await applyImportRows(
      db,
      ORG,
      [row(2, { email: "Ruth.New@Meridian.example.com", firstName: "Ruth", lastName: "Adeyemi", company: "Meridian Tools" })],
      { mergeLines: [{ line: 2, contactId: "ct_blank" }] },
    );

    expect(result.updated).toBe(1);
    expect(readEmail(sqlite, "ct_blank")).toBe("ruth.new@meridian.example.com");
    // The linked user row cascades to the newly filled (lowercased) address.
    expect(readUserEmail(sqlite, "usr_ruth")).toBe("ruth.new@meridian.example.com");
  });

  it("(c) fills where no user row owns the address at all -- unchanged current behaviour, no cascade to fire", async () => {
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
});
