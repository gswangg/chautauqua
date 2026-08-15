// DEC-822 / DEC-839: the ONE recipe formatter shared by SavedEmbedsPanel's
// list row and EmbedsPanel's editor heading, so the two surfaces can never
// state a different recipe for the same saved embed. Per DEC-839's wire
// contract, `options` here is already the PARSED object a saved-embed row
// carries over the wire (never the stored JSON string) — the formatter
// never parses anything itself.
import type { EmbedOptions } from './embedSnippet';
import { capitalizeFirst } from '../../lib/plural';

export interface RecipeEmbed {
  surface: string;
  format: string;
  options: EmbedOptions;
  trackName?: string | null;
}

/** Produces a one-line recipe caption, e.g.
 * 'Sessions · iframe · AI Engineering · 6 fields'. Pure and defensive —
 * `options` fields are all optional, so a bare surface+format embed still
 * formats cleanly as e.g. 'Sessions · iframe'. */
export function formatEmbedRecipe(embed: RecipeEmbed): string {
  const { surface, format, options, trackName } = embed;
  const segments: string[] = [
    capitalizeFirst(surface),
    format,
  ];

  if (options.trackId) segments.push(trackName ?? options.trackId);
  if (options.q) segments.push(`"${options.q}"`);
  if (options.day) segments.push(options.day);
  if (options.sessionFormat) segments.push(options.sessionFormat);
  if (options.roomId) segments.push(`Room ${options.roomId}`);
  if (options.limit !== undefined) segments.push(`Limit ${options.limit}`);

  // Unlike the URL's ?fields= (only serialized for a non-default subset),
  // the recipe caption states the field count unconditionally — it's a
  // summary of what's saved, not a URL param to omit when default.
  if (options.fields && options.fields.length > 0) {
    segments.push(`${options.fields.length} fields`);
  }

  return segments.join(' · ');
}
