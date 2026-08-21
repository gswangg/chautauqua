// Local-comment-stripper ratchet -- RATCHET module (DEC-374/DEC-613, wave
// v12m-w8 task w8-ef). Second offender class of the same instrument: a test
// file that declares its OWN CSS-comment-stripping function instead of
// importing test/helpers/strip-css-comments.ts's shared, string-aware one
// (DEC-613: "a second copy of a vocabulary is a trap with a delay fuse" --
// already sprung, per this task's own description, by at least four private
// copies). Isolated into its own file for the same reason as
// ./ceiling.ts and app/src/phone-overflow-scan/starved-track-ceiling.ts:
// the ONLY declaration in the tracked tree carrying the exact literal
// `export const LOCAL_CSS_COMMENT_STRIPPER_CEILING = <int>;` line.
//
// -- Ratchet --------------------------------------------------------------
// v12m-w8-ef (wave 152, task w8-ef, DEC-374 amendment): first landing.
// Forced to -1 and the offender list read back against this branch's tree:
// EXACTLY 103 files declare their own local `strip[Css]Comments`-shaped
// function instead of importing test/helpers/strip-css-comments.ts --
// including the four this task's own description names by file (the
// promoted-from origin app/src/cancelled-padding-gap.scan.test.ts, plus
// test/vocabulary-duplication-ratchet.scan.test.ts,
// test/display-heading-line-height.scan.test.ts, and
// test/served-content-type-single-source.scan.test.ts). See
// test/comment-blind-css-assertion.scan.test.ts's own offender-list output
// for the full 103-file list. This wave ships the INSTRUMENT only --
// migrating the named files onto the shared helper is explicitly a later,
// separately-ruled wave.
// v12m-w11-pg (wave 155, task w11-pg, DEC-374 phone-frame drain): 6 of the
// 102 offenders were the campaign's own phone-frame receipts
// (app/src/pages/contacts/contacts-phone-cascade-tap.test.ts,
// app/src/pages/contacts/contacts-phone-floor.test.ts,
// app/src/pages/settings/settings-phone-floor.test.ts,
// test/home-phone-frames.test.ts, test/portal-phone-frames.test.ts,
// test/public-agenda-phone-frames.test.ts) -- each declared its own local
// `stripComments`-shaped function (DEC-613) instead of importing
// test/helpers/strip-css-comments.ts. All six local copies were deleted and
// replaced with the shared import; every assertion in every touched file
// still passed once routed through the real stripper -- no false receipt
// was found in this batch. Ceiling lowered by exactly 6, 102 -> 96.
export const LOCAL_CSS_COMMENT_STRIPPER_CEILING = 96;
