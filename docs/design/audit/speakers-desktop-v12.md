# Speakers v12 DESKTOP (1600) per-frame render verdicts (w14-sh, DEC-930 wave-158 amendment)

Per-frame render VERDICTS for the four frames that carry the landed v12
Speakers redesign, entered through the app's real routes and asserted
against jsdom DOM structure (never a computed style — jsdom applies no
stylesheet) or, for the two claims that are inherently a CSS fact, against
`speakers.css`'s own stylesheet TEXT. This supersedes `speakers-v12.md`'s
citation-only 100/102 claim for these four frames specifically: every row
below was RENDERED, not merely cited. Receipts live in
`app/src/pages/Speakers.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze, DEC-976 wave-105's
asymmetric-honesty rule): this document and its test file render, verdict,
and file divergences in prose — they move no desktop byte and edit no
component or stylesheet, even where a real divergence is found below.

## Frame :28 "Onboarding grid · 1600"

**MATCHES.** Entered via `SpeakersPage` at `/speakers`.

- Title-action row order — `Add speaker` / `New task` / `Remind all
  outstanding`, docs/design/Chautauqua Speakers.dc.html:59-63 — matches
  `OnboardingGrid.tsx`'s `.chq-speakers-head-actions` exactly (order and
  labels).
- The page summary (`12 accepted · 3 overdue`, frame :57) matches
  `.chq-summary`'s text verbatim, with the two numbers read straight off the
  fixture's own counts.
- The frame's six per-column Edit links have collapsed to ONE "Edit tasks"
  control beside the Speaker column head (frame :79) — the grid renders
  exactly one such button regardless of task-column count, matching
  `EditTasksMenu`'s single-control design.
- The column head is both the per-task aggregate AND the entry point (frame
  :83): the task title renders as a `<Link>` into `/speakers/tasks/:taskId`
  — "One task, every speaker" (frame :598, verdicted separately below).
- **Grid weight inversion**, verdicted against `speakers.css`'s stylesheet
  text (jsdom applies no stylesheet, so a computed-style read would be
  fiction): the pack's own `withDone()` (frame :789-791) assigns a SETTLED
  column-head aggregate ("All N done") `font-weight:600` and an UNSETTLED
  one ("N of M done") `font-weight:800` — an unfinished column reads
  heavier than a finished one, the inversion of the usual "important thing
  is bold" pattern. `.chq-speakers-task-done-settled` in `speakers.css`
  carries `font-weight: 600` and the bare `.chq-speakers-task-done` carries
  `font-weight: 800`; rendering a mixed grid (11 of 12 vs. All 9 done)
  confirms the settled label carries `chq-speakers-task-done-settled` and
  the unsettled one does not.

## Frame :319 "Speaker detail · /admin/speakers/:contactId"

**DIVERGES** (a real, pre-existing and BLESSED divergence — not new debt).
Entered via `SpeakerDetailPage` at `/speakers/:contactId`.

- The frame draws exactly ONE participation control: a header dropdown
  reading `Confirmed ▾` (frame :341, `<span ... cursor:pointer">Confirmed<span
  ...>▾</span></span>`), and each Sessions row's status is a bare, non-
  interactive span (frame :367, `Accepted`). The tree instead renders NO
  participation control in the header at all
  (`.chq-speaker-detail-head` carries no `.chq-participation-menu-trigger`)
  and puts a live, per-session `ParticipationMenu` INSIDE each Sessions row
  — one menu per participation the contact covers, independently settable.
  This is the USER RULING recorded in `SpeakerDetailPage.render.test.tsx`
  ("release night, final form"): a speaker can disagree across sessions
  (declined on one, accepted on another), which one header-level status can
  never represent honestly, and DEC-936 forbids the header from asserting
  ANY participation state as a result. The frame is stale on this point,
  not the tree — this finding is filed here as a receipt of a divergence
  that was already ruled correct, per this task's mandate to file
  divergences even where they are real and already blessed.
- The actions row (frame :352, `Email Priya` at `min-height:46px`) MATCHES:
  exactly two `.chq-btn` controls, Email then Remind, in that order.
- **Tasks row tracks** (frame :377,
  `grid-template-columns:1fr 132px 96px 150px`) MATCHES — verdicted against
  `speakers.css`'s `.chq-speaker-detail-tasks-row` rule text (jsdom applies
  no stylesheet), which declares the identical four-track string.

## Frame :598 "One task, every speaker" (answered state)

**MATCHES.** Entered via `TaskView` at `/speakers/tasks/:taskId`, default
(answered) tab.

- Header actions (frame :617, `Export answers`) MATCHES: `Export answers` /
  `Move the due date` / `Remind the missing` all render as buttons, in the
  frame's order.
- Answers table columns (`Speaker` / `Their answers` / `Answered`, frame
  :642) MATCH by text and role — `role="table" name="Answers"`.
- The bulk bar's answered-tab hint (frame :631, `Marking complete sends
  nothing`) MATCHES, appearing once a row is selected.

## Frame :665 "One task · still waiting" (waiting state)

**MATCHES.** Same route/component as :598 — the SAME TaskView instance,
switched to the "Still waiting" tab, per the mandate's instruction to
budget the two frames as one route with two fixtures.

- Header actions swap (frame :685, `Remind all waiting`) MATCHES: `Export
  answers` disappears, `Remind all waiting` replaces `Remind the missing`,
  and `Move the due date` persists across both tabs (there is no
  per-selection due date anywhere on the page).
- Still-waiting table columns (`Where it stands` / `Last reminded` /
  `Status`, frame :707) MATCH by text and role — `role="table" name="Still
  waiting"`.
- The bulk bar's waiting-tab microcopy (frame :697, "A reminder names only
  this task · skips anyone emailed in the last hour · the due date moves
  for everyone, from the header") MATCHES modulo the same "reminded" vs.
  "emailed" wording `TaskView.render.test.tsx` already pins as the tree's
  intentional phrasing (`skips anyone REMINDED in the last hour`) — a
  narrower, previously-audited word choice, not a structural divergence.
- **Dense/roomy token pairing** MATCHES: every status chip rendered on this
  page carries `chq-speakers-status-roomy` and never
  `chq-speakers-status-dense` — the task-view roster (reached only from a
  column head, never the 1600 matrix itself) takes the roomy half of the
  pair uniformly, matching the same colour/weight family the matrix's dense
  half uses (pinned separately by `speakers-css.test.ts`).

## Summary

| Frame | Verdict |
| --- | --- |
| :28 Onboarding grid · 1600 | MATCHES |
| :319 Speaker detail · /admin/speakers/:contactId | DIVERGES (blessed, DEC-936) |
| :598 One task, every speaker | MATCHES |
| :665 One task · still waiting | MATCHES |

3 of 4 frames MATCH as rendered; the one DIVERGES row is a previously-ruled,
intentional divergence (per-session participation beats a single header
status), not new debt. No desktop byte was moved to produce this verdict.
