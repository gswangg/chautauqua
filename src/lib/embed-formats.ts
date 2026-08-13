// DEC-289/DEC-617/DEC-785: the embed output-format vocabulary. Lives in
// pure-core (imports nothing node:/cloudflare/drizzle) so both the saved-
// embeds API (src/routes/api/embeds.ts) and the app/ embed builder (via
// app/src/lib/embed-formats.ts, the ONE named app/->src/ boundary crossing
// for this vocabulary — same pattern as src/lib/card-fields.ts /
// app/src/lib/embed-fields.ts) share a single source of truth instead of a
// hand-copied list that can drift.

export const EMBED_FORMATS = ["iframe", "element", "link", "json", "ics"] as const;
export type EmbedFormat = (typeof EMBED_FORMATS)[number];
