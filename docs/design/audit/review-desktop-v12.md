# Review v12 DESKTOP (1600) per-frame render verdicts — PlanEditor family (w23-d, DEC-976 wave-23 amendment)

Per-frame render VERDICTS for the four PlanEditor-family desktop frames in
docs/design/Chautauqua Review.dc.html, entered through the app's real route
and asserted against jsdom DOM structure/order/text (never a computed style
— jsdom applies no stylesheet) or, for the one claim that is inherently a
CSS fact, against review.css's own stylesheet TEXT. Every row below was
RENDERED, not merely cited. Receipts live in
app/src/pages/Review.desktop-frame-verdicts.render.test.tsx.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

## Coverage — this lane owns four of Review's eight desktop frames

Review has EIGHT desktop (1600) frames. This lane owns exactly the four
PlanEditor-family frames listed below. The other four —
**:28 Organiser view**, **:183 Reviewer scorecard**, **:351 Reviewer
queue**, and **:830 Your plans** — are deliberately NOT covered here; a
later wave's reviewer-facing-family lane owns those. Stated explicitly so
this ledger's coverage reads as 4-of-8, not as complete.

## Frame :451 "Plan editor · /review/plans/:id"

**MATCHES.** Entered via `PlanEditor` at `/review/plans/:planId`, an
existing plan with unlocked (unscored) criteria.

- Title-row action order — `Duplicate` / `Save` (frame :461-462) — matches
  `.chq-review-editor-title-actions`'s rendered buttons exactly.
- The plan-fields grid states `Opens` / `Closes` / `Reviews per talk` /
  `Rating scale`, in that order (frame :469/473/477/481), matching
  `.chq-review-summary-grid`'s field order.
- The unlocked Scoring criteria section carries the eyebrow `Scores average
  by weight` (frame :490) via `.chq-review-criteria-eyebrow`.
- The criteria head row states `Criterion` / `Guidance for reviewers ·
  optional` / `Type` / `Weight`, in that order (frame :493), matching
  `.chq-review-criteria-head-row`'s four labelled cells.

Note (DEC-745 wave-19 amendment, already blessed in DEVIATIONS.md, not a
new finding here): the frame draws a separate `<h1>` name row (:597 in its
own 390 sibling) with Save/Cancel in a page footer, while the tree's v4
shell instead renders the plan name as an editable title INPUT in the same
title row that carries Duplicate/Save, with a visually-hidden `<h1>`
alongside it for the one-heading-per-page rule. The blessed shell still
produces the SAME action labels in the SAME order this document verdicts
above, so every claim in this section stands independent of that already-
ruled shell substitution.

## Frame :675 "Plan editor · criteria frozen"

**RULING** (DEC-882 wave-8) + one CLOSED-with-receipt item. Entered via
`PlanEditor` at `/review/plans/:planId`, a plan whose active round already
carries submitted evaluations (`evaluationCountsByRound`).

- **Locked eyebrow text (RULING, DEC-882 wave-8, clause b).** The frame
  draws a fixed, generic sentence — `Locked — wording, type and weights
  fixed for this wave` (frame :693) — naming no count. The tree instead
  states the LIVE scored-review count, read from the plan's own
  `evaluationCountsByRound` (server truth, never re-derived): `Locked — 12
  reviews scored against these criteria` in this fixture. Ruled a deliberate,
  additive improvement, not a divergence to close: the frame's own sibling
  body-caption already carries the generic sentence verbatim ("Wording,
  weights and the scale are fixed for the rest of this wave"), so nothing
  the frame states is lost, and the eyebrow's live count is real information
  the static frame cannot draw. This bullet stays as a ruling, never a
  lane.
- **Locked notice card** (frame :705-708, headline `Changing these would
  rescore work already done` + reason sentence + `Start a new wave` CTA)
  **MATCHES** exactly — headline, full reason sentence, and the button are
  all present in `.chq-review-criteria-locked-notice`.
- **Locked row track count — CLOSED-with-receipt (wave 8, w8-c).** The
  frame's own locked-row markup (frame :696) draws a FOUR-track grid (`1fr
  232px 128px 122px` — label / hint / type / weight, no drag-handle or
  remove-button column). `.chq-review-criterion-row.chq-review-criterion-row-readonly`
  in `app/src/pages/review/review.css` now matches: `grid-template-columns:
  minmax(0, 1fr) 232px 128px 122px`, four tracks, no drag or remove column.
  `PlanEditor.tsx`'s locked-row map no longer pads the row with leading/
  trailing placeholder `<span/>` elements — the handle and remove tracks
  are absent from the grid itself, not blank cells within a six-track grid
  as the prior (now-superseded) reading held. The unlocked editor and its
  header are untouched and keep their six-track layout.

## Frame :718 "New plan · /review/plans/new"

**MATCHES.** Entered via `PlanEditor` at `/review/plans/new`.

- Title `New evaluation plan` over the caption `Nothing is sent to
  reviewers until you open it` (frame :726-727) MATCHES — the `<h1>` falls
  back to the frame's literal title text when `draft.name` is empty, and
  `.chq-review-field-caption` carries the caption verbatim (with the
  tree's own trailing full stop, a punctuation-only difference the
  fixture's `toHaveTextContent` still resolves as a substring match).
- Title-row action order for a new plan — `Cancel` / `Create the plan`
  (frame :729) — MATCHES `.chq-review-editor-title-actions`'s rendered
  buttons exactly.
- The new-plan starting-state note (frame :738, "Three to start with — two
  scored 1–5 and one recorded as a spread…") MATCHES verbatim, and is drawn
  only on this route (`isNew`), never on an existing, already-edited plan.
- The new plan opens pre-seeded with exactly THREE default criteria rows
  (frame :742, `hint-placeholder-count="3"` over `defaultCriteria`)
  MATCHES — three unlocked `.chq-review-criterion-row` rows render on
  first paint, matching the frame's "Prefilled, not empty" subtitle.

## Frame :875 "Plan editor · save rejected"

**MATCHES.** Reached through the component's REAL client-side refusal
path — never a hand-built error prop — by typing a plan name, removing all
seeded criteria by hand, setting a close date before the open date, and
clicking `Create the plan`; `validatePlanDraft`/`validateCriteriaList`
produce exactly the frame's two-error combination.

- The refusal banner (frame :888-889, headline `Two things need fixing
  before this plan can open` over the criteria+window kept sentence, "A
  plan with no criteria has nothing for reviewers to score, and the window
  has to run forwards.") MATCHES — `ErrorSummary`'s `heading`/`kept` props
  render both exactly, and only for this specific two-error shape (the
  kept sentence is gated on `errors.criteria && errors.closeAt` both
  firing, never shown for a single-error refusal).
- The Closes field's own worded-as-a-consequence error (frame :901, "This
  is before the plan opens. Pick a date after 2 September.") MATCHES —
  `planForm.ts`'s `validatePlanDraft` produces the identical sentence shape
  with the real open date substituted in.
- The empty-criteria card (frame :910-911, headline `No criteria yet` over
  "Reviewers need at least one thing to score. Add your own, or start from
  the three defaults.", with both `Add the three defaults` and `Add one of
  my own` recovery actions) MATCHES verbatim, including both actions as
  real buttons.

## Summary

| Frame | Verdict |
| --- | --- |
| :451 Plan editor · /review/plans/:id | MATCHES |
| :675 Plan editor · criteria frozen | DIVERGES — both pieces adjudicated (DEC-882 wave-8: live count is a deliberate ruling, not a gap to close; locked-row track count CLOSED-with-receipt wave 8/w8-c, `review.css` now ships the frame's four-track grid) |
| :718 New plan · /review/plans/new | MATCHES |
| :875 Plan editor · save rejected | MATCHES |

3 of 4 frames MATCH as rendered; the one DIVERGES row's two items are both
adjudicated, not open gaps: the eyebrow's live scored-review count in
place of the frame's generic sentence is a deliberate, additive
improvement ruled DEC-882 wave-8 (the frame's own sibling body-caption
already carries the generic sentence verbatim, so nothing the frame states
is lost); the locked-row track count is CLOSED-with-receipt (wave 8/w8-c)
— `review.css`'s `.chq-review-criterion-row-readonly` now declares the
frame's own four-track grid (`minmax(0, 1fr) 232px 128px 122px`, no
drag/remove columns), so the "6-track vs. 4-track" reading is a superseded
prior measurement, not the tree's current shape. No desktop byte was moved
to produce this verdict.

Not covered by this document: Review's other four desktop frames (:28
Organiser view, :183 Reviewer scorecard, :351 Reviewer queue, :830 Your
plans) — a later wave's reviewer-facing-family lane.
