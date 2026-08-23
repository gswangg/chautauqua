// DEC-069 wave-116+ campaign exit predicate: constant-name REGISTRIES.
//
// Extracted from scripts/exit-predicate/campaign-scope.ts (custodian
// decomposition, contention-hotspot split -- NO behavior change; see that
// file's header for the module's overall shape and
// scripts/exit-predicate.ts's header for the top-level decomposition this
// nests under). This file holds only OUT_OF_CAMPAIGN_SCOPE; its siblings
// (CAMPAIGN_CONSTANT_NAMES, TIER2_CEILING_NAMES,
// ParkedFidelityPromise/PARKED_FIDELITY_PROMISES) live in their own files
// beside it, all re-exported from campaign-scope.ts so every existing
// import path keeps working unchanged.
//
// This is the file the field guide notes as the append-at-map-end
// contention hotspot for new OUT_OF_CAMPAIGN_SCOPE entries; isolating it
// from its two sibling name lists means a new entry here no longer
// conflicts with an unrelated edit to CAMPAIGN_CONSTANT_NAMES or
// TIER2_CEILING_NAMES in the same wave.


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
  // DEC-069 wave-45 amendment: FRAME_REPEATED_ROW_GAP_CEILING's reason is now
  // PRINCIPLE-ONLY. The promotion-promise sentence wave 44 never authorised
  // ("it is promoted once its measurement technique is proven complete enough
  // to gate on") is struck -- it is what made
  // `assertParkedPromisesAreHonestlyParked` throw with a promise no
  // PARKED_FIDELITY_PROMISES row stood behind.
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
  UNCLIPPED_EXTENT_DERIVATION_CEILING:
    "measures INSTRUMENT COVERAGE for one defect family -- how many `.ts`/`.tsx` files derive a "
    + "frame `extentEnd` from a `.dc.html` label scan without clipping it at that file's own "
    + "`</x-dc>` template close -- a fact about how completely DEC-967's wave-42 ruling has been "
    + "ported across the tree's twelve frame walks, not itself a v12 frame or 390-geometry "
    + "conformance fact about any screen "
    + "(app/src/phone-hidden-drawn-text.scan.test.ts, DEC-967 wave-42 amendment, DEC-069 "
    + "wave-44/45 amendments).",
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
  FRAME_VERDICT_ASYNC_QUERY_CEILING:
    "measures TEST-INSTRUMENT DETERMINISM -- whether a frame-verdict render `it` body issues a "
    + "bare screen/within getBy*/queryBy* DOM query after its own first `await`, the load-order "
    + "shape that made Comms.frame-verdicts.render.test.tsx's :286 pin green standalone and red "
    + "under the full 43-file concurrent run (repaired this same commit). It is a fact about the "
    + "test corpus's own reliability -- whether a receipt can be trusted to fail only on a real "
    + "product defect, never on scheduler luck -- not a v12 frame or 390-geometry conformance "
    + "fact, the same disposition already given to COMMENT_BLIND_CSS_ASSERTION_CEILING "
    + "(test/frame-verdict-async-query.scan.test.ts, DEC-976 wave-43 amendment).",

  PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING:
    "measures a newly-derived TYPOGRAPHY-REGISTER population (every product letter-spacing "
    + "declaration, token-resolved, whose literal em value sits outside the pack's own drawn "
    + "em vocabulary) that no instrument previously graded -- pack-unit-grammar's own header names "
    + "this population live and explicitly unrouted since wave-29 ('a later lane should treat this "
    + "as a NEW ratchet with its own vocabulary-derivation shape, not an extension of this one'). A "
    + "real conformance fact about this population, but a freshly measured, previously-uncounted "
    + "population must not move the campaign's goalposts mid-convergence; it is promoted once a "
    + "later wave proves the measurement technique complete enough to gate on, the same disposition "
    + "already given to PACK_UNIT_GRAMMAR_OFFENDERS_CEILING "
    + "(test/pack-typography-register.scan.test.ts, DEC-937 wave-43 amendment). "
    + "DEC-069 promotion clause (a) refusal: not yet proven complete enough to gate on.",
  PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING:
    "measures how many of that same letter-spacing population are var(--chq-...) references this "
    + "scan could not resolve to a declared token -- an instrument-completeness fact about the "
    + "ratchet's own token-resolution technique, not itself a v12 frame or 390-geometry conformance "
    + "fact, the same disposition already given to PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING "
    + "(test/pack-typography-register.scan.test.ts, DEC-937 wave-43 amendment).",
  PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING:
    "measures the same newly-derived TYPOGRAPHY-REGISTER shape applied to text-transform (every "
    + "product declaration, token-resolved, whose keyword sits outside the pack's own drawn keyword "
    + "vocabulary) -- its one measured offender (.chq-wordmark's `lowercase`) is a settled DEC-884 "
    + "exclusion pinned by eleven test files, so this ceiling is a bookkeeping count of an already-"
    + "adjudicated site rather than open debt, but stays out of the gated lists for the same reason "
    + "as its letter-spacing sibling: a freshly measured, previously-uncounted population must not "
    + "move the campaign's goalposts mid-convergence "
    + "(test/pack-typography-register.scan.test.ts, DEC-937/DEC-884 wave-43 amendment).",
  PACK_TYPOGRAPHY_TEXT_TRANSFORM_UNRESOLVED_CEILING:
    "measures how many of that same text-transform population are var(--chq-...) references this "
    + "scan could not resolve to a declared token -- an instrument-completeness fact about the "
    + "ratchet's own token-resolution technique, the same disposition already given to "
    + "PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING "
    + "(test/pack-typography-register.scan.test.ts, DEC-937 wave-43 amendment).",

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
};
