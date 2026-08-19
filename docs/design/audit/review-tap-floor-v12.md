# Review cluster — 44px tap-target floor audit (v12m-w7-b)

Scope of this wave's fix (`app/src/pages/review/review.css`, terminal
`@media (max-width: 700px)` block): the four measured-failing anchors —
`.chq-review-plan-actions > a` / `> .chq-link-button`,
`.chq-reviewer-plan-row-action`, `.chq-review-back`,
`.chq-review-editor-back-link`. See `review-phone-cascade-tap.test.ts`.

Everything below is still short of the floor at 390 but is out of this
task's stated scope (either the shared shell owns the class, or the fix
belongs to a different cluster's lane). Recorded here per the task
instructions rather than widening w7-b.

## `.chq-link-button` itself (shared, `app/src/styles.css:783`)

The base shell class carries `padding:0` and no `min-height` — by design,
since it is meant to inherit ambient font/line-height from its container and
is reused across every cluster (contacts, comms, submissions, review). Every
review-cluster consumer of it as a BARE class (not paired with
`.chq-review-plan-actions > .chq-link-button`, which this wave's fix already
covers) still measures under 44px on a phone frame:

- `ProgressPanel.tsx:231,240` — "Remind laggards" and its retry action,
  class `chq-link-button chq-section-action`.
- `ResultsTable.tsx:381,391` — "Export CSV" / round switch links, class
  `chq-section-action chq-link-button` / `chq-link-button` (Link).
- `PlanEditor.tsx:2058` — reviewer-row secondary action, class
  `chq-link-button chq-section-action`.
- `PlanEditor.tsx:2517` — "Delete plan", class
  `chq-link-button chq-review-editor-footer-delete`.

These all key off the shared `.chq-section-action` class too
(`app/src/styles.css`), which is also shell-owned. A fix here has to live in
`styles.css` (the shell lane), not `review.css`, or it needs a
review-cluster-local override class the way `.chq-review-plan-actions > a`
got this wave — either way it is a shell/DEC-368 boundary this task's scope
note ("do NOT widen this task") puts out of bounds.

## `.chq-review-editor-title-actions` (`review.css:1620`)

Houses `.chq-btn` children, which already carry the shared button padding —
not flagged; recorded only to note it was checked and is not a floor
failure.

## Scorecard dense cells (`scorecard.css`)

No interactive anchor/button in `scorecard.css` measures short of 44px
outside the rating-segment/criterion controls DEC-393's earlier wave-7
amendment (`review.css:1734`) already raised to `height:44px`. Per this
task's explicit exclusion, dense scorecard cells are not touched here even
where short.
