// Ratchet ceiling constants for the phone tap-target floor scans (DEC-253
// amendment, DEC-367 floor, DEC-393 row-action-anchor amendment).
//
// Extracted from phone-tap-target.scan.test.ts (custodian decomposition,
// wave v12m-w12) with NO behavior change: every constant below, and its
// full amendment-history comment, is byte-for-byte what used to sit inline
// above each `describe` block in that file. The file had become a repeat
// merge-conflict hotspot precisely because every lane that drained a
// different offender category (SPA row-actions, styles.css, review.css,
// SSR routes...) all appended prose to the SAME giant file, right above
// constants none of them actually needed to see each other's history to
// edit. Isolating each ceiling (with its own append-only history) into
// this dedicated module means two lanes lowering two DIFFERENT ceilings no
// longer touch the same lines.
//
// Every ceiling here remains a one-sided ratchet: may only be LOWERED, by
// re-measuring on the branch/tree it is being lowered against, never
// raised to accommodate a new offender (DEC-989).

// Re-measured wave 108 (v12m-w4-o, DEC-808 amendment) by forcing this const
// to -1 and reading the printed offender list: truth is 64, not the stale
// 92 this constant carried. Set to the measured truth; see the companion
// "never below the ceiling without lowering it" test for the other half of
// the ratchet this file's own test name always claimed to have.
//
// Re-measured wave 8 task w8-h: `checkToken`'s `(no CSS rule)` branch only
// ever checked TOP-LEVEL rules, so a phone-only token whose rule correctly
// lives inside the <=700px block and nowhere else was misreported as
// undeclared -- verified false for `.chq-review-plan-action-link`
// (review.css), `.chq-settings-public-pages-view-action` (settings.css)
// and `.chq-overview-link-btn-read` (overview.css), all of which have real
// narrow-media rules. Added a narrow-media fallback with the SAME
// predicate/reach/exemption logic; forcing the const to -1 afterwards reads
// 65 -> 64 (one of the three drops out fully floored, the other two become
// real per-file rows). One container token (`.chq-comms-phone-recent-head-actions`)
// genuinely stayed `(no CSS rule)` at the time: it has a real rule body and a
// narrow rule, but it never reaches an anchor (DEC-393: "the floor is reached
// by the anchor, not its container") -- dispositioned by v12m-w9-e.
// `.chq-speakers-card-actions` (dispositioned by v12m-w9-j with a correct
// `tap-floor-exempt` comment, its children all `<button>`/`.chq-btn`) was
// NOT a real finding but was misreported as one for three waves: the narrow-
// media fallback's `if (reaching.length === 0) continue` fired before the
// exemption check, so a container whose selector shape can never satisfy
// `selectorReachesAnchor` was reported `(no CSS rule)` however well-formed
// its exemption comment. Fixed wave-123 task w12-r (DEC-967): the fallback
// now checks every file that mentions the token at all, reaching or not, for
// an exemption before reporting the row. `.chq-overview-row-actions-stacked`
// was NOT a real finding: `rowActionContainerTokens` read raw CSS text
// without stripping comments, so overview.css:306's comment recording that
// DEC-735 RETIRED the class (never a live rule, never live markup --
// `overview-phone-floor.test.ts` pins both) was misread as a declaration.
// Fixed wave-120 task w9-k (DEC-989): comments are stripped before deriving
// the container population, and the offender count is measured, not carried
// forward with the fabrication baked in. Then fixed the five real offenders
// this lane owns in `app/src/pages/forms/forms.css` (`.chq-forms-back`,
// `.chq-forms-field-actions`, `.chq-forms-field-modal-actions-right`,
// `.chq-forms-header-actions`, `.chq-modal-actions`) inside the file's
// single terminal `@media (max-width: 700px)` block: `.chq-forms-back` and
// the two anchor-bearing containers (`.chq-forms-field-actions`,
// `.chq-forms-header-actions`) got a conforming min-height/flex-centre/
// padding rule on the anchor itself; `.chq-forms-field-modal-actions-right`
// and forms.css's own `.chq-modal-actions` scope wrap Cancel/Save/Delete
// -- all `<button>`, never an `<a>`/`<Link>` -- so they carry a
// `tap-floor-exempt` comment instead of a rule that could never reach an
// anchor. Re-measured truth after both fixes: 59.
//
// Re-measured 59 -> 58 by the merge train on 2026-08-19 (megabatch gate) by
// running this file's own scan: one more anchor-bearing row action picked up
// a conforming phone rule in the wave-111 tap-floor/overflow batch. Lowered
// to the measured truth; this ratchet may only fall.
//
// Re-measured 58 -> 57 wave-120 task w9-k (DEC-989): `rowActionContainerTokens`
// no longer misreads a CSS comment (overview.css:306, a DEC-735 retirement
// note for `.chq-overview-row-actions-stacked`) as a class declaration --
// forced the const to -1 and read the printed offender list, the fabricated
// `(no CSS rule) — .chq-overview-row-actions-stacked` row is gone and no
// other row moved. Lowered to the measured truth.
// Re-measured 58 -> 53 by task w9-i (DEC-393 wave-120 receipt), measured by
// running THIS file's own scan on this branch (ceiling forced to -1, offender
// list read by eye, DEC-989 clause a): drained the five overview.css
// row-action-anchor offenders named in the wave-120 receipt --
// `.chq-overview-deadline-cell` (tap-floor-exempt: whole-cell `<Link>`, frame
// forbids centring), `.chq-overview-toolbar-btn` (real floor: display:flex +
// align-items:center + padding-inline added to its phone rule),
// `.chq-overview-toolbar-btn-primary` (tap-floor-exempt: every markup site
// also carries the base class above, which now floors it),
// `.chq-overview-link-btn.chq-overview-link-btn-read` (real floor added to
// its phone rule) and `.chq-overview-link-inline` (its existing DEC-393
// wave-106 prose converted to the machine-readable `tap-floor-exempt:`
// grammar, no declaration added). Lowered to the measured truth; this
// ratchet may only fall.
//
// Re-measured 58 -> 53 wave 120 (v12m-w9-j, DEC-393 wave-120 three-receipt
// ruling): drained the five owned offenders (speakers.css .chq-row-title/
// .chq-speakers-phone-head-actions, task-view.css .chq-taskview-open,
// settings-drill-rows.css/settings.css) plus the (no CSS rule) 6th row.
//
// Megabatch (wave-120 Thunderdome): the w9-k, w9-i and w9-j lowerings above are
// independent drains of disjoint offender sets, merged in one pass; the constant
// below is the re-measured combined truth of the merged tree, not any single
// branch's figure. This ratchet may only fall.
// 2026-08-20 (v12m-w12-m, DEC-989 lane-owned lowering): CONTENT cluster
// tier-2 sweep cleared its 9 owned rows (content.css) -- 47 -> 38, re-
// measured on this branch alone. Concurrent lanes touch the same integer;
// the merge train re-measures the integrated tree.
//
// Re-measured 2026-08-20 (task w12-k): drained all ten offenders this wave's
// task assigned in app/src/styles.css (the shell sheet) -- five containers
// (.chq-bulkbar-actions, .chq-contacts-col-actions,
// .chq-contacts-drawer-actions, .chq-embeds-output-actions,
// .chq-modal-actions) cleared with a `tap-floor-exempt` comment (every
// child is a plain button, never an anchor), and five given a real phone
// floor (.chq-empty-actions a, .chq-link-button, .chq-section-action,
// .chq-row-title, a.chq-pill/a.chq-rail-link per DEC-576's element-
// qualified ruling). 47 -> 37 on this branch alone; other lanes' offenders
// (comms.css, content.css, review.css, scorecard.css,
// contacts-panels.css, settings.css, speakers.css, submissions/detail.css,
// modal-frame.css) are untouched here -- DEC-989: this is the worker's own
// drain, the merge train re-measures the combined truth.
//
// 2026-08-20 (task w12-l, DEC-393/DEC-989/DEC-576): drained review.css's 12
// offenders and scorecard.css's 1 -- 9 button-only `*-actions` containers
// exempted (PlanEditor.tsx/ResultsTable.tsx/Scorecard.tsx render only
// chq-btn children), .chq-pill exempted per DEC-576 composition (the
// element-qualified `a.chq-pill` floor lives in app/src/styles.css, review
// renders .chq-pill only as button/span), and 3 real bare-anchor rules
// (.chq-review-add-link x2, .chq-review-plan-action-link,
// .chq-review-section-head-actions .chq-link-button) strengthened from
// `display: inline-flex` to `display: flex` (the predicate requires the
// exact literal). One new floor added for .chq-review-queue-title's Link
// form and .chq-review-results-head-actions' Download-CSV/See-all links,
// which had no phone rule at all. 47 -> 34, re-measured on this branch;
// lowered from the wave-120 megabatch value by exactly 13.
//
// DEC-989 (wave-123 amendment): lowered 47 -> 40 by task v12m-w12-n,
// COMMS cluster tier-2 sweep -- the 7 comms.css row-action-anchor
// offenders (chq-bulkbar-actions, chq-comms-history-head-actions,
// chq-comms-preview-actions, chq-comms-refusal-actions,
// chq-comms-select-actions, chq-comms-send-report-footer-actions,
// chq-comms-template-actions) are floored or exempted. Re-measured
// 2026-08-20.
//
// Re-measured 15 -> 14 wave-123 task w12-r (DEC-967/DEC-989): fixed the
// narrow-media fallback's `if (reaching.length === 0) continue` firing
// before the exemption check, which fabricated the `(no CSS rule) —
// .chq-speakers-card-actions` row every wave since v12m-w9-j wrote its
// correct `tap-floor-exempt` comment (a container whose children are all
// `.chq-btn` can never satisfy `selectorReachesAnchor`, so `reaching` was
// always empty). Forced this constant to -1 and read the printed offender
// list on this branch alone: 14, one row lower, no other row moved. DEC-989
// wave-123 protocol: this is the draining lane's own branch-measured value;
// the merge train re-measures the integrated tree.
//
// w12-p (2026-08-20): re-measured at 45, down from 47 (this branch measured
// 46 live before this wave's fix -- the ceiling was already one stale
// beyond the tree; both are accounted for here). Per DEC-576 this wave,
// the bare `.chq-pill` token is deliberately NOT floored -- PipelineBoard.tsx
// renders it as a read-only `<span>` and PortalSettingsPanel.tsx as
// `.chq-pill-static`, neither an interactive control the floor applies to.
// speakers.css's `.chq-speakers-filters .chq-pill.is-active` row is cleared
// via a `tap-floor-exempt: composition` comment (speakers.css renders
// `.chq-pill` only as `<button>`, already floored by the base .chq-btn-less
// button path, never as `<a>`). settings.css's
// `.chq-settings-summary-pills .chq-pill, .chq-settings-portal-pills
// .chq-pill` row is cleared by a new element-qualified `a.chq-pill` rule in
// its terminal phone block (YourDataPanel.tsx:219 DOES render `<a
// className="chq-pill">`) declaring min-height/flex-center/padding-inline
// together, rather than relying on the union of styles.css's shared phone
// rule (no padding of its own) plus settings.css's two decorative rules (no
// flex-center of their own). DEC-989: the lane that drains an offender set
// lowers the ceiling to its own measured value in the same commit.
//
// Re-measured 47 -> 42 (task v12m-w12-q, DEC-393, wave 123 CONTACTS + MODAL +
// SUBMISSION-DETAIL tier-2 sweep): drained five offenders --
// contacts-panels.css `.chq-modal-actions` (tap-floor-exempt: every
// ModalFrame `actions` slot this file renders is `<button>`-only),
// modal-frame.css `.chq-modal-head .chq-phone-back` (real floor: min-height
// + align-items:center + non-zero padding-inline added to its own phone
// rule), and detail.css's combined `.chq-detail-back,
// .chq-detail-position-prev, .chq-detail-position-next` (three reported
// rows collapsing to one fix: `display: inline-flex` was invisible to this
// scan's literal `hasFlexCenter` predicate -- changed to `display: flex`,
// byte-identical rendering since a flex item is blockified regardless of
// its own outer display keyword). Ceiling lowered to the measured truth;
// this ratchet may only fall.
//
// Thunderdome megabatch (wave 123): the lane lowerings above are independent
// drains of disjoint offender sets merged in one pass; the constant below is
// the re-measured truth of the integrated tree, not any single branch's
// figure. This ratchet may only fall.
export const ANCHOR_FLOOR_OFFENDERS_CEILING = 0;

/** Seeded at the count measured when this population was first scanned
 * (mandate item 5). Was ONE-SIDED (may only be LOWERED, never raised) --
 * see the history below the constant for why, and task w4-ae (DEC-393
 * wave-115) for why that no longer holds: the last 3 offenders got a real
 * floor, measured truth is 0, and this ceiling now has the same two-sided
 * companion every other ratchet in this file carries (the
 * "never falls below" test just below the history comment).
 */
// Re-measured wave-139 (task w14-cc, DEC-393 + DEC-976 wave-138; DEC-613 +
// DEC-989 wave-139): `tapTargetTagTokens`'s shared `if (tag === 'a' &&
// !tokens.includes('chq-btn')) continue;` was honest on the SPA (`.chq-btn`
// is the control primitive that carries the floor) and BLIND on SSR (no
// such primitive -- a bare `<a>` IS the control; `ssr.ts`'s own header
// already cited `a.chq-docs-wordmark` at 112.6x28 as a live probe
// measurement it could not see). Repaired as a PARAMETER on the one shared
// extractor (`anchorNeedsBtnToken`, default `true`, unchanged for every SPA
// call site) rather than a fork or a widened shared default -- widening the
// default would drag four SPA ratchets (base tap-target, undeclared-height,
// anchor-floor, this file's SSR sub-floor sibling above) into a population
// where the SPA carve-out is correct. `allSsrTapTargetTokens` is the ONLY
// caller passing `{ anchorNeedsBtnToken: false }`.
//
// Forced this constant to -1 and read the printed offender list on this
// branch: population 25 -> 75, unfloored 0 -> 28 (docs-site.css.ts 6,
// portal.css.ts 3, agenda.css.ts 3, chrome.css.ts 3, home.css.ts 3, rail.css.ts
// 4, cards.css.ts 2, empty.css.ts 1, error-states.css.ts 1, plus 2 tokens
// with `(no CSS rule)` at all). Set to the measured truth, 28 -- this is the
// WIDENING lane; two sibling lanes this wave (v12m-w14-dd, v12m-w14-ee)
// drain the 28 with CSS receipts and touch no constant. RATCHET:
// SSR_UNFLOORED_TOKENS_CEILING=28.
// Thunderdome megabatch re-measurement: the two sibling drain lanes
// (v12m-w13-ee, v12m-w13-ff) landed in this same batch and floored every
// one of the 28 tokens w14-cc's widening lane had exposed. Re-measured on
// the integrated tree: 0 offenders. Lowered per DEC-989 wave-123's
// protocol -- the merge train writes the combined truth.
export const SSR_UNFLOORED_TOKENS_CEILING = 0;

// task w7-e (DEC-367/DEC-385) lowered this from 14 to 3, measured after
// repair by forcing the ceiling to -1 and reading the printed offender
// list. Retired with named `tap-floor-exempt:` comments (the three
// modifiers a per-token text scan can't follow through composition):
// `.chq-visually-hidden` (src/routes/public/css/chrome.css.ts,
// screen-reader-only utility, never a tap target),
// `.chq-btn-secondary`/`.chq-btn-tertiary` (src/views/theme.ts) and
// `.chq-field-invalid` (src/views/error-states.css.ts). Given a real
// >=44px phone-width floor (additive, inside each sheet's terminal
// `@media (max-width: 700px)` block): `.chq-auth-demo-btn`
// (src/routes/auth.css.ts, live-probed at 269.8x17), `.chq-docs-search-
// input` (src/routes/docs-site.css.ts), `.chq-pub-search-submit`,
// `.chq-pub-search`, `.chq-pub-select`, `.chq-pub-select-active` (all
// src/routes/public/css/chrome.css.ts) and `.chq-itinerary-toggle`
// (src/routes/public/css/rail.css.ts -- floored on the visually-hidden
// checkbox itself with `pointer-events:none`, since the real tap surface
// is, and stays, the wrapping `.chq-pub-save`/`.chq-pub-itinerary-row`
// label already floored on this same phone block).
//
// The 3 remaining are `.chq-portal-copresenter-email-flagged`,
// `.chq-portal-header-signout-btn`, `.chq-portal-preview-download` --
// all declared in src/routes/portal/portal.css.ts.
//
// Merge note (thunderdome megabatch): the custodian decomposition branch
// (v12m-custodian-w8-1) predates w7-e's lowering and carried the stale 14.
// Restored to 3 here -- the decomposition is explicitly NO behavior
// change, and this ceiling may only ever be LOWERED.
//
// Task w4-ae (DEC-393 wave-115) drained the remaining 3: all get a real
// `min-height: 44px` + centred flex + non-zero horizontal padding inside
// portal.css.ts's terminal `@media (max-width: 700px)` block (append-only,
// after every existing rule -- DEC-385), none using the cancelled-padding
// idiom since `.chq-portal-copresenter-email-flagged` paints a
// `border-left` and that idiom is borderless-only (DEC-383 wave-109).
// Re-measured by forcing the const to -1 and reading the printed offender
// list: truth is 0, confirmed empty by eye (DEC-989 clause a) before
// writing the 0 above. This was the tree's last one-sided ratchet
// (DEC-518) -- given its two-sided companion below to match every other
// ceiling in this file.

/** Seeded at the count measured when this population was first scanned
 * (mandate item 5). Two-sided as of task w7-dc (DEC-808 wave-85 amendment):
 * the "deliberately one-sided" note this constant used to carry predates
 * DEC-808's blanket requirement and was itself the exact shape DEC-808
 * exists to close -- see phone-tap-target-ssr.scan.test.ts's companion
 * "never falls below the SSR declared-sub-floor ceiling" `it`. */
export const SSR_TAP_FLOOR_OFFENDERS_CEILING = 0;

// Wave v12m-w17 task w17-c (DEC-808): SSR_UNFLOORED_TOKENS_CEILING above
// reads 0 while ~27 `<a>` under src/routes/** declare neither `class=` nor
// `className=` -- a token-keyed population is ungradeable by construction
// once its subject carries no token. Widening lens, deliberately NOT a
// fix -- draining is w17-d/w17-e's job. Forced this constant to -1 and
// read the printed offender list on branch v12m-w17-c (main at
// `0e3ece58`): population enumerated by
// ssrRouteTsxFiles()/classlessAnchorSites() over every src/routes/**/*.tsx
// (excluding *.test.* and src/routes/dev/**), each classless `<a>` keyed on
// its nearest enclosing element's chq- token READ FROM THE SAME FILE (a
// depth-only tag-stack walk, scoped per-file per the task's own grammar --
// SpeakerDetailContent's Sessions list in detail.tsx sits directly in a
// fragment with no in-file wrapper, so it correctly reports "(no enclosing
// chq- token)" even though a parent template elsewhere may wrap it), graded
// against every SSR CSS module (including src/views/theme.ts) via the same
// three-clause floor predicate anchor-floor.ts's row-action lens uses.
// Measured truth: 26 (25 keyed offenders across auth-views.tsx,
// docs.tsx, portal/index.tsx, portal/preview.tsx, portal/tasks/views.tsx,
// public/agenda-grid.tsx, public/agenda-rail.tsx, public/agenda.tsx,
// public/detail.tsx, public/sessions.tsx, public/shell.tsx,
// public/submit-views.tsx, plus 1 "(no enclosing chq- token)" row). Set to
// the measured truth; a two-sided ratchet like every ceiling in this file
// -- this constant's own draining lanes must lower it in the same commit
// that fixes an offender, same DEC-989 protocol. RATCHET:
// SSR_CLASSLESS_ANCHOR_CEILING=26
//
// v12m-w18-e (task w18-e, DEC-967): a merge-train medic had already lowered
// this to 13 by the time this branch measured main at `76fdc56a`. Forced
// to -1 and read the printed offender list again on this branch: 13 live
// (auth-views.tsx:136/:139/:225 .chq-auth-footer-links x3;
// docs.tsx:59 .chq-section; portal/tasks/views.tsx:298 .chq-card;
// public/submit-views.tsx:115/:165/:797/:798 .chq-cfp-links,
// :562 .chq-cfp-intro-cta, :681 .chq-cfp-identity-note,
// :771/:791 .chq-cfp-confirm-actions). All 13 drained this wave -- the
// .chq-cfp-links/.chq-auth-footer-links/.chq-portal-standalone-link-shape
// standalone anchors got a real phone floor (literal `display: flex`
// restated in the terminal <=700px block beside the pre-existing
// min-height/padding, since the base rule's `inline-flex` is invisible to
// this scan's narrow-rules-only lens); the sentence-phrase anchors
// (.chq-section, .chq-card, .chq-cfp-intro-cta, .chq-cfp-identity-note,
// .chq-cfp-confirm-actions) took the inline-in-prose exemption instead.
// Re-measured after the fix: 0. RATCHET: SSR_CLASSLESS_ANCHOR_CEILING=0
export const SSR_CLASSLESS_ANCHOR_CEILING = 0;

// Wave v12m-w10 task w10-na (DEC-180 wave-154 amendment): every SPA
// tap-target ratchet in this directory is keyed on class TOKENS taken from
// markup -- a control declaring NO `className=` at all (a bare `<a>`, a
// react-router `<Link>`/`<NavLink>`, a bare `<button>`/`<select>`/
// `<textarea>`/`<input>`) contributes no token and is ungradeable by
// construction, the same blind spot `SSR_UNFLOORED_TOKENS_CEILING` and
// `SSR_CLASSLESS_ANCHOR_CEILING` above name for the SSR half of the
// product -- no SPA mirror of that widening ever existed. See
// `app/src/phone-tap-target-spa-classless-control.scan.test.ts` for the
// population/predicate and `docs/design/audit/spa-classless-control-390
// -v12.md` for the full offender ledger.
//
// Forced to -1 and read the printed offender list on this branch: raw
// population 15 (the bare anchor in
// app/src/pages/settings/PortalSettingsPanel.tsx had no enclosing
// chq- token at all -- given its own `chq-settings-portal-preview-link`
// class directly so it could carry a floor, dropping raw population to 14
// and offenders to 4 in the same pass). Drained 11 of 15 -- Agenda.tsx,
// NotFound.tsx x2, EventSettingsPanel.tsx, PortalSettingsPanel.tsx,
// RosterPanel.tsx, SpeakerDetailPage.tsx x2, ContactDrawer.tsx,
// SubmissionDetailPage.tsx x2 -- each given a real phone floor
// (min-height:44px + centred flex + non-zero horizontal padding) inside
// its own cluster sheet's terminal `@media (max-width: 700px)` block
// (append-only, DEC-385, desktop byte-identical). The remaining 4 --
// AddToEventModal.tsx, BulkEmailModal.tsx, DuplicateEmailNotice.tsx,
// NewContactModal.tsx, all keyed on tokens declared in app/src/styles.css
// -- were SHELL-owned (that task's HARD SCOPE forbade editing
// app/src/styles.css / app/src/App.tsx) and stayed in the ceiling;
// recorded as a shell finding in the audit doc, not silently exempted.
//
// v12m-w12-qa (task qa-shell-classless-floor, DEC-180 wave-156, shell
// lane): drained the remaining 4. Each of the four shell-owned tokens
// (.chq-add-to-event-result, .chq-bulk-email-result,
// .chq-contacts-duplicate-email-notice,
// .chq-contacts-new-contact-duplicate-hint) got an element-qualified `a`
// descendant rule (literal `display: flex`, not `inline-flex`) appended to
// app/src/styles.css's terminal `@media (max-width: 700px)` block. Forced
// to -1 and read the printed offender list: 0. RATCHET:
// SPA_CLASSLESS_CONTROL_CEILING=0
export const SPA_CLASSLESS_CONTROL_CEILING = 0;
