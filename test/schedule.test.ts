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

    expect(run1.map((p) => p.submissionId).sort()).toEqual(["s1", "s2", "s3"]);
    expect(findConflicts(run1)).toEqual([]);
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
    const placedIds = result.map((p) => p.submissionId);
    expect(placedIds).not.toContain("s2");
    expect(findConflicts(result)).toEqual([]);
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
    expect(findConflicts(result)).toEqual([]);
    const placedS1 = result.find((p) => p.submissionId === "s1");
    expect(placedS1).toBeDefined();
    expect(placedS1!.startMin).toBeGreaterThanOrEqual(600);
  });
});
