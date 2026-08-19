# Tap-floor v12 audit: row-action-anchor evasion offenders (task w5-c)

## Unreceipted phone `display:none` on an interactive control (task w2-t)

`app/src/phone-capability-removal.scan.test.ts` counts
`src/routes/auth.css.ts :: .chq-auth-stack .chq-auth-tertiary { display:
none; }` as one of its unreceipted interactive phone hides. DEC-919
wave-101 allows exactly three receipt shapes (desktop twin of a phone-only
sibling, drag handle, bare navigational glyph); this rule fits none of
them. It is also not eligible for RE-LINING within this task's scope: the
sheet's later (w1-h) rules already re-line the SAME `.chq-auth-tertiary`
class for every OTHER auth page (`Back to sign in`, etc.) via an unscoped
`.chq-auth-tertiary` rule, but `.chq-auth-stack .chq-auth-tertiary`'s
extra specificity means /login's own "Forgot your password?" link still
resolves to `display:none` regardless of source order — deleting the
scoped hide would change what /login renders (the link would reappear,
unstyled by the re-lined 44px-floor treatment, contradicting
`test/account-signin-phone.test.ts:117`'s pinned expectation that the
390 frame draws no Forgot link inside the Sign-in stack at all). Left
counted per DEC-919 wave-101's own text ("never receipting on
assumption"); a future wave that either re-scopes the re-lined
`.chq-auth-tertiary` treatment to also win inside `.chq-auth-stack`, or
gets a design ruling to drop the /login Forgot link's phone hide test
pin, can close this row.

Measured by `app/src/phone-tap-target.scan.test.ts`'s row-action-anchor scan (DEC-393 wave-87 amendment) on this branch. Each row names a CSS selector that mentions a bare-anchor or row-action-container token (DESIGN-RULINGS.md:189's evasion) with no conforming `@media (max-width: 700px)` rule (`min-height:>=44px` + `display:flex` + `align-items:center` + non-zero horizontal padding, all three, reaching the anchor) and no `tap-floor-exempt` comment. Every row here lives OUTSIDE this task's scope (`app/src/components/*.css`, `app/src/pages/submissions/*.css`) and is left for its owning cluster/wave to fix or exempt.

**Refreshed wave 108 (v12m-w4-o, DEC-808 amendment).** Measurement method:
copy `app/src/phone-tap-target.scan.test.ts`, force
`ANCHOR_FLOOR_OFFENDERS_CEILING` to `-1` so the offender-ceiling `it()`
fails unconditionally, run `npx vitest run app/src/phone-tap-target.scan.test.ts`,
and read the offender list the failure message prints — never trust a
previously recorded number or an audit doc's own count. Do this in a
throwaway copy of the test file (or revert the edit after reading the
output); do not commit the forced `-1`.

Total: 64 offenders, matching `ANCHOR_FLOOR_OFFENDERS_CEILING` in the scan
file (re-measured this wave — down from the previously recorded 92, which
had gone stale as other lanes fixed offenders — including the entire
agenda cluster and every `app/src/pages/contacts/*.css` row below — without
lowering the ratchet).

## `(no CSS rule)`

- `.chq-overview-link-btn-read`
- `.chq-overview-row-actions-stacked`
- `.chq-review-plan-action-link`
- `.chq-settings-public-pages-view-action`
- `.chq-speakers-card-actions`

## `app/src/components/modal-frame.css` (shared modal chrome)

- `.chq-modal-head .chq-phone-back`

## `app/src/pages/comms/comms.css` (Comms)

- `.chq-bulkbar-actions`
- `.chq-comms-history-head-actions`
- `.chq-comms-preview-actions`
- `.chq-comms-refusal-actions`
- `.chq-comms-select-actions`
- `.chq-comms-send-report-footer-actions`
- `.chq-comms-template-actions`

## `app/src/pages/contacts/contacts-panels.css` (Contacts)

- `.chq-modal-actions`

## `app/src/pages/content/content.css` (Content)

- `.chq-bulkbar-actions`
- `.chq-content-actions`
- `.chq-content-comment-actions`
- `.chq-content-detail-actions`
- `.chq-content-files-header-actions`
- `.chq-content-status-band-actions`
- `.chq-content-summary-actions`
- `.chq-content-worklist-col-actions`
- `.chq-pill`

## `app/src/pages/forms/forms.css` (Forms / CFP builder)

- `.chq-forms-back`
- `.chq-forms-field-actions`
- `.chq-forms-field-modal-actions-right`
- `.chq-forms-header-actions`
- `.chq-modal-actions`

## `app/src/pages/overview/overview.css` (Overview)

- `.chq-overview-deadline-cell`
- `.chq-overview-link-inline`
- `.chq-overview-toolbar-btn`
- `.chq-overview-toolbar-btn-primary`

## `app/src/pages/review/review.css` (Review)

- `.chq-pill`
- `.chq-review-criteria-empty-actions`
- `.chq-review-criterion-options-footer .chq-review-add-link, .chq-review-add-criteria .chq-review-add-link`
- `.chq-review-decision-actions`
- `.chq-review-editor-actions`
- `.chq-review-editor-title-actions`
- `.chq-review-queue-title`
- `.chq-review-results-head-actions`
- `.chq-review-scope-confirm-actions`
- `.chq-review-section-head-actions .chq-link-button`
- `.chq-review-title-actions`

## `app/src/pages/review/scorecard.css` (Review)

- `.chq-review-editor-actions`

## `app/src/pages/settings/settings-drill-rows.css` (Settings)

- `.chq-settings-drillrow-export-download`

## `app/src/pages/settings/settings.css` (Settings)

- `.chq-settings-summary-pills .chq-pill, .chq-settings-portal-pills .chq-pill`
- `.chq-settings-tokens-col-actions`

## `app/src/pages/speakers/speakers.css` (Speakers)

- `.chq-pill`
- `.chq-row-title`
- `.chq-speakers-phone-head-actions`

## `app/src/pages/speakers/task-view.css` (Speakers)

- `.chq-taskview-tab, .chq-taskview-open, .chq-taskview-clear`

## `app/src/pages/submissions/detail.css` (Submissions)

- `.chq-detail-back, .chq-detail-position-prev, .chq-detail-position-next` (first rule)
- `.chq-detail-back, .chq-detail-position-prev, .chq-detail-position-next` (second, distinct rule reaching the same selector text)
- `.chq-detail-back, .chq-detail-position-prev, .chq-detail-position-next, .chq-detail-back-full, .chq-detail-back-short`

## `app/src/styles.css` (Shell (shared app/src/styles.css))

- `.chq-bulkbar-actions`
- `.chq-contacts-col-actions`
- `.chq-contacts-drawer-actions`
- `.chq-embeds-output-actions`
- `.chq-empty-actions`
- `.chq-link-button`
- `.chq-modal-actions`
- `.chq-pill, .chq-rail-link, .chq-checkbox-label, .chq-btn-tertiary`
- `.chq-row-title`
- `.chq-section-action`

