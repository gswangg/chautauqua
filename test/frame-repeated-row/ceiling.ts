// Frame REPEATED-ROW ledger -- RATCHET module (DEC-180 wave-40; task
// w40-d), following test/frame-caption-ledger/ceiling.ts's own idiom: the
// live ceiling value lives ALONE in its own file so every future
// re-measurement of the ratchet touches only this constant and its history
// comment, never the population/match machinery in
// test/frame-repeated-row.scan.test.ts.
//
// FRAME_REPEATED_ROW_GAP_CEILING is NOT YET a registered campaign constant
// -- scripts/exit-predicate.ts's own CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES
// tables (owned by task v12m-w37-c) do not scan for this name yet. See
// docs/design/audit/frame-repeated-row-v12.md for the registration note and
// the DEC-069 clause (b) condition a later lane must satisfy before adding
// it there. Declaring the constant in its own module now (rather than
// waiting for registration) means the same
// "forced to -1, read the printed roster" measurement discipline this
// campaign requires of every other ceiling already applies here, and the
// literal `export const FRAME_REPEATED_ROW_GAP_CEILING = <int>;` form
// appears exactly once in the tree, in this file, the moment a future lane
// does register it.
//
// RATCHET: this ceiling may only be RAISED as a merge-train act (a
// predicate widening surfacing real gaps that were previously hidden), and
// should be LOWERED whenever a lane closes a real repeated-row gap. Never
// hand-edit this value without re-measuring: force it to -1 in
// test/frame-repeated-row.scan.test.ts, run the suite, and read the exact
// GAP count the thrown error prints back -- that measurement, never a guess
// and never arithmetic, is what belongs here.
//
// Last measured (wave-40, task w40-d, measured against this worktree's own
// docs/design/*.dc.html + app/src/** + src/** at HEAD 3e2547267 "scribe
// wave 40"): forced to -1 in test/frame-repeated-row.scan.test.ts and read
// back from the thrown error's own roster -- 90 GAP rows out of 201. See
// docs/design/audit/frame-repeated-row-v12.md for the full per-row roster
// this figure is drawn from.
//
// Re-measured (multi-portal): 89 -- the participant home's per-item rows
// (src/routes/portal/home.tsx ItemRow) now draw one more repeated row the
// v12 Public and Portal frame shows.
export const FRAME_REPEATED_ROW_GAP_CEILING = 89;
