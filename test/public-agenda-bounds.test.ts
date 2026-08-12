// DEC-548: bound the public agenda like every other public surface — the
// scheduleSlot scan carries a LIMIT (MAX_PUBLIC_ROWS), a ?day= filter lives
// in the SQL WHERE (not a JS .filter() after the fact), and `total` is the
// true unwindowed count of the filtered join rather than items.length so a
// caller can tell when the agenda has been truncated. Fake db chain mirrors
// the established pattern (see test/agenda-room-ownership.test.ts,
// test/public-agenda-event-range.test.ts) — no local sqlite/D1 test driver
// is wired up.

import { describe, expect, it } from "vitest";
import { getPublicAgenda } from "../src/server/repo/public/agenda";
import { MAX_PUBLIC_ROWS } from "../src/server/repo/public/bounds";
import type { PublicEvent } from "../src/server/repo/public/event";
import type { Db } from "../src/server/context";

// Minimal chainable fake matching the established pattern (see
// test/agenda-room-ownership.test.ts) — every relational method just
// returns the same chain object, and awaiting the chain (via `then`)
// resolves to `rows`. `.limit()`/`.as()` are also supported as chain steps
// so the DEC-548 count(*) subquery build (which ends in `.as()`) and the
// windowed real scan (which ends in `.limit()`) both work through it.
function makeChain(rows: unknown[], onWhere?: (cond: unknown) => void, onLimit?: (n: number) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (cond: unknown) => {
      onWhere?.(cond);
      return chain;
    },
    orderBy: () => chain,
    as: () => chain,
    limit: async (n: number) => {
      onLimit?.(n);
      return rows.slice(0, n);
    },
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

// Walks a drizzle SQL condition tree, collecting referenced column names and
// bound values (see test/public.test.ts's walkCondition for the original
// this mirrors) — lets us assert *which* columns/values a query's WHERE
// clause was built from without a real SQLite driver in this repo.
function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 12 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) out.push(...walkCondition(c, seen, depth + 1));
  }
  return out;
}

const EVENT: PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-12",
  location: null,
  timezone: "UTC",
  recordPrefix: "EV",
  brandingJson: null,
};

describe("getPublicAgenda ?day= narrows the SQL WHERE (DEC-548)", () => {
  it("passing day binds an eq(schedule_slot.day, day) alongside the event-range gate", async () => {
    let capturedWhere: unknown;
    const db = {
      // count(*) subquery — 0 rows, so getPublicAgenda returns early right
      // after building `sq` (which already exercised selectDistinct's
      // .where(), capturing the condition below).
      select: () => makeChain([{ count: 0 }]),
      selectDistinct: () => makeChain([], (cond) => (capturedWhere = cond)),
    } as unknown as Db;

    const { items, total } = await getPublicAgenda(db, EVENT, { day: "2026-08-11" });
    expect(items).toEqual([]);
    expect(total).toBe(0);

    // A day distinct from the event's own [startDate, endDate] boundary
    // values, so its presence in the WHERE can only have come from the
    // added eq(day, params.day) clause, not slotWithinEventRange's gte/lte.
    const tokens = walkCondition(capturedWhere);
    expect(tokens).toContain("col:day");
    expect(tokens).toContain('val:"2026-08-11"');
  });

  it("omitting day never binds that value (no eq clause added)", async () => {
    let capturedWhere: unknown;
    const db = {
      select: () => makeChain([{ count: 0 }]),
      selectDistinct: () => makeChain([], (cond) => (capturedWhere = cond)),
    } as unknown as Db;

    const { total } = await getPublicAgenda(db, EVENT);
    expect(total).toBe(0);

    const tokens = walkCondition(capturedWhere);
    expect(tokens).not.toContain('val:"2026-08-11"');
  });
});

describe("getPublicAgenda scan carries a LIMIT equal to MAX_PUBLIC_ROWS (DEC-548)", () => {
  it("the windowed scan calls .limit(MAX_PUBLIC_ROWS)", async () => {
    let capturedLimit: number | undefined;
    const db = {
      select: () => makeChain([{ count: 1 }]),
      selectDistinct: () => makeChain([], undefined, (n) => (capturedLimit = n)),
    } as unknown as Db;

    await getPublicAgenda(db, EVENT);
    expect(capturedLimit).toBe(MAX_PUBLIC_ROWS);
  });
});

describe("getPublicAgenda truncation (DEC-548): items.length caps at MAX_PUBLIC_ROWS while total stays honest", () => {
  it("a result set larger than the ceiling reports the true total, with items.length === MAX_PUBLIC_ROWS", async () => {
    const TOTAL_AVAILABLE = MAX_PUBLIC_ROWS + 300;
    // Every id in [0, TOTAL_AVAILABLE) has a matching submission row, but the
    // scan itself is bounded to the first MAX_PUBLIC_ROWS by the fake's own
    // .limit(n) (mirroring a real SQL LIMIT — see makeChain above).
    const AGENDA_ROWS = Array.from({ length: TOTAL_AVAILABLE }, (_, i) => ({
      submissionId: `sub${i}`,
      day: "2026-08-10",
      startMin: 540,
      endMin: 600,
      roomId: "room1",
    }));
    const SUB_ROWS = Array.from({ length: TOTAL_AVAILABLE }, (_, i) => ({
      id: `sub${i}`,
      seq: i + 1,
      title: `Talk ${i}`,
      description: null,
      icsSequence: 0,
    }));

    let selectCall = 0;
    const db = {
      select: () => {
        selectCall += 1;
        // 1: DEC-548 total count(*) subquery — the true unwindowed count.
        if (selectCall === 1) return makeChain([{ count: TOTAL_AVAILABLE }]);
        // 2: room lookup — every row in this fixture shares one roomId.
        if (selectCall === 2) return makeChain([{ id: "room1", name: "Main Hall" }]);
        // hydrateSessions' sub/track/speaker/EMB-01-slot batches: returning
        // the same sub-row-shaped data on every call is harmless for the
        // non-subRows consumers (they only read fields that happen to be
        // undefined on this shape, producing empty track/speaker/slot maps)
        // and guarantees every one of the TOTAL_AVAILABLE ids resolves to a
        // session, regardless of hydrateSessions' internal chunkIds batching.
        return makeChain(SUB_ROWS);
      },
      selectDistinct: () => makeChain(AGENDA_ROWS),
    } as unknown as Db;

    const { items, total } = await getPublicAgenda(db, EVENT);
    expect(total).toBe(TOTAL_AVAILABLE);
    expect(items).toHaveLength(MAX_PUBLIC_ROWS);
  });
});
