// DEC-528 (wave 52): applySessionboardPlans' non-participants branch
// (contacts/submissions/tracks) batches its create/update writes exactly
// like the participants branch already did (wave 47/49) -- one chunked
// multi-row insert and one chunked grouped update, never one statement per
// CSV row. Same table-identity-aware fake db technique as
// test/sessionboard-import-acceptance.test.ts (real WHERE-clause filtering
// via conditionColumnValues), instrumented to count db.insert(...) calls so
// a regression back to a per-row insert fails loudly here.
//
// Also exercises the DEC-528 wave-58 amendment: loadMaxSubmissionSeq /
// loadMaxTrackPosition now issue a single-row `sql\`max(col)\`` aggregate
// select instead of loading every row and reducing in JS. This fake's
// select() detects that shape (a queryChunks-bearing SQL expression, unlike
// a plain Column) and projects a single aggregate row so the allocator
// tests below assert against the real repo code path.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { applySessionboardPlans } from "../src/server/repo/import/sessionboard";
import { externalRef, SESSIONBOARD_SOURCE } from "../src/domain/sessionboard";
import type { Db } from "../src/server/context";

function fakeDb(seed: { event: unknown[]; contact?: unknown[]; submission?: unknown[]; track?: unknown[] }) {
  const state = {
    event: [...seed.event] as any[],
    contact: [...(seed.contact ?? [])] as any[],
    submission: [...(seed.submission ?? [])] as any[],
    track: [...(seed.track ?? [])] as any[],
  };

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.event) return state.event;
    if (table === schema.contact) return state.contact;
    if (table === schema.submission) return state.submission;
    if (table === schema.track) return state.track;
    return undefined;
  }

  function snakeToCamel(s: string): string {
    return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  }
  function conditionColumnValues(cond: unknown): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    let currentCol: string | null = null;
    function walk(node: unknown, seen = new Set<unknown>(), depth = 0): void {
      if (depth > 12 || node === null || typeof node !== "object" || seen.has(node)) return;
      seen.add(node);
      const n = node as Record<string, unknown>;
      if (typeof n.name === "string" && n.name.length > 0 && /^[a-z][a-z0-9_]*$/.test(n.name)) {
        currentCol = n.name;
      }
      if (n.value !== undefined && typeof n.value !== "object") {
        if (currentCol) {
          const key = snakeToCamel(currentCol);
          if (!map.has(key)) map.set(key, new Set());
          map.get(key)!.add(JSON.stringify(n.value));
        }
      }
      if (Array.isArray(n.queryChunks)) for (const c of n.queryChunks) walk(c, seen, depth + 1);
      if (Array.isArray(n.value)) for (const c of n.value) walk(c, seen, depth + 1);
    }
    walk(cond);
    return map;
  }
  function rowMatches(row: Record<string, unknown>, cond: unknown): boolean {
    const wants = conditionColumnValues(cond);
    for (const [key, allowed] of wants) {
      if (!(key in row)) continue;
      if (!allowed.has(JSON.stringify(row[key]))) return false;
    }
    return true;
  }

  // Finds the underlying column's camelCase key inside a `sql\`max(${col})\``
  // aggregate expression (a drizzle SQL<T> object, distinguished from a
  // plain Column by having queryChunks) -- same walk shape as
  // conditionColumnValues, reused here to project a single-row MAX()
  // aggregate (DEC-528 wave-58 amendment: loadMaxSubmissionSeq/
  // loadMaxTrackPosition) rather than a whole-table select-then-reduce.
  function findAggregateColumnKey(expr: unknown): string | null {
    let found: string | null = null;
    function walk(node: unknown, seen = new Set<unknown>(), depth = 0): void {
      if (found || depth > 12 || node === null || typeof node !== "object" || seen.has(node)) return;
      seen.add(node);
      const n = node as Record<string, unknown>;
      if (typeof n.name === "string" && n.name.length > 0 && /^[a-z][a-z0-9_]*$/.test(n.name)) {
        found = snakeToCamel(n.name);
        return;
      }
      if (Array.isArray(n.queryChunks)) for (const c of n.queryChunks) walk(c, seen, depth + 1);
    }
    walk(expr);
    return found;
  }

  function isAggregateExpr(v: unknown): boolean {
    return v !== null && typeof v === "object" && Array.isArray((v as Record<string, unknown>).queryChunks);
  }

  function makeChain(rows: unknown[]) {
    const chain: any = {
      innerJoin: () => chain,
      where: (cond: unknown) => makeChain(rows.filter((r) => rowMatches(r as Record<string, unknown>, cond))),
      limit: (n: number) => makeChain(rows.slice(0, n)),
      groupBy: () => chain,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  let insertCallCount = 0;
  let updateCallCount = 0;

  const db = {
    select: (cols?: Record<string, unknown>) => ({
      from: (table: unknown) => {
        const rows = [...(stateArrayFor(table) ?? [])] as Record<string, unknown>[];
        const aggregateEntry = cols
          ? Object.entries(cols).find(([, v]) => isAggregateExpr(v))
          : undefined;
        if (aggregateEntry) {
          const [outKey, expr] = aggregateEntry;
          const colKey = findAggregateColumnKey(expr);
          const project = (filtered: Record<string, unknown>[]) => {
            const values = filtered.map((r) => Number(colKey ? r[colKey] : undefined));
            const maxVal = values.length > 0 ? Math.max(...values) : null;
            return [{ [outKey]: maxVal }];
          };
          const aggChain: any = {
            where: (cond: unknown) => ({
              then: (resolve: (v: unknown[]) => void) => resolve(project(rows.filter((r) => rowMatches(r, cond)))),
            }),
            then: (resolve: (v: unknown[]) => void) => resolve(project(rows)),
          };
          return aggChain;
        }
        return makeChain(rows);
      },
    }),
    insert: (table: unknown) => {
      insertCallCount++;
      return {
        values: (vals: unknown) => {
          const write = async () => {
            const rows = Array.isArray(vals) ? vals : [vals];
            const arr = stateArrayFor(table);
            if (arr) arr.push(...rows.map((r) => ({ ...(r as object) })));
          };
          return {
            then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
            onConflictDoNothing: () => write(),
          };
        },
      };
    },
    update: (table: unknown) => {
      updateCallCount++;
      return {
        set: (setVals: unknown) => ({
          where: (cond: unknown) => {
            const write = async () => {
              const arr = stateArrayFor(table);
              if (!arr) return;
              for (const r of arr) {
                if (rowMatches(r as Record<string, unknown>, cond)) Object.assign(r, setVals as object);
              }
            };
            return {
              then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject),
            };
          },
        }),
      };
    },
  };
  return {
    db: db as unknown as Db,
    state,
    counts: () => ({ insertCallCount, updateCallCount }),
  };
}

const ORG_ID = "org-1";
const EVENT_ID = "event-1";

describe("DEC-528 (wave 52): sessionboard importer non-participants branch is batched", () => {
  it("a multi-row contacts import assigns distinct ids and issues no per-row insert", async () => {
    const { db, state, counts } = fakeDb({ event: [{ id: EVENT_ID, startDate: "2026-06-15" }] });
    const ROW_COUNT = 25;

    const plans = Array.from({ length: ROW_COUNT }, (_, i) => ({
      row: i + 2,
      externalRef: externalRef(SESSIONBOARD_SOURCE, `sb-${i}`),
      values: { firstName: "First", lastName: `Last${i}`, email: `person${i}@example.com` },
    }));

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: plans as any,
    });

    expect(result).toMatchObject({ created: ROW_COUNT, updated: 0, skipped: [] });
    expect(state.contact).toHaveLength(ROW_COUNT);
    // Every row got a distinct id.
    expect(new Set(state.contact.map((c) => c.id)).size).toBe(ROW_COUNT);
    // Batched: a handful of chunked insert() calls, never one per row.
    const { insertCallCount } = counts();
    expect(insertCallCount).toBeGreaterThan(0);
    expect(insertCallCount).toBeLessThan(ROW_COUNT);
  });

  it("a multi-row submissions import assigns consecutive distinct seq values", async () => {
    const { db, state, counts } = fakeDb({ event: [{ id: EVENT_ID, startDate: "2026-06-15" }] });
    const ROW_COUNT = 12;

    const plans = Array.from({ length: ROW_COUNT }, (_, i) => ({
      row: i + 2,
      externalRef: externalRef(SESSIONBOARD_SOURCE, `sb-sess-${i}`),
      values: { title: `Talk ${i}` },
    }));

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: plans as any,
    });

    expect(result).toMatchObject({ created: ROW_COUNT, updated: 0, skipped: [] });
    expect(state.submission).toHaveLength(ROW_COUNT);
    const seqs = state.submission.map((s) => s.seq as number).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: ROW_COUNT }, (_, i) => i + 1));
    expect(new Set(seqs).size).toBe(ROW_COUNT);
    const { insertCallCount } = counts();
    expect(insertCallCount).toBeGreaterThan(0);
    expect(insertCallCount).toBeLessThan(ROW_COUNT);
  });

  it("submission seq allocation continues from existing rows' max, not from zero", async () => {
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [
        {
          id: "existing-1",
          eventId: EVENT_ID,
          formId: null,
          seq: 3,
          title: "Existing",
          description: null,
          status: "pending",
          contentStatus: "pending",
          externalRef: "sessionboard:sb-existing",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const plans = [
      { row: 2, externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-new-1"), values: { title: "New 1" } },
      { row: 3, externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-new-2"), values: { title: "New 2" } },
    ];

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: plans as any,
    });

    expect(result).toMatchObject({ created: 2, updated: 0, skipped: [] });
    const newSeqs = state.submission.filter((s) => s.id !== "existing-1").map((s) => s.seq as number).sort((a, b) => a - b);
    expect(newSeqs).toEqual([4, 5]);
  });

  it("an idempotent re-import produces the same updated counts as before", async () => {
    const { db, state } = fakeDb({ event: [{ id: EVENT_ID, startDate: "2026-06-15" }] });
    const ROW_COUNT = 10;

    const plans = Array.from({ length: ROW_COUNT }, (_, i) => ({
      row: i + 2,
      externalRef: externalRef(SESSIONBOARD_SOURCE, `sb-${i}`),
      values: { firstName: "First", lastName: `Last${i}`, email: `person${i}@example.com`, company: "Acme" },
    }));

    const first = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: plans as any,
    });
    expect(first).toMatchObject({ created: ROW_COUNT, updated: 0, skipped: [] });
    expect(state.contact).toHaveLength(ROW_COUNT);

    // A second identical import: every row now resolves via existing
    // external_ref -- update branch, not create.
    const secondPlans = plans.map((p) => ({ ...p, values: { ...p.values, company: "Acme Corp" } }));
    const second = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: secondPlans as any,
    });
    expect(second).toMatchObject({ created: 0, updated: ROW_COUNT, skipped: [] });
    expect(state.contact).toHaveLength(ROW_COUNT);
    for (const c of state.contact) expect(c.company).toBe("Acme Corp");

    // A third identical re-import (values unchanged from the second): same
    // updated count as before -- idempotent, no drift in the batched update
    // grouping across repeated runs.
    const third = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: false,
      plans: secondPlans as any,
    });
    expect(third).toMatchObject({ created: 0, updated: ROW_COUNT, skipped: [] });
    expect(state.contact).toHaveLength(ROW_COUNT);
  });

  it("submission seq and track position aggregates continue from existing rows' max via SQL MAX()", async () => {
    const now = new Date();
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [1, 2, 3].map((seq) => ({
        id: `existing-sub-${seq}`,
        eventId: EVENT_ID,
        formId: null,
        seq,
        title: `Existing ${seq}`,
        description: null,
        status: "pending",
        contentStatus: "pending",
        externalRef: `sessionboard:sb-existing-${seq}`,
        createdAt: now,
        updatedAt: now,
      })),
      track: [0, 1].map((position) => ({
        id: `existing-track-${position}`,
        eventId: EVENT_ID,
        name: `Track ${position}`,
        color: null,
        position,
        externalRef: `sessionboard:track-existing-${position}`,
        createdAt: now,
        updatedAt: now,
      })),
    });

    const subResult = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: [{ row: 2, externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-new"), values: { title: "New" } }] as any,
    });
    expect(subResult).toMatchObject({ created: 1, updated: 0, skipped: [] });
    const newSub = state.submission.find((s) => s.id !== "existing-sub-1" && s.id !== "existing-sub-2" && s.id !== "existing-sub-3");
    expect(newSub?.seq).toBe(4);

    const trackResult = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "tracks",
      dryRun: false,
      plans: [{ row: 2, externalRef: externalRef(SESSIONBOARD_SOURCE, "track-new"), values: { name: "New Track" } }] as any,
    });
    expect(trackResult).toMatchObject({ created: 1, updated: 0, skipped: [] });
    const newTrack = state.track.find((t) => t.id !== "existing-track-0" && t.id !== "existing-track-1");
    expect(newTrack?.position).toBe(2);
  });

  it("submission seq and track position aggregates start at 1 and 0 for an event with none yet", async () => {
    const { db, state } = fakeDb({ event: [{ id: EVENT_ID, startDate: "2026-06-15" }] });

    const subResult = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: false,
      plans: [{ row: 2, externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-first"), values: { title: "First" } }] as any,
    });
    expect(subResult).toMatchObject({ created: 1, updated: 0, skipped: [] });
    expect(state.submission).toHaveLength(1);
    expect(state.submission[0].seq).toBe(1);

    const trackResult = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "tracks",
      dryRun: false,
      plans: [{ row: 2, externalRef: externalRef(SESSIONBOARD_SOURCE, "track-first"), values: { name: "First Track" } }] as any,
    });
    expect(trackResult).toMatchObject({ created: 1, updated: 0, skipped: [] });
    expect(state.track).toHaveLength(1);
    expect(state.track[0].position).toBe(0);
  });

  it("a dry run allocates no seq/position rows for submissions or tracks", async () => {
    const { db, state } = fakeDb({
      event: [{ id: EVENT_ID, startDate: "2026-06-15" }],
      submission: [
        {
          id: "existing-1",
          eventId: EVENT_ID,
          formId: null,
          seq: 3,
          title: "Existing",
          description: null,
          status: "pending",
          contentStatus: "pending",
          externalRef: "sessionboard:sb-existing",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const subResult = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "submissions",
      dryRun: true,
      plans: [{ row: 2, externalRef: externalRef(SESSIONBOARD_SOURCE, "sb-new"), values: { title: "New" } }] as any,
    });
    expect(subResult).toMatchObject({ created: 1, updated: 0, skipped: [] });
    // No write at all -- still exactly the one pre-existing submission row.
    expect(state.submission).toHaveLength(1);

    const trackResult = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "tracks",
      dryRun: true,
      plans: [{ row: 2, externalRef: externalRef(SESSIONBOARD_SOURCE, "track-new"), values: { name: "New Track" } }] as any,
    });
    expect(trackResult).toMatchObject({ created: 1, updated: 0, skipped: [] });
    expect(state.track).toHaveLength(0);
  });

  it("dry run writes nothing for a multi-row contacts+submissions batch", async () => {
    const { db, state } = fakeDb({ event: [{ id: EVENT_ID, startDate: "2026-06-15" }] });

    const plans = Array.from({ length: 5 }, (_, i) => ({
      row: i + 2,
      externalRef: externalRef(SESSIONBOARD_SOURCE, `sb-${i}`),
      values: { firstName: "First", lastName: `Last${i}`, email: `person${i}@example.com` },
    }));

    const result = await applySessionboardPlans(db, {
      orgId: ORG_ID,
      eventId: EVENT_ID,
      entity: "contacts",
      dryRun: true,
      plans: plans as any,
    });

    expect(result).toMatchObject({ created: 5, updated: 0, skipped: [] });
    expect(state.contact).toHaveLength(0);
  });
});
