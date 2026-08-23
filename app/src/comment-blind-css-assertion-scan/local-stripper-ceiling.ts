// Local-comment-stripper ratchet -- RATCHET module (DEC-374/DEC-613, wave
// v12m-w8 task w8-ef). Second offender class of the comment-blind-css-
// assertion instrument: a test file that declares its OWN CSS-comment-
// stripping function instead of importing test/helpers/strip-css-comments.ts's
// shared, string-aware one (DEC-613: "a second copy of a vocabulary is a trap
// with a delay fuse"). Isolated into its own file for the same reason as
// ./ceiling.ts and app/src/phone-overflow-scan/starved-track-ceiling.ts: the
// ONLY declaration in the tracked tree carrying the exact literal
// `export const LOCAL_CSS_COMMENT_STRIPPER_CEILING = <int>;` line.
//
// CONTENTION DECOMPOSITION (structure-custodian pass, wave 50, task
// custodian-app_src_comment_blind_css_assertion_scan_local_stripper_ceiling_ts):
// this file had drawn 4 merge conflicts across waves, entirely because every
// re-measurement appended prose to a multi-hundred-line wave-by-wave history
// living as `//` comments directly above the one line that actually matters.
// The narrative carries no runtime behaviour and nothing in the tree parses
// its text (verified: only the exported constant is imported anywhere; no
// scan/test greps this file's comment bytes) -- so the full history was
// moved, verbatim and unedited, to
// docs/design/audit/local-css-comment-stripper-ceiling-history.md, a `.md`
// file outside module-reachability's `.ts`/`.tsx`/`.css` scan population
// (test/module-reachability.scan.test.ts's NON_TEST_MODULES glob), so no new
// ENTRY_OR_ALLOWED entry is needed. This module now carries only the live
// value and a pointer to that history. No behaviour change: the export's
// name, type and value are unchanged, and this remains the ONLY declaration
// of `LOCAL_CSS_COMMENT_STRIPPER_CEILING` in the tree.
//
// Full wave-by-wave ratchet history (v12m-w8-ef through v12m-w45-d):
// see docs/design/audit/local-css-comment-stripper-ceiling-history.md.
// Append future waves' entries there, not here -- this file should stay a
// one-line-of-substance module going forward.
//
// v12m-custodian-w50-13 (wave 50, decomposition pass): the two-sided
// companion measured RED independently of this decomposition (reproduced on
// unmodified main via `git stash`/re-run before touching this file) --
// population drift by other lanes' drain work, same shape prior waves'
// history already documents repeatedly. Re-measured with the ceiling forced
// to -1: 60, one below the declared 61. Lowered to match the live count,
// never by arithmetic on a batch size.
export const LOCAL_CSS_COMMENT_STRIPPER_CEILING = 60;
