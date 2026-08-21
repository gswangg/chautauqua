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
export const COMMENT_BLIND_CSS_ASSERTION_CEILING = 39;
