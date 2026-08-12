# task-w9-g — admin SPA phone overflow (DEC-414)

Re-measured all 20 `ADMIN_MOBILE_ROUTE_MANIFEST` routes (`app/src/routeManifest.ts`'s
organizer/reviewer entries, `/admin/*` catch-all excluded) at 390x844 with a
throwaway Playwright script (scratchpad only, never committed — booted a fresh
`wrangler dev` against a freshly migrated + seeded local D1/R2, logged in as
the organizer and reviewer personas from `docs/fixtures/sample-data.json` via
the real `/login` form, applied the DEC-411 `__name` keepNames shim to every
page before `evaluate`). For each route recorded
`document.scrollingElement.scrollWidth`, the max visible element's right
edge (`rect.right`, `offsetParent !== null` filter), and that widest
element's tag + first three classes — the same three numbers
`scripts/render-sweep.ts`'s `evaluateMobileRoute` computes.

## Before (measured fresh; this is also the after — see Findings)

| role | route | scrollWidth | maxElementRight | widest element |
|---|---|---|---|---|
| organizer | /admin/overview | 390 | 436 | a.chq-overview-deadline-cell w=111 |
| organizer | /admin/submissions | 390 | 507 | button.chq-pill w=76 |
| organizer | /admin/submissions/forms | 390 | 428 | button.chq-pill w=151 |
| organizer | /admin/submissions/seed_submission_0001 | 390 | 390 | div |
| organizer | /admin/speakers | 390 | 390 | div |
| organizer | /admin/content | 390 | 392 | button.chq-pill w=82 |
| organizer | /admin/agenda | 390 | 542 | span.chq-agenda-clash-note w=221 |
| organizer | /admin/comms | 390 | 390 | div |
| organizer | /admin/contacts | 390 | 390 | div |
| organizer | /admin/settings | 390 | 390 | div |
| organizer | /admin/review | 390 | 390 | div |
| organizer | /admin/review/plans/new | 390 | 390 | div |
| organizer | /admin/review/plans/seed_evaluation_plan_0001 | 390 | 390 | div |
| organizer | /admin/review/plans/seed_evaluation_plan_0001/progress | 390 | 390 | div |
| organizer | /admin/review/plans/seed_evaluation_plan_0001/results | **415** | 390 | div (unresolved — see Findings) |
| reviewer | /admin/review | 390 | 390 | div |
| reviewer | /admin/review/plans/seed_evaluation_plan_0001 | 390 | 390 | div |
| reviewer | /admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 | 390 | 390 | div |
| organizer | /account/password | 390 | 390 | div.chq-auth-card.chq-auth-card-narrow |
| reviewer | /account/password | 390 | 390 | div.chq-auth-card.chq-auth-card-narrow |

## Findings

**The two DEC-414-named offenders are already closed.** /admin/comms (old
reading: 131px, `.chq-step` inside `.chq-steps`) now measures 390/390 — closed
by app/src/styles.css's existing phone rule stacking `.chq-steps` to
`grid-template-columns: 1fr` under `@media (max-width: 700px)`. /admin/submissions
(old reading: 40px, `.chq-submissions-filterbar`) now measures 390/390 at the
filterbar level — closed by submissions.css:436-446's existing
`.chq-submissions-filterbar .chq-status-pills { flex-wrap: nowrap; overflow-x:
auto; ... > * { flex-shrink: 0; } }` rule. Both fixes predate this task (an
earlier wave already applied DEC-404/405); this task's job was to verify, and
they verify closed. **No CSS change was needed or made in styles.css,
comms.css, or submissions.css this task** — I traced every offending
`maxElementRight` reading below to confirm none of them is a real,
un-scrollable document overflow that those files could close.

**Five routes show `maxElementRight` > 390 that are NOT real overflow —
they're elements scrolled out of the initial view inside an already-compliant
DEC-414 chip-strip** (`overflow-x: auto` + `flex-shrink: 0` children, exactly
the pattern DEC-414 prescribes as the fix). Traced each offender's ancestor
chain (computed styles) to confirm:

- `/admin/submissions` button.chq-pill (right=507): inside
  `div.chq-status-pills` (submissions.css, `overflow-x: auto` under the phone
  media query) inside `.chq-submissions-filterbar`.
- `/admin/submissions/forms` button.chq-pill (right=428): inside
  `div.chq-chipstrip` (shared, styles.css:534-543) inside
  `fieldset.chq-forms-settings-tracks` (forms.css, not my file, but the
  scrolling class itself is mine and correct).
- `/admin/content` button.chq-pill (right=392, 2px): same `div.chq-chipstrip`
  pattern.
- `/admin/overview` a.chq-overview-deadline-cell (right=436): inside
  `div.chq-overview-deadlines` (overview.css, `overflow-x: auto`) — not my
  file, but not broken either.
- `/admin/agenda` span.chq-agenda-clash-note (right=542): inside
  `div.chq-agenda-day-tabs.chq-chipstrip` — this element carries the SHARED
  `.chq-chipstrip` class (mine) directly on the agenda page's day-tabs row
  (`app/src/pages/Agenda.tsx:161`), so it's correctly using the shared
  scroll-strip pattern; `margin-left: auto` (agenda.css, not mine) just pushes
  the clash-note to the strip's scrolled-away end.

In every one of these five cases `document.scrollingElement.scrollWidth`
stays exactly 390 — the page itself never scrolls horizontally, and the
"offending" element is reachable by swiping the strip, which is precisely
what DEC-414's own text sanctions ("a region wider than the viewport gets
overflow-x: auto with flex-shrink: 0 children ... or it wraps"). The
`evaluateMobileRoute` gate's `max(scrollWidth, maxElementRight)` formula
(DEC-401, scripts/render-sweep-lib.ts, not my file) was written to catch
content clipped by an ancestor's `overflow: hidden` (permanently
unreachable); it does not currently distinguish that case from content
inside a legitimate `overflow-x: auto` scroller (reachable, just not in the
initial viewport). That's a instrument-precision gap in a file outside this
task's ownership (render-sweep-lib.ts), not a DEC-414 violation — flagging
for whichever lane owns that script next, since it will keep reporting these
five routes as advisory failures even though DEC-414 is satisfied.

**One route has a genuine, unresolved document-level overflow, and it's out
of this task's file scope.** `/admin/review/plans/seed_evaluation_plan_0001/results`
(the review results/export table, `app/src/pages/review/ResultsTable.tsx`)
measures `scrollWidth=415` (25px real page-level horizontal scroll) with no
single element's `maxElementRight` exceeding 390 — the leak isn't from one
element scrolled off in a chip-strip, it's a genuine document-width
overflow, but I could not isolate its DOM cause within this task's file
ownership (styles.css/theme.ts/comms.css/submissions.css do not touch the
Review area). This needs a follow-up task scoped to Review's own CSS
(review.css or wherever `ResultsTable.tsx` is styled) — not fixed here, not
mine to fix here.

## DEC-387 flip condition

**Not 20/20 by the automated gate's raw metric, but 19/20 have zero real,
reachable horizontal overflow.** `/admin/review/plans/.../results` (1 route)
has a genuine, un-owned 25px document overflow. The other 5 "advisory-fail"
routes are DEC-414-compliant chip-strips the gate's `maxElementRight` metric
can't currently distinguish from real clipping — a gate-instrument gap, not
a product bug. I have **not** flipped `ADMIN_MOBILE_PASS_BLOCKING` (not this
task's call regardless) and don't believe it should flip yet given the
results-page overflow is real and unowned by any wave-9 lane so far.
