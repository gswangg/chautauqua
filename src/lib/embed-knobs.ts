// DEC-489 (wave-12 amendment) / DEC-490: the ONE surface->knob table, in
// pure core (imports nothing node:/cloudflare/drizzle) so both the
// organizer-side embed builder (via app/src/pages/settings/embedSnippet.ts,
// the ONE named app/->src/ boundary crossing for this table, same pattern
// as embed-formats.ts / embed-fields.ts) and the saved-embeds API
// (src/routes/api/embeds.ts) share a single source of truth instead of a
// hand-copied list that can drift out of sync with what the HTML reader
// (src/routes/public/dispatch.tsx, NORMATIVE, never changed to match this
// table) actually honors.
//
// RULING (DEC-489 wave-12 amendment): sessions = trackId(filter), format,
// roomId, day, q, limit, fields, accent; speakers/gallery = trackId(filter),
// q, limit, accent; agenda/schedule = trackId(HIGHLIGHT — a render-level
// highlight per DEC-851, never a SQL predicate, never a "filter" a copied
// snippet could claim to narrow), day, q, accent. No format/roomId/limit/
// fields on agenda/schedule: dispatch.tsx parses no `format` on those
// surfaces at all and calls getPublicAgenda with no perPage.

export const EMBED_SURFACES = ["sessions", "speakers", "agenda", "schedule", "gallery"] as const;
export type EmbedSurface = (typeof EMBED_SURFACES)[number];

export type EmbedKnob = "trackId" | "format" | "roomId" | "day" | "q" | "limit" | "fields" | "accent";

/** trackId's mode: 'filter' on sessions/speakers/gallery (a real SQL-level
 * predicate that narrows what renders), 'highlight' on agenda/schedule (per
 * DEC-851, every session still renders — the track is only visually called
 * out). Every other knob is implicitly a filter wherever it's listed. */
export type TrackKnobMode = "filter" | "highlight";

interface SurfaceKnobEntry {
  readonly knobs: readonly EmbedKnob[];
  readonly trackMode: TrackKnobMode;
}

const EMBED_KNOB_TABLE: Record<EmbedSurface, SurfaceKnobEntry> = {
  sessions: {
    knobs: ["trackId", "format", "roomId", "day", "q", "limit", "fields", "accent"],
    trackMode: "filter",
  },
  speakers: {
    knobs: ["trackId", "q", "limit", "accent"],
    trackMode: "filter",
  },
  gallery: {
    knobs: ["trackId", "q", "limit", "accent"],
    trackMode: "filter",
  },
  agenda: {
    knobs: ["trackId", "day", "q", "accent"],
    trackMode: "highlight",
  },
  schedule: {
    knobs: ["trackId", "day", "q", "accent"],
    trackMode: "highlight",
  },
};

/** The exact ordered knob list a surface honors — never a param the server
 * ignores for it. Callers must never mutate the returned array. */
export function knobsForSurface(surface: EmbedSurface): readonly EmbedKnob[] {
  return EMBED_KNOB_TABLE[surface].knobs;
}

/** Whether `trackId` narrows the result set ('filter') or only highlights
 * matching rows without removing any ('highlight') on this surface. */
export function trackKnobMode(surface: EmbedSurface): TrackKnobMode {
  return EMBED_KNOB_TABLE[surface].trackMode;
}

// Back-compat-free direct table export for callers that want the full
// per-surface knob list keyed by surface (e.g. the SPA's embedSnippet.ts,
// which re-exports this under its historical name).
export const EMBED_KNOBS_BY_SURFACE: Record<EmbedSurface, readonly EmbedKnob[]> = Object.fromEntries(
  EMBED_SURFACES.map((surface) => [surface, EMBED_KNOB_TABLE[surface].knobs]),
) as Record<EmbedSurface, readonly EmbedKnob[]>;
