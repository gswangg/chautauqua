# Content · 390 landing — strictly-anchored verdict (w32-e, DEC-825 wave-32)

Frame: `docs/design/"Chautauqua Content.dc.html":198` ("Content", 390 worklist
landing), extent `:198`-`:237` (next `width:390px; height:844px` frame starts
at `:247`).

**Scope.** Of the pack's four Content 390 frames, `:247` and `:373` are
claimed by `v12m-w29-h` and `:338` by `v12m-w29-b`. `:198` was the last
unclaimed one — unclaimed not because it was ungraded (`content-v12.md`
already carries a `:198` row, now marked STALE/RESOLVED there), but because
neither existing render assertion (`ContentApp.worklist-390.render.test.tsx`,
`ContentApp.render.test.tsx`) cites a line *strictly inside* `198-237` with a
`verbatimLine()` re-read — DEC-976's strict-anchoring rule doesn't credit a
citation that lands outside the frame's own extent. This task builds that
citation and independently re-derives the verdict rather than inheriting
`content-v12.md`'s prose (field guide: a ledger row is a claim, not a
receipt).

**Method.** Real mount only — `ContentApp` entered through its own
`/content` route (`MemoryRouter` + `Routes`, matching
`ContentApp.worklist-390.render.test.tsx`'s harness), never a sub-component.
Three fixture rows, not two samples (DEC-180), all in the default
`needs_decision` tab so Approve is never conditionally withheld. Every
describe/it opens with a `verbatimLine()` call that re-reads
`Chautauqua Content.dc.html` at assert time. All queries scoped to a
container (`.chq-chipstrip`, the worklist `<table>`, a `<tr>`) — DEC-874:
jsdom mounts desktop table markup and applies no `@media`, so nothing here
is a bare `screen.getByText` that could double-match a phone-only element.
Test file: `app/src/pages/content/ContentApp.landing390.render.test.tsx` (5
passing tests).

## Per-literal verdict

| Frame line | Drawn literal | Verdict | Evidence |
| --- | --- | --- | --- |
| `:204` | H1 "Content" | MATCHES | `getByRole('heading', {name:'Content'})`, class `chq-page-title` |
| `:206` | "N need a decision · M re-uploaded" | MATCHES (shape; frame's 5/2 are sample data, DEC-967) | fixture counts 2 pending + 1 changes_requested = 3, reuploadedCount 2 → renders "3 need a decision · 2 re-uploaded" |
| `:207` | "Select" toggle | MATCHES (shipped as `<button>` not `<a href="#">` — a semantic upgrade, not a divergence) | `getByRole('button', {name:'Select'})`; mutually exclusive with `.chq-content-phone-selecting-meta` on click, summary line disappears |
| `:210` | Chip label "Needs a decision" | MATCHES verbatim | `TAB_LABELS.needs_decision === 'Needs a decision'` (`SessionList.tsx`) AND reaches DOM: `chips.getByRole('tab', {name: /^Needs a decision/})` |
| `:211` | Chip label "Approved" | MATCHES verbatim | `TAB_LABELS.approved === 'Approved'` AND reaches DOM: `chips.getByRole('tab', {name: /^Approved/})` |
| `:210`/`:211` | Chip counts | MATCHES (shape) | fixture counts render as "Needs a decision · 3" / "Approved · 9" |
| — (chip strip overall) | Exactly two chips | **NARROWED** | shipped chipstrip renders THREE tabs (`WORKLIST_TABS`: `needs_decision`, `approved`, `all` — DEC-825), the frame's `:198` extent draws only two. Not a product edit this measurement-only lane may make; recorded as a divergence. |
| `:217` | Card wrapper (status → title → meta → actions stack) | MATCHES | content.css terminal `@media (max-width: 700px)` block: `tr.chq-content-row` is `display:flex; flex-wrap:wrap`, `order` sorts status (2) < title (3) < speaker/file meta (4/5) < actions (6). Independently re-derived (see below), not inherited from `content-v12.md`. |
| `:219` | `{{ row.title }}` | MATCHES (template → real title, per row) | all 3 fixture titles found, scoped to their own `<tr>` |
| `:220` | `{{ row.speaker }} · {{ row.file }}, {{ row.when }}` (one meta line) | MATCHES (merge is a CSS-order effect on 3 separate DOM cells, proved by the sibling suite; independently re-confirmed by this file's own `order` check) | speaker cell shapes enumerated across all 3 rows: bare name, name+"+1" overflow, "No speakers" empty state |
| `:222` | "Approve" button | MATCHES, every row | `within(row).getByRole('button', {name:'Approve'})` for all 3 fixture rows (none pre-approved, so the conditional never withholds it here) |
| `:223` | "Open" button | MATCHES, every row | `within(row).getByRole('button', {name:'Open'})` for all 3 fixture rows |

## Architectural hypothesis re-derived (not inherited)

`content-v12.md`'s `:198` row was originally marked DIVERGES ("stacked card
vs. table row … genuine architectural gap"), then later marked
RESOLVED/STALE by two subsequent waves in that file (w17-c, w21-k) once
content.css's terminal `@media (max-width: 700px)` block grew `display:flex;
flex-wrap:wrap` + `order` on `tr.chq-content-row`. This task did not trust
that history — it re-ran the equivalent proof independently in its own new
test (`ContentApp.landing390.render.test.tsx`'s last `it`), reading the CSS
fresh from the current tree. **Confirmed: MATCHES.** The worklist table
already collapses to the frame's card anatomy (status, title, merged
speaker/file line, actions) at 390 via `order`, the same mechanism
`:373`'s two-column body uses to reorder without forking desktop/phone DOM
(DEC-385: single markup, CSS-only divergence). No architectural gap
survives at `:198`.

## Divergence found

**One real divergence, not previously called out at this granularity:**
the frame's `:198` chip strip draws exactly two chips ("Needs a decision",
"Approved"); the shipped `.chq-chipstrip` (`SessionList.tsx`,
`WORKLIST_TABS` in `worklist.ts`) renders a third ("All accepted sessions",
DEC-825) the frame's landing extent never draws. Owning file:
`app/src/pages/content/worklist.ts` / `SessionList.tsx` (both HARD
READ-ONLY to this task — measurement only, no fix here).

## Summary

7 of 8 drawn literals in the `:198`-`:237` extent: MATCHES, each now backed
by a strictly-anchored `verbatimLine()` citation and a real-mount assertion.
1 of 8 (the chip-strip's two-vs-three-chip count): NARROWED/DIVERGES,
recorded above, not fixed (out of this lane's file scope). The
stacked-card-vs-table-row architectural hypothesis this row previously
carried does NOT survive re-derivation — independently confirmed MATCHES.
