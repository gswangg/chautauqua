// DEC-069 wave-116+ campaign exit predicate: constant-name REGISTRIES.
//
// Extracted from scripts/exit-predicate/campaign-scope.ts (custodian
// decomposition, contention-hotspot split -- NO behavior change; see that
// file's header for the module's overall shape and
// scripts/exit-predicate.ts's header for the top-level decomposition this
// nests under). This file holds only TIER2_CEILING_NAMES; its siblings
// (CAMPAIGN_CONSTANT_NAMES, OUT_OF_CAMPAIGN_SCOPE,
// ParkedFidelityPromise/PARKED_FIDELITY_PROMISES) live in their own files
// beside it, all re-exported from campaign-scope.ts so every existing
// import path keeps working unchanged.


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
  // wave-45 (DEC-069 wave-44/45 amendments): wired into TIER2 in the same
  // commit that moved it out of OUT_OF_CAMPAIGN_SCOPE into
  // CAMPAIGN_CONSTANT_NAMES above -- never a declared-but-unread knob
  // (DEC-851/DEC-988). Reads live 0: a graded green conformance row.
  "SSR_CLASSLESS_CONTROL_CEILING",
  // wave-45 (DEC-069 wave-44/45 amendments): wired into TIER2 in the same
  // commit that moved it out of OUT_OF_CAMPAIGN_SCOPE into
  // CAMPAIGN_CONSTANT_NAMES above -- never a declared-but-unread knob
  // (DEC-851/DEC-988). Reads live 0: a graded green conformance row.
  "COUNT_CAPTION_UNMATCHED_BY_BOTH_CEILING",
  // wave-48 (task w48-b, DEC-896 wave-48 amendment): wired into TIER2 in the
  // same commit that declared it in CAMPAIGN_CONSTANT_NAMES above -- never a
  // declared-but-unread knob (DEC-851/DEC-988).
  "PACK_GRID_TRACK_UNMATCHED_CEILING",
  // wave-49 (DEC-613/DEC-069 amendment, task w49-c): wired into TIER2 in the
  // same commit that promoted it out of OUT_OF_CAMPAIGN_SCOPE into
  // CAMPAIGN_CONSTANT_NAMES above -- never a declared-but-unread knob
  // (DEC-851/DEC-988). Reads live 0: a graded green conformance row.
  "DRAWN_FIELD_LABEL_DIVERGENCE_CEILING",
  // wave-49 (DEC-937/DEC-069 wave-49, task w49-b): wired into TIER2 in the
  // same commit that moved it out of OUT_OF_CAMPAIGN_SCOPE into
  // CAMPAIGN_CONSTANT_NAMES above. Reads live 0 by RULED_LEFT
  // classification: a graded green conformance row.
  "PACK_UNIT_GRAMMAR_OFFENDERS_CEILING",
  // wave-55 (task v12m-w55-a, DEC-374 wave-52 amendment, executed): wired
  // into TIER2 in the same commit that moved it out of OUT_OF_CAMPAIGN_SCOPE
  // into CAMPAIGN_CONSTANT_NAMES above. Reads live 0: the desktop-control-
  // floor comment-fold parse is repaired, a graded green conformance row.
  "COMMENT_CREDITED_FLOOR_CEILING",
];
