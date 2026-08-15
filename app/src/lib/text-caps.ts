// DEC-660 (amendment): the ONLY module that crosses the app/ -> src/
// boundary for the four free-text caps, same style as merge-fields.ts's
// DEC-660 crossing and file-caps.ts's DEC-660/DEC-160 crossing. Every SPA
// consumer imports these caps from here, never straight from
// ../../../src/forms/validate, so there is exactly one place that names
// the crossing.
export {
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_LONG_TEXT_LENGTH,
  MAX_RICH_TEXT_LENGTH,
} from '../../../src/forms/validate';
