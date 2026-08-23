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
export const UNSTRIPPED_SOURCE_REGEX_CEILING = 221;
