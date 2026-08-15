// DEC-747 amendment: the ONLY module that crosses the app/ -> src/ boundary
// for the wiki-page Markdown syntax hint (same style as merge-fields.ts's
// DEC-660 crossing). Every SPA consumer imports from here, never straight
// from ../../../src/lib/markdown, so there is exactly one place that names
// the crossing and the hint text can never drift from the allow-list it
// describes.
export { MARKDOWN_SYNTAX_HINT } from '../../../src/lib/markdown';
