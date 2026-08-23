// DEC-069 wave-116+ campaign exit predicate: constant-name REGISTRIES.
//
// Extracted from scripts/exit-predicate.ts (custodian decomposition,
// contention-hotspot split -- NO behavior change; see that file's header
// for the module's overall shape). Pure data: the three lists that
// classify every `*_CEILING`/`*_FLOOR` ratchet constant declared anywhere
// in the tree as graded-and-gating (CAMPAIGN_CONSTANT_NAMES /
// TIER2_CEILING_NAMES) or deliberately excused
// (OUT_OF_CAMPAIGN_SCOPE), consumed by scripts/exit-predicate/campaign.ts's
// grading functions. Isolated on its own so the frequent churn of adding a
// newly-discovered ratchet name touches only this file, never the grading
// logic beside it (mirrors app/src/phone-overflow-scan/starved-track-ceiling
// .ts's precedent of isolating pure ratchet-name data from its checker).

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
];

/**
 * Tier-2 ceiling constant names: campaign is done only once every one reads
 * 0. Exported (DEC-808, task w7-dc) so test/campaign-ratchet-two-sided.scan
 * .test.ts can derive its graded population from the same three lists this
 * module already treats as the campaign's total accounting, rather than
 * hand-listing a fourth copy.
 */
export const TIER2_CEILING_NAMES: readonly string[] = [
  "CEILING",
  "ANCHOR_FLOOR_OFFENDERS_CEILING",
  "SSR_TAP_FLOOR_OFFENDERS_CEILING",
  "SSR_UNFLOORED_TOKENS_CEILING",
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
  "MARKUP_PHONE_UNHIDDEN_CEILING",
  "DIVERGENCE_CEILING",
  "ORPHAN_CEILING",
  "SHADOWED_CEILING",
  "UNRECEIPTED_CLAIM_CEILING",
  "FRAME_RECEIPT_OFFENDER_CEILING",
  "UNRESOLVED_CITATION_CEILING",
  "WIDENED_UNRESOLVED_CITATION_CEILING",
  "PAINTED_CANCELLED_PADDING_CEILING",
  // wave-121 (task w10-l): cancelled-padding companion-gap lens.
  "CANCELLED_PADDING_GAP_CEILING",
  // wave-122 (task w11-s, DEC-851 amendment): docs/mobile-campaign.md's
  // Tier 2 requires the 44px sweep to cover BOTH evasion modes
  // DESIGN-RULINGS names -- a floored-but-too-short control, and a
  // control with no declared height/min-height at all, which the base
  // tap-target scan's `findOffenders()` drops before it is ever tested
  // against the floor. UNDECLARED_HEIGHT_OFFENDERS_CEILING grades the
  // second mode; it was already in CAMPAIGN_CONSTANT_NAMES (wave-120,
  // task w9-l) but never wired into TIER2_CEILING_NAMES, so it was
  // graded but never printed and never gated DONE -- a declared knob
  // with no reader (DEC-851).
  "UNDECLARED_HEIGHT_OFFENDERS_CEILING",
  // wave-128 (task w3-j): frame control-label ledger, wired into TIER2 in
  // the same commit that declared it in CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988).
  "FOOTER_LABEL_CEILING",
  // wave-131 (task w6-b): desktop (non-390) control-label ledger, wired
  // into TIER2 in the same commit that declared it in
  // CAMPAIGN_CONSTANT_NAMES above -- never a declared-but-unread knob
  // (DEC-851/DEC-988).
  "DESKTOP_CONTROL_LABEL_CEILING",
  // wave-133 (task w8-a): frame caption/consequence ledger, wired into
  // TIER2 in the same commit that declared it in CAMPAIGN_CONSTANT_NAMES
  // above -- never a declared-but-unread knob (DEC-851/DEC-988).
  "FRAME_CAPTION_UNMATCHED_CEILING",
  // wave-136 (task w11-aa): code-comment citation scan, wired into TIER2 in
  // the same commit that declared it in CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988).
  "CODE_COMMENT_CITATION_CEILING",
  // wave-144/w19-c (task w19-c): phone dock membership ledger, wired into
  // TIER2 in the same commit that declared it in CAMPAIGN_CONSTANT_NAMES
  // above -- never a declared-but-unread knob (DEC-851/DEC-988).
  "PHONE_DOCK_UNCLAIMED_CEILING",
  // wave-146 (task w20-a): pack declaration vocabulary ratchet, wired into
  // TIER2 in the same commit that declared it in CAMPAIGN_CONSTANT_NAMES
  // above -- never a declared-but-unread knob (DEC-851/DEC-988).
  "PACK_VOCABULARY_OFFENDERS_CEILING",
  // wave-146 (task w21-d): CSS comment copy-leak scan, wired into TIER2 in
  // the same commit that declared it in CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988).
  "CSS_COMMENT_COPY_LEAK_CEILING",
  // wave-149 (task w5-bf): starved flex-track ratchet, wired into TIER2 in
  // the same commit that declared it in CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988).
  "STARVED_FLEX_TRACK_CEILING",
  // wave-26 (task w26-j): width-half tap-floor ratchet, wired into TIER2 in
  // the same commit that declared it in CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988).
  "WIDTH_FLOOR_OFFENDERS_CEILING",
  // wave-12 (task w12-xf): phone-verdict cascade-read ratchet, wired into
  // TIER2 in the same commit that declared it in CAMPAIGN_CONSTANT_NAMES
  // above -- never a declared-but-unread knob (DEC-851/DEC-988).
  "PHONE_VERDICT_CASCADE_BLIND_CEILING",
  // wave-13m (task w13-xa): open-divergence ledger, wired into TIER2 in the
  // same commit that declared it in CAMPAIGN_CONSTANT_NAMES above -- never a
  // declared-but-unread knob (DEC-851/DEC-988).
  "OPEN_DIVERGENCE_CEILING",
  // wave-16 (task w16-qa, DEC-998 clause a): wired into TIER2 in the same
  // commit that declared these in CAMPAIGN_CONSTANT_NAMES above -- never a
  // declared-but-unread knob (DEC-851/DEC-988).
  "HEADER_SCOPE_WITHOUT_RECEIPT_CEILING",
  "DESKTOP_HEADER_SCOPE_WITHOUT_RECEIPT_CEILING",
  // wave-28 (DEC-808 wave-28 amendment, clauses b/c): wired into TIER2 in the
  // same commit that declared these in CAMPAIGN_CONSTANT_NAMES above -- never
  // a declared-but-unread knob (DEC-851/DEC-988). Both read 0.
  "ROLE_LABEL_SPELLING_CEILING",
  "ADMIN_MOBILE_CANDIDATE_DEFECT_CEILING",
  // wave-35 (DEC-808 wave-35 amendment): wired into TIER2 in the same
  // commit that declared it in CAMPAIGN_CONSTANT_NAMES above -- a real
  // 390-geometry defect count, never a declared-but-unread knob.
  "PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING",
  // wave-30 (task v12m-w30-d): wired into TIER2 in the same commit that
  // declared these in CAMPAIGN_CONSTANT_NAMES above -- never a
  // declared-but-unread knob (DEC-851/DEC-988).
  "UNGROUNDED_SCROLLER_CEILING",
  "STALE_CLIP_EXCEPTION_CEILING",
  // wave-30 (task w30-b): tap-floor-exempt receipt premise ratchet, wired
  // into TIER2 in the same commit that declared it in CAMPAIGN_CONSTANT_NAMES
  // above -- a real 44px defect count, never a declared-but-unread knob
  // (DEC-851/DEC-988). Its UNVERIFIABLE-PREMISE sibling is OUT_OF_CAMPAIGN_SCOPE
  // instead (an instrument-completeness roster count, not a conformance fact).
  "TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING",
  // wave-35 (task v12m-w35-a): inline-prose grounding ratchet, wired into
  // TIER2 in the same commit that declared it in CAMPAIGN_CONSTANT_NAMES
  // above -- never a declared-but-unread knob (DEC-851/DEC-988). Both
  // siblings gate here (task instruction, not OUT_OF_CAMPAIGN_SCOPE): this
  // is still the 44px floor, and an ungroundable inline receipt is exactly
  // the second evasion mode DEC-393's wave-30 amendment clause (b) already
  // names, not a mere instrument-completeness fact.
  "INLINE_PROSE_UNGROUNDED_CEILING",
  "INLINE_PROSE_UNVERIFIABLE_CEILING",


  // wave-36 (task w36-g): wired into TIER2 in the same commit that promoted
  // it out of OUT_OF_CAMPAIGN_SCOPE into CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988, DEC-069 wave-36).
  "FRAME_CONDITIONAL_STATE_DIVERGENCE_CEILING",
  // wave-36 (task w36-g): wired into TIER2 in the same commit that promoted
  // it out of OUT_OF_CAMPAIGN_SCOPE into CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988, DEC-069 wave-36).
  "FIELD_WIDTH_DIVERGENCE_CEILING",
  // wave-37 (task w37-c): wired into TIER2 in the same commit that promoted
  // it out of OUT_OF_CAMPAIGN_SCOPE into CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988, DEC-069 wave-36
  // promotion rule).
  "FRAME_EYEBROW_DIVERGENCE_CEILING",
  // wave-42 (task v12m-w42-a, DEC-069 wave-42 amendment): removed from
  // OUT_OF_CAMPAIGN_SCOPE, where it sat alongside its CAMPAIGN_CONSTANT_NAMES
  // membership above -- a name in both lists was graded but discharged, so
  // it was printed by no row. The gating list wins; this constant now
  // prints as a real, non-zero TIER2 row.
  "TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING",
  // wave-45 (task w45-f): wired into TIER2 in the same commit that
  // declared these in CAMPAIGN_CONSTANT_NAMES above -- never a
  // declared-but-unread knob (DEC-851/DEC-988). A real 44px duplicate-
  // exemption-receipt defect count, both measured 0 post-repair.
  "SSR_DUPLICATE_EXEMPTION_RECEIPT_CEILING",
  "SSR_DUPLICATE_EMPTY_SELECTOR_CEILING",
];

/**
 * Names that match the `<NAME>_CEILING` / `<NAME>_FLOOR` (or bare `CEILING`)
 * shape in the real corpus but are deliberately NOT part of the v12 mobile
 * campaign's own exit predicate. Each value is a PRINCIPLE -- a fact about
 * what the constant measures that stays true with every branch name and
 * wave number deleted (DEC-099's shape) -- never a schedule note ("later
 * wave", "in flight", a branch token). `assertCampaignPopulationTotal`
 * treats any candidate name here, or in `CAMPAIGN_CONSTANT_NAMES`, as
 * accounted for; anything else is an ungraded ratchet and throws.
 */
export const OUT_OF_CAMPAIGN_SCOPE: Record<string, string> = {
  DESKTOP_FLOOR_DIVERGENCE_CEILING:
    "measures whether a desktop control's declared min-height reaches the height its OWN " +
    "v12 frame draws for it (a control-geometry fidelity fact, distinct from whether a " +
    "frame is CITED or whether a control's WORDS match) -- a new non-zero row in the exit " +
    "gate would move the campaign's goalposts mid-convergence; it measures fidelity now and " +
    "is promoted once its measurement technique is proven complete enough to gate on. " +
    "DEC-069 wave-36 clause (b) refusal: its instrument-completeness sibling, " +
    "DESKTOP_FLOOR_UNRESOLVED_CEILING, is neither 0 nor individually row-adjudicated -- its " +
    "unresolved population is bucketed by reason category over roughly half the total rows, " +
    "so grading the divergence ceiling now would sell that instrument blindness as desktop " +
    "proof.",
  DESKTOP_FLOOR_UNRESOLVED_CEILING:
    "measures how many desktop drawn-control rows the floor-divergence join could not " +
    "resolve to a source-code label match, a class token, or a CSS rule -- an instrument- " +
    "completeness fact about the ledger's own join technique, not itself a v12 frame or " +
    "390-geometry conformance fact.",
  UNCLAIMED_CEILING:
    "measures tsconfig project-include coverage (every .ts/.tsx file typechecked by " +
    "some tsconfig project or a named exclusion) -- a build/typecheck-tooling health " +
    "check, not a v12 frame or DEC-069 conformance ratchet.",
  LINE_KEYED_CITATION_CEILING:
    "measures citation FORM (line-keyed vs drift-proof), an integrity property of the " +
    "decision-registry ledger's own durability -- whether a citation is written in a shape " +
    "that survives an edit to the file it points at. Citation RESOLUTION (whether a " +
    "citation is currently true) is already an exit gate under UNRESOLVED_CITATION_CEILING " +
    "and WIDENED_UNRESOLVED_CITATION_CEILING; this constant is a distinct, non-overlapping " +
    "concern from the same population, not a v12 frame or 390-geometry conformance fact.",
  UNNOTED_REGISTRY_COLLISION_CEILING:
    "measures how many decisions/DEC-NNN.md / src/decisions-data/DEC-NNN.md id pairs carry a " +
    "different H1 title (a genuine subject collision under one id) with no registry note " +
    "resolving which document governs -- a fact about the decision-registry ledger's own " +
    "internal consistency and citability, not a v12 frame or 390-geometry conformance fact.",
  FRAME_FLOOR_DIVERGENCE_CEILING:
    "measures fidelity of a control's DECLARED min-height against the height its OWN phone " +
    "frame draws (which may exceed the ruled 44px minimum), a finer-grained fact than the " +
    "existing tap-floor family already grades (whether a control clears the ruled minimum at " +
    "all). A new non-zero row in the exit gate for a fact this granular would move the " +
    "campaign's goalposts mid-convergence; it measures fidelity now and is promoted by a " +
    "later ruling once drained, the same disposition already given to LINE_KEYED_CITATION_CEILING. " +
    "DEC-069 wave-36 clause (b) refusal: its instrument-completeness sibling, " +
    "UNRESOLVED_COUNT_TRIPWIRE, carries a non-zero unresolved population with no individual " +
    "per-row adjudication (bucketed by reason category, a sample cited rather than every row), " +
    "so grading the divergence ceiling now would assert fidelity over an unverified remainder.",
  COMMENT_BLIND_CSS_ASSERTION_CEILING:
    "measures TEST-INSTRUMENT SOUNDNESS -- whether a test file applies a raw-text match " +
    "assertion to an un-stripped CSS source, which can make a negative assertion fail on a " +
    "defect that doesn't exist in the tree (or, undetected, make a positive assertion pass " +
    "vacuously on a comment quoting the real declaration -- DEC-374). It is a fact about the " +
    "test corpus's own reliability, not about a v12 frame or 390-geometry conformance fact; a " +
    "newly non-zero row here would move the campaign's goalposts mid-convergence.",
  EQUAL_SPECIFICITY_SHADOWED_CEILING:
    "measures a DIFFERENT-SELECTOR cascade-order exposure (DEC-385 single-direction) -- how " +
    "many max-width declarations are beaten by a different, equal-or-higher-specificity " +
    "top-level selector, targeting the same component (a shared chq- class token), declared " +
    "after the max-width block closes. It is a fidelity fact narrower than the identical-" +
    "selector SHADOWED_CEILING measures, not a v12 frame citation or geometry fact; a newly " +
    "non-zero row here would move the campaign's goalposts mid-convergence.",
  LOCAL_CSS_COMMENT_STRIPPER_CEILING:
    "measures VOCABULARY DUPLICATION (DEC-613) -- how many test files re-derive their own " +
    "comment-stripping function instead of importing test/helpers/strip-css-comments.ts's " +
    "shared one. A fact about the test corpus's maintainability, not a v12 frame or " +
    "390-geometry conformance fact.",
  DECISIONS_REGISTRY_CITATION_CEILING:
    "measures citation resolvability (a path:line resolving to a real file/line, and an " +
    "immediately-following backtick quote matching verbatim) across the OLDER, disjoint " +
    "decisions/ registry (1000 files) that this campaign never previously checked beyond bare " +
    "path existence -- a registry-hygiene fact about whether that directory's own citations " +
    "are internally trustworthy, not a v12 frame or 390-geometry conformance fact. A newly " +
    "measured, previously-uncounted population must not move the campaign's goalposts " +
    "mid-convergence; it is promoted once its measurement technique is proven complete enough " +
    "to gate on, the same disposition already given to DESKTOP_FLOOR_UNRESOLVED_CEILING. " +
    "DEC-069 promotion clause (a) refusal: its own measured count is non-zero, so the promotion " +
    "rule does not apply yet regardless of any completeness sibling.",
  NEGATIVE_MARGIN_ADJACENCY_CEILING:
    "measures a STATIC, authoring-time property of every CSS rule in the tracked tree -- " +
    "whether a negative top/all-sides margin's preceding-comment receipt names an external " +
    "sibling whose display:none base is revealed by some @media block in the same sheet -- " +
    "not a live-pixel overlap a render sweep would catch. It grades every rule in every " +
    "sheet, including surfaces no route sweep visits, deliberately distinct from any " +
    "live-pixel superimposition detector the campaign's render lane might carry, so it is " +
    "not a v12 frame or 390-geometry conformance fact in the campaign's own sense " +
    "(app/src/negative-margin-adjacency.scan.test.ts, DEC-919 wave-152 amendment).",
  ROUTE_SUBSTATE_UNVISITED_CEILING:
    "measures how many derived (route, query-key, value) triples a page's own closed-set " +
    "query-param reads mint that ROUTE_MANIFEST -- the population every live gate (render " +
    "sweep, overflow probe, tap-floor pass, contrast pass) walks -- carries no row for. It is " +
    "an INSTRUMENT-COMPLETENESS/POPULATION fact (whether the graded surface area is complete), " +
    "not itself a v12 frame or 390-geometry conformance fact about any one screen; widening " +
    "ROUTE_MANIFEST to close a row is a separate act from rostering the gap, so a newly " +
    "nonzero count here would move the campaign's own convergence goalposts mid-stream " +
    "(test/route-substate-coverage.scan.test.ts, DEC-144 amendment).",
  ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING:
    "measures the admin mobile pass's own OFFENDER COUNT for a population "
    + "(INTERACTIVE_CONTROL_SELECTOR under MIN_TAP_TARGET_PX) that is ADVISORY, not "
    + "blocking, the same disposition DEC-393 wave-147/151 already gave the desktop/phone "
    + "drawn-floor ledgers: a new non-zero row in the exit gate for this count would move "
    + "the campaign's own convergence goalposts mid-stream, when minControlHeight/"
    + "minControlWidth (the population's SHORTEST offender) already carry the public-pass "
    + "contract DEC-253 depends on. This constant lives beside that contract without "
    + "replacing it (scripts/render-sweep-lib.ts, DEC-253/DEC-367/DEC-808 wave-155 "
    + "amendment, task qf).",
  PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING:
    "same disposition as "
    + "ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING immediately above -- measures the "
    + "public/portal mobile pass's own OFFENDER COUNT for the widened INTERACTIVE_CONTROL_"
    + "SELECTOR population under MIN_TAP_TARGET_PX, ADVISORY not blocking "
    + "(PUBLIC_MOBILE_OFFENDER_GATE_BLOCKING = false), because minControlHeight/"
    + "minControlWidth over the narrow MOBILE_CONTROL_SELECTOR population already carry "
    + "the BLOCKING public-pass contract DEC-253 depends on. A new non-zero row in the "
    + "exit gate for this count would move the campaign's own convergence goalposts "
    + "mid-stream the first time this population is ever measured. This constant lives "
    + "beside that contract without replacing it (scripts/render-sweep-lib.ts, DEC-253/"
    + "DEC-367/DEC-808 wave-30 amendment).",
  PUBLIC_MOBILE_VACUOUS_NARROW_FLOOR:
    "a POPULATION-COMPLETENESS "
    + "fact -- how many public/portal 390 routes' narrow MOBILE_CONTROL_SELECTOR pass "
    + "matched zero elements, so the BLOCKING public mobile gate's height/width check has "
    + "been passing on them vacuously -- not itself a v12 frame or 390-geometry "
    + "conformance fact about any one screen's controls; closing it means widening "
    + "MOBILE_CONTROL_SELECTOR (a separate act, DEC-253's own contract) rather than fixing "
    + "a rendered defect, the same INSTRUMENT-COMPLETENESS disposition "
    + "ROUTE_SUBSTATE_UNVISITED_CEILING already has (scripts/render-sweep-lib.ts).",
  BACKTICK_PARITY_CEILING:
    "measures how many decision documents carry an ODD number of backtick characters, i.e. a code "
    + "span left open so that every citation after it is read inside a quote that was never closed -- "
    + "a MARKDOWN-HYGIENE fact about the decision registry's own prose, and an instrument-completeness "
    + "guard on the citation scans that read it, never a v12 frame or 390-geometry conformance fact "
    + "about any screen the product draws. Grading it would put a documentation-formatting count in "
    + "the campaign's exit total, where a prose repair would read as product convergence "
    + "(test/citation-form-drift.scan.test.ts, DEC-967).",
  DRAWN_FIELD_LABEL_DIVERGENCE_CEILING:
    "measures whether a drawn v12 FIELD label (an 11px/800-weight/0.1em-tracking eyebrow span "
    + "over an input-shaped box) matches the WORDS the app's hardcoded label actually renders -- "
    + "a fidelity fact distinct from whether a frame is CITED or a control's declared WIDTH "
    + "matches (test/desktop-field-width.scan.test.ts), the same disposition already given to "
    + "FIELD_WIDTH_DIVERGENCE_CEILING and DESKTOP_FLOOR_DIVERGENCE_CEILING. A newly measured "
    + "population's non-zero row would move the campaign's goalposts mid-convergence; it "
    + "measures fidelity now (test/drawn-field-label.scan.test.ts, DEC-613 wave-25 task w25-i) "
    + "and is promoted once its measurement technique is proven complete enough to gate on. "
    + "DEC-069 promotion clause (a) refusal: its own measured count is non-zero (a real, standing "
    + "divergence), so the promotion rule does not apply yet regardless of its "
    + "DRAWN_FIELD_LABEL_UNRESOLVED_CEILING sibling's own adjudication state.",
  DRAWN_FIELD_LABEL_UNRESOLVED_CEILING:
    "measures how many drawn v12 FIELD-label rows this ledger's join could not resolve to any "
    + "grade (STORED-FIELD-LABEL, HARDCODED-MATCHES or HARDCODED-DIVERGES) -- an "
    + "instrument-completeness fact about the ledger's own join technique (here, a single row "
    + "whose feature is a recorded, deferred non-build per DEVIATIONS.md §6/DEC-032), not itself "
    + "a v12 frame or 390-geometry conformance fact, the same disposition already given to "
    + "FIELD_WIDTH_UNRESOLVED_CEILING (test/drawn-field-label.scan.test.ts, DEC-613 wave-25 task "
    + "w25-i).",
  FIELD_WIDTH_UNRESOLVED_CEILING:
    "measures how many drawn Settings edit-view field-width rows the label-to-SettingsField "
    + "join could not resolve to a matching component call site -- an instrument-completeness "
    + "fact about the ledger's own join technique, not itself a v12 frame or 390-geometry "
    + "conformance fact, the same disposition already given to DESKTOP_FLOOR_UNRESOLVED_CEILING.",
  CONFIRM_TITLE_OBJECT_CEILING:
    "measures the whole app's `<ConfirmDialog title=` idiom ADOPTION -- the scan's own header "
    + "(app/src/confirm-title-object.scan.test.ts) declares its population is every "
    + "ConfirmDialog call site, not only irreversible/destructive ones, and states it 'does not "
    + "require them to change; it only measures the idiom's current adoption' -- an adoption "
    + "meter over the whole call-site population, not a v12 frame or 390-geometry conformance "
    + "fact (DEC-808 wave-13m amendment).",
  AUDIT_GREP_NEGATIVE_STALE_CEILING:
    "measures TEST-INSTRUMENT SOUNDNESS -- how many of docs/design/audit/**/*.md's own "
    + "hand-run 'grepped X for Y: zero hits' claims no longer hold against the tree. It grades "
    + "the audit corpus's own claim hygiene (DEC-069 wave-19 clause (b)), not itself a v12 frame "
    + "or 390-geometry conformance fact about any one screen (test/audit-gap-row-staleness.scan.test.ts, "
    + "DEC-808 wave-24 amendment).",
  UNRESOLVED_COUNT_TRIPWIRE:
    "measures how many drawn phone controls the frame-control-floor ledger's own label/token/rule "
    + "join could not resolve (no-label-match/no-token/no-rule/no-control-shape) -- an "
    + "instrument-completeness fact about that ledger's own join technique, not itself a v12 frame "
    + "or 390-geometry conformance fact, the same disposition already given to "
    + "DESKTOP_FLOOR_UNRESOLVED_CEILING (test/frame-control-floor.scan.test.ts, DEC-808 wave-24 "
    + "amendment).",
  RAW_JSON_BODY_DOOR_CEILING:
    "measures how many src/routes/** handlers still read a request body through the raw Hono "
    + "`c.req.json(` API instead of src/server/http.ts's readJsonBody/readOptionalJsonBody, which "
    + "refuse a literal `null` body with the house 400 `invalid` envelope rather than crashing the "
    + "next dereference into an unhandled 500 -- a server-side request-parsing robustness fact "
    + "about a route's error envelope, not itself a v12 frame or 390-geometry conformance fact "
    + "(test/json-body-door.scan.test.ts, DEC-613 wave-23 amendment).",
  MINT_DOOR_UNCAPPED_CEILING:
    "measures how many mint doors (route handlers that insert a new domain row) reference no "
    + "batch/count MAX_* bound in their own handler body or named repo/** insert function, and "
    + "carry no `mint-cap-exempt:` comment -- a server-side write-door robustness fact about "
    + "whether a mint can be flooded with unbounded rows, not itself a v12 frame or 390-geometry "
    + "conformance fact (test/mint-door-cap-census.scan.test.ts, DEC-180 wave-23 amendment).",

  FRAME_EYEBROW_UNRESOLVED_CEILING:
    "measures how many drawn phone eyebrow rows the eyebrow ledger's own verbatim join could not "
    + "resolve (a value composed from live data at render time, which a static substring join can "
    + "never verify) -- an instrument-completeness fact about that ledger's own join technique, not "
    + "itself a v12 frame or 390-geometry conformance fact, the same disposition already given to "
    + "DESKTOP_FLOOR_UNRESOLVED_CEILING (test/frame-eyebrow-label.scan.test.ts, DEC-976 wave-27 "
    + "amendment).",

  AUDIT_FILE_FLOOR:
    "measures a MONOTONE-UPWARD non-vacuity minimum -- how many audit documents the "
    + "open-divergence ledger's own recursive enumerator must still reach before its walk may be "
    + "trusted -- over a corpus that GROWS every time a ledger appends a document. A floor whose "
    + "honest direction of travel is upward can never converge to zero, so grading it would make "
    + "ordinary corpus growth read as campaign regression; it is a population-vacuity guard on "
    + "that ledger's own enumerator, not a v12 frame or 390-geometry conformance fact "
    + "(test/open-divergence-ledger.scan.test.ts, DEC-808 wave-28 amendment).",
  TOKEN_ROW_FLOOR:
    "measures the same MONOTONE-UPWARD non-vacuity minimum one level in -- how many raw "
    + "DIVERGES-token rows that enumerator must still open across the corpus before an empty walk "
    + "can be told apart from a genuinely drained one -- and rises with every divergence a new "
    + "audit document records, whether or not any of them is open. It guards the ledger's own "
    + "population against silently going vacuous; the conformance question is asked by "
    + "OPEN_DIVERGENCE_CEILING, which is graded (test/open-divergence-ledger.scan.test.ts, "
    + "DEC-808 wave-28 amendment).",
  FRAME_COUNT_CAPTION_UNMATCHED_CEILING:
    "measures a newly-derived word population (a v12 frame's digit-bearing muted-prose caption "
    + "-- 'N recipients', 'N of M reviews in' -- the caption ledger's own header names as ungraded, "
    + "'a COMPOSED-from-data render, graded by a different instrument were one to exist') against a "
    + "grader that is DELIBERATELY narrower than the caption ledger's own (digit-collapse only, no "
    + "merge-placeholder collapse), so it resolves far fewer composed rows than that ledger does by "
    + "construction -- an instrument-completeness fact about this new, narrower technique, not a "
    + "copy-fidelity claim about the app (the caption ledger's own FRAME_CAPTION_UNMATCHED_CEILING = "
    + "0 means every one of these rows resolves under ITS stronger grader -- proven, not merely "
    + "cited, by a companion two-sided ratchet that runs that grader over every row, DEC-180 wave-42 "
    + "amendment). A newly measured, "
    + "previously-uncounted population must not move the campaign's goalposts mid-convergence; it is "
    + "promoted once its measurement technique is proven complete enough to gate on, the same "
    + "disposition already given to DESKTOP_FLOOR_UNRESOLVED_CEILING and FRAME_EYEBROW_UNRESOLVED_CEILING "
    + "(test/frame-count-caption-ledger.scan.test.ts, DEC-180 wave-28 amendment). "
    + "DEC-069 promotion clause (a) refusal: its own measured count is non-zero, so the promotion "
    + "rule does not apply yet.",
  PACK_UNIT_GRAMMAR_OFFENDERS_CEILING:
    "measures a newly-derived size-unit population (every product font-size/gap declaration whose "
    + "COMPUTED px value at the 16px root sits outside the pack's own drawn px vocabulary for that "
    + "property) that no instrument previously graded -- a real conformance fact about this "
    + "population, but a freshly measured, previously-uncounted population must not move the "
    + "campaign's goalposts mid-convergence; it is promoted once a later lane drains it, the same "
    + "disposition already given to DESKTOP_FLOOR_DIVERGENCE_CEILING "
    + "(test/pack-unit-grammar.scan.test.ts, DEC-937 wave-29 amendment). "
    + "DEC-069 promotion clause (a) refusal: its own measured count is non-zero, so the promotion "
    + "rule does not apply yet regardless of its PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING sibling's own "
    + "adjudication state.",
  PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING:
    "measures how many of that same population are `em` literals, whose computed px depends on an "
    + "inherited size this scan cannot resolve -- an instrument-completeness fact about the ratchet's "
    + "own join technique, not itself a v12 frame or 390-geometry conformance fact, the same "
    + "disposition already given to DESKTOP_FLOOR_UNRESOLVED_CEILING "
    + "(test/pack-unit-grammar.scan.test.ts, DEC-937 wave-29 amendment).",
  FRAME_CONDITIONAL_STATE_UNMOUNTED_CEILING:
    "measures how many drawn conditional-state rows this join found real product EVIDENCE for (a "
    + "literal copy match or a structural discriminant match) but no `*.test.ts(x)` file anywhere in "
    + "the repo also contains that same evidence -- an instrument-completeness/test-coverage fact "
    + "about the join's own mounting check, not itself a v12 frame or 390-geometry conformance fact, "
    + "the same disposition already given to FRAME_EYEBROW_UNRESOLVED_CEILING "
    + "(test/frame-conditional-state.scan.test.ts, DEC-383 wave-29 amendment).",
  // MEGABATCH NOTE (wave-32/34 thunderdome): the four entries below were added
  // to scripts/exit-predicate.ts by task w32-a in the same batch that
  // v12m-custodian-w32-3 decomposed that file into this module. The custodian
  // was cut from the pre-w32-a base, so its extraction could not carry them --
  // they are re-applied here verbatim, at their new home, rather than dropped.
  RULING_UNIT_GAP_CEILING:
    "measures a newly-derived population (every top-level `- ` bullet, `\\d+. ` numbered item and "
    + "`**`-led bold paragraph in docs/design/DESIGN-RULINGS.md, keyed `<heading-slug>::<n>` under "
    + "its parent heading -- 137 rows) that no instrument previously graded: the pre-existing heading "
    + "ledger honors one artifact per HEADING (DEC-100 'a coverage cap is not an identity' at file "
    + "scope), this widens it to the RULING itself. Every one of the 137 is currently 'gap' -- design "
    + "rationale prose (an argument, a cross-reference, a legend entry, a spec sub-rule), not a "
    + "standalone claim with its own single code artifact; a borrowed citation from the parent "
    + "heading's own honored row would misrepresent which fact the unit's own words assert, which "
    + "this ledger's gap-verdict prose forbids. A newly measured, previously-uncounted population "
    + "must not move the campaign's goalposts mid-convergence; it is promoted once later waves drain "
    + "individual units to genuine 1:1 citations, the same disposition already given to "
    + "PACK_UNIT_GRAMMAR_OFFENDERS_CEILING "
    + "(test/design-rulings-ledger.scan.test.ts, DEC-582 wave-31 amendment). "
    + "DEC-069 promotion clause (a) refusal: its own measured count is non-zero (most of the "
    + "population still gap-verdict), so the promotion rule does not apply yet.",
  // NOTE (wave-31 merge train): v12m-w31-f also registered
  // BACKTICK_PARITY_CEILING here, believing it had "landed unregistered".
  // It was in fact already registered above (see the BACKTICK_PARITY_CEILING
  // entry in this same object), with the same UNGRADED disposition, the same
  // test/citation-form-drift.scan.test.ts citation and the same DEC-967
  // basis -- w31-f was cut from a main that predated that registration. The
  // duplicate literal is dropped rather than merged: two keys with one name
  // is a TS1117 error, and the surviving entry is the fuller statement of
  // the identical ruling.
  PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING:
    "measures a newly-derived population (a phone `display:none` rule whose hidden `chq-` token "
    + "carries a STATIC text child the pack draws verbatim inside some width:390 frame extent -- the "
    + "hide's own premise is contradicted) that no instrument previously graded -- a real "
    + "capability/copy-fidelity fact about this specific population, but a newly measured, "
    + "previously-uncounted population must not move the campaign's goalposts mid-convergence; it is "
    + "promoted once its measurement technique is proven complete enough to gate on, the same "
    + "disposition already given to DESKTOP_FLOOR_DIVERGENCE_CEILING (app/src/phone-hidden-drawn-text.scan.test.ts, "
    + "DEC-725 wave-31 amendment). DEC-069 promotion clause (a) refusal: its own measured count is "
    + "non-zero, so the promotion rule does not apply yet regardless of its "
    + "PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING sibling's own adjudication state.",
  PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING:
    "measures how many of that same population's hidden rules resolve to a COMPOSED (non-static) "
    + "text child the static substring join can never verify -- an instrument-completeness fact about "
    + "this ledger's own join technique, not itself a v12 frame or 390-geometry conformance fact, the "
    + "same disposition already given to FRAME_EYEBROW_UNRESOLVED_CEILING "
    + "(app/src/phone-hidden-drawn-text.scan.test.ts, DEC-725 wave-31 amendment).",
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
  TWIN_VISIBILITY_OFFENDER_CEILING:
    "measures dock={...} call sites whose class token IS reachable by a selector but whose "
    + "CSS half of the DEC-576 idiom is incomplete (no top-level display:none, never revived "
    + "at phone, or no same-page inline twin found) -- a real twin-visibility defect count over "
    + "a newly-derived population, per DEC-069's own promotion clause: not itself yet promoted "
    + "into the exit gate, the same disposition already given to "
    + "PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING (app/src/phone-twin-visibility.scan.test.ts).",
  TWIN_VISIBILITY_CLASSLESS_CEILING:
    "measures dock={...} call sites whose markup carries NO chq- class token besides the "
    + "app's generic chq-btn* button-utility classes -- no selector can ever reach that copy "
    + "to hide it at any width, so it is not itself a graded defect COUNT so much as a roster "
    + "of sites structurally incapable of the DEC-576 idiom until given a dock-specific class "
    + "(the same 'row in the roster, not a silent pass' disposition TAP_FLOOR_EXEMPT_UNVERIFIABLE_"
    + "PREMISE_CEILING already carries); one named row (src/routes/portal/profile.tsx's "
    + "profileDock) is the live /portal/profile desktop double-Save's root cause, a product "
    + "fix this measurement-only instrument does not itself make "
    + "(app/src/phone-twin-visibility.scan.test.ts, docs/design/audit/phone-twin-visibility-v12.md).",
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
  PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING:
    "measures a newly-derived population -- a phone `display:none` rule whose SELECTOR is not "
    + "itself interactive but whose target element's JSX subtree contains an interactive descendant, "
    + "so hiding the container removes a capability the selector-keyed filter cannot see -- that no "
    + "instrument previously graded. A real capability-removal fact about this specific population, "
    + "but a newly measured, previously-uncounted population must not move the campaign's goalposts "
    + "mid-convergence; it is promoted once later waves adjudicate each row against its own v12 frame "
    + "and either receipt or repair it, the same disposition already given to "
    + "PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING (app/src/phone-hidden-container.scan.test.ts, "
    + "DEC-808 wave-41 amendment).",

  DESKTOP_EYEBROW_DIVERGENCE_CEILING:
    "measures a newly-derived word population (a desktop, non-390 card frame's drawn "
    + "text-transform:uppercase eyebrow, disjoint by construction from the caption ledger and the "
    + "desktop control-label ledger, ported from the phone eyebrow ledger's own grammar) that no "
    + "instrument previously graded -- a real copy-fidelity fact about this specific population, but a "
    + "newly measured, previously-uncounted population must not move the campaign's goalposts "
    + "mid-convergence; it is promoted once its measurement technique is proven complete enough to "
    + "gate on, the same disposition already given to FRAME_EYEBROW_DIVERGENCE_CEILING and "
    + "DESKTOP_FLOOR_DIVERGENCE_CEILING (test/desktop-eyebrow-label.scan.test.ts, DEC-986 wave-41 "
    + "amendment).",
  DESKTOP_EYEBROW_UNRESOLVED_CEILING:
    "measures how many drawn desktop eyebrow rows the eyebrow ledger's own verbatim/skeleton join "
    + "could not resolve (a value composed from live data at render time, which a static substring "
    + "join can never verify) -- an instrument-completeness fact about that ledger's own join "
    + "technique, not itself a v12 frame or 390-geometry conformance fact, the same disposition "
    + "already given to FRAME_EYEBROW_UNRESOLVED_CEILING and DESKTOP_FLOOR_UNRESOLVED_CEILING "
    + "(test/desktop-eyebrow-label.scan.test.ts, DEC-986 wave-41 amendment).",
  // Megabatch registration pass (wave-37..42 thunderdome): six ratchets
  // landed in this batch declared but registered nowhere, which makes them
  // invisible to the exit predicate and to the two-sided population walk
  // (DEC-808 wave-24 clause 3). Each is registered here on the merits of
  // its own instrument's stated subject -- none of the six is a v12 frame
  // or 390-geometry conformance fact about a screen the product draws.
  AUDIT_RATCHET_STATEMENT_DRIFT_CEILING:
    "measures how many audit-doc paragraphs make a statement about a live ratchet constant that "
    + "disagrees with that constant's current value -- a DOC-INTEGRITY fact about the audit corpus's "
    + "own narration, not itself a v12 frame or 390-geometry conformance fact about any screen the "
    + "product draws, the same disposition already given to DECISIONS_REGISTRY_CITATION_CEILING "
    + "(test/audit-ratchet-statement-drift.scan.test.ts, DEC-903 wave-41 amendment).",
  FRAME_CONDITIONAL_STATE_FALSE_MATCH_CEILING:
    "measures the FALSE-MATCH rate of the conditional-state ledger's own sc-if/frame join -- an "
    + "instrument-completeness fact about that join's precision, not a fidelity fact about any "
    + "screen: a false match is the instrument mis-reading itself, never a divergence the product "
    + "owes. The same disposition already given to FRAME_EYEBROW_UNRESOLVED_CEILING "
    + "(test/frame-conditional-state.scan.test.ts, DEC-383 wave-29 amendment).",
  COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING:
    "measures how many drawn count captions neither of the caption ledger's two independent "
    + "graders could resolve -- an instrument-completeness fact about the WEAKER of two joins "
    + "agreeing with the stronger, not itself a v12 frame conformance fact (the fidelity count that "
    + "IS one, FRAME_COUNT_CAPTION_UNMATCHED_CEILING, is registered separately above) "
    + "(test/frame-count-caption-ledger.scan.test.ts, DEC-180 wave-42 amendment).",
  FRAME_REPEATED_ROW_GAP_CEILING:
    "measures a newly-derived population -- every repeated-row group a v12 frame draws whose "
    + "product-side row template this ledger cannot yet pin to a single rendering site -- that no "
    + "instrument previously graded. A newly measured, previously-uncounted population must not "
    + "move the campaign's goalposts mid-convergence; it is promoted once its measurement technique "
    + "is proven complete enough to gate on, the same disposition already given to "
    + "PACK_UNIT_GRAMMAR_OFFENDERS_CEILING (test/frame-repeated-row/ceiling.ts, DEC-976 wave-40 "
    + "amendment).",
  UNCLIPPED_EXTENT_DERIVATION_CEILING:
    "measures INSTRUMENT COVERAGE for one defect family -- how many `.ts`/`.tsx` files derive a "
    + "frame `extentEnd` from a `.dc.html` label scan without clipping it at that file's own "
    + "`</x-dc>` template close -- a fact about how completely DEC-967's wave-42 ruling has been "
    + "ported across the tree's twelve frame walks, not itself a v12 frame or 390-geometry "
    + "conformance fact about any screen; it is promoted, or retired, once every walk carries the "
    + "clip (app/src/phone-hidden-drawn-text.scan.test.ts, DEC-967 wave-42 amendment).",
  SSR_CLASSLESS_CONTROL_CEILING:
    "measures how many SSR-rendered controls carry no `chq-` class token any selector could reach "
    + "-- a REACHABILITY fact about the markup's own instrumentability (a control no selector can "
    + "name can be neither floored nor exempted, so it is a roster row rather than a graded "
    + "divergence), the same 'row in the roster, not a silent pass' disposition "
    + "TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING already carries "
    + "(app/src/phone-tap-target-scan/ssr-classless-control-ceiling.ts, DEC-996 wave-40 amendment).",
};

/**
 * DEC-069 wave-36 promotion rule, executed as CODE (discharged wave-37, task
 * w37-c): every `OUT_OF_CAMPAIGN_SCOPE` entry whose own prose carries a
 * promotion promise ("it measures fidelity now and is promoted once/by
 * ...") must have a row here naming the sibling constant its clause (b)
 * depends on, and whether that sibling's outstanding rows are individually,
 * per-row adjudicated in its own audit doc -- a documented FACT about the
 * audit doc's shape, never a measured *_CEILING VALUE (this lane owns no
 * ceiling value; `scripts/exit-predicate/campaign.ts`'s
 * `assertParkedPromisesAreHonestlyParked` reads the real, live counts at
 * assertion time via `findConstantDeclarations`). `siblingName: null` means
 * the promise names no completeness-sibling ceiling at all -- its own
 * single count already carries the whole conformance fact, so clause (b) is
 * vacuously satisfied and clause (a) alone decides it.
 *
 * A promise-bearing `OUT_OF_CAMPAIGN_SCOPE` entry missing from this table,
 * or a table entry whose real, live evidence now clears both clauses while
 * its ceiling still sits in `OUT_OF_CAMPAIGN_SCOPE` rather than
 * `CAMPAIGN_CONSTANT_NAMES`/`TIER2_CEILING_NAMES`, both throw -- a promise
 * with no rule behind it, and a passing promise left unpaid, are the same
 * loophole DEC-069 wave-36 was written to close.
 */
export interface ParkedFidelityPromise {
  readonly siblingName: string | null;
  readonly siblingFullyAdjudicated: boolean;
}

export const PARKED_FIDELITY_PROMISES: Readonly<Record<string, ParkedFidelityPromise>> = {
  // Clause (b) fails: DESKTOP_FLOOR_UNRESOLVED_CEILING's 131 unresolved rows
  // are bucketed by reason category (test/desktop-control-floor.scan.test.ts),
  // never itemised one row at a time.
  DESKTOP_FLOOR_DIVERGENCE_CEILING: {
    siblingName: "DESKTOP_FLOOR_UNRESOLVED_CEILING",
    siblingFullyAdjudicated: false,
  },
  // Clause (b) fails: UNRESOLVED_COUNT_TRIPWIRE's unresolved rows are
  // bucketed by reason category with a cited sample, never itemised one row
  // at a time (docs/design/audit/frame-control-floor-390-v12.md).
  FRAME_FLOOR_DIVERGENCE_CEILING: {
    siblingName: "UNRESOLVED_COUNT_TRIPWIRE",
    siblingFullyAdjudicated: false,
  },
  // No completeness sibling -- the citation-resolvability count is its own
  // whole conformance fact. Clause (a) alone decides it (currently non-zero).
  DECISIONS_REGISTRY_CITATION_CEILING: { siblingName: null, siblingFullyAdjudicated: true },
  // Clause (b) holds (docs/design/audit/drawn-field-label-v12.md's one
  // DRAWN_FIELD_LABEL_UNRESOLVED_CEILING row is individually adjudicated in
  // place), but clause (a) fails: its own count is non-zero.
  DRAWN_FIELD_LABEL_DIVERGENCE_CEILING: {
    siblingName: "DRAWN_FIELD_LABEL_UNRESOLVED_CEILING",
    siblingFullyAdjudicated: true,
  },
  // No completeness sibling. Clause (a) alone decides it (currently
  // non-zero).
  FRAME_COUNT_CAPTION_UNMATCHED_CEILING: { siblingName: null, siblingFullyAdjudicated: true },
  // Clause (b) holds (docs/design/audit/pack-unit-grammar-v12.md itemises
  // every one of PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING's `em`-literal rows by
  // coordinate), but clause (a) fails: its own count is non-zero.
  PACK_UNIT_GRAMMAR_OFFENDERS_CEILING: {
    siblingName: "PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING",
    siblingFullyAdjudicated: true,
  },
  // No completeness sibling. Clause (a) alone decides it (currently
  // non-zero -- most of the ruling-unit population is still gap-verdict).
  RULING_UNIT_GAP_CEILING: { siblingName: null, siblingFullyAdjudicated: true },
  // Clause (b) holds (docs/design/audit/phone-hidden-drawn-text-v12.md's
  // "UNVERIFIABLE roster" itemises every one of
  // PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING's rows individually), but
  // clause (a) fails: its own count is non-zero.
  PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING: {
    siblingName: "PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING",
    siblingFullyAdjudicated: true,
  },
};
