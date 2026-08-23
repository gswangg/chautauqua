// DEC-069 wave-116+ campaign exit predicate: OUT_OF_CAMPAIGN_SCOPE partial
// registry (custodian decomposition of
// scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts -- NO
// behavior change; see that file's header for why it split, and
// scripts/exit-predicate/campaign-scope.ts's header for the top-level
// barrel this nests under).
//
// Entries whose reason is a v12 PACK VOCABULARY-CONFORMANCE fact (colour,
// typography, geometry, motion) over a newly-derived population, parked
// under DEC-069's 'goalposts mid-convergence' refusal rather than graded.
//
// Merged into the full OUT_OF_CAMPAIGN_SCOPE map by
// out-of-campaign-scope.ts alongside its siblings below; nothing outside
// this directory imports PACK_VOCABULARY_OUT_OF_SCOPE directly.
export const PACK_VOCABULARY_OUT_OF_SCOPE: Record<string, string> = {
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
  EQUAL_SPECIFICITY_SHADOWED_CEILING:
    "measures a DIFFERENT-SELECTOR cascade-order exposure (DEC-385 single-direction) -- how " +
    "many max-width declarations are beaten by a different, equal-or-higher-specificity " +
    "top-level selector, targeting the same component (a shared chq- class token), declared " +
    "after the max-width block closes. It is a fidelity fact narrower than the identical-" +
    "selector SHADOWED_CEILING measures, not a v12 frame citation or geometry fact; a newly " +
    "non-zero row here would move the campaign's goalposts mid-convergence.",
  NEGATIVE_MARGIN_ADJACENCY_CEILING:
    "measures a STATIC, authoring-time property of every CSS rule in the tracked tree -- " +
    "whether a negative top/all-sides margin's preceding-comment receipt names an external " +
    "sibling whose display:none base is revealed by some @media block in the same sheet -- " +
    "not a live-pixel overlap a render sweep would catch. It grades every rule in every " +
    "sheet, including surfaces no route sweep visits, deliberately distinct from any " +
    "live-pixel superimposition detector the campaign's render lane might carry, so it is " +
    "not a v12 frame or 390-geometry conformance fact in the campaign's own sense " +
    "(app/src/negative-margin-adjacency.scan.test.ts, DEC-919 wave-152 amendment).",
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
  PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING:
    "measures a newly-derived population -- the two token files' hex colour literals graded against "
    + "the pack's own drawn hex vocabulary, a palette CONFORMANCE fact distinct from the palette "
    + "CLOSURE test/palette-conformance.test.ts already gates (closure proves colour literals are "
    + "confined to the two token files; this proves those files' VALUES match what the pack draws) "
    + "-- that no instrument previously graded. A real colour-fidelity fact about this specific "
    + "population, but a newly measured, previously-uncounted population must not move the "
    + "campaign's goalposts mid-convergence; both offenders (--chq-disabled #7d7869, "
    + "--chq-on-ink-muted #b5afa2) are individually adjudicated LEFT rather than repaired -- each "
    + "moves a WCAG-contrast-pinned byte (DEC-436 wave-25, DEC-367 original handoff) with no v12 "
    + "frame demanding the move, and DESKTOP IS FROZEN -- the same disposition already given to "
    + "PACK_UNIT_GRAMMAR_OFFENDERS_CEILING and PACK_VOCABULARY_OFFENDERS_CEILING "
    + "(test/pack-colour-vocabulary.scan.test.ts, DEC-383 wave-43 amendment, task w43-d).",
  PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING:
    "measures the same newly-derived population's colour-FUNCTION grammar (rgb()/rgba()/hsl()/hsla(), "
    + "graded by channel triple with alpha ignored) alongside "
    + "PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING immediately above -- currently 0 (the product's "
    + "one rgba() declaration matches the pack's drawn triple), kept beside its sibling so the pair "
    + "is promoted or re-measured together rather than one ceiling silently outliving the other "
    + "(test/pack-colour-vocabulary.scan.test.ts, DEC-383 wave-43 amendment, task w43-d).",
  PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING:
    "measures a newly-derived TYPOGRAPHY-REGISTER population (every product letter-spacing "
    + "declaration, token-resolved, whose literal em value sits outside the pack's own drawn "
    + "em vocabulary) that no instrument previously graded -- pack-unit-grammar's own header names "
    + "this population live and explicitly unrouted since wave-29 ('a later lane should treat this "
    + "as a NEW ratchet with its own vocabulary-derivation shape, not an extension of this one'). A "
    + "real conformance fact about this population, but a freshly measured, previously-uncounted "
    + "population must not move the campaign's goalposts mid-convergence -- the same disposition "
    + "already given to PACK_UNIT_GRAMMAR_OFFENDERS_CEILING "
    + "(test/pack-typography-register.scan.test.ts, DEC-937 wave-43 amendment, DEC-069 wave-51 "
    + "amendment: promotion-promise language removed, DEC-069 promotion clause (a) refusal stands -- "
    + "not yet proven complete enough to gate on).",
  PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING:
    "measures the same newly-derived TYPOGRAPHY-REGISTER shape applied to text-transform (every "
    + "product declaration, token-resolved, whose keyword sits outside the pack's own drawn keyword "
    + "vocabulary) -- its one measured offender (.chq-wordmark's `lowercase`) is a settled DEC-884 "
    + "exclusion pinned by eleven test files, so this ceiling is a bookkeeping count of an already-"
    + "adjudicated site rather than open debt, but stays out of the gated lists for the same reason "
    + "as its letter-spacing sibling: a freshly measured, previously-uncounted population must not "
    + "move the campaign's goalposts mid-convergence "
    + "(test/pack-typography-register.scan.test.ts, DEC-937/DEC-884 wave-43 amendment).",
  TRUNCATION_TRIAD_OFFENDERS_CEILING:
    "measures a newly-derived population -- every rule declaring `text-overflow: ellipsis` "
    + "whose SAME chq- class token carries no effective non-normal white-space and no effective "
    + "overflow/overflow-x hidden|clip companion at the 390 frame -- that no instrument "
    + "previously graded. Every one of its 5 measured rows is individually adjudicated in "
    + "docs/design/audit/phone-truncation-triad-v12.md: two are deliberate phone-authored "
    + "white-space:normal overrides (wrapping is the drawn intent, not a defect), three are "
    + "desktop-only <th> elements a hidden phone <thead> never draws (DESKTOP IS FROZEN, "
    + "DEC-385 -- the only repair site is the top-level rule this lane may not touch). A fully "
    + "adjudicated roster with no candidate defect is a conformance fact already closed, not a "
    + "live gate (app/src/phone-truncation-triad.scan.test.ts, DEC-808 wave-43 amendment).",

  INTERACTION_STATE_UNPAIRED_EASING_CEILING:
    "measures whether every --chq-motion-* transition names its paired --chq-ease-state token "
    + "(DEC-367 wave-47 finding) -- an INTERACTION-STATE / motion fact about whether a transition "
    + "silently falls back to CSS's default `ease` easing, not a v12 frame or 390-geometry "
    + "conformance fact about any drawn screen. Ships at its seed value of zero with a two-sided "
    + "companion already in the same describe block "
    + "(app/src/interaction-states.scan.test.ts, DEC-367 wave-47 amendment).",

  PACK_PADDING_UNMATCHED_CEILING:
    "measures a newly-derived population -- every `padding:` declaration docs/design/*.dc.html draws "
    + "inside a REACHABLE desktop frame, with the frame's own `5px 10px` number-badge chrome excluded "
    + "structurally (by the badge element's own four distinguishing style declarations, never a "
    + "hand-listed line set), joined against every `padding:` declaration the non-test product corpus "
    + "ships -- that no instrument previously graded. `padding` was the pack's largest ungraded "
    + "geometry axis (docs/design/audit/pack-grid-track-vocabulary-v12.md's own 'Rejected in the same "
    + "measurement pass' section), skipped for exactly the badge-chrome reason this ratchet now "
    + "resolves by derivation. A real conformance fact about this population, but a freshly measured, "
    + "previously-uncounted ~252-row population must not move the campaign's goalposts mid-"
    + "convergence; it is promoted once a later wave individually adjudicates the offender roster "
    + "against its own render site, the same disposition already given to "
    + "PACK_GRID_TRACK_UNMATCHED_CEILING and PACK_PROSE_MEASURE_DIVERGENCE_CEILING "
    + "(test/pack-padding-vocabulary.scan.test.ts, DEC-069 wave-53 amendment, task w53-e). This lane "
    + "moves no CSS byte; repair is a later lane's, sized from "
    + "docs/design/audit/pack-padding-vocabulary-v12.md's roster.",
};
