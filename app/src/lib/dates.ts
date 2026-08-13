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

/** Convert an epoch-ms timestamp to a yyyy-mm-dd string for <input type="date">. */
export function msToDateInput(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/**
 * Convert a yyyy-mm-dd <input type="date"> value to epoch-ms.
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
 * '—' for null/undefined/NaN/invalid. Use for true instants (createdAt,
 * updatedAt, sentAt, uploadedAt, etc.) rendered in the viewer's local
 * timezone. DEC-545/DEC-907: this is the ONE date-time formatter in the
 * SPA -- pages must never call toLocaleString directly.
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
 * Format a timestamp as a coarse "N days ago" relative label ('today',
 * 'yesterday', or '<N> days ago'). `now` is threaded in by the caller
 * rather than read via Date.now() at call time, so a render never
 * disagrees with itself between two cells rendered on either side of a
 * tick. The ONE relative-time reader in the SPA (w15-e) -- moved here
 * from content/SessionList.tsx so other pages (e.g. comment timestamps)
 * share the same output instead of hand-rolling a duplicate.
 */
export function formatRelativeDays(ms: number, now: number): string {
  const dayMs = 86_400_000;
  const days = Math.floor((now - ms) / dayMs);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${countOf(days, 'day')} ago`;
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
