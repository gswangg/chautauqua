// DEC-146: null-safe date helpers for app pages. Pages must never call
// new Date(x).toISOString()/toLocale* directly on a nullable/unvalidated
// value -- go through these helpers so a null/undefined/NaN timestamp
// renders as an empty input or em dash instead of crashing the SPA with
// "Invalid time value".

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
