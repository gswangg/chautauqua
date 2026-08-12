// Tests for formatEventDateTime (DEC-408, task-w8-e): public CFP dates
// render in the event's own IANA timezone, never bare UTC, and there is no
// silent fallback — an empty or invalid timeZone throws.
import { describe, expect, it } from "vitest";
import { formatEventDateTime } from "../src/lib/event-time";

describe("formatEventDateTime (DEC-408)", () => {
  it("renders a March instant in America/Los_Angeles as PST with the right wall-clock hour", () => {
    // 2027-03-01T23:59:00Z is before the US spring-forward transition
    // (2027-03-14), so Los Angeles is still on PST (UTC-8): wall clock
    // 15:59 (3:59 PM).
    const ms = Date.UTC(2027, 2, 1, 23, 59, 0);
    const formatted = formatEventDateTime(ms, "America/Los_Angeles");
    expect(formatted).toContain("PST");
    expect(formatted).toContain("15:59");
  });

  it("renders a November instant in America/Los_Angeles as PDT/PST correctly with the right wall-clock hour", () => {
    // 2027-11-01T06:59:00Z is after the US fall daylight period starts but
    // before the fall-back transition (2027-11-07), so Los Angeles is still
    // on PDT (UTC-7): wall clock 23:59 (11:59 PM) on 2027-10-31.
    const ms = Date.UTC(2027, 10, 1, 6, 59, 0);
    const formatted = formatEventDateTime(ms, "America/Los_Angeles");
    expect(formatted).toContain("PDT");
    expect(formatted).toContain("23:59");
  });

  it("renders a non-US zone (Europe/Berlin) correctly", () => {
    // 2027-06-15T10:00:00Z: Berlin is on CEST (UTC+2) in June, wall clock
    // 12:00.
    const ms = Date.UTC(2027, 5, 15, 10, 0, 0);
    const formatted = formatEventDateTime(ms, "Europe/Berlin");
    expect(formatted).toContain("GMT+2");
    expect(formatted).toContain("12:00");
  });

  it("throws on an empty timeZone (no UTC fallback)", () => {
    expect(() => formatEventDateTime(Date.now(), "")).toThrow();
  });

  it("throws on an invalid timeZone (no UTC fallback)", () => {
    expect(() => formatEventDateTime(Date.now(), "Not/AZone")).toThrow();
  });
});
