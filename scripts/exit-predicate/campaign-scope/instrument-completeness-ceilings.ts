// DEC-069 wave-116+ campaign exit predicate: OUT_OF_CAMPAIGN_SCOPE partial
// registry (custodian decomposition of
// scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts -- NO
// behavior change; see that file's header for why it split, and
// scripts/exit-predicate/campaign-scope.ts's header for the top-level
// barrel this nests under).
//
// Entries whose reason is an INSTRUMENT-COMPLETENESS fact: a ledger's own
// join/derivation/resolution technique cannot yet resolve part of its
// population (an UNRESOLVED_CEILING or a vacuity-tripwire FLOOR), not a
// v12 frame or 390-geometry conformance fact about the product.
//
// Merged into the full OUT_OF_CAMPAIGN_SCOPE map by
// out-of-campaign-scope.ts alongside its siblings below; nothing outside
// this directory imports INSTRUMENT_COMPLETENESS_OUT_OF_SCOPE directly.
export const INSTRUMENT_COMPLETENESS_OUT_OF_SCOPE: Record<string, string> = {
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
  UNRESOLVED_COUNT_TRIPWIRE:
    "measures how many drawn phone controls the frame-control-floor ledger's own label/token/rule "
    + "join could not resolve (no-label-match/no-token/no-rule/no-control-shape) -- an "
    + "instrument-completeness fact about that ledger's own join technique, not itself a v12 frame "
    + "or 390-geometry conformance fact, the same disposition already given to "
    + "DESKTOP_FLOOR_UNRESOLVED_CEILING (test/frame-control-floor.scan.test.ts, DEC-808 wave-24 "
    + "amendment).",
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
  FRAME_CONDITIONAL_STATE_FALSE_MATCH_CEILING:
    "measures the FALSE-MATCH rate of the conditional-state ledger's own sc-if/frame join -- an "
    + "instrument-completeness fact about that join's precision, not a fidelity fact about any "
    + "screen: a false match is the instrument mis-reading itself, never a divergence the product "
    + "owes. The same disposition already given to FRAME_EYEBROW_UNRESOLVED_CEILING "
    + "(test/frame-conditional-state.scan.test.ts, DEC-383 wave-29 amendment).",
  // DEC-069 wave-45 amendment: FRAME_REPEATED_ROW_GAP_CEILING's reason is now
  // PRINCIPLE-ONLY. The promotion-promise sentence wave 44 never authorised
  // ("it is promoted once its measurement technique is proven complete enough
  // to gate on") is struck -- it is what made
  // `assertParkedPromisesAreHonestlyParked` throw with a promise no
  // PARKED_FIDELITY_PROMISES row stood behind.
  UNCLIPPED_EXTENT_DERIVATION_CEILING:
    "measures INSTRUMENT COVERAGE for one defect family -- how many `.ts`/`.tsx` files derive a "
    + "frame `extentEnd` from a `.dc.html` label scan without clipping it at that file's own "
    + "`</x-dc>` template close -- a fact about how completely DEC-967's wave-42 ruling has been "
    + "ported across the tree's twelve frame walks, not itself a v12 frame or 390-geometry "
    + "conformance fact about any screen "
    + "(app/src/phone-hidden-drawn-text.scan.test.ts, DEC-967 wave-42 amendment, DEC-069 "
    + "wave-44/45 amendments).",
  PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING:
    "measures how many of that same letter-spacing population are var(--chq-...) references this "
    + "scan could not resolve to a declared token -- an instrument-completeness fact about the "
    + "ratchet's own token-resolution technique, not itself a v12 frame or 390-geometry conformance "
    + "fact, the same disposition already given to PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING "
    + "(test/pack-typography-register.scan.test.ts, DEC-937 wave-43 amendment).",
  PACK_TYPOGRAPHY_TEXT_TRANSFORM_UNRESOLVED_CEILING:
    "measures how many of that same text-transform population are var(--chq-...) references this "
    + "scan could not resolve to a declared token -- an instrument-completeness fact about the "
    + "ratchet's own token-resolution technique, the same disposition already given to "
    + "PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING "
    + "(test/pack-typography-register.scan.test.ts, DEC-937 wave-43 amendment).",

  FRAME_VERDICT_ASYNC_QUERY_POPULATION_FLOOR:
    "the vacuity tripwire (currently 43) for the SAME test-corpus-determinism population its "
    + "already-registered sibling FRAME_VERDICT_ASYNC_QUERY_CEILING excuses immediately above -- "
    + "a fact about whether this receipt can be trusted to fail only on a real product defect, "
    + "never a v12 frame or 390-geometry conformance fact, never silently pass over a shrunken "
    + "population because a rename or a moved directory made the walk see fewer files than the "
    + "wave-43 measured set. A floor whose sibling ceiling is excused cannot itself be a graded "
    + "campaign row (test/frame-verdict-async-query.scan.test.ts, DEC-976 wave-43 amendment, "
    + "DEC-069 wave-50 amendment).",

};
