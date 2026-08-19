// Pure date-formatting helper (DEC-002: Web APIs only, no node:/cloudflare
// import) — same purity rule as src/lib/timezone.ts. DEC-408: public CFP
// surfaces render dates in the event's own IANA timezone, never a bare UTC
// string — a UTC-labelled deadline is silently wrong for every speaker not
// in UTC. No fallback: an empty or invalid timeZone throws (fail loudly)
// rather than silently rendering in UTC.

import { zonedMinutesToUtc, dayLabelEndInstant } from "./timezone";

/** Builds "Weekday D Mon YYYY" (en-GB day-before-month order, no comma
 * between the parts, DEC-918: one customer-facing date grammar) from a
 * date-parts-only Intl.DateTimeFormat's formatToParts output. Internal to
 * formatEventDateTime/formatEventDate below. */
function joinDateParts(parts: Intl.DateTimeFormatPart[]): string {
  const byType: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") byType[part.type] = part.value;
  return `${byType.weekday} ${byType.day} ${byType.month} ${byType.year}`;
}

/** Formats a UTC instant (epoch ms) as a human-readable string in the given
 * IANA timeZone, e.g. "Sun 1 Mar 2027, 23:59 PST" (DEC-918: en-GB
 * day-before-month date order, no comma between weekday/day/month/year,
 * comma before the 24h time, zone abbreviation kept per DEC-408 — a deadline
 * without its zone is wrong for every speaker outside it). Throws if
 * `timeZone` is empty or not a valid IANA zone identifier — there is no UTC
 * fallback (DEC-408). */
export function formatEventDateTime(ms: number, timeZone: string): string {
  if (!timeZone) {
    throw new Error("formatEventDateTime: timeZone must not be empty");
  }
  let dateFormatter: Intl.DateTimeFormat;
  let timeFormatter: Intl.DateTimeFormat;
  try {
    dateFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  } catch (err) {
    throw new Error(`formatEventDateTime: invalid timeZone '${timeZone}': ${(err as Error).message}`);
  }
  const date = new Date(ms);
  const datePart = joinDateParts(dateFormatter.formatToParts(date));
  const timeParts: Record<string, string> = {};
  for (const part of timeFormatter.formatToParts(date)) if (part.type !== "literal") timeParts[part.type] = part.value;
  return `${datePart}, ${timeParts.hour}:${timeParts.minute} ${timeParts.timeZoneName}`;
}

/** DEC-158 (wave 78): the SSR twin of app/src/lib/dates.ts's
 * formatDateTimeWithSeconds -- same rule, not an example: use for a surface
 * rendering SUCCESSIVE STATES OF ONE OBJECT (a single object's own version/
 * edit-history rows), where two states can land inside the same minute and
 * must still render as distinguishable rows -- never for a list of
 * DIFFERENT objects, where formatEventDateTime's minute granularity stays
 * the rule. Current reader: the portal's VersionHistory
 * (src/routes/portal/tasks/views.tsx), for a task assignment's own
 * file-version chain. e.g. "Sun 1 Mar 2027, 23:59:07 PST" (same en-GB
 * day-before-month order, no comma between weekday/day/month/year, comma
 * before the 24h time, zone abbreviation kept, DEC-408/DEC-918 -- differs
 * from formatEventDateTime only by the added seconds field). Throws if
 * `timeZone` is empty or not a valid IANA zone identifier -- there is no UTC
 * fallback (DEC-408), same contract as formatEventDateTime. */
export function formatEventDateTimeWithSeconds(ms: number, timeZone: string): string {
  if (!timeZone) {
    throw new Error("formatEventDateTimeWithSeconds: timeZone must not be empty");
  }
  let dateFormatter: Intl.DateTimeFormat;
  let timeFormatter: Intl.DateTimeFormat;
  try {
    dateFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  } catch (err) {
    throw new Error(`formatEventDateTimeWithSeconds: invalid timeZone '${timeZone}': ${(err as Error).message}`);
  }
  const date = new Date(ms);
  const datePart = joinDateParts(dateFormatter.formatToParts(date));
  const timeParts: Record<string, string> = {};
  for (const part of timeFormatter.formatToParts(date)) if (part.type !== "literal") timeParts[part.type] = part.value;
  return `${datePart}, ${timeParts.hour}:${timeParts.minute}:${timeParts.second} ${timeParts.timeZoneName}`;
}

/** Formats a UTC instant (epoch ms) as a date-only string (no time-of-day)
 * in the given IANA timeZone, e.g. "Tue 2 Mar 2027" (DEC-918: en-GB
 * day-before-month order, no comma) — DEC-413: the speaker portal renders
 * every date in the owning event's timezone, not UTC. Throws if `timeZone`
 * is empty or not a valid IANA zone identifier — there is no UTC fallback,
 * same contract as formatEventDateTime (DEC-408). */
export function formatEventDate(ms: number, timeZone: string): string {
  if (!timeZone) {
    throw new Error("formatEventDate: timeZone must not be empty");
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch (err) {
    throw new Error(`formatEventDate: invalid timeZone '${timeZone}': ${(err as Error).message}`);
  }
  return joinDateParts(formatter.formatToParts(new Date(ms)));
}

/** Formats a UTC-midnight day label (epoch ms) as a date-only string, e.g.
 * "Sun 1 Mar 2027" (DEC-918: en-GB day-before-month order, no comma between
 * weekday/day/month/year — same customer-facing grammar as
 * formatEventDate/formatEventDateTime) — DEC-522: a date-only value (task
 * due date, etc.) is a CALENDAR DAY, not an instant. It must render as the
 * same day everywhere, regardless of viewer or event timezone, so this
 * takes NO timezone parameter and always reads the UTC calendar fields of
 * `ms` (the value is expected to already be UTC-midnight for that day). Use
 * this ONLY for day labels. True instants (createdAt, sentAt, submittedAt,
 * uploadedAt) must keep using formatEventDate/formatEventDateTime, which
 * render in the owning event's IANA timezone. Throws on a NaN/non-finite
 * `ms`, matching the fail-loudly contract of its neighbours above. */
export function formatCalendarDate(ms: number): string {
  if (!Number.isFinite(ms)) {
    throw new Error("formatCalendarDate: ms must be a finite number");
  }
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return joinDateParts(formatter.formatToParts(new Date(ms)));
}

/** Short day label for the agenda day-switcher's segmented control, e.g.
 * "Tue 12" — same "calendar day, not an instant" contract (DEC-522) as
 * formatCalendarDate above: `day` is already the wall-clock 'YYYY-MM-DD'
 * field in the owning event's own timezone (DEC-010), so this takes NO
 * timeZone parameter and reads UTC calendar fields directly, never re-zoned.
 * en-GB gives the weekday-before-day-of-month order the design handoff
 * wants ("Tue 12") without a locale-format hand-assembly step. Malformed
 * input returns the original string unchanged, matching this file's
 * fail-soft contract for organizer-entered scheduling data. */
export function formatDayShort(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
  });
}

/** Long twin of formatDayShort, for the agenda page's own <h1> heading, e.g.
 * "Tuesday 12 May" (DEC-768: the day appears exactly once on the page, in
 * full). Same no-timeZone-parameter / UTC-calendar-fields / fail-soft
 * contract as formatDayShort. */
export function formatDayLong(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Medium day label for placement/schedule sublines, e.g. "Tue 12 May" —
 * same "calendar day, not an instant" contract (DEC-522) as formatDayShort/
 * formatDayLong above: `day` is already the wall-clock 'YYYY-MM-DD' field in
 * the owning event's own timezone (DEC-010), so this takes NO timeZone
 * parameter and reads UTC calendar fields directly, never re-zoned. en-GB
 * gives the weekday-day-month order the design handoff wants ("Tue 12 May").
 * Malformed input returns the original string unchanged, matching this
 * file's fail-soft contract for organizer-entered scheduling data. */
export function formatDayMedium(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Day-of-month + month label (UTC calendar fields, DEC-522: startDate/
 * endDate are DAY LABELS, not instants — never rendered in any timezone but
 * UTC). en-GB gives British day-before-month order with no comma, e.g.
 * "12 May" / "12 May 2027". Internal to formatEventDayRange below. */
function dayMonthLabel(ms: number, withYear: boolean): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** Day-of-month only, no month/year (for the "12" in "12-14 May 2027" when
 * both ends share a month — the month is printed exactly once). Internal to
 * formatEventDayRange below. */
function dayOnlyLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });
}

/** THE single server-side calendar-day RANGE grammar (DEC-918): every
 * customer-facing surface that renders a startDate-endDate span (the public
 * event header, the anonymous home hub) routes through this one function.
 * British day-before-month order, no comma: a single label when the two
 * ends are the same day ("12 May 2027"), the month printed once when both
 * ends share it ("12-14 May 2027"), both months when they differ ("28
 * Apr-2 May 2027"). Takes UTC-midnight epoch ms for both ends, matching the
 * DEC-522 "calendar day, not an instant" contract of formatCalendarDate
 * above — never re-zoned, always read from UTC calendar fields. */
export function formatEventDayRange(startMs: number, endMs: number): string {
  if (startMs === endMs) return dayMonthLabel(startMs, true);
  const startDate = new Date(startMs);
  const endDate = new Date(endMs);
  const sameMonth = startDate.getUTCFullYear() === endDate.getUTCFullYear() && startDate.getUTCMonth() === endDate.getUTCMonth();
  if (sameMonth) return `${dayOnlyLabel(startMs)}–${dayMonthLabel(endMs, true)}`;
  return `${dayMonthLabel(startMs, false)}–${dayMonthLabel(endMs, true)}`;
}

/** CFP close date label (weekday + day + month, en-GB day-before-month
 * order, no comma), rendered in the event's own IANA timezone (DEC-408: a
 * real instant, never UTC-bare), e.g. "Sun 12 May". `closeDayLabelMs` is a
 * DEC-522 UTC-midnight DAY LABEL, not an instant — enforced upstream by
 * isDayLabelMs (src/routes/api/validators.ts) — so it is expanded through
 * dayLabelEndInstant before formatting; formatting the raw UTC-midnight
 * value directly would resolve to the previous calendar day in every
 * timezone west of UTC. This mirrors daysUntilCalendarDay below, which
 * expands the same label the same way, so the printed date and the "N days
 * left" count always name the same day. Callers own the uppercasing and
 * "N days left" arithmetic (root.tsx's closesLine) — only the Intl
 * formatting itself lives here, per DEC-918. */
export function formatEventCloseDateLabel(closeDayLabelMs: number, timeZone: string): string {
  const endInstant = dayLabelEndInstant(closeDayLabelMs, timeZone);
  return new Date(endInstant).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
}

/** DEC-918 amendment (wave 69): the server-side twin of the SPA's ONE
 * days-until reader (app/src/lib/dates.ts's `daysUntil`) -- calendar-day
 * difference between `targetMs` and `nowMs`, both read as calendar dates in
 * `timeZone`, with `targetMs` expanded through the END of its calendar day
 * (dayLabelEndInstant) so a deadline reads N until the stroke of midnight
 * closes it, not N-1 partway through its own last day. Clamped to zero: a
 * past-due/closing-today deadline reads 0, never negative. Throws on an
 * empty timeZone, matching the fail-loudly contract of its neighbours above.
 */
export function daysUntilCalendarDay(targetMs: number, timeZone: string, nowMs: number): number {
  if (!timeZone) {
    throw new Error("daysUntilCalendarDay: timeZone must not be empty");
  }
  const end = dayLabelEndInstant(targetMs, timeZone);
  return Math.max(0, Math.ceil((end - nowMs) / 86_400_000));
}

/** Extracts the calendar year from an event's `startDate` field (DEC-010/
 * DEC-522: already a wall-clock 'YYYY-MM-DD' day label in the owning
 * event's own timezone -- never re-zoned, never read via toISOString or the
 * server's local clock). Used by the speaker rail's "N submissions this
 * year"/"spoke in YYYY" history line (DEC-900) to bucket submissions by
 * their OWNING EVENT's year. Throws on a malformed startDate rather than
 * silently returning NaN, matching this module's fail-loudly contract. */
export function eventYear(startDate: string): number {
  const year = Number(startDate.slice(0, 4));
  if (!Number.isInteger(year) || year < 1000) {
    throw new Error(`eventYear: invalid startDate '${startDate}'`);
  }
  return year;
}

/** Names a schedule_slot's wall-clock placement (DEC-010: `day` +
 * `startMin` are already the wall-clock fields in the owning event's own
 * timezone) as "Wed 12, 10:00" — weekday + day-of-month, 24h HH:MM — for use
 * in delete-refusal messages (DEC-931) that must name which slot is
 * blocking, never a bare id. Takes the real instant via `zonedMinutesToUtc`
 * so the weekday/day-of-month are DST-correct, then renders both pieces
 * back through the OWNING EVENT's timeZone (never the server's local zone).
 * Throws if `timeZone` is empty, matching the fail-loudly contract of its
 * neighbours above. */
export function formatScheduleSlotLabel(day: string, startMin: number, timeZone: string): string {
  if (!timeZone) {
    throw new Error("formatScheduleSlotLabel: timeZone must not be empty");
  }
  const instant = zonedMinutesToUtc(day, startMin, timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const partMap: Record<string, string> = {};
  for (const part of parts) partMap[part.type] = part.value;
  return `${partMap.weekday} ${partMap.day}, ${partMap.hour}:${partMap.minute}`;
}
