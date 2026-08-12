// DEC-418 part 1: getPublicSessions must bound its id query in SQL (LIMIT
// page*perPage) instead of materializing every visible submission id and
// slicing in JS, and must compute `total` from a separate count(distinct)
// query rather than items.length / ordered.length. Uses the fake-db-chain
// harness established in test/public.test.ts (no local sqlite/D1 test
// driver — see package.json).

import { describe, expect, it } from "vitest";
import { getPublicSessions, type PublicEvent } from "../src/server/repo/public";
import type { AppEnv } from "../src/server/env";

// Mirrors test/public.test.ts's makeChain, but also records the bound
// passed to .limit() and the condition passed to .where() so assertions
// below can inspect both the id query and the count query.
function makeChain(rows: unknown[], record: { where?: unknown; limit?: number } = {}) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (cond: unknown) => {
      record.where = cond;
      return chain;
    },
    orderBy: () => chain,
    limit: (n: number) => {
      record.limit = n;
      return { then: (resolve: (v: unknown[]) => void) => resolve(rows) };
    },
    // count query path never calls .limit()/.orderBy() — awaited straight
    // off .where().
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// Walks a drizzle SQL condition tree collecting referenced column names and
// bound leaf values — same walk as test/public.test.ts's walkCondition,
// used here to check the id query and count query see identical conditions.
function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 12 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) {
      if (c !== null && typeof c !== "object") {
        out.push(`val:${JSON.stringify(c)}`);
      } else {
        out.push(...walkCondition(c, seen, depth + 1));
      }
    }
  }
  return out;
}

const EVENT: PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

// A hydrateSessions-compatible fake for db.select() calls made after the id
// query (subRows/trackRows/speakerRows/slotRows) plus, last, the count
// query's own db.select() call — see src/server/repo/public/sessions.ts's
// getPublicSessions comment: id query -> hydrateSessions -> count query.
function buildDb(idRows: { id: string }[], countValue: number, ids: string[]) {
  const idRecord: { where?: unknown; limit?: number } = {};
  const countRecord: { where?: unknown; limit?: number } = {};
  let selectCall = 0;
  const db = {
    selectDistinct: () => makeChain(idRows, idRecord),
    select: () => {
      selectCall += 1;
      // hydrateSessions' 4 batched selects (subRows/trackRows/speakerRows/
      // slotRows), then the count query last.
      if (selectCall === 1) {
        return makeChain(ids.map((id) => ({ id, seq: 1, title: id, description: null, icsSequence: 0 })));
      }
      if (selectCall === 2) return makeChain([]);
      if (selectCall === 3) return makeChain([]);
      if (selectCall === 4) return makeChain([]);
      return makeChain([{ count: countValue }], countRecord);
    },
  } as unknown as AppEnv["Variables"]["db"];
  return { db, idRecord, countRecord };
}

describe("getPublicSessions (DEC-418): SQL-bound pagination", () => {
  it("applies LIMIT = page*perPage to the unfiltered id query", async () => {
    const { db, idRecord } = buildDb([{ id: "a" }, { id: "b" }], 2, ["a", "b"]);
    await getPublicSessions(db, EVENT, { trackId: null, page: 2, perPage: 12, q: null });
    expect(idRecord.limit).toBe(24);
  });

  it("applies LIMIT = page*perPage to the track-filtered id query", async () => {
    const { db, idRecord } = buildDb([{ id: "a" }], 1, ["a"]);
    await getPublicSessions(db, EVENT, { trackId: "trk1", page: 3, perPage: 8, q: null });
    expect(idRecord.limit).toBe(24);
  });

  it("total comes from the count query, not items.length", async () => {
    const { db } = buildDb([{ id: "a" }], 137, ["a"]);
    const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: null });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(137);
    expect(page.total).not.toBe(page.items.length);
  });

  it("with total > items.length, the caller still sees hasMore semantics (items.length < total)", async () => {
    const { db } = buildDb([{ id: "a" }, { id: "b" }], 50, ["a", "b"]);
    const page = await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: null });
    const hasMore = page.items.length < page.total;
    expect(hasMore).toBe(true);
  });

  it("DEC-433: LIMIT never exceeds MAX_PUBLIC_ROWS even for a large page*perPage", async () => {
    const { db, idRecord } = buildDb([{ id: "a" }], 1, ["a"]);
    await getPublicSessions(db, EVENT, { trackId: null, page: 50, perPage: 100, q: null });
    expect(idRecord.limit).toBe(600);
    expect(Number.isFinite(idRecord.limit)).toBe(true);
  });

  it("DEC-433: a non-finite page throws instead of reaching db.limit()", async () => {
    const { db } = buildDb([{ id: "a" }], 1, ["a"]);
    await expect(
      getPublicSessions(db, EVENT, { trackId: null, page: Infinity, perPage: 12, q: null }),
    ).rejects.toThrow();
  });

  it("applies the identical keyword (q) condition to both the id query and the count query", async () => {
    const { db, idRecord, countRecord } = buildDb([{ id: "a" }], 5, ["a"]);
    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, q: "Ada" });

    const idTokens = walkCondition(idRecord.where);
    const countTokens = walkCondition(countRecord.where);

    for (const expected of ['val:"%Ada%"', "col:title", "col:first_name", "col:last_name", "col:status"]) {
      expect(idTokens).toContain(expected);
      expect(countTokens).toContain(expected);
    }
  });
});
