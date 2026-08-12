// Pure validators for the events/tracks/rooms API (w2-b). No node:/cloudflare
// imports — Web APIs only, so these are directly unit-testable.

const SLUG_RE = /^[a-z0-9-]+$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** event.slug: lowercase letters, digits, hyphens only, non-empty. */
export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** track.color / room-adjacent color fields: '#rgb' or '#rrggbb'. */
export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color);
}

/**
 * event.timezone: a non-empty IANA timezone string. We validate by asking
 * Intl to resolve it — an unknown zone throws a RangeError.
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone || timezone.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DEC-510: event.startDate / event.endDate must be strict ISO YYYY-MM-DD at
 * the API boundary. Date.parse (used by isDateOrderValid) accepts many
 * non-ISO formats ('August 5, 2026', '2026-8-5'), which then break
 * downstream string-based date math (agenda.ts computeDays /
 * isDayWithinEventRange) that assumes YYYY-MM-DD. True only when the value
 * matches the pattern AND round-trips through Date/toISOString, which
 * rejects calendar-invalid dates like 2026-02-30 or 2026-13-01.
 */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** True when startDate <= endDate, both parseable ISO date strings. */
export function isDateOrderValid(startDate: string, endDate: string): boolean {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= end;
}

/**
 * DEC-517: the ONE ms-epoch boundary predicate (mirrors DEC-510's isIsoDate
 * for ISO date strings). Deliberately narrow: an integer, nothing else --
 * no coercion of numeric strings, no float truncation.
 */
export function isEpochMs(value: unknown): value is number {
  return Number.isInteger(value);
}

/**
 * DEC-517: true whenever either side is null/undefined (nothing to compare
 * yet, e.g. only one of openDate/closeDate is set); otherwise true only when
 * open <= close. Used at both the CFP form and evaluation plan surfaces so a
 * close-before-open date is refused identically on each.
 */
export function isEpochOrderValid(open: number | null | undefined, close: number | null | undefined): boolean {
  if (open === null || open === undefined || close === null || close === undefined) return true;
  return open <= close;
}
