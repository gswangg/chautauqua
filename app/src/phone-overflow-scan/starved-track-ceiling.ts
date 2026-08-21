// Starved flex-track ratchet -- RATCHET module (DEC-919 wave-149 amendment;
// split from app/src/phone-horizontal-overflow.scan.test.ts by the same
// contention-custodian decomposition test/frame-caption-ledger/ceiling.ts's
// own header states verbatim: STARVED_FLEX_TRACK_CEILING is
// scripts/exit-predicate.ts's own campaign constant
// (CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES), so this declaration must
// remain the ONLY source in the tracked tree carrying the exact literal
// `export const STARVED_FLEX_TRACK_CEILING = <int>;` line -- isolated into
// its own file so every worker re-measuring the ratchet touches only this
// constant and its history comment, not the population/check machinery in
// ./checks.ts.
//
// -- Ratchet --------------------------------------------------------------
// v12m-w5-bf (wave-149, task w5-bf, DEC-919): first landing of this
// instrument. Forced to -1 and read back against this branch's tree:
// EXACTLY TWO offenders, matching the wave-149 meta-fidelity probe's own
// hand-measurement --
//   app/src/pages/settings/settings.css :: .chq-settings-track-edit-row
//     (minmax(0, 1fr) 150px 200px, 8.0px per flexible track against a 200px
//     widest fixed track)
//   app/src/pages/forms/forms.css :: .chq-forms-rule-row
//     (1fr 120px 1fr, 109.0px per flexible track against a 120px fixed
//     middle track)
// Sibling lane v12m-w5-bg repairs both offenders concurrently (re-lining
// each into its sheet's terminal phone block); this task owns only the
// instrument, not the repair, and does not touch either stylesheet -- the
// merge train re-measures the integrated tree once both lanes land
// (DEC-989 wave-146's "the merge train re-measures every touched constant
// once per batch", restated here for this brand-new ratchet's first
// re-seed).
//
// THUNDERDOME MEGABATCH (wave-150, 19-branch batch): both lanes landed in the
// same batch -- w5-bf's instrument and w5-bg's repair of the two offenders it
// named. Re-measured against the fully integrated tree exactly as this
// ratchet's own stale-ceiling failure message instructs (forced to -1, the
// offender list read back): ZERO starved flexible tracks remain. Lowered
// 2 -> 0. This is the ratchet working, not a widening: the population and the
// check in ./checks.ts are untouched.
export const STARVED_FLEX_TRACK_CEILING = 0;
