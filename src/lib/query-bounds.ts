// Pure-core bound checker for admin list search/filter-id query strings
// (DEC-417 wave-31 amendment). No node:/cloudflare:/drizzle/hono imports
// (DEC-002) -- repo modules that call this must not import
// src/server/http.ts, so this throws a plain Error, never ApiError. Route
// layers wrap the throw into an ApiError('invalid', message) at the
// boundary, same idiom as readStatusTokens etc.

export const MAX_SEARCH_QUERY_LENGTH = 200;
export const MAX_FILTER_ID_LENGTH = 64;

/**
 * Trims `value`; returns null for absent/blank (preserving the existing
 * "absent means filter is off" convention used throughout the admin list
 * parsers). Throws a plain Error naming `field` when the trimmed value
 * exceeds `max` characters -- loud, not a silent truncation.
 */
export function boundedQueryString(
  value: string | undefined | null,
  field: string,
  max: number,
): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) {
    throw new Error(`${field} must be at most ${max} characters`);
  }
  return trimmed;
}
