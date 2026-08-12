// DEC-673: the ONLY module that crosses the app/ -> src/ boundary for the
// embed card-field vocabulary. Every SPA consumer imports from here, never
// straight from ../../../src/lib/card-fields, so there is exactly one place
// that names the crossing (same style as merge-fields.ts's DEC-660).
export { ALL_CARD_FIELDS, type CardField } from '../../../src/lib/card-fields';
