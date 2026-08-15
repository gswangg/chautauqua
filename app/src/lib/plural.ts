// DEC-957: the ONLY module that crosses the app/ -> src/ boundary for the
// count-phrase vocabulary (same style as merge-fields.ts's DEC-660). Every
// SPA consumer imports plural/countOf from here, never straight from
// ../../../src/domain/count-copy, so there is exactly one implementation.
export { plural, countOf, spellCount, capitalizeFirst, thingsNeedFixingHeading } from '../../../src/domain/count-copy';
