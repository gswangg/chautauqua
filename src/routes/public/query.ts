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
import { MAX_PUBLIC_PAGE } from "../../server/repo/public/bounds";
// DEC-510: isIsoDate is the ONE home for the YYYY-MM-DD format+round-trip
// rule; both this module and src/routes/api/events.ts are route-layer, so
// importing from ../api/validators is legal (no cycle: validators.ts has no
// imports of its own).
import { isIsoDate } from "../api/validators";

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n > MAX_PUBLIC_PAGE ? MAX_PUBLIC_PAGE : n;
}

export function parseTrackId(raw: string | undefined): string | null {
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

// DEC-774: format/room chip filters on the public sessions surface — same
// trim/length-bounds-free trim-or-null shape as parseTrackId (ids/format
// values are opaque to the route layer; the repo-side EXISTS predicates do
// the real matching).
export function parseFormat(raw: string | undefined): string | null {
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

export function parseRoomId(raw: string | undefined): string | null {
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

/** Trim-or-null for the ?q= search box, shared by both search surfaces: the
 * EMB-02 keyword search on /sessions (title + speaker names) and the DEC-151
 * name search on /speakers and /gallery. Parsing is identical — only the
 * repo-side condition differs. */
export function parseNameQuery(raw: string | undefined): string | null {
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

// DEC-289: embed configuration params — all optional, all degrade to
// today's behavior on absence or bad input, none of them ever throw.

const HEX3_OR_6_RE = /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/;

/** `day` = agenda/schedule filter, strict YYYY-MM-DD (DEC-510 isIsoDate) or
 * null. Never throws. */
export function parseDay(raw: string | undefined): string | null {
  return raw && isIsoDate(raw) ? raw : null;
}

/** `limit` = sessions-surface page size override, integer 1..100, else null
 * (caller falls back to PER_PAGE). */
export function parseLimit(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
}

// DEC-673: the card-field vocabulary moved to src/lib/card-fields.ts (pure
// core); re-exported here so every existing import site keeps compiling.
export { ALL_CARD_FIELDS, parseCardFields, type CardField, type CardFields } from "../../lib/card-fields";

/** `accent` = 3- or 6-digit hex without '#', normalized to '#rrggbb'
 * lowercase (3-digit expanded); anything else parses to null. */
export function parseAccent(raw: string | undefined): string | null {
  if (!raw || !HEX3_OR_6_RE.test(raw)) return null;
  const hex = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return `#${hex.toLowerCase()}`;
}
