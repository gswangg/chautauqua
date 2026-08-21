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

## Frame :187 "New task"

**MATCHES**, with one previously-ruled additive divergence filed alongside
it. Entered via `SpeakersPage` at `/speakers`, opened from the head's `New
task` button. Receipts live in
`Speakers-states.desktop-frame-verdicts.render.test.tsx` (w24-e, DEC-651).

- Title/subtitle (frame :193-194, `New task` over `Created for all 12
  accepted speakers`) MATCHES: `TaskModal`'s create-mode title and subtitle
  render the identical strings, the count read straight off the fixture's
  own `acceptedCount`.
- **Kind order** (frame :208-210, Upload / Form / Acknowledge) MATCHES:
  `TaskModal`'s segmented control renders the three buttons in that exact
  order.
- Required defaults checked (frame :213-215) MATCHES.
- Actions (frame :218-219, `Create the task` / `Cancel`) MATCH.
- **DIVERGES (additively, previously blessed).** The frame's last field
  before the action row is the Required checkbox (:213) — there is no
  audience/assignee section anywhere in this modal. The tree inserts an
  "Assign to" radio group (`Everyone accepted (N)` / `Only the people I
  choose`) between Required and the action row. This is DEC-746's wave-59
  amendment, on the record as an intentional addition ("no new frame
  exists for this in the V11 pack, so this reuses the existing
  vocabulary") — filed here as a receipt, not new debt.

## Frame :228 "Task response"

**DIVERGES** on one wording point; otherwise MATCHES. Entered via
`TaskView` at `/speakers/tasks/:taskId`, opened from an answered row's
`Open` action (frame :228's own entry point, "as answered").

- Q&A rows (frame :242-243) MATCH: each response field renders as a
  question/answer pair inside a definition list.
- The `Reopen this task` action and its caption (frame :247, "Sets it back
  to pending — the next reminder picks it up") MATCH verbatim, rendered
  only once the response has loaded.
- **DIVERGES.** The frame's subtitle names WHEN THE TASK WAS SENT (frame
  :235, `Priya Raman · sent 2 Apr`). `ResponseModal.tsx`'s subtitle instead
  names when the response was COMPLETED (`{contactName} · Completed
  {formatDate(detail.completedAt)}`) — a different fact (send date vs.
  completion date), not a wording variant of the same fact. Filed here as
  measurement; not fixed (desktop is frozen).

## Frame :288 "Participation · open"

**MATCHES.** Entered via `SpeakerDetailPage` at `/speakers/:contactId`,
opened from a Sessions row's `ParticipationMenu` trigger (the same live,
per-session menu :319's verdict above already establishes).

- Identity header (frame :294-295, name over `Northwind Data · no portal
  account`) MATCHES verbatim.
- **The menu body** (frame :298, `hint-placeholder-count="4"`) MATCHES: the
  previously-ruled DEC-869 shape — exactly 3 SELECTABLE states (`Not
  invited` / `Confirmed` / `Declined`) plus `Send portal invite` occupying
  the Invited slot as an action rather than a fourth radio — renders the
  same 4-item count the frame's own placeholder hints at (3 + 1).
- Footer caption (frame :311, `Only "Invited" sends anything — the other
  two just record what you already know`) MATCHES verbatim.

## Frame :442 "Speakers · search found nothing"

**MATCHES** (mechanism; the frame's own worked example uses a different
facet). Entered via `SpeakersPage` at `/speakers`, a STATE: typing a query
into the search box that matches no speaker.

- The frame (:478-479) draws ONE reason sentence naming the excluding
  facet plus ONE escape action, worked against the "Overdue only" pill
  ("Marcus Okafor is on the roster, but nothing of his is overdue.
  Clearing "Overdue only" finds him."). `OnboardingGrid`'s `narrowing.ts`
  implements that SAME naming/escape mechanism per-facet — this verdict
  drives it through the SEARCH facet instead (the frame draws no
  search-specific worked example): typing `okafor` where nothing matches
  renders `No speakers match "okafor".` and a `Clear the search filter ›`
  escape action, naming the one active facet and offering to clear
  exactly it, matching the frame's structural rule.
- The H1 aggregate line stays mounted above the card body, matching the
  frame drawing it above the filter strip in every state.

## Frame :491 "Review these reminders"

**DIVERGES** on the email preview's presentation; otherwise MATCHES.
Entered via `SpeakersPage` at `/speakers`, opened from the `Remind all
outstanding` head action.

- Title (frame :498, `Review these reminders`) MATCHES.
- `Send these N` / `Cancel` / `Logged in Comms history` (frame :540)
  MATCH, and the per-recipient row renders the fixture's name.
- **DIVERGES.** The frame (:498-536) draws a fully rendered HTML email
  card under the "What Marcus will read" eyebrow: a `DevFlow Conf 2027`
  header, a greeting, a "Still to do" bulleted block, and a rendered CTA
  button reading `Open your tasks` (frame :529). `RemindPreviewModal.tsx`
  instead renders the SAME draft as plain text inside a bare `<pre
  class="chq-speakers-remind-draft-text">` — no header band, no styled
  button, `Open your tasks` present only as plain text inside the `<pre>`,
  never as a link or button. The underlying text content (greeting, nudge,
  "Still to do", portal link, signature) is present; the frame's RENDERED
  card presentation is not. Filed here as measurement; not fixed (desktop
  is frozen).

## Frame :549 "Speakers · a write failed"

**MATCHES.** Entered via `SpeakersPage` at `/speakers`, a STATE: an
optimistic cell-status flip that the server's PATCH rejects.

- The banner's bold title (frame :568, `Marcus Okafor's headshot task did
  not change`) and muted body (frame :569, naming the cause and the
  restored status) MATCH verbatim — `cellFailureTitle`/`cellFailureBody`
  compose the identical two-line shape, with the server's own wording
  substituted into the cause clause (DEC-856) rather than a generic
  guess.
- Recovery actions (frame :572-573, `Reload the grid` then `Try again`)
  MATCH, in that order.
- **The rollback is said out loud, not silent.** The optimistically-flipped
  cell reverts to its pre-flip status (`OVERDUE`) and stays marked "not
  saved" until the banner clears — a functional, per-cell rollback (never
  a whole-grid snapshot that would also revert a concurrent success), with
  the banner naming exactly the row it affects.

## Summary

| Frame | Verdict |
| --- | --- |
| :28 Onboarding grid · 1600 | MATCHES |
| :187 New task | MATCHES (+ blessed additive divergence, DEC-746) |
| :228 Task response | DIVERGES (subtitle: sent vs. completed date) |
| :288 Participation · open | MATCHES |
| :319 Speaker detail · /admin/speakers/:contactId | DIVERGES (blessed, DEC-936) |
| :442 Speakers · search found nothing | MATCHES |
| :491 Review these reminders | DIVERGES (plain-text draft vs. rendered email card) |
| :549 Speakers · a write failed | MATCHES |
| :598 One task, every speaker | MATCHES |
| :665 One task · still waiting | MATCHES |

7 of 10 frames MATCH outright as rendered (an 8th, :187, matches with one
previously-blessed additive divergence filed alongside it); the two
DIVERGES rows found this wave (:228, :491) are real presentation/wording
gaps, filed as measurement per the mandate's desktop freeze — no desktop
byte was moved to produce any verdict in this document.
