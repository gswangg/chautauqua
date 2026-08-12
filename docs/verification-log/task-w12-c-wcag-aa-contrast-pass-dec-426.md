# 2026-08-12 task-w12-c — WCAG AA contrast pass (DEC-426) @ 0022580

Full detail for the `## 2026-08-12 task-w12-c — WCAG AA contrast pass (DEC-426) @ 0022580` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

Added the WCAG AA contrast render-sweep pass per DEC-426: new
`scripts/render-sweep-contrast.ts` (pure luminance/ratio math + PASS/FAIL
evaluation/formatting, unit-tested in
`test/render-sweep-contrast.test.ts` — 12 tests, including pinned
`relativeLuminance`/`contrastRatio` values: `#000000` on `#ffffff` = 21:1,
the palette's `muted` `#565A4B` on `paper` `#F4F1E8` clears 4.5:1,
`#FFFFFF` on `#FFFFFF` = 1:1), plus a small addition to
`scripts/render-sweep.ts` (import block, `measureContrast(page)` helper
next to the DEC-421 `measureFontFloor`, a call inside the desktop
`visitRoute` after the DEC-411 keepNames shim, and a fourth results table
in `main()`).

Advisory: `CONTRAST_BLOCKING = false` (DEC-387 flip rule, first reading —
not flipped true by this task). Desktop-pass only, same convention as
DEC-421 reusing `visitRoute`'s existing page visits rather than a new
route list.

`npm run gate:render-sweep` ran clean end to end
(`gate:render-sweep OK`, exit 0 — the two blocking passes, desktop route
sweep 31/31 and public/portal mobile sweep 14/20 pre-existing unrelated
overflow FAIL, both passed as before). New contrast table: 35/42 desktop
routes PASS. The 7 FAILs are two distinct real findings (not
instrument-blocked): `td.chq-forms-field-drag` on
`/admin/submissions/forms` at 1.80:1 (border-token text on paper), and
`span.chq-pub-track-chip` on 6 public/embed routes at 3.00-3.10:1 (chip
text on amber/green backgrounds, both under the 4.5:1 normal-text
threshold). Full transcribed table in
`docs/verification-log/task-w12-c-contrast-pass.md`.

`npm run build` PASS; `npm test --silent` PASS — 267 test files / 2219
tests, 0 failures (includes the 12 new contrast tests and an update to
the existing DEC-411 file-structure invariant test in
`test/render-sweep-lib.test.ts` accounting for the new
`measureContrast` helper's own `page.evaluate` call site).

RESULT: PASS — contrast pass landed, advisory, own module; does not flip
the render-sweep exit code; build/test green.
