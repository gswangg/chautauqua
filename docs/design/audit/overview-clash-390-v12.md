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

## MATCHES — §04's phone eyebrow line is one joined string (task w11-ta, DEC-919)

**Frame**: `docs/design/Chautauqua Overview.dc.html:274` —

```
<span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase">Tue 12, 10:00 · Room 2A</span>
```

One eyebrow span joins the weekday/day/time and the room into a single `·`
-separated string.

**What this task did**: added a `hidden` phone-only sibling node
(`.chq-overview-clash-eyebrow-phone`) alongside the existing
`.chq-overview-row-title.chq-overview-row-title-sm` /
`.chq-overview-row-meta` desktop pair — same two-node idiom as the clash
sentence above, joined with a template literal (day/time already come from
two adjacent JSX expressions in this file; the room is a third, joined with
`·`, no `joinSegments` — the task's own instruction). Wrapped the desktop
pair in `.chq-overview-clash-eyebrow-group` so overview.css's terminal
`@media (max-width: 700px)` block can hide only its two direct children
(`.chq-overview-clash-eyebrow-group > .chq-overview-row-title-sm` /
`> .chq-overview-row-meta`) — `.chq-overview-row-meta` is shared by three
other, unrelated nodes in this file (the unplaced row's meta line, the
clash entries' desktop byline, and the clash sentence's own muted tail), so
a bare-class hide would have broken them; the child-combinator scopes the
hide to just this pair. Reveals `.chq-overview-clash-eyebrow-phone` with the
frame's exact face (`font-size:10px; font-weight:800; letter-spacing:0.1em;
text-transform:uppercase`). Hidden at CSS top level with the same
leak-guard idiom as `.chq-overview-clash-line-phone`. Desktop bytes above
the terminal block are untouched.

**Render receipt**: `AgendaWorkSection.clash390-eyebrow.render.test.tsx` —
mounts `AgendaWorkSection` with a conflict row, asserts exactly one
`.chq-overview-clash-eyebrow-phone` per conflict row and its joined text
shape, that the desktop title/meta pair is still present (jsdom applies no
`@media`, scoped with `within` per DEC-874), and source-scans `overview.css`
to assert the new rules live only inside the terminal
`@media (max-width: 700px)` block, never at top level.

## MATCHES — the resolution action button is a filled pill at 390 (task w11-ta, DEC-919)

**Frame**: `docs/design/Chautauqua Overview.dc.html:276` draws the
resolution action as a filled, centered, rounded pill:
`background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px;
display:flex; align-items:center; justify-content:center; font-size:13px;
font-weight:700` ("Move DFC-047 to 11:30").

**What this task did**: added a modifier class
(`chq-overview-clash-resolve`) to THIS button only — the shared
`.chq-overview-link-btn` register (Remind / Mark complete / Open / Read the
abstract) keeps its borderless styling everywhere else, unrestyled. Inside
overview.css's terminal `@media (max-width: 700px)` block,
`.chq-overview-link-btn.chq-overview-clash-resolve` sets `background:
var(--chq-brand)` and `color: var(--chq-on-brand)` — the exact tokens for
`#4E5C31`/`#F7F9F0` (`app/src/styles.css`), no new colour literal
(`app/src/css-contract.scan.test.ts` resolves every var and grades button
faces). `min-height:44px; display:flex; align-items:center;
justify-content:center` and `border-radius:6px` already come from the
shared class's own existing terminal-block and former-464-block
declarations (`--chq-r-ctl-phone` resolves to `6px`), so only the fill is
added here.

**Render receipt**: `AgendaWorkSection.clash390-eyebrow.render.test.tsx` —
asserts the button carries both `chq-overview-link-btn` and
`chq-overview-clash-resolve`, that no top-level rule or `#4E5C31`/`#F7F9F0`
literal exists outside the terminal block, and that the phone rule sets the
fill via `var(--chq-brand)`/`var(--chq-on-brand)`.
