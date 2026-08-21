// Frame caption/consequence ledger -- RATCHET module (DEC-976 wave-133;
// split from test/frame-caption-ledger.scan.test.ts by the
// contention-custodian decomposition, no behaviour change).
//
// FRAME_CAPTION_UNMATCHED_CEILING is scripts/exit-predicate.ts's own
// campaign constant (CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES): that
// script scans `git ls-files -- test app/src scripts` for a literal
// `export const FRAME_CAPTION_UNMATCHED_CEILING = <int>;` line, so this
// declaration must remain the ONLY file in that tree carrying that exact
// literal form (a re-export elsewhere is a different syntax shape and does
// not match its regex). Isolated into its own file because every worker
// re-measuring the ratchet touches only this constant and its history
// comment, not the population/exclusion/match machinery above it.
//
// Contention-custodian decomposition (wave-150): the full measurement
// history (every lane's re-derivation, every merge-train reconciliation,
// every RATCHET note) previously lived in this file as ~380 lines of prose
// wrapped around the one live constant below -- four recorded merge
// conflicts on this file were near-identical-insertion-point collisions in
// that history, not on the constant itself. The history now lives in
// ./ceiling-history.md (append new measurement entries there); this file
// carries only the live value and the rule that governs it. No behaviour
// change: the exported name, its type and its current value are unchanged,
// and the literal `export const FRAME_CAPTION_UNMATCHED_CEILING = <int>;`
// form scripts/exit-predicate.ts requires still appears exactly once in the
// scanned tree, here.
//
// RATCHET: this ceiling may only be RAISED as a merge-train act (a
// predicate widening surfacing real divergences that were previously
// hidden), and should be LOWERED whenever a lane closes a real
// caption/consequence gap. Never hand-edit this value without re-measuring
// per ./ceiling-history.md's own standing rule: forced to -1, the two-sided
// ratchet in test/frame-caption-ledger.scan.test.ts prints the exact
// offender count -- that measurement, never a guess and never a lane's
// pre-merge figure, is what belongs here.
//
// Last measured (see ./ceiling-history.md's final entry, wave-150
// THUNDERDOME megabatch): 0. Carried forward from main's re-seed at merge
// of this decomposition -- the decomposition itself moved history only and
// changed no value. This figure MUST be re-measured against the fully
// integrated wave-150 tree per this file's standing rule (forced to -1, the
// offender count read back), never carried on faith.
export const FRAME_CAPTION_UNMATCHED_CEILING = 0;
