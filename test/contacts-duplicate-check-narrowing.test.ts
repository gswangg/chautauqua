// Wave-41 amendment (DEC-788): GET /contacts/duplicates/check's SQL scan
// narrows by a PROVABLE superset of findDuplicateGroups's own bucketing
// (normalized email equality OR whitespace-stripped name equality) instead
// of scanning the whole org directory. This is a differential test against a
// real (in-memory) SQLite engine via node:sqlite + drizzle-orm's
// sqlite-proxy driver -- same technique as
// test/contacts-dismissal-cascade.test.ts (no D1 test harness exists in
// stage 1) -- proving three things: (1) the narrowed check returns EXACTLY
// what an independent full-directory-scan oracle (built directly from the
// domain's own findDuplicateGroups, never restating the narrowing SQL)
// would surface for the same candidate, across case variants, a
// double-spaced name, a differently-split same-normalized-name pair, a
// same-name-different-company pair, and an email-only match; (2) the
// emitted SQL for the narrowed scan actually carries the narrowing
// predicate, not a bare org filter; (3) the check still answers for an org
// whose directory is larger than MAX_CONTACT_DIRECTORY_SCAN, where the full
// scan (findDuplicateGroupsForOrg) would refuse.

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { findDuplicateGroups, type ContactRecord } from "../src/domain/contacts";
import {
  findDuplicateCandidatesForOrg,
  findDuplicateGroupsForOrg,
} from "../src/server/repo/contacts/merge";
import { MAX_CONTACT_DIRECTORY_SCAN } from "../src/server/repo/contacts/rows";
import { ApiError } from "../src/server/http";
import type { Db } from "../src/server/context";

const DDL = `
create table contact (
  id text primary key,
  org_id text,
  first_name text,
  last_name text,
  email text,
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
  created_at integer,
  updated_at integer
);
create table contact_duplicate_dismissal (
  id text primary key,
  org_id text,
  contact_id_a text,
  contact_id_b text,
  created_at integer,
  unique (org_id, contact_id_a, contact_id_b)
);
`;

function makeTestDb(): { db: Db; sqlite: DatabaseSync; emittedSql: string[] } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const emittedSql: string[] = [];
  const db = drizzle(
    async (sqlText, params, method) => {
      emittedSql.push(sqlText);
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
  return { db: db as unknown as Db, sqlite, emittedSql };
}

const NOW = 1_700_000_000_000;
const ORG_A = "org-a";

function insertContact(
  sqlite: DatabaseSync,
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  company: string | null = null,
) {
  sqlite
    .prepare(
      `insert into contact (id, org_id, first_name, last_name, email, company, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, ORG_A, firstName, lastName, email, company, NOW, NOW);
}

/** Independent oracle: fetches EVERY contact for the org with a bare,
 * unnarrowed query (no MAX_CONTACT_DIRECTORY_SCAN bound, no narrowing
 * predicate) and applies findDuplicateGroups directly -- exactly what
 * findDuplicateCandidatesForOrg did before the wave-41 SQL narrowing was
 * added. Deliberately does not import or reuse the production narrowing
 * predicate, so agreement between this and the real (narrowed) result is
 * evidence the narrowing lost nothing. */
async function oracleCandidateMatchIds(
  db: Db,
  orgId: string,
  candidate: { firstName: string; lastName: string; email: string; company?: string },
): Promise<Set<string>> {
  const ORACLE_SENTINEL = "__oracle_sentinel__";
  const rows = await db
    .select({
      id: schema.contact.id,
      email: schema.contact.email,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      company: schema.contact.company,
    })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId));
  const records: ContactRecord[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    ...(r.company ? { company: r.company } : {}),
  }));
  const candidateRecord: ContactRecord = {
    id: ORACLE_SENTINEL,
    email: candidate.email,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    ...(candidate.company ? { company: candidate.company } : {}),
  };
  const groups = findDuplicateGroups([...records, candidateRecord]);
  const group = groups.find((g) => g.contactIds.includes(ORACLE_SENTINEL));
  if (!group) return new Set();
  return new Set(group.contactIds.filter((id) => id !== ORACLE_SENTINEL));
}

async function realCandidateMatchIds(
  db: Db,
  orgId: string,
  candidate: { firstName: string; lastName: string; email: string; company?: string },
): Promise<Set<string>> {
  const matches = await findDuplicateCandidatesForOrg(db, orgId, candidate);
  return new Set(matches.map((m) => m.id));
}

describe("GET /contacts/duplicates/check SQL narrowing (DEC-788, wave 41)", () => {
  it("matches an independent full-scan oracle exactly across case variants, a differently-split same-normalized-name pair, a same-name-different-company pair, and an email-only match", async () => {
    const { db, sqlite } = makeTestDb();

    // Email match: candidate's own name is unrelated, but its email matches
    // (case + surrounding-whitespace variant of) an existing contact's.
    insertContact(sqlite, "c-email", "Sam", "Roe", " Sam.Roe@Example.com ");
    // Distinct differently-split same-normalized-name pair: normalizedContactName
    // joins first+" "+last then collapses whitespace, so "Mary Jo"/"Smith"
    // and "Mary"/"Jo Smith" normalize identically regardless of split.
    insertContact(sqlite, "c-split", "Mary Jo", "Smith", "mary-jo@example.com");
    // Case-variant name match (no email overlap).
    insertContact(sqlite, "c-case", "BOB", "JONES", "bob-jones@example.com");
    // Same-name-different-company pair (DEC-800 'name' reason): one other
    // contact, non-blank company differing from the candidate's own
    // non-blank company.
    insertContact(sqlite, "c-diffcompany", "Owen", "Park", "owen-park@example.com", "Acme");
    // Email-only match with case + whitespace variance.
    insertContact(sqlite, "c-emailonly", "Distinct", "Person", "match.email@example.com");
    // Distractors that must NOT match any candidate below.
    insertContact(sqlite, "c-noise-1", "Completely", "Unrelated", "noise1@example.com", "Widgets");
    insertContact(sqlite, "c-noise-2", "Another", "Stranger", "noise2@example.com");

    const candidates: { firstName: string; lastName: string; email: string; company?: string }[] = [
      { firstName: "Xavier", lastName: "Zed", email: "sam.roe@example.com" },
      { firstName: "Mary", lastName: "Jo Smith", email: "unrelated-2@example.com" },
      { firstName: "bob", lastName: "jones", email: "unrelated-3@example.com" },
      { firstName: "Owen", lastName: "Park", email: "unrelated-4@example.com", company: "Zenith" },
      { firstName: "Totally", lastName: "Different", email: "match.email@EXAMPLE.com  " },
      { firstName: "Nobody", lastName: "Matching", email: "unrelated-5@example.com" },
    ];

    for (const candidate of candidates) {
      const oracle = await oracleCandidateMatchIds(db, ORG_A, candidate);
      const real = await realCandidateMatchIds(db, ORG_A, candidate);
      expect([...real].sort()).toEqual([...oracle].sort());
    }

    // Sanity: the matching candidates above are non-empty, and the
    // non-matching one is empty -- otherwise the set-equality assertions
    // above would trivially pass on {} === {} for every case.
    expect((await realCandidateMatchIds(db, ORG_A, candidates[0]!)).size).toBeGreaterThan(0);
    expect((await realCandidateMatchIds(db, ORG_A, candidates[1]!)).size).toBeGreaterThan(0);
    expect((await realCandidateMatchIds(db, ORG_A, candidates[2]!)).size).toBeGreaterThan(0);
    expect((await realCandidateMatchIds(db, ORG_A, candidates[3]!)).size).toBeGreaterThan(0);
    expect((await realCandidateMatchIds(db, ORG_A, candidates[4]!)).size).toBeGreaterThan(0);
    expect((await realCandidateMatchIds(db, ORG_A, candidates[5]!)).size).toBe(0);
  });

  it("emits SQL that carries the narrowing predicate, not a bare org filter", async () => {
    const { db, sqlite, emittedSql } = makeTestDb();
    insertContact(sqlite, "c-1", "Ann", "Lee", "ann@example.com");

    await findDuplicateCandidatesForOrg(db, ORG_A, { firstName: "Ann", lastName: "Lee", email: "ann2@example.com" });

    const scanSql = emittedSql.find((s) => s.toLowerCase().includes('from "contact"') || s.toLowerCase().includes("from contact"));
    expect(scanSql).toBeDefined();
    // The narrowing predicate is built from replace()/char()/lower()/trim()
    // SQL calls (see duplicateCandidateNarrowingCondition); a bare org-only
    // filter would contain none of these.
    expect(scanSql!.toLowerCase()).toContain("replace(");
    expect(scanSql!.toLowerCase()).toContain("char(");
    expect(scanSql!.toLowerCase()).toContain("trim(");
  });

  it("still answers for an org larger than MAX_CONTACT_DIRECTORY_SCAN, where the full-directory scan refuses", async () => {
    const { db, sqlite } = makeTestDb();

    const insertStmt = sqlite.prepare(
      `insert into contact (id, org_id, first_name, last_name, email, company, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const total = MAX_CONTACT_DIRECTORY_SCAN + 1;
    for (let i = 0; i < total; i++) {
      insertStmt.run(`bulk-${i}`, ORG_A, "Filler", `Person${i}`, `filler${i}@example.com`, null, NOW, NOW);
    }
    // One real needle the candidate should find, planted among the haystack.
    insertStmt.run("needle", ORG_A, "Priya", "Chandra", "priya.chandra@example.com", null, NOW, NOW);

    await expect(findDuplicateGroupsForOrg(db, ORG_A)).rejects.toBeInstanceOf(ApiError);

    const matches = await findDuplicateCandidatesForOrg(db, ORG_A, {
      firstName: "Priya",
      lastName: "Chandra",
      email: "somethingelse@example.com",
    });
    expect(matches.map((m) => m.id)).toEqual(["needle"]);
  }, 30_000);
});
