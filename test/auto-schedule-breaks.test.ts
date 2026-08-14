// DEC-010 amendment (wave 66): the automatic placer must never place a
// session inside an organizer-defined break window (lunch, coffee), and
// nextFreeSlot (the ONE candidate scan §04 suggestions reuse) must never
// name one either. See src/domain/schedule.ts's blocked/BlockedInterval
// threading.
import { describe, expect, it } from "vitest";
import {
  autoSchedule,
  nextFreeSlot,
  type AutoScheduleInput,
  type BlockedInterval,
  type NextFreeSlotInput,
} from "../src/domain/schedule";

describe("autoSchedule with blocked intervals", () => {
  const baseInput: AutoScheduleInput = {
    sessions: [{ submissionId: "s1", durationMin: 60, track: null, speakerContactIds: [] }],
    rooms: ["room-a"],
    days: ["2026-08-10"],
    dayStartMin: 540, // 09:00
    dayEndMin: 900, // 15:00
    gridMin: 15,
    existing: [],
  };

  it("skips a 12:00-13:00 blocked window and places after it", () => {
    const blocked: BlockedInterval[] = [{ day: "2026-08-10", startMin: 720, endMin: 780 }];
    // Fill every room-minute from 09:00 up to the break (720) so the ONLY
    // room left free for a 60-minute session is right after the break.
    const existing = [
      {
        submissionId: "filler",
        roomId: "room-a",
        day: "2026-08-10",
        startMin: 540,
        endMin: 720,
        speakerContactIds: [],
      },
    ];
    const { placed, unplaced } = autoSchedule({ ...baseInput, existing, blocked });
    expect(unplaced).toEqual([]);
    expect(placed).toHaveLength(2);
    const s1 = placed.find((p) => p.submissionId === "s1");
    expect(s1?.startMin).toBe(780); // 13:00, right after the break ends
    expect(s1?.endMin).toBe(840);
  });

  it("with blocked: [] the placements are identical to today (regression guard)", () => {
    const withoutBlocked = autoSchedule({ ...baseInput, existing: [] });
    const withEmptyBlocked = autoSchedule({ ...baseInput, existing: [], blocked: [] });
    expect(withEmptyBlocked).toEqual(withoutBlocked);
  });

  it("does not set blocked as a room-availability fact — reports the pre-existing no_free_slot reason when nothing fits", () => {
    // The whole day is one 360-minute window; a break covering all of it
    // leaves genuinely nothing available anywhere.
    const blocked: BlockedInterval[] = [{ day: "2026-08-10", startMin: 540, endMin: 900 }];
    const { placed, unplaced } = autoSchedule({ ...baseInput, blocked });
    expect(placed).toEqual([]);
    expect(unplaced).toEqual([{ submissionId: "s1", reason: "no_free_slot" }]);
  });

  it("a break on day A does not block day B", () => {
    const twoDayInput: AutoScheduleInput = {
      ...baseInput,
      days: ["2026-08-10", "2026-08-11"],
    };
    const blocked: BlockedInterval[] = [{ day: "2026-08-10", startMin: 540, endMin: 900 }];
    const { placed, unplaced } = autoSchedule({ ...twoDayInput, blocked });
    expect(unplaced).toEqual([]);
    expect(placed).toHaveLength(1);
    expect(placed[0]?.day).toBe("2026-08-11");
  });
});

describe("nextFreeSlot with blocked intervals", () => {
  const baseInput: NextFreeSlotInput = {
    session: { durationMin: 60, speakerContactIds: [] },
    rooms: ["room-a"],
    days: ["2026-08-10"],
    dayStartMin: 540,
    dayEndMin: 900,
    gridMin: 15,
    existing: [],
  };

  it("returns a post-break slot", () => {
    const blocked: BlockedInterval[] = [{ day: "2026-08-10", startMin: 720, endMin: 780 }];
    const existing = [
      {
        submissionId: "filler",
        roomId: "room-a",
        day: "2026-08-10",
        startMin: 540,
        endMin: 720,
        speakerContactIds: [],
      },
    ];
    const slot = nextFreeSlot({ ...baseInput, existing, blocked });
    expect(slot).toEqual({ day: "2026-08-10", startMin: 780, roomId: "room-a" });
  });

  it("with blocked: [] the placement is identical to today (regression guard)", () => {
    expect(nextFreeSlot({ ...baseInput })).toEqual(nextFreeSlot({ ...baseInput, blocked: [] }));
  });

  it("a break on day A does not block day B", () => {
    const twoDayInput: NextFreeSlotInput = { ...baseInput, days: ["2026-08-10", "2026-08-11"] };
    const blocked: BlockedInterval[] = [{ day: "2026-08-10", startMin: 540, endMin: 900 }];
    const slot = nextFreeSlot({ ...twoDayInput, blocked });
    expect(slot?.day).toBe("2026-08-11");
  });
});
