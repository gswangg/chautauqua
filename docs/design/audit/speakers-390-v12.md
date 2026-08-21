# Speakers 390 v12 frame-verdict audit (task w31-a, DEC-976 wave-31)

Receipt for `app/src/pages/speakers/Speakers.frame390.render.test.tsx`,
covering `docs/design/Chautauqua Speakers.dc.html:133-181` ("Speakers",
matrix becomes one card per speaker) and `:260-282` ("Roster · 390"). Prior
to this task both frames were cited only by product source and
`app/src/pages/Speakers.frame-verdicts.render.test.tsx`'s shallow verdict
(entered through `SpeakersPage`, structure only — no dock-scoped
control-order or 44px-floor CSS receipt). This task mounts the REAL screens
directly instead: `OnboardingGrid` for `:133`, and `RosterPanel.tsx`'s
exported `RosterDrillIn` for `:260` — the same standalone-mount shape
`OnboardingGrid.render.test.tsx` already uses, never a second mock stack
(DEC-663).

Scope for this task: CREATE
`app/src/pages/speakers/Speakers.frame390.render.test.tsx` and this file.
MAY FIX only `app/src/pages/speakers/RosterPanel.tsx` and
`app/src/pages/speakers/speakers.css` (its single terminal
`@media (max-width: 700px)` block). Neither needed a change: both frames'
drawn markup, control order and 44px floor already match, verified by the
new render receipt.

## DIVERGES (not-owned): wordmark row and five-item tab band are shared App-shell chrome

Frame `:133` draws a wordmark row (`docs/design/Chautauqua
Speakers.dc.html:136` `chautauqua` + event-name span) above the page head,
and a five-item bottom tab band (`:173-180`, `sc-for list="{{ tabs }}"`)
below the card list. Neither is drawn by
`app/src/pages/speakers/OnboardingGrid.tsx` — both are rendered by
`app/src/App.tsx` (the header's `<span className="chq-wordmark">chautauqua</span>`
at `App.tsx:228`, and the `<nav className="chq-tabbar">` band built from
`primaryTabs` at `App.tsx:329` onward). `App.tsx` is not in this task's MAY
FIX list (HARD BAN: "any other file"), and mounting it alongside
`OnboardingGrid` to reach that chrome would be exactly the "second,
page-spanning mock stack" DEC-663 warns against for a task that was never
asked to build one.

This is cross-cutting chrome, not a Speakers-cluster defect: the same
wordmark header and `.chq-tabbar` band render identically on every 390
landing frame in the pack (DEC-381/DEC-576 govern the tab band globally —
see `app/src/styles.css:2570-2581`'s "a docked drill-in and the bottom tab
bar are never both on screen" ruling, which is what correctly suppresses
the band on the `:260` Roster drill-in via
`.chq-shell:has(.chq-phone-dock) .chq-tabbar { display: none; }`). Its own
receipts live in `app/src/App.render.test.tsx`,
`app/src/shell-geometry.test.ts` and
`app/src/phone-dock-declares.scan.test.ts`, not in a per-cluster file. No
file this task may touch can fix or usefully re-assert this; recorded here
as a DIVERGES(not-owned) row per this task's instructions, not a gap in the
new receipt.

- Frame line: `docs/design/Chautauqua Speakers.dc.html:136-137` (wordmark +
  event name), `:173-180` (five-item tab band).
- Drawn value: wordmark row and tab band inside the same 390 frame as the
  Speakers content.
- Shipped value: rendered by `app/src/App.tsx`'s shared shell (header +
  `.chq-tabbar`), a sibling of the routed page content, not by
  `OnboardingGrid.tsx`.
- File that would have to change: `app/src/App.tsx` (out of this task's
  scope; HARD BAN "any other file").

## MATCHES: `:133` "Speakers" landing

Every element `OnboardingGrid.tsx` itself draws in the frame extent matches,
in drawn order, verified by
`Speakers.frame390.render.test.tsx`'s first `it()`:

- `:139` H1 "Speakers" — exactly one `<h1>`, shared by desktop and phone
  (DEC-662).
- `:140` "N accepted · N overdue" summary, shape-graded (DEC-967), after the
  H1.
- `:142`/`:143` phone-only "Remind outstanding" (filled, primary,
  min-height:44px) then "Filter" (bordered, secondary, min-height:44px),
  scoped to `.chq-speakers-phone-head-actions`, after the summary.
- `:151`/`:152`/`:153` per-card name / meta / invite chip (with its `▾`
  affordance, rendered as `ParticipationMenu`'s real trigger button), in
  order, inside `.chq-speakers-cards .chq-speakers-card`.
- `:158`/`:160` per-task label row (`.chq-speakers-card-task`, task title +
  `.chq-speakers-status` control), after the invite chip.
- `:166`/`:167` trailing "Remind"/"Open profile" 44px pair
  (`.chq-speakers-card-actions`), after the task rows.

44px floor: both the phone head-actions row and the card-actions row are
composition-exempt (DEC-393 wave-120 shape 3 — every child is already a
floored `.chq-btn`, pinned in `speakers.css`'s terminal block by the
"tap-floor-exempt: composition" comments at `speakers.css:1944-1950` and
`speakers.css:1981-1987`). The new receipt's second `it()` pins that
composition comment text and the `flex: 1` stretch rule so a silent strip of
either would surface as a diff.

## MATCHES: `:260` "Roster · 390"

Every element `RosterPanel.tsx`'s exported `RosterDrillIn` draws in the
frame extent matches, in drawn order, verified by
`Speakers.frame390.render.test.tsx`'s second `it()`:

- `:262` "‹ Speakers" back link, 44px-floored (`.chq-phone-back`, shared
  class, `app/src/styles.css:2597-2605` — out of this task's file scope but
  unchanged and correct), first in the head.
- `:263` H1 "Roster", after the back link.
- `:264` "N accepted · N not claimed" summary, shape-graded, after the H1.
- `:270`-`:274` per-row name / meta / invite chip (with `▾`), then the
  trailing bordered 44px "Open" link, in `.chq-speakers-roster-row`.
- `:279`/`:280` footer dock: primary "Add a speaker" (flex:1, filled, 48px)
  then secondary "Import CSV" (bordered, 48px), inside `.chq-phone-dock`,
  after every row.

44px floor: `.chq-speakers-roster-open` declares no competing min-height in
`speakers.css`'s terminal block (bare `flex-shrink: 0`), so it inherits the
shared `.chq-btn` family's floor rather than risking a lower override
winning the cascade — pinned by the new receipt's fourth `it()`.

## Already-blessed, not re-litigated here

DEVIATIONS §1 (`docs/design/Chautauqua Speakers.dc.html:549`, "a write
failed") is RULED STALE per DEC-650 — the landed inverted
`.chq-speakers-status-*` vocabulary wins; this task's receipt does not grade
against that frame line. DEVIATIONS §7 blesses the phone-only "Roster ›"
trigger (`OnboardingGrid.tsx:1059-1067`) as scaffolding the frame draws no
control for but which is required to reach the drawn `:260` destination —
already covered by the existing
`app/src/pages/Speakers.frame-verdicts.render.test.tsx` verdict; this task's
new receipt mounts `RosterDrillIn` directly rather than re-testing the
trigger.

## Pre-existing, out-of-scope failure observed while running targeted tests

`test/citation-form-drift.scan.test.ts`'s ratchet test fails on `main`
(HEAD `cc12730f`, unmodified) with 5 offenders, all inside
`src/decisions-data/*.md` (`DEC-393.md`, `DEC-509.md`, `DEC-651.md`, two in
`DEC-808.md`) — none touch the Speakers cluster and `src/decisions-data/**`
is this task's HARD BAN. Reproduced on a clean worktree before any change in
this task landed; not this task's regression, not fixed here.
