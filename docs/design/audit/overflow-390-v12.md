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

**Refreshed wave 108 (v12m-w4-o, DEC-808 amendment).** Measurement method:
copy `app/src/phone-horizontal-overflow.scan.test.ts`, force
`OVERFLOW_OFFENDERS_CEILING` to `-1` so the ceiling `it()` fails
unconditionally, run `npx vitest run
app/src/phone-horizontal-overflow.scan.test.ts`, and read the offender list
the failure message prints — never trust a previously recorded number or an
audit doc's own count. Do this in a throwaway copy of the test file (or
revert the edit after reading the output); do not commit the forced `-1`.

Total offenders recorded here: **24** (the scan's own
`OVERFLOW_OFFENDERS_CEILING`, re-measured this wave — down from the
previously recorded 65, which had gone stale as other lanes fixed offenders
without lowering the ratchet). Most are `white-space: nowrap` action
links/labels/captions with no escape declared — cheap for each owning
cluster to close with the same `overflow: hidden; text-overflow: ellipsis;`
pair used in this task's own fix, or an `/* overflow-exempt: <reason> */`
comment where truncation is wrong (e.g. a value that must stay exact). A
smaller set are real fixed-width geometry (`grid-template-columns` tracks,
literal `width`/`min-width`) that need either a phone override or a
deliberate horizontal-scroll wrapper (`overflow-x: auto`) plus an exemption
comment recording that decision.

### content (2)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/content/content.css` | `.chq-content-phone-select-toggle` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-phone-selecting-all` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### review (9)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/review/review.css` | `.chq-review-plan-row` | grid-template-columns fixed tracks 550px + gaps 40px = 590px exceeds budget 358px |
| `app/src/pages/review/review.css` | `.chq-review-plan-actions` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-results-col-decision` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-reviews-toggle` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-scoped-progress-caption` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-criterion-row.chq-review-criterion-row-readonly` | grid-template-columns fixed tracks 564px + gaps 0px = 564px exceeds budget 358px |
| `app/src/pages/review/review.css` | `.chq-review-criterion-options-count` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/scorecard.css` | `.chq-review-scorecard-grid` | grid-template-columns fixed tracks 1120px + gaps 60px = 1180px exceeds budget 358px |
| `app/src/pages/review/scorecard.css` | `.chq-review-criterion-name-row .chq-review-criterion-weight-caption` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### submissions (7)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/submissions/detail.css` | `.chq-detail-section-action` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/detail.css` | `.chq-detail-session-details-caption` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/detail.css` | `.chq-submission-history-current` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/detail.css` | `.chq-answer-file-size` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-table thead th` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-table .chq-flag` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/submissions.css` | `.chq-submissions-save-view-modal` | width: 440px exceeds budget 358px |

### shell (3)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/styles.css` | `.chq-user-identity` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/styles.css` | `.chq-section-action` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/styles.css` | `.chq-contacts-table .chq-contacts-col-actions` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### portal (SSR) (1)

| File | Selector | Measured excess |
|---|---|---|
| `src/routes/portal/portal.css.ts` | `.chq-field-counter` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### public (SSR) (2)

| File | Selector | Measured excess |
|---|---|---|
| `src/routes/public/cfp.css.ts` | `.chq-field-counter` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/css/rail.css.ts` | `.chq-pub-schedule-browse-link` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
