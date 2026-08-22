// DEC-663 (wave-25 amendment): patchContact must refuse to move a contact's
// email onto an address already held by ANOTHER contact in the same org --
// the same (orgId, lower(email)) identity rule POST /contacts enforces on
// create (src/routes/api/contacts/crud.ts:186-193). Before this change,
// patchContact only checked schema.user (login accounts); a sibling
// CONTACT row with the target address was never checked, so an organizer
// editing an email in the drawer could silently mint a duplicate identity.
//
// Pins the WRITE half against a real (in-memory) SQLite engine via
// node:sqlite + drizzle's sqlite-proxy driver -- same technique as
// test/contacts-import-merge-keeps-email.test.ts -- so the refusal check
// (a real `select ... where lower(email) = ?`) and the "leaves both rows
// untouched" assertion both run against the actual SQL, not a hand-rolled
// fake store.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import { patchContact } from "../src/server/repo/contacts/crud";
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
  headshot_url text,
  headshot_file_id text,
  social_links_json text,
  notes text,
  custom_fields_json text,
  external_ref text,
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
`;

const T0 = 1_700_000_000_000;
const ORG_A = "org-a";
const ORG_B = "org-b";

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

function seedContact(
  sqlite: DatabaseSync,
  row: { id: string; orgId: string; firstName: string; lastName: string; email: string },
): void {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.orgId, row.firstName, row.lastName, row.email, T0, T0);
}

function readContact(sqlite: DatabaseSync, id: string): { email: string; updatedAt: number } {
  const row = sqlite.prepare(`select email, updated_at as updatedAt from contact where id = ?`).get(id) as
    | { email: string; updatedAt: number }
    | undefined;
  if (!row) throw new Error(`contact ${id} vanished`);
  return row;
}

describe("DEC-663 (wave-25 amendment): patchContact enforces (orgId, lower(email)) contact identity", () => {
  it("patching a contact's email onto a free address succeeds", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_free", orgId: ORG_A, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" });

    const updated = await patchContact(db, "ct_free", { email: "ada.new@example.com" });

    expect(updated.email).toBe("ada.new@example.com");
    expect(readContact(sqlite, "ct_free").email).toBe("ada.new@example.com");
  });

  it("patching onto a sibling contact's address in the SAME org throws conflict and leaves both rows unchanged", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_target", orgId: ORG_A, firstName: "Grace", lastName: "Hopper", email: "grace@example.com" });
    seedContact(sqlite, { id: "ct_sibling", orgId: ORG_A, firstName: "Hedy", lastName: "Lamarr", email: "hedy@example.com" });

    const before = readContact(sqlite, "ct_sibling");

    await expect(patchContact(db, "ct_target", { email: "hedy@example.com" })).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(patchContact(db, "ct_target", { email: "hedy@example.com" })).rejects.toBeInstanceOf(ApiError);

    const targetAfter = readContact(sqlite, "ct_target");
    const siblingAfter = readContact(sqlite, "ct_sibling");
    expect(targetAfter.email).toBe("grace@example.com");
    expect(siblingAfter.email).toBe(before.email);
    expect(siblingAfter.updatedAt).toBe(before.updatedAt);
  });

  it("the same address held by a contact in a DIFFERENT org does not block", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_a", orgId: ORG_A, firstName: "Ada", lastName: "Lovelace", email: "shared@example.com" });
    seedContact(sqlite, { id: "ct_b", orgId: ORG_B, firstName: "Bea", lastName: "Nguyen", email: "bea@example.com" });

    const updated = await patchContact(db, "ct_b", { email: "shared@example.com" });

    expect(updated.email).toBe("shared@example.com");
    expect(readContact(sqlite, "ct_b").email).toBe("shared@example.com");
  });

  it("re-saving the contact's own address is not a conflict", async () => {
    const { db, sqlite } = makeTestDb();
    seedContact(sqlite, { id: "ct_self", orgId: ORG_A, firstName: "Ida", lastName: "Tarbell", email: "Ida@Example.com" });

    const updated = await patchContact(db, "ct_self", { email: "ida@example.com" });

    expect(updated.email).toBe("ida@example.com");
  });
});
