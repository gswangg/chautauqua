# Review plan-editor cap row v12 fidelity audit — phone 390 (v12m-w33-b, wave 33)

DEC-745 (wave-72 amendment; this file's own wave-33 amendment). Frame
citation is a verbatim literal from `docs/design/Chautauqua Review.dc.html`'s
"Plan editor · 390" frame (opens `:594`), per DEC-967.

## Finding: the 390 cap row draws a different summary grammar than desktop — BUILT this task

`:662` draws:

`<span style="font-size:12px; color:#565A4B; line-height:1.5">Would assign 22 of 36 · you confirm before anything saves</span>`

The desktop plan editor frame (`Plan editor · /review/plans/:id`, `:549`)
draws a different sentence for the same cap row:

`18 talks · 36 reviews needed at 2 each · 4 reviewers`

`grep -rn "Would assign" app src` returned zero on `main` before this task —
the phone sentence had never been built. `distributeSummaryText`/
`capRowSummaryLine` (defined at app/src/pages/review/PlanEditor.tsx:306,
sharing the app/src/pages/review/PlanEditor.tsx:267 distributeSummaryText
helper) already compose the
desktop grammar from `submissionsInScope` × the plan's reviews-per-talk ×
`reviewerAccountCount`, all read off `GET /plans/:id/progress`.

### The two registers

Both live in `PlanEditor.tsx`, split by the SAME `isPhone` gate this row
already used one line above for `Cap each` / `Cap per reviewer` (DEC-709
wave-159):

- **Desktop** (frozen): `capRowSummaryLine(submissionsInScope, reviewsPerTalk, reviewerAccountCount)`
  — unchanged, byte-identical to before this task.
- **Phone** (new): `capRowSummaryLinePhone(reviewsNeeded, wouldAssign)` →
  `` `Would assign ${wouldAssign} of ${reviewsNeeded} · you confirm before anything saves` ``.

Both share the CSS class `.chq-review-distribute-summary` — no new class
was added, since the frame draws the same visual role (a small grey caption
line) in both registers, just different words.

### The four inputs, and why each is honest

`wouldAssign` (`capRowWouldAssignPhone`, `PlanEditor.tsx`) is built ONLY
from state already loaded onto this page — no new fetch, no new endpoint:

1. **`reviewsNeeded`** = `submissionsInScope * (draft.maxEvaluationsPerSubmission ?? 1)`.
   `submissionsInScope` is the plan-filtered submission count `GET
   /plans/:id/progress` already returns (the same figure the desktop
   sentence's "N talks" clause uses); `maxEvaluationsPerSubmission` is the
   plan's own reviews-per-talk setting already on `draft`. Honest because
   it is the same product the desktop grammar computes, just not yet
   rendered as a separate clause.

2. **`alreadyAssigned`** = `progressRows.reduce((sum, r) => sum + r.assigned, 0)`.
   `progressRows` is the per-reviewer roster the "Who reviews what" table
   below this row already renders from — summing `assigned` across every
   row already on screen, never a second aggregate the user cannot see
   reflected elsewhere on the page.

3. **`capacity`** = when the cap input (`capPerReviewerInput`, parsed via
   the SAME `parsedCapPerReviewer()` the Distribute-preview fetch already
   uses — `Number.isInteger(n) && n >= 1`) yields a positive integer,
   `progressRows.reduce((sum, r) => sum + Math.max(0, cap - r.assigned), 0)`
   — the sum of each reviewer's own remaining headroom under that cap,
   never negative per reviewer. When no cap is typed, capacity is
   `Infinity` (uncapped), matching the preview/apply endpoints' own
   "no `cap` query param" behaviour.

4. **`wouldAssign`** = `clamp(min(reviewsNeeded - alreadyAssigned, capacity), 0, reviewsNeeded)`.
   Bounded below by 0 (a plan that already has more assigned than it needs
   never shows a negative count) and above by `reviewsNeeded` (capacity
   alone, uncapped, can never inflate the number past what the plan
   actually needs) — the SAME two constraints the real distribute
   preview/apply enforce, so the phone sentence can never promise a run the
   backend would not actually perform.

### The render guard (no fabricated numerator)

The existing guard (`submissionsInScope !== null && reviewerAccountCount
!== null`) governed only the desktop sentence, whose three inputs load
together in one `GET /plans/:id/progress` response. The phone sentence adds
a fourth requirement, `progressLoaded` (a new boolean flipped `true` only
once that same response has landed): `progressRows` starts as `[]` on
mount, which is indistinguishable from "loaded, zero reviewers assigned" —
without `progressLoaded`, `wouldAssign` would read `[]` as "nobody has
anything assigned yet" and render a numerator built on data that has not
actually arrived. The phone branch renders nothing at all (not a zero, not
a placeholder) until `progressLoaded` is true. Desktop's guard is
unchanged.

### Out of scope (untouched, per task boundary)

`distributeSummaryText`'s own wording, the confirm panel's post-preview
summary, the plan wire contract, the criteria-freeze rules, and every
desktop rule — none were touched. No new CSS class was added.

## Tests

`app/src/pages/review/PlanEditor.capRow390.render.test.tsx`: cites `:662`
verbatim via `verbatimLine` (DEC-967 shape, copied from
`Scorecard.overall-390.render.test.tsx`); asserts the phone sentence with
its computed numbers and the absence of the desktop grammar; asserts the
exact inverse on desktop; asserts NO summary node renders while
`progressRows` has not yet loaded.
