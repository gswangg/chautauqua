// DEC-289/DEC-673: the embed card-field vocabulary. Lives in pure-core
// (imports nothing node:/cloudflare/drizzle) so both the public query-param
// parser (src/routes/public/query.ts, which re-exports these for existing
// call sites) and the app/ embed builder (via app/src/lib/embed-fields.ts,
// the ONE named app/->src/ boundary crossing for this vocabulary) share a
// single source of truth instead of a hand-copied list that can drift.

// DEC-433 amendment (wave 45): `fields` is a PUBLIC_CACHE_KEY_PARAMS member
// (src/server/repo/public/bounds.ts), which requires that an over-cap value
// parse identically to an absent one — every other parser in
// src/routes/public/query.ts already degrades that way, but a raw string
// longer than MAX_PUBLIC_QUERY_VALUE_LENGTH that happens to name none of the
// six known fields would otherwise fall through to the empty-set branch
// below (all-false) instead of the absent-raw branch (all-on/defaults),
// silently disagreeing with versionedCacheKey's now-identical treatment of
// the two. src/server/repo/public/bounds.ts has no imports of its own, so
// importing the constant here doesn't create a cycle.
import { MAX_PUBLIC_QUERY_VALUE_LENGTH } from "../server/repo/public/bounds";

export const ALL_CARD_FIELDS = ["track", "time", "room", "speaker", "description", "format"] as const;
export type CardField = (typeof ALL_CARD_FIELDS)[number];
export type CardFields = Record<CardField, boolean>;

const ALL_CARD_FIELDS_ON: CardFields = {
  track: true,
  time: true,
  room: true,
  speaker: true,
  description: true,
  format: true,
};

/** `fields` = comma list from ALL_CARD_FIELDS; unknown names ignored;
 * absent-or-empty == all six on (title is not part of this allowlist and
 * always renders). */
export function parseCardFields(raw: string | undefined): CardFields {
  if (!raw || raw.trim().length === 0 || raw.length > MAX_PUBLIC_QUERY_VALUE_LENGTH) return { ...ALL_CARD_FIELDS_ON };
  const named = new Set(
    raw
      .split(",")
      .map((f) => f.trim())
      .filter((f): f is CardField => (ALL_CARD_FIELDS as readonly string[]).includes(f)),
  );
  return {
    track: named.has("track"),
    time: named.has("time"),
    room: named.has("room"),
    speaker: named.has("speaker"),
    description: named.has("description"),
    format: named.has("format"),
  };
}

// DEC-968, amended by the EMB-01 orchestrator ruling (2026-08-14, recorded
// in the mandate): the sessions LIST row shows all six fields by default,
// INCLUDING the description — SessionDescription renders it as a snippet
// with an in-place "Show more" disclosure, so the row cost is one muted
// line, and a reader (or an embed consumer) can still drop it with
// ?fields=... naming everything but description.
export const SESSION_LIST_DEFAULT_FIELDS: CardFields = {
  track: true,
  time: true,
  room: true,
  speaker: true,
  description: true,
  format: true,
};

/** Same grammar as parseCardFields, but an absent/empty `raw` yields
 * SESSION_LIST_DEFAULT_FIELDS instead of parseCardFields' all-on. */
export function parseSessionListFields(raw: string | undefined): CardFields {
  if (!raw || raw.trim().length === 0 || raw.length > MAX_PUBLIC_QUERY_VALUE_LENGTH) return { ...SESSION_LIST_DEFAULT_FIELDS };
  return parseCardFields(raw);
}
