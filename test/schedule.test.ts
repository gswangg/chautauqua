import { describe, expect, it } from "vitest";
import {
  autoSchedule,
  findConflicts,
  scheduleSummary,
  type PlacedSession,
} from "../src/domain/schedule";

function session(overrides: Partial<PlacedSession>): PlacedSession {
  return {
    submissionId: "s1",
    roomId: "room-a",
    day: "2026-08-10",
    startMin: 540,
    endMin: 600,
    speakerContactIds: [],
    ...overrides,
  };
}

describe("findConflicts", () => {
  it("does not conflict when intervals only touch at boundaries", () => {
    const a = session({ submissionId: "a", startMin: 540, endMin: 600 });
    const b = session({ submissionId: "b", startMin: 600, endMin: 660 });
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("detects room overlap when rooms match and times intersect", () => {
    const a = session({ submissionId: "a", roomId: "room-a", startMin: 540, endMin: 600 });
    const b = session({ submissionId: "b", roomId: "room-a", startMin: 570, endMin: 630 });
    const conflicts = findConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe("room_overlap");
    expect(conflicts[0]?.submissionIds).toEqual(["a", "b"]);
  });

  it("never reports room overlap when either room is null", () => {
    const a = session({ submissionId: "a", roomId: null, startMin: 540, endMin: 600 });
    const b = session({ submissionId: "b", roomId: null, startMin: 570, endMin: 630 });
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("does not conflict when rooms differ, no shared speakers", () => {
    const a = session({ submissionId: "a", roomId: "room-a", startMin: 540, endMin: 600 });
    const b = session({ submissionId: "b", roomId: "room-b", startMin: 570, endMin: 630 });
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("detects speaker double-book across different rooms", () => {
    const a = session({
      submissionId: "a",
      roomId: "room-a",
      startMin: 540,
      endMin: 600,
      speakerContactIds: ["c1"],
    });
    const b = session({
      submissionId: "b",
      roomId: "room-b",
      startMin: 570,
      endMin: 630,
      speakerContactIds: ["c1", "c2"],
    });
    const conflicts = findConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe("speaker_overlap");
    expect(conflicts[0]?.submissionIds).toEqual(["a", "b"]);
  });

  it("reports each conflicting pair only once even with both kinds", () => {
    const a = session({
      submissionId: "a",
      roomId: "room-a",
      startMin: 540,
      endMin: 600,
      speakerContactIds: ["c1"],
    });
    const b = session({
      submissionId: "b",
      roomId: "room-a",
      startMin: 570,
      endMin: 630,
      speakerContactIds: ["c1"],
    });
    const conflicts = findConflicts([a, b]);
    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((c) => c.kind).sort()).toEqual([
      "room_overlap",
      "speaker_overlap",
    ]);
  });

  it("ignores sessions on different days", () => {
    const a = session({ submissionId: "a", roomId: "room-a", day: "2026-08-10" });
    const b = session({ submissionId: "b", roomId: "room-a", day: "2026-08-11" });
    expect(findConflicts([a, b])).toEqual([]);
  });
});

describe("scheduleSummary", () => {
  it("counts unplaced sessions and conflicts", () => {
    const a = session({
      submissionId: "a",
      roomId: "room-a",
      startMin: 540,
      endMin: 600,
    });
    const b = session({
      submissionId: "b",
      roomId: "room-a",
      startMin: 570,
      endMin: 630,
    });
    const summary = scheduleSummary([a, b], 5);
    expect(summary.unplaced).toBe(3);
    expect(summary.conflicts).toBe(1);
  });
});

describe("autoSchedule termination invariant (DEC-298)", () => {
  it("throws rather than looping forever when gridMin is 0", () => {
    const input = {
      sessions: [{ submissionId: "s1", durationMin: 30, track: null, speakerContactIds: [] }],
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 600,
      gridMin: 0,
      existing: [],
    };
    // If the guard regresses, this call hangs instead of throwing — the
    // test's own default vitest timeout (5s) then fails it loudly rather
    // than stalling the whole suite indefinitely.
    expect(() => autoSchedule(input)).toThrow(/gridMin/);
  }, 5000);

  it("throws when gridMin is negative", () => {
    const input = {
      sessions: [{ submissionId: "s1", durationMin: 30, track: null, speakerContactIds: [] }],
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 600,
      gridMin: -5,
      existing: [],
    };
    expect(() => autoSchedule(input)).toThrow(/gridMin/);
  }, 5000);

  it("throws when dayEndMin does not exceed dayStartMin", () => {
    const input = {
      sessions: [{ submissionId: "s1", durationMin: 30, track: null, speakerContactIds: [] }],
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 600,
      dayEndMin: 600,
      gridMin: 15,
      existing: [],
    };
    expect(() => autoSchedule(input)).toThrow(/dayEndMin/);
  }, 5000);
});

describe("autoSchedule", () => {
  it("is deterministic and produces zero conflicts on a solvable fixture", () => {
    const input = {
      sessions: [
        { submissionId: "s1", durationMin: 60, track: "a", speakerContactIds: ["c1"] },
        { submissionId: "s2", durationMin: 30, track: "b", speakerContactIds: ["c2"] },
        { submissionId: "s3", durationMin: 45, track: "a", speakerContactIds: ["c3"] },
      ],
      rooms: ["room-a", "room-b"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing: [],
    };

    const run1 = autoSchedule(input);
    const run2 = autoSchedule(input);
    expect(run1).toEqual(run2);

    expect(run1.placed.map((p) => p.submissionId).sort()).toEqual(["s1", "s2", "s3"]);
    expect(run1.unplaced).toEqual([]);
    expect(findConflicts(run1.placed)).toEqual([]);
  });

  it("leaves an unsolvable session unplaced without throwing", () => {
    const input = {
      sessions: [
        { submissionId: "s1", durationMin: 60, track: null, speakerContactIds: [] },
        { submissionId: "s2", durationMin: 9000, track: null, speakerContactIds: [] },
      ],
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 600,
      gridMin: 15,
      existing: [],
    };

    const result = autoSchedule(input);
    const placedIds = result.placed.map((p) => p.submissionId);
    expect(placedIds).not.toContain("s2");
    expect(result.unplaced).toEqual([{ submissionId: "s2", reason: "duration_exceeds_day" }]);
    expect(findConflicts(result.placed)).toEqual([]);
  });

  it("avoids new conflicts against existing placements", () => {
    const existing: PlacedSession[] = [
      session({
        submissionId: "existing1",
        roomId: "room-a",
        startMin: 540,
        endMin: 600,
        speakerContactIds: ["c1"],
      }),
    ];
    const input = {
      sessions: [
        { submissionId: "s1", durationMin: 60, track: null, speakerContactIds: ["c1"] },
      ],
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing,
    };

    const result = autoSchedule(input);
    expect(findConflicts(result.placed)).toEqual([]);
    const placedS1 = result.placed.find((p) => p.submissionId === "s1");
    expect(placedS1).toBeDefined();
    expect(placedS1!.startMin).toBeGreaterThanOrEqual(600);
  });

  it("falls back to the next room when the first room is occupied at that slot", () => {
    const existing: PlacedSession[] = [
      session({
        submissionId: "existing1",
        roomId: "room-a",
        startMin: 540,
        endMin: 600,
        speakerContactIds: [],
      }),
    ];
    const input = {
      sessions: [
        { submissionId: "s1", durationMin: 60, track: null, speakerContactIds: [] },
      ],
      rooms: ["room-a", "room-b"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing,
    };

    const result = autoSchedule(input);
    const placedS1 = result.placed.find((p) => p.submissionId === "s1");
    expect(placedS1).toBeDefined();
    // Room-a is occupied at 540-600, so s1 must fall back to room-b at the
    // same earliest slot rather than skip ahead to a later start time.
    expect(placedS1!.roomId).toBe("room-b");
    expect(placedS1!.startMin).toBe(540);
    expect(findConflicts(result.placed)).toEqual([]);
  });

  it("falls back to the next slot when a shared speaker is occupied across rooms", () => {
    const existing: PlacedSession[] = [
      session({
        submissionId: "existing1",
        roomId: "room-a",
        startMin: 540,
        endMin: 600,
        speakerContactIds: ["c1"],
      }),
    ];
    const input = {
      sessions: [
        { submissionId: "s1", durationMin: 60, track: null, speakerContactIds: ["c1"] },
      ],
      // Only one room, but the speaker conflict itself (independent of room)
      // must push s1 to the next available start time.
      rooms: ["room-b"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing,
    };

    const result = autoSchedule(input);
    const placedS1 = result.placed.find((p) => p.submissionId === "s1");
    expect(placedS1).toBeDefined();
    expect(placedS1!.startMin).toBeGreaterThanOrEqual(600);
    expect(findConflicts(result.placed)).toEqual([]);
  });

  it("schedules ~400 sessions across 15 rooms/5 days quickly with zero conflicts", () => {
    const rooms = Array.from({ length: 15 }, (_, i) => `room-${i}`);
    const days = Array.from({ length: 5 }, (_, i) => `2026-08-${10 + i}`);
    const speakerPool = Array.from({ length: 60 }, (_, i) => `speaker-${i}`);

    const sessions = Array.from({ length: 400 }, (_, i) => {
      const durationMin = [30, 45, 60, 90][i % 4]!;
      const track = ["a", "b", "c"][i % 3]!;
      const speakerContactIds = [
        speakerPool[i % speakerPool.length]!,
        speakerPool[(i + 7) % speakerPool.length]!,
      ];
      return {
        submissionId: `sess-${i}`,
        durationMin,
        track,
        speakerContactIds,
      };
    });

    const input = {
      sessions,
      rooms,
      days,
      dayStartMin: 540, // 9:00
      dayEndMin: 1080, // 18:00 (9h day)
      gridMin: 30,
      existing: [],
    };

    const start = Date.now();
    const result = autoSchedule(input);
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeLessThan(2000);

    const newlyPlacedIds = new Set(result.placed.map((p) => p.submissionId));
    const conflicts = findConflicts(result.placed).filter((c) =>
      c.submissionIds.some((id) => newlyPlacedIds.has(id)),
    );
    expect(conflicts).toEqual([]);
  });

  it("DEC-563: input array order is the tiebreak of record — a shuffled equal-duration session array produces byte-identical placements", () => {
    const baseSessions = Array.from({ length: 8 }, (_, i) => ({
      submissionId: `sub-${i}`,
      durationMin: 30, // equal duration and no track: the sort is a total
      track: null, // no-op except for submissionId, so shuffling the input
      speakerContactIds: [], // must not change the placement.
    }));

    const input = {
      rooms: ["room-a", "room-b"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing: [] as PlacedSession[],
    };

    const inOrder = autoSchedule({ ...input, sessions: baseSessions });
    const shuffled = [...baseSessions].reverse();
    const reversed = autoSchedule({ ...input, sessions: shuffled });
    const rotated = autoSchedule({
      ...input,
      sessions: [...baseSessions.slice(4), ...baseSessions.slice(0, 4)],
    });

    const byId = (result: typeof inOrder) =>
      [...result.placed].sort((a, b) => a.submissionId.localeCompare(b.submissionId));

    expect(byId(reversed)).toEqual(byId(inOrder));
    expect(byId(rotated)).toEqual(byId(inOrder));
  });
});
