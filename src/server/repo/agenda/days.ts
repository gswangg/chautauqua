// Day-range helpers shared by the agenda payload, window-narrowing, and
// auto-schedule defaults (DEC-277: slot writes and payload classification
// must agree on the inclusive [startDate, endDate] boundary).

import { gt, lt, or } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { isIsoDate } from "../../../domain/iso-date";

// DEC-277 (wave 60 amendment): computeDays moved to pure core as
// src/domain/event-days.ts's eventDays -- the ONE owner of the event's
// calendar-day list, shared by this repo layer AND both public surfaces.
// Callers re-point there directly; no compatibility re-export here.

/** The ONE day-shape gate for request bodies: a zero-padded, calendar-valid
 * ISO `YYYY-MM-DD`, and nothing else. isDayWithinEventRange below compares
 * LEXICALLY, so it accepts any string that sorts between the two bounds --
 * `"2027-01-02" + 1MB of junk` sorts inside a multi-day event and would
 * reach the DB (the DEC-417 SQLITE_TOOBIG class). Pinning the shape here
 * bounds the value at exactly 10 chars for every caller. Used by
 * isValidSlotInput (./slots) and by src/routes/api/breaks.ts (DEC-022
 * amendment) -- never re-spelled per route. DEC-510 (wave 46 amendment):
 * delegates entirely to src/domain/iso-date.ts's isIsoDate -- ONE grammar
 * for the value, shared with event.startDate/endDate, so a calendar-invalid
 * day like '2027-02-30' is refused here exactly as it is at the event
 * boundary, instead of merely being shape-matched and persisted. */
export function isIsoDay(value: unknown): value is string {
  return isIsoDate(value);
}

/** True iff `day` (YYYY-MM-DD) falls within [startDate, endDate] inclusive,
 * using lexical string comparison (safe for zero-padded ISO dates). DEC-277:
 * slot writes and payload classification must agree on this boundary.
 * Callers must have already shape-gated `day` through isIsoDay. */
export function isDayWithinEventRange(day: string, startDate: string, endDate: string): boolean {
  return day >= startDate && day <= endDate;
}

/** SQL twin of isDayWithinEventRange's negation: true iff schedule_slot.day
 * falls OUTSIDE [startDate, endDate] inclusive. Same lexical ISO-day
 * comparison, expressed as a WHERE condition so listSlotsOutsideWindow can
 * COUNT and LIMIT in SQL instead of scanning every row into JS (DEC-844). */
export function dayOutsideEventRangeCondition(startDate: string, endDate: string) {
  return or(lt(schema.scheduleSlot.day, startDate), gt(schema.scheduleSlot.day, endDate));
}

export const DEFAULT_AUTO_SCHEDULE_PARAMS = {
  dayStartMin: 540,
  dayEndMin: 1080,
  defaultDurationMin: 30,
  gridMin: 15,
} as const;
