// Pure validators for the events/tracks/rooms API (w2-b). No node:/cloudflare
// imports — Web APIs only, so these are directly unit-testable.

// DEC-371 amendment (wave 43): the hex-colour grammar (isValidHexColor,
// normalizeHexColor) now lives ONE place, src/domain/color.ts — import from
// there directly rather than through this module.

const SLUG_RE = /^[a-z0-9-]+$/;

/** event.slug: lowercase letters, digits, hyphens only, non-empty. */
export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
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
 *
 * DEC-517 amendment (wave 42): bounded to the range that
 * src/lib/timezone.ts's dayLabelToYmd (and Date's own ISO representation)
 * can turn into a valid YYYY-MM-DD day label: [0001-01-01T00:00:00.000Z,
 * 9999-12-31T23:59:59.999Z]. An unbounded integer (e.g. 1e18) passed
 * Number.isInteger but produced "NaN-NaN-NaN" downstream and 500'd every
 * reader of the value (public CFP, save-draft, portal edit-lock). Both
 * bounds are inclusive.
 */
export const MIN_EPOCH_MS = -62135596800000; // 0001-01-01T00:00:00.000Z
export const MAX_EPOCH_MS = 253402300799999; // 9999-12-31T23:59:59.999Z

export function isEpochMs(value: unknown): value is number {
  if (!Number.isInteger(value)) return false;
  const n = value as number;
  return n >= MIN_EPOCH_MS && n <= MAX_EPOCH_MS;
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
