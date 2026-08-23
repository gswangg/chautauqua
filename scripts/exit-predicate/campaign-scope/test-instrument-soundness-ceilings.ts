// DEC-069 wave-116+ campaign exit predicate: OUT_OF_CAMPAIGN_SCOPE partial
// registry (custodian decomposition of
// scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts -- NO
// behavior change; see that file's header for why it split, and
// scripts/exit-predicate/campaign-scope.ts's header for the top-level
// barrel this nests under).
//
// Entries whose reason is a TEST-CORPUS-SOUNDNESS fact: whether a test
// file/audit doc/decision registry's own claim, citation, or assertion
// form can be trusted, not a v12 frame or 390-geometry conformance fact
// about the product.
//
// Merged into the full OUT_OF_CAMPAIGN_SCOPE map by
// out-of-campaign-scope.ts alongside its siblings below; nothing outside
// this directory imports TEST_INSTRUMENT_SOUNDNESS_OUT_OF_SCOPE directly.
export const TEST_INSTRUMENT_SOUNDNESS_OUT_OF_SCOPE: Record<string, string> = {
  UNNOTED_REGISTRY_COLLISION_CEILING:
    "measures how many decisions/DEC-NNN.md / src/decisions-data/DEC-NNN.md id pairs carry a " +
    "different H1 title (a genuine subject collision under one id) with no registry note " +
    "resolving which document governs -- a fact about the decision-registry ledger's own " +
    "internal consistency and citability, not a v12 frame or 390-geometry conformance fact.",
  COMMENT_BLIND_CSS_ASSERTION_CEILING:
    "measures TEST-INSTRUMENT SOUNDNESS -- whether a test file applies a raw-text match " +
    "assertion to an un-stripped CSS source, which can make a negative assertion fail on a " +
    "defect that doesn't exist in the tree (or, undetected, make a positive assertion pass " +
    "vacuously on a comment quoting the real declaration -- DEC-374). It is a fact about the " +
    "test corpus's own reliability, not about a v12 frame or 390-geometry conformance fact; a " +
    "newly non-zero row here would move the campaign's goalposts mid-convergence.",
  LOCAL_CSS_COMMENT_STRIPPER_CEILING:
    "measures VOCABULARY DUPLICATION (DEC-613) -- how many test files re-derive their own " +
    "comment-stripping function instead of importing test/helpers/strip-css-comments.ts's " +
    "shared one. A fact about the test corpus's maintainability, not a v12 frame or " +
    "390-geometry conformance fact.",
  BACKTICK_PARITY_CEILING:
    "measures how many decision documents carry an ODD number of backtick characters, i.e. a code "
    + "span left open so that every citation after it is read inside a quote that was never closed -- "
    + "a MARKDOWN-HYGIENE fact about the decision registry's own prose, and an instrument-completeness "
    + "guard on the citation scans that read it, never a v12 frame or 390-geometry conformance fact "
    + "about any screen the product draws. Grading it would put a documentation-formatting count in "
    + "the campaign's exit total, where a prose repair would read as product convergence "
    + "(test/citation-form-drift.scan.test.ts, DEC-967).",
  AUDIT_GREP_NEGATIVE_STALE_CEILING:
    "measures TEST-INSTRUMENT SOUNDNESS -- how many of docs/design/audit/**/*.md's own "
    + "hand-run 'grepped X for Y: zero hits' claims no longer hold against the tree. It grades "
    + "the audit corpus's own claim hygiene (DEC-069 wave-19 clause (b)), not itself a v12 frame "
    + "or 390-geometry conformance fact about any one screen (test/audit-gap-row-staleness.scan.test.ts, "
    + "DEC-808 wave-24 amendment).",
  GATE_TIMEOUT_MARGIN_UNGUARDED_CEILING:
    "measures HARNESS ROBUSTNESS -- how many `beforeAll`/`beforeEach`/`it` call sites carrying a "
    + "KNOWN-SLOW marker comment (a hook/test a prior wave measured close to its effective vitest "
    + "timeout under the mandate's maxWorkers:2/maxForks:2 machine-protection caps) lack an explicit "
    + "numeric timeout argument -- a fact about whether the fast tier's OWN gate can silently time out "
    + "under load, not a v12 frame or 390-geometry conformance fact about any screen the product "
    + "draws. The fast tier is the only instrument that can ever supply the exit predicate's "
    + "--suite-verified-sha, so this measures the gate's integrity, never product convergence "
    + "(test/gate-timeout-margin.scan.test.ts, DEC-069 wave-35 amendment).",
  // wave-39 (task w39-b, DEC-576 wave-39 amendment): the TWIN VISIBILITY LEDGER --
  // a newly-derived population (every `dock={...}` call site under src/routes/portal/**,
  // graded against the DEC-576 top-level-display:none / phone-media-reveal / same-page
  // unconditionally-rendered inline twin idiom `.chq-portal-edit-dock` /
  // `.chq-portal-taskform-dock` already carry) that no prior instrument graded --
  // MARKUP_PHONE_UNHIDDEN_CEILING's population is keyed on a literal `phone` substring in
  // the class token, which neither of these dock/twin class families carries at all, so
  // the live /portal/profile desktop double-Save sat under a green ceiling. A newly
  // measured, previously-uncounted population must not move the campaign's goalposts
  // mid-convergence; it is promoted once the CLASSLESS-TWIN sibling below is drained to 0
  // (app/src/phone-twin-visibility.scan.test.ts).
  UNSTRIPPED_SOURCE_REGEX_CEILING:
    "measures INSTRUMENT COVERAGE for a whole defect family -- how many scan-shaped files under "
    + "test/** and app/src/** read source off disk and apply a content match to it with no "
    + "comment-stripping step anywhere in the file -- not itself a v12 frame or 390-geometry "
    + "conformance fact about any screen the product draws. The population is dominated by ordinary "
    + "component render/CSS tests whose risk is lower than the three named instances that motivated "
    + "this instrument (a CSS comment quoting a frame literal, frame prose quoting product copy, and "
    + "test/test-tiers.test.ts's own DEC-727 tier-predicate offense); it is promoted, or split into a "
    + "TIER2 gate for its genuinely risky subset, once its measurement technique is proven complete "
    + "enough to distinguish that subset from the ordinary render-test population, the same "
    + "disposition already given to COMMENT_BLIND_CSS_ASSERTION_CEILING "
    + "(test/unstripped-source-regex.scan.test.ts, DEC-374 amendment).",
  AUDIT_HANDOFF_STALE_CEILING:
    "measures how many docs/design/audit/**/*.md paragraphs carry deferral-shaped handoff prose "
    + "(a work-remains claim, an open-status claim, a claim addressed to the planner, a "
    + "sized-versus-built claim, or a clause deferring to a future wave or a later lane) that "
    + "names neither a live non-zero measuring constant nor a closure marker -- an "
    + "instrument-completeness fact about the audit corpus's own claim-checking coverage, not "
    + "itself a v12 frame or 390-geometry conformance fact "
    + "(test/audit-handoff-paragraph-staleness.scan.test.ts, DEC-903 wave-41 amendment).",
  FRAME_CITATION_PAST_TEMPLATE_CEILING:
    "measures how many `.dc.html:<line>` citations land past their design file's own template close "
    + "(`</x-dc>`) -- inside the `<script data-dc-script>` body a frame extent can never cover, never "
    + "inside a drawn template. A citation counted here is definitionally outside every frame extent "
    + "the other citation ceilings grade, so this is a fact about CITATION HYGIENE (a stale line "
    + "number, or a reference into a design file's non-drawn scaffolding), not a v12 frame or "
    + "390-geometry conformance fact about any screen the product draws "
    + "(app/src/frame-citation.scan.test.ts, DEC-967 wave-41 amendment).",
  AUDIT_RATCHET_STATEMENT_DRIFT_CEILING:
    "measures how many audit-doc paragraphs make a statement about a live ratchet constant that "
    + "disagrees with that constant's current value -- a DOC-INTEGRITY fact about the audit corpus's "
    + "own narration, not itself a v12 frame or 390-geometry conformance fact about any screen the "
    + "product draws, the same disposition already given to DECISIONS_REGISTRY_CITATION_CEILING "
    + "(test/audit-ratchet-statement-drift.scan.test.ts, DEC-903 wave-41 amendment).",
  FRAME_VERDICT_ASYNC_QUERY_CEILING:
    "measures TEST-INSTRUMENT DETERMINISM -- whether a frame-verdict render `it` body issues a "
    + "bare screen/within getBy*/queryBy* DOM query after its own first `await`, the load-order "
    + "shape that made Comms.frame-verdicts.render.test.tsx's :286 pin green standalone and red "
    + "under the full 43-file concurrent run (repaired this same commit). It is a fact about the "
    + "test corpus's own reliability -- whether a receipt can be trusted to fail only on a real "
    + "product defect, never on scheduler luck -- not a v12 frame or 390-geometry conformance "
    + "fact, the same disposition already given to COMMENT_BLIND_CSS_ASSERTION_CEILING "
    + "(test/frame-verdict-async-query.scan.test.ts, DEC-976 wave-43 amendment).",

  GENERATED_ARTIFACT_ATOMIC_WRITE_CEILING:
    "measures whether every writeFileSync/writeFileAtomic call site publishing a generated repo-root "
    + "SQL/asset artifact (.seed.sql, .seed-assets/*, .perf-seed.sql) routes through "
    + "scripts/lib/write-file-atomic.ts's atomic write-to-temp-then-rename -- a TEST-INSTRUMENT "
    + "RELIABILITY fact about whether concurrent vitest workers can observe a truncated file, not a "
    + "v12 frame or 390-geometry conformance fact about any screen "
    + "(test/generated-artifact-atomic-write.scan.test.ts, DEC-739 wave-46 amendment).",

};
