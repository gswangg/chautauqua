# Review v12 DESKTOP (1600) reviewer-facing frames — per-frame render verdicts (w26-e)

4 of Review's 8 desktop frames — the four v12m-w23-d's PlanEditor-family
ledger names as not its own ("a later wave's reviewer-facing-family lane
owns those"). This file is that lane's audit doc; its sibling render
receipts live in
`app/src/pages/Review-reviewer.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): every row below was RENDERED
through the app's real routes/components and asserted against jsdom DOM
structure (jsdom applies no stylesheet) or, for the one inherently-CSS
claim (the results-table track set), against `review.css`'s own stylesheet
TEXT. This file moves no desktop byte and edits no component or
stylesheet, even where a real divergence is found.

No Settings citations appear anywhere in this doc or its test file
(DEC-032 wave-26).

## Componentry note (flagged, narrowest interpretation taken)

The task brief names `review/PlanList.tsx` as frame :830's component.
Measured against the tree, frame :830 ("Your plans · /review") is **not**
drawn by `PlanList.tsx` — that component is the ORGANISER's plan list,
mounted only at the organiser's own `/review` route. Frame :830 is drawn
by `ReviewerQueue.tsx`'s own multi-plan hub branch (`plans.length > 1`),
which cites `docs/design/Chautauqua Review.dc.html:793-830` directly in
its own comments. The render receipt below enters :830 through
`ReviewerQueue.tsx` accordingly; `PlanList.tsx` is not imported by this
lane's test file.

## Frame :28 "Organiser view · 1600"

**RESOLVED-BY-RULING (DEC-902)** — a real, pre-existing, already-documented
divergence, not new debt. This lane's assigned checks cover the two pieces the brief
names: the results-table track set (`ResultsTable.tsx`, entered at
`/review/plans/:planId/results`) and the reviewer-progress band
(`ProgressPanel.tsx`, entered at `/review/plans/:planId/progress`). The
frame draws these — along with a third section (`PlanList`'s "Evaluation
plans" list) — combined onto one 1600 canvas; the tree splits them across
three routes. This lane's checks, per the brief, are scoped to the two
named components only.

- **Results-table track set.** DESIGN-RULINGS.md:191 restates the frame's
  grid as `44px 1fr 150px 130px 92px 92px auto` (Rank / Title / Speaker /
  Track / Score / Reviews / Decision). Verdicted against `review.css`'s
  own rule text (jsdom applies no stylesheet, so a computed-style read
  would be fiction):
  - **MATCHES** on three tracks: Speaker `150px`, Track `130px`, Score
    `92px` — exact.
  - **RESOLVED-BY-RULING (DEC-902)** on three tracks, each with its own
    pre-existing DEC-902 comment explaining why:
    - Rank is `56px`, not the ruling's `44px` — `review.css`'s own
      comment: "44 fit RANK only before the shared 16px first-cell inset
      landed."
    - Reviews is `210px`, not `92px` — sized for the full label inventory
      ("▸ N reviews" and "▸ N reviews · M recusals", the wider variant
      needing ~178px), not just the plain count.
    - Decision is a fixed `190px` (`white-space:nowrap`), not the
      ruling's `auto` — under `table-layout:fixed`, `auto`/`1px` is taken
      literally rather than shrink-to-content, so the column is sized to
      the Accept+Decline button pair's real width instead.
  - The seven column head labels themselves are the frame's seven
    columns, in the same order, but one text label also diverges: the
    frame's second column reads "Submission" (frame :125); the tree's own
    header reads "Title" — a pre-existing rename, out of this
    measurement-only lane's scope to fix.
- **Reviewer-progress band** (`ProgressPanel.tsx`, frame :95-119)
  **MATCHES**: "Remind laggards (N)" always renders (N = the laggard
  count); "Remind the N not started" renders only when that population is
  non-empty (DEC-733's hidden-when-zero rule) — verified with a fixture
  carrying one not-started reviewer and one partially-scored (laggard,
  not not-started) reviewer, producing "Remind laggards (2)" and "Remind
  the 1 not started" together.

## Frame :183 "Reviewer scorecard · /review/plans/:id/submissions/:id"

**MATCHES.** Entered via `Scorecard` at
`/review/plans/:planId/submissions/:submissionId`.

- **Rubric-chip anatomy** (frame :225-241): each criterion renders as one
  `.chq-review-criterion` group carrying its label, its weight caption
  ("Weight N · M%"), and a `role="radiogroup"` row of scale chips
  (`role="radio"` buttons) — the frame's label/weight/hint/scale
  anatomy, rendered as a real `<fieldset>`/`<legend>` rather than a bare
  `aria-label`'d div (DEC-939 wave-61 amendment), which is a stronger,
  not weaker, realization of the same visible layout.
- **Header-slot counter portal** (frame :192, "7 of 18 done"): the
  desktop counter leaves the reading column and portals into the app
  shell's `#chq-header-slot` node via `createPortal` — verified by
  mounting a stand-in `#chq-header-slot` div (the same simulation
  `Scorecard.render.test.tsx`'s own DEC-939 describe block already uses)
  and confirming the fetched queue's derived "1 of 2 done" string lands
  inside it, computed off the SAME `queue` endpoint the reviewer queue's
  own progress caption reads (DEC-939).

## Frame :351 "Reviewer queue · /review/plans/:id"

**MATCHES.** Entered via `ReviewerQueue` at `/review/plans/:planId`.

- **Per-row state vocabulary** (frame :385, `{{ q.mark }}` /
  `{{ q.markStyle }}`) is exactly three states, each pairing its own
  action:
  - **SCORED `<score>`** (e.g. "SCORED 4.5") pairs a secondary-face
    "Change your score" link (`chq-btn-secondary`, never
    `chq-btn-primary`).
  - **NOT SCORED** pairs a primary-face "Score this" link
    (`chq-btn-primary`, never `chq-btn-secondary`) — DEC-857/DEC-874's
    "the action names what it actually offers" rule (a scored row never
    repeats the primary "Score this").
  - **RECUSED** pairs no live control at all — the action column carries
    the recusal reason text itself ("Personal conflict"), never a button.

## Frame :830 "Your plans · /review"

**MATCHES.** Entered via `ReviewerQueue` at `/review` with two plans
returned from `GET /api/v1/review/plans` (the `plans.length > 1` hub
branch — see the componentry note above).

- **Plan cards, one action each** (frame :847-853): each
  `.chq-reviewer-plan-row` carries exactly ONE action link, drawn from
  the closed-vocabulary set `Start scoring` / `Score the next one` /
  `Read your scores` (frame :925-939's three action labels) — verified
  across two plan rows with different progress states (one with partial
  progress reading "Score the next one", one fully unstarted reading
  "Start scoring"), each row producing exactly one matching link, never
  more than one.

## Summary

| Frame | Verdict |
| --- | --- |
| :28 Organiser view · 1600 (results-table track set + progress band) | RESOLVED-BY-RULING (DEC-902, pre-existing, documented) |
| :183 Reviewer scorecard | MATCHES |
| :351 Reviewer queue | MATCHES |
| :830 Your plans · /review | MATCHES |

3 of 4 frames MATCH as rendered; the one RESOLVED-BY-RULING row (frame :28's
results-table track set) is three pre-existing, individually
DEC-902-commented track-width deviations from DESIGN-RULINGS.md:191's own
restatement of the frame's grid — none of them new debt, and none moved
by this lane (DEC-651 measurement-only).
