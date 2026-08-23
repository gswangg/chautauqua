// DEC-069 wave-116+ campaign exit predicate: constant-name REGISTRIES.
//
// Extracted from scripts/exit-predicate/campaign-scope.ts (custodian
// decomposition, contention-hotspot split -- NO behavior change; see that
// file's header for the module's overall shape and
// scripts/exit-predicate.ts's header for the top-level decomposition this
// nests under). This file holds only the ParkedFidelityPromise interface
// and PARKED_FIDELITY_PROMISES; its siblings (CAMPAIGN_CONSTANT_NAMES,
// TIER2_CEILING_NAMES, OUT_OF_CAMPAIGN_SCOPE) live in their own files
// beside it, all re-exported from campaign-scope.ts so every existing
// import path keeps working unchanged.


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
  // DEC-069 wave-44 amendment, offender (2): registered by task w41-e with a
  // promotion promise and no rule behind it. No completeness sibling exists --
  // app/src/phone-hidden-container.scan.test.ts declares exactly one ceiling,
  // so the container-capability count is its own whole conformance fact and
  // clause (b) is vacuously satisfied. Clause (a) alone decides it, and its
  // own count is non-zero, so it stays parked.
  PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING: { siblingName: null, siblingFullyAdjudicated: true },
  // DEC-069 wave-44 amendment, offender (2): registered by task w41-f with a
  // promotion promise and no rule behind it. Clause (b) HOLDS --
  // docs/design/audit/desktop-eyebrow-label-v12.md itemises
  // DESKTOP_EYEBROW_UNRESOLVED_CEILING's single unresolved row individually by
  // coordinate, not as a bucketed reason-category count -- but clause (a)
  // fails: its own count is non-zero, so it stays parked.
  DESKTOP_EYEBROW_DIVERGENCE_CEILING: {
    siblingName: "DESKTOP_EYEBROW_UNRESOLVED_CEILING",
    siblingFullyAdjudicated: true,
  },
  // No completeness sibling -- test/frame-repeated-row/ceiling.ts's own
  // population is a single unresolved-to-a-rendering-site count with no
  // separate "could not resolve" join behind it. Clause (a) alone decides
  // it (currently non-zero).
  FRAME_REPEATED_ROW_GAP_CEILING: { siblingName: null, siblingFullyAdjudicated: true },
  // No completeness sibling -- the UNRESOLVED half (15 of 26 rows: this
  // scan's render-file join cannot pin them) is folded into
  // test/pack-prose-measure.scan.test.ts's own GRADED/UNRESOLVED exports
  // and docs/design/audit/pack-prose-measure-v12.md's table rather than
  // graded by a second ceiling constant. Clause (a) alone decides it
  // (currently non-zero).
  PACK_PROSE_MEASURE_DIVERGENCE_CEILING: { siblingName: null, siblingFullyAdjudicated: true },
  // No completeness sibling -- test/desktop-control-floor.scan.test.ts
  // declares exactly one comment-credited-floor ceiling, so its own count
  // is the whole conformance fact (an instrument-soundness one, not a v12
  // frame fact). Clause (a) alone decides it (currently non-zero: 5).
  COMMENT_CREDITED_FLOOR_CEILING: { siblingName: null, siblingFullyAdjudicated: true },
};
