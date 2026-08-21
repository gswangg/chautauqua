// Comment-blind CSS-assertion ratchet -- RATCHET module (DEC-374 amendment,
// wave v12m-w8 task w8-ef). Split into its own file, following
// app/src/phone-overflow-scan/starved-track-ceiling.ts's precedent, so a
// worker re-measuring this ratchet touches only this constant and its
// history comment, never the population/detection machinery in
// test/comment-blind-css-assertion.scan.test.ts -- and so this is the ONLY
// declaration in the tracked tree carrying the exact literal
// `export const COMMENT_BLIND_CSS_ASSERTION_CEILING = <int>;` line.
//
// This lives under app/src/ (rather than test/, where the scan test itself
// lives) specifically so it is a real member of module-reachability's
// walked population and must carry its own ENTRY_OR_ALLOWED entry -- same
// shape as starved-track-ceiling.ts, whose only importer is a *.test.ts
// file and therefore confers no static reachability (DEC-518).
//
// -- Ratchet --------------------------------------------------------------
// v12m-w8-ef (wave 152, task w8-ef, DEC-374 amendment): first landing of
// this instrument. Forced to -1 and the offender list read back against
// this branch's tree: EXACTLY 39 files apply a `toMatch`/`not.toMatch`
// assertion directly to a `*_CSS` / `*_PHONE_BLOCK` identifier (or a
// `readFileSync(...'.css')` variable) with no comment-stripping call
// anywhere in the file -- see
// test/comment-blind-css-assertion.scan.test.ts's own offender-list output
// for the full 39-file list. This wave ships the INSTRUMENT only -- it
// changes no product byte and repairs none of the offenders it finds (that
// migration is explicitly a later, separately-ruled wave per this task's
// own description).
// v12m-w11-pg (wave 155, task w11-pg, DEC-374 phone-frame drain): 5 of the
// 38 offenders were the campaign's own phone-frame receipts
// (app/src/pages/agenda/agenda-phone-frame.test.ts,
// app/src/pages/comms/comms-drill-phone-frames.w7d.test.ts,
// app/src/pages/content/content-phone-frames.test.ts,
// app/src/pages/forms/forms-phone-frames.test.ts,
// test/portal-session-phone-frames.test.ts) -- each was routing its CSS
// source through a naive inline `.replace(/\/\*[\s\S]*?\*\//g, '')` (never
// a call named `strip...comments(`, so the instrument still counted them
// blind) rather than the shared, string-aware helper. All were migrated to
// import test/helpers/strip-css-comments.ts; every assertion in every
// touched file still passed once routed through the real stripper -- no
// false receipt (a comment-satisfied assertion) was found in this batch.
// Ceiling lowered by exactly 5, 38 -> 33.
// v12m-w13-rf (wave-157 batch A, DEC-374/DEC-967): assigned five phone-frame
// receipts (app/src/pages/review/review-phone-frames.test.ts,
// app/src/pages/review/review-admin-phone-frames.test.ts,
// app/src/pages/review/scorecard-phone-frames.test.ts,
// app/src/pages/content/content-phone-frames.test.ts,
// app/src/pages/forms/forms-phone-frames.test.ts). Two of the five
// (content-phone-frames.test.ts, forms-phone-frames.test.ts) were already
// migrated to the shared stripper by v12m-w11-pg (wave 155) and were not in
// the live offender list -- no work needed there. The remaining three
// (review-phone-frames.test.ts, review-admin-phone-frames.test.ts,
// scorecard-phone-frames.test.ts) were migrated from a private
// `.replace(/\/\*[\s\S]*?\*\//g, '')` inline regex to
// test/helpers/strip-css-comments.ts's `stripCssComments`. Every assertion
// in all three still passed once routed through the real stripper -- no
// vacuous (comment-satisfied) receipt was found in this batch; the drain is
// purely instrument migration, not a repair. v12m-w13-rf drains 3 more of
// the same 38 in this batch; the merge train re-measures. Ceiling lowered
// by exactly 3, 33 -> 30.
export const COMMENT_BLIND_CSS_ASSERTION_CEILING = 30;
