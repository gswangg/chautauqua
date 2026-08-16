// Regression for DEC-554 (part 2): the segment/rules whole-directory contact
// scan (listContactsForOrg's segmentId||rules branch, crud.ts) must be
// bounded and narrow — a narrow projection derived from what the pure
// consumers actually read, a refuse-not-truncate cap, and only-the-page
// re-hydration. Statement/shape counting is the point of this file, plus a
// naive in-memory reference (matchesSegment + compareContacts over full
// rows) that predates the DEC-554 rewrite, so a behavior regression is
// caught even if the narrow-projection plumbing looks right.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { listContactsForOrg } from "../src/server/repo/contacts/crud";
import { toContactRecord, toRow } from "../src/server/repo/contacts/rows";
import { compareContacts } from "../src/server/repo/contacts/query";
import { matchesSegment, SEGMENT_STANDARD_FIELDS, type SegmentRule } from "../src/domain/contacts";
import { MAX_CONTACT_DIRECTORY_SCAN } from "../src/server/repo/contacts/rows";
import type { ParsedContactListQuery } from "../src/server/repo/contacts/query";

// ---- fixture helpers ----------------------------------------------------

function makeRawRow(i: number, overrides: Partial<typeof schema.contact.$inferSelect> = {}): typeof schema.contact.$inferSelect {
  const now = new Date(1_700_000_000_000 + i * 1000);
  return {
    id: `c${String(i).padStart(5, "0")}`,
    orgId: "org1",
    firstName: `First${i}`,
    lastName: `Last${i % 7}`, // repeats to exercise stable sort ties
    email: `person${i}@example.com`,
    phone: i % 2 === 0 ? `555-000${i}` : null,
    company: i % 3 === 0 ? "Acme" : i % 3 === 1 ? "Globex" : null,
    title: i % 2 === 0 ? "Engineer" : null,
    bio: i % 5 === 0 ? "Bio text here" : null,
    headshotUrl: i % 4 === 0 ? "https://example.com/h.png" : null,
    socialLinksJson: null,
    notes: i % 6 === 0 ? "Some notes" : null,
    customFieldsJson: i % 2 === 0 ? JSON.stringify({ track: "eng" }) : null,
    createdAt: now,
    updatedAt: now,
  } as unknown as typeof schema.contact.$inferSelect;
}

function extractInArrayIds(expr: unknown): string[] {
  const chunks = (expr as { queryChunks?: unknown[] }).queryChunks ?? [];
  for (const chunk of chunks) {
    if (Array.isArray(chunk)) {
      return chunk.map((c) => (c as { value: string }).value);
    }
  }
  throw new Error("extractInArrayIds: no array chunk found in expr");
}

interface FakeDbCall {
  kind: "count" | "scan" | "default-rows" | "rehydrate";
  projectionKeys?: string[];
  limitN?: number;
  orderByCalled: boolean;
}

function makeFakeDb(rawRows: (typeof schema.contact.$inferSelect)[]) {
  const calls: FakeDbCall[] = [];
  const rehydrateIdLists: string[][] = [];

  const db = {
    select(proj?: Record<string, unknown>) {
      const isCount = !!proj && Object.keys(proj).length === 1 && "count" in proj;
      const projectionKeys = proj ? Object.keys(proj) : undefined;
      return {
        from(table: unknown) {
          if (table !== schema.contact) throw new Error("fake db: unexpected table");
          let orderByCalled = false;
          let limitN: number | undefined;
          let lastWhereExpr: unknown;
          const chain: Record<string, unknown> = {
            where(expr: unknown) {
              lastWhereExpr = expr;
              return chain;
            },
            orderBy(..._args: unknown[]) {
              orderByCalled = true;
              return chain;
            },
            offset(_n: number) {
              return resolveNow();
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
            if (isCount) {
              calls.push({ kind: "count", orderByCalled });
              return Promise.resolve([{ count: rawRows.length }]);
            }
            if (projectionKeys) {
              calls.push({ kind: "scan", projectionKeys, limitN, orderByCalled });
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
            if (orderByCalled) {
              calls.push({ kind: "default-rows", limitN, orderByCalled });
              const limited = limitN !== undefined ? rawRows.slice(0, limitN) : rawRows;
              return Promise.resolve(limited);
            }
            calls.push({ kind: "rehydrate", orderByCalled });
            const ids = extractInArrayIds(lastWhereExpr);
            rehydrateIdLists.push(ids);
            return Promise.resolve(rawRows.filter((r) => ids.includes(r.id)));
          }
          return chain;
        },
      };
    },
  };

  return { db: db as unknown as Db, calls, rehydrateIdLists };
}

// A naive in-memory reference implementation, built directly from
// matchesSegment + compareContacts over FULL rows (the pre-DEC-554 shape),
// not from the new narrow-scan code under test.
function naiveReference(rawRows: (typeof schema.contact.$inferSelect)[], rules: SegmentRule[], sort: "name" | "recent", page: number, perPage: number) {
  const rows = rawRows.map(toRow);
  const filtered = rows.filter((r) => matchesSegment(rules, toContactRecord(r)));
  const sorted = [...filtered].sort(compareContacts(sort));
  const total = sorted.length;
  const start = (page - 1) * perPage;
  const items = sorted.slice(start, start + perPage);
  return { items, total };
}

function baseParams(overrides: Partial<ParsedContactListQuery> = {}): ParsedContactListQuery {
  return {
    page: 1,
    perPage: 10,
    q: null,
    segmentId: null,
    sort: "name",
    rules: [],
    ...overrides,
  };
}

describe("listContactsForOrg segment/rules scan bounds (DEC-554)", () => {
  it("(i) the scan projection contains every SEGMENT_STANDARD_FIELDS member + id + customFieldsJson + compareContacts' sort keys, and none of bio/notes/headshotUrl/socialLinksJson/phone", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRawRow(i));
    const { db, calls } = makeFakeDb(rows);
    const rules: SegmentRule[] = [{ field: "company", op: "contains", value: "a" }];
    await listContactsForOrg(db, "org1", baseParams({ rules }));

    const scanCall = calls.find((c) => c.kind === "scan");
    expect(scanCall).toBeDefined();
    const keys = new Set(scanCall!.projectionKeys);

    for (const f of SEGMENT_STANDARD_FIELDS) {
      expect(keys.has(f)).toBe(true);
    }
    expect(keys.has("id")).toBe(true);
    expect(keys.has("customFieldsJson")).toBe(true);
    // compareContacts' sort keys (updatedAt/lastName/firstName) — lastName
    // and firstName are already in SEGMENT_STANDARD_FIELDS; updatedAt is not.
    expect(keys.has("updatedAt")).toBe(true);

    for (const forbidden of ["bio", "notes", "headshotUrl", "socialLinksJson", "phone"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("(ii) the scan requests MAX_CONTACT_DIRECTORY_SCAN + 1 rows with an orderBy", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => makeRawRow(i));
    const { db, calls } = makeFakeDb(rows);
    await listContactsForOrg(db, "org1", baseParams({ rules: [{ field: "company", op: "contains", value: "a" }] }));
    const scanCall = calls.find((c) => c.kind === "scan");
    expect(scanCall!.limitN).toBe(MAX_CONTACT_DIRECTORY_SCAN + 1);
    expect(scanCall!.orderByCalled).toBe(true);
  });

  it("(iii) exactly-cap rows passes; cap+1 throws ApiError('invalid') naming the cap and the remedy", async () => {
    const capRows = Array.from({ length: MAX_CONTACT_DIRECTORY_SCAN }, (_, i) => makeRawRow(i));
    const { db: dbAtCap } = makeFakeDb(capRows);
    await expect(
      listContactsForOrg(dbAtCap, "org1", baseParams({ rules: [{ field: "company", op: "contains", value: "a" }] })),
    ).resolves.toBeDefined();

    const overCapRows = Array.from({ length: MAX_CONTACT_DIRECTORY_SCAN + 1 }, (_, i) => makeRawRow(i));
    const { db: dbOverCap } = makeFakeDb(overCapRows);
    await expect(
      listContactsForOrg(dbOverCap, "org1", baseParams({ rules: [{ field: "company", op: "contains", value: "a" }] })),
    ).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_CONTACT_DIRECTORY_SCAN)),
    });
    await expect(
      listContactsForOrg(dbOverCap, "org1", baseParams({ rules: [{ field: "company", op: "contains", value: "a" }] })),
    ).rejects.toMatchObject({
      message: expect.stringContaining("narrow with the search box first"),
    });
  });

  it("(iv) exactly one re-hydration select is issued and its id list length is <= perPage", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => makeRawRow(i));
    const perPage = 5;
    const { db, calls, rehydrateIdLists } = makeFakeDb(rows);
    await listContactsForOrg(
      db,
      "org1",
      baseParams({ perPage, rules: [{ field: "company", op: "contains", value: "a" }] }),
    );
    const rehydrateCalls = calls.filter((c) => c.kind === "rehydrate");
    expect(rehydrateCalls.length).toBe(1);
    expect(rehydrateIdLists.length).toBe(1);
    expect(rehydrateIdLists[0]!.length).toBeLessThanOrEqual(perPage);
  });

  it("(v) items/total match a naive full-row matchesSegment + compareContacts reference over the same fixture", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => makeRawRow(i));
    const rules: SegmentRule[] = [{ field: "any", op: "contains", value: "engineer" }];
    const perPage = 7;
    const page = 2;
    const { db } = makeFakeDb(rows);

    const actual = await listContactsForOrg(db, "org1", baseParams({ page, perPage, rules, sort: "recent" }));
    const expected = naiveReference(rows, rules, "recent", page, perPage);

    expect(actual.total).toBe(expected.total);
    expect(actual.items.map((r) => r.id)).toEqual(expected.items.map((r) => r.id));
    expect(actual.items).toEqual(expected.items);
  });

  it("(vi) the default no-segment-no-rules branch still issues its two SQL statements (count + rows) and no scan", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRawRow(i));
    const { db, calls } = makeFakeDb(rows);
    await listContactsForOrg(db, "org1", baseParams());

    expect(calls.filter((c) => c.kind === "count").length).toBe(1);
    expect(calls.filter((c) => c.kind === "default-rows").length).toBe(1);
    expect(calls.filter((c) => c.kind === "scan").length).toBe(0);
    expect(calls.filter((c) => c.kind === "rehydrate").length).toBe(0);
  });
});
