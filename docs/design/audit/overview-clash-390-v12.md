# Overview §04 · 390 clash row — audit findings (wave 32, task w32-c)

Findings surfaced while building §04's clash row for 390 (Chautauqua
Overview.dc.html §04, "04 — Agenda"). v12m-w29-f instrumented §01/§02 only
and never reached §04, so nothing owned this frame before this task.

## RESOLVED — the clash sessions collapse to one joined sentence with a muted "share this slot" tail

**Frame**: `docs/design/Chautauqua Overview.dc.html:275` —

```
<span style="font-size:15px; line-height:1.5">Taming 40-Minute CI and Onboarding in 30 Minutes <span style="color:#565A4B">share this slot</span></span>
```

The clashing session titles run together into one sentence joined by
`and`, followed by a muted `share this slot` tail. `grep -rn "share this
slot" src app` returned zero on main before this task. The built row
(`AgendaWorkSection.tsx`, the `payload.agendaWork.conflicts.map` branch)
instead emitted one `<div>` per entry, each `{entry.title} <span
className="chq-overview-row-meta">— {joinSegments([...])}</span>` — no
"share this slot" copy anywhere, and no single joined sentence.

**What this task did**: added a phone-only sibling node
(`.chq-overview-clash-line-phone`, `hidden` at the JSX level) next to the
existing per-entry list, joining every entry's title with `" and "` (never
hard-coded to two — DEC-180: a conflict can carry three or more entries;
the frame's two is sample data) followed by the muted `share this slot`
tail. Wrapped the existing per-entry desktop list in a new
`.chq-overview-clash-entries-desktop` class (no top-level styling change —
the wrapper carries no rule at top level). In `overview.css`'s terminal
`@media (max-width: 700px)` block (opens :534, runs to EOF — the ONLY block
in the file), added the reveal/hide pair: `.chq-overview-clash-entries-desktop
{ display: none }` and `.chq-overview-clash-line-phone { display: block;
font-size: 15px; line-height: 1.5 }` — the same two-node idiom this file
already ships for `.chq-overview-overflow` /
`.chq-overview-overflow-link` (hidden top-level default, revealed only in
the terminal block). Desktop bytes above the terminal block are untouched.

Reused the file's existing `DEC_919` import (no new decision reference
needed — DEC-919's wave-32 amendment already names this exact gap) and the
file's own join style (`.map(...).join(...)`) rather than `joinSegments`,
since `joinSegments` joins with `' · '` and this frame line joins with the
word `and`, a different vocabulary.

**Render receipt**: `AgendaWorkSection.clash390.render.test.tsx` — mounts
`AgendaWorkSection` with both a 2-entry and a 3-entry conflict, asserts the
phone node exists exactly once per conflict row, names every entry title
(proving the 3-entry row isn't truncated to two), ends in "share this
slot", that the desktop per-entry nodes are still present in the DOM
(jsdom applies no `@media`, scoped with `within` per DEC-874), and that
both new CSS rules live only inside the terminal `@media (max-width:
700px)` block, never at top level.

## DIVERGES — §04's phone eyebrow line is one joined string; the built row splits it into two divs

**Frame**: `docs/design/Chautauqua Overview.dc.html:274` —

```
<span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Tue 12, 10:00 · Room 2A</span>
```

One eyebrow span joins the weekday/day/time and the room into a single `·`
-separated string (`Tue 12, 10:00 · Room 2A`).

**Built anatomy** (`AgendaWorkSection.tsx`, unchanged by this task —
outside the owned-files scope, which covers only the clash-line phone node
and its CSS pair): two separate `<div>`s — `.chq-overview-row-title
.chq-overview-row-title-sm` (`{formatDayLabel(conflict.day)}, {clockHHMM
(conflict.startMin)}`) and `.chq-overview-row-meta`
(`{publicRoomLabel(conflict.roomName)}`) directly beneath it. No CSS in
this file collapses the two into one line, and no phone-only override
exists for this pair — the split is identical at 1600 and 390.

**Why not fixed here**: this task's owned files are `AgendaWorkSection.tsx`
and `overview.css` (terminal block only), and its scope is the clash row's
sessions/tail (DEC-919 wave-32 amendment) — the eyebrow is a distinct
anatomical element the task instructions explicitly asked to be recorded,
not fixed, in this pass. Left as a DIVERGES row for a future task.

## DIVERGES — the resolution action button's frame styling (fill/shape) vs the built `.chq-overview-link-btn`

**Frame**: `docs/design/Chautauqua Overview.dc.html:276` draws the
resolution action as a filled, centered, rounded pill:
`background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px;
display:flex; align-items:center; justify-content:center; font-size:13px;
font-weight:700` ("Move DFC-047 to 11:30"). The built `<button
className="chq-overview-link-btn">` (unchanged, outside this task's owned
files) is not graded here — this row is a citation only, filed because the
clash-row rebuild above touches the same visual cell; the button's own
styling was not part of the owned-file diff and is left for a task that
owns the button's CSS.
