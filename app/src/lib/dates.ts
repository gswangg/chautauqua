// DEC-146: null-safe date helpers for app pages. Pages must never call
// new Date(x).toISOString()/toLocale* directly on a nullable/unvalidated
// value -- go through these helpers so a null/undefined/NaN timestamp
// renders as an empty input or em dash instead of crashing the SPA with
// "Invalid time value".
//
// DEC-153: ALL date-only fields (task due dates, plan open/close windows,
// and any other calendar-date-only value stored as a UTC-midnight epoch-ms)
// MUST be displayed via formatDateOnly, which reads the date in the UTC
// timezone so the entered calendar date renders identically in every
// browser timezone. toLocaleDateString/formatDate is BANNED for
// calendar-date values -- it re-interprets the UTC-midnight instant in the
// viewer's local timezone and can render the wrong day (off-by-one bug).
// formatDate remains for true instants (createdAt, sentAt, etc.) where
// local-timezone display is correct.

import { countOf } from './plural';
import { dayLabelEndInstant } from '../../../src/lib/timezone';
// daysUntil/daysAgo/epochDayIndex are the ONE days-until/days-ago/day-index
// readers per DEC-831 (wave 40 + wave 54 amendment) -- compile-checked
// dependency on the decision.
import { DEC_831 } from '../../../src/decisions';
void DEC_831;

/** Convert an epoch-ms timestamp to a yyyy-mm-dd string for DateField/date-input wire values. */
export function msToDateInput(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/**
 * Convert a yyyy-mm-dd DateField/date-input wire value to epoch-ms.
 * '' -> null. Anything non-empty that fails to parse throws so the form
 * can surface a field error (fail loudly, per house invariant).
 */
export function dateInputToMs(value: string): number | null {
  if (value === '') return null;
  const ms = new Date(`${value}T00:00:00.000Z`).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date value: "${value}"`);
  }
  return ms;
}

/**
 * Convert an ISO-8601 instant string (e.g. an API's `retryAtIso`) to epoch-ms.
 * DEC-524: lib/dates.ts is the ONE home for date <-> epoch conversion, so
 * pages must call this instead of hand-rolling `new Date(iso).getTime()`.
 * Null/undefined/unparseable input returns null, which every formatter here
 * already renders as '—' rather than crashing on "Invalid time value".
 */
export function isoToMs(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined || iso === '') return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Format an epoch-ms timestamp for display as "<D> <Mon>" (no leading zero,
 * three-letter month), e.g. "19 Feb". Appends " <YYYY>" only when the date
 * falls outside the current calendar year. '—' for null/undefined/NaN/invalid.
 * The ONE date grammar in the SPA (DEC-907) -- never toLocaleDateString.
 */
export function formatDate(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = SHORT_MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  return year === currentYear ? `${day} ${month}` : `${day} ${month} ${year}`;
}

/**
 * Format a UTC-midnight epoch-ms calendar-date value as "16 Aug 2026"; '—'
 * for null/undefined/NaN/invalid. Reads the timestamp in the UTC timezone
 * (DEC-153) so the entered calendar date renders identically in every
 * browser timezone. The day/short-month/year order is built by hand (never
 * Intl, never toLocaleDateString) so the output is byte-identical
 * regardless of the runtime's default locale (DEC-963).
 */
export function formatDateOnly(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getUTCDate()} ${SHORT_MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Format an epoch-ms timestamp as "<D> <Mon>, HH:MM" (24-hour) for display;
 * '—' for null/undefined/NaN/invalid. Use for LISTS OF DIFFERENT OBJECTS
 * (createdAt, updatedAt, sentAt, uploadedAt, etc. across distinct rows --
 * FilesLibrary, RecentSends, ApiTokensPanel, ContactDrawer), rendered in the
 * viewer's local timezone. DEC-545/DEC-907: this is the ONE date-time
 * formatter in the SPA -- pages must never call toLocaleString directly.
 * DEC-158: a surface rendering SUCCESSIVE STATES OF ONE OBJECT (a single
 * object's own version/edit history, where two states can land in the same
 * minute and must still read as distinguishable rows) must use
 * formatDateTimeWithSeconds below instead.
 */
export function formatDateTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = SHORT_MONTH_NAMES[date.getMonth()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hh}:${mm}`;
}

/**
 * w59-f (DEC-158 amendment, whole population closed wave 78):
 * formatDateTime's seconds-carrying twin -- "<D> <Mon>, HH:MM:SS" (24-hour)
 * -- for the RULE, not an example: a surface renders SUCCESSIVE STATES OF
 * ONE OBJECT (an object's own version/edit-history rows, as opposed to a
 * list of DIFFERENT objects) where two states can land inside the same
 * minute and must still render as distinguishable rows. Current readers:
 * SubmissionDetailPage.tsx (a submission's own decision/edit history),
 * VersionList.tsx (a deliverable's own version chain), and this function's
 * SSR twin formatEventDateTimeWithSeconds (src/lib/event-time.ts), read by
 * the portal's VersionHistory (src/routes/portal/tasks/views.tsx) for a task
 * assignment's own file-version chain. '—' for null/undefined/NaN/invalid.
 * Use formatDateTime instead for any list of DIFFERENT objects, where
 * minute-granularity stays the rule.
 */
export function formatDateTimeWithSeconds(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = SHORT_MONTH_NAMES[date.getMonth()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${day} ${month}, ${hh}:${mm}:${ss}`;
}

/**
 * Format an epoch-ms timestamp as "Tue 11 Aug, 4:12pm" -- weekday, day,
 * short month, 12-hour clock with a lowercase am/pm suffix (no leading
 * zero on the hour, no space before am/pm). '—' for null/undefined/NaN/
 * invalid. w41-g: the Recent Sends timestamp grammar -- callers must go
 * through this rather than hand-rolling Intl/toLocale* (DEC-963 ban).
 */
export function formatDateTimeWeekday(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  const weekday = SHORT_WEEKDAY_NAMES[date.getDay()];
  const day = date.getDate();
  const month = SHORT_MONTH_NAMES[date.getMonth()];
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const meridiem = hours24 >= 12 ? 'pm' : 'am';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${weekday} ${day} ${month}, ${hours12}:${minutes}${meridiem}`;
}

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SHORT_WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format a plain "YYYY-MM-DD" calendar-date string (e.g. an agenda day key)
 * as "Tue 12 May". Parses the string's year/month/day components directly
 * (never through `new Date(string)`, which interprets a bare date as
 * UTC-midnight and can shift the displayed day when read back in a
 * non-UTC-anchored way) so the weekday/day/month are computed from the
 * literal calendar date, not a UTC instant reinterpreted in the viewer's
 * zone. Returns '—' for a value that doesn't match YYYY-MM-DD.
 */
export function formatDayLabel(day: string | null | undefined): string {
  if (!day) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return '—';
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const dayNum = Number(dayStr);
  // Use UTC-anchored Date arithmetic purely to compute the weekday for a
  // Y/M/D triple -- no epoch-ms value crosses this function's boundary, so
  // this isn't a reinterpretation of a stored instant, just weekday math.
  const utcDate = new Date(Date.UTC(year, month - 1, dayNum));
  if (Number.isNaN(utcDate.getTime())) return '—';
  const weekday = SHORT_WEEKDAY_NAMES[utcDate.getUTCDay()];
  const monthName = SHORT_MONTH_NAMES[utcDate.getUTCMonth()];
  return `${weekday} ${utcDate.getUTCDate()} ${monthName}`;
}

/**
 * Format a timestamp (epoch-ms or ISO-8601 string) in an explicit IANA
 * timeZone, e.g. an event's own timezone rather than the viewer's ambient
 * machine zone (DEC-494). Legitimate zone-explicit call sites:
 * app/src/pages/comms/icsChip.ts and the CFP summary's Closes row
 * (CallForPapersPanel.tsx, DEC-781).
 */
export function formatDateTimeInZone(value: number | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}`;
}

/**
 * DEC-831: the ONE days-until reader in the SPA — counts down a day-label
 * epoch-ms value (e.g. a CFP close date) to `now` through the OWNING
 * event's own timezone (dayLabelEndInstant), never a raw-ms subtraction on
 * the day-label instant itself. Two independently-hand-rolled formulas
 * (Math.round on the raw instant vs Math.ceil through the zone) answered
 * differently for the same deadline (w40 finding) — every caller must go
 * through this function instead of re-deriving the arithmetic. Clamped to
 * zero: a past-due/closing-today deadline reads 0, never negative.
 */
export function daysUntil(dayLabelMs: number, timezone: string, now: number): number {
  return Math.max(0, Math.ceil((dayLabelEndInstant(dayLabelMs, timezone) - now) / 86_400_000));
}

/**
 * DEC-831 amendment (wave 54): the ONE 'how many days ago' reader in the
 * SPA -- daysUntil's mirror. Four independent hand-rolled formulas
 * (Math.floor, Math.round x2, Math.ceil) answered the same "days ago"
 * question differently for the same instant; every caller now goes through
 * this rather than re-deriving the arithmetic. Floor (not round/ceil):
 * a partial day elapsed doesn't count as a whole day ago yet. Clamped to
 * zero: a future/just-now instant reads 0, never negative.
 */
export function daysAgo(ms: number, now: number): number {
  return Math.max(0, Math.floor((now - ms) / 86_400_000));
}

/**
 * Format a timestamp as a coarse "N days ago" relative label ('today',
 * 'yesterday', or '<N> days ago'). `now` is threaded in by the caller
 * rather than read via Date.now() at call time, so a render never
 * disagrees with itself between two cells rendered on either side of a
 * tick. The ONE relative-time reader in the SPA (w15-e) -- moved here
 * from content/SessionList.tsx so other pages (e.g. comment timestamps)
 * share the same output instead of hand-rolling a duplicate.
 */
export function formatRelativeDays(ms: number, now: number): string {
  const days = daysAgo(ms, now);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${countOf(days, 'day')} ago`;
}

/**
 * DEC-831 amendment (wave 54): whole-calendar-day index of an epoch-ms
 * instant read in an explicit IANA timeZone -- e.g. two calls' difference
 * counts whole calendar days elapsed (SubmissionDetailPage's triage-age
 * label), which is NOT the same question as daysAgo's rolling 24h window.
 * Not a relative-time label; a raw index for the caller to difference.
 */
export function epochDayIndex(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * DEC-146 amendment (w44-b): format a yyyy-mm-dd date-only string for
 * DateField's text display, e.g. "11 May 2028" -- no leading zero on the
 * day, short month, full year (same grammar as formatDayLabel's day/month
 * but with the year, since a bare "11 May" is ambiguous outside the current
 * year). '' for empty/invalid input -- DateField treats '' as the cleared
 * state, never an error.
 */
export function formatDayInput(yyyyMmDd: string): string {
  if (!yyyyMmDd) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!match) return '';
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!isValidCalendarDate(year, month, day)) return '';
  return `${day} ${SHORT_MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * DEC-146 amendment (w44-b, w49-c): parse DateField's free-text entry into a
 * yyyy-mm-dd string. Accepts "11 May 2028" (any case month abbreviation,
 * matched by its first three letters so "may"/"May"/"MAY"/"December" all
 * work), the month-first spelling "May 1, 2027" / "May 1 2027" / "Sep 01
 * 2026" (comma after the day optional, month matched the same way), and the
 * raw wire format "2028-05-11". All-numeric slash forms like "05/11/2028"
 * are deliberately NOT accepted -- day-first vs month-first is ambiguous
 * without a month name to disambiguate. Returns null -- never a
 * partially-parsed guess -- for anything else, including an empty string,
 * so DateField can refuse to call onChange with garbage (fail loudly).
 */
export function parseDayInput(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [, yearStr, monthStr, dayStr] = isoMatch;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    return isValidCalendarDate(year, month, day) ? `${yearStr}-${monthStr}-${dayStr}` : null;
  }

  const dayMonthYearMatch = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(trimmed);
  if (dayMonthYearMatch) {
    const [, dayStr, monthStr, yearStr] = dayMonthYearMatch;
    if (!dayStr || !monthStr || !yearStr) return null;
    const monthIndex = monthIndexFromName(monthStr);
    if (monthIndex === -1) return null;
    const day = Number(dayStr);
    const year = Number(yearStr);
    return toIsoDateString(year, monthIndex + 1, day);
  }

  const monthDayYearMatch = /^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/.exec(trimmed);
  if (monthDayYearMatch) {
    const [, monthStr, dayStr, yearStr] = monthDayYearMatch;
    if (!monthStr || !dayStr || !yearStr) return null;
    const monthIndex = monthIndexFromName(monthStr);
    if (monthIndex === -1) return null;
    const day = Number(dayStr);
    const year = Number(yearStr);
    return toIsoDateString(year, monthIndex + 1, day);
  }

  return null;
}

function monthIndexFromName(monthStr: string): number {
  return SHORT_MONTH_NAMES.findIndex((name) => name.toLowerCase() === monthStr.slice(0, 3).toLowerCase());
}

function toIsoDateString(year: number, month: number, day: number): string | null {
  if (!isValidCalendarDate(year, month, day)) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Format a timestamp as a fine-grained relative label: 'just now', '<N>
 * N minutes ago', '<N> hours ago', or '<N> days ago' up to 7 days, then
 * falls back to formatDate -- a relative label past a week is less legible
 * than a date (DEC-907). `now` defaults to Date.now() but can be threaded in
 * by callers/tests for a stable render. '—' for null/undefined/NaN/invalid.
 */
export function formatRelative(ms: number | null | undefined, now: number = Date.now()): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  const minuteMs = 60_000;
  const hourMs = 3_600_000;
  const dayMs = 86_400_000;
  const diff = now - ms;
  if (diff < minuteMs) return 'just now';
  if (diff < hourMs) {
    const minutes = Math.floor(diff / minuteMs);
    return `${countOf(minutes, 'minute')} ago`;
  }
  if (diff < dayMs) {
    const hours = Math.floor(diff / hourMs);
    return `${countOf(hours, 'hour')} ago`;
  }
  const days = Math.floor(diff / dayMs);
  if (days < 7) {
    return `${countOf(days, 'day')} ago`;
  }
  return formatDate(ms);
}
