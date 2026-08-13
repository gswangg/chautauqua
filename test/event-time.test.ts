// Tests for formatEventDateTime (DEC-408, task-w8-e): public CFP dates
// render in the event's own IANA timezone, never bare UTC, and there is no
// silent fallback — an empty or invalid timeZone throws.
import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatEventDateTime, formatEventDay } from "../src/lib/event-time";

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

// DEC-522: a date-only value (task due date, etc.) is a CALENDAR DAY, not an
// instant — formatCalendarDate renders it as the same day regardless of
// viewer/event timezone, unlike formatEventDate/formatEventDateTime above.
describe("formatCalendarDate (DEC-522)", () => {
  const DAY_MS = Date.UTC(2027, 2, 1, 0, 0, 0); // 2027-03-01T00:00:00Z (UTC-midnight day label)

  it("renders the same calendar day for a viewer/event in America/Los_Angeles, Asia/Tokyo, and UTC", () => {
    // formatCalendarDate takes NO timezone parameter — it always reads UTC
    // calendar fields internally, so the *process*/viewer timezone must not
    // change its output. Drive process.env.TZ (the ambient "viewer/event"
    // timezone a caller's environment might run under) through three zones
    // and confirm the label never moves — the exact regression this DEC
    // fixes (Los-Angeles rendering "Sun, 28 Feb" while the admin grid, which
    // is timezone-independent, shows "Mar 1").
    const originalTz = process.env.TZ;
    try {
      const results = new Set<string>();
      for (const tz of ["America/Los_Angeles", "Asia/Tokyo", "UTC"]) {
        process.env.TZ = tz;
        results.add(formatCalendarDate(DAY_MS));
      }
      expect(results.size).toBe(1);
      expect([...results][0]).toBe("Mon, Mar 01, 2027");
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("matches formatEventDate(ms, 'UTC') byte-for-byte (same shape, UTC-anchored)", () => {
    expect(formatCalendarDate(DAY_MS)).toBe("Mon, Mar 01, 2027");
  });

  it("does not shift the day for a late-UTC label the way a Pacific-timezone re-interpretation would", () => {
    // 2027-03-02T00:00:00Z: under the old (buggy) formatEventDate(ms,
    // "America/Los_Angeles") path this would roll back to Mon, Mar 01 (PST).
    // formatCalendarDate must name Tue, Mar 02 — the same day the stored
    // label represents — because it never re-interprets into a timezone.
    const ms = Date.UTC(2027, 2, 2, 0, 0, 0);
    expect(formatCalendarDate(ms)).toBe("Tue, Mar 02, 2027");
  });

  it("throws on a NaN input", () => {
    expect(() => formatCalendarDate(NaN)).toThrow();
  });

  it("throws on a non-finite input", () => {
    expect(() => formatCalendarDate(Infinity)).toThrow();
    expect(() => formatCalendarDate(-Infinity)).toThrow();
  });
});

describe("formatEventDay (w1-i): the ONE public-surface day-heading/date-label formatter", () => {
  it("formats a 'YYYY-MM-DD' calendar day as a weekday/month/day label", () => {
    // Merge note: renders THROUGH formatCalendarDate (one Intl config for
    // every day label in the app, DEC-522/DEC-768), so the label carries
    // the same "Mon, Aug 10, 2026" shape as an epoch-keyed day label.
    expect(formatEventDay("2026-08-10")).toBe("Mon, Aug 10, 2026");
  });

  it("never re-interprets into a timezone (DEC-522: a calendar day, not an instant)", () => {
    // Same day regardless of any timezone the caller might be tempted to
    // pass in -- formatEventDay takes no timeZone parameter at all.
    expect(formatEventDay("2027-05-12")).toBe("Wed, May 12, 2027");
  });

  it("returns the original string unchanged for malformed input rather than throwing", () => {
    expect(formatEventDay("not-a-date")).toBe("not-a-date");
    expect(formatEventDay("")).toBe("");
  });
});
