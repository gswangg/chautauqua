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

## `.chq-link-button` itself (shared, `app/src/styles.css`) — RESOLVED (DEC-976 amendment, wave w9-ke)

Was: the base shell class carried `padding:0` and no `min-height`, so every
review-cluster consumer of it as a BARE class still measured under 44px on
a phone frame — `ProgressPanel.tsx` (two call sites), `ResultsTable.tsx`
(two call sites), `PlanEditor.tsx` (the reviewer-row secondary action and
"Delete plan"), all reasoned as a shell/DEC-368 boundary out of that wave's
scope.

That fix has since landed in the shell lane. `app/src/styles.css` now
floors both `.chq-link-button` (app/src/styles.css`.chq-link-button {`) and
`.chq-section-action` (app/src/styles.css`.chq-section-action {`) directly,
each with min-height:44px, centred flex, and padding, inside the
`@media (max-width: 700px)` block — that block's own comment names this
population by call site (`ResultsTable.tsx`, `PlanEditor.tsx`,
`ProgressPanel.tsx`). The one call site pairing `chq-link-button` with a
class other than `chq-section-action` (PlanEditor's "Delete plan",
`chq-link-button chq-review-editor-footer-delete`) is covered by
`.chq-link-button`'s own direct floor, and `.chq-review-editor-footer-delete`
additionally carries its own floor
(app/src/pages/review/review.css`.chq-review-editor-footer-delete {`).

## `.chq-review-editor-title-actions` (drift-proof citation, DEC-967 wave-115 shape -- this declaration has drifted from the line number originally cited here: app/src/pages/review/review.css`.chq-review-editor-title-actions {`)

Houses `.chq-btn` children, which already carry the shared button padding —
not flagged; recorded only to note it was checked and is not a floor
failure.

## Scorecard dense cells (`scorecard.css`)

No interactive anchor/button in `scorecard.css` measures short of 44px
outside the rating-segment/criterion controls DEC-393's earlier wave-7
amendment (drift-proof citation, DEC-967 wave-115 shape -- this declaration
has drifted from the line number originally cited here) already raised at
app/src/pages/review/review.css`.chq-review-rating-btn {` to
`height: 44px;`. Per this
task's explicit exclusion, dense scorecard cells are not touched here even
where short.
