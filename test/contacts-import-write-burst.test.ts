// DEC-491 amendment (wave 47) regression: the CSV import's declared
// write-burst bound (MAX_D1_STATEMENTS_PER_REQUEST,
// src/server/repo/contacts/import.ts) must be TRUE and MEASURED, not just
// asserted in a comment. Drives applyImportRows through a statement-
// counting in-memory Db double for a FULL MAX_IMPORT_ROWS import in both
// shapes (all-create and all-update, the latter with title+company set so
// the DEC-299 attribution backfill fires) and counts every insert/update
// statement actually issued.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { applyImportRows, MAX_D1_STATEMENTS_PER_REQUEST, MAX_IMPORT_ROWS } from "../src/server/repo/contacts/import";

/** Counting table double: select()/insert() are table-identity aware.
 * insert().values() accepts either a single row object or an array of rows
 * (real drizzle semantics — DEC-528's chunkRowsForInsert always passes an
 * array, even for a one-row chunk) and counts ONE statement per call
 * regardless of how many rows the array carries — that's the real D1 cost
 * a chunked multi-row INSERT buys: one statement, many rows. insert()
 * also supports .onConflictDoUpdate(), used by the update-flush path,
 * which is likewise one statement per call. */
function makeCountingDb(seedContacts: { id: string; email: string }[]) {
  const contactByEmail = new Map(seedContacts.map((c) => [c.email.toLowerCase(), c.id]));
  const counts = {
    contactInsert: 0,
    contactUpsert: 0,
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
                // The fake has no cheap way to inspect the inArray batch
                // this test drives, so it just returns every seeded
                // contact -- safe here because every scenario below seeds
                // exactly the contacts whose emails appear in the driven
                // file (mirrors the write-burst fake's prior convention).
                resolve(
                  seedContacts.map((c) => ({
                    id: c.id,
                    orgId: ORG_ID,
                    firstName: "Old",
                    lastName: "Name",
                    email: c.email,
                    phone: null,
                    company: null,
                    title: null,
                    bio: null,
                    headshotUrl: null,
                    socialLinksJson: null,
                    notes: null,
                    customFieldsJson: null,
                    createdAt: new Date(1),
                    updatedAt: new Date(1),
                  })),
                );
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
        values: (_vals: unknown) => ({
          then: (resolve: (v: undefined) => void) => {
            if (table === schema.contact) counts.contactInsert++;
            else counts.otherWrite++;
            resolve(undefined);
          },
          onConflictDoUpdate: (_opts: unknown) => {
            if (table === schema.contact) counts.contactUpsert++;
            else counts.otherWrite++;
            return Promise.resolve(undefined);
          },
        }),
      };
    },
    update(table: unknown) {
      return {
        set: (_vals: unknown) => ({
          where: async (_cond: unknown) => {
            if (table === schema.participant) counts.participantUpdate++;
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

describe("applyImportRows write-burst bound (DEC-491 amendment, wave 47)", () => {
  it("a full MAX_IMPORT_ROWS all-create import stays under MAX_D1_STATEMENTS_PER_REQUEST", async () => {
    const { db, counts } = makeCountingDb([]);
    const N = MAX_IMPORT_ROWS;
    const emails = Array.from({ length: N }, (_, i) => `new${i}@example.com`);
    const result = await applyImportRows(
      db,
      ORG_ID,
      rowsFor(emails.map((email) => ({ email, firstName: "F", lastName: "L" }))),
    );

    expect(result.created).toBe(N);
    expect(result.updated).toBe(0);
    expect(counts.contactUpsert).toBe(0);
    expect(counts.participantUpdate).toBe(0);
    expect(counts.otherWrite).toBe(0);

    const totalWrites = counts.contactInsert + counts.contactUpsert + counts.participantUpdate + counts.otherWrite;
    expect(totalWrites).toBeLessThan(MAX_D1_STATEMENTS_PER_REQUEST);
    // Sanity: this is genuinely chunked, not one statement per row.
    expect(counts.contactInsert).toBeLessThan(N);
  });

  it("a full MAX_IMPORT_ROWS all-update import (title+company set, attribution backfill firing) stays under MAX_D1_STATEMENTS_PER_REQUEST", async () => {
    const N = MAX_IMPORT_ROWS;
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
          // Shared title/company across the whole roster -- the common
          // CSV-import shape (a company's whole speaker roster) and the
          // shape backfillNullAttributionMany's per-distinct-value
          // grouping is designed for.
          title: "Chief Widget Officer",
          company: "Acme Co",
        })),
      ),
    );

    expect(result.created).toBe(0);
    expect(result.updated).toBe(N);
    expect(counts.contactInsert).toBe(0);
    expect(counts.contactUpsert).toBeGreaterThan(0);

    const totalWrites = counts.contactInsert + counts.contactUpsert + counts.participantUpdate + counts.otherWrite;
    expect(totalWrites).toBeLessThan(MAX_D1_STATEMENTS_PER_REQUEST);
    // Sanity: genuinely chunked, not one statement per row for either the
    // contact upsert or the attribution backfill.
    expect(counts.contactUpsert).toBeLessThan(N);
    expect(counts.participantUpdate).toBeLessThan(N);
  });

  it("an update carrying neither title nor company issues no attribution statements", async () => {
    const seeded = [{ id: "contact-1", email: "person@example.com" }];
    const { db, counts } = makeCountingDb(seeded);
    const result = await applyImportRows(
      db,
      ORG_ID,
      rowsFor([{ email: "person@example.com", firstName: "New", lastName: "Name" }]),
    );

    expect(result.updated).toBe(1);
    expect(counts.contactUpsert).toBe(1);
    expect(counts.participantUpdate).toBe(0);
  });

  // DEC-575: the customFields merge added a pre-pass field (customFieldsJson)
  // to the same chunked SELECT batch that already builds byEmail -- it must
  // NOT add a per-row read or grow the statement budget.
  it("DEC-575: merging customFields on update does not grow the statement budget", async () => {
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
    expect(counts.select).toBeGreaterThan(0);
    // 25 rows chunked (ID_CHUNK_SIZE=90 for the pre-pass, small per-insert
    // chunk size for the flush) -- well under one statement per row.
    expect(counts.contactUpsert).toBeLessThan(N);
  });
});
