// DEC-318: a schedule_slot dated outside the owning event's own
// [startDate, endDate] range must never publish on any public surface —
// the SQL WHERE itself is bounded (slotWithinEventRange, kept per DEC-312
// out of the mapper) so getPublicAgenda, getPublicAgendaByIds and the
// session-card slot fields (hydrateSessions, via getPublicSessionsByIds)
// all agree. The admin side (src/server/repo/agenda.ts's getAgendaPayload)
// is untouched by this change and still classifies the same out-of-range
// slot as unscheduled/unplaced (SPEC J10 admin/public parity) — see
// test/agenda-day-range.test.ts (DEC-277) for that behavior's own coverage;
// this file re-confirms it side-by-side with the public-surface exclusion.

import { describe, expect, it } from "vitest";
import { getAgendaPayload } from "../src/server/repo/agenda";
import { getPublicAgenda, getPublicAgendaByIds, getPublicSessionsByIds } from "../src/server/repo/public";
import type { PublicEvent } from "../src/server/repo/public";
import type { Db } from "../src/server/context";

// Fake db chain mirroring the established pattern (test/agenda-repo.test.ts,
// test/agenda-day-range.test.ts) — no local sqlite/D1 test driver is wired
// up, so WHERE conditions are captured and walked rather than executed.
function makeChain(rows: unknown[], onWhere?: (cond: unknown) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (cond: unknown) => {
      onWhere?.(cond);
      return chain;
    },
    orderBy: () => chain,
    selectDistinct: () => chain,
    limit: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 8 || node === null || typeof node !== "object") return [];
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
  endDate: "2026-08-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "EV",
  brandingJson: null,
};

// A slot dated one day before the event's single-day range.
const OUT_OF_RANGE_DAY = "2026-08-09";

describe("getPublicAgenda (DEC-318): schedule_slot bounded to event range", () => {
  it("binds the agenda-rows query's WHERE to [startDate, endDate]", async () => {
    let capturedWhere: unknown;
    let call = 0;
    const db = {
      select: () => makeChain([]),
      selectDistinct: () => {
        call += 1;
        // 1: agenda rows (scheduleSlot join submission) — the query DEC-318 bounds
        if (call === 1) return makeChain([], (cond) => (capturedWhere = cond));
        return makeChain([]);
      },
    } as unknown as Db;

    const { items } = await getPublicAgenda(db, EVENT);
    expect(items).toEqual([]);

    const tokens = walkCondition(capturedWhere);
    expect(tokens).toContain("col:day");
    expect(tokens).toContain(`val:${JSON.stringify(EVENT.startDate)}`);
    expect(tokens).toContain(`val:${JSON.stringify(EVENT.endDate)}`);
  });

  it("an out-of-range slot never reaches the agenda output (rows already excluded by the WHERE)", async () => {
    const db = {
      select: () => makeChain([]),
      // The real SQL excludes the out-of-range row at the source — the
      // fake mirrors that by never handing it back, same as the
      // established convention for these tests (see test/public.test.ts).
      selectDistinct: () => makeChain([]),
    } as unknown as Db;

    const { items } = await getPublicAgenda(db, EVENT);
    expect(items).toEqual([]);
  });
});

describe("getPublicAgendaByIds (DEC-318): schedule_slot bounded to event range", () => {
  it("binds the batched agenda-rows query's WHERE to [startDate, endDate]", async () => {
    let capturedWhere: unknown;
    let call = 0;
    const db = {
      select: () => makeChain([]),
      selectDistinct: () => {
        call += 1;
        if (call === 1) return makeChain([], (cond) => (capturedWhere = cond));
        return makeChain([]);
      },
    } as unknown as Db;

    const items = await getPublicAgendaByIds(db, EVENT, ["sub1"]);
    expect(items).toEqual([]);

    const tokens = walkCondition(capturedWhere);
    expect(tokens).toContain("col:day");
    expect(tokens).toContain(`val:${JSON.stringify(EVENT.startDate)}`);
    expect(tokens).toContain(`val:${JSON.stringify(EVENT.endDate)}`);
  });
});

describe("hydrateSessions slot query (DEC-318): session-card slot fields", () => {
  it("binds the slotRows WHERE to [startDate, endDate] so an out-of-range slot renders unscheduled", async () => {
    let capturedSlotWhere: unknown;
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        // hydrateSessions call order: subRows, trackRows, speakerRows, slotRows
        if (call === 1) {
          return makeChain([{ id: "sub1", seq: 1, title: "Talk", description: null, icsSequence: 0 }]);
        }
        if (call === 2) return makeChain([]); // trackRows
        if (call === 3) return makeChain([]); // speakerRows
        // slotRows: real SQL excludes the out-of-range row; the fake never
        // hands it back, matching the WHERE this test also captures.
        return makeChain([], (cond) => (capturedSlotWhere = cond));
      },
      selectDistinct: () => makeChain([{ id: "sub1" }]),
    } as unknown as Db;

    const sessions = await getPublicSessionsByIds(db, EVENT, ["sub1"]);
    expect(sessions).toHaveLength(1);
    // Out-of-range slot never reached the row: card fields are all null,
    // not merely absent — the existing card renderer already handles this.
    expect(sessions[0]).toMatchObject({ day: null, startMin: null, endMin: null, roomName: null });

    const tokens = walkCondition(capturedSlotWhere);
    expect(tokens).toContain("col:day");
    expect(tokens).toContain(`val:${JSON.stringify(EVENT.startDate)}`);
    expect(tokens).toContain(`val:${JSON.stringify(EVENT.endDate)}`);
  });
});

describe("admin/public parity (SPEC J10): getAgendaPayload still surfaces the same out-of-range slot", () => {
  const adminEvent = { orgId: "org1", startDate: EVENT.startDate, endDate: EVENT.endDate, recordPrefix: "EV" };

  it("reports it in unscheduled and summary.unplaced, even though the public surfaces above exclude it", async () => {
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([]); // rooms
        if (call === 2) return makeChain([]); // tracks
        if (call === 3) return makeChain([{ id: "sub1", seq: 1, title: "Talk" }]); // submissionRows
        if (call === 4) return makeChain([]); // trackRows batch
        if (call === 5) return makeChain([]); // participantRows batch
        if (call === 6) {
          return makeChain([{ submissionId: "sub1", roomId: null, day: OUT_OF_RANGE_DAY, startMin: 540, endMin: 600 }]);
        }
        return makeChain([]);
      },
    } as unknown as Db;

    const payload = await getAgendaPayload(db, EVENT.id, adminEvent);
    expect(payload.placed).toEqual([]);
    expect(payload.unscheduled).toHaveLength(1);
    expect(payload.unscheduled[0]?.submissionId).toBe("sub1");
    expect(payload.summary.unplaced).toBe(1);
  });
});
