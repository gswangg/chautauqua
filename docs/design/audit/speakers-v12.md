# Speakers v12 fidelity audit — desktop (w1-b)

Numbered findings the 15-minute task window could not resolve. Frame
citations are verbatim literals from `docs/design/Chautauqua Speakers.dc.html`
per DEC-976.

> A finding recorded here is a claim about the tree, not a permanent record.
> It is re-derived against current code before it is scheduled, and once it
> stops reproducing it is rewritten as RESOLVED with a file:line citation of
> where the behaviour now lives (DEC-976 wave-106).

## 1. RESOLVED (DEC-730, wave-90 amendment) — "Speakers · a write failed" frame (:549) draws PRE-v12 status pills, contradicting every other v12 frame in the same file

The `Complete`/`Overdue · not saved`/`Pending` cells in this frame are
hand-styled inline rather than referencing the shared `DONE`/`PEND`/`LATE`
JS constants the rest of the document uses (`{{ cell.style }}` elsewhere).
Concretely, this frame draws:

`<span style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#F7F9F0; background:#4E5C31; border-radius:3px; padding:3px 8px; justify-self:start">Complete</span>`

— a FILLED olive Complete pill (weight 700) — while the "Onboarding grid ·
1600" frame (:28/:129), "One task, every speaker" (:598) and "One task ·
still waiting" (:665) all draw Complete as the v12-inverted `DONE` constant
(`font-weight:600; color:#565A4B`, no fill, no border, no radius). Likewise
this frame's `Overdue · not saved` cell is ink-outlined with a 3px left
border (`border:1px solid #1B1D17; border-left:3px solid #1B1D17`) rather
than the `LATE` constant's filled-ink chip, and its `Pending` cell is
outlined (`border:1px solid #BAB6A6`) rather than `PEND`'s bare bold ink.

The app (`speakers.css`'s `.chq-speakers-status-*` axis-1 rules,
`TaskCell.tsx`'s `statusCellClass`) implements the INVERTED v12 vocabulary
everywhere, matching the three internally-consistent frames above. Making
the "a write failed" state match THIS frame literally would mean the grid
renders one status vocabulary normally and a second, older vocabulary only
while a rollback banner is showing — which cannot be right, and no ruling
says the vocabulary is meant to change under a write-failure banner.

Read as: this one frame section was not re-cut when the pack's status-token
inversion landed elsewhere in the same file. Settled — DEC-730's wave-90
amendment rules the frame stale rather than open a second vocabulary: a
status field cannot change its meaning-to-appearance mapping depending on
an unrelated write outcome, so the frame's literal reading was never a
viable option. No future audit should re-open this.

**Resolution (DEC-730, wave-90 amendment):** frame `:549` is
stale. The same document's `:28`/`:129` ("Onboarding grid · 1600"), `:598`
("One task, every speaker") and `:665` ("One task · still waiting") all draw
Complete/Overdue/Pending through the shared `DONE`/`PEND`/`LATE` (and their
`_M` roomy siblings) constants -- the v12-inverted vocabulary -- and agree
with each other byte-for-byte. `:549`'s hand-styled filled-olive Complete /
ink-outlined Overdue / outlined Pending cells are the one place in the file
that was never re-cut when that inversion landed; a rollback banner is a
banner, not a second status vocabulary, and no ruling anywhere says a
write-failure state repaints the grid's meaning. The app's
`.chq-speakers-status-*` classes and `TaskCell.tsx`'s `statusCellClass`
already implement the inverted set everywhere, including under a
write-failure banner (`notSaved` reuses the `overdue` modifier, never a new
one) -- this is correct as shipped. NO STATUS CODE CHANGED: this entry
records the ruling, it is not a re-skin.

## 2. RESOLVED (wave 106, app/src/pages/speakers/narrowing.ts:1-60, app/src/pages/speakers/OnboardingGrid.tsx:975-990) — "Speakers · search found nothing" (:442) filtered empty state names the excluding facet; the shared EmptyState component does not

Re-derived against main: `narrowing.ts` (new module, header comment cites
this exact finding) exports `activeFacet(filters)`, a `Record<FacetKey,
FacetDef>` exhaustiveness-checked against `GridFilterState`, giving each
single active facet its own `reason`/`escapeLabel`/`clear`. The `q` facet's
reason (`` `No speakers match "${typed}".` ``) echoes the typed search term,
matching frame :442's person-name clause pattern. `OnboardingGrid.tsx:975`
calls `activeFacet(filters)` and, when non-null, renders `EmptyState` with
`reason={facet.reason(...)}` and `escape={{ label: facet.escapeLabel, ...
}}` instead of the generic `narrowingDescription`/`'Clear filters'` pair —
the generic fallback is kept only for zero or two-plus active facets, where
no single facet can be named. `app/src/pages/speakers/narrowing.test.ts` (7
tests) passes. Closed.

Frame reason line: `<span style="font-size:16px; line-height:1.65; color:#3F4237; max-width:52ch">Marcus Okafor is on the roster, but nothing of his is overdue. Clearing “Overdue only” finds him.</span>`
and escape: `<a href="#" style="font-size:14px; font-weight:700">Clear the overdue filter ›</a>`.

`OnboardingGrid.tsx` renders the shared `EmptyState` (component lives at
`app/src/components/EmptyState.tsx`, outside this task's `app/src/pages/
speakers/**` scope) with a generic `narrowingDescription(filters, tasks)`
reason and a generic `'Clear filters'` escape label — never the specific
"which one filter is the culprit, name it and offer to clear just that one"
narrative the frame draws. Fixing this to match the frame literally would
need either a new EmptyState prop/variant or a page-local override, both of
which reach outside this task's file allowlist. Flagging for the shell/
EmptyState-owning lane.

## 3. RESOLVED (wave 106, app/src/styles.css:476-481) — Grid speaker-name text is 18px, frame draws 16px

Frame :129 (`Speakers` 1600 grid) name link:
`<a href="#" style="font-family:'Familjen Grotesk', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em; color:#1B1D17">{{ row.name }}</a>`

Re-derived against main: `.chq-row-title` now reads `font-size: 16px;
font-weight: 600; letter-spacing: -0.015em;` at `app/src/styles.css:476-481`
— the shell lane this finding was flagged for reconciled the size (and
letter-spacing) to match the frame verbatim; weight was already correct
(see fixed finding (a) below). Closed.

---

## Fixed in this task (for context, not further action needed)

- **(a) grid weight inversion**: verified correct. Name link carries 600
  (frame :129 name span, `font-weight:600`); the pending/overdue status
  pills carry 800 (frame's `PEND`/`LATE` constants,
  `font-weight:800`) — the status pill is the heavier face, matching the
  frame. No inversion bug found.
- **(b) shared 22px pill line**: `speakers.css:212-215`
  (`td:not(:first-child) { vertical-align: top; padding-top: 46px; }`) still
  documents and holds the DEVIATIONS §2 top-align behavior; no divergence
  found against the current row geometry.
- **(c) task-view.css track sets**: `:166`
  (`grid-template-columns: 26px 178px 1fr 132px 90px;`) matches frame :598's
  `<div style="display:grid; grid-template-columns:26px 178px 1fr 132px 90px; ...">`
  verbatim; `:176`
  (`grid-template-columns: 26px 178px 1fr 148px 132px;`) matches frame :665's
  `<div style="display:grid; grid-template-columns:26px 178px 1fr 148px 132px; ...">`
  verbatim. No divergence found.
- **(d) "Review these reminders" / "Speakers · a write failed" render as
  drawn**: FIXED a real divergence — `RemindPreviewModal.tsx`'s dialog title
  was `"Review reminders"` against frame :491's
  `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Review these reminders</span>`,
  and its primary button read `Send N reminders` against frame :549's
  `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Send these 3</span>`.
  Both now read "Review these reminders" / "Send these N" verbatim; updated
  `RemindPreviewModal.render.test.tsx` and
  `OnboardingGrid.render.test.tsx` assertions to match. The write-failure
  banner itself (title/body/Reload the grid/Try again) already rendered as
  drawn — see finding 1 above for the status-pill vocabulary caveat inside
  that same frame.
- **(e) w5-h, TaskView audit against `:598`/`:665`**: FIXED a real
  divergence — frame `:648` draws the ANSWERED tab's speaker name as a
  plain `<span>` (no link), while `:713` draws the WAITING tab's name as an
  `<a>`. `TaskView.tsx` rendered both tabs' names as a `<Link>` to the
  speaker detail unconditionally. Now the answered tab renders a plain
  `<span className="chq-taskview-name">` (its one target is "Open", the
  response viewer) and the waiting tab keeps the `<Link>` (it has no other
  route to the speaker). Everything else audited against both frames —
  header actions/order per tab, the two column-track sets (already fixed as
  (c) above), head-row labels, the answered/waiting row typography and
  colour tokens, the bulk bar's per-tab verbs/microcopy, the tab pills and
  right-flushed reminder meta, the roomy-density status chip on the waiting
  tab (DEC-730), and the export/foot copy — matched the frames verbatim; no
  further divergence found. Updated `TaskView.render.test.tsx` to assert
  the answered name is a `<span>`, never a link.
