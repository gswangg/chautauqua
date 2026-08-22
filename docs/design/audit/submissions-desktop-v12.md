# Submissions v12 DESKTOP (1600) per-frame render verdicts (w23-f, DEC-976 wave-23 amendment)

Per-frame render VERDICTS for the five desktop/modal frames this task owns
in `docs/design/Chautauqua Submissions.dc.html`, entered through the app's
real routes and asserted against jsdom DOM structure (never a computed
style — jsdom applies no stylesheet). Receipts live in
`app/src/pages/Submissions.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move
no desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

## Population and route ownership

The Submissions cluster's desktop/modal frames split across TWO
components:

- **List states**, entered via `app/src/pages/Submissions.tsx` (a thin
  wrapper over `submissions/SubmissionsTable.tsx`):
  - `:531` "Save this view" — the `SaveViewDialog` modal inside
    `submissions/ViewTabs.tsx`, reached from the list toolbar's own "Save
    current as view" control.
  - `:561` "Submissions · before the CFP opens" — the 1600 FRESH empty
    state (no submissions exist yet on the event).
  - `:605` "Submissions · triage queue clear" — the 1600 SETTLED empty
    state (the Pending status facet excludes every row because the event's
    triage queue is empty).
- **CFP form builder**, entered via `app/src/pages/forms/FormsPage.tsx`
  (the ADMIN builder — NOT the public SSR CFP; the same route
  disambiguation `Submissions.frame-verdicts.render.test.tsx` already
  records for its own frame `:468`):
  - `:399` "CFP form builder · /submissions/forms" — the 1600 builder
    screen itself.
  - `:655` "CFP form · edit a question" — the `FieldModal` edit dialog,
    reached from a real field row's `Edit` control (never mounted
    directly).

**Not this task's job** — three frames already carry citations elsewhere
in the codebase and are explicitly out of scope per the brief: `:28`
(desktop control-floor sweep), `:187` (an existing ViewTabs/FilterBar
citation), `:495` (the "New submission" modal, already receipted). This
document does not re-adjudicate them.

## Frame :531 "Save this view"

**MATCHES.** Entered via `SubmissionsPage` → `ViewTabs`' "Save current as
view" control, with the Pending status pill and the "AI Engineering" track
filter applied through the real controls first (not a fabricated filters
object) — the same live-filter state the frame's own subtitle names.

- The dialog opens titled `Save this view` (frame `:537`), matching
  `ModalFrame`'s own `<h2 class="chq-modal-title">`.
- The subtitle reads `Pending · AI Engineering · newest first` (frame
  `:538`) — an EXACT match, because `summarizeFilters()` (ViewTabs.tsx)
  produces the identical sentence shape and the fixture's filter state was
  driven to match the frame's own sample.
- `Name it` (frame `:544`) labels a real text input.
- `Share it with the other organisers` (frame `:548`) is a real, unchecked
  checkbox — not the frame's static caption.
- `Save the view` then `Cancel` (frame `:551-552`) render in that order.

No divergence found for this frame beyond the dialog's narrower 440px
measure, which `ViewTabs.tsx`'s own comment already documents as an
intentional one-off (G13 lane-D fix 02-submissions--07).

## Frame :561 "Submissions · before the CFP opens"

**MATCHES.** Entered via `SubmissionsPage` with no submissions on the
event and the CFP's `openDate` set in the future.

- H1 `Submissions` (frame `:587`).
- Headline `No submissions yet` (frame `:591`), verbatim.
- The reason line (frame `:592`) names the CFP's real open date, read off
  the loaded form object (never fabricated): `formatDateOnly` renders it
  "1 Feb 2027" — a real, year-bearing number in the SAME sentence shape as
  the frame's sample "1 February", not a structural divergence.
- The primary action `Open the form now` (frame `:594`) links to
  `/submissions/forms`.
- The secondary `Add one by hand ›` (frame `:595`) opens the New
  Submission modal via `onClick` rather than navigating — the
  `EmptyStateSecondary` duality, matching the frame's own action pair.
- No filter chrome (ViewTabs/FilterBar) renders above the block — an
  unfiltered fresh collection has nothing to filter, matching the frame's
  own bare head band.

## Frame :605 "Submissions · triage queue clear"

**MATCHES (narrowed).** Entered via `SubmissionsPage` with an event that
carries submissions; the Pending status pill is then applied through the
real control, producing the `triageCleared` branch
(`SubmissionsTable.tsx`): `pendingTotal === 0`, `allTotal > 0`, and
`status === ['pending']` exactly.

- H1 `Submissions` (frame `:631`).
- Headline `Nothing left to triage` (frame `:642`), verbatim.
- **CLOSED — two-sentence reason line, DEC-902 wave-19 clause (c).** The
  frame draws a TWO-sentence reason (`:643`, "All 47 submissions have a
  decision. Twelve are still waiting on content, if you want the next
  thing."). `SubmissionsTable.tsx`'s `triageCleared` branch now renders
  both: the first sentence with the real `allTotal` substituted in ("All
  47 submissions have a decision."), followed by the frame's second
  clause once the event's unfiltered `contentStatusCounts.pending` count
  (already riding the same `perPage=1` list read that supplies
  `allTotal`, DEC-913) resolves and is greater than zero — read into a new
  `awaitingContent` state, never derived from the visible page's rows
  (DEC-936). The clause is spelled through the tree's ONE count-phrase
  vocabulary (`spellCount`/`capitalizeFirst` from `lib/plural.ts`), which
  spells 0–10 and falls back to the digit above that (DEC-925) — so a live
  count of 12 renders "12 are still waiting…", not the frame's own sample
  word "Twelve". When the count resolves to exactly 0, or is still
  unresolved (`null`, in flight or on failure), the clause is omitted
  entirely rather than printing a zero the frame never draws — the same
  "never a fabricated number" discipline `allTotal` already followed.
- The chrome (ViewTabs/FilterBar) stays visible ABOVE the message,
  matching the frame's own header pill strip — `showChrome`'s own
  `describeActiveFacet` call still reports the Pending status facet as
  active even while the `triageCleared` branch is what actually renders,
  so the chrome does not hide the way it does on the `:561` fresh state.
- The one action, `Go to content ›` (frame `:645`), renders after the
  headline.
- No escape control (`Clear filter`) renders — matching `EmptyState`'s own
  construction rule that a `'fresh'`-variant block (which `triageCleared`
  uses) never carries an escape, only `'filtered'` does.

## Frame :399 "CFP form builder · /submissions/forms"

**MATCHES**, with two real, narrow control-type divergences noted below, both blessed by DEC-663 wave-34 amendment (a static mockup's `<a href="#">` is a control treatment, not an element type; recorded in DEVIATIONS.md §7).
Entered via `FormsPage` at its real route.

- Back link `‹ Submissions` (frame `:405`) precedes the H1 `CFP form`
  (frame `:406`), in the frame's own head-band order.
- `Preview` (frame `:409`) then `Save` (frame `:410`) follow, in that
  order, in the header actions. (jsdom applies no `@media`, so the
  phone-only footer's own `Preview` link also sits in the DOM — the
  header's is the first in document order, and is the one asserted here.)
- The Opens/Closes/Received strip (frame `:417`/`:421`/`:425`) renders its
  three labelled cells in that order, with `Received` reading the real
  submissions total ("47 submissions").
- The `Fields` section header (frame `:432`) renders as a real `<h2>` — a
  stronger DOM fact than the frame's plain caption span, same text and
  position.
- **Divergence (control type):** `Add a question` beside the Fields header
  (frame `:433`) is a real `<button>` (`chq-forms-add-question`) in the
  tree, not the frame's own `<a href="#">` anchor — same text and
  position, a control-type substitution rather than a structural one
  (this control writes local state, never navigates, so a button is the
  more correct element).
- A field row's own anatomy matches the frame's grid order: the drag
  handle glyph `⋮⋮` (frame `:437`) comes first, followed by `Edit` then
  `Delete` (frame `:445`/`:446`), in that order.
- The footer `Public link` row (frame `:453`) renders label → value →
  trailing control, in that order.
- **Divergence (control type):** `Copy` (frame `:455`) is a real
  `<button>` in the tree (`chq-btn-tertiary`), not the frame's own anchor
  — it copies to the clipboard rather than navigating, so a button is
  again the more correct element; same text and position.

## Frame :655 "CFP form · edit a question"

**MATCHES.** Entered via the REAL interaction: `FormsPage` → a field row's
own `Edit` control (`FieldList.tsx`), never a directly-mounted
`FieldModal`.

- The modal opens titled `Edit a question` (frame `:662`), distinct from
  the "Add a question" case the same component also serves.
- The subtitle names the real answered count, `47 people have already
  answered this form` (frame `:663`) — the fixture's own `submissions`
  total happens to be 47, so this is an EXACT match against the frame's
  own sample number, read from `received.total` (a real fetch), never
  fabricated.
- The conditional-visibility `Field`/`Is`/`Value` row (frame `:704`, the
  pack's own `1fr 120px 1fr` grid track) renders as three real controls —
  a `<select>` for the trigger field (reading "Always visible" / empty
  value here, since this fixture's field carries no rule of its own),
  rather than the frame's static "Format ▾" / "is ▾" / "Workshop ▾" text.
- The off-case sentence `Only show this question when…` (frame
  `:701-702`) and its caption underneath stay present at all times — not
  conditional on a trigger being chosen (DEC-650), matching the frame's
  own fixed intro.
- The footer carries `Delete this question` (frame `:722`) far left, then
  `Cancel`/`Save the question` right-flushed, in that order — the tree
  renders `Delete this question` as a real destructive-tertiary button,
  not the frame's bare anchor, same text/position.

## Summary

| Frame | Verdict |
| --- | --- |
| :531 Save this view | MATCHES |
| :561 Submissions · before the CFP opens | MATCHES |
| :605 Submissions · triage queue clear | MATCHES |
| :399 CFP form builder · /submissions/forms | MATCHES (two control-type divergences, blessed by DEC-663 wave-34 amendment) |
| :655 CFP form · edit a question | MATCHES |

5 of 5 frames MATCH as rendered. One real, narrow divergence remains, filed
in prose above (`:399`'s "Add a question"/"Copy" controls render as
`<button>` rather than the frame's `<a>` — a control-type residual outside
wave-14m's wording scope, left unfixed here per the mandate's desktop
freeze). `:605`'s reason line was CLOSED in wave-19 (DEC-902 clause (c)):
the tree now renders the frame's second, content-queue-pointing sentence
once the unfiltered content-pending count resolves nonzero. No other
desktop byte was moved to produce this verdict.
