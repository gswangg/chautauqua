// Tests for formatEventDateTime (DEC-408, task-w8-e): public CFP dates
// render in the event's own IANA timezone, never bare UTC, and there is no
// silent fallback — an empty or invalid timeZone throws.
import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatEventDateTime,
  formatEventDateTimeWithSeconds,
  formatEventDayRange,
  formatEventCloseDateLabel,
  formatDayShort,
  formatDayLong,
  formatDayMedium,
} from "../src/lib/event-time";

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

// DEC-158 (wave 78): formatEventDateTime's seconds-carrying twin, for a
// surface rendering SUCCESSIVE STATES OF ONE OBJECT (e.g. the portal's
// VersionHistory, a task assignment's own file-version chain) where two
// states can land inside the same minute and must still render as
// distinguishable rows.
describe("formatEventDateTimeWithSeconds (DEC-158)", () => {
  it("keeps the zone abbreviation, same as formatEventDateTime", () => {
    const ms = Date.UTC(2027, 2, 1, 23, 59, 7);
    const formatted = formatEventDateTimeWithSeconds(ms, "America/Los_Angeles");
    expect(formatted).toContain("PST");
  });

  it("includes seconds in the time portion", () => {
    const ms = Date.UTC(2027, 2, 1, 23, 59, 7);
    const formatted = formatEventDateTimeWithSeconds(ms, "America/Los_Angeles");
    expect(formatted).toContain("15:59:07");
  });

  it("distinguishes two instants 30 seconds apart in the same minute", () => {
    const t1 = Date.UTC(2027, 2, 1, 12, 0, 0);
    const t2 = t1 + 30_000;
    const a = formatEventDateTimeWithSeconds(t1, "UTC");
    const b = formatEventDateTimeWithSeconds(t2, "UTC");
    expect(a).not.toBe(b);
    // formatEventDateTime, by contrast, collapses these to the same minute.
    expect(formatEventDateTime(t1, "UTC")).toBe(formatEventDateTime(t2, "UTC"));
  });

  it("throws on an empty timeZone (no UTC fallback)", () => {
    expect(() => formatEventDateTimeWithSeconds(Date.now(), "")).toThrow();
  });

  it("throws on an invalid timeZone (no UTC fallback)", () => {
    expect(() => formatEventDateTimeWithSeconds(Date.now(), "Not/AZone")).toThrow();
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
      expect([...results][0]).toBe("Mon 1 Mar 2027");
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("matches formatEventDate(ms, 'UTC') byte-for-byte (same shape, UTC-anchored)", () => {
    expect(formatCalendarDate(DAY_MS)).toBe("Mon 1 Mar 2027");
  });

  it("does not shift the day for a late-UTC label the way a Pacific-timezone re-interpretation would", () => {
    // 2027-03-02T00:00:00Z: under the old (buggy) formatEventDate(ms,
    // "America/Los_Angeles") path this would roll back to Mon, Mar 01 (PST).
    // formatCalendarDate must name Tue, Mar 02 — the same day the stored
    // label represents — because it never re-interprets into a timezone.
    const ms = Date.UTC(2027, 2, 2, 0, 0, 0);
    expect(formatCalendarDate(ms)).toBe("Tue 2 Mar 2027");
  });

  it("throws on a NaN input", () => {
    expect(() => formatCalendarDate(NaN)).toThrow();
  });

  it("throws on a non-finite input", () => {
    expect(() => formatCalendarDate(Infinity)).toThrow();
    expect(() => formatCalendarDate(-Infinity)).toThrow();
  });
});

describe("formatDayShort (w1-b): the day switcher's segmented-control label", () => {
  it("formats a 'YYYY-MM-DD' calendar day as a short weekday + day-of-month label", () => {
    expect(formatDayShort("2026-05-12")).toBe("Tue 12");
  });

  it("never re-interprets into a timezone (DEC-522: a calendar day, not an instant)", () => {
    // Same label regardless of any timezone the caller might be tempted to
    // pass in -- formatDayShort takes no timeZone parameter at all. A day
    // right at a DST transition (the kind that shifts under a naive
    // instant-based re-zoning) still reads its own calendar fields.
    expect(formatDayShort("2027-03-14")).toBe("Sun 14");
  });

  it("returns the original string unchanged for malformed input rather than throwing", () => {
    expect(formatDayShort("not-a-date")).toBe("not-a-date");
    expect(formatDayShort("")).toBe("");
  });
});

describe("formatDayLong (w1-b): the agenda page's own <h1> day label", () => {
  it("formats a 'YYYY-MM-DD' calendar day as a long weekday + day-of-month + month label", () => {
    expect(formatDayLong("2026-05-12")).toBe("Tuesday 12 May");
  });

  it("never re-interprets into a timezone (DEC-522: a calendar day, not an instant)", () => {
    expect(formatDayLong("2027-03-14")).toBe("Sunday 14 March");
  });

  it("returns the original string unchanged for malformed input rather than throwing", () => {
    expect(formatDayLong("not-a-date")).toBe("not-a-date");
    expect(formatDayLong("")).toBe("");
  });
});

describe("formatDayMedium (w13-d): the portal's ONE placement grammar day label", () => {
  it("formats a 'YYYY-MM-DD' calendar day as a short weekday + day-of-month + month label", () => {
    expect(formatDayMedium("2026-05-12")).toBe("Tue 12 May");
  });

  it("never re-interprets into a timezone (DEC-522: a calendar day, not an instant)", () => {
    expect(formatDayMedium("2027-03-14")).toBe("Sun 14 Mar");
  });

  it("returns the original string unchanged for malformed input rather than throwing", () => {
    expect(formatDayMedium("not-a-date")).toBe("not-a-date");
    expect(formatDayMedium("")).toBe("");
  });
});

// DEC-918: formatEventDayRange is the ONE server-side calendar-day RANGE
// grammar, shared by the public event header (shell.tsx) and the anonymous
// home hub (root.tsx) -- en-GB day-before-month order, month printed once
// when shared, both months when they differ, a single label when the two
// ends are the same day.
describe("formatEventDayRange (DEC-918)", () => {
  it("prints a single label when start === end", () => {
    const day = Date.UTC(2027, 4, 12); // 2027-05-12
    expect(formatEventDayRange(day, day)).toBe("12 May 2027");
  });

  it("prints the month once when both ends share a month", () => {
    const start = Date.UTC(2027, 4, 12); // 2027-05-12
    const end = Date.UTC(2027, 4, 14); // 2027-05-14
    expect(formatEventDayRange(start, end)).toBe("12–14 May 2027");
  });

  it("prints both months when the ends differ", () => {
    const start = Date.UTC(2027, 3, 28); // 2027-04-28
    const end = Date.UTC(2027, 4, 2); // 2027-05-02
    expect(formatEventDayRange(start, end)).toBe("28 Apr–2 May 2027");
  });

  it("never re-interprets into a timezone (UTC calendar fields only, DEC-522)", () => {
    const originalTz = process.env.TZ;
    try {
      const start = Date.UTC(2027, 4, 12);
      const end = Date.UTC(2027, 4, 14);
      const results = new Set<string>();
      for (const tz of ["America/Los_Angeles", "Asia/Tokyo", "UTC"]) {
        process.env.TZ = tz;
        results.add(formatEventDayRange(start, end));
      }
      expect(results.size).toBe(1);
    } finally {
      process.env.TZ = originalTz;
    }
  });
});

// DEC-408/DEC-918: the CFP close-date label renders in the event's own IANA
// timezone (a real instant), en-GB day-before-month order. Only the Intl
// formatting itself lives here -- uppercasing/"N days left" arithmetic stays
// with the caller (root.tsx's closesLine).
describe("formatEventCloseDateLabel (DEC-408, DEC-918)", () => {
  it("renders a weekday/day/month label in the given IANA timezone, en-GB order", () => {
    // 2027-05-12T23:59:00Z is still 2027-05-12 16:59 in America/Los_Angeles (PDT).
    const ms = Date.UTC(2027, 4, 12, 23, 59, 0);
    expect(formatEventCloseDateLabel(ms, "America/Los_Angeles")).toBe("Wed 12 May");
  });

  it("shifts the calendar day across a timezone boundary, unlike the day-label formatters", () => {
    // 2027-05-13T02:00:00Z is 2027-05-12 19:00 in America/Los_Angeles (PDT) --
    // a genuine instant, so it renders on the PREVIOUS calendar day locally.
    const ms = Date.UTC(2027, 4, 13, 2, 0, 0);
    expect(formatEventCloseDateLabel(ms, "America/Los_Angeles")).toBe("Wed 12 May");
    expect(formatEventCloseDateLabel(ms, "UTC")).toBe("Thu 13 May");
  });
});
