// Query-param parsing (pure-ish, inline — small enough not to warrant
// further extraction; itinerary id parsing already lives in src/lib/
// itinerary.ts). Split out of the former monolithic src/routes/public.tsx
// (contention decomposition) — no behavior change.

// DEC-433: each distinct page value mints its own caches.default entry via
// versionedCacheKey (src/server/pubcache.ts:60), so an unbounded page param
// is an unbounded cache-cardinality (and, downstream, LIMIT-size) attack
// surface — clamp to [1, MAX_PUBLIC_PAGE] rather than merely rejecting.
// DEC-477/DEC-487: MAX_PUBLIC_PAGE now lives in src/server/repo/public/
// bounds.ts, the ONE home for public paging constants (alongside
// PUBLIC_PER_PAGE and their derived MAX_PUBLIC_ROWS).
import {
  MAX_PUBLIC_PAGE,
  MAX_PUBLIC_QUERY_VALUE_LENGTH,
  MIN_EMBED_LIMIT,
  MAX_EMBED_LIMIT,
} from "../../server/repo/public/bounds";
// DEC-510: isIsoDate is the ONE home for the YYYY-MM-DD format+round-trip
// rule, in pure core (src/domain/iso-date.ts, no imports).
import { isIsoDate } from "../../domain/iso-date";
// DEC-371 amendment (wave 43): the hex-colour grammar lives ONE place,
// src/domain/color.ts.
import { normalizeHexColor } from "../../domain/color";

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n > MAX_PUBLIC_PAGE ? MAX_PUBLIC_PAGE : n;
}

// DEC-433 amendment (wave 30, wave 45): trim-or-null, bounded by
// MAX_PUBLIC_QUERY_VALUE_LENGTH — an over-cap value degrades to null (never
// throws) for exactly the reason parseLimit/parseDay/parseAccent already
// degrade on bad input on these anonymous surfaces, and keeps a megabyte
// query string from ever reaching a D1 LIKE parameter or minting its own
// edge-cache key (src/server/pubcache.ts's versionedCacheKey now skips a
// keyed param over this length rather than copying it in, so this parser
// and the cache key agree on treating the value as absent — no separate
// bypass needed).
function trimOrNullBounded(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PUBLIC_QUERY_VALUE_LENGTH) return null;
  return trimmed;
}

export function parseTrackId(raw: string | undefined): string | null {
  return trimOrNullBounded(raw);
}

// DEC-774: format/room chip filters on the public sessions surface — same
// bounded trim-or-null shape as parseTrackId (ids/format values are opaque
// to the route layer; the repo-side EXISTS predicates do the real
// matching).
export function parseFormat(raw: string | undefined): string | null {
  return trimOrNullBounded(raw);
}

export function parseRoomId(raw: string | undefined): string | null {
  return trimOrNullBounded(raw);
}

/** Bounded trim-or-null for the ?q= search box, shared by both search
 * surfaces: the EMB-02 keyword search on /sessions (title + speaker names)
 * and the DEC-151 name search on /speakers and /gallery. Parsing is
 * identical — only the repo-side condition differs. */
export function parseNameQuery(raw: string | undefined): string | null {
  return trimOrNullBounded(raw);
}

// DEC-289: embed configuration params — all optional, all degrade to
// today's behavior on absence or bad input, none of them ever throw.

/** `day` = agenda/schedule filter, strict YYYY-MM-DD (DEC-510 isIsoDate) or
 * null. Never throws. */
export function parseDay(raw: string | undefined): string | null {
  return raw && isIsoDate(raw) ? raw : null;
}

/** `limit` = sessions-surface page size override, integer
 * MIN_EMBED_LIMIT..MAX_EMBED_LIMIT (DEC-487: src/server/repo/public/
 * bounds.ts is the ONE home for this range), else null (caller falls back
 * to PER_PAGE). Never throws — an out-of-range value degrades to null. */
export function parseLimit(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= MIN_EMBED_LIMIT && n <= MAX_EMBED_LIMIT ? n : null;
}

// DEC-673: the card-field vocabulary moved to src/lib/card-fields.ts (pure
// core); re-exported here so every existing import site keeps compiling.
export {
  ALL_CARD_FIELDS,
  parseCardFields,
  SESSION_LIST_DEFAULT_FIELDS,
  parseSessionListFields,
  type CardField,
  type CardFields,
} from "../../lib/card-fields";

/** `accent` = 3- or 6-digit hex, with ONE optional leading '#' tolerated
 * (DEC-817: the embed builder's own placeholder shows the '#' form, and a
 * value the builder can emit must round-trip through this parser), normalized
 * to '#rrggbb' lowercase (3-digit expanded); anything else parses to null.
 * Keeps its own '#'-stripping contract for the query string but delegates
 * the grammar itself to normalizeHexColor (DEC-371 amendment, wave 43) —
 * which already tolerates a leading '#', so stripping it first is redundant
 * but harmless and documents the contract at this call site. */
export function parseAccent(raw: string | undefined): string | null {
  if (!raw) return null;
  return normalizeHexColor(raw);
}
