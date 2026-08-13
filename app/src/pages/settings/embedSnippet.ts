// EMB-15 / DEC-289 / DEC-673: pure URL and snippet builders for the
// organizer-side embed builder (EmbedsPanel.tsx). Conforms exactly to the
// server contract fixed in decisions/DEC-289.md: output format is a PATH
// SUFFIX (never a ?format= query param), query params are optional and only
// the non-default ones are serialized, in the stable order trackId, format,
// roomId, day, q, limit, fields, accent, and `accent` is sent WITHOUT its
// leading '#' (the server normalizes it back to '#rrggbb'). DEC-774: the
// session-format filter's query param is named `format` server-side
// (src/routes/public/query.ts's parseFormat) but is carried here as
// opts.sessionFormat to avoid colliding with EmbedOptions.format (the
// embed's own output format — iframe/json/etc, a PATH suffix, never this
// query param).

export const EMBED_SURFACES = ['sessions', 'speakers', 'agenda', 'schedule', 'gallery'] as const;
export type EmbedSurface = (typeof EMBED_SURFACES)[number];

// DEC-617: 'element' is the hardened <chq-embed> custom-element upgrade —
// same URL/path rules as 'iframe', a different copyable snippet. The plain
// iframe snippet stays the default; this is additive, never a replacement.
// DEC-775: 'xml' is the XML twin of 'json' — same envelope, same knobs,
// available on every surface (like 'json'), bare-URL snippet.
// DEC-785: the list itself moved to a pure-core home (src/lib/embed-formats.ts)
// via the ONE named app/->src/ boundary crossing, embed-formats.ts, so the
// saved-embeds API shares this exact vocabulary instead of a hand-copied list.
import { EMBED_FORMATS, type EmbedFormat } from '../../lib/embed-formats';
export { EMBED_FORMATS, type EmbedFormat };

// DEC-289/DEC-673: `fields` allowlist — sessions surface cards only. Title
// and its detail link always render and are not part of the allowlist.
// Derived from the server's own card-field vocabulary (via the ONE named
// app/->src/ boundary crossing, embed-fields.ts) rather than a hand-copied
// list that can drift out of sync with it.
import { ALL_CARD_FIELDS, type CardField } from '../../lib/embed-fields';
export const EMBED_FIELDS = ALL_CARD_FIELDS;
export type EmbedField = CardField;

// design system default accent (app/src/styles.css --chq-brandable-accent).
// Lives here (pure builder module, no JSX/DOM) rather than in EmbedsPanel.tsx
// so the DEC-817 parity test can enumerate the exact placeholder string the
// Accent color input advertises without importing a .tsx component module.
export const DEFAULT_ACCENT_PLACEHOLDER = '4e5c31';

export interface EmbedOptions {
  format: EmbedFormat;
  trackId?: string;
  // DEC-774: the sessions surface's format-filter chip value (server query
  // param `format`) — named sessionFormat here to avoid colliding with the
  // `format` field above (the embed's own output format).
  sessionFormat?: string;
  roomId?: string;
  day?: string;
  q?: string;
  limit?: number;
  fields?: EmbedField[];
  accent?: string;
}

// DEC-490 / DEC-489 / DEC-673: the knobs a given public surface actually
// honors, per DEC-489's fixed surface->knob table (DEC-634 added `day` as a
// real SQL predicate on sessions; DEC-673 added the `q` keyword/name search
// to sessions, speakers and gallery). buildEmbedUrl consults this so it
// never serializes a param the surface ignores, and EmbedsPanel.tsx consults
// it so it never renders a control for a knob the surface ignores.
export type EmbedKnob = 'trackId' | 'format' | 'roomId' | 'day' | 'q' | 'limit' | 'fields' | 'accent';

export const EMBED_KNOBS_BY_SURFACE: Record<EmbedSurface, readonly EmbedKnob[]> = {
  // DEC-774: format/roomId join trackId as sessions-only filter knobs.
  sessions: ['trackId', 'format', 'roomId', 'day', 'q', 'limit', 'fields', 'accent'],
  speakers: ['q', 'limit', 'accent'],
  gallery: ['q', 'limit', 'accent'],
  agenda: ['day', 'accent'],
  schedule: ['day', 'accent'],
};

/** Builds the public embed URL for a surface + format + filter/branding
 * options, per DEC-289. `origin` is expected to be `window.location.origin`
 * (or an equivalent) supplied by the caller — this module never reads
 * globals. */
export function buildEmbedUrl(origin: string, slug: string, surface: EmbedSurface, opts: EmbedOptions): string {
  const { format } = opts;
  let path: string;
  if (format === 'iframe' || format === 'link' || format === 'element') {
    path = `/embed/${slug}/${surface}`;
  } else if (format === 'json') {
    path = `/embed/${slug}/${surface}.json`;
  } else if (format === 'xml') {
    path = `/embed/${slug}/${surface}.xml`;
  } else if (format === 'ics') {
    // DEC-289: iCal is the full published agenda, a single fixed route
    // under /e/, not per-surface.
    path = `/e/${slug}/agenda.ics`;
  } else {
    throw new Error(`Unknown embed format: ${String(format)}`);
  }

  // DEC-490: only serialize knobs the surface's table lists — never a param
  // the server ignores for this surface.
  const knobs = format === 'ics' ? [] : EMBED_KNOBS_BY_SURFACE[surface];
  const params = new URLSearchParams();
  if (knobs.includes('trackId') && opts.trackId) params.set('trackId', opts.trackId);
  if (knobs.includes('format') && opts.sessionFormat) params.set('format', opts.sessionFormat);
  if (knobs.includes('roomId') && opts.roomId) params.set('roomId', opts.roomId);
  if (knobs.includes('day') && opts.day) params.set('day', opts.day);
  if (knobs.includes('q') && opts.q) params.set('q', opts.q);
  if (knobs.includes('limit') && opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (
    knobs.includes('fields') &&
    opts.fields &&
    opts.fields.length > 0 &&
    opts.fields.length < EMBED_FIELDS.length
  ) {
    params.set('fields', opts.fields.join(','));
  }
  if (knobs.includes('accent') && opts.accent) params.set('accent', opts.accent.replace(/^#/, ''));

  const qs = params.toString();
  return `${origin}${path}${qs ? `?${qs}` : ''}`;
}

/** Builds the copyable snippet for a resolved URL. `format` drives the
 * shape: an <iframe> tag, a plain <a> tag, or the bare URL for the three
 * feed formats (json/xml/ics — nothing to embed inline, just a link to
 * fetch). */
export function buildSnippet(url: string, surface: EmbedSurface, format: EmbedFormat): string {
  if (format === 'iframe') {
    return `<iframe src="${url}" style="width:100%;min-height:600px;border:0" loading="lazy" title="${surface}"></iframe>`;
  }
  // DEC-617: the hardened <chq-embed> custom element -- loads /embed.js from
  // the same origin as `url`, then declares the element with that url as its
  // src. embed.js itself refuses a src whose origin differs from its own.
  if (format === 'element') {
    const origin = new URL(url).origin;
    return `<script src="${origin}/embed.js"></script>\n<chq-embed src="${url}"></chq-embed>`;
  }
  if (format === 'link') {
    return `<a href="${url}">${surface}</a>`;
  }
  if (format === 'json' || format === 'xml' || format === 'ics') {
    return url;
  }
  throw new Error(`Unknown embed format: ${String(format)}`);
}
