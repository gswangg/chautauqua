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
- :221-:226 the §01 row template's four fields (name, company, task,
  lateness marker) and both per-row actions (Remind, Mark complete), in
  their real DOM order — see the divergence finding below.
- :236 the §02 "All N" disclosure, graded by shape (`/^All \d+$/`).

## RESOLVED (DEC-385 wave-20, task w20-a)

**The §01 row's field grouping now matches the frame's line pairing at 390;
desktop keeps its own two-column table shape unchanged.**

The frame draws two lines per overdue-task row:

1. `{{ row.name }}` beside `{{ row.late }}` (same line, space-between)
2. `{{ row.task }} · {{ row.company }}` (next line, one joined string)

`app/src/pages/Overview.tsx` previously rendered two anonymous wrapper
`<div>`s pairing `contactName`+`company` and `taskTitle`+`daysLateLabel(...)`,
so the real DOM/reading order at 390 was name, company, task, lateness
marker — not the frame's name, lateness marker, task · company. The fix:
the two wrappers gained real class hooks
(`chq-overview-row-overdue-who`/`chq-overview-row-overdue-what`), the
classless `taskTitle` node gained its own class
(`chq-overview-row-task`), and Overview.tsx now also renders one new
phone-only sibling carrying the joined string
`` `${row.taskTitle} · ${row.company}` `` as a single text node
(`chq-overview-row-overdue-line-phone`) — every existing node stays in
place, nothing reordered or deleted in the DOM.

`app/src/pages/overview/overview.css`'s terminal `@media (max-width: 700px)`
block sets `display: contents` on the two wrappers so their children become
direct grid items of `.chq-overview-row-overdue`, hides the now-superseded
company and task nodes (each carrying a `phone-hidden:` receipt), reveals
the joined line, and orders the items name, lateness, joined-task-line,
actions via the CSS `order` property. A single top-level
`display: none` leak-guard on `.chq-overview-row-overdue-line-phone`
(same idiom as `app/src/pages/agenda/agenda.css`'s `.chq-phone-slot-*`
list) keeps the new node off desktop, so desktop paint stays
byte-identical and `app/src/pages/Overview.desktop-frame-verdicts.render.test.tsx`
is unchanged.

`app/src/pages/overview/Overview.frame390.render.test.tsx`'s row-template
case now asserts the frame's order: name, lateness marker, the joined line
as one text node (`Node.TEXT_NODE`, not split across elements), then
Remind/Mark complete.
