// DEC-289/DEC-673: the embed card-field vocabulary. Lives in pure-core
// (imports nothing node:/cloudflare/drizzle) so both the public query-param
// parser (src/routes/public/query.ts, which re-exports these for existing
// call sites) and the app/ embed builder (via app/src/lib/embed-fields.ts,
// the ONE named app/->src/ boundary crossing for this vocabulary) share a
// single source of truth instead of a hand-copied list that can drift.

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
  if (!raw || raw.trim().length === 0) return { ...ALL_CARD_FIELDS_ON };
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

// DEC-968: the sessions LIST row (as opposed to every other surface, which
// still defaults to all six fields via parseCardFields) drops the abstract
// by default -- the row shows track/time/room/speaker/format but never the
// description, which the reader gets by drilling into the session's detail
// page (or by naming it explicitly with ?fields=...,description).
export const SESSION_LIST_DEFAULT_FIELDS: CardFields = {
  track: true,
  time: true,
  room: true,
  speaker: true,
  description: false,
  format: true,
};

/** Same grammar as parseCardFields, but an absent/empty `raw` yields
 * SESSION_LIST_DEFAULT_FIELDS (description off) instead of all six on. */
export function parseSessionListFields(raw: string | undefined): CardFields {
  if (!raw || raw.trim().length === 0) return { ...SESSION_LIST_DEFAULT_FIELDS };
  return parseCardFields(raw);
}
