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
// RULING (DEC-489 wave-12 amendment, revised DEC-851 wave-55 amendment):
// sessions = trackId(filter), format, roomId, day, q, limit, fields, accent;
// speakers/gallery = trackId(filter), q, limit, accent; agenda = trackId
// (HIGHLIGHT — a render-level highlight per DEC-851, never a SQL predicate,
// never a "filter" a copied snippet could claim to narrow), day, q, accent;
// schedule = day, q, accent ONLY — no trackId at all, because ScheduleContent
// (src/routes/public/agenda.tsx) never read the highlight prop and
// getSurfaceFeedPage's schedule branch never threaded it either, so the
// row was a declared knob with no reader (DEC-851 wave-55 amendment). No
// format/roomId/limit/fields on agenda/schedule: dispatch.tsx parses no
// `format` on those surfaces at all and calls getPublicAgenda with no
// perPage.

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
    // DEC-851 (wave-55 amendment): no reader honors trackId here --
    // ScheduleContent never read the highlight prop and the .json/.xml
    // feed twin never threaded it -- so the row named a knob with no
    // reader. trackMode stays 'highlight' (never reached with trackId
    // absent from `knobs`) rather than deleting the field, since nothing
    // in this table's shape lets a surface omit trackMode.
    knobs: ["day", "q", "accent"],
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

/** DEC-489 (wave-54 amendment): the value bag a surface's rendered links may
 * carry forward for `embedKnobQuery` below — one entry per EmbedKnob, using
 * whichever shape that knob's value naturally takes (a single string for
 * most, `readonly string[]` for `fields`). */
export type EmbedKnobValues = Partial<Record<EmbedKnob, string | number | readonly string[] | null | undefined>>;

/** DEC-489 (wave-54 amendment): renders `values` as a `k=v&k=v` query
 * fragment (no leading '?' or '&') restricted to the knobs `surface`
 * actually declares, in EMBED_KNOB_TABLE order — a value supplied for a
 * knob the surface does not honor is silently dropped rather than emitted,
 * matching saved-embed.tsx's redirect gate (the ONE other place a knob list
 * is filtered against a surface). `null`/`undefined`/`""`/`[]` values are
 * skipped (nothing to carry). `fields` joins with ','; `accent` strips any
 * leading '#' (matching src/routes/public/saved-embed.tsx:93). */
export function embedKnobQuery(surface: EmbedSurface, values: EmbedKnobValues): string {
  const knobs = knobsForSurface(surface);
  const parts: string[] = [];
  for (const knob of knobs) {
    const raw = values[knob];
    if (raw === null || raw === undefined) continue;
    if (Array.isArray(raw)) {
      if (raw.length === 0) continue;
      parts.push(`${knob}=${encodeURIComponent(raw.join(","))}`);
      continue;
    }
    if (knob === "accent") {
      const accent = String(raw).replace(/^#/, "");
      if (accent === "") continue;
      parts.push(`${knob}=${encodeURIComponent(accent)}`);
      continue;
    }
    const value = String(raw);
    if (value === "") continue;
    parts.push(`${knob}=${encodeURIComponent(value)}`);
  }
  return parts.join("&");
}

// Back-compat-free direct table export for callers that want the full
// per-surface knob list keyed by surface (e.g. the SPA's embedSnippet.ts,
// which re-exports this under its historical name).
export const EMBED_KNOBS_BY_SURFACE: Record<EmbedSurface, readonly EmbedKnob[]> = Object.fromEntries(
  EMBED_SURFACES.map((surface) => [surface, EMBED_KNOB_TABLE[surface].knobs]),
) as Record<EmbedSurface, readonly EmbedKnob[]>;
