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

## 5. v12m-w31-a/DEC-745 (wave-31 amendment) — (a) and (b) BUILT; (c) RETIRED (already closed by DEC-745 wave-33, never marked here)

`app/src/pages/review/PlanEditor.frame390.render.test.tsx` grades the whole
"Plan editor · 390" extent (24 drawn strings) with `verbatimLine` citations
for every one of them plus render assertions against the shipped tree.
Twenty-one of the 24 already matched before this wave; the remaining three
are resolved as follows.

**(a) BUILT — `:612`/`:627` "Options"/"Weight" eyebrows now render,
phone-visible, per criterion.** `app/src/pages/review/PlanEditor.tsx` now
renders `<span className="chq-review-criterion-field-eyebrow">Options</span>`
immediately above each dropdown criterion's option rows, and
`<span className="chq-review-criterion-field-eyebrow">Weight</span>`
immediately above each rating criterion's weight input — neither is
`aria-hidden`, and each is the real accessible label for its control via
`id`/`aria-labelledby` (`aria-labelledby={`criterion-${criterion.id}-options-
eyebrow criterion-${criterion.id}-label`}` on the options block;
`aria-labelledby={`criterion-${criterion.id}-weight-eyebrow criterion-
${criterion.id}-label`}` on the weight input). `app/src/pages/review/
review.css` carries a top-level `.chq-review-criterion-field-eyebrow {
display: none; }` (desktop already labels these columns via the
unconditional aria-hidden `.chq-review-criteria-head-row`, so the eyebrow
stays invisible there) and, inside the terminal `@media (max-width: 700px)`
block only, restores the frame's own register: `font-size: 11px;
font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color:
var(--chq-muted);` (`--chq-muted` resolves to `#565a4b`, the frame's exact
hex, `app/src/styles.css`). `PlanEditor.frame390.render.test.tsx`'s
CONFORMANCE describe block asserts both eyebrows render with real text at
phone width, are labelled to their control, and are `display: none` at every
width outside the terminal phone block (source-level, since jsdom applies no
stylesheet).

One narrowing versus the frame's literal layout, recorded rather than
silently fixed: the frame pairs the "Options" eyebrow with the "N of M"
count on the same line, above the option rows (`:612`/`:613`). Relocating
the count there would move it out of its already-shipped footer position
(below the rows, beside "Add an option"), which is a desktop-visible reflow
this task's OWNS list (`review.css`'s terminal phone block only, no
top-level declaration may change) cannot repair with a matching desktop
counter-rule. The count therefore stays in its shipped footer position at
every width; only the "Options" eyebrow moved to sit above the rows. Still
open, not a defect this wave introduced.

**(b) BUILT — `:640`'s second clause now matches the frame's slot with
plan-wide-consistent words.** `app/src/pages/review/PlanEditor.tsx` now
branches on `isPhone` (the same seam `capRowSummaryLinePhone` already uses)
so `.chq-review-criteria-cap-notice` reads
`` `${editingCriteria.length} of about ${MAX_PLAN_CRITERIA} · scores average by weight` ``
at phone width, while desktop keeps
`` `${editingCriteria.length} of about ${MAX_PLAN_CRITERIA} · more than that and reviewers rush the last ones` ``
byte-identically (`DEC-385`). Ruling (v12m-w31-a, DEC-745 wave-31
amendment): the frame's literal clause, "the two scored ones average by
weight," names a NUMBER-WORD sampled from the frame's own fixture (its mock
draws 3 criteria, 2 of which carry weight) — the same fixture-data carve-out
`DEC-613`/`DEC-582` apply to stored labels forbids shipping a number-word
grammar to match a mock. The phone clause instead carries the words of the
sentence this same page already ships elsewhere for the identical fact (the
section eyebrow's "Scores average by weight," `PlanEditor.tsx`), placed in
the frame's slot. `PlanEditor.frame390.render.test.tsx`'s CONFORMANCE
describe block asserts the phone sentence, and a sibling assertion pins
desktop's byte-identical, unchanged clause.

**(c) RETIRED — `:662` was already closed, not a live gap.** Verified by
execution: `capRowSummaryLinePhone` (`app/src/pages/review/PlanEditor.tsx`)
already ships the frame's own grammar —
`` `Would assign ${wouldAssign} of ${reviewsNeeded} · you confirm before anything saves` ``
— per its own `DEC-745 (wave-33 amendment)` comment. This finding's original
text described the OLDER, pre-wave-33 shipped sentence
(`distributeSummaryText`'s "N talks · M reviews needed at K each · R
reviewers"), which desktop still renders but phone no longer does.
`PlanEditor.frame390.render.test.tsx`'s
`:662 the phone cap row reads the frame's own "Would assign N of M · you
confirm before anything saves" grammar (DEC-745 wave-33)` test already
covers this. Nothing left to build here; this entry was fossil prose that
had never been marked resolved.

All three of this section's original findings are now closed (two built,
one retired); the extent's remaining 21 strings were already conformant.

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
