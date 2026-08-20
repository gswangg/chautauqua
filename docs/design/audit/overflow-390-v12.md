# Phone horizontal overflow at 390 (DEC-989, TIER 2 sweep, task w5-d; predicate-repaired wave 119, task w8-a)

Measured by `app/src/phone-horizontal-overflow.scan.test.ts`, which enumerates
every `app/src/**/*.css` and `src/**/*.css.ts` file (DEC-808, no hand-listed
manifest) and flags four declaration shapes inside any
`@media (max-width: <=700px)` block, and in any top-level rule that has no
phone override for the same selector on the SAME PROPERTY (cascade-aware
candidacy, DEC-989 wave-119 amendment -- see below):

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

## PREDICATE REPAIR (wave 119, task w8-a, DEC-989/DEC-991)

The candidacy test that produced every prior count in this document's history
(most recently 0, drained by task w6-h at wave 117) was BLIND, not clean: a
top-level rule was excluded from the population the instant ANY phone-scoped
rule in the same file named the same selector token, on ANY property --
whether or not that override ever touched the flagged declaration.
`app/src/pages/settings/settings.css:1142`'s `.chq-settings-row-hint {` rule
declares nowrap at `app/src/pages/settings/settings.css:1147`
(`white-space: nowrap;`) with no overflow escape in the same rule, yet was
never checked: a wholly unrelated terminal phone rule for the same selector
token, at `app/src/pages/settings/settings.css:1594`, declared only
`align-self: flex-end;`.

(Merge-train note: task w8-b landed in the same batch as this predicate
repair and gave that phone rule a real escape at
`app/src/pages/settings/settings.css:1598` -- `white-space: normal;` -- so
`.chq-settings-row-hint` is no longer among the offenders counted below. The
example stands as the demonstration of the defect this repair fixed, not as
a live row.)

The repair: every top-level rule is now ALWAYS a candidate, but is checked
against its EFFECTIVE declaration map -- its own declarations, overridden
property-by-property (last-wins, source order) by every phone-scoped rule in
the file whose comma-split selector tokens intersect its own -- rather than
its raw body. A phone override that genuinely clears the flagged property
still clears the rule; one that touches something else no longer hides it.

This also repairs a second, unrelated defect surfaced by the same audit:
`src/routes/public/css/agenda.css.ts`'s CSS-in-TS `.${ACCENT_BOUND_CLASSES[1]}`
selector-position interpolation was being stripped to a bare `.` by the
literal-extraction step, so the offender printed as a meaningless `.`
selector. The extraction now resolves a `.${NAME[N]}` interpolation against
its imported array constant (here, `./accent-classes`'s `ACCENT_BOUND_CLASSES`)
and reports the rule under its real class name, `.chq-pub-day-pill`. No
stylesheet was edited and no `overflow-exempt:` comment was authored to reach
this count (DEC-991) -- every row below is a real, previously-undercounted or
previously-mislabeled offender, not a new regression.

Total offenders recorded here: **31** (`OVERFLOW_OFFENDERS_CEILING`, measured
by running the scan against this branch's tree at authoring time -- see the
companion comment above that constant in
`app/src/phone-horizontal-overflow.scan.test.ts` for the full derivation).
Most are `white-space: nowrap` action links/labels/captions with no escape
declared — cheap for each owning cluster to close with an
`overflow: hidden; text-overflow: ellipsis;` pair, or a documented
`/* overflow-exempt: <reason> */` comment where truncation is wrong. A
smaller set are real fixed-width geometry (`grid-template-columns` tracks,
literal `width`/`min-width`) that need either a phone override or a
deliberate horizontal-scroll wrapper plus an exemption comment recording that
decision.

### comms (1)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/comms/comms.css` | `.chq-comms-templates-table .chq-comms-templates-col-last-used` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### contacts (2)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/contacts/contacts-panels.css` | `.chq-contacts-pipeline-columns` | min-width: 1000px exceeds budget 358px |
| `app/src/pages/contacts/contacts.css` | `.chq-contacts-delete-trigger` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### content (5)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/content/content.css` | `.chq-content-actions` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-version-newest` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-version-download` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-version-delete` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/content/content.css` | `.chq-content-phone-select-toggle, .chq-content-phone-selecting-meta` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### overview (2)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/overview/overview.css` | `.chq-overview-toolbar-btn` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/overview/overview.css` | `.chq-overview-link-btn` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### review (4)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/review/review.css` | `.chq-review-criteria-eyebrow` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-review-criterion-share` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/review/review.css` | `.chq-reviewer-plan-head-row` | grid-template-columns fixed tracks 520px + gaps 40px = 560px exceeds budget 358px |
| `app/src/pages/review/review.css` | `.chq-reviewer-plan-row-action` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### settings (5)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/settings/settings.css` | `.chq-settings-layout` | grid-template-columns fixed tracks 1016px + gaps 34px = 1050px exceeds budget 358px |
| `app/src/pages/settings/settings.css` | `.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-column` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-sample` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-sessionboard-mapping .chq-settings-sessionboard-mapping-col-arrow` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/settings/settings.css` | `.chq-settings-row-hint` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### submissions (4)

| File | Selector | Measured excess |
|---|---|---|
| `app/src/pages/submissions/detail.css` | `.chq-detail-position-prev, .chq-detail-position-next` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `app/src/pages/submissions/detail.css` | `.chq-detail-layout` | grid-template-columns fixed tracks 1020px + gaps 20px = 1040px exceeds budget 358px |
| `app/src/pages/submissions/detail.css` | `.chq-detail-page .chq-participants-table thead tr, .chq-detail-page .chq-participants-table tbody tr` | grid-template-columns fixed tracks 360px + gaps 18px = 378px exceeds budget 358px |
| `app/src/pages/submissions/detail.css` | `.chq-detail-delete-link` | white-space: nowrap with no overflow/text-overflow escape in the same rule |

### public (SSR) (8)

| File | Selector | Measured excess |
|---|---|---|
| `src/routes/public/css/agenda.css.ts` | `.chq-pub-day-pill` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/css/rail.css.ts` | `.chq-pub-save` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/css/rail.css.ts` | `.chq-pub-schedule-remove` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/css/rail.css.ts` | `.chq-pub-lastyear-link` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/home.css.ts` | `.chq-home-action-primary` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/home.css.ts` | `.chq-home-action-secondary` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/home.css.ts` | `.chq-home-action-quiet` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
| `src/routes/public/home.css.ts` | `.chq-home-action-tertiary` | white-space: nowrap with no overflow/text-overflow escape in the same rule |
