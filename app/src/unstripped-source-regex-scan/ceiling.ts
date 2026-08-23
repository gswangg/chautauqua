// Unstripped-source-regex family ratchet -- RATCHET module (DEC-374
// wave-39, task w39-f). Split into its own file, following
// app/src/comment-blind-css-assertion-scan/ceiling.ts's precedent, so a
// worker re-measuring this ratchet touches only this constant and its
// history comment, never the population/detection machinery in
// test/unstripped-source-regex.scan.test.ts.
//
// This lives under app/src/ (rather than test/) specifically so it is a
// real member of module-reachability's walked population and must carry
// its own ENTRY_OR_ALLOWED entry -- same shape as
// comment-blind-css-assertion-scan/ceiling.ts.
//
// WHY THIS EXISTS: the same defect -- a scan-shaped file applies a content
// match to source text it read off disk, without ever stripping comments
// first -- has now silently disabled three separate guards, fixed at three
// separate sites, with no instrument ever enumerating the FAMILY:
//   1. A CSS comment quoting a frame literal was graded as a violation
//      (comment-blind-css-assertion-scan's own origin story).
//   2. Frame prose quoting product copy was matched as product copy.
//   3. test/test-tiers.test.ts's IMPORT_SPECIFIER_RE applies an import
//      regex to UN-STRIPPED source, so
//      test/render-sweep-public-gate.test.ts's own header sentence
//      ("must never import playwright") reads as a real import and the
//      DEC-727 tier predicate has been enforcing nothing for an unknown
//      number of waves. Owned by v12m-w38-c (in flight); this instrument
//      COUNTS it but does not repair it.
//
// POPULATION (walked, never hand-listed, test/unstripped-source-regex.scan.
// test.ts's own header has the full definition): every .ts/.tsx file under
// test/** and app/src/** that (a) calls readFileSync or readdirSync, from
// which a source-holding variable/property name is derived (`const X =
// readFileSync(...)` or `{ ..., X: readFileSync(...) }`), and (b) applies
// `.test(`/`.exec(`/`.match(`/`.replace(`/`.includes(`/`.indexOf(` to that
// same variable name, with NO comment-stripping step anywhere in the file
// -- a named `strip...Comment(s)(` call, an import from
// test/helpers/strip-css-comments.ts, or an inline comment-shaped `.replace
// (/\/\*[\s\S]*?\*\//` / `.replace(/\/\/[^\n]*/` regex (this codebase's own
// naive-but-real local-stripper idiom, e.g. app/src/pages/agenda/
// agenda-card-geometry.test.ts's CSS_NO_COMMENTS).
//
// OUT_OF_CAMPAIGN_SCOPE (scripts/exit-predicate/campaign-scope.ts): this
// ceiling measures INSTRUMENT COVERAGE across the whole scan-file
// population, most of which are ordinary component render tests whose
// `.includes(selector)` checks are low-risk (a literal class-selector
// substring, not a vocabulary ban/require regex) -- not itself a v12 frame
// or 390-geometry conformance fact about any screen the product draws. It
// is promoted (or split into a TIER2 gate for its genuinely risky subset)
// once a later wave's review distinguishes the ordinary render-test
// population from the true "vocabulary ban/require across many files" scan
// family this task's three named instances all belong to.
//
// -- Ratchet ----------------------------------------------------------------
// v12m-w39-f (wave 39, task w39-f, DEC-374 wave-39): first landing of this
// instrument. One genuine offender, test/module-reachability.scan.test.ts,
// was repaired in this same commit BEFORE seeding the ceiling (its
// extractSpecifiers() applied IMPORT_FROM_RE/EXPORT_FROM_RE/
// DYNAMIC_IMPORT_RE straight to raw source with only a type-only-import
// erasure, no comment stripping -- a `//`/`/* */`-quoted import specifier
// in a doc comment created a false reachability edge; fixed with a
// string-aware char-by-char stripComments, copied verbatim from
// test/control-class-conformance.test.ts's own stripComments, applied
// BEFORE extraction. A first attempt used the naive
// `.replace(/\/\*[\s\S]*?\*\//g, '')` one-liner instead and was REJECTED on
// inspection: on this repo's own TSX corpus (app/src/pages/Overview.tsx) an
// unbalanced `/*`-looking sequence elsewhere in the file made the greedy
// block-comment regex swallow roughly 60% of the file's bytes, up to an
// unrelated `*/` far away -- three modules that were genuinely reachable
// (AgendaWorkSection.tsx, rows.ts, overview.css) read as false orphans
// under that broken stripper. The string-aware replacement fixes this: no
// new orphan surfaces. The only ENTRY_OR_ALLOWED addition
// test/module-reachability.scan.test.ts needed for this wave is this
// ceiling module's own entry (its sole importer is
// test/unstripped-source-regex.scan.test.ts, a test file, which confers no
// static reachability -- DEC-518, same shape
// comment-blind-css-assertion-scan/ceiling.ts already carries). Forced to
// -1 AFTER the module-reachability repair and the offender list read back
// (never arithmetic): 221 files, including test/test-tiers.test.ts's own
// counted-but-unowned-by-this-task offense (its IMPORT_SPECIFIER_RE.exec
// (source) reads test/render-sweep-public-gate.test.ts's header sentence
// as a real import -- owned by v12m-w38-c, in flight; this instrument
// counts it honestly so w38-c's landing flips this row, but does not
// repair it, by explicit task instruction). The remaining 220 are mostly
// ordinary component render/CSS tests whose risk is genuinely lower than
// the three named instances (see this file's OUT_OF_CAMPAIGN_SCOPE header
// above) -- migrating them to the shared/string-aware stripper is later,
// separately-ruled wave work, the same disposition
// comment-blind-css-assertion-scan's own first landing gave its 39-file
// population. Ceiling seeded at the measured value: 221.
//
// MEGABATCH COMPOSITION (wave-44 thunderdome): 221 -> 227, re-measured live
// with the constant forced low and the printed offender list read back,
// never arithmetic. This constant is TWO-SIDED (test/unstripped-source-
// regex.scan.test.ts's own "the ceiling is not stale" companion), so it
// tracks the live measurement in both directions rather than standing as a
// one-way gate. The move is accounted for file by file:
//
//   -1  test/test-tiers.test.ts -- v12m-w38-c LANDED the repair this file's
//       seeding note above said would "flip this row": the DEC-727 tier
//       predicate now calls stripTsComments before matching. The pin
//       asserting it is still an offender became a regression guard in the
//       same commit.
//   +7  scan-shaped files landed by lanes that branched BEFORE w39-f seeded
//       this instrument, so no lane could see the family it was joining:
//         app/src/phone-hidden-drawn-text/frame-blobs.ts
//         test/audit-ratchet-statement-drift.scan.test.ts
//         test/campaign-scope-registry-partition.scan.test.ts
//         test/desktop-eyebrow-label.scan.test.ts
//         test/deviations-ledger/resolvers.ts
//         test/frame-control-label/population.ts
//         test/render-sweep-advisory-gate-promotion.scan.test.ts
//       Each confirmed absent at the seeding commit 5727fecc7 by
//       `git log 5727fecc7..HEAD --diff-filter=A -- <path>`.
//
// 221 - 1 + 7 = 227, and the live walk prints 227. These seven are NOT
// repaired here, for the same reason the original 220 were not: adding a
// stripping step to a ratchet instrument CHANGES WHAT IT MEASURES (three of
// the seven are ceiling-bearing scans, one of them the desktop eyebrow
// ledger whose ceiling this same wave just parked), so each repair is its
// own re-ratcheting wave, not a medic edit. That is the "later, separately-
// ruled wave work" disposition this header already records, and the reason
// this ceiling sits in OUT_OF_CAMPAIGN_SCOPE: instrument-coverage backlog,
// never a v12 conformance fact.
//
// v12m-w44-i (DEC-374 wave-44, task w44-i): re-measured at 227 (a merge
// train added 7 genuine new offenders since the 221 baseline, plus a
// same-count rename -- test/frame-control-label.scan.test.ts's population
// walk moved to test/frame-control-label/population.ts -- and
// test/test-tiers.test.ts dropped OUT of the roster, already repaired by a
// prior lane). All 7 new offenders repaired in this same commit by adding
// a real comment-stripping step before their risky content match:
// app/src/phone-hidden-drawn-text.scan.test.ts and
// test/campaign-scope-registry-partition.scan.test.ts and
// test/render-sweep-advisory-gate-promotion.scan.test.ts (TS source, via
// the shared test/helpers/strip-ts-comments.ts); test/deviations-ledger/
// resolvers.ts (TS source tree walk, same shared stripper);
// app/src/phone-hidden-drawn-text/frame-blobs.ts and
// test/desktop-eyebrow-label.scan.test.ts (`.dc.html` frame markup, via a
// new shared test/helpers/strip-html-comments.ts -- a genuinely different
// comment grammar gets its own shared instrument, DEC-613, never a bent
// reuse of the TS or CSS one); test/audit-ratchet-statement-drift.scan.
// test.ts (both: TS source for its live-constant read, `.md` audit docs
// for its statement-drift read). test/frame-control-label/population.ts
// (the rename target, `.dc.html`, same new HTML stripper) was also
// repaired even though its rename was already net-zero against the
// ceiling, so no offender of this family exists un-repaired on this
// branch. Forced to -1 and the printed roster read back (never
// arithmetic): 219 files. No offender named as genuinely un-repairable
// this wave -- all 7 (plus the rename target) had a real applicable
// stripper. Ceiling LOWERED to the measured value: 219.
//
// MEGABATCH COMPOSITION (wave-45 thunderdome): task w45-c reached this same
// family independently. Its repairs to audit-ratchet-statement-drift,
// campaign-scope-registry-partition, deviations-ledger/resolvers and
// render-sweep-advisory-gate-promotion DUPLICATE w44-i's above (w44-i's
// wording is the one that landed); its repairs to
// test/cross-org-refusal-vocabulary.scan.test.ts,
// test/list-filter-vocabulary.test.ts and test/text-vocabulary.scan.test.ts
// are NET-NEW and merged cleanly, and w45-c's three HTML-frame reverts did
// NOT land (w44-i's strip-html-comments repairs stand instead). The composed
// count is therefore below both branches' independently measured figures;
// it is re-measured live by this module's own two-sided companion rather
// than computed by arithmetic here. w45-c's own note follows.
//
// v12m-w45-c (wave 45, task w45-c, DEC-808 wave-45 clause (a)/(b)/(c),
// DEC-613): REPAIR, not re-seed. The wave-37..42 merge train landed 31
// branches (v12m-w37-{c..h}, w38-{a..i}, custodian-w38-7, custodian-w40-8,
// w39-{a..g}, w40-{a..g}, w41-{a..g}, w42-{a..f}) whose new scan-shaped
// .ts/.tsx files never adopted a stripping step, pushing the measured count
// from the seeded 221 to 227 -- a 6-file overshoot the ceiling's "may only
// fall" discipline forbids papering over with a re-seed. Forced to -1 and
// the roster read back (never arithmetic) confirmed 227. Cross-checking the
// printed roster against `git log --diff-filter=A 5727fecc7..HEAD -- test
// app/src` (the v12m-w39-f landing commit that first seeded this ceiling)
// found 20 tracked .ts/.tsx files added to the tree since that seeding, of
// which 7 appeared on the printed offender roster:
//   - app/src/phone-hidden-drawn-text/frame-blobs.ts (var: content)
//   - test/audit-ratchet-statement-drift.scan.test.ts (var: text)
//   - test/campaign-scope-registry-partition.scan.test.ts (var: content)
//   - test/desktop-eyebrow-label.scan.test.ts (var: content)
//   - test/deviations-ledger/resolvers.ts (var: text)
//   - test/frame-control-label/population.ts (var: content)
//   - test/render-sweep-advisory-gate-promotion.scan.test.ts (var: source)
// Three of these seven -- frame-blobs.ts, desktop-eyebrow-label.scan.test.ts
// and frame-control-label/population.ts -- read docs/design/*.dc.html
// design-frame markup, not TS/CSS source. A first attempt applied
// test/helpers/strip-css-comments.ts's stripCssComments to their `content`
// before matching; this was REJECTED on inspection, the same discipline
// this file's own w39-f history paragraph above already established once:
// "Chautauqua Account.dc.html" draws the literal route text "/admin/*",
// whose `/*` stripCssComments's quote-blind-but-comment-eager walk reads as
// a genuine block-comment opener with no legitimate `*/` anywhere near it,
// silently swallowing real drawn content up to a FAR-AWAY unrelated `*/` --
// desktop-eyebrow-label.scan.test.ts's own vacuous-population tripwire
// caught it immediately (245 eyebrows measured, 242 after the naive apply).
// These three files were left UNREPAIRED and their edits reverted; DEC-808
// wave-45 clause (c) ("if the newly-added files number fewer than 6,
// continue... repair further files from the SAME printed roster") was
// invoked to substitute three TS-source-only replacements from the same
// 227-file roster instead, all genuinely safe (test/helpers/
// strip-ts-comments.ts's stripTsComments is string-aware over `'`/`"`/`` ` ``
// so a literal `/*`-shaped substring inside a real string/template literal
// is never misread as a comment opener -- unlike stripCssComments's
// coarser quote handling, this is exactly why DEC-613 keeps the two
// strippers separate rather than reusing one for both grammars):
// test/cross-org-refusal-vocabulary.scan.test.ts (var: src, a vocabulary
// ban across every src/routes/**/*.ts file), test/text-vocabulary.scan.
// test.ts (var: contents, a vocabulary ban across src/** and app/src/**)
// and test/list-filter-vocabulary.test.ts (var: text, a literal-vocabulary
// extraction across src/mail/**) -- each already carrying a many-file
// vocabulary ban/require regex, outranking a single literal
// `.includes(selector)` in one render test per clause (c)'s own ordering.
// All 4 remaining TS repairs (audit-ratchet-statement-drift.scan.test.ts,
// campaign-scope-registry-partition.scan.test.ts, deviations-ledger/
// resolvers.ts and render-sweep-advisory-gate-promotion.scan.test.ts) were
// repaired by importing the EXISTING stripTsComments -- never a local copy
// (DEC-613) -- and applying it BEFORE the risky content match; a comment
// merely quoting an `export const NAME = N;`/`X_BLOCKING`/import-specifier
// shape must never be mistaken for a real, live declaration (the exact
// instance-3 shape this instrument's own header names).
// deviations-ledger/resolvers.ts's fileContains was deliberately left
// UNSTRIPPED: a DEVIATIONS.md "present" citation's literal is legitimately
// allowed to live in a comment (e.g. a deliberate-non-build note), so
// stripping there would turn real, honored citations into false "does not
// contain" problems -- this file's genuine repair instead strips
// termAppearsInTree, whose risk direction (a term named only in a comment
// misread as genuinely present in live code) matches the family. No naive
// `.replace(/\/\*[\s\S]*?\*\//g,'')` one-liner was authored anywhere (this
// file's own w39-f history paragraph above records why that shape was
// already REJECTED once). Re-forced to -1 and the roster read back AGAIN
// after all repairs: 220 -- all 6 net-new repaired files confirmed absent
// from the new roster (227 - 6 substituted-in repairs - 1 already-safe
// deviations-ledger/resolvers.ts repair via a different function = 220; the
// three reverted HTML-frame edits contribute nothing to the delta). Ceiling
// lowered to the re-measured value: 220.
export const UNSTRIPPED_SOURCE_REGEX_CEILING = 219;
