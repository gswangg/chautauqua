// DEC-069 wave-116+ campaign exit predicate: OUT_OF_CAMPAIGN_SCOPE partial
// registry (custodian decomposition of
// scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts -- NO
// behavior change; see that file's header for why it split, and
// scripts/exit-predicate/campaign-scope.ts's header for the top-level
// barrel this nests under).
//
// Entries whose reason is a newly-derived MOBILE/PHONE/PORTAL population
// fact (visibility, interactive-offender count, adoption meter), parked
// the same way.
//
// Merged into the full OUT_OF_CAMPAIGN_SCOPE map by
// out-of-campaign-scope.ts alongside its siblings below; nothing outside
// this directory imports MOBILE_POPULATION_OUT_OF_SCOPE directly.
export const MOBILE_POPULATION_OUT_OF_SCOPE: Record<string, string> = {
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
  CONFIRM_TITLE_OBJECT_CEILING:
    "measures the whole app's `<ConfirmDialog title=` idiom ADOPTION -- the scan's own header "
    + "(app/src/confirm-title-object.scan.test.ts) declares its population is every "
    + "ConfirmDialog call site, not only irreversible/destructive ones, and states it 'does not "
    + "require them to change; it only measures the idiom's current adoption' -- an adoption "
    + "meter over the whole call-site population, not a v12 frame or 390-geometry conformance "
    + "fact (DEC-808 wave-13m amendment).",
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

  FRAME_REPEATED_ROW_GAP_CEILING:
    "measures a newly-derived population -- every repeated-row group a v12 frame draws whose "
    + "product-side row template this ledger cannot yet pin to a single rendering site -- an "
    + "instrument-completeness fact about how precisely this ledger can pin a row template, not "
    + "itself a v12 frame conformance fact about any screen. The same disposition already given to "
    + "PACK_UNIT_GRAMMAR_OFFENDERS_CEILING (test/frame-repeated-row/ceiling.ts, DEC-976 wave-40 "
    + "amendment, DEC-069 wave-44/45 amendments).",
  // DEC-069 wave-45 amendment: the "it is promoted, or retired, once every
  // walk carries the clip" sentence evaded PROMOTION_PROMISE_RE only by
  // accident of wording, which wave 45 named a loophole rather than a
  // compliance. Struck: this reason is now principle-only, which matters
  // because task w44-b drives this constant to 0.
};
