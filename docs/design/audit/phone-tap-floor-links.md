# Phone tap-target floor: the link population (v12m-w6-h)

`phone-tap-target.scan.test.ts` only counts a `<(input|select|button|a)>` tag,
and an `<a>` only when its class list carries `chq-btn`. This codebase
navigates with React Router `<Link>`/`<NavLink>`, which that regex never
matches, so no link-rendered control in `app/src` is in the scan's
population at all.

Population re-derived by hand for this wave (not copied from the task
brief): walked `app/src/**/*.tsx` excluding `*.test.tsx`, collected every
`chq-*` token appearing in a `className` on `<Link>`, `<NavLink>` or `<a>`,
then resolved each token against every `app/src/**/*.css` `max-width` block.
That walk found **47** distinct tokens (the brief's own measurement said 31;
re-derive per DEC-808/DEC-393 rather than trust either number going
forward).

Verdicts:

- **ROOMY** — the only interactive element on its own line/cell (rail link,
  row action, back link, section action, table-cell title link where the
  row itself is not a single tap target). Must carry `min-height:44px` PLUS
  centred flex PLUS horizontal padding, per DESIGN-RULINGS.md:189.
- **ROW-IS-THE-TARGET** — the containing row already reaches 44px and is
  itself the tappable unit.
- **INLINE** — sits inside a sentence, where a 44px box would break the
  line box.

"Satisfied" means a `max-width` block already declares `min-height:44px`
(or better) for that exact selector, or the token always co-occurs with
`.chq-btn`/`.chq-btn-tertiary`/`.chq-pill`, which already carry the floor at
`app/src/styles.css:1104-1116`. "Fixed this wave" means the two deliverable-2
sheets below. Everything else is unsatisfied residue for wave 7 to schedule.

| Token | Verdict | Owning file | Status | Reason |
|---|---|---|---|---|
| `chq-btn` | ROOMY | app/src/styles.css | Satisfied | Base button class; phone `min-height:44px` at styles.css:1104 (styles.css is v12m-w6-a's file, not touched here). |
| `chq-btn-primary` | ROOMY | app/src/styles.css | Satisfied | Always co-occurs with `chq-btn` (e.g. `PlanList.tsx:218`), inherits its floor. |
| `chq-btn-secondary` | ROOMY | app/src/styles.css | Satisfied | Always co-occurs with `chq-btn` (e.g. `FormsPage.tsx:314`). |
| `chq-btn-tertiary` | ROOMY | app/src/styles.css | Satisfied | Own phone rule at styles.css:1109-1116 (`display:inline-flex; align-items/justify-content:center; min-height:44px`). |
| `chq-comms-history-export` | ROOMY | app/src/pages/comms/comms.css | Satisfied | Co-occurs `chq-btn chq-btn-secondary` (`HistoryTab.tsx:150`). |
| `chq-comms-send-report-all-history` | ROOMY | app/src/pages/comms/comms.css | Satisfied | "All history ›" stands alone on its own line; already floored at comms.css:1622. |
| `chq-contacts-merge-back` | ROOMY | app/src/pages/contacts/contacts-panels.css | **Unsatisfied** | Standalone back link "‹ Contacts · Duplicates" (`MergePage.tsx:212`) on its own line; no phone `min-height` rule found for this selector. |
| `chq-content-detail-action-link` | ROOMY | app/src/pages/content/content.css | Satisfied | Two right-flushed action links stacked against the title row, not sentence prose (`DeliverableDetail.tsx:371-375`); already floored at content.css:1245. |
| `chq-content-detail-speaker-link` | INLINE | app/src/pages/content/content.css | n/a | Sits inside the subtitle sentence `{speaker name} +N · {trailer}` (`DeliverableDetail.tsx:352`); a 44px box would break the line box. |
| `chq-content-version-download` | ROOMY | app/src/pages/content/content.css | Satisfied | Standalone Download action beside Delete in the version row's action cluster (`VersionList.tsx:143`); already floored at content.css:1304. |
| `chq-content-version-name` | ROOMY | app/src/pages/content/content.css | **Unsatisfied** | Filename link is one of several independent targets in the version row (name / download / delete), not the row itself (`VersionList.tsx:123`); no phone `min-height` rule found. |
| `chq-detail-back` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Back link "‹ All submissions" on its own line; floored at detail.css:842-846 (`min-height:44px` + `inline-flex`). No explicit horizontal padding declared — flag for wave 7. |
| `chq-detail-content-link` | ROOMY | app/src/pages/submissions/detail.css | **Fixed this wave** | Co-occurs `chq-btn chq-btn-tertiary` so already inherits the base floor, but its own page-local phone rule (detail.css:1049) set only `width`/`text-align`/`border-radius`, no explicit floor of its own — given an explicit `min-height:44px` treatment per the task brief. |
| `chq-detail-delete-link` | ROOMY | app/src/pages/submissions/detail.css | **Fixed this wave** | Standalone footer link "Delete this session" (`SubmissionDetailPage.tsx:1860`); composes with `chq-link-button`, which carries no floor anywhere. No phone rule existed for this selector at all before this wave. |
| `chq-detail-position-next` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Floored at detail.css:843-846 alongside `chq-detail-back`. No explicit horizontal padding — flag for wave 7. |
| `chq-detail-position-prev` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Same as `chq-detail-position-next`. |
| `chq-error-summary-link` | ROOMY | app/src/components/error-states.css | **Fixed this wave** | One link per `<li>` row inside the error summary list (`ErrorSummary.tsx:32`); the sheet declared no `@media` block at all before this wave. |
| `chq-forms-back` | ROOMY | app/src/pages/forms/forms.css | **Unsatisfied** | Back link "‹ Submissions" on its own line (`FormsPage.tsx:308`); no phone `min-height` rule found. |
| `chq-link-button` | ROOMY | app/src/styles.css | **Unsatisfied** | Shared base class; every use composes it with a page-local class that is itself its own line/target (back links, footer links, row titles). Base rule (styles.css:783) has no phone floor and styles.css is v12m-w6-a's file — flag for wave 7 to floor the base rule once, rather than every composed selector individually. |
| `chq-overview-deadline-cell` | ROOMY | app/src/pages/overview/overview.css | Satisfied | The `<Link>` itself wraps the whole grid cell (label + value), own tappable unit (`Overview.tsx:281`); floored at overview.css:458. |
| `chq-overview-link-btn` | ROOMY (mixed) | app/src/pages/overview/overview.css | Satisfied for 3 of 4 sites | 3 sites are row-action chips beside a real `chq-overview-btn` (`Overview.tsx:341,401,440`), floored at overview.css:513. The 4th site (`Overview.tsx:474`, the public `/e/{slug}` URL) sits INLINE inside a sentence — same token, opposite context; flag for wave 7 to split into two classes rather than one selector serving both shapes. |
| `chq-overview-section-action` | ROOMY | app/src/pages/overview/overview.css | **Unsatisfied** | "All N" section link stands alone at the right of the section header row (`Overview.tsx:367,414`); no phone `min-height` rule found. |
| `chq-overview-toolbar-btn` | ROOMY | app/src/pages/overview/overview.css | Satisfied | Export / New-submission toolbar actions; floored at overview.css:488. |
| `chq-overview-toolbar-btn-primary` | ROOMY | app/src/pages/overview/overview.css | Satisfied | Always co-occurs with `chq-overview-toolbar-btn` (`Overview.tsx:305`), same toolbar row. |
| `chq-pill` | ROOMY | app/src/styles.css | Satisfied | Phone floor at styles.css:1109-1114 (shared with `chq-btn-tertiary`, `chq-rail-link`, `chq-checkbox-label`). |
| `chq-review-add-link` | ROOMY | app/src/pages/review/review.css | **Unsatisfied** (off-limits, v12m-w5-b/w2-j/w4-g/w4-h own this file) | "+ Add option" / "+ Add criterion" stand alone (`PlanEditor.tsx:1922,1982`); no phone `min-height` rule found. |
| `chq-review-back` | ROOMY | app/src/pages/review/review.css | **Unsatisfied** (off-limits) | Back link on its own line above the scorecard/results/queue heading (`Scorecard.tsx:473` and others); no phone rule found. |
| `chq-review-editor-back-link` | ROOMY | app/src/pages/review/review.css | **Unsatisfied** (off-limits) | Standalone back link out of `PlanEditor.tsx:1264`; no phone rule found. |
| `chq-review-queue-row-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Co-occurs `chq-btn` (`ReviewerQueue.tsx:299,306`); the recused-row `<span>` variant is inert text, not a tap target. |
| `chq-review-queue-score-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Same co-occurrence as `chq-review-queue-row-action`. |
| `chq-review-queue-title` | ROOMY | app/src/pages/review/review.css | **Unsatisfied** (off-limits) | Submission title link is the only tap target in its part of the row, the row itself is not one target (`ReviewerQueue.tsx:266`); no phone rule found. |
| `chq-review-scoped-title-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Co-occurs `chq-btn chq-btn-primary` (`ReviewerQueue.tsx:620`). |
| `chq-reviewer-plan-row-action` | ROOMY | app/src/pages/review/review.css | **Unsatisfied** (off-limits) | Standalone action label at the foot of a plan progress row (`PlanList.tsx:478`); no phone rule found. |
| `chq-row-title` | ROOMY | app/src/styles.css | **Unsatisfied** | Base class for table-cell title links (composed with page-local `-name-link`/`-task-title` classes below); no phone rule in styles.css (v12m-w6-a's file). |
| `chq-section-action` | ROOMY | app/src/styles.css / review.css | **Unsatisfied** | Section-header "All N ›" link pattern shared across pages; base rule (styles.css:560) has no phone floor. |
| `chq-settings-inline-action` | INLINE | app/src/pages/settings/settings.css | n/a | Trails an inline `" · "` separator on the same text line as the resource name (`ResourcesPanel.tsx:229,292`: `{' · '}<a className="chq-settings-inline-action">Download</a>`). |
| `chq-speaker-detail-back` | ROOMY | app/src/pages/speakers/speakers.css | **Unsatisfied** (off-limits, v12m-w2-c/w5-h own this file) | Back link "‹ Speakers" composed with `chq-link-button` (`SpeakerDetailPage.tsx:438`); no phone rule found. |
| `chq-speaker-detail-headshot-download` | ROOMY | app/src/pages/speakers/speakers.css | Satisfied (off-limits) | Co-occurs `chq-btn chq-btn-tertiary` (`SpeakerDetailPage.tsx:427`). |
| `chq-speakers-file-link` | ROOMY | app/src/pages/speakers/speakers.css | **Unsatisfied** (off-limits) | Only interactive element in its own table cell (`SpeakerDetailPage.tsx:650`, `ResponseModal.tsx`); row has other non-link cells, is not itself the target; no phone rule found. |
| `chq-speakers-import-link` | ROOMY | app/src/pages/speakers/speakers.css | **Unsatisfied** (off-limits) | Composes with `chq-link-button`, standalone import CTA (`RosterPanel.tsx:256`); no phone rule found. |
| `chq-speakers-name-link` | ROOMY | app/src/pages/speakers/speakers.css | **Unsatisfied** (off-limits) | Name cell's Link is explicitly the row's only navigation target per the code's own DEC-930 comment (`OnboardingGrid.tsx:960`) — the `<tr>` itself is not clickable, so the link must carry its own floor; no phone rule found. |
| `chq-speakers-task-title` | ROOMY | app/src/pages/speakers/speakers.css | **Unsatisfied** (off-limits) | Same shape as `chq-speakers-name-link`, task table (`OnboardingGrid.tsx:929`); no phone rule found. |
| `chq-submissions-delete-back` | ROOMY | app/src/pages/submissions/submissions.css | **Unsatisfied** (off-limits, v12m-w6-f owns this file) | Back link "‹ Submissions" on `DeleteSubmissionsPage.tsx:147`; no phone rule found. |
| `chq-submissions-table-title` | ROOMY | app/src/pages/submissions/submissions.css | **Unsatisfied** (off-limits) | Title cell's Link is the row's only navigation target, same shape as `chq-speakers-name-link` (`SubmissionsTable.tsx:489`); no phone rule found. |
| `chq-taskview-back` | ROOMY | app/src/pages/speakers/task-view.css | **Unsatisfied** (off-limits) | Back link "‹ Speakers" composed with `chq-link-button` (`TaskView.tsx:361`); no phone rule found. |
| `chq-taskview-name` | ROOMY | app/src/pages/speakers/task-view.css | **Unsatisfied** (off-limits) | Speaker-name cell link, same row shape as `chq-speakers-name-link` (`TaskView.tsx:532`); no phone rule found. |
| `chq-toolbar-link` | ROOMY | app/src/pages/agenda/agenda.css | **Unsatisfied** | "Add a room or track" standalone CTA in the Agenda toolbar (`Agenda.tsx:450`); no phone rule found. |

## Wave 7 scheduling summary

Unsatisfied and in-scope for a future wave (files not currently owned by a
live worktree, per this wave's forbidden list): `chq-contacts-merge-back`,
`chq-content-version-name`, `chq-forms-back`, `chq-link-button` (base rule),
`chq-overview-section-action`, `chq-row-title` / `chq-section-action` (base
rules), `chq-toolbar-link`, and the padding gap on `chq-detail-back` /
`chq-detail-position-prev` / `chq-detail-position-next` (floored on
`min-height` but never given the horizontal padding DESIGN-RULINGS.md:189
also asks for).

Unsatisfied but sitting in files this wave's brief marks off-limits (owned
by other v12 mobile-campaign branches — re-check ownership before spending a
lane, per the field guide's "OFF-LIMITS by branch" convention): the
`chq-review-*` set (review.css), the `chq-speaker*`/`chq-taskview-*` set
(speakers.css, task-view.css), and `chq-submissions-delete-back` /
`chq-submissions-table-title` (submissions.css).

`chq-overview-link-btn` needs a design decision, not just a CSS fix: one
class currently serves both a row-action chip (ROOMY) and prose linking to a
public URL (INLINE) — splitting it into two classes would let each carry
the right treatment.
