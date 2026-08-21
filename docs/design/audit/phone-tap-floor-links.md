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
forward). **46** as of DEC-930's wave-115 amendment:
`chq-speaker-detail-headshot-download` was DELETED from the tree — the bare
Download beside the speaker's avatar became a full Files row carrying
filename/uploader/timestamp — and a population row for a class no markup
uses is exactly the dead entry this inventory exists to prevent.

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
| `chq-btn-secondary` | ROOMY | app/src/styles.css | Satisfied | Always co-occurs with `chq-btn` (e.g. `app/src/pages/forms/FormsPage.tsx`, `chq-btn-secondary`). |
| `chq-btn-tertiary` | ROOMY | app/src/styles.css | Satisfied | Own phone rule (drift-proof citation, DEC-967 wave-115 shape -- the declaration has drifted from the line range originally cited here) at app/src/styles.css`.chq-btn-tertiary {` grouped with the shared `min-height: 44px;` centring block. |
| `chq-comms-history-export` | ROOMY | app/src/pages/comms/comms.css | Satisfied | Co-occurs `chq-btn chq-btn-secondary` (`app/src/pages/comms/HistoryTab.tsx`, `chq-btn chq-btn-secondary`). |
| `chq-comms-send-report-all-history` | ROOMY | app/src/pages/comms/comms.css | Satisfied | "All history ›" stands alone on its own line (`ComposeWizard.tsx:1573`); already floored (app/src/pages/comms/comms.css`chq-comms-send-report-all-history`). |
| `chq-contacts-merge-back` | ROOMY | app/src/pages/contacts/contacts-panels.css | Satisfied | Standalone back link "‹ Contacts · Duplicates" (`MergePage.tsx:212`) on its own line; floored (app/src/pages/contacts/contacts-panels.css`chq-contacts-merge-back`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-content-detail-action-link` | ROOMY | app/src/pages/content/content.css | Satisfied | Two right-flushed action links stacked against the title row, not sentence prose (`DeliverableDetail.tsx:371-375`); already floored (app/src/pages/content/content.css`chq-content-detail-action-link`). |
| `chq-content-detail-speaker-link` | INLINE | app/src/pages/content/content.css | n/a | Sits inside the subtitle sentence `{speaker name} +N · {trailer}` (`DeliverableDetail.tsx:352`); a 44px box would break the line box. |
| `chq-content-version-download` | ROOMY | app/src/pages/content/content.css | Satisfied | Standalone Download action beside Delete in the version row's action cluster (`VersionList.tsx:143`); already floored (app/src/pages/content/content.css`chq-content-version-download`). |
| `chq-content-version-name` | ROOMY | app/src/pages/content/content.css | Satisfied | Filename link is one of several independent targets in the version row (name / download / delete), not the row itself (`VersionList.tsx:123`); floored (app/src/pages/content/content.css`chq-content-version-name`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-detail-back` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Back link "‹ All submissions" on its own line; floored at app/src/pages/submissions/detail.css`display: flex;` (+ min-height:44px) with `padding: 0 4px` declared alongside it (wave-123 task w12-q changed the `inline-flex` keyword to `flex` -- byte-identical rendering for a flex child -- so the anchor-floor scan's literal predicate can see it). |
| `chq-detail-content-link` | ROOMY | app/src/pages/submissions/detail.css | **Fixed this wave** | Co-occurs `chq-btn chq-btn-tertiary` so already inherits the base floor, but its own page-local phone rule set only width/text-align/border-radius, no explicit floor of its own — given an explicit floor of its own this wave (app/src/pages/submissions/detail.css`chq-detail-content-link`) per the task brief. |
| `chq-detail-delete-link` | ROOMY | app/src/pages/submissions/detail.css | **Fixed this wave** | Standalone footer link "Delete this session" (app/src/pages/submissions/SubmissionDetailPage.tsx`chq-detail-delete-link`); composes with the shared `chq-link-button` base class, which carries no floor anywhere. No phone rule existed for this selector at all before this wave. |
| `chq-detail-position-next` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Floored at app/src/pages/submissions/detail.css`chq-detail-back` alongside it, horizontal padding now declared (`padding: 0 4px`). |
| `chq-detail-position-prev` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Same as `chq-detail-position-next`. |
| `chq-error-summary-link` | ROOMY | app/src/components/error-states.css | **Fixed this wave** | One link per `<li>` row inside the error summary list (`ErrorSummary.tsx:32`); the sheet declared no `@media` block at all before this wave. |
| `chq-forms-back` | ROOMY | app/src/pages/forms/forms.css | Satisfied | Back link "‹ Submissions" on its own line (`FormsPage.tsx:328`); floored (app/src/pages/forms/forms.css`chq-forms-back`) with min-height:44px, centred flex, and padding-right:12px. |
| `chq-link-button` | ROOMY | app/src/styles.css | **RESOLVED** | Was: shared base class with no phone floor of its own. Now floored directly (app/src/styles.css`.chq-link-button {`) with min-height:44px, centred flex, and padding, inside the `@media (max-width: 700px)` block. |
| `chq-overview-deadline-cell` | ROOMY | app/src/pages/overview/overview.css | Satisfied | The `<Link>` itself wraps the whole grid cell (label + value), own tappable unit (`Overview.tsx:281`); floored (app/src/pages/overview/overview.css`chq-overview-deadline-cell`). |
| `chq-overview-link-btn` | ROOMY (mixed) | app/src/pages/overview/overview.css | Satisfied — CLOSED | Split into `chq-overview-link-btn` (roomy, all remaining call sites) and `chq-overview-link-inline` (the public-URL call site, deliberately unfloored) — DEC-393 wave-106; full citations and receipts are given in the RESOLVED note at the foot of this document, not repeated here. |
| `chq-overview-section-action` | ROOMY | app/src/pages/overview/overview.css | Satisfied | "All N" section link stands alone at the right of the section header row (`app/src/pages/Overview.tsx`, two call sites); floored (app/src/pages/overview/overview.css`chq-overview-section-action`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-overview-toolbar-btn` | ROOMY | app/src/pages/overview/overview.css | Satisfied | Export / New-submission toolbar actions; floored (app/src/pages/overview/overview.css`chq-overview-toolbar-btn`). |
| `chq-overview-toolbar-btn-primary` | ROOMY | app/src/pages/overview/overview.css | Satisfied | Always co-occurs with `chq-overview-toolbar-btn` (`Overview.tsx:305`), same toolbar row. |
| `chq-pill` | ROOMY | app/src/styles.css | Satisfied | Phone floor (drift-proof citation, DEC-967 wave-115 shape -- the declaration has drifted from the line range originally cited here) at app/src/styles.css`.chq-pill,` shared with `chq-btn-tertiary`, `chq-rail-link`, `chq-checkbox-label`. |
| `chq-review-add-link` | ROOMY | app/src/pages/review/review.css | Satisfied | "+ Add option" / "+ Add criterion" stand alone (`app/src/pages/review/PlanEditor.tsx`, two call sites); floored at both call sites (app/src/pages/review/review.css`.chq-review-criterion-options-footer .chq-review-add-link` and `.chq-review-add-criteria .chq-review-add-link`) with `display: inline-flex; align-items: center; min-height: 44px;`. No explicit horizontal padding declared on the anchor itself. |
| `chq-review-back` | ROOMY | app/src/pages/review/review.css | Satisfied | Back link on its own line above the scorecard/results/queue heading (`Scorecard.tsx:473` and others); floored (app/src/pages/review/review.css`.chq-review-back,`) alongside `chq-review-editor-back-link`, with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-review-editor-back-link` | ROOMY | app/src/pages/review/review.css | Satisfied | Standalone back link out of `PlanEditor.tsx:1264`; floored (app/src/pages/review/review.css`.chq-review-editor-back-link {`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-review-queue-row-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Co-occurs `chq-btn` (`app/src/pages/review/ReviewerQueue.tsx`, two call sites); the recused-row span variant (`ReviewerQueue.tsx:379`) is inert text, not a tap target. |
| `chq-review-queue-score-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Same co-occurrence as `chq-review-queue-row-action`. |
| `chq-review-queue-title` | ROOMY | app/src/pages/review/review.css | **RESOLVED** | Was: submission title link is the only tap target in its part of the row, the row itself is not one target; review.css declared no floor for the selector. Now floored, element-qualified to the anchor only per its own comment (the span variant on recused rows stays inert) (app/src/pages/review/review.css`a.chq-review-queue-title {`) with min-height:44px, centred flex, and padding. |
| `chq-review-scoped-title-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Co-occurs `chq-btn chq-btn-primary` (`app/src/pages/review/ReviewerQueue.tsx`, `chq-review-scoped-title-action`). |
| `chq-reviewer-plan-row-action` | ROOMY | app/src/pages/review/review.css | Satisfied | Standalone action label at the foot of a plan progress row, moved out of PlanList.tsx to `ReviewerQueue.tsx:510`; floored (app/src/pages/review/review.css`.chq-reviewer-plan-row-action {`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-row-title` | ROOMY | app/src/styles.css | **RESOLVED** | Was: base class for table-cell title links, no phone rule in styles.css. Now floored directly (app/src/styles.css`.chq-row-title {`) with min-height:44px, centred flex, and cancelled padding, inside the `@media (max-width: 700px)` block. |
| `chq-section-action` | ROOMY | app/src/styles.css / review.css | **RESOLVED** | Was: section-header "All N ›" link pattern shared across pages, base rule had no phone floor. Now floored directly (app/src/styles.css`.chq-section-action {`) with min-height:44px, centred flex, and cancelled padding. |
| `chq-settings-inline-action` | INLINE | app/src/pages/settings/settings.css | n/a | Trails an inline `" · "` separator on the same text line as the resource name (`app/src/pages/settings/ResourcesPanel.tsx`: `{' · '}` immediately before `<a className="chq-settings-inline-action"`, repeated further down the same file). |
| `chq-speaker-detail-back` | ROOMY | app/src/pages/speakers/speakers.css | Satisfied | Back link "‹ Speakers" composed with `chq-link-button` (`SpeakerDetailPage.tsx:470`); floored (app/src/pages/speakers/speakers.css`.chq-speaker-detail-back,`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-speakers-file-link` | ROOMY | app/src/pages/speakers/speakers.css | Satisfied | Only interactive element in its own table cell (app/src/pages/speakers/SpeakerDetailPage.tsx`className="chq-speakers-file-link"` — drift-proof citation, DEC-967 wave-115; also `ResponseModal.tsx:60`); row has other non-link cells, is not itself the target; floored (app/src/pages/speakers/speakers.css`.chq-speakers-file-link,`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-speakers-import-link` | ROOMY | app/src/pages/speakers/speakers.css | Satisfied | Composes with `chq-link-button`, standalone import CTA (`RosterPanel.tsx:256`); floored (app/src/pages/speakers/speakers.css`.chq-speakers-import-link,`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-speakers-name-link` | ROOMY | app/src/pages/speakers/speakers.css | Satisfied | Name cell's Link is explicitly the row's only navigation target per the code's own DEC-930 comment (app/src/pages/speakers/OnboardingGrid.tsx`DEC-930: the grid's name cell is the link` — drift-proof citation, DEC-967 wave-115) — the `<tr>` itself is not clickable, so the link must carry its own floor; floored (app/src/pages/speakers/speakers.css`.chq-speakers-name-link,`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-speakers-task-title` | ROOMY | app/src/pages/speakers/speakers.css | Satisfied | Same shape as `chq-speakers-name-link`, task table (`OnboardingGrid.tsx:929`); floored (app/src/pages/speakers/speakers.css`.chq-speakers-task-title,`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-submissions-delete-back` | ROOMY | app/src/pages/submissions/submissions.css | Satisfied | Back link "‹ Submissions" on `DeleteSubmissionsPage.tsx:147`; floored (app/src/pages/submissions/submissions.css`.chq-submissions-delete-back {`) with min-height:44px, centred flex, and padding:0 4px. |
| `chq-submissions-table-title` | ROOMY | app/src/pages/submissions/submissions.css | Satisfied | Title cell's Link is the row's only navigation target, same shape as `chq-speakers-name-link` (`SubmissionsTable.tsx:489`); floored (app/src/pages/submissions/submissions.css`.chq-submissions-table-title {`) with min-height:44px, centred flex, and padding:0 4px. |
| `chq-taskview-back` | ROOMY | app/src/pages/speakers/task-view.css | Satisfied | Back link "‹ Speakers" composed with `chq-link-button` (`TaskView.tsx:361`); floored (app/src/pages/speakers/task-view.css`.chq-taskview-back,`) with min-height:44px, centred flex, and horizontal padding. |
| `chq-taskview-name` | ROOMY | app/src/pages/speakers/task-view.css | Satisfied | Speaker-name cell link, same row shape as `chq-speakers-name-link` (`TaskView.tsx:532`); floored (app/src/pages/speakers/task-view.css`.chq-taskview-name,`) with min-height:44px, centred flex, and horizontal padding. |
| `chq-toolbar-link` | ROOMY | app/src/pages/agenda/agenda.css | Satisfied | "Add a room or track" standalone CTA in the Agenda toolbar (`Agenda.tsx:450`); floored (app/src/pages/agenda/agenda.css`.chq-toolbar-link {`) with min-height:44px, centred flex, and padding-inline:10px. |

## Remaining unsatisfied residue (DEC-518 amendment, re-derived against the tree) — RESOLVED (DEC-976 amendment, wave w9-ke)

The four tokens named below (`chq-link-button`, `chq-row-title`,
`chq-section-action`, `chq-review-queue-title`) were re-derived against the
tree as of wave w9-ke and no longer reproduce; the table rows above now read
RESOLVED with drift-proof citations. This section is kept as the historical
record of the finding rather than deleted (DEC-069 wave-140: a row is
CLOSED, never deleted):

- `chq-link-button` / `chq-row-title` / `chq-section-action` were
  previously reasoned about as SHARED BASE CLASSES that were correct to
  leave bare, each concrete composed selector carrying its own floor
  instead. That reasoning has since been superseded: all three base
  classes now carry their own direct phone floor in
  `app/src/styles.css`'s `@media (max-width: 700px)` block, in addition to
  (not instead of) the composed selectors' own floors.
- `chq-review-queue-title` — previously ROW-IS-NOT-THE-TARGET with no
  floor of its own. `app/src/pages/review/review.css` now declares
  `a.chq-review-queue-title { display: flex; align-items: center;
  min-height: 44px; padding: 0 4px; }`, element-qualified to the anchor so
  the recused-row `<span>` variant stays untouched.

RESOLVED (DEC-393 wave-106, task w2-d): `chq-overview-link-btn` was split.
The four row-action call sites (`app/src/pages/Overview.tsx`, four call sites) keep
`chq-overview-link-btn`, floored to 44px/flex/centred/padded inside
overview.css's last `max-width: 700px` block. The fifth site
(`Overview.tsx:498`, the /e/{slug}-shaped public URL sitting inside
`.chq-overview-row-meta` running prose) now carries `chq-overview-link-inline`
instead, a top-level (no @media) rule with the same brand colour/weight/hover
treatment but deliberately no `min-height`, no `display: flex`, and no block
padding — per DESIGN-RULINGS.md:189, the floor governs controls, and flooring
a URL mid-sentence would break the line box. See
app/src/pages/overview/overview-link-register.test.ts.
