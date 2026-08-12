import { describe, expect, it } from "vitest";
import {
  autoSchedule,
  describeUnplaced,
  type PlacedSession,
  type UnplacedLabels,
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

describe("autoSchedule unplaced reasons (DEC-615)", () => {
  it("reports 'no_rooms_configured' when the event has zero rooms", () => {
    const { placed, unplaced } = autoSchedule({
      sessions: [{ submissionId: "s1", durationMin: 30, track: null, speakerContactIds: [] }],
      rooms: [],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing: [],
    });
    expect(placed).toEqual([]);
    expect(unplaced).toEqual([{ submissionId: "s1", reason: "no_rooms_configured" }]);
  });

  it("reports 'duration_exceeds_day' when a session's duration exceeds the scheduling window", () => {
    const { placed, unplaced } = autoSchedule({
      sessions: [{ submissionId: "s1", durationMin: 9000, track: null, speakerContactIds: [] }],
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing: [],
    });
    expect(placed).toEqual([]);
    expect(unplaced).toEqual([{ submissionId: "s1", reason: "duration_exceeds_day" }]);
  });

  it("reports 'no_free_slot' when every room is occupied at every candidate time by a different speaker", () => {
    // Single 30-min grid slot in a single room, already fully occupied by
    // an unrelated speaker — s1 never even reaches a room-free candidate.
    const existing: PlacedSession[] = [
      session({ submissionId: "existing1", roomId: "room-a", startMin: 540, endMin: 720, speakerContactIds: ["other"] }),
    ];
    const { placed, unplaced } = autoSchedule({
      sessions: [{ submissionId: "s1", durationMin: 60, track: null, speakerContactIds: ["c1"] }],
      rooms: ["room-a"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing,
    });
    expect(placed.map((p) => p.submissionId)).not.toContain("s1");
    expect(unplaced).toEqual([{ submissionId: "s1", reason: "no_free_slot" }]);
  });

  it("reports 'speaker_double_booked' when a room is free but the speaker is booked at every candidate slot", () => {
    // c1 is booked in room-a for the ENTIRE window, but the only room s1
    // can be scheduled into is room-b, which stays free the whole day —
    // so the ONLY thing keeping s1 unplaced is its own speaker's calendar.
    const existing: PlacedSession[] = [
      session({ submissionId: "existing1", roomId: "room-a", startMin: 540, endMin: 720, speakerContactIds: ["c1"] }),
    ];
    const { placed, unplaced } = autoSchedule({
      sessions: [{ submissionId: "s1", durationMin: 60, track: null, speakerContactIds: ["c1"] }],
      rooms: ["room-b"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 720,
      gridMin: 15,
      existing,
    });
    expect(placed.map((p) => p.submissionId)).not.toContain("s1");
    expect(unplaced).toEqual([{ submissionId: "s1", reason: "speaker_double_booked" }]);
  });
});

describe("describeUnplaced (DEC-615: name the constraint, promise nothing)", () => {
  const labels: UnplacedLabels = {
    titleBySubmissionId: new Map([["s1", "Building Resilient Systems"]]),
    speakerNameByContactId: new Map(),
  };
  const session2 = { submissionId: "s1", durationMin: 45 };

  it("names the missing-rooms constraint", () => {
    const text = describeUnplaced("no_rooms_configured", labels, session2);
    expect(text).toContain("Building Resilient Systems");
    expect(text).toContain("no rooms are configured");
  });

  it("names the duration constraint including the session's duration", () => {
    const text = describeUnplaced("duration_exceeds_day", labels, session2);
    expect(text).toContain("45-minute");
    expect(text).toContain("exceeds the scheduling day");
  });

  it("names the no-free-slot constraint without advice", () => {
    const text = describeUnplaced("no_free_slot", labels, session2);
    expect(text).toContain("no free 45-minute slot in any room on any day");
    expect(text.toLowerCase()).not.toContain("try");
    expect(text.toLowerCase()).not.toContain("consider");
  });

  it("names the speaker-conflict constraint", () => {
    const text = describeUnplaced("speaker_double_booked", labels, session2);
    expect(text).toContain("speaker already booked elsewhere");
  });

  it("falls back to the raw submission id when the title is unresolved", () => {
    const text = describeUnplaced("no_rooms_configured", labels, { submissionId: "unknown-id", durationMin: 30 });
    expect(text).toContain("unknown-id");
  });
});
