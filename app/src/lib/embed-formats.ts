// DEC-785: the ONLY module that crosses the app/ -> src/ boundary for the
// embed output-format vocabulary. Every SPA consumer imports from here,
// never straight from ../../../src/lib/embed-formats, so there is exactly
// one place that names the crossing (same style as embed-fields.ts's
// DEC-673 crossing for the card-field vocabulary).
export { EMBED_FORMATS, type EmbedFormat } from '../../../src/lib/embed-formats';
