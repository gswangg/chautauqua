// Query-param parsing (pure-ish, inline — small enough not to warrant
// further extraction; itinerary id parsing already lives in src/lib/
// itinerary.ts). Split out of the former monolithic src/routes/public.tsx
// (contention decomposition) — no behavior change.

// DEC-433: each distinct page value mints its own caches.default entry via
// versionedCacheKey (src/server/pubcache.ts:60), so an unbounded page param
// is an unbounded cache-cardinality (and, downstream, LIMIT-size) attack
// surface — clamp to [1, MAX_PUBLIC_PAGE] rather than merely rejecting.
// DEC-477: MAX_PUBLIC_PAGE(100) x PER_PAGE(12) = MAX_PUBLIC_ROWS(1200,
// src/server/repo/public/bounds.ts) — raised from 50/600 so the top of
// SPEC.md:73-76's 200-800 speaker range is fully reachable via ?page=.
export const MAX_PUBLIC_PAGE = 100;

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n > MAX_PUBLIC_PAGE ? MAX_PUBLIC_PAGE : n;
}

export function parseTrackId(raw: string | undefined): string | null {
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

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX3_OR_6_RE = /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/;

/** `day` = agenda/schedule filter, /^\d{4}-\d{2}-\d{2}$/ or null. */
export function parseDay(raw: string | undefined): string | null {
  return raw && DAY_RE.test(raw) ? raw : null;
}

/** `limit` = sessions-surface page size override, integer 1..100, else null
 * (caller falls back to PER_PAGE). */
export function parseLimit(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
}

export const ALL_CARD_FIELDS = ["track", "time", "room", "speaker", "description"] as const;
export type CardField = (typeof ALL_CARD_FIELDS)[number];
export type CardFields = Record<CardField, boolean>;

const ALL_CARD_FIELDS_ON: CardFields = { track: true, time: true, room: true, speaker: true, description: true };

/** `fields` = comma list from ALL_CARD_FIELDS; unknown names ignored;
 * absent-or-empty == all five on (title is not part of this allowlist and
 * always renders). */
export function parseCardFields(raw: string | undefined): CardFields {
  if (!raw || raw.trim().length === 0) return { ...ALL_CARD_FIELDS_ON };
  const named = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is CardField => (ALL_CARD_FIELDS as readonly string[]).includes(s)),
  );
  return {
    track: named.has("track"),
    time: named.has("time"),
    room: named.has("room"),
    speaker: named.has("speaker"),
    description: named.has("description"),
  };
}

/** `accent` = 3- or 6-digit hex without '#', normalized to '#rrggbb'
 * lowercase (3-digit expanded); anything else parses to null. */
export function parseAccent(raw: string | undefined): string | null {
  if (!raw || !HEX3_OR_6_RE.test(raw)) return null;
  const hex = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return `#${hex.toLowerCase()}`;
}
