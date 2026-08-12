# 2026-08-12 task-w12-a — render-sweep mobile-overflow instrument correction (DEC-424)

Full detail for the `## 2026-08-12 task-w12-a — render-sweep mobile-overflow instrument correction (DEC-424)` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

Full transcripts in
`docs/verification-log/task-w12-a-render-sweep-overflow.md`.

Corrected `visitMobileRoute`'s (DEC-401) in-page overflow measurement per
DEC-424: elements deliberately held inside a horizontal scroller (an
ancestor with `overflow-x: auto|scroll`, DEC-414's remedy) are now excluded
from both `maxElementRight` and `overflowOffenders`; when the page's
`scrollWidth` itself overflows the viewport but no single element's
`rect.right` crossed the viewport edge, up to 3 visible non-scroller-held
elements whose own `el.scrollWidth > el.clientWidth` are named instead,
sorted by spill magnitude. `npm run build` and `npm test --silent` green
(2209 tests, 2 new DEC-424 unit tests in `test/render-sweep-lib.test.ts`).

Two full `npm run gate:render-sweep` runs. Reading 1 (instrument fix only):
desktop 42/42, public/portal mobile (blocking) 21/21, admin mobile
(advisory) 19/20 — 5 of wave 10's 6 admin FAILs now PASS under the
corrected exclusion; the 6th
(`/admin/review/plans/seed_evaluation_plan_0001/results`) still FAILs but
now names its offender (`div.chq-section-head spill=59px`, DEC-424 (3)
working as intended) instead of the empty-offender-list blind spot wave 10
reported. Root cause: the shared `.chq-section-action` class
(`app/src/styles.css`) is `white-space: nowrap`, appropriate for its usual
short-label use, but this page's one instance carries a full sentence.
Fixed per DEC-414's remedy (wrap, not `overflow:hidden`, no shell edit,
DEC-368): added a page-owned `chq-review-results-note` class in
`app/src/pages/review/review.css`, layered onto the span alongside
`chq-section-action` in `ResultsTable.tsx`. Reading 2 (post-fix): admin
mobile 20/20 — all previously-failing routes now PASS.
`ADMIN_MOBILE_PASS_BLOCKING` and `FONT_FLOOR_BLOCKING` both left `false`,
unflipped (out of this task's scope per (7)).

RESULT: PASS — instrument corrected and unit-tested; all 6 of wave 10's
admin-mobile FAILs now resolved (5 were instrument false-positives, 1 was a
genuine page bug now fixed).
