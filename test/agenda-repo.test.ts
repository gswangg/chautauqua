import { describe, expect, it } from "vitest";
import {
  computeDays,
  DEFAULT_AUTO_SCHEDULE_PARAMS,
  getAgendaPayload,
  isValidSlotInput,
} from "../src/server/repo/agenda";
import type { Db } from "../src/server/context";

// Minimal fake db mirroring the sequential select() calls made by
// getAgendaPayload (see test/agenda-room-ownership.test.ts for the
// established pattern — no local sqlite/D1 test driver is wired up here).
function makeChain(rows: unknown[], onWhere?: (cond: unknown) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: (cond: unknown) => {
      onWhere?.(cond);
      return chain;
    },
    orderBy: () => chain,
    limit: async () => rows,
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

describe("computeDays (DEC-021: days derived from event.startDate..endDate)", () => {
  it("returns a single day when start === end", () => {
    expect(computeDays("2026-08-10", "2026-08-10")).toEqual(["2026-08-10"]);
  });

  it("returns an inclusive range across multiple days", () => {
    expect(computeDays("2026-08-10", "2026-08-12")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
    ]);
  });

  it("throws loudly on an unparseable date", () => {
    expect(() => computeDays("not-a-date", "2026-08-12")).toThrow();
  });
});

describe("DEFAULT_AUTO_SCHEDULE_PARAMS (DEC-021 defaults)", () => {
  it("matches the binding decision's 540/1080/30/15", () => {
    expect(DEFAULT_AUTO_SCHEDULE_PARAMS).toEqual({
      dayStartMin: 540,
      dayEndMin: 1080,
      defaultDurationMin: 30,
      gridMin: 15,
    });
  });
});

describe("isValidSlotInput", () => {
  it("accepts a valid slot with a room", () => {
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 540, endMin: 600, roomId: "r1" })).toBe(true);
  });

  it("accepts a valid slot with a null room (TBD is a real value)", () => {
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 540, endMin: 600, roomId: null })).toBe(true);
  });

  it("accepts a valid slot with roomId omitted", () => {
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 540, endMin: 600 })).toBe(true);
  });

  it("rejects malformed day, non-integer minutes, and endMin <= startMin", () => {
    expect(isValidSlotInput({ day: "8/10/2026", startMin: 540, endMin: 600 })).toBe(false);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 540.5, endMin: 600 })).toBe(false);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 600, endMin: 600 })).toBe(false);
    expect(isValidSlotInput({ day: "2026-08-10", startMin: 600, endMin: 540 })).toBe(false);
  });

  it("rejects non-object and missing fields", () => {
    expect(isValidSlotInput(null)).toBe(false);
    expect(isValidSlotInput("string")).toBe(false);
    expect(isValidSlotInput({})).toBe(false);
  });
});

describe("getAgendaPayload unscheduled tray (AIA-08: accepted-only)", () => {
  const event = { orgId: "org1", startDate: "2026-08-10", endDate: "2026-08-10", recordPrefix: "EV" };

  it("scopes the placeable-submission query by status='accepted' — accept_queue never reaches the tray", async () => {
    let capturedSubmissionWhere: unknown;
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([]); // rooms
        if (call === 2) return makeChain([]); // tracks
        if (call === 3) return makeChain([], (cond) => (capturedSubmissionWhere = cond)); // submissionRows
        return makeChain([]);
      },
    } as unknown as Db;

    await getAgendaPayload(db, "event1", event);

    const tokens = walkCondition(capturedSubmissionWhere);
    expect(tokens).toContain("col:status");
    expect(tokens).toContain('val:"accepted"');
  });

  it("an accept_queue submission with no slot never appears in unscheduled (loadAcceptedSessions already filters it out at the query)", async () => {
    // The submissionRows select (call 3) only ever returns rows the query
    // matched — an accept_queue row is filtered server-side, so the fake
    // simply never returns one here, proving the payload building code
    // that follows (placed/unscheduled split) has nothing accept_queue to
    // leak even if it tried.
    let call = 0;
    const db = {
      select: () => {
        call += 1;
        if (call === 1) return makeChain([]); // rooms
        if (call === 2) return makeChain([]); // tracks
        if (call === 3) return makeChain([{ id: "sub-accepted", seq: 1, title: "Accepted Talk" }]); // submissionRows (accept_queue row excluded by the WHERE)
        return makeChain([]); // track/participant/slot batches
      },
    } as unknown as Db;

    const payload = await getAgendaPayload(db, "event1", event);
    expect(payload.unscheduled).toHaveLength(1);
    expect(payload.unscheduled[0]?.submissionId).toBe("sub-accepted");
    // DEC-615: a plain GET never runs the placer, so it has no per-item
    // reasons to report — only runAutoSchedule populates this.
    expect(payload.unplacedReasons).toEqual([]);
  });
});
