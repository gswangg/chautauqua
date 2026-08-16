// DEC-021 wave-66 amendment: an absent roomId key on a slot write must leave
// the stored room untouched (a time-only reschedule is not an unassign). See
// src/server/repo/agenda/slots.ts's SlotInput doc-comment for the tri-state
// contract this test enumerates: absent key -> untouched, present null ->
// cleared, present string -> replaced (after the route's own
// roomBelongsToEvent gate, unit-tested at the route level via the existing
// test/agenda-room-ownership.test.ts).

import { describe, expect, it } from "vitest";
import { upsertSlot } from "../src/server/repo/agenda/slots";
import type { Db } from "../src/server/context";

function makeDb() {
  const insertValues: unknown[] = [];
  const updateSets: unknown[] = [];
  let submissionUpdateCalls = 0;

  const insertChain: any = {
    values: (v: unknown) => {
      insertValues.push(v);
      return insertChain;
    },
    onConflictDoUpdate: (opts: { set: unknown }) => {
      updateSets.push(opts.set);
      // DEC-519 wave-6 amendment: upsertSlot now gates the bump on
      // `.returning()` having a row. This fake db's whole point is
      // exercising the tri-state roomId `set` shape (a genuine change in
      // every case here), so `.returning()` reports one row -- these tests
      // are not about the no-op differential itself (that's
      // test/ics-sequence-bumps.test.ts's job).
      return { returning: () => Promise.resolve([{ id: "slot-1" }]) };
    },
  };

  const updateChain: any = {
    set: () => updateChain,
    where: async () => {
      submissionUpdateCalls += 1;
      return undefined;
    },
  };

  const db = {
    insert: () => insertChain,
    update: () => updateChain,
  } as unknown as Db;

  return {
    db,
    getInsertValues: () => insertValues,
    getUpdateSets: () => updateSets,
    getSubmissionUpdateCalls: () => submissionUpdateCalls,
  };
}

describe("upsertSlot (DEC-021 wave-66: tri-state roomId)", () => {
  it("absent roomId key -> onConflictDoUpdate set omits roomId entirely (stored room untouched)", async () => {
    const { db, getUpdateSets, getSubmissionUpdateCalls } = makeDb();
    await upsertSlot(db, "sub1", { day: "2026-08-10", startMin: 540, endMin: 600 });
    const [set] = getUpdateSets();
    expect(set).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(set as object, "roomId")).toBe(false);
    // bumpIcsSequences must still fire on a time-only reschedule.
    expect(getSubmissionUpdateCalls()).toBe(1);
  });

  it("roomId: null (present) -> onConflictDoUpdate set writes roomId: null (explicit unassign)", async () => {
    const { db, getUpdateSets } = makeDb();
    await upsertSlot(db, "sub1", { day: "2026-08-10", startMin: 540, endMin: 600, roomId: null });
    const [set] = getUpdateSets();
    expect(Object.prototype.hasOwnProperty.call(set as object, "roomId")).toBe(true);
    expect((set as { roomId: unknown }).roomId).toBeNull();
  });

  it("roomId: 'room2' (present string) -> onConflictDoUpdate set writes the new room", async () => {
    const { db, getUpdateSets } = makeDb();
    await upsertSlot(db, "sub1", { day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room2" });
    const [set] = getUpdateSets();
    expect((set as { roomId: unknown }).roomId).toBe("room2");
  });

  it("a first-ever slot with no roomId key inserts roomId: null (INSERT branch has nothing to preserve)", async () => {
    const { db, getInsertValues } = makeDb();
    await upsertSlot(db, "sub1", { day: "2026-08-10", startMin: 540, endMin: 600 });
    const [values] = getInsertValues();
    expect((values as { roomId: unknown }).roomId).toBeNull();
  });

  it("bumpIcsSequences fires on every slot write regardless of roomId presence", async () => {
    const { db, getSubmissionUpdateCalls } = makeDb();
    await upsertSlot(db, "sub1", { day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room2" });
    expect(getSubmissionUpdateCalls()).toBe(1);
  });
});
