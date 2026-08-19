# Phone horizontal overflow at 390 (DEC-989, TIER 2 sweep, task w5-d)

Measured by `app/src/phone-horizontal-overflow.scan.test.ts`, which enumerates
every `app/src/**/*.css` and `src/**/*.css.ts` file (DEC-808, no hand-listed
manifest) and flags four declaration shapes inside any
`@media (max-width: <=700px)` block, and in any top-level rule with no phone
override for the same selector:

- a px `width` / `min-width` / `flex-basis` above the content budget
- `grid-template-columns` whose fixed px tracks, plus the gaps between them,
  exceed the budget on their own (fr/auto tracks are not counted — they
  yield, a fixed track cannot)
- `white-space: nowrap` with no `overflow`/`text-overflow` escape in the same
  rule
- `table-layout: fixed` on a selector with more than two declared columns
  and no phone reflow for the same base

**Budget**: derived from the shell's own phone gutter, not a hardcoded guess
— `.chq-main`'s `padding: 16px` inside `styles.css`'s
`@media (max-width: 700px)` block. `CONTENT_BUDGET_PX = 390 - 2*16 = 358`.

This document records every offender in a file this task (w5-d) does not
own the right to edit. The four offenders that landed inside
`app/src/pages/contacts/contacts-panels.css` (a file this task DOES own)
were fixed directly (added `overflow: hidden; text-overflow: ellipsis;`
alongside their existing `white-space: nowrap`) and do not appear below.

Total offenders recorded here: **65** (the scan's own
`OVERFLOW_OFFENDERS_CEILING`). Most are `white-space: nowrap` action
links/labels/captions with no escape declared — cheap for each owning
cluster to close with the same `overflow: hidden; text-overflow: ellipsis;`
pair used in this task's own fix, or an `/* overflow-exempt: <reason> */`
comment where truncation is wrong (e.g. a value that must stay exact). A
smaller set are real fixed-width geometry (`grid-template-columns` tracks,
literal `width`/`min-width`) that need either a phone override or a
deliberate horizontal-scroll wrapper (`overflow-x: auto`) plus an exemption
comment recording that decision.

### agenda (3)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/agenda/agenda.css` | `.chq-agenda-clash-note` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/agenda/agenda.css` | `.chq-agenda-summary` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/agenda/agenda.css` | `.chq-toolbar-link` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### comms (4)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/comms/comms.css` | `.chq-comms-compose-col-slot` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/comms/comms.css` | `.chq-comms-compose-table td:last-child` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/comms/comms.css` | `.chq-comms-send-report-skipped-retry` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/comms/comms.css` | `.chq-insert-field-menu-item-token` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### contacts (4)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-drawer-actions .chq-btn, .chq-contacts-drawer-actions .chq-btn-tertiary` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-filter-match-count` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-filter-rules-cap` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-filter-rules-caption` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### content (7)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/content/content.css` | `.chq-content-files-table .chq-content-files-col-actions` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-files-table .chq-content-files-col-version` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-phone-select-toggle` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-phone-selecting-all` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-table thead th` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-worklist-table .chq-content-worklist-col-actions` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-role-label` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### overview (2)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/overview/overview.css` | `.chq-overview-btn` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/overview/overview.css` | `.chq-overview-section-action` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### portal (SSR) (2)

| File | Selector | Measured excess |
|---|---|---|
| `src/routes/portal/portal.css.ts` | `.chq-field-counter` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/portal/portal.css.ts` | `.chq-portal-done-when` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### public (SSR) (5)

| File | Selector | Measured excess |
|---|---|---|
| `src/routes/public/cfp.css.ts` | `.chq-field-counter` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/css/cards.css.ts` | `.chq-pub-speaker-list-row` | grid-template-columns fixed tracks 356px + gaps 20px = 376px exceeds budget 358px |
| `src/routes/public/css/rail.css.ts` | `.chq-pub-schedule-browse-link` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/css/rail.css.ts` | `.chq-pub-schedule-remove` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/home.css.ts` | `.chq-home-footer-link` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### review (12)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/review/review.css` | `.chq-review-criteria-eyebrow` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-criterion-options-count` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-criterion-row.chq-review-criterion-row-readonly` | grid-template-columns fixed tracks 564px + gaps 0px = 564px exceeds budget 358px |
| `app/src/pages/review/review.css` | `.chq-review-criterion-share` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-plan-actions` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-plan-row` | grid-template-columns fixed tracks 550px + gaps 40px = 590px exceeds budget 358px |
| `app/src/pages/review/review.css` | `.chq-review-results-col-decision` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-reviews-toggle` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-scoped-progress-caption` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-reviewer-plan-head-row` | grid-template-columns fixed tracks 520px + gaps 40px = 560px exceeds budget 358px |
| `app/src/pages/review/scorecard.css` | `.chq-review-criterion-name-row .chq-review-criterion-weight-caption` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/scorecard.css` | `.chq-review-scorecard-grid` | grid-template-columns fixed tracks 1120px + gaps 60px = 1180px exceeds budget 358px |

### settings (10)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/settings/settings.css` | `.chq-settings-edit-row-meta` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-edit-row-seats` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-exports-table .chq-settings-exports-col-csv` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-exports-table .chq-settings-exports-col-json` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-room-edit-row` | grid-template-columns fixed tracks 460px + gaps 0px = 460px exceeds budget 358px |
| `app/src/pages/settings/settings.css` | `.chq-settings-saved-embed-caption` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-arrow` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-column` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-sample` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-tokens-table .chq-settings-tokens-col-actions` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### shell (3)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/styles.css` | `.chq-contacts-table .chq-contacts-col-actions` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/styles.css` | `.chq-section-action` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/styles.css` | `.chq-user-identity` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### speakers (6)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/speakers/speakers.css` | `.chq-participation-menu-panel` | width: 420px exceeds budget 358px |
| `app/src/pages/speakers/speakers.css` | `.chq-speaker-detail-task-remind` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/speakers/speakers.css` | `.chq-speaker-detail-tasks-row > :nth-child(2)` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-grid` | min-width: 1060px exceeds budget 358px |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-task-edit` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/speakers/speakers.css` | `.chq-speakers-task-remove` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### submissions (7)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/submissions/detail.css` | `.chq-answer-file-size` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/detail.css` | `.chq-detail-section-action` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/detail.css` | `.chq-detail-session-details-caption` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/detail.css` | `.chq-submission-history-current` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-save-view-modal` | width: 440px exceeds budget 358px |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-table .chq-flag` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-table thead th` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

