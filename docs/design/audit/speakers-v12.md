# Speakers v12 fidelity audit — desktop (w1-b)

Numbered findings the 15-minute task window could not resolve. Frame
citations are verbatim literals from `docs/design/Chautauqua Speakers.dc.html`
per DEC-976.

## 1. "Speakers · a write failed" frame (:549) draws PRE-v12 status pills, contradicting every other v12 frame in the same file

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
inversion landed elsewhere in the same file. Needs a design call before any
code change: (a) confirm the frame is stale and should be ignored in favor
of the inverted tokens (my narrow-interpretation guess, not applied), or
(b) confirm write-failure states really do get a distinct, pre-inversion
status vocabulary and word that ruling explicitly.

## 2. "Speakers · search found nothing" (:442) filtered empty state names the excluding facet; the shared EmptyState component does not

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

## 3. Grid speaker-name text is 18px, frame draws 16px

Frame :129 (`Speakers` 1600 grid) name link:
`<a href="#" style="font-family:'Familjen Grotesk', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em; color:#1B1D17">{{ row.name }}</a>`

The app renders the name via the shared `.chq-row-title` class
(`app/src/styles.css:559`, `font-size: 18px; font-weight: 600;`) — weight
matches (600, confirmed NOT inverted relative to the status pill's 800, see
fixed finding (a) below), but the size is 18px not 16px. `styles.css` is
shell-lane-owned this wave (explicitly out of scope for `w1-b`), so this is
left for that lane to reconcile — flagging rather than touching the file.

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
