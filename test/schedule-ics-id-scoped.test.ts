// DEC-310 (perf w12-c): schedule.ics used to hydrate the WHOLE published
// agenda then filter down to the requested ids in memory — a scale defect at
// large events. getPublicAgendaByIds instead scopes the scheduleSlot scan to
// the requested ids (chunked per DEC-078). A minimal fake db stands in for
// D1, mirroring the sequential selectDistinct/select calls made by the real
// code path (see test/agenda-room-ownership.test.ts for the established
// pattern) — no local sqlite/D1 test driver is wired up in this repo.

import { describe, expect, it } from "vitest";
import { getPublicAgendaByIds, type PublicEvent } from "../src/server/repo/public";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

const EVENT: PublicEvent = {
  id: "event1",
  orgId: "org1",
  name: "Conf",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "EV",
  brandingJson: null,
};

// slotRows: what the scheduleSlot/submission join returns for the requested
// (already-visibility-filtered) ids. subRows/trackRows/speakerRows/hydrate's
// slotRows feed hydrateSessions in the same shape getPublicAgenda uses.
function fakeDb(opts: {
  slotRows: { submissionId: string; day: string; startMin: number; endMin: number; roomId: string | null }[];
  subRows: unknown[];
  roomRows?: unknown[];
}) {
  // Room lookup only fires when at least one returned slot has a non-null
  // roomId (see getPublicAgendaByIds: `roomIds.length === 0 ? [] : ...`) —
  // mirror that in the call-order mapping instead of hard-coding an offset.
  const hasRoomLookup = opts.slotRows.some((r) => r.roomId !== null);
  let selectCall = 0;
  let selectDistinctCall = 0;
  const db = {
    selectDistinct: () => {
      selectDistinctCall += 1;
      return makeChain(opts.slotRows);
    },
    select: () => {
      selectCall += 1;
      const offset = hasRoomLookup ? 1 : 0;
      if (hasRoomLookup && selectCall === 1) return makeChain(opts.roomRows ?? []);
      // hydrateSessions subRows / trackRows / speakerRows / slotRows in order
      if (selectCall === 1 + offset) return makeChain(opts.subRows);
      if (selectCall === 2 + offset) return makeChain([]);
      if (selectCall === 3 + offset) return makeChain([]);
      return makeChain([]);
    },
  } as unknown as AppEnv["Variables"]["db"];
  return { db, getSelectDistinctCalls: () => selectDistinctCall };
}

describe("getPublicAgendaByIds (DEC-310, DEC-078, DEC-080)", () => {
  it("returns [] immediately for an empty id list, issuing no query", async () => {
    const { db, getSelectDistinctCalls } = fakeDb({ slotRows: [], subRows: [] });
    const items = await getPublicAgendaByIds(db, EVENT, []);
    expect(items).toEqual([]);
    expect(getSelectDistinctCalls()).toBe(0);
  });

  it("a non-visible/unscheduled requested id is silently dropped (never leaked)", async () => {
    // Only sub-visible comes back from the scheduleSlot/submission join —
    // the shared visibleSessionConditions() gate already excluded the
    // hidden/unscheduled id server-side, mirroring getPublicSessionsByIds.
    const { db } = fakeDb({
      slotRows: [{ submissionId: "sub-visible", day: "2026-08-10", startMin: 540, endMin: 600, roomId: null }],
      subRows: [{ id: "sub-visible", seq: 1, title: "Visible Talk", description: null, icsSequence: 0 }],
    });
    const items = await getPublicAgendaByIds(db, EVENT, ["sub-visible", "sub-hidden-or-unscheduled"]);
    expect(items.map((i) => i.submissionId)).toEqual(["sub-visible"]);
  });

  it("returns requested visible ids in agenda (day, startMin) order, not request order", async () => {
    const { db } = fakeDb({
      slotRows: [
        { submissionId: "sub-late", day: "2026-08-10", startMin: 660, endMin: 720, roomId: null },
        { submissionId: "sub-early", day: "2026-08-10", startMin: 540, endMin: 600, roomId: null },
      ],
      subRows: [
        { id: "sub-late", seq: 2, title: "Late Talk", description: null, icsSequence: 0 },
        { id: "sub-early", seq: 1, title: "Early Talk", description: null, icsSequence: 0 },
      ],
    });
    // Requested out of chronological order — the response must still come
    // back ordered by (day, startMin), same as getPublicAgenda.
    const items = await getPublicAgendaByIds(db, EVENT, ["sub-late", "sub-early"]);
    expect(items.map((i) => i.submissionId)).toEqual(["sub-early", "sub-late"]);
  });
});
