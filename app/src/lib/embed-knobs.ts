// DEC-489 (wave-12 amendment): the ONLY module that crosses the app/ -> src/
// boundary for the embed surface->knob table. Every SPA consumer imports
// from here, never straight from ../../../src/lib/embed-knobs, so there is
// exactly one place that names the crossing (same style as
// embed-formats.ts's DEC-785 crossing / embed-fields.ts's DEC-673 crossing).
export {
  EMBED_SURFACES,
  type EmbedSurface,
  type EmbedKnob,
  type TrackKnobMode,
  knobsForSurface,
  trackKnobMode,
  EMBED_KNOBS_BY_SURFACE,
} from '../../../src/lib/embed-knobs';
