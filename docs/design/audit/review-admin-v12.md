# Review admin v12 fidelity audit — phone 390 (v12m-w5-b, wave 87)

Numbered findings the task window could not resolve as real code (a genuine
domain/behaviour gap, or a real conflict with a file this task does not
own), plus the deliberate carve-outs taken instead. Frame citations are
verbatim literals from `docs/design/Chautauqua Review.dc.html`'s "Plan
editor · 390" frame (starts `:594`), per DEC-967.

## 1. The frame's per-criterion TYPE select has no equivalent control in this editor

`:608` draws a per-row type control:

`<div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 13px; font-size:14px">{{ c.typeLabel }} <span style="color:#565A4B; padding-left:6px">▾</span></div>`

The live app has no path that changes an *existing* criterion's kind —
`kind` is picked once, at "Add criterion" time, via the segmented control
(`PlanEditor.tsx`'s `pickingKind` block), and never again. Two options were
considered:

- **A genuinely inert `<select disabled>`** styled with the shared
  `.chq-select` caret (DESIGN-RULINGS B8), carrying the criterion's one
  true kind. Honest, and geometrically close to the frame. Rejected this
  wave because it is an *unconditionally rendered* element and would grow
  the editable criterion row's child count past the desktop grid-track
  parity `PlanEditor.render.test.tsx` pins ("declares at least as many
  grid tracks as an editable criterion row has non-error children",
  expects exactly 5) — a file this task does not own, and the fix (adding
  a 6th grid track) is a desktop-affecting change out of this task's
  frozen-desktop scope.
- **A phone-only, CSS-hidden-at-wide element.** Same DOM-count problem:
  jsdom evaluates no `@media` rule, so a "hidden at desktop" element is
  still a rendered child in that test's count.

Needs a design call: either (a) accept the type row is decorative-only on
phone and drop it from the frame (my narrow-interpretation guess), or (b)
grow `PlanEditor.render.test.tsx`'s grid-track pin to 6 first, in a
separate change that owns that file, then add the disabled select here.

## 2. The Reviewers roster's per-row action is "Remove", not the frame's "Swap"

`:652` draws:

`<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Swap</span>`

The live editor's only per-reviewer action is unassignment
(`setPendingUnassignReviewer` → `DELETE /plans/:id/reviewers/:id`,
gated behind `ConfirmDialog` per DEC-941). There is no reassign-in-place
capability ("swap this reviewer for a different one on the same scope")
anywhere in the domain or the route layer. Implemented the frame's
GEOMETRY only (44px, padding 0 14px, bordered chip) on the existing
Remove button; the copy stays "Remove" rather than fabricating a Swap
affordance with no capability behind it. Needs a design call: is "Swap" a
genuinely new capability (pick a replacement reviewer, unassign the old
one and assign the new one as one action), or is the frame's label a
V12-era rename of the same Remove action?

## 3. The frame's second "Assign a reviewer" control (dashed, below the roster) was not built

`:663` draws:

`<span style="display:flex; align-items:center; justify-content:center; border:1px dashed #BAB6A6; border-radius:6px; min-height:46px; font-size:13px; font-weight:700; color:#4E5C31">Assign a reviewer</span>`

— a SECOND "Assign a reviewer" affordance, separate from the section
rule's toggle (`:643`'s row implies the toggle is elsewhere; the desktop
editor's toggle lives in `.chq-section-head`). A first attempt rendered
both — the existing header toggle (kept, since it is the ONE thing that
actually opens the assign form) and a new phone-only button with the same
accessible name and the same `setAssignFormOpen` handler. That broke
`PlanEditor.render.test.tsx`'s `findByRole('button', { name: 'Assign a
reviewer' })` query (now ambiguous between two matches) — a file this task
does not own, so the second button was reverted rather than risking that
query. What shipped instead: the ONE toggle, floored to 44px with
non-zero horizontal padding, sitting next to the frame's bare Reviewers
count. The frame's specific placement (a dashed control below the roster,
after Cap each/Distribute) is not reproduced. Needs either (a) a
distinguishing `aria-label` on one of the two controls (so the render
test's query stays unambiguous) landed in the SAME change that touches
`PlanEditor.render.test.tsx`, or (b) a ruling that the single toggle,
wherever it sits, satisfies the frame's intent.

## 4. The docked footer's copy doesn't match the frame, and neither does the button set for an existing plan

`:665-667` draws the dock as `Save the plan` (flex:1, olive) + `Cancel`
(bordered secondary) — always exactly these two. The live editor's title
row renders **Cancel + Create the plan** only for a brand-new plan
(`isNew`); for an existing plan (the state this frame's own content —
"Wave 2", "AI Engineering · closes 30 Aug" — depicts) it renders
**Duplicate + Save**, with no Cancel affordance at all on either desktop or
phone. Implemented the frame's GEOMETRY (fixed-position dock, border-top,
48px targets, primary at `flex:1`) applied to whichever pair the editor
already renders in `.chq-review-editor-title-actions`, since the dock is a
CSS-only repositioning of the SAME buttons (no new Save/Cancel markup, so
a save from the dock and a save from the top position are always the one
`save()` call — DEC-385/DEC-547 discipline). The copy mismatch
("Save the plan" vs "Save", "Cancel" vs "Duplicate") is a pre-existing
desktop behaviour difference this CSS-only phone lane did not invent and
is out of scope to resolve (adding a Cancel-while-editing affordance is a
behaviour change, not a phone-density change). Needs a design call: does
an existing plan's dock genuinely need a Cancel action alongside Save on
phone (in which case Duplicate needs a new home), or does the frame's
copy assume the new-plan state only and this is a captioning gap in the
design pack itself?

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
