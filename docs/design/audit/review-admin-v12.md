# Review admin v12 fidelity audit — phone 390 (v12m-w5-b, wave 87)

Numbered findings the task window could not resolve as real code (a genuine
domain/behaviour gap, or a real conflict with a file this task does not
own), plus the deliberate carve-outs taken instead.

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106).

Frame citations are
verbatim literals from `docs/design/Chautauqua Review.dc.html`'s "Plan
editor · 390" frame (starts `:594`), per DEC-967.

## 1. The frame's per-criterion TYPE select — RESOLVED (DEC-018 Amendment, wave 102, shipped w2-p)

`:608` draws a per-row type control (phone):

`<div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 13px; font-size:14px">{{ c.typeLabel }} <span style="color:#565A4B; padding-left:6px">▾</span></div>`

The same control is also drawn on **two desktop frames** — `:500` (`Plan
editor · /review/plans/:id`) and `:747` (`New plan · /review/plans/new`) —
which settled the design call this finding used to be open on: growing the
editable criterion row's grid past its pre-V12 five tracks is
frame-demanded, not a frozen-desktop violation (`:492`'s
`grid-template-columns:20px 1fr 232px 128px 122px 62px` names the sixth,
122px TYPE track explicitly).

Shipped: a real, enabled `<select class="chq-select">` in the editable
criterion row, over `CRITERION_KIND_LABELS` (`rating | dropdown | text`),
`disabled={activeRoundIsLocked}` like its sibling controls, writing
through the existing `updateCriterion(c, id, { kind })` path
(`PlanEditor.tsx`). Changing kind re-derives the kind-specific fields
(`weight` / `options` / `required`) the same way `addCriterion` seeds a
brand-new row of that kind — a rating row's weight does not strand onto a
dropdown row, and switching to `dropdown` always leaves 2 blank option
rows the existing `Add an option` block can edit. `.chq-review-criterion-row,
.chq-review-criteria-head-row` moved to the frame's six-track template
(`review.css`), and `PlanEditor.render.test.tsx`'s non-error-children pin
moved 5 → 6 in the same commit. The readonly/locked row's own TYPE cell
was already built and is untouched.

## 2. RESOLVED BY RULING (DEVIATIONS.md §6, DEC-745 wave-98 amendment) — The Reviewers roster's per-row action is "Remove", not the frame's "Swap"

Re-derived: this finding's own text asks whether "Swap" is a new
capability or a v12-era rename. `docs/design/DEVIATIONS.md` §6 ("Deferred
post-deadline") now carries an entry, "Plan editor reviewer-row 'Swap'",
citing this exact frame (`Chautauqua Review.dc.html:652`) and ruling: no
reassign-in-place capability exists anywhere in the domain or route layer
(only assign/unassign), so the copy stays "Remove" behind `ConfirmDialog`
(DEC-941); the row's geometry already matches the frame verbatim. This is
a ruling, not a code change — cite DEVIATIONS.md §6 rather than claiming
code moved. Closed.

## 3. RESOLVED (wave 106, app/src/pages/review/PlanEditor.tsx:2229-2263, app/src/pages/review/review.css:328-333) — The frame's second "Assign a reviewer" control (dashed, below the roster) was not built

`:663` draws a SECOND "Assign a reviewer" affordance, separate from the
section rule's toggle:

`<span style="display:flex; align-items:center; justify-content:center; border:1px dashed #BAB6A6; border-radius:6px; min-height:46px; font-size:13px; font-weight:700; color:#4E5C31">Assign a reviewer</span>`

Re-derived against main: this finding's own text names the exact blocker —
the render test's `findByRole('button', { name: 'Assign a reviewer' })`
query would become ambiguous with two same-named controls. That is now
resolved per option (a) the finding itself proposed: the below-roster
control (PlanEditor.tsx`className="chq-review-assign-below"` — CSS
at app/src/pages/review/review.css`.chq-review-assign-below {` (drift-proof
citation, DEC-967 wave-115 shape -- this declaration has drifted from the
line number originally cited here), DEC-745 wave-98 adjudication) carries
`aria-label="Assign a reviewer, below the roster"` while the header toggle
keeps the bare "Assign a reviewer" name. `PlanEditor.render.test.tsx`'s
"below-roster 'Assign a reviewer' trigger (DEC-745 wave-98)" describe
block (from line 2494) exercises both controls by their distinct
accessible names with no ambiguity — `findByRole('button', { name:
'Assign a reviewer' })` still resolves to exactly the header toggle. 72
tests in that file pass. Closed.

## 4. RESOLVED BY RULING (DEVIATIONS.md §3, DEC-745 wave-98 amendment) — The docked footer's copy doesn't match the frame, and neither does the button set for an existing plan

Re-derived: this finding's own text asks whether an existing plan's dock
needs a Cancel action alongside Save, or the frame's copy assumes the
new-plan state only. `docs/design/DEVIATIONS.md` §3 ("Interpretations
where the frames underspecify") now carries a ruling (lines ~106-118):
the docked pair is whichever pair the title row already renders — the
new-plan Cancel/Create pair or an existing plan's Duplicate/Save pair —
never a second copy of the buttons, so a save from the dock and a save
from the top position are always the one `save()` call. The frame's
"Save the plan"/"Cancel" copy is read as GEOMETRY guidance (the existing
plan's copy stays "Duplicate"/"Save", not a mandate to add Cancel to that
pair). This is a ruling, not a code change beyond what the finding's own
"What was built" section already shipped (the CSS-only dock geometry) —
cite DEVIATIONS.md §3 rather than claiming new code. Closed.

## 5. w29-e: three new gaps found reviewing the whole 594-673 extent -- the per-criterion "Options"/"Weight" eyebrows have no phone text counterpart, and both consequence lines (:640, :662) use different grammar than the frame draws

`app/src/pages/review/PlanEditor.frame390.render.test.tsx` grades the whole
"Plan editor · 390" extent (24 drawn strings) with `verbatimLine` citations
for every one of them plus render assertions against the shipped tree.
Twenty-one of the 24 already match (accounting for the pre-existing,
already-ruled divergences: `Reviewers`→`Who reviews what`, `Swap`→`Remove`,
the dock's Duplicate/Save pair — all cited above / in
`docs/design/DEVIATIONS.md`). Three do not, and none of the three is fixable
inside this task's OWNS list (`PlanEditor.frame390.render.test.tsx`, this
audit file, `review.css`'s terminal phone block only) — DEC-385 wave-29
condition (4) ("touches only files the lane OWNS") fails for all three
because the fix is in `PlanEditor.tsx`, which this task does not own.

**(a) `:612`/`:627` "Options"/"Weight" eyebrows are not phone-rendered
anywhere.** The frame draws these as visible per-criterion labels beside the
options list and the weight input. The built tree carries those exact words
in exactly one place — `.chq-review-criteria-head-row`
(`PlanEditor.tsx`), an `aria-hidden="true"` desktop column-header row
rendered *unconditionally*, not gated by `isPhone` and not scoped per
criterion. A screen reader user on phone never hears "Options" or "Weight"
named before the corresponding control. Disposition: needs a real fix in
`PlanEditor.tsx` (a phone-only, per-criterion eyebrow beside each options
block / weight span, mirroring the already-shipped `chq-review-criteria-
count-phone`/`chq-review-reviewers-count-phone` pattern) — filed here, not
built.

**(b) `:640`'s second clause is a different sentence.** Frame: "N of about M
· the two scored ones average by weight". Shipped
(`PlanEditor.tsx:2241`): "N of about M · more than that and reviewers rush
the last ones" (`chq-review-criteria-cap-notice`). The prefix matches; the
consequence named is entirely different copy, describing a soft-cap warning
rather than a scoring-mechanics fact. Not obviously a bug — the shipped
sentence is plausible standalone copy — but it is not what the frame draws,
and no `DEVIATIONS.md` entry rules on it. Disposition: a design call
(replace the shipped clause, or bless the divergence), out of this task's
scope to make.

**(c) `:662` is a different sentence, not just different numbers.** Frame:
"Would assign N of M · you confirm before anything saves" — a preview-count
sentence. Shipped (`PlanEditor.tsx`, `capRowSummaryLine` ->
`distributeSummaryText`): "N talks · M reviews needed at K each · R
reviewers" — a capacity-summary sentence with no "would assign" framing and
no explicit confirm-before-save language. `DEC-745 wave-72`'s own comment at
`PlanEditor.tsx:263-266` states this grammar is deliberate (`distributeSummaryText`
is shared with the post-preview confirm panel and was chosen over the
frame's wording), so this is very likely an already-made design call that
was never logged in `DEVIATIONS.md` — filed here so a future ruling pass
can either write it down there or correct it back toward the frame.

None of the three block anything else; the extent's remaining 21 strings
are conformant. Not resolvable within this task's file ownership.

## What was built (for completeness, not a gap)

- Criteria list: stacked cards via `flex-wrap` (no DOM reorder), the
  label/guidance/options/checkbox each forced to their own line via
  `flex: 1 1 100%`, the weight-or-choice-note + Remove sharing one line via
  `margin-left: auto` on Remove — all without moving a single element in
  the DOM, matching DEC-385's single-direction, max-width-only contract.
- `Options` sub-block, `Add an option`, `Add criterion`, the cap notice.
- Reviewers list geometry (name/track·load stack, the action chip),
  `Cap each` / `Distribute the unassigned`, reordered below the roster via
  CSS `order` on `.chq-review-cap-row` (`.chq-section` is a flex column,
  so every untouched sibling's default `order: 0` keeps the roster ahead
  of it without a DOM change).
- The docked Save/Cancel(-or-Duplicate) footer, fixed to the viewport
  bottom, 48px targets, `flex: 1` primary, with `.chq-review-editor`
  padded so the last row of content clears the dock.
- DEC-393 w87's row-action floor: `PlanList.tsx`'s three Progress/Results/
  Edit `<Link>`s now carry `.chq-review-plan-action-link`, floored inside
  a `max-width: 700px` block to min-height:44px + centred flex +
  `padding: 0 14px` (all three, per DESIGN-RULINGS.md:189 — padding alone
  does not reach the floor).
