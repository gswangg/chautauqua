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
// v12m-w19-b (wave 19, task w19-b, DEC-374/DEC-613 drain continued):
// converted 8 more local strippers to the shared import --
// app/src/pages/contacts/contacts-head-band-390.test.ts,
// app/src/pages/contacts/contacts-rule-chips-390.test.ts,
// app/src/pages/overview/overview-phone-floor.test.ts,
// app/src/pages/overview/overview-link-register.test.ts,
// app/src/pages/agenda/agenda-phone-floor.test.ts,
// app/src/phone-dock-desktop-hidden.test.ts,
// app/src/phone-layer-source-order.test.ts,
// app/src/pages/page-sheet-source-order.test.ts. Deliberately left alone:
// app/src/pages/contacts/contacts-segment-pills-390.test.ts (its private
// stripper blanks comments byte-for-byte in place so downstream offsets
// stay valid indices into the RAW file, e.g. `CSS.slice(block.start,
// block.end)`; the shared helper only preserves newline COUNT through a
// multi-line comment, not column width, so swapping it in would desync
// every such offset), and test/breakpoint-conformance.test.ts,
// test/control-class-conformance.test.ts, test/dialog-conformance.test.ts
// (each also strips `//` line comments over .tsx/.ts sources -- a real
// capability the shared helper, CSS-`/* */`-only, does not have; dropping
// it would silently stop stripping line comments, not just change offsets).
// Every touched file's own tests still passed once routed through the real
// stripper -- no false receipt was found in this batch. All 8 converted
// files were confirmed (by forcing this ceiling to -1 and reading the
// offender-list detail) to be counted in the pre-conversion measurement.
// Re-measured offender count after conversion: 91 -- not 96-8=88, so
// re-derive from the real number, never arithmetic on the batch size.
// Ceiling lowered to match: 96 -> 91.
// v12m-w20-d (wave 20, task w20-d, DEC-613 amendment): measured RED at this
// branch's tree (forced -1, offender list read back) BEFORE any change: 94,
// not the 91 the ceiling declared and not the 99 the wave-20 planner's brief
// cited -- re-derive from the real number, never trust a snapshot (of the
// nine files named by the brief, two -- app/src/phone-dock-desktop-hidden.
// test.ts and app/src/phone-layer-source-order.test.ts -- were already
// migrated to the shared import by v12m-w19-b and are not offenders; no
// change was made to either). Converted 6 of the remaining 7 to import
// test/helpers/strip-css-comments.ts's shared, string-aware stripCssComments
// in place of a local strip[Css]Comments declaration:
// app/src/phone-block-visibility.test.ts, app/src/phone-cascade-terminal.
// test.ts, app/src/phone-dock-declares.scan.test.ts,
// app/src/phone-label-source.scan.test.ts,
// app/src/phone-scaffold-orphan.scan.test.ts,
// test/phone-cascade-order.scan.test.ts. Every touched file's own tests
// still passed once routed through the real stripper -- no false receipt
// was found in this batch. Deliberately left alone: test/phone-terminal-
// block.scan.test.ts -- its local stripComments blanks `/* ... */` comments
// BYTE-FOR-BYTE IN PLACE (same character count, non-newline chars replaced
// with spaces) specifically so char offsets it computes on the stripped
// text stay valid indices into the RAW cssText (the file's own comments at
// :56 and :418 name this invariant explicitly); the shared helper instead
// DELETES a same-line comment outright (no length-preserving residue),
// which would desync every such offset -- the same shape DEC-613's wave-19
// amendment already carved out for app/src/pages/contacts/
// contacts-segment-pills-390.test.ts. Re-measured offender count after
// conversion: 88 -- exactly 94-6, confirmed by forcing this ceiling to -1
// again and reading the offender list (test/phone-terminal-block.scan.
// test.ts still present, the six converted files absent, the two
// already-migrated files absent as before). Ceiling lowered to match: 91 ->
// 88.
// Thunderdome megabatch integration (medic pass): the two-sided companion
// went RED the other way -- the measured population had fallen BELOW the
// declared 88, which this instrument treats as a stale ceiling licensing
// stagnation. Re-derived on the integrated tree: 86. The drop is real drain
// work by lanes and repair commits that converted further local strippers to
// test/helpers/strip-css-comments.ts's shared one without lowering this
// constant (a lane-local run never includes this repo-wide scan, so nothing
// told them): 090a7628 (wave-156 phone-frame receipts), ee6086a9
// (forms-phone-390) and 6f0b5d48 (contacts head-band-face / rule-builder /
// rule-chip-dismiss) all land inside this batch. Lowered 88 -> 86 from the
// re-measured number, never by arithmetic on the batch size.
// v12m-w4-bg (wave 4, task w4-bg, DEC-374/DEC-613): measured RED at this
// branch's tree (forced -1, offender list read back) BEFORE any change: 87,
// one over the declared 86. Converted the one offender assigned by this
// task, app/src/pages/agenda/agenda-painted-face.test.ts, whose private
// inline `stripComments` (a plain `.replace(/\/\*[\s\S]*?\*\//g, '')`) was
// replaced with an import of test/helpers/strip-css-comments.ts's shared,
// string-aware stripCssComments -- no offset/length-preserving invariant
// depended on the old regex here, so the swap is a straight substitution.
// Every touched test still passed once routed through the real stripper.
// Re-measured offender count after conversion: 86, exactly 87-1, confirmed
// by forcing this ceiling to -1 again. Ceiling stays at 86.
// v12m-w5-cd (DEC-374 amendment): converted 2 local-stripper declarations
// to the shared import -- app/src/css-contract.scan.test.ts's local
// `stripComments` (deleted the declaration, every call site now calls the
// imported `stripCssComments` directly; its sibling `stripTsxComments`,
// which also strips `//` line comments over .tsx source -- a capability
// the shared CSS-only helper doesn't have -- was deliberately left alone)
// and app/src/error-vocabulary.test.ts's local `stripComments` (deleted,
// replaced with the shared import). Every assertion in both files still
// passed once routed through the real stripper -- no vacuous receipt was
// found in this batch. Re-measured with the ceiling forced to -1: 85
// offenders remain (down from 87). Ceiling lowered to match: 86 -> 85.
// Thunderdome megabatch integration: w4-bg and w5-cd drained DISJOINT
// offender sets in the same batch, so neither lane's declared value is the
// integrated count. Re-derived on the merged tree at megabatch validation
// (2026-08-22): 84 offenders. Both lanes measured the same pre-batch
// population of 87; w4-bg converted 1 (agenda-painted-face.test.ts) and
// left the constant at 86, w5-cd converted 2 (css-contract.scan.test.ts,
// error-vocabulary.test.ts) and lowered 86 -> 85. The two sets are
// disjoint, so the integrated tree carries both drains: 87 - 3 = 84 --
// confirmed by re-running the scan's own class-2 detector over the full
// discovered population, never by arithmetic alone. Ceiling lowered to
// match the measured value: 85 -> 84.
// Thunderdome megabatch integration (medic pass, 2026-08-22): the two-sided
// companion went red again the same way -- the integrated tree measures 83,
// one BELOW the 84 the previous note derived. 84 was measured mid-integration,
// before every lane's merge had landed; the scan re-run on the final merged
// tree (`npx vitest run test/comment-blind-css-assertion.scan.test.ts`, whose
// own failure text names the value) reports 83. No test file was changed by
// this medic pass to produce the drop -- the three commits after the last
// merge (scribe waves 15/16, the round-4 probe sweep) touch only
// docs/probes, field-guide and src/decisions-data. Lowered 84 -> 83 from the
// re-measured number, never by arithmetic on a batch size.
// v12m-w26-f (wave 26, task w26-f, DEC-374 wave-26 amendment, v12-frame-
// evidence drain): measured RED at this branch's tree (forced -1, offender
// list read back) BEFORE any change: 83, matching the ceiling. Attempted 8
// of the 10 files this task's brief named as confirmed candidates.
// CONVERTED (2), both genuinely CSS-only content -- a real .css-file
// population or an already-extracted CSS-string constant, with no raw
// TypeScript prose in the input: test/portal-w6-h-dock.test.ts (strips the
// imported PORTAL_CSS string constant) and
// test/filled-control-hover-label.scan.test.ts (strips real app/src/**/*.css
// file text only). Every assertion in both files still passed once routed
// through the real stripper -- no false receipt was found in this batch.
// NOT CONVERTED (6), a newly-discovered THIRD carve-out class, distinct
// from the two this ratchet's module header documents: test/helpers/
// strip-css-comments.ts's stripCssComments is quote-tracking (it recognises
// `"`/`'` string delimiters so a CSS `content: "/*";` isn't mistaken for a
// real comment) but has no notion of `//` line comments at all. Fed a WHOLE
// raw `.ts`/`.css.ts` module (as opposed to just its extracted CSS
// template-literal body), an ordinary English contraction or quoted phrase
// inside the file's own `//`-comment prose (e.g. auth.css.ts's header
// "which would corrupt any quoted font-family name") is read as a string
// OPEN with no corresponding close, desyncing the state machine for
// everything downstream in the file -- real `/* */` CSS comments stop being
// recognised as comments at all. Caught live: converting
// test/public-page-title-register.scan.test.ts flipped its own
// "every h1-ish selector has a REGISTER_TABLE row" assertion red, reporting
// a phantom offender whose "selector" text was two whole DEC-369/DEC-367
// comment blocks concatenated with the real .chq-auth-back selector --
// not a hidden offender, a corrupted parse. A population-wide direct diff
// (naive-regex-stripped length vs shared-stripper-stripped length) across
// every src/routes/**/*.ts and src/views/**/*.ts file confirmed this is
// severe and widespread, not one file's fluke: src/routes/review/
// reviewer.ts collapses from 31647 real characters to 641 under the shared
// stripper, and roughly two-thirds of that population ends the file still
// "inside a string". Left unconverted, each with its own carve-out comment
// at its declaration site: test/disabled-token-uses.scan.test.ts and
// test/display-heading-line-height.scan.test.ts (both read raw
// src/views/theme.ts), test/on-brand-anchor-hover.scan.test.ts and
// test/ssr-css-contract.scan.test.ts (both read raw .ts modules under
// src/routes/**, src/views/**), test/public-page-title-register.scan.test.ts
// (reads raw .css.ts modules) and test/pack-declaration-vocabulary.scan.
// test.ts (its findDeclarations is shared between the pack docs/design/
// *.dc.html population, unaffected, and the product population via test/
// helpers/ssr-css-sources.ts's ssrCssSources(), which reads raw .ts -- the
// two populations share one function, so the whole file was left alone
// rather than partially converting). This third carve-out class likely
// blocks converting a large fraction of the ratchet's remaining offenders
// (most touch theme.ts or another raw .ts module) until either
// stripCssComments itself is taught `//`-line-comment awareness or each
// call site is changed to extract only the CSS template-literal body before
// stripping -- both out of this task's scope. Re-measured with the ceiling
// forced to -1 again: 81, exactly 83-2, confirmed by reading the offender
// list (the two converted files absent, all others -- including the six
// left alone -- present as before). Ceiling lowered to match: 83 -> 81.
export const LOCAL_CSS_COMMENT_STRIPPER_CEILING = 81;
