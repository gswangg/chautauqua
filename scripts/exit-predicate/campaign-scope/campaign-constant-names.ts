// DEC-069 wave-116+ campaign exit predicate: constant-name REGISTRIES.
//
// Extracted from scripts/exit-predicate/campaign-scope.ts (custodian
// decomposition, contention-hotspot split -- NO behavior change; see that
// file's header for the module's overall shape and
// scripts/exit-predicate.ts's header for the top-level decomposition this
// nests under). This file holds only CAMPAIGN_CONSTANT_NAMES; its siblings
// (TIER2_CEILING_NAMES, OUT_OF_CAMPAIGN_SCOPE,
// ParkedFidelityPromise/PARKED_FIDELITY_PROMISES) live in their own files
// beside it, all re-exported from campaign-scope.ts so every existing
// import path keeps working unchanged.


/** Every constant name the campaign's exit predicate depends on. */
export const CAMPAIGN_CONSTANT_NAMES: readonly string[] = [
  "CLAIMED_FLOOR",
  "EXPECTED_TOTAL_PRE_DEVIATION",
  "EXPECTED_DEVIATION_DEFERRED",
  "EXPECTED_TOTAL",
  "CEILING",
  "ANCHOR_FLOOR_OFFENDERS_CEILING",
  "SSR_TAP_FLOOR_OFFENDERS_CEILING",
  "SSR_UNFLOORED_TOKENS_CEILING",
  // wave-142 (task w17-c, DEC-808): SSR_UNFLOORED_TOKENS_CEILING is keyed
  // on class TOKENS taken from markup -- a classless `<a>` under
  // src/routes/** contributes no token and was ungradeable by
  // construction. This ceiling grades that population instead, keyed on
  // the anchor's nearest enclosing element's chq- token
  // (app/src/phone-tap-target-ssr-classless-anchor.scan.test.ts).
  "SSR_CLASSLESS_ANCHOR_CEILING",
  // wave-154 (task w10-na, DEC-180 amendment): SPA mirror of
  // SSR_CLASSLESS_ANCHOR_CEILING above -- every SPA tap-target ratchet is
  // keyed on class TOKENS taken from markup, so an
  // {a,Link,NavLink,button,select,textarea,input} tag with no `className=`
  // contributes no token and was ungradeable by construction until this
  // ceiling (app/src/phone-tap-target-spa-classless-control.scan.test.ts).
  "SPA_CLASSLESS_CONTROL_CEILING",
  "OVERFLOW_OFFENDERS_CEILING",
  "CROSS_BUNDLE_CITATION_CEILING",
  "PHONE_HIDDEN_UNRECEIPTED_CEILING",
  "DESKTOP_UNRECEIPTED_CLAIM_CEILING",
  // wave-118 (task w7-b): population made total instead of hand-listed --
  // these nine were declared in the real corpus and ungraded before this
  // change (see the DEC-069 amendment on this file's history).
  "MARKUP_PHONE_UNHIDDEN_CEILING",
  "DIVERGENCE_CEILING",
  "ORPHAN_CEILING",
  "SHADOWED_CEILING",
  "UNRECEIPTED_CLAIM_CEILING",
  "FRAME_RECEIPT_OFFENDER_CEILING",
  "UNRESOLVED_CITATION_CEILING",
  "WIDENED_UNRESOLVED_CITATION_CEILING",
  // wave-120 (task w9-l, DEC-367 PREDICATE REPAIR): the base tap-target
  // scan's `findOffenders()` drops any control rule with NO declared
  // height/min-height before ever testing it against the floor -- this
  // constant grades the population that blind spot has always hidden.
  "UNDECLARED_HEIGHT_OFFENDERS_CEILING",
  "PAINTED_CANCELLED_PADDING_CEILING",
  // wave-121 (task w10-l): cancelled-padding companion-gap lens
  // (DEC-393 amendment, DEVIATIONS.md:346-351 rider instrument).
  "CANCELLED_PADDING_GAP_CEILING",
  // wave-128 (task w3-j, DEC-976/DEC-967): frame control-label ledger --
  // grades whether the app's own source contains, verbatim, the words each
  // v12 phone frame's footer/anchor controls draw (test/frame-control-label
  // .scan.test.ts).
  "FOOTER_LABEL_CEILING",
  // wave-131 (task w6-b, DEC-919 amendment): the FIRST control-label ledger
  // over the pack's non-390 (desktop/modal) card frames -- 101 frames the
  // phone-only FOOTER_LABEL_CEILING population never covered
  // (test/desktop-control-label.scan.test.ts).
  "DESKTOP_CONTROL_LABEL_CEILING",
  // wave-133 (task w8-a, DEC-976): frame caption/consequence ledger --
  // grades whether the app's own source contains, verbatim, each v12
  // frame's muted-prose caption/consequence text (test/frame-caption-ledger
  // .scan.test.ts).
  "FRAME_CAPTION_UNMATCHED_CEILING",
  // wave-136 (task w11-aa, DEC-967 doc-integrity lens widened to CODE
  // comments): grades whether every `path:line` citation inside a src/**
  // or app/src/** code comment resolves to a real file/line and, where a
  // backtick quote immediately follows, matches it verbatim near the cited
  // line (test/code-comment-citation.scan.test.ts).
  "CODE_COMMENT_CITATION_CEILING",
  // wave-144/w19-c (task w19-c, DEC-976): phone dock MEMBERSHIP ledger --
  // grades whether some single non-test source file both declares a docked
  // band's geometry and renders every one of that band's drawn labels,
  // catching the gap FOOTER_LABEL_CEILING's match-anywhere-in-corpus test
  // cannot (a dock split across a CSS declaration and a separate renderer
  // that never spells all of its copy). test/phone-dock-ledger.scan.test.ts.
  "PHONE_DOCK_UNCLAIMED_CEILING",
  // wave-146 (task w20-a, DEC-937): pack declaration vocabulary ratchet --
  // grades every product font-style/border-radius declaration against the
  // value set the 13 frame files actually draw
  // (test/pack-declaration-vocabulary.scan.test.ts).
  "PACK_VOCABULARY_OFFENDERS_CEILING",
  // wave-146 (task w21-d, DEC-613/DEC-989 amendment): brand-new
  // one-sided-only instrument -- grades whether any src/routes/**/*.css.ts
  // comment quotes a >=16-char run of real src/routes/**/*.tsx copy
  // verbatim (a server-rendered stylesheet comment leaking product copy
  // onto the page a second time, test/css-comment-copy-leak.scan.test.ts).
  "CSS_COMMENT_COPY_LEAK_CEILING",
  // wave-149 (task w5-bf, DEC-919 amendment): starved flex-track ratchet --
  // grades whether a grid rule effective at the 390 phone frame yields a
  // flexible track narrower than the grid's own widest fixed track
  // (app/src/phone-overflow-scan/starved-track-ceiling.ts, checked by
  // app/src/phone-horizontal-overflow.scan.test.ts).
  "STARVED_FLEX_TRACK_CEILING",
  // wave-26 (task w26-j, DEC-393/DEC-808 amendment): width-half tap-floor
  // ratchet -- DESIGN-RULINGS.md:189 rules the 44px floor as min-height
  // PLUS horizontal padding ("without padding the hit box is only as wide
  // as the text"), a clause every other tap-floor ceiling grades with
  // `horizontalPaddingNonZero`, which any non-zero padding value passes.
  // Grades every glyph-only/empty-with-aria-label button/a/select/
  // input[type=button|submit] against a >=44px min-width/width declared
  // somewhere effective at 390 (app/src/phone-tap-target-scan/width-floor
  // .ts + width-ceiling.ts, checked by
  // app/src/phone-tap-target-width-floor.scan.test.ts). Measured 0.
  "WIDTH_FLOOR_OFFENDERS_CEILING",
  // wave-12 (task w12-xf, DEC-808 amendment): phone-verdict cascade-read
  // lens -- grades whether a 390-frame render-verdict file (frame-verdicts/
  // frame390, non-desktop) ever reads a stylesheet at all; jsdom evaluates
  // no `@media`, so a verdict file that never reads CSS text can only ever
  // be a claim about the un-cascaded desktop DOM, never about the terminal
  // phone block that actually draws the frame
  // (app/src/phone-verdict-cascade-read.scan.test.ts).
  "PHONE_VERDICT_CASCADE_BLIND_CEILING",
  // wave-13m (task w13-xa, DEC-069 amendment): open-divergence ledger --
  // grades how many of the audit corpus's own recorded `**DIVERGES**` rows
  // (docs/design/audit/*.md) are still OPEN (no DEC-NNN citation or
  // docs/design/DEVIATIONS.md reference in the row's own line or the
  // paragraph it heads) rather than adjudicated, the population the two
  // saturated frame-coverage ledgers (CLAIMED_FLOOR) never measure -- a
  // GRADED, GATING conformance ratchet, not a citation-form or
  // instrument-soundness fact (test/open-divergence-ledger.scan.test.ts).
  "OPEN_DIVERGENCE_CEILING",
  // wave-16 (task w16-qa, DEC-998 clause a): these two constants were
  // declared by task w14-a (app/src/frame-citation.scan.test.ts:606/:778)
  // but never added to this list, so assertCampaignPopulationTotal threw
  // and NOT ONE campaign row could be read. Receipt-integrity conformance
  // facts of exactly the kind UNRECEIPTED_CLAIM_CEILING /
  // DESKTOP_UNRECEIPTED_CLAIM_CEILING already gate at their own non-zero
  // ceilings -- never OUT_OF_CAMPAIGN_SCOPE.
  "HEADER_SCOPE_WITHOUT_RECEIPT_CEILING",
  "DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING",
  // wave-28 (DEC-808 wave-28 amendment, clauses b/c). Both landed in the
  // wave-24..27 merge train registered nowhere, which made this module THROW
  // before printing a single campaign row. Both read 0, so verdict.tier2Done
  // is unaffected; both are also listed in TIER2_CEILING_NAMES below, because
  // assertEveryGradedCeilingIsGated leaves no third state for a graded
  // `_CEILING`.
  //
  // (b) ROLE_LABEL_SPELLING_CEILING counts v12 copy-fidelity offences in the
  //     words the app draws for a role and is seeded at 0 -- a campaign fact.
  // (c) ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING counts 390 tap-floor sightings
  //     carrying no adjudicated exemption receipt -- Tier-2 geometry.
  "ROLE_LABEL_SPELLING_CEILING",
  "ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING",
  // wave-35 (DEC-808 wave-35 amendment): the public/portal 390 roster's
  // CANDIDATE half is a defect count on a 390 route -- Tier-2 geometry,
  // the same disposition ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING already
  // carries for its admin twin, never OUT_OF_CAMPAIGN_SCOPE (unlike its
  // mixed-total sibling PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING above).
  "PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING",
  // wave-30 (task v12m-w30-d, DEC-367 amendment): grounds the mobile
  // overflow probe's two escape hatches (inHorizontalScroller's ancestor
  // exclusion, KNOWN_CLIP_EXCEPTIONS) in the design pack --
  // UNGROUNDED_SCROLLER_CEILING grades every `overflow-x/overflow:
  // auto|scroll` declaration with no docs/design/*.dc.html frame drawing
  // that scrolling region; STALE_CLIP_EXCEPTION_CEILING re-verifies each
  // KNOWN_CLIP_EXCEPTIONS member still names a real, genuinely-truncating
  // rule (DEC-725: an in-code exemption's premise rots like an allowlist)
  // (test/horizontal-scroller-premise.scan.test.ts).
  "UNGROUNDED_SCROLLER_CEILING",
  "STALE_CLIP_EXCEPTION_CEILING",
  // wave-30 (task w30-b, DEC-393 amendment): a tap-floor-exempt reason is a
  // premise about the tree, and its verifier must be named in the receipt
  // and executable by a scan (test/tap-floor-exempt-premise.scan.test.ts).
  // TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING grades receipts whose named
  // companion is real but not actually floored (a real 44px defect);
  // TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING grades receipts this
  // wave's instrument cannot express a check for -- a roster count, not a
  // defect count, per clause (c)'s "a row in the roster, not a silent pass".
  // DEC-069 wave-42 amendment: this second constant used to also carry an
  // OUT_OF_CAMPAIGN_SCOPE entry, so it was simultaneously graded and
  // excused -- printed by no row. The gating list wins: it is now also in
  // TIER2_CEILING_NAMES below and prints as a real, non-zero (77) row.
  // Draining that roster is owed to a later lane; this wave only makes the
  // count visible.
  "TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING",
  "TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING",
  // wave-35 (task v12m-w35-a, DEC-393 wave-35 amendment): an `inline-*`
  // tap-floor-exempt receipt is a GROUNDING claim (the same navigation
  // destination reachable from a floored control on the same rendered
  // surface), not just a typography argument
  // (test/inline-prose-exemption-premise.scan.test.ts). Sibling instrument
  // to the wave-30 build above -- distinct file, distinct constants, same
  // 44px-floor grammar. INLINE_PROSE_UNGROUNDED_CEILING grades receipts
  // that name a companion class whose floor claim is false (a real 44px
  // defect, measured 0). INLINE_PROSE_UNVERIFIABLE_CEILING grades receipts
  // naming no companion class at all -- a roster count, not a defect count
  // (measured 10), the same "row in the roster, not a silent pass"
  // discipline as its wave-30 sibling.
  "INLINE_PROSE_UNGROUNDED_CEILING",
  "INLINE_PROSE_UNVERIFIABLE_CEILING",


  // wave-36 (task w36-g, DEC-069 wave-36 promotion): both re-MEASURED 0 on
  // this branch (test/frame-conditional-state.scan.test.ts). Promoted out of
  // OUT_OF_CAMPAIGN_SCOPE because its own count is 0 (clause a) and its
  // instrument-completeness sibling, FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING,
  // also reads 0 (clause b) -- the sibling itself stays OUT_OF_CAMPAIGN_SCOPE,
  // an instrument-completeness fact rather than a v12 fidelity fact in its own
  // right.
  "FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING",
  // wave-36 (task w36-g, DEC-069 wave-36 promotion): re-MEASURED 0 on this
  // branch (test/desktop-field-width.scan.test.ts). Promoted out of
  // OUT_OF_CAMPAIGN_SCOPE because its own count is 0 (clause a) and its
  // instrument-completeness sibling, FIELD_WIDTH_UNRESOLVED_CEILING (3), has
  // every one of its three unresolved rows individually adjudicated in
  // docs/design/audit/desktop-field-width-v12.md (clause b) -- the sibling
  // itself stays OUT_OF_CAMPAIGN_SCOPE, an instrument-completeness fact
  // rather than a v12 fidelity fact in its own right.
  "FIELD_WIDTH_DIVERGENCE_CEILING",
  // wave-37 (task w37-c, DEC-069 wave-36 promotion rule, executed): re-
  // MEASURED 0 on this branch (test/frame-eyebrow-label.scan.test.ts). Passes
  // clause (a) (own count 0) and clause (b) -- its instrument-completeness
  // sibling, FRAME_EYEBROW_UNRESOLVED_CEILING (16), is not itself 0 but every
  // one of its 16 rows is individually adjudicated with its own composing
  // source expression named in docs/design/audit/frame-eyebrow-label-390-v12
  // .md (not a bucketed reason-category count) -- the sibling itself stays
  // OUT_OF_CAMPAIGN_SCOPE, an instrument-completeness fact rather than a v12
  // fidelity fact in its own right.
  "FRAME_EYEBROW_DIVERGENCE_CEILING",
  // wave-45 (task w45-f, DEC-393): src/routes/portal/portal.css.ts shipped
  // .chq-portal-file-link {} TWICE in its one terminal max-width block,
  // each copy under its own tap-floor-exempt receipt comment, because two
  // wave-38 lanes landed the same receipt with neither able to see the
  // other. test/ssr-duplicate-exemption-receipt.scan.test.ts sweeps every
  // SSR sheet (ssrCssSources(), DEC-808) for the shape going forward.
  // Repaired and re-MEASURED 0 on this branch.
  "SSR_DUPLICATE_EXEMPTION_RECEIPT_CEILING",
  // wave-45 (task w45-f, DEC-393): sibling ceiling, same file -- flags one
  // selector declared twice with an identical EMPTY body regardless of
  // whether either copy carries a receipt comment (a defensive net for the
  // same duplicate-declaration shape without the receipt-comment idiom).
  // Repaired and re-MEASURED 0 on this branch.
  "SSR_DUPLICATE_EMPTY_SELECTOR_CEILING",
  // wave-45 (DEC-069 wave-44/45 amendments): the SSR mirror of the already-
  // TIER2 SPA_CLASSLESS_CONTROL_CEILING above. Reads live 0 and is a
  // conformance fact, not an instrument-completeness fact, so wave 44 awarded
  // it a graded green row rather than an OUT_OF_CAMPAIGN_SCOPE excuse;
  // removed from OUT_OF_CAMPAIGN_SCOPE in this same commit (the two lists
  // must be disjoint -- test/campaign-scope-registry-partition.scan.test.ts).
  "SSR_CLASSLESS_CONTROL_CEILING",
  // wave-55 (task w55-b, DEC-180/DEC-069 wave-55 amendment): the ledger's
  // duplicate-vocabulary trap (FRAME_COUNT_CAPTION_UNMATCHED_CEILING and
  // COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING grading the same fact under two
  // names) is resolved -- UNMATCHED is redefined as rows NEITHER grader
  // resolves (the now-deleted constant's own meaning), the weak-grader-only
  // count survives as a non-ratcheted diagnostic, and this constant is
  // promoted here, reading live 0. Removed from OUT_OF_CAMPAIGN_SCOPE /
  // PARKED_FIDELITY_PROMISES in this same commit.
  "FRAME_COUNT_CAPTION_UNMATCHED_CEILING",
  // wave-48 (task w48-b, DEC-896 wave-48 amendment): pack drawn column-track
  // vocabulary ratchet -- grades every drawn grid-template-columns track
  // list against the served CSS's declared value set, resolved through
  // var()/minmax(0,X) before comparison
  // (test/pack-grid-track-vocabulary.scan.test.ts).
  "PACK_GRID_TRACK_UNMATCHED_CEILING",
  // wave-49 (DEC-613/DEC-069 amendment, task w49-c): promoted out of
  // OUT_OF_CAMPAIGN_SCOPE in the same commit that reclassified both
  // remaining rows BLESSED (docs/design/DEVIATIONS.md §7) and dropped
  // test/drawn-field-label.scan.test.ts's DRAWN_FIELD_LABEL_DIVERGENCE_
  // CEILING to 0 -- a DEVIATIONS-blessed field label is not a divergence.
  // Wired into TIER2 in this same commit; reads live 0.
  "DRAWN_FIELD_LABEL_DIVERGENCE_CEILING",
  // wave-49 (DEC-937/DEC-069 wave-49, task w49-b): the six PACK_UNIT_GRAMMAR_
  // OFFENDERS_CEILING gap sites are all RULED_LEFT by DEC-937's own wave-35/
  // wave-123 amendments -- classified out of the offender count, never
  // repaired (repair would redden the ruling that requires them). Ceiling
  // reads live 0 by classification; promoted out of OUT_OF_CAMPAIGN_SCOPE in
  // this same commit.
  "PACK_UNIT_GRAMMAR_OFFENDERS_CEILING",
  // wave-54 (task v12m-w54-a, DEC-069 wave-54 amendment): promoted out of
  // OUT_OF_CAMPAIGN_SCOPE -- PACK_PROSE_MEASURE_DIVERGENCE_CEILING's own
  // PARKED_FIDELITY_PROMISES row had siblingName: null (clause (b) vacuous)
  // while the ceiling itself already reads 0 (clause (a) satisfied), so
  // clause (a) alone decided and promotion moves no goalpost: it enters this
  // registry AT 0 (test/pack-prose-measure.scan.test.ts).
  "PACK_PROSE_MEASURE_DIVERGENCE_CEILING",
  // wave-55 (task v12m-w55-a, DEC-374 wave-52 amendment, executed): the
  // desktop-control-floor comment-fold parse repair (TOKEN_INDEX/
  // CONTROL_SHAPE_INDEX now built from comment-stripped blobs) landed in
  // this same commit and re-measures COMMENT_CREDITED_OFFENDERS live at 0
  // -- an instrument-soundness fact with no completeness sibling to
  // straddle, promoted out of OUT_OF_CAMPAIGN_SCOPE per its own
  // PARKED_FIDELITY_PROMISES row (clause a alone decided it).
  "COMMENT_CREDITED_FLOOR_CEILING",
];
