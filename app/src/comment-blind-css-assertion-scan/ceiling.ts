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
//
// v12m-w12-qj (wave 156, DEC-374 wave-156 amendment): migrated the nine
// phone-frame receipt files this task owns (review-phone-frames.test.ts,
// review-admin-phone-frames.test.ts, scorecard-phone-frames.test.ts,
// content-phone-frames.test.ts, forms-phone-frames.test.ts,
// agenda-phone-frame.test.ts, comms-drill-phone-frames.w7d.test.ts,
// test/portal-session-phone-frames.test.ts, test/cfp-phone-steps.test.ts)
// onto the shared, string-aware test/helpers/strip-css-comments.ts, each
// replacing a private `.replace(/\/\*[\s\S]*?\*\//g, '')`-shaped regex (or,
// for portal-session-phone-frames.test.ts / cfp-phone-steps.test.ts, no
// stripping at all) with a real `stripCssComments(...)` call. Re-measured
// with the ceiling forced to -1: 29 offenders remain (down from 38), and
// none of the nine migrated files are among them -- every assertion in all
// nine stayed green against the stripped source, so this migration found
// no false receipt to repair in this file set (the naive local regexes
// were, on inspection, already comment-correct for the CSS these nine
// files hold; the one deliberate exception, cfp-phone-steps.test.ts's
// DEC-919 "phone-hidden:" receipt check, still reads the RAW source on
// purpose, since that assertion's subject IS the comment). Migrating the
// remaining 29 offenders is explicitly a later, separately-ruled wave.
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
// v12m-w13-rg (wave 157, task rg, DEC-374 amendment, phone-frame batch B):
// re-measured against the same 38-on-main population lane rf shares. Of
// this batch's four assigned files
// (app/src/pages/agenda/agenda-phone-frame.test.ts,
// app/src/pages/comms/comms-drill-phone-frames.w7d.test.ts,
// test/portal-session-phone-frames.test.ts, test/cfp-phone-steps.test.ts),
// three were already routed through the shared stripper by an earlier
// wave (v12m-w11-pg) and were never in the live 33-offender set measured
// here; only test/cfp-phone-steps.test.ts was still comment-blind (a raw
// `CFP_CSS` fed directly into `toMatch`, no stripping call in the file).
// Migrated it to import test/helpers/strip-css-comments.ts, applied to
// every product-content assertion; the one assertion that deliberately
// checks a COMMENT's own presence (the DEC-919 `phone-hidden:` receipt)
// was repointed at the raw, unstripped source instead, since stripping
// would erase the very text it is testing for. Every assertion in the
// file still passed once routed through the real stripper -- no vacuous
// receipt (a comment-satisfied assertion) was found in this batch.
// Ceiling lowered by exactly 1, 33 -> 32; v12m-w13-rf drains N more of the
// same 38 in this batch; the merge train re-measures.
// v12m-w4-bg (wave 4, task w4-bg, DEC-374/DEC-613): measured RED at this
// branch's tree (forced -1, offender list read back) BEFORE any change: 34,
// against a stale-looking 29 ceiling (the two-sided companion had already
// gone red the other way from lanes draining without lowering this
// constant). Converted 5 offenders assigned by this task
// (app/src/pages/comms/Comms.phone.render.test.tsx,
// app/src/pages/comms/comms-phone-floor.test.ts,
// app/src/pages/review/PlanEditor.render.test.tsx,
// app/src/pages/settings/SettingsPanels.frame390.render.test.tsx,
// app/src/pages/speakers/speakers-pager-button-tap-floor.test.ts) to route
// their `*_CSS`/`*_PHONE_BLOCK` source through the shared
// test/helpers/strip-css-comments.ts stripCssComments before any
// toMatch/not.toMatch assertion. comms-phone-floor.test.ts's own local
// `.replace(/\/\*[\s\S]*?\*\//g, '')` inside ruleBodyFor was also replaced
// by the shared stripper, but the file's intentional raw-source assertion
// (the `overflow-exempt:` comment-presence check on COMMS_CSS itself) was
// left untouched -- that assertion's SUBJECT is a comment, so stripping
// would make it false, not vacuous (DEC-374's subject test). Every other
// touched assertion still passed once routed through the real stripper --
// no vacuous receipt was found in this batch. Re-measured offender count
// after conversion: 29, exactly 34-5, confirmed by forcing this ceiling to
// -1 again. Ceiling stays at 29 (measured count now sits AT the ceiling,
// not below it).
export const COMMENT_BLIND_CSS_ASSERTION_CEILING = 29;
