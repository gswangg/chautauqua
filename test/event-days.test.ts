// DEC-277 (wave 60 amendment): src/domain/event-days.ts's eventDays is the
// ONE owner of "which calendar days does this event span?" -- pure core,
// inclusive, fail-loud on a malformed or reversed range.

import { describe, expect, it } from "vitest";
import { eventDays } from "../src/domain/event-days";

describe("eventDays (DEC-277 wave 60 amendment)", () => {
  it("a single-day event returns exactly that one day", () => {
    expect(eventDays("2026-08-10", "2026-08-10")).toEqual(["2026-08-10"]);
  });

  it("a three-day event returns all three inclusive days in order", () => {
    expect(eventDays("2026-08-10", "2026-08-12")).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });

  it("throws on a malformed date", () => {
    expect(() => eventDays("not-a-date", "2026-08-12")).toThrow();
    expect(() => eventDays("2026-08-10", "not-a-date")).toThrow();
  });

  it("throws on a reversed range (endDate before startDate)", () => {
    expect(() => eventDays("2026-08-12", "2026-08-10")).toThrow();
  });
});
