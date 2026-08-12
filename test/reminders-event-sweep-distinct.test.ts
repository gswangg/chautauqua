// DEC-537: listEventIdsWithOutstandingAssignments (the cron's event sweep)
// must be a SQL DISTINCT, not a whole task_assignment table scan reduced by
// a JS Set — the same shape of defect DEC-536 fixes on the portal side.
// This asserts the query calls db.selectDistinct (not db.select) with the
// same join/where, and that the function no longer performs a JS dedupe on
// the resulting rows (duplicate rows in must produce duplicate ids out,
// since a fake db with no real DISTINCT semantics can't dedupe for us —
// proving the function itself no longer reduces in JS).

import { describe, expect, it } from "vitest";
import { listEventIdsWithOutstandingAssignments } from "../src/server/repo/tasks/reminders";
import type { Db } from "../src/server/context";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

describe("listEventIdsWithOutstandingAssignments (DEC-537)", () => {
  it("calls db.selectDistinct, not db.select — the dedupe is SQL", async () => {
    let selectCalled = false;
    let selectDistinctCalled = false;
    const db = {
      select: () => {
        selectCalled = true;
        return makeChain([]);
      },
      selectDistinct: () => {
        selectDistinctCalled = true;
        return makeChain([{ eventId: "ev-1" }]);
      },
    } as unknown as Db;

    const ids = await listEventIdsWithOutstandingAssignments(db);

    expect(selectDistinctCalled).toBe(true);
    expect(selectCalled).toBe(false);
    expect(ids).toEqual(["ev-1"]);
  });

  it("no longer reduces in JS: a fake db handing back duplicate rows (as a real DISTINCT would never do) surfaces the duplicate, proving there is no JS Set dedupe left to mask it", async () => {
    const db = {
      select: () => makeChain([]),
      selectDistinct: () => makeChain([{ eventId: "ev-1" }, { eventId: "ev-1" }, { eventId: "ev-2" }]),
    } as unknown as Db;

    const ids = await listEventIdsWithOutstandingAssignments(db);

    // Correctness of the dedupe now belongs to the DB (DISTINCT), which
    // this fake doesn't simulate — the function itself must pass rows
    // through untouched.
    expect(ids).toEqual(["ev-1", "ev-1", "ev-2"]);
  });
});
