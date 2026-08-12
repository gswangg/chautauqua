// DEC-229: deleteTrack extends its 409-never-cascades guard beyond
// submissions to form.tracks_json, evaluation_plan.filters_json track
// filters, and plan_reviewer.track_id scope rows. A minimal fake db stands
// in for D1, mirroring the sequential select() calls made by deleteTrack
// (see test/agenda-repo.test.ts / test/agenda-room-ownership.test.ts for the
// established pattern — no local sqlite/D1 test driver is wired up here).

import { describe, expect, it } from "vitest";
import { deleteTrack } from "../src/server/repo/events";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

/** Builds a fake db that answers deleteTrack's sequential select() calls
 * from `selects` (one array of rows per call, in call order), and supports
 * a no-op delete(). */
function fakeDb(selects: unknown[][]) {
  let call = 0;
  const deleteChain: any = { where: async () => undefined };
  const db = {
    select: () => {
      const rows = selects[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    delete: () => deleteChain,
  } as unknown as AppEnv["Variables"]["db"];
  return db;
}

const now = new Date();

const trackRow = {
  id: "track1",
  eventId: "event1",
  name: "Track One",
  color: null,
  position: 0,
  createdAt: now,
  updatedAt: now,
};

function planRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "plan1",
    eventId: "event1",
    name: "Plan",
    instructions: null,
    openDate: null,
    closeDate: null,
    filtersJson: null,
    anonymized: false,
    scaleJson: JSON.stringify({ min: 1, max: 5 }),
    criteriaJson: JSON.stringify([]),
    rounds: 1,
    currentRound: 1,
    roundCriteriaJson: null,
    maxEvaluations: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function formRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "form1",
    eventId: "event1",
    title: "CFP",
    description: null,
    isDefault: true,
    openDate: null,
    closeDate: null,
    tracksJson: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("deleteTrack referential guard (DEC-229, never cascades)", () => {
  it("409s when a submission still references the track (existing check)", async () => {
    const db = fakeDb([[trackRow], [{ id: "sub1" }]]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({ status: 409 });
  });

  it("409s when a form's tracks_json still lists the track", async () => {
    const db = fakeDb([
      [trackRow], // getTrackForEvent
      [], // submission primary refs
      [], // submissionTrack join refs
      [formRow({ tracksJson: JSON.stringify(["track1", "track2"]) })], // findFormForEvent
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({ status: 409 });
  });

  it("409s when a plan's filters_json track filter still lists the track", async () => {
    const db = fakeDb([
      [trackRow],
      [],
      [],
      [], // no form
      [planRow({ filtersJson: JSON.stringify({ trackIds: ["track1"] }) })], // listPlansForEvent
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({ status: 409 });
  });

  it("409s when a plan_reviewer row still scopes a reviewer to the track", async () => {
    const db = fakeDb([
      [trackRow],
      [],
      [],
      [], // no form
      [planRow()], // one plan, no filter reference
      [{ id: "pr1", planId: "plan1", userId: "u1", trackId: "track1", submissionId: null }], // listReviewerRowsForPlan
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({ status: 409 });
  });

  it("deletes cleanly when the track is wholly unreferenced", async () => {
    const db = fakeDb([
      [trackRow],
      [],
      [],
      [], // no form
      [planRow()], // one plan, no filter reference
      [], // no reviewer rows scoped to this track
    ]);
    await expect(deleteTrack(db, "track1", "event1")).resolves.toBeUndefined();
  });
});
