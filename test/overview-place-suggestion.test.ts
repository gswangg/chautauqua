// DEC-652: Overview §04's concrete "Place at 11:30" / "Move DFC-047 to
// 11:30" suggestions. Covers src/domain/schedule.ts's nextFreeSlot (the
// shared candidate-slot scan autoSchedule already runs) and
// src/server/repo/overview.ts's pure suggestion/resolution builders.
import { describe, expect, it } from "vitest";
import { autoSchedule, findConflicts, nextFreeSlot, type PlacedSession } from "../src/domain/schedule";
import {
  buildConflictResolutionFor,
  buildPlacementSuggestion,
  pickLaterConflictEntry,
  type ConflictSessionInfo,
} from "../src/server/repo/overview";

const PARAMS = { dayStartMin: 540, dayEndMin: 1080, gridMin: 15, defaultDurationMin: 30 };

describe("nextFreeSlot (DEC-652)", () => {
  it("returns null when no rooms exist", () => {
    expect(
      nextFreeSlot({
        session: { durationMin: 30, speakerContactIds: [] },
        rooms: [],
        days: ["2026-08-10"],
        dayStartMin: 540,
        dayEndMin: 1080,
        gridMin: 15,
        existing: [],
      }),
    ).toBeNull();
  });

  it("returns the first open slot on an empty grid", () => {
    const result = nextFreeSlot({
      session: { durationMin: 30, speakerContactIds: [] },
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 1080,
      gridMin: 15,
      existing: [],
    });
    expect(result).toEqual({ day: "2026-08-10", startMin: 540, roomId: "room-a" });
  });

  it("skips a room occupancy conflict to find the next free grid slot in the same room", () => {
    const existing: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 630, speakerContactIds: [] },
    ];
    const result = nextFreeSlot({
      session: { durationMin: 60, speakerContactIds: [] },
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 1080,
      gridMin: 15,
      existing,
    });
    expect(result).toEqual({ day: "2026-08-10", startMin: 630, roomId: "room-a" });
  });

  it("respects speaker double-booking across rooms", () => {
    const existing: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 630, speakerContactIds: ["c1"] },
    ];
    // room-b is free the whole day, but c1 is booked 540-630 in room-a — a
    // session also carrying c1 must not land anywhere overlapping that.
    const result = nextFreeSlot({
      session: { durationMin: 30, speakerContactIds: ["c1"] },
      rooms: ["room-b"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 1080,
      gridMin: 15,
      existing,
    });
    expect(result).toEqual({ day: "2026-08-10", startMin: 630, roomId: "room-b" });
  });

  it("returns null when the duration can never fit in the day", () => {
    expect(
      nextFreeSlot({
        session: { durationMin: 600, speakerContactIds: [] },
        rooms: ["room-a"],
        days: ["2026-08-10"],
        dayStartMin: 540,
        dayEndMin: 1080,
        gridMin: 15,
        existing: [],
      }),
    ).toBeNull();
  });

  it("returns null when every room/day candidate is occupied", () => {
    const existing: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 1080, speakerContactIds: [] },
    ];
    expect(
      nextFreeSlot({
        session: { durationMin: 30, speakerContactIds: [] },
        rooms: ["room-a"],
        days: ["2026-08-10"],
        dayStartMin: 540,
        dayEndMin: 1080,
        gridMin: 15,
        existing,
      }),
    ).toBeNull();
  });

  // DEC-652: "one placement truth, no second placer" — nextFreeSlot's
  // answer for a session must be a slot autoSchedule itself would have
  // chosen for that same session against the same existing placements.
  it("agrees with autoSchedule's own placement for the same single session", () => {
    const existing: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 600, speakerContactIds: [] },
    ];
    const session = { submissionId: "s2", durationMin: 45, track: null, speakerContactIds: [] };

    const auto = autoSchedule({
      sessions: [session],
      rooms: ["room-a", "room-b"],
      days: ["2026-08-10", "2026-08-11"],
      dayStartMin: 540,
      dayEndMin: 1080,
      gridMin: 15,
      existing,
    });
    const viaAuto = auto.placed.find((p) => p.submissionId === "s2");
    expect(viaAuto).toBeDefined();

    const viaNextFree = nextFreeSlot({
      session: { durationMin: session.durationMin, speakerContactIds: session.speakerContactIds },
      rooms: ["room-a", "room-b"],
      days: ["2026-08-10", "2026-08-11"],
      dayStartMin: 540,
      dayEndMin: 1080,
      gridMin: 15,
      existing,
    });

    expect(viaNextFree).toEqual({ day: viaAuto!.day, startMin: viaAuto!.startMin, roomId: viaAuto!.roomId });
  });
});

describe("buildPlacementSuggestion (DEC-652 unplaced row)", () => {
  it("returns a concrete suggestion carrying a room name and label", () => {
    const placed: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 570, speakerContactIds: [] },
    ];
    const roomNameById = new Map([["room-a", "Room 2A"]]);
    const suggestion = buildPlacementSuggestion([], placed, ["room-a"], ["2026-08-10"], roomNameById, {
      ...PARAMS,
    });
    expect(suggestion).toEqual({
      day: "2026-08-10",
      startMin: 570,
      roomId: "room-a",
      roomName: "Room 2A",
      label: "Place at 9:30",
    });
  });

  it("avoids double-booking the submission's own lead speaker", () => {
    const placed: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 570, speakerContactIds: [] },
      { submissionId: "s2", roomId: "room-b", day: "2026-08-10", startMin: 570, endMin: 600, speakerContactIds: ["speaker-1"] },
    ];
    const roomNameById = new Map([
      ["room-a", "Room 2A"],
      ["room-b", "Room 2B"],
    ]);
    const suggestion = buildPlacementSuggestion(
      ["speaker-1"],
      placed,
      ["room-a", "room-b"],
      ["2026-08-10"],
      roomNameById,
      PARAMS,
    );
    // The scan tries startMin=540 first: room-a is occupied by s1 there,
    // but room-b is free at 540 and the lead speaker's own 570-600 booking
    // in room-b doesn't overlap a 540-570 candidate — so room-b at 540
    // wins over waiting for room-a to free up at 570.
    expect(suggestion).toEqual({
      day: "2026-08-10",
      startMin: 540,
      roomId: "room-b",
      roomName: "Room 2B",
      label: "Place at 9:00",
    });
  });

  it("is null when nextFreeSlot finds nothing (no rooms in use yet)", () => {
    expect(buildPlacementSuggestion([], [], [], [], new Map(), PARAMS)).toBeNull();
  });
});

describe("pickLaterConflictEntry (DEC-652)", () => {
  it("picks the strictly later startMin", () => {
    expect(pickLaterConflictEntry("a", 600, "b", 630)).toBe("b");
    expect(pickLaterConflictEntry("a", 630, "b", 600)).toBe("a");
  });

  it("breaks a startMin tie by picking the second (b) entry", () => {
    expect(pickLaterConflictEntry("a", 600, "b", 600)).toBe("b");
  });
});

describe("buildConflictResolutionFor (DEC-652 conflict row)", () => {
  it("moves the later of the clashing pair into the next free slot in the same room", () => {
    const placed: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-2a", day: "2026-08-10", startMin: 600, endMin: 660, speakerContactIds: ["c1"] },
      { submissionId: "s2", roomId: "room-2a", day: "2026-08-10", startMin: 630, endMin: 690, speakerContactIds: ["c2"] },
    ];
    const conflicts = findConflicts(placed);
    expect(conflicts).toHaveLength(1);

    const sessionById = new Map<string, ConflictSessionInfo>([
      ["s1", { day: "2026-08-10", startMin: 600, endMin: 660, roomId: "room-2a", ref: "DFC-014", title: "A", speakerName: "Priya" }],
      ["s2", { day: "2026-08-10", startMin: 630, endMin: 690, roomId: "room-2a", ref: "DFC-047", title: "B", speakerName: "Ruth" }],
    ]);
    const placedById = new Map(placed.map((p) => [p.submissionId, p]));
    const roomNameById = new Map([["room-2a", "Room 2A"]]);

    const resolution = buildConflictResolutionFor(
      conflicts[0]!,
      sessionById,
      placedById,
      placed,
      ["room-2a"],
      ["2026-08-10"],
      roomNameById,
      PARAMS,
    );

    // s2 (DFC-047) starts later (630 > 600) so it's the one that moves —
    // with s2 excluded, room-2a is free at the very start of the day
    // (540-600 doesn't overlap s1's 600-660), so that's the slot offered.
    expect(resolution).toEqual({
      submissionId: "s2",
      ref: "DFC-047",
      day: "2026-08-10",
      startMin: 540,
      roomId: "room-2a",
      roomName: "Room 2A",
      label: "Move DFC-047 to 9:00",
    });
  });

  it("is null when the room has no other free slot that day", () => {
    const placed: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-2a", day: "2026-08-10", startMin: 540, endMin: 1080, speakerContactIds: [] },
      { submissionId: "s2", roomId: "room-2a", day: "2026-08-10", startMin: 540, endMin: 1080, speakerContactIds: [] },
    ];
    const conflicts = findConflicts(placed);
    const sessionById = new Map<string, ConflictSessionInfo>([
      ["s1", { day: "2026-08-10", startMin: 540, endMin: 1080, roomId: "room-2a", ref: "DFC-001", title: "A", speakerName: "" }],
      ["s2", { day: "2026-08-10", startMin: 540, endMin: 1080, roomId: "room-2a", ref: "DFC-002", title: "B", speakerName: "" }],
    ]);
    const placedById = new Map(placed.map((p) => [p.submissionId, p]));
    const resolution = buildConflictResolutionFor(
      conflicts[0]!,
      sessionById,
      placedById,
      placed,
      ["room-2a"],
      ["2026-08-10"],
      new Map(),
      PARAMS,
    );
    expect(resolution).toBeNull();
  });

  it("fails loudly if a conflicting submission's placement is missing", () => {
    const placed: PlacedSession[] = [
      { submissionId: "s1", roomId: "room-2a", day: "2026-08-10", startMin: 540, endMin: 570, speakerContactIds: [] },
      { submissionId: "s2", roomId: "room-2a", day: "2026-08-10", startMin: 550, endMin: 580, speakerContactIds: [] },
    ];
    const conflicts = findConflicts(placed);
    const sessionById = new Map<string, ConflictSessionInfo>([
      ["s1", { day: "2026-08-10", startMin: 540, endMin: 570, roomId: "room-2a", ref: "DFC-001", title: "A", speakerName: "" }],
      ["s2", { day: "2026-08-10", startMin: 550, endMin: 580, roomId: "room-2a", ref: "DFC-002", title: "B", speakerName: "" }],
    ]);
    expect(() =>
      buildConflictResolutionFor(conflicts[0]!, sessionById, new Map(), placed, ["room-2a"], ["2026-08-10"], new Map(), PARAMS),
    ).toThrow(/placement missing/);
  });
});
