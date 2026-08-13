// DEC-229: deleteTrack extends its 409-never-cascades guard beyond
// submissions to form.tracks_json, evaluation_plan.filters_json track
// filters, and plan_reviewer.track_id scope rows. DEC-931 additionally
// names the blocking rows in each refusal's `fields` map (see
// test/track-room-delete-blockers.test.ts for the message-content
// coverage) -- this file exercises the pass/fail branch shape against
// deleteTrack's new query sequence: track lookup, submissionCount agg,
// event ref-fields lookup, submissionTrack join (limit 5), form lookup,
// plan list, plan_reviewer join (limit 5). A minimal fake db stands in for
// D1, mirroring those sequential select() calls (see
// test/agenda-repo.test.ts / test/agenda-room-ownership.test.ts for the
// established pattern — no local sqlite/D1 test driver is wired up here).

import { describe, expect, it } from "vitest";
import { deleteTrack } from "../src/server/repo/events";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
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

const eventRefFields = { recordPrefix: "TALK", timezone: "UTC" };

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
    const db = fakeDb([
      [trackRow], // getTrackForEvent row lookup
      [], // getTrackForEvent's submissionCount grouped aggregate (DEC-916)
      [eventRefFields], // getEventRefFields (DEC-931)
      [{ seq: 1, title: "Talk" }], // submissionTrack join submission (limit 5)
      [{ count: 1 }], // bounded COUNT
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({ status: 409 });
  });

  it("409s when a form's tracks_json still lists the track", async () => {
    const db = fakeDb([
      [trackRow], // getTrackForEvent row lookup
      [], // getTrackForEvent's submissionCount grouped aggregate (DEC-916)
      [eventRefFields], // getEventRefFields (DEC-931)
      [], // submissionTrack join refs (limit 5, none)
      [formRow({ tracksJson: JSON.stringify(["track1", "track2"]) })], // findFormForEvent
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({ status: 409 });
  });

  it("409s when a plan's filters_json track filter still lists the track", async () => {
    const db = fakeDb([
      [trackRow],
      [], // getTrackForEvent's submissionCount grouped aggregate (DEC-916)
      [eventRefFields], // getEventRefFields (DEC-931)
      [],
      [], // no form
      [{ plan: planRow({ filtersJson: JSON.stringify({ trackIds: ["track1"] }) }), timezone: "UTC" }], // listPlansForEvent
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({ status: 409 });
  });

  it("409s when a plan_reviewer row still scopes a reviewer to the track", async () => {
    const db = fakeDb([
      [trackRow],
      [], // getTrackForEvent's submissionCount grouped aggregate (DEC-916)
      [eventRefFields], // getEventRefFields (DEC-931)
      [],
      [], // no form
      [{ plan: planRow(), timezone: "UTC" }], // one plan, no filter reference
      [{ email: "reviewer@example.com", planName: "Plan" }], // plan_reviewer join evaluation_plan join user (DEC-931, limit 5)
      [{ count: 1 }], // bounded COUNT
    ]);
    await expect(deleteTrack(db, "track1", "event1")).rejects.toMatchObject({ status: 409 });
  });

  it("deletes cleanly when the track is wholly unreferenced", async () => {
    const db = fakeDb([
      [trackRow],
      [], // getTrackForEvent's submissionCount grouped aggregate (DEC-916)
      [eventRefFields], // getEventRefFields (DEC-931)
      [],
      [], // no form
      [{ plan: planRow(), timezone: "UTC" }], // one plan, no filter reference
      [], // no reviewer rows scoped to this track
    ]);
    await expect(deleteTrack(db, "track1", "event1")).resolves.toBeUndefined();
  });
});
