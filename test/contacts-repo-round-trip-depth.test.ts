// DEC-370 (wave-62 amendment): the contacts repo (crud.ts) issued several
// sets of mutually-independent reads strictly sequentially --
// listContactsForOrg's count + page-rows pair, listContactReferenceRows'
// four capped per-class reads, and the chunked id-rehydration loops in
// listContactsForOrg / selectFilteredContactRows. This test proves
// concurrency BEHAVIOURALLY -- an instrumented fake `Db` whose every query
// resolves only after an artificial delay, tracking the maximum number of
// simultaneously in-flight statements -- rather than a source grep for the
// string `Promise.all` (mirrors test/plans-progress-round-trip-depth.test.ts).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { listContactReferenceRows, listContactsForOrg } from "../src/server/repo/contacts/crud";
import { parseContactListQuery } from "../src/server/repo/contacts/query";

interface Tracker {
  inFlight: number;
  max: number;
}

/** Same minimal chainable fake query builder as
 * test/plans-progress-round-trip-depth.test.ts: every drizzle-style chain
 * method returns the same thenable, resolving only on `await` after a real
 * macrotask delay so genuinely concurrent callers overlap in wall-clock
 * time and genuinely sequential callers never do. Rows are looked up by the
 * table object passed to `.from()`. */
function makeInstrumentedDb(rowsByTable: Map<unknown, unknown[]>, tracker: Tracker): Db {
  function chain(state: { table: unknown }) {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "from", "innerJoin", "leftJoin", "where", "orderBy", "groupBy", "limit", "offset"]) {
      self[method] = (arg?: unknown) => {
        if (method === "from") state.table = arg;
        return self;
      };
    }
    self.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      tracker.inFlight += 1;
      tracker.max = Math.max(tracker.max, tracker.inFlight);
      return new Promise<void>((r) => setTimeout(r, 8))
        .then(() => {
          tracker.inFlight -= 1;
          resolve(rowsByTable.get(state.table) ?? []);
        })
        .catch((e: unknown) => {
          tracker.inFlight -= 1;
          reject(e);
        });
    };
    return self;
  }
  return {
    select: (_cols?: unknown) => chain({ table: undefined }),
  } as unknown as Db;
}

describe("DEC-370 (wave-62 amendment): contacts repo issues concurrent Promise.all waves", () => {
  it("listContactReferenceRows fires its four capped class reads concurrently", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const rows = new Map<unknown, unknown[]>([
      [schema.participant, []],
      [schema.taskAssignment, []],
      [schema.pipelineEntry, []],
      [schema.user, []],
    ]);
    const db = makeInstrumentedDb(rows, tracker);
    const result = await listContactReferenceRows(db, "contact-1");
    expect(result.submissions).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.pipelineEntries).toEqual([]);
    expect(result.userAccounts).toEqual([]);
    // A fully sequential handler could never exceed 1 concurrent statement.
    expect(tracker.max).toBeGreaterThanOrEqual(4);
  });

  it("listContactsForOrg (default directory path) fires its count + page-rows query concurrently", async () => {
    const tracker: Tracker = { inFlight: 0, max: 0 };
    const rows = new Map<unknown, unknown[]>([[schema.contact, []]]);
    const db = makeInstrumentedDb(rows, tracker);
    const params = parseContactListQuery({});
    const result = await listContactsForOrg(db, "org-1", params);
    expect(result.items).toEqual([]);
    expect(tracker.max).toBeGreaterThanOrEqual(2);
  });
});
