# Overview · 390 verdict (task w29-f)

Frame: `docs/design/Chautauqua Overview.dc.html:190` (extent 190 through the
end of the phone frame's tabbar, i.e. up to the next frame's "Modal" label
at :299). The pack's only Overview phone frame.

New markup instrument: `app/src/pages/overview/Overview.frame390.render.test.tsx`
(6 tests, all green). Before this file, 17 of the frame's 28 drawn strings
were asserted by no markup instrument at all —
`app/src/pages/overview/Overview.phone.render.test.tsx` only carried the
DEC-833 section-label register (four `NN — <label>` desktop/phone pairs)
and the two phone-only-hook CSS contracts (`.chq-overview-btn-waitlist`,
`.chq-overview-link-btn-read`). The headline, the §01 bulk-remind block,
every row template's field-by-field content, and §02's "All N" disclosure
had no citer anywhere in the tree.

## Now instrumented

- Five `.chq-overview-section` elements render in the frame's DOM order
  (§01 Overdue → §02 Triage → §03 Content → §04 Agenda → No action needed).
- :211/:235/:253/:270 each numbered section's `NN — <phone label>` eyebrow
  (desktop form on its sibling span, per DEC-833) — reuses the same register
  Overview.phone.render.test.tsx already carries, now scoped per-section in
  DOM order rather than as a flat NodeList.
- :207 the attention lede — graded by shape (`/^\w+ things? needs? your
  attention$/`), not the frame's sample "Four" (DEC-967 wave-29): this
  file's own fixture totals compute a real, non-"Four" count, proving the
  shape assertion isn't accidentally echoing the frame's literal.
- :215/:216 the §01 bulk-remind control (`Remind all <n>`) and its caption
  ("Skips anyone reminded in the last hour"), asserted as adjacent siblings
  inside §01's header block.
- :221-:226 the §01 row template's four fields (name, lateness marker, task,
  company) and both per-row actions (Remind, Mark complete), in the frame's
  own DOM order — see RESOLVED below.
- :236 the §02 "All N" disclosure, graded by shape (`/^All \d+$/`).

## RESOLVED (DEC-720 wave-22 amendment — was FINDING, not fixed)

**The §01 row's field grouping now matches the frame's line pairing.**

The frame draws two lines per overdue-task row:

1. `{{ row.name }}` beside `{{ row.late }}` (same line, space-between)
2. `{{ row.task }} · {{ row.company }}` (next line, one joined string)

`Overview.tsx` used to render two anonymous wrapper `<div>`s with no class
hooks — `contactName` + `company` on one line, `taskTitle` +
`daysLateLabel(...)` on the other — which hard-coded the desktop pairing
into the DOM and made the frame's own grouping unreachable by any selector.

The fix: `Overview.tsx` now renders four directly-classed spans
(`.chq-overview-row-name`, `.chq-overview-row-late`,
`.chq-overview-row-task`, `.chq-overview-row-company`) as direct children of
`.chq-overview-row-overdue`, no wrapper `<div>`s, in the frame's own reading
order — name, late, task, company, then the Remind/Mark-complete actions.

Desktop keeps its original visual pairing (name above company, task above
late) without depending on that DOM order: `overview.css`'s
`.chq-overview-row-overdue` places all four hooks with explicit
`grid-column`/`grid-row` — decoupled from source order, so the desktop frame
never moved.

Inside `overview.css`'s ONE terminal `@media (max-width: 700px)` block, the
row switches from the desktop grid to a wrapping flex row: name and late
share line 1 (late pushed to the line's end via `margin-left: auto`,
reproducing the frame's `justify-content: space-between` for exactly that
pair); task forces a new flex line via the standard `flex-basis: 100%`
break trick; company immediately follows task on that same line with a
generated `.chq-overview-row-company::before { content: ' · '; }`
separator, so line 2 reads as the frame's single joined "task · company"
string with no CSS `gap` inserted between the two.

`app/src/pages/overview/Overview.frame390.render.test.tsx`'s row-template
test now asserts the frame's element ORDER via `compareDocumentPosition`
(not mere field presence), plus a CSS-shape case reading the terminal phone
block's `display: flex`, `flex-basis: 100%` and `::before` declarations
directly from `overview.css`.
