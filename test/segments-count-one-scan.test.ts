// Regression for DEC-864: GET /segments must compute every segment's rail
// count with ONE bounded org-directory scan, not one whole-directory scan
// per segment (the pre-fix segmentCount(...) called listContactsForOrg once
// per row, re-scanning the org's contact table N times on a single GET).
//
// This exercises countContactsForSegmentRules directly (the function the
// route now calls once per GET /segments) against a fake db that records
// every select() issued, and cross-checks the returned counts against a
// naive matchesSegment reference over the same rows — the numbers must not
// change, only the number of scans.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { countContactsForSegmentRules } from "../src/server/repo/contacts/crud";
import { matchesSegment, type ContactRecord, type SegmentRule } from "../src/domain/contacts";

function makeRawRow(i: number, overrides: Partial<typeof schema.contact.$inferSelect> = {}): typeof schema.contact.$inferSelect {
  const now = new Date(1_700_000_000_000 + i * 1000);
  return {
    id: `c${String(i).padStart(5, "0")}`,
    orgId: "org1",
    firstName: `First${i}`,
    lastName: `Last${i % 7}`,
    email: `person${i}@example.com`,
    phone: null,
    company: i % 3 === 0 ? "Acme" : i % 3 === 1 ? "Globex" : null,
    title: i % 2 === 0 ? "Engineer" : null,
    bio: null,
    headshotUrl: null,
    socialLinksJson: null,
    notes: null,
    customFieldsJson: i % 2 === 0 ? JSON.stringify({ track: "eng" }) : null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as typeof schema.contact.$inferSelect;
}

interface FakeDbCall {
  kind: "scan";
  projectionKeys: string[];
  limitN?: number;
}

function makeFakeDb(rawRows: (typeof schema.contact.$inferSelect)[]) {
  const calls: FakeDbCall[] = [];

  const db = {
    select(proj?: Record<string, unknown>) {
      const projectionKeys = proj ? Object.keys(proj) : [];
      return {
        from(table: unknown) {
          if (table !== schema.contact) throw new Error("fake db: unexpected table");
          let limitN: number | undefined;
          const chain: Record<string, unknown> = {
            where(_expr: unknown) {
              return chain;
            },
            orderBy(..._args: unknown[]) {
              return chain;
            },
            limit(n: number) {
              limitN = n;
              return chain;
            },
            then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
              return resolveNow().then(resolve, reject);
            },
          };
          function resolveNow(): Promise<unknown[]> {
            calls.push({ kind: "scan", projectionKeys, limitN });
            const limited = limitN !== undefined ? rawRows.slice(0, limitN) : rawRows;
            return Promise.resolve(
              limited.map((r) => ({
                id: r.id,
                email: r.email,
                firstName: r.firstName,
                lastName: r.lastName,
                company: r.company,
                title: r.title,
                customFieldsJson: r.customFieldsJson,
                updatedAt: r.updatedAt,
              })),
            );
          }
          return chain;
        },
      };
    },
  };

  return { db: db as unknown as Db, calls };
}

function naiveCounts(rawRows: (typeof schema.contact.$inferSelect)[], ruleSets: SegmentRule[][]): number[] {
  const records: ContactRecord[] = rawRows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    ...(r.company ? { company: r.company } : {}),
    ...(r.title ? { title: r.title } : {}),
    ...(r.customFieldsJson ? { customFields: JSON.parse(r.customFieldsJson) as Record<string, string> } : {}),
  }));
  return ruleSets.map((rules) => records.filter((r) => matchesSegment(rules, r)).length);
}

describe("countContactsForSegmentRules (DEC-864)", () => {
  it("scans the org directory exactly once for a 3-segment org", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => makeRawRow(i));
    const { db, calls } = makeFakeDb(rows);
    const ruleSets: SegmentRule[][] = [
      [{ field: "company", op: "eq", value: "Acme" }],
      [{ field: "title", op: "eq", value: "Engineer" }],
      [{ field: "company", op: "contains", value: "o" }],
    ];

    const counts = await countContactsForSegmentRules(db, "org1", ruleSets);

    const scanCalls = calls.filter((c) => c.kind === "scan");
    expect(scanCalls.length).toBe(1);
    expect(counts).toEqual(naiveCounts(rows, ruleSets));
  });

  it("still scans exactly once for a single-segment org", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRawRow(i));
    const { db, calls } = makeFakeDb(rows);
    const ruleSets: SegmentRule[][] = [[{ field: "any", op: "contains", value: "eng" }]];

    const counts = await countContactsForSegmentRules(db, "org1", ruleSets);

    expect(calls.filter((c) => c.kind === "scan").length).toBe(1);
    expect(counts).toEqual(naiveCounts(rows, ruleSets));
  });

  it("an empty rule set counts every scanned row, matching matchesSegment's empty-rules behavior", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => makeRawRow(i));
    const { db } = makeFakeDb(rows);

    const counts = await countContactsForSegmentRules(db, "org1", [[]]);

    expect(counts).toEqual([rows.length]);
    expect(matchesSegment([], { id: "x", email: "a@b.com", firstName: "A", lastName: "B" })).toBe(true);
  });

  it("returns counts in the same order as the input ruleSets", async () => {
    const rows = Array.from({ length: 15 }, (_, i) => makeRawRow(i));
    const { db } = makeFakeDb(rows);
    const ruleSets: SegmentRule[][] = [
      [{ field: "company", op: "eq", value: "Globex" }],
      [{ field: "company", op: "eq", value: "Acme" }],
      [{ field: "title", op: "eq", value: "nonexistent-value" }],
    ];

    const counts = await countContactsForSegmentRules(db, "org1", ruleSets);
    expect(counts).toEqual(naiveCounts(rows, ruleSets));
    // Sanity: at least one rule set (the last) is expected to count zero
    // while the others are non-zero, so a swap/order bug would be caught.
    expect(counts[2]).toBe(0);
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(0);
  });
});
