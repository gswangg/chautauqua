# Cancelled padding: the painted-face lens (DEC-937 wave-121 amendment, task w10-k)

Measured by `app/src/cancelled-padding-face.scan.test.ts`, which enumerates
every `app/src/**/*.css` and `src/**/*.css.ts` file (DEC-808, no hand-listed
manifest) and finds every rule declaring `padding-inline: Npx` together with
`margin-inline: -Npx` for the same `N > 0` — the cancelled-padding idiom.
Comments are stripped before any parsing (the bug v12m-w9-k repaired for
`rowActionContainerTokens`, applied here from the start).

**24 rules** matched this pattern on this branch (population re-measured, not
copied from a prior wave's count — the number the field guide recorded for
`17deea82` also held here). Each rule's selector list is split on commas;
each resulting selector's KEY COMPOUND (its last space/`>`-separated part)
is resolved to a FACE — PAINTED if any top-level rule for the compound's
class token(s), read first in the rule's own sheet and then in
`app/src/styles.css`, declares a border or background other than the
unpainted vocabulary (`none`/`0` for border-ish properties, `none`/
`transparent` for background-ish ones).

Two hand-curated, scan-checked maps resolve the five members whose key
compound is a bare `a` element (no class of its own): `ELEMENT_KEY_FACE` for
the four that reach a real, classed `<a>`/`<Link>`; `DEAD_ELEMENT_SELECTORS`
for the one whose container renders no anchor at all. Every entry's receipt
(a `classNameLiteral`/`containerClassLiteral` appearing verbatim in its
`componentPath`, or — for the dead entries — no `<a`/`<Link>` found in the
container's own JSX block) is independently re-checked by a companion test
in the scan file, never taken on faith.

## PAINTED offenders (8) — the idiom is illegal here as authored

| File | Selector | N | Painted because |
|---|---|---|---|
| `agenda.css` | `.chq-agenda-head-actions .chq-btn` | 10 | key compound `.chq-btn` resolves through `.chq-btn-primary`/`.chq-btn-secondary` in `agenda.css`'s own sheet — `.chq-btn-secondary` declares `background: var(--chq-surface-sunk); border: 1px solid var(--chq-border-strong)` |
| `agenda.css` | `.chq-breaks-add-actions .chq-btn` | 10 | same key compound `.chq-btn`, same resolution |
| `agenda.css` | `.chq-breaks-row-actions .chq-btn` | 10 | same key compound `.chq-btn`, same resolution |
| `overview.css` | `.chq-overview-row-actions .chq-overview-btn` | 10 | key compound `.chq-overview-btn` declares its own top-level `border: 1px solid var(--chq-border-strong); background: var(--chq-surface-sunk)` (`overview.css`, `.chq-overview-btn`, 358) |
| `overview.css` | `.chq-overview-row-actions-inline .chq-overview-btn` | 10 | same key compound, same resolution |
| `overview.css` | `.chq-overview-row-actions-column .chq-overview-btn` | 10 | same key compound, same resolution |
| `contacts.css` | `.chq-contacts-title-actions a` | 10 | bare-element key compound, `ELEMENT_KEY_FACE`: `ContactsApp.tsx` renders `<a className="chq-btn chq-btn-secondary">` for Export CSV — PAINTED |
| `speakers.css` | `.chq-speaker-detail-actions a` | 10 | bare-element key compound, `ELEMENT_KEY_FACE`: `SpeakerDetailPage.tsx` renders `<a className="chq-btn chq-btn-secondary" href={` `mailto:...` `}>` for Email — PAINTED |

Four sheets carry an offender, matching the field guide's wave-121 finding
(agenda, overview, speakers, contacts). `.chq-btn` and `.chq-overview-btn`
each recur across three sibling container selectors inside the SAME rule,
which is why 24 members produce only 4 distinct owning sheets but 8
distinct offender ROWS.

## UNPAINTED members (11) — the idiom is legal as authored

| File | Selector(s) | N | Resolution |
|---|---|---|---|
| `agenda.css` | `.chq-phone-footer-actions .chq-phone-footer-btn` | 10 | `.chq-phone-footer-btn` — no painted rule found in `agenda.css` or `styles.css` |
| `agenda.css` | `.chq-toolbar-link` | 10 | own key compound, no painted rule found |
| `agenda.css` | `.chq-agenda-head-actions .chq-link-button` | 10 | `.chq-link-button` — the quiet-action family, unpainted everywhere it's declared |
| `comms.css` | `.chq-comms-editor-actions > .chq-link-button` | 10 | same family |
| `comms.css` | `.chq-comms-send-report-all-history` | 10 | own key compound, unpainted |
| `comms.css` | `.chq-comms-send-detail > .chq-link-button` | 10 | quiet-action family |
| `comms.css` | `.chq-comms-recent-sends .chq-section-head .chq-link-button`, `.chq-comms-blocked-list li .chq-link-button` | 10 | quiet-action family (both selectors) |
| `comms.css` | `.chq-comms-phone-recent-head-link` | 10 | own key compound, unpainted |
| `contacts-panels.css` | `.chq-contacts-merge-back` | 10 | own key compound, unpainted |
| `contacts.css` | `.chq-contacts-rail-duplicate-actions a` | 10 | bare-element key compound, `ELEMENT_KEY_FACE`: `DuplicateRow.tsx` renders `<Link className="chq-link-button">` for Merge — unpainted |
| `content.css` | `.chq-content-detail-action-link` | 10 | own key compound, unpainted |
| `content.css` | `.chq-content-detail-speaker-link` | 10 | own key compound, unpainted |
| `content.css` | `.chq-content-version-name` | 10 | own key compound, unpainted |
| `content.css` | `.chq-content-worklist-col-actions` | 10 | own key compound (an empty `<th>`), unpainted |
| `overview.css` | `.chq-overview-link-btn` | 10 | own key compound, unpainted |
| `overview.css` | `.chq-overview-section-action` | 10 | own key compound, unpainted |
| `review.css` | `.chq-review-plan-actions > a` | 10 | bare-element key compound, `ELEMENT_KEY_FACE`: `PlanList.tsx` renders `<Link className="chq-review-plan-action-link">` — no border/background declared anywhere for that class, unpainted |
| `review.css` | `.chq-review-plan-actions > .chq-link-button` | 10 | quiet-action family |
| `review.css` | `.chq-reviewer-plan-row-action` | 10 | own key compound, unpainted |
| `review.css` | `.chq-review-back`, `.chq-review-editor-back-link` | 10 | both own key compounds, unpainted |
| `settings.css` | `.chq-settings-inline-action` | 10 | own key compound, unpainted |
| `settings.css` | `.chq-settings-edit-row-actions .chq-link-button` | 10 | quiet-action family |
| `settings.css` | `.chq-settings-people-actions .chq-link-button` | 10 | quiet-action family |
| `settings.css` | `.chq-settings-tokens-table tbody td:last-child .chq-link-button` | 10 | quiet-action family |
| `settings.css` | `.chq-settings-section-action` | 10 | own key compound, unpainted |
| `speakers.css` | `.chq-speakers-name-link`, `.chq-speaker-detail-back`, `.chq-speakers-file-link`, `.chq-speakers-task-title`, `.chq-speakers-import-link` | 10 | all own key compounds, unpainted |
| `task-view.css` | `.chq-taskview-back`, `.chq-taskview-name` | 10 | both own key compounds, unpainted |

(Table rows above are the rule's declared selector list — a rule with
several comma-separated selectors sharing one `padding-inline`/
`margin-inline` declaration is one MEMBER but contributes one row per
selector to the face walk; several rows here share a single source line.)

## DEAD SELECTOR rows (5) — the selector matches nothing live

These five members' key compound is a bare `a`, but the container class they
qualify renders ONLY `<button>` elements — verified by reading each
component and, in the scan's own companion test, by walking the JSX block
bounded by the container `<div>`'s own tag nesting and confirming no
`<a`/`<Link>` appears inside it.

| File | Selector | Container | Component | Why dead |
|---|---|---|---|---|
| `speakers.css` | `.chq-speakers-head-actions a` | `chq-speakers-head-actions` | `OnboardingGrid.tsx` | Add speaker / New task / Remind all outstanding are all `<button>` |
| `speakers.css` | `.chq-speakers-pager-actions a` | `chq-speakers-pager-actions` | `OnboardingGrid.tsx` | Previous / Next are `<button>` |
| `speakers.css` | `.chq-speakers-write-failure-actions a` | `chq-speakers-write-failure-actions` | `OnboardingGrid.tsx` | Reload the grid / Try again are `<button>` |
| `speakers.css` | `.chq-speaker-detail-logistics-actions a` | `chq-speaker-detail-logistics-actions` | `SpeakerDetailPage.tsx` | Save / Cancel are `<button>` |
| `task-view.css` | `.chq-taskview-actions a` | `chq-taskview-actions` | `TaskView.tsx` | every action (Export answers, Move the due date, …) is a `<button>` — this is the exact dead selector this task's own brief named as ground truth |

## Instrument, not repair

This task built the measurement only (`PAINTED_CANCELLED_PADDING_CEILING`,
seeded at 8, registered in `scripts/exit-predicate.ts`'s
`CAMPAIGN_CONSTANT_NAMES` and `TIER2_CEILING_NAMES`). No stylesheet was
edited to reach this number. The drain lanes running in parallel this wave
fix the 8 offenders above (the merge train reconciles this ceiling once
their fixes land, per the house ratchet convention: "never below the
ceiling without lowering it").
