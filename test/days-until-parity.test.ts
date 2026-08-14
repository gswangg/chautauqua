// DEC-918 amendment (wave 69): the server's daysUntilCalendarDay (src/lib/
// event-time.ts) is the twin of the SPA's ONE days-until reader (app/src/
// lib/dates.ts's daysUntil) -- both must answer the same question the same
// way for the same inputs, or the Overview/Settings strips (SPA) and the
// anonymous home hub (server, root.tsx) disagree about "N days left" for
// the identical deadline (the w40 finding this decision fixed in the first
// place). This file imports BOTH implementations and asserts parity across
// a shared case table.

import { describe, expect, it } from "vitest";
import { daysUntilCalendarDay } from "../src/lib/event-time";
import { daysUntil } from "../app/src/lib/dates";
import { dayLabelEndInstant } from "../src/lib/timezone";

describe("daysUntilCalendarDay / daysUntil parity (DEC-918)", () => {
  const TODAY_LABEL = Date.UTC(2027, 0, 1);
  const ZONE = "UTC";
  // "now" is the END of today's calendar day (the same anchor daysUntil's
  // own test suite uses) so a same-day close reads 0, not 1 -- both
  // implementations expand a day-label deadline through dayLabelEndInstant,
  // so an unexpanded midnight `now` would read one day short of true.
  const TODAY_END = dayLabelEndInstant(TODAY_LABEL, ZONE);

  it("same day: both read 0", () => {
    expect(daysUntilCalendarDay(TODAY_LABEL, ZONE, TODAY_END)).toBe(daysUntil(TODAY_LABEL, ZONE, TODAY_END));
    expect(daysUntilCalendarDay(TODAY_LABEL, ZONE, TODAY_END)).toBe(0);
  });

  it("+1 day", () => {
    const target = TODAY_LABEL + 1 * 86_400_000;
    expect(daysUntilCalendarDay(target, ZONE, TODAY_END)).toBe(daysUntil(target, ZONE, TODAY_END));
    expect(daysUntilCalendarDay(target, ZONE, TODAY_END)).toBe(1);
  });

  it("+18 days", () => {
    const target = TODAY_LABEL + 18 * 86_400_000;
    expect(daysUntilCalendarDay(target, ZONE, TODAY_END)).toBe(daysUntil(target, ZONE, TODAY_END));
    expect(daysUntilCalendarDay(target, ZONE, TODAY_END)).toBe(18);
  });

  it("already past: both clamp to 0, never negative", () => {
    const now = TODAY_END + 5 * 86_400_000;
    expect(daysUntilCalendarDay(TODAY_LABEL, ZONE, now)).toBe(daysUntil(TODAY_LABEL, ZONE, now));
    expect(daysUntilCalendarDay(TODAY_LABEL, ZONE, now)).toBe(0);
  });

  it("a non-UTC zone", () => {
    const zone = "Australia/Sydney";
    const now = dayLabelEndInstant(TODAY_LABEL, zone);
    const target = TODAY_LABEL + 7 * 86_400_000;
    expect(daysUntilCalendarDay(target, zone, now)).toBe(daysUntil(target, zone, now));
  });

  it("a date pair spanning a DST transition in America/Los_Angeles", () => {
    // US spring-forward: 2027-03-14. Deadline label a few days after the
    // transition, `now` a few days before -- the interval straddles it.
    const zone = "America/Los_Angeles";
    const nowLabel = Date.UTC(2027, 2, 10); // 10 Mar 2027
    const now = dayLabelEndInstant(nowLabel, zone);
    const target = Date.UTC(2027, 2, 18); // 18 Mar 2027
    expect(daysUntilCalendarDay(target, zone, now)).toBe(daysUntil(target, zone, now));
  });
});
