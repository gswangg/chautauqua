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
// v12m-w29-h (DEC-613 wave-29): population WIDENED (DEC-180/DEC-367) from
// "every *.test.ts(x) file" -- a suffix is not a population -- to that set
// UNION every test/**/app/src/** module reachable by static relative import
// from a test file. This closes the exact delay fuse DEC-613 named:
// app/src/test-utils/phoneBlock.ts declared its own naive
// `.replace(/\/\*[\s\S]*?\*\//g, '')` `stripCssComments`, imported by 34
// test files (`grep -rl phoneBlock app/src test src`), invisible to this
// ratchet purely because its filename lacks `.test.`. CONVERTED:
// phoneBlock.ts now imports and re-exports test/helpers/strip-css-
// comments.ts's shared, string-aware stripCssComments under the same
// name/signature -- no re-export shim, the private copy is deleted outright.
// All 34 real importers (the grep population minus phoneBlock.ts itself and
// module-reachability.scan.test.ts's mere textual mention) re-run green:
// no false receipt (a comment-satisfied assertion that only passed under
// the naive regex) was found -- every assertion in every importer still
// passes once routed through the real, string-aware stripper.
//
// The widening surfaced three more non-test local strippers, each carved
// out in test/comment-blind-css-assertion.scan.test.ts's own
// LOCAL_STRIPPER_CARVE_OUTS (excluded from the offender count, not merely
// narrated) with a capability-named reason (DEC-099):
// app/src/phone-tap-target-scan/core.ts and test/frame-source-corpus.ts and
// test/frame-caption-ledger/match.ts all recognise `//` line comments over
// general TypeScript source, a capability the shared, CSS-only
// test/helpers/strip-css-comments.ts genuinely does not have. Two further
// modules this task's own brief named as candidates -- test/source-
// comments.ts (`stripSourceComments`) and test/helpers/strip-template-
// literals.ts (`stripCommentsAndTemplateLiterals`) -- were checked directly
// against LOCAL_STRIPPER_DECL_RE and do NOT match its `strip(?:Css|CSS)?
// Comments?` naming shape, so neither is a live offender under this
// (name-based, DEC-374-original) detector and neither needed a carve-out;
// recorded here as verified-not-surfaced rather than silently omitted.
// Re-measured over the widened population with the ceiling forced to -1:
// EXACTLY 81, the same 81 files present before the widening (phoneBlock.ts
// is gone from the list -- it never declared a local stripper before this
// wave's conversion landed, so it was already outside this count; the three
// carve-outs are excluded by construction, not merely absent from the
// list). Ceiling stays at 81 (measured count sits AT the ceiling, not
// below it) -- the widening plus the phoneBlock.ts conversion plus the
// three carve-outs leaves this ratchet exactly where it was, never above.
// v12m-w36-d (wave 36, task w36-d, DEC-613 migration wave): forced -1 and
// measured RED at this branch's tree BEFORE any change: 82, one over the
// declared 81. The new offender was test/public-390-width-floor.test.ts
// (added since the last measurement, confirmed via `git log --diff-filter=A`
// over the f5336772a..HEAD range and cross-checked against the printed
// offender roster) -- migrated first, then 15 more of the campaign's own
// instruments under app/src/*.scan.test.ts (plus a few sibling *.test.ts
// files sharing the exact same CSS-file-reading shape) were converted to
// import test/helpers/strip-css-comments.ts's shared, string-aware
// stripCssComments in place of a local strip[Css]Comments declaration --
// 16 files total: test/public-390-width-floor.test.ts,
// app/src/cancelled-padding-gap.scan.test.ts (the CANONICAL origin this
// ratchet's own module header names as the file the shared helper was
// promoted FROM -- its own copy had never been deleted; its 3 real
// importers, app/src/pages/speakers/speakers-phone-floor.test.ts,
// app/src/pages/speakers/speakers-phone-tap-floor.test.ts and
// test/audit-gap-row-staleness.scan.test.ts, were updated to import the
// shared helper directly instead of re-exporting through
// cancelled-padding-gap.scan.test.ts -- no re-export shim), app/src/
// focus-treatment.scan.test.ts, app/src/interaction-states.scan.test.ts,
// app/src/no-fitted-geometry.scan.test.ts, app/src/status-density-pairing.
// scan.test.ts, app/src/table-column-contract.scan.test.ts, app/src/inline-
// style-phone-override.scan.test.ts (its local copy was already named
// `stripCssComments`, colliding in name with the shared symbol -- deleted
// outright, no rename needed at call sites), test/state-band-inset.scan.
// test.ts, test/phone-leak-guard-restore.scan.test.ts, app/src/components/
// error-states-phone.test.ts, app/src/components/modal-frame-phone.test.ts,
// app/src/components/modal-frame-title-phone-drill.test.ts, app/src/pages/
// overview/overview-painted-face.test.ts, app/src/pages/review/reviewer-
// row-parity.w4l.test.ts, app/src/pages/settings/settings-controls-390.w5o.
// test.ts.
//
// Every migrated file's own local strip function was `/\*[\s\S]*?\*\//g`-
// only (no `//` line-comment handling) and its only inputs were real `.css`
// files, `.css.ts` template-literal bodies already extracted before
// stripping, or CSS-string constants -- never a whole raw `.ts`/`.tsx`
// module -- so none of them fall into the w26-f-documented third carve-out
// class (a `//`-comment's own prose corrupting the shared stripper's
// quote-tracking state machine over raw TypeScript source). Deliberately
// left alone and NOT migrated: every remaining offender whose local
// `stripComments` also strips `//` line comments (a real capability the
// shared, CSS-only helper does not have) over raw `.ts`/`.tsx` source, and
// app/src/pages/contacts/SegmentPillStrip.bound390.render.test.tsx /
// app/src/page-measure.test.ts's inner scope-local function, both of which
// depend on their local stripper's byte-length-preserving residue to keep
// character offsets valid indices into the RAW (unstripped) source -- the
// exact invariant class DEC-613's wave-19 amendment already carved out for
// app/src/pages/contacts/contacts-segment-pills-390.test.ts.
//
// Every migrated file's own tests still passed once routed through the
// real, string-aware stripper -- no assertion behaviour changed and no
// false receipt was found in this batch (`npx vitest run --config
// vitest.fast.config.ts` over all 19 touched files: 465 tests, all green).
// Re-measured with the ceiling forced to -1 again: EXACTLY 66, matching
// 82 - 16 (16 real offenders converted; the 3 importer updates were never
// counted as offenders themselves, since they only ever imported, never
// declared, a local stripper). Ceiling lowered to match: 81 -> 66.
// v12m-w37-d (wave 37, task w37-d, DEC-613 migration wave): forced -1 and
// measured RED at this branch's tree BEFORE any change: 66, matching the
// declared ceiling. Read back the full offender roster (66 files) rather
// than trusting the 82-vs-81 figure this task's own brief cited -- w36-d
// had already landed on this branch's ancestry and moved the real number.
// Converted 2 of the 66 to import test/helpers/strip-css-comments.ts's
// shared, string-aware stripCssComments in place of a local, block-comment-
// only `stripComments` declaration -- both genuinely CSS-only content, no
// raw `.ts`/`.tsx` prose ever reaching the stripper:
// test/error-invalid-outranks-base.test.ts (its local `stripComments`
// strips ERROR_STATES_CSS/THEME_CSS -- already-evaluated CSS-string
// constants, not raw source text) and app/src/page-measure.test.ts (its
// top-level `stripComments` strips real `*.css` file text read via
// readFileSync; the file's SECOND, scope-local `stripComments` inside its
// `chq-page string literal` describe block -- documented at its own
// declaration site as deliberately `//`-line-comment-aware because an
// apostrophe in TSX prose desyncs a naive quote-matcher -- was left alone,
// unmigrated, the same carve-out shape DEC-613's earlier waves already
// established for raw-.tsx/.ts readers; declaring the shared stripper via
// import clears this ratchet's per-file offender flag for the whole file
// regardless, since `isLocalStripperOffender` is `declaresLocalStripper &&
// !importsSharedStripper` -- file-grained, not per-declaration-site).
// Both migrated files' own assertions still pass unchanged (`npx vitest
// run --config vitest.fast.config.ts test/error-invalid-outranks-base.
// test.ts app/src/page-measure.test.ts`: 24 tests, all green) -- no false
// receipt was found in this batch. Newer arrivals than these two --
// app/src/confirm-title-object.scan.test.ts, app/src/pages/contacts/
// SegmentPillStrip.bound390.render.test.tsx, app/src/pages/contacts/
// contacts-segment-pills-390.test.ts, test/pack-declaration-vocabulary.
// scan.test.ts -- were checked and left alone: the first strips `//` line
// comments over raw .tsx by design; the second and third depend on their
// local stripper's byte-length-preserving residue to keep character
// offsets valid indices into the raw source (the exact invariant class
// DEC-613's wave-19 amendment already carved out); the fourth's
// findDeclarations is shared between an unaffected pack-docs population and
// a product population that reads raw .ts via test/helpers/ssr-css-
// sources.ts's ssrCssSources() (w26-f's documented reason, unchanged).
// test/ssr-css-contract.scan.test.ts was also checked and left alone: every
// actual call site in the file passes it an already-extracted CSS string
// (never the raw file text), so migrating would likely be safe by usage,
// but the file's own header comment already documents a direct, verified
// corruption test against src/views/theme.ts and a deliberate decision not
// to use the shared stripper for that reason -- overriding that recorded
// verification without re-doing the same experiment was out of this task's
// narrow scope, so the file was left as its own prior wave decided.
// Re-measured with the ceiling forced to -1 again: EXACTLY 64, exactly
// 66 - 2, confirmed by reading the offender list (the two migrated files
// absent, all 64 others present as before). Ceiling lowered to match:
// 66 -> 64. Discharges DEC-613's wave-36 amendment for this task's slice.
// v12m-w44-h (wave 44, task w44-h, DEC-374 wave-44 second clause): forced -1
// and measured RED at this branch's tree BEFORE any change: 66, matching the
// declared ceiling (the merge train's "added two" the task description
// named). Read back the full 66-file roster rather than trusting any prior
// figure. Converted 5 of the 66 to import test/helpers/strip-css-comments.ts's
// shared, string-aware stripCssComments in place of a local strip[Css]Comments
// declaration -- every one genuinely CSS-only content (a real `.css` file, an
// already-extracted `*_CSS` template-literal body, or an already-evaluated
// CSS-string constant), never a whole raw `.ts`/`.tsx` module's prose:
// test/tap-target-floor.test.ts (reads app/src/styles.css only),
// test/ssr-page-clamp.scan.test.ts (every call site routes through its own
// extractCssText, never the raw file), test/phone-page-title-duplication.
// scan.test.ts (its local copy was already named `stripCssComments`,
// colliding with the shared symbol -- deleted outright, same shape as
// w36-d's inline-style-phone-override.scan.test.ts), test/public-when-gutter.
// test.ts (strips only the imported CARDS_CSS/RAIL_CSS constants, never the
// raw stylesCss/themeTs reads that sit beside them in the same file), and
// test/ssr-shell-sticky-footer.scan.test.ts (its local stripper is `/* */`
// block-comment-only with no `//` line-comment handling -- the SAME
// capability ceiling the shared helper has, so no capability was lost;
// applied to raw `.tsx` view-file text, so this one was verified empirically
// by running its own 5 tests post-conversion, not just reasoned about, given
// w26-f's raw-.ts corruption precedent).
//
// Every migrated file's own tests still pass unchanged (`npx vitest run
// test/tap-target-floor.test.ts test/ssr-page-clamp.scan.test.ts test/phone-
// page-title-duplication.scan.test.ts test/public-when-gutter.test.ts
// test/ssr-shell-sticky-footer.scan.test.ts`: 30 tests, all green) -- no
// false receipt was found in this batch.
//
// ATTEMPTED AND REJECTED (do not retry without new information):
// test/error-vocabulary-parity.scan.test.ts -- tried and REVERTED. Its
// SSR_SOURCE/SPA_SOURCE are the WHOLE raw `.css`/`.css.ts` file text
// including each file's own `//`-comment prose header. Swapping in the
// shared, quote-tracking stripCssComments made `.chq-field-error` and
// `.chq-field-invalid.chq-field-invalid` -- both genuinely declared on BOTH
// sides (src/views/error-states.css.ts:28,51) -- report as SPA-only: a
// corrupted parse of the SSR side (an apostrophe inside a `//` comment in
// the file's own header desyncs the shared stripper's quote state machine,
// same as w26-f's src/routes/review/reviewer.ts finding), not a real
// divergence. Left on its own local, non-quote-tracking, block-comment-only
// stripComments, unconverted.
// test/on-brand-anchor-hover.scan.test.ts, test/table-class-conformance.
// test.ts, and the entire `//`-line-comment-aware family (every remaining
// *.scan.test.ts that strips both `//` and `/* */` over raw `.ts`/`.tsx`
// source to find real call sites/JSX -- surveyed roughly two dozen of the
// 66, all sharing one of two copy-pasted quote/comment-tracking templates)
// were checked and left alone: each strips `//` line comments, a real
// capability the shared, CSS-only test/helpers/strip-css-comments.ts does
// not have, over source where a stripped-out banned token inside a `//`
// comment is a real false-positive risk this ratchet cannot introduce.
// Re-measured with the ceiling forced to -1 again: EXACTLY 61, exactly
// 66 - 5, confirmed by reading the offender list (the five converted files
// absent, all 61 others -- including error-vocabulary-parity.scan.test.ts,
// reverted -- present as before). Ceiling lowered to match: 66 -> 61.
export const LOCAL_CSS_COMMENT_STRIPPER_CEILING = 61;
