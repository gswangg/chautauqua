// DEC-510 (wave 46 amendment): src/domain/iso-date.ts is the ONE home for
// the YYYY-MM-DD grammar -- shape AND calendar-round-trip. This test pins
// the predicate's edge cases directly, independent of any route or repo
// caller.

import { describe, expect, it } from "vitest";
import { isIsoDate } from "../src/domain/iso-date";

describe("DEC-510: isIsoDate calendar-valid grammar", () => {
  it("rejects a calendar-invalid day-of-month (2027-02-30)", () => {
    expect(isIsoDate("2027-02-30")).toBe(false);
  });

  it("rejects a calendar-invalid month (2026-13-01)", () => {
    expect(isIsoDate("2026-13-01")).toBe(false);
  });

  it("rejects non-zero-padded components (2027-2-3)", () => {
    expect(isIsoDate("2027-2-3")).toBe(false);
  });

  it("rejects trailing whitespace (2027-02-30 )", () => {
    expect(isIsoDate("2027-02-30 ")).toBe(false);
    expect(isIsoDate("2027-01-02 ")).toBe(false);
  });

  it("rejects a value with a 1MB junk suffix", () => {
    const value = "2027-01-02" + "x".repeat(1024 * 1024);
    expect(isIsoDate(value)).toBe(false);
  });

  it("accepts a valid leap day (2028-02-29)", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects a leap day in a non-leap year (2027-02-29)", () => {
    expect(isIsoDate("2027-02-29")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isIsoDate(20270101)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
