# Portal SSR 390 -- 'Your tasks' & 'Resources' audit (w31-g)

Companion to `test/portal-tasks-resources-390-frames.test.ts` (DEC-976
wave-31 SSR unit; harness copied verbatim from
`test/portal-390-frame-verdicts.test.ts`). Every citation below is checked
byte-for-byte at test-assert time by that file's `verbatimLine()`.

## Frame `docs/design/Chautauqua Public and Portal.dc.html:476-496` -- 'Portal · Your tasks'

Route: `GET /portal/tasks` (`src/routes/portal/tasks.tsx`, view
`TasksPage` in `src/routes/portal/tasks/views.tsx`).

8 drawn (non-template) literals, in frame order:

| # | Line | Literal / placeholder | Verdict |
|---|------|------------------------|---------|
| 1 | :478 | `‹ Your portal` (44px back link) | MATCHES -- `<a href="/portal" class="chq-portal-back">‹ Your portal</a>`, `.chq-portal-back { min-height: 44px }` |
| 2 | :479 | `Your tasks` (h1) | MATCHES -- `<h1 class="chq-portal-hero chq-portal-hero-drill">Your tasks</h1>` |
| 3 | :485 | `{{ t.title }}` | SHAPE-ASSERTED (DEC-967: template, never pinned) -- `.chq-portal-row-title` renders each assignment's real title |
| 4 | :486 | `{{ t.state }}` | SHAPE-ASSERTED -- rendered as a `.chq-flag` chip ("To do" / "Overdue" / "Done"), not a bare string |
| 5 | :488 | `{{ t.due }}` | ABSENT-BY-FIXTURE, not a divergence -- both seeded assignments carry `dueDate: null`; DEC-826's effective-due computation legitimately renders no `.chq-portal-due` line for either row. A seeded due date would render one; not exercised here because neither fixture assignment has one. |
| 6 | :489 | `{{ t.btn }}` | SHAPE-ASSERTED -- each row's per-kind action control (`Mark complete` for the general row, `Fill out form` for the form row) matches the frame's "action button stack" anatomy |
| 7 | :493 | `Mark the release signed` (dock PRIMARY) | DIVERGES on literal text, MATCHES on control identity/geometry -- see DEVIATIONS §6 discussion below. The dock renders `Mark complete`, the real next-incomplete task's own control (reused, not duplicated), inside `.chq-portal-dock .chq-btn-primary` (48px) |
| 8 | :494 | `Later` (dock SECONDARY, bordered) | BLESSED OMISSION (DEVIATIONS §6 / DEC-967 wave-106, honoured per this task's DEC-576 tie-break) -- never rendered, at any task-list state |

**5 of 8 asserted** (rows 1, 2, 3, 4, 6): exact-literal for 1-2, shape for
3-4-6. Row 5 is a real fixture-state absence, not asserted either way. Row 7
is asserted for geometry/identity but explicitly NOT for its literal text.
Row 8 is asserted as a permanent absence (blessed omission), not as a
rendered literal.

### DEVIATIONS §6 tie-break (DEC-576 wave-31)

DEVIATIONS.md §6 "Portal task-list dock 'Later'" (DEC-967 wave-106) rules
the dock's GEOMETRY legitimate for whatever primary the page already
renders. `tasksPageDockPrimary()` (`src/routes/portal/tasks/views.tsx:439`)
resolves the frame's single pinned action to the first not-complete
assignment's own existing control -- reused, not duplicated content -- and
renders nothing when that control is a multipart file-upload form or when
every task is complete. Grepping `src/routes/portal/**` and
`src/server/repo/portal*` confirms no snooze/defer/dismiss verb exists
anywhere in the portal task model (`status` is `pending | complete` only) --
so the frame's "Later" secondary names a real, permanent domain gap and is
never manufactured to fill the band. This audit row is the record of that
gap; the DEVIATIONS.md entry itself is not touched (out of scope, hard-ban).

## Frame `docs/design/Chautauqua Public and Portal.dc.html:1561-1583` -- 'Portal · Resources'

Route: `GET /portal/resources` (`src/routes/portal/tasks/resources.tsx`,
view `ResourcesPage` in `src/routes/portal/tasks/views.tsx`).

7 drawn (non-template) literals, in frame order:

| # | Line | Literal / placeholder | Verdict |
|---|------|------------------------|---------|
| 1 | :1563 | `‹ Your portal` (44px back link) | MATCHES |
| 2 | :1564 | `Resources` (h1) | MATCHES -- `<h1 class="chq-portal-hero chq-portal-hero-drill chq-portal-resources-hero">Resources</h1>` |
| 3 | :1565 | `The same for every speaker · nothing here is about your session` (subtitle) | MATCHES -- `<p class="chq-portal-sub">...</p>`. DEC-029 rules this real product copy (keeps a speaker from reading a shared, organiser-wide resource as personal), not sample data |
| 4 | :1572 | `{{ r.name }}` | SHAPE-ASSERTED (template, never pinned) -- `.chq-portal-row-title` renders each resource's real title |
| 5 | :1573 | `{{ r.detail }}` | SHAPE-ASSERTED, but not independently exercised by this test -- `ResourcesPage` has no separate one-line detail span; a wiki-kind row instead renders its full body inline (`.chq-portal-detail`, markdown-rendered) where the frame's `{{ r.detail }}` placeholder would sit. Recorded as a template-shape row, not pinned; the underlying per-kind body-vs-detail split is unfixable from this task's files (view logic already in scope was not touched beyond the pre-existing "Open" label) |
| 6 | :1575 | `Open` (44px row control, file-kind rows) | MATCHES -- `<a ... class="chq-btn chq-btn-secondary">Open</a>`, `min-height: 44px`. Confirmed NOT "Download" (DEC-029: the same route serves inline wiki resources and streamed file resources, so "Download" would be a lie on half the population) |
| 7 | :1581 | `Questions? Reply to any of our emails.` (undocked footer note) | MATCHES -- `<span class="chq-portal-resources-footer-note">...</span>`, and no `.chq-portal-dock` renders on this page at all, matching the frame's own undocked footer band |

**5 of 7 asserted** (rows 1, 2, 3, 6, 7), all exact-literal matches; the two
template placeholders (rows 4, 5) are graded by shape only, per DEC-967.

## Unfixable findings (index.tsx / shared.tsx / portal.css.ts) -- DIVERGES

None of the divergences found for these two frames trace to
`src/routes/portal/index.tsx`, `src/routes/portal/shared.tsx`, or
`src/routes/portal/portal.css.ts` -- the dock's `Later`-shaped gap (row 8
above) is a portal *task-model* gap (no snooze/defer verb in the repo terms
service), already recorded as a blessed omission, not a fixable code
divergence in any file this task could touch. No further DIVERGES rows are
recorded for this pair of frames.
