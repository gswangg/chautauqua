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

/** True when startDate <= endDate, both parseable ISO date strings. */
export function isDateOrderValid(startDate: string, endDate: string): boolean {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= end;
}
