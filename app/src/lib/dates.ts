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

/** Format an epoch-ms timestamp for display; '—' for null/undefined/NaN/invalid. */
export function formatDate(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

/**
 * Format a UTC-midnight epoch-ms calendar-date value for display; '—' for
 * null/undefined/NaN/invalid. Reads the timestamp in the UTC timezone so
 * the calendar date entered by the user renders the same in every browser
 * timezone. Use for all date-only fields (task due dates, plan open/close
 * windows); never use formatDate/toLocaleDateString for these.
 */
export function formatDateOnly(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

/**
 * Format an epoch-ms timestamp as a locale date+time string for display;
 * '—' for null/undefined/NaN/invalid. Use for true instants (createdAt,
 * updatedAt, sentAt, uploadedAt, etc.) rendered in the viewer's local
 * timezone. DEC-545: this is the ONE date-time formatter in the SPA --
 * pages must never call toLocaleString directly.
 */
export function formatDateTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
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

/**
 * Format a UTC-midnight epoch-ms calendar-date value as "16 Aug 2026"; '—'
 * for null/undefined/NaN/invalid. Like formatDateOnly, this reads the
 * timestamp in the UTC timezone (DEC-153) so the entered calendar date
 * renders identically in every browser timezone. The day/short-month/year
 * order is built by hand (never Intl's locale-dependent month/day
 * ordering) so the mock's exact "16 Aug 2026" shape is guaranteed
 * regardless of the runtime's default locale.
 */
export function formatDateOnlyLong(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getUTCDate()} ${SHORT_MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Format a timestamp (epoch-ms or ISO-8601 string) in an explicit IANA
 * timeZone, e.g. an event's own timezone rather than the viewer's ambient
 * machine zone (DEC-494). Legitimate zone-explicit call sites:
 * app/src/pages/comms/icsChip.ts and the CFP summary's Closes row
 * (CallForPapersPanel.tsx, DEC-781).
 */
export function formatDateTimeInZone(value: number | string, timeZone: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone });
}
