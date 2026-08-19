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

Total: 92 offenders, matching `ANCHOR_FLOOR_OFFENDERS_CEILING` in the scan file.

## `(no CSS rule)` (Overview)

- `.chq-overview-row-actions-stacked`

## `app/src/pages/agenda/agenda.css` (Agenda)

- `.chq-agenda-head-actions`
- `.chq-breaks-add-actions`
- `.chq-breaks-row-actions`
- `.chq-phone-footer-actions`
- `.chq-toolbar-link`

## `app/src/pages/comms/comms.css` (Comms)

- `.chq-bulkbar-actions`
- `.chq-comms-editor-actions`
- `.chq-comms-head-actions`
- `.chq-comms-history-head-actions`
- `.chq-comms-preview-actions`
- `.chq-comms-refusal-actions`
- `.chq-comms-select-actions`
- `.chq-comms-send-detail > .chq-link-button, .chq-comms-recent-sends .chq-section-head .chq-link-button, .chq-comms-blocked-list li .chq-link-button`
- `.chq-comms-send-report-all-history`
- `.chq-comms-send-report-footer-actions`
- `.chq-comms-template-actions`

## `app/src/pages/contacts/contacts-panels.css` (Contacts)

- `.chq-contacts-import-actions`
- `.chq-contacts-merge-back`
- `.chq-modal-actions`

## `app/src/pages/contacts/contacts.css` (Contacts)

- `.chq-contacts-drawer-actions`
- `.chq-contacts-drawer-actions-right`
- `.chq-contacts-rail-duplicate-actions`
- `.chq-contacts-title-actions`

## `app/src/pages/content/content.css` (Content)

- `.chq-bulkbar-actions`
- `.chq-content-actions`
- `.chq-content-comment-actions`
- `.chq-content-detail-action-link`
- `.chq-content-detail-actions`
- `.chq-content-detail-speaker-link`
- `.chq-content-files-header-actions`
- `.chq-content-status-band-actions`
- `.chq-content-summary-actions`
- `.chq-content-version-name`
- `.chq-content-worklist-col-actions`
- `.chq-pill`

## `app/src/pages/forms/forms.css` (Forms / CFP builder)

- `.chq-forms-back`
- `.chq-forms-field-actions`
- `.chq-forms-field-modal-actions-right`
- `.chq-forms-header-actions`
- `.chq-modal-actions`

## `app/src/pages/overview/overview.css` (Overview)

- `.chq-overview-link-btn`
- `.chq-overview-row-actions`
- `.chq-overview-row-actions-column`
- `.chq-overview-row-actions-inline`
- `.chq-overview-section-action`

## `app/src/pages/review/review.css` (Review)

- `.chq-pill`
- `.chq-review-add-link`
- `.chq-review-back`
- `.chq-review-criteria-empty-actions`
- `.chq-review-decision-actions`
- `.chq-review-editor-actions`
- `.chq-review-editor-back-link`
- `.chq-review-editor-title-actions`
- `.chq-review-plan-actions`
- `.chq-review-queue-title`
- `.chq-review-results-head-actions`
- `.chq-review-scope-confirm-actions`
- `.chq-review-section-head-actions`
- `.chq-review-title-actions`
- `.chq-reviewer-plan-row-action`

## `app/src/pages/review/scorecard.css` (Review)

- `.chq-review-editor-actions`

## `app/src/pages/settings/settings.css` (Settings)

- `.chq-pill`
- `.chq-settings-edit-row-actions`
- `.chq-settings-inline-action`
- `.chq-settings-people-actions`
- `.chq-settings-saved-embed-actions`
- `.chq-settings-tokens-col-actions`

## `app/src/pages/speakers/speakers.css` (Speakers)

- `.chq-pill`
- `.chq-speaker-detail-actions`
- `.chq-speaker-detail-back`
- `.chq-speaker-detail-logistics-actions`
- `.chq-speakers-file-link`
- `.chq-speakers-head-actions`
- `.chq-speakers-import-link`
- `.chq-speakers-name-link`
- `.chq-speakers-pager-actions`
- `.chq-speakers-task-title`
- `.chq-speakers-write-failure-actions`

## `app/src/pages/speakers/task-view.css` (Speakers)

- `.chq-taskview-actions`
- `.chq-taskview-back`
- `.chq-taskview-name`

## `app/src/styles.css` (Shell (shared app/src/styles.css))

- `.chq-bulkbar-actions`
- `.chq-contacts-col-actions`
- `.chq-contacts-drawer-actions`
- `.chq-embeds-output-actions`
- `.chq-empty-actions`
- `.chq-link-button`
- `.chq-modal-actions`
- `.chq-pill,`
- `.chq-row-title`
- `.chq-section-action`

