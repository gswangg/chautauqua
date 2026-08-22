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

## FINDING (not fixed — out of this task's scope)

**The §01 row's field grouping diverges from the frame's line pairing, and
no CSS-only fix inside `overview.css`'s terminal `@media (max-width:700px)`
block can repair it.**

The frame draws two lines per overdue-task row:

1. `{{ row.name }}` beside `{{ row.late }}` (same line, space-between)
2. `{{ row.task }} · {{ row.company }}` (next line, one joined string)

`Overview.tsx` (lines ~347-370) instead renders two anonymous wrapper
`<div>`s with no class hooks:

1. `contactName` + `company` (a name/company pair)
2. `taskTitle` + `daysLateLabel(...)` (a task/lateness pair)

So the real DOM/reading order at 390 (where `.chq-overview-row-overdue`
collapses to a single grid column, per `overview.css`) is: **name, company,
task, lateness marker, Remind, Mark complete** — not the frame's **name,
lateness marker, task · company, Remind, Mark complete**. All four fields
are present and none is invented or missing; only the pairing/order
diverges, and `{{ row.task }} · {{ row.company }}` never renders as one
joined string (it's two separate text nodes in two different wrapper
`<div>`s).

This task's OWNS list permits touching `overview.css` only inside its
terminal max-width block. A CSS `order` reflow can reorder whole grid
*items*, but the two mis-paired fields (company vs. task) sit inside the
*same* anonymous wrapper `<div>` as their line-mate, so no selector exists
to move one field independently of its sibling — the fix needs a
`Overview.tsx` JSX restructure (new class hooks separating name+late from
task+company), which is out of this task's scope. `Overview.frame390.render.test.tsx`'s
row-template test asserts the TRUE current DOM order (a truthful verdict,
not the frame's aspirational one) and its own comment block carries this
same writeup inline. Recorded here for a future task to pick up.
