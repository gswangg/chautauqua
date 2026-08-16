// DEC-433: public paging LIMIT ceiling. parsePage (src/routes/public/query.ts)
// already clamps `page` to [1, MAX_PUBLIC_PAGE], but `perPage`/`limit` can
// still be attacker-controlled (e.g. ?limit=100&page=50 => 5000 rows), and
// Number.isInteger(1e308) === true so a non-finite-after-multiply value can
// otherwise reach the SQL LIMIT clause undetected. boundedRowLimit is the
// single choke point for the row count passed to db.limit() on the public
// sessions/speakers list queries.

// DEC-477/DEC-487: this is the ONE home for every public-surface paging
// constant — PUBLIC_PER_PAGE (page size), MAX_PUBLIC_PAGE (deepest page
// number), and MAX_PUBLIC_ROWS (their product, never a second literal).
// Previously MAX_PUBLIC_PAGE lived in src/routes/public/query.ts and
// PER_PAGE lived in src/routes/public/shell.tsx, with MAX_PUBLIC_ROWS
// hand-kept in lockstep here — a change to either source constant could
// silently desync the ceiling. Both are deleted from their old homes;
// every importer now points here.
export const PUBLIC_PER_PAGE = 12;
export const MAX_PUBLIC_PAGE = 100;
export const MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE * PUBLIC_PER_PAGE;

// DEC-487 amendment (wave 10): the ONE home for the `?limit=` embed-config
// override's valid range. src/routes/public/query.ts's parseLimit enforces
// this range (degrading any out-of-range value to null, never throwing);
// src/routes/api/embeds.ts's refusal message for the same param is composed
// from these same two symbols, so the enforced range and the described
// range can never drift apart. The SPA's embed builder (app/src/pages/
// settings/EmbedsPanel.tsx) imports these directly for its number input's
// min/max, for the same reason.
export const MIN_EMBED_LIMIT = 1;
export const MAX_EMBED_LIMIT = 100;

// DEC-433 amendment (wave 30, superseded in part by wave 45): the ONE bound
// on every public query-string STRING value (trackId/format/roomId/q),
// mirrored by src/routes/public/query.ts's trim-or-null parsers and
// src/lib/card-fields.ts's parseCardFields/parseSessionListFields. Wave 45:
// src/server/pubcache.ts's versionedCacheKey also imports this constant
// directly — a keyed param over this length is skipped (treated as absent)
// rather than copied into the edge-cache key, so the D1 LIKE parameter and
// the edge-cache key space stay bounded by the same number without a
// separate whole-request bypass (the deleted hasOverlongQueryValue).
export const MAX_PUBLIC_QUERY_VALUE_LENGTH = 200;

// DEC-433 amendment (wave 44): the closed set of query-string param names
// any handler under the two cached prefixes (/e/* and /embed/*, DEC-627)
// actually reads — src/server/pubcache.ts's versionedCacheKey builds the
// edge-cache key from exactly these names, in exactly this order, and
// drops everything else (tracking params like ?utm_source= no longer mint
// a distinct cache entry). test/pubcache-key-param-derivation.scan.test.ts
// scans every `c.req.query("<name>")` literal under src/routes/public/**
// and fails loudly if a name is read but missing here (an unkeyed param
// that affects rendering would serve the wrong cached page) — the only
// asserted exclusions are `ids` (schedule.ics; isUncacheableIcsRequest
// already bypasses the cache for that request shape) and `draft`
// (submit.tsx, never mounted under /e/* or /embed/*).
export const PUBLIC_CACHE_KEY_PARAMS: readonly string[] = [
  "trackId",
  "page",
  "q",
  "day",
  "limit",
  "fields",
  "format",
  "roomId",
  "from",
  "accent",
];

function assertFiniteIntGte1(n: number, name: string): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`boundedRowLimit: ${name} must be a finite integer >= 1, got ${n}`);
  }
}

export function boundedRowLimit(page: number, perPage: number): number {
  assertFiniteIntGte1(page, "page");
  assertFiniteIntGte1(perPage, "perPage");
  return Math.min(page * perPage, MAX_PUBLIC_ROWS);
}

// DEC-516: a real one-page SQL window (LIMIT+OFFSET) instead of the
// cumulative prefix boundedRowLimit produces (used by the HTML show-more
// list, which re-fetches pages 1..page every time and needs the whole
// prefix). Same guards, same MAX_PUBLIC_ROWS ceiling as boundedRowLimit —
// this file stays the one home for public paging constants (DEC-477/487).
// An offset at or beyond the ceiling is not an error: it's an honestly
// empty page (limit 0), since a caller can legally ask for a page past the
// last real row (e.g. the deepest allowed page number on a small event).
export function boundedWindow(page: number, perPage: number): { limit: number; offset: number } {
  assertFiniteIntGte1(page, "page");
  assertFiniteIntGte1(perPage, "perPage");
  const offset = (page - 1) * perPage;
  if (offset >= MAX_PUBLIC_ROWS) return { limit: 0, offset };
  return { limit: Math.min(perPage, MAX_PUBLIC_ROWS - offset), offset };
}

// DEC-477/DEC-487: single 'Show more' predicate for every public surface
// (sessions/speakers/gallery). `shown` is the total item count already
// rendered across pages 1..page (i.e. what the caller is about to display,
// not merely the current page's item count). Three independent reasons to
// stop offering another page: the result set is exhausted (shown >= total),
// parsePage's clamp means there's no page+1 to link to (page >= the page
// ceiling), or the next page would sit at/beyond the row ceiling (a large
// ?limit= embed can hit MAX_PUBLIC_ROWS well before MAX_PUBLIC_PAGE).
export function hasMorePages(shown: number, total: number, page: number, perPage: number): boolean {
  return shown < total && page < MAX_PUBLIC_PAGE && page * perPage < MAX_PUBLIC_ROWS;
}
