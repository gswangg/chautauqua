// Width-half tap-floor ratchet -- RATCHET module (DEC-808 wave-26, task
// w26-j), isolated into its own file so it is never a shared-file conflict
// (the `app/src/phone-overflow-scan/starved-track-ceiling.ts` and
// `test/frame-caption-ledger/ceiling.ts` precedent: `scripts/exit-
// predicate.ts`'s own campaign constant (CAMPAIGN_CONSTANT_NAMES /
// TIER2_CEILING_NAMES) must remain the ONLY source in the tracked tree
// carrying the exact literal `export const WIDTH_FLOOR_OFFENDERS_CEILING =
// <int>;` line, so every worker re-measuring it touches only this constant
// and its history comment, not the population/predicate machinery in
// ./width-floor.ts.
//
// -- Ratchet history --------------------------------------------------------
// v12m-w26-j (wave-26, task w26-j, DEC-393/DEC-808): first landing of this
// instrument. Forced to -1 and the printed offender list read back against
// this branch's tree: the population (five glyph-only/empty-with-aria-label
// sites -- app/src/pages/agenda/DayGrid.tsx:410 [render-gate exempt],
// app/src/pages/contacts/FilterRulesPanel.tsx:274, app/src/pages/settings/
// TracksRoomsPanel.tsx:270, app/src/pages/settings/tracksRooms/
// TrackEditRow.tsx:55, src/routes/public/filters.tsx:37) is small because
// every one of them was ALREADY hand-repaired with a `min-width: 44px`
// declaration in a prior wave (DEC-367's own citations, docs/design/
// audit/tap-width-floor-390-v12.md) -- this instrument's job is to make
// those repairs GRADED going forward (DEC-851: an idiom with no reader),
// not to find a fresh backlog. ZERO offenders measured. This is a WIDENING
// lens (DEC-808 protocol): the ceiling is measured and filed, not driven
// down by fixing any offender in this same change -- there was none to fix.
export const WIDTH_FLOOR_OFFENDERS_CEILING = 0;
