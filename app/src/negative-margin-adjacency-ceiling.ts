// Negative-margin adjacency ratchet -- RATCHET module (DEC-919 wave-152
// amendment, task w8-eg; app/src/negative-margin-adjacency.scan.test.ts's
// own header states verbatim: NEGATIVE_MARGIN_ADJACENCY_CEILING is
// scripts/exit-predicate.ts's own OUT_OF_CAMPAIGN_SCOPE entry, so this
// declaration must remain the ONLY source in the tracked tree carrying
// the exact literal `export const NEGATIVE_MARGIN_ADJACENCY_CEILING =
// <int>;` line -- isolated into its own file so every worker re-measuring
// the ratchet touches only this constant and its history comment, not the
// parsing/check machinery in the scan test itself (mirrors
// app/src/phone-overflow-scan/starved-track-ceiling.ts's precedent).
//
// -- Mechanism --------------------------------------------------------------
// The hazard this ratchet instruments (recorded in the field guide as a
// mechanism with no instrument until this wave): a negative top/all-sides
// margin authored to tuck a rule under a SIBLING selector, correct only
// while that sibling is `display: none` -- if some `@media` block later
// reveals the sibling (changes its `display` away from `none`) without the
// pulling rule's own negative margin being neutralised for that same width,
// the pull now drags the rule on top of the newly-visible sibling,
// superimposing both. The one known live instance
// (app/src/pages/submissions/detail.css's `.chq-detail-placement` pulling
// under the h1 while `.chq-detail-byline` was display:none, then the
// terminal phone block revealing the byline) was repaired before this
// instrument landed (detail.css's phone block now carries
// `.chq-detail-placement { margin-top: 0; }`, pinned by
// app/src/pages/submissions/detail-head-390.test.ts:128) -- this ratchet
// seeds against that already-fixed tree, not re-opening it.
//
// -- Ratchet --------------------------------------------------------------
// v12m-w8-eg (wave-152, task w8-eg, DEC-919 amendment): first landing of
// this instrument. Forced to -1 and read back against this branch's tree:
// the population is exactly the 16 negative margin/margin-top/margin-
// block-start declarations (with a negative top/all-sides component) named
// in this task's brief, spanning 43 CSS sources. Of those 16, none carries
// a preceding-comment receipt naming an EXTERNAL sibling selector (a
// `.chq-*` class token distinct from the declaring rule's own selector)
// whose base (non-media) rule is `display: none` AND whose display is
// revealed by some `@media` block in the same sheet -- i.e. the mechanism
// this instrument exists to catch does not currently recur anywhere in the
// tracked population. Zero offenders.
export const NEGATIVE_MARGIN_ADJACENCY_CEILING = 0;
