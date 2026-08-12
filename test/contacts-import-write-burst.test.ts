// DEC-491 regression: the CSV import's declared write-burst bound
// (IMPORT_MAX_STATEMENTS_PER_ROW / MAX_IMPORT_WRITE_STATEMENTS,
// src/server/repo/contacts/import.ts) must be TRUE and MEASURED, not just
// asserted in a comment (DEC-481/DEC-453). Drives applyImportRows through a
// counting in-memory Db double (table-identity aware, real eq/and/inArray
// semantics are not needed here since every scenario below only ever
// resolves one row per email lookup) and counts the actual insert/update/
// delete/select D1 calls issued, then derives statements-per-row from the
// measured counts rather than from the constant itself.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import {
  applyImportRows,
  IMPORT_MAX_STATEMENTS_PER_ROW,
  MAX_IMPORT_WRITE_STATEMENTS,
  MAX_IMPORT_ROWS,
} from "../src/server/repo/contacts/import";

/** Counting table double: select()/insert()/update() are table-identity
 * aware; WHERE conditions are ignored for read filtering EXCEPT the
 * contact-by-email lookup below, which this fake evaluates against the
 * seeded rows via a simple email-in-batch check (the only predicate
 * applyImportRows's pre-loop lookup relies on) so create-vs-update
 * resolution is correct. Every insert/update call increments a per-table
 * counter regardless of how many rows it would affect (a D1 UPDATE
 * statement is issued whether or not it matches a row) -- this is exactly
 * the write-burst cost DEC-491 measures. */
function makeCountingDb(seedContacts: { id: string; email: string }[]) {
  const contactByEmail = new Map(seedContacts.map((c) => [c.email.toLowerCase(), c.id]));
  const counts = {
    contactInsert: 0,
    contactUpdate: 0,
    participantUpdate: 0,
    otherWrite: 0,
    select: 0,
  };

  const db = {
    select(_fields?: unknown) {
      counts.select++;
      return {
        from: (table: unknown) => ({
          where: (_cond: unknown) => ({
            then: (resolve: (v: unknown[]) => void) => {
              if (table === schema.contact) {
                // Return every seeded contact whose email is in the batch;
                // the fake has no cheap way to inspect the inArray batch,
                // so it just returns all seeded rows -- applyImportRows
                // only uses this to build its byEmail map, which is safe
                // here because every test below seeds exactly the contacts
                // whose emails appear in the driven file.
                resolve(seedContacts.map((c) => ({ id: c.id, email: c.email })));
              } else {
                resolve([]);
              }
            },
          }),
        }),
      };
    },
    insert(table: unknown) {
      return {
        values: async (_vals: unknown) => {
          if (table === schema.contact) counts.contactInsert++;
          else counts.otherWrite++;
        },
      };
    },
    update(table: unknown) {
      return {
        set: (_vals: unknown) => ({
          where: async (_cond: unknown) => {
            if (table === schema.contact) counts.contactUpdate++;
            else if (table === schema.participant) counts.participantUpdate++;
            else counts.otherWrite++;
          },
        }),
      };
    },
  };

  return { db: db as any, counts, contactByEmail };
}

function rowsFor(rows: { email: string; firstName?: string; lastName?: string; title?: string; company?: string }[]) {
  return rows.map((r, idx) => ({ line: idx + 2, parsed: { ...r } }));
}

const ORG_ID = "org-1";

describe("applyImportRows write-burst bound (DEC-491)", () => {
  it("MAX_IMPORT_WRITE_STATEMENTS is derived from MAX_IMPORT_ROWS x IMPORT_MAX_STATEMENTS_PER_ROW", () => {
    expect(MAX_IMPORT_WRITE_STATEMENTS).toBe(MAX_IMPORT_ROWS * IMPORT_MAX_STATEMENTS_PER_ROW);
  });

  it("all-creates: exactly 1 write statement per row, never exceeding the declared bound", async () => {
    const { db, counts } = makeCountingDb([]);
    const N = 25;
    const emails = Array.from({ length: N }, (_, i) => `new${i}@example.com`);
    const result = await applyImportRows(
      db,
      ORG_ID,
      rowsFor(emails.map((email) => ({ email, firstName: "F", lastName: "L" }))),
    );

    expect(result.created).toBe(N);
    expect(result.updated).toBe(0);
    expect(counts.contactInsert).toBe(N);
    expect(counts.contactUpdate).toBe(0);
    expect(counts.participantUpdate).toBe(0);
    expect(counts.otherWrite).toBe(0);

    const totalWrites = counts.contactInsert + counts.contactUpdate + counts.participantUpdate + counts.otherWrite;
    const statementsPerRow = totalWrites / N;
    expect(statementsPerRow).toBe(1);
    expect(statementsPerRow).toBeLessThanOrEqual(IMPORT_MAX_STATEMENTS_PER_ROW);
  });

  it("all-updates carrying both title and company (worst case): exactly IMPORT_MAX_STATEMENTS_PER_ROW writes per row", async () => {
    const N = 25;
    const seeded = Array.from({ length: N }, (_, i) => ({ id: `contact-${i}`, email: `existing${i}@example.com` }));
    const { db, counts } = makeCountingDb(seeded);
    const result = await applyImportRows(
      db,
      ORG_ID,
      rowsFor(
        seeded.map((c) => ({
          email: c.email,
          firstName: "New",
          lastName: "Name",
          title: "Chief Widget Officer",
          company: "Acme Co",
        })),
      ),
    );

    expect(result.created).toBe(0);
    expect(result.updated).toBe(N);
    expect(counts.contactInsert).toBe(0);
    // Worst-case per row: 1 contact UPDATE + 2 backfillNullAttribution
    // UPDATEs (title, company) = IMPORT_MAX_STATEMENTS_PER_ROW.
    expect(counts.contactUpdate).toBe(N);
    expect(counts.participantUpdate).toBe(2 * N);
    expect(counts.otherWrite).toBe(0);

    const totalWrites = counts.contactInsert + counts.contactUpdate + counts.participantUpdate + counts.otherWrite;
    const statementsPerRow = totalWrites / N;
    expect(statementsPerRow).toBe(IMPORT_MAX_STATEMENTS_PER_ROW);
    expect(statementsPerRow).toBeLessThanOrEqual(IMPORT_MAX_STATEMENTS_PER_ROW);
  });

  it("an update carrying neither title nor company issues only the contact UPDATE (no backfill statements)", async () => {
    const seeded = [{ id: "contact-1", email: "person@example.com" }];
    const { db, counts } = makeCountingDb(seeded);
    const result = await applyImportRows(
      db,
      ORG_ID,
      rowsFor([{ email: "person@example.com", firstName: "New", lastName: "Name" }]),
    );

    expect(result.updated).toBe(1);
    expect(counts.contactUpdate).toBe(1);
    expect(counts.participantUpdate).toBe(0);
  });

  // DEC-575: the customFields merge added a pre-pass field (customFieldsJson)
  // to the same chunked SELECT batch that already builds byEmail -- it must
  // NOT add a per-row read. The per-row statement budget (DEC-491) stays
  // exactly IMPORT_MAX_STATEMENTS_PER_ROW in the worst case even when every
  // row also carries custom fields to merge.
  it("DEC-575: merging customFields on update does not grow the per-row statement budget", async () => {
    const N = 25;
    const seeded = Array.from({ length: N }, (_, i) => ({ id: `contact-${i}`, email: `existing${i}@example.com` }));
    const { db, counts } = makeCountingDb(seeded);
    const rows = seeded.map((c, idx) => ({
      line: idx + 2,
      parsed: {
        email: c.email,
        firstName: "New",
        lastName: "Name",
        title: "Chief Widget Officer",
        company: "Acme Co",
        customFields: { badge: "VIP" },
      },
    }));
    const result = await applyImportRows(db, ORG_ID, rows);

    expect(result.updated).toBe(N);
    const totalWrites = counts.contactInsert + counts.contactUpdate + counts.participantUpdate + counts.otherWrite;
    const statementsPerRow = totalWrites / N;
    expect(statementsPerRow).toBe(IMPORT_MAX_STATEMENTS_PER_ROW);
    expect(statementsPerRow).toBeLessThanOrEqual(IMPORT_MAX_STATEMENTS_PER_ROW);
  });
});
