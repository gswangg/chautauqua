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
| `chq-btn-secondary` | ROOMY | app/src/styles.css | Satisfied | Always co-occurs with `chq-btn` (e.g. `FormsPage.tsx:335`, `chq-btn-secondary`). |
| `chq-btn-tertiary` | ROOMY | app/src/styles.css | Satisfied | Own phone rule at `styles.css:2414-2419` (`chq-btn-tertiary`). |
| `chq-comms-history-export` | ROOMY | app/src/pages/comms/comms.css | Satisfied | Co-occurs `chq-btn chq-btn-secondary` (`HistoryTab.tsx:184`, `chq-btn chq-btn-secondary`). |
| `chq-comms-send-report-all-history` | ROOMY | app/src/pages/comms/comms.css | Satisfied | "All history ›" stands alone on its own line (`ComposeWizard.tsx:1573`); already floored (app/src/pages/comms/comms.css`chq-comms-send-report-all-history`). |
| `chq-contacts-merge-back` | ROOMY | app/src/pages/contacts/contacts-panels.css | Satisfied | Standalone back link "‹ Contacts · Duplicates" (`MergePage.tsx:212`) on its own line; floored (app/src/pages/contacts/contacts-panels.css`chq-contacts-merge-back`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-content-detail-action-link` | ROOMY | app/src/pages/content/content.css | Satisfied | Two right-flushed action links stacked against the title row, not sentence prose (`DeliverableDetail.tsx:371-375`); already floored (app/src/pages/content/content.css`chq-content-detail-action-link`). |
| `chq-content-detail-speaker-link` | INLINE | app/src/pages/content/content.css | n/a | Sits inside the subtitle sentence `{speaker name} +N · {trailer}` (`DeliverableDetail.tsx:352`); a 44px box would break the line box. |
| `chq-content-version-download` | ROOMY | app/src/pages/content/content.css | Satisfied | Standalone Download action beside Delete in the version row's action cluster (`VersionList.tsx:143`); already floored (app/src/pages/content/content.css`chq-content-version-download`). |
| `chq-content-version-name` | ROOMY | app/src/pages/content/content.css | Satisfied | Filename link is one of several independent targets in the version row (name / download / delete), not the row itself (`VersionList.tsx:123`); floored (app/src/pages/content/content.css`chq-content-version-name`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-detail-back` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Back link "‹ All submissions" on its own line; floored at detail.css:885-889 (`display: inline-flex;` + min-height:44px). No explicit horizontal padding declared — flag for wave 7. |
| `chq-detail-content-link` | ROOMY | app/src/pages/submissions/detail.css | **Fixed this wave** | Co-occurs `chq-btn chq-btn-tertiary` so already inherits the base floor, but its own page-local phone rule set only width/text-align/border-radius, no explicit floor of its own — given an explicit floor of its own this wave (app/src/pages/submissions/detail.css`chq-detail-content-link`) per the task brief. |
| `chq-detail-delete-link` | ROOMY | app/src/pages/submissions/detail.css | **Fixed this wave** | Standalone footer link "Delete this session" (app/src/pages/submissions/SubmissionDetailPage.tsx`chq-detail-delete-link`); composes with the shared `chq-link-button` base class, which carries no floor anywhere. No phone rule existed for this selector at all before this wave. |
| `chq-detail-position-next` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Floored at `detail.css:882-889` alongside `chq-detail-back`. No explicit horizontal padding — flag for wave 7. |
| `chq-detail-position-prev` | ROOMY | app/src/pages/submissions/detail.css | Satisfied | Same as `chq-detail-position-next`. |
| `chq-error-summary-link` | ROOMY | app/src/components/error-states.css | **Fixed this wave** | One link per `<li>` row inside the error summary list (`ErrorSummary.tsx:32`); the sheet declared no `@media` block at all before this wave. |
| `chq-forms-back` | ROOMY | app/src/pages/forms/forms.css | Satisfied | Back link "‹ Submissions" on its own line (`FormsPage.tsx:328`); floored (app/src/pages/forms/forms.css`chq-forms-back`) with min-height:44px, centred flex, and padding-right:12px. |
| `chq-link-button` | ROOMY | app/src/styles.css | **Unsatisfied** | Shared base class; every use composes it with a page-local class that is itself its own line/target (back links, footer links, row titles). Base rule (styles.css:783) has no phone floor; each composed selector currently carries (or lacks) its own floor individually rather than inheriting one from the shared base. |
| `chq-overview-deadline-cell` | ROOMY | app/src/pages/overview/overview.css | Satisfied | The `<Link>` itself wraps the whole grid cell (label + value), own tappable unit (`Overview.tsx:281`); floored (app/src/pages/overview/overview.css`chq-overview-deadline-cell`). |
| `chq-overview-link-btn` | ROOMY (mixed) | app/src/pages/overview/overview.css | Satisfied — CLOSED | Split into `chq-overview-link-btn` (roomy, all remaining call sites) and `chq-overview-link-inline` (the public-URL call site, deliberately unfloored) — DEC-393 wave-106; full citations and receipts are given in the RESOLVED note at the foot of this document, not repeated here. |
| `chq-overview-section-action` | ROOMY | app/src/pages/overview/overview.css | Satisfied | "All N" section link stands alone at the right of the section header row (`Overview.tsx:376,438`); floored (app/src/pages/overview/overview.css`chq-overview-section-action`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-overview-toolbar-btn` | ROOMY | app/src/pages/overview/overview.css | Satisfied | Export / New-submission toolbar actions; floored (app/src/pages/overview/overview.css`chq-overview-toolbar-btn`). |
| `chq-overview-toolbar-btn-primary` | ROOMY | app/src/pages/overview/overview.css | Satisfied | Always co-occurs with `chq-overview-toolbar-btn` (`Overview.tsx:305`), same toolbar row. |
| `chq-pill` | ROOMY | app/src/styles.css | Satisfied | Phone floor at `styles.css:2411-2419` (`chq-pill`), shared with `chq-btn-tertiary`, `chq-rail-link`, `chq-checkbox-label`. |
| `chq-review-add-link` | ROOMY | app/src/pages/review/review.css | Satisfied | "+ Add option" / "+ Add criterion" stand alone (`PlanEditor.tsx:2011,2080`); floored at both call sites (app/src/pages/review/review.css`.chq-review-criterion-options-footer .chq-review-add-link` and `.chq-review-add-criteria .chq-review-add-link`) with `display: inline-flex; align-items: center; min-height: 44px;`. No explicit horizontal padding declared on the anchor itself. |
| `chq-review-back` | ROOMY | app/src/pages/review/review.css | Satisfied | Back link on its own line above the scorecard/results/queue heading (`Scorecard.tsx:473` and others); floored (app/src/pages/review/review.css`.chq-review-back,`) alongside `chq-review-editor-back-link`, with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-review-editor-back-link` | ROOMY | app/src/pages/review/review.css | Satisfied | Standalone back link out of `PlanEditor.tsx:1264`; floored (app/src/pages/review/review.css`.chq-review-editor-back-link {`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-review-queue-row-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Co-occurs `chq-btn` (`ReviewerQueue.tsx:325,332`); the recused-row span variant (`ReviewerQueue.tsx:379`) is inert text, not a tap target. |
| `chq-review-queue-score-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Same co-occurrence as `chq-review-queue-row-action`. |
| `chq-review-queue-title` | ROOMY | app/src/pages/review/review.css | **Unsatisfied** (off-limits) | Submission title link is the only tap target in its part of the row, the row itself is not one target (`ReviewerQueue.tsx:266`); no phone rule found. |
| `chq-review-scoped-title-action` | ROOMY | app/src/pages/review/review.css | Satisfied (off-limits) | Co-occurs `chq-btn chq-btn-primary` (`ReviewerQueue.tsx:675`, `chq-review-scoped-title-action`). |
| `chq-reviewer-plan-row-action` | ROOMY | app/src/pages/review/review.css | Satisfied | Standalone action label at the foot of a plan progress row, moved out of PlanList.tsx to `ReviewerQueue.tsx:510`; floored (app/src/pages/review/review.css`.chq-reviewer-plan-row-action {`) with min-height:44px, centred flex, and padding-inline:10px. |
| `chq-row-title` | ROOMY | app/src/styles.css | **Unsatisfied** | Base class for table-cell title links (composed with page-local `-name-link`/`-task-title` classes below); no phone rule exists for this selector in styles.css. |
| `chq-section-action` | ROOMY | app/src/styles.css / review.css | **Unsatisfied** | Section-header "All N ›" link pattern shared across pages; base rule (styles.css:560) has no phone floor. |
| `chq-settings-inline-action` | INLINE | app/src/pages/settings/settings.css | n/a | Trails an inline `" · "` separator on the same text line as the resource name (`ResourcesPanel.tsx:228-231`: `{' · '}` immediately before `<a className="chq-settings-inline-action"`, repeated at :291-294). |
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

## Remaining unsatisfied residue (DEC-518 amendment, re-derived against the tree)

Re-derived row by row against the current stylesheets: only three tokens
remain genuinely unfloored, each for a stated structural reason rather than
a schedule or an owner:

- `chq-link-button` / `chq-row-title` / `chq-section-action` — each is a
  SHARED BASE CLASS with no `@media (max-width)` rule of its own anywhere in
  `app/src/styles.css`. Every concrete use composes the base with a
  page-local selector (a back link, a row title, a section action), and it
  is that composed selector, not the base, that must (and in every audited
  case now does) carry its own floor — the base staying bare is the correct
  shape for a shared class whose call sites diverge in ROOMY vs.
  ROW-IS-THE-TARGET treatment, not a gap.
- `chq-review-queue-title` — ROW-IS-NOT-THE-TARGET: the submission title
  link is one of two independent tap targets inside
  `.chq-review-queue-row` (the title link and the row's own action button
  both live in the row), so the row's own `min-height` cannot stand in for
  the title's floor, and `review.css` declares no floor for
  `.chq-review-queue-title` itself (`ReviewerQueue.tsx:266`).

RESOLVED (DEC-393 wave-106, task w2-d): `chq-overview-link-btn` was split.
The four row-action call sites (`Overview.tsx:350,355,424,464`) keep
`chq-overview-link-btn`, floored to 44px/flex/centred/padded inside
overview.css's last `max-width: 700px` block. The fifth site
(`Overview.tsx:498`, the /e/{slug}-shaped public URL sitting inside
`.chq-overview-row-meta` running prose) now carries `chq-overview-link-inline`
instead, a top-level (no @media) rule with the same brand colour/weight/hover
treatment but deliberately no `min-height`, no `display: flex`, and no block
padding — per DESIGN-RULINGS.md:189, the floor governs controls, and flooring
a URL mid-sentence would break the line box. See
app/src/pages/overview/overview-link-register.test.ts.
