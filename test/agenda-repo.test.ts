import { describe, expect, it } from "vitest";
import {
  computeDays,
  DEFAULT_AUTO_SCHEDULE_PARAMS,
  isValidSlotInput,
} from "../src/server/repo/agenda";

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
