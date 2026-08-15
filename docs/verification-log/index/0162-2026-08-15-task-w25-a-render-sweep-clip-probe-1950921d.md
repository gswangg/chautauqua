## 2026-08-15 task-w25-a — render-sweep clip probe @ 1950921d

DEC-620 wave-25 amendment: made the vertical-clip probe truthful.
`scrollHeight > clientHeight` alone was never a clip — the in-page probe
now measures raw geometry + three boolean facts per candidate (self is a
deliberate scroll container, a real clipping context exists on
self/ancestor, the overflowing content is a replaced-content crop) and
hands them to a pure, unit-tested predicate (`isGenuineClipOffender` /
`selectClipOffenders`, `scripts/render-sweep-lib.ts`) requiring all of:
(0) not a deliberate self-scroll container (own `overflow-y`
auto|scroll — the pre-existing rule the amendment doesn't repeal), (i) a
real clipping context on self/ancestor, (ii) not the visually-hidden
collapse (`clientHeight <= 1px`), (iii) not a replaced-content crop
(img/video or declares `object-fit`). No product CSS touched.

A first-pass implementation of condition (i) alone (without restoring (0))
regressed `main.chq-main` (the app's one deliberate `overflow-y: auto`
scroll region, `app/src/styles.css:404-409`) into a false-positive
offender on nearly every admin route (desktop dropped to 40/60). Condition
(0) was added and the regression confirmed fixed by re-running the gate.

Unit tests: `test/render-sweep-lib.test.ts` — one case per exemption
(0)-(iii) plus a genuine-clip case proving the exemptions never swallow a
real defect. `npx vitest run test/render-sweep-lib.test.ts`: 95/95 passed.
`npm run build`: green.

`npm run gate:render-sweep` (own wrangler dev, free port, DEC-119):
desktop 59/60 routes passed (surviving FAIL: `/admin/submissions/forms`
`div.chq-forms-header-titles`/`h1` clip=3px, a genuine clip — same one
this repo's task-w17-d/w25-d receipts already knew about); mobile 25/26
(surviving FAIL: `/portal/tasks` horizontal overflow, unrelated to the
clip probe); admin-mobile (advisory) 25/28 (surviving FAILs:
`/admin/submissions` tap-target size, the same
`.chq-forms-header-titles`/`h1` clip at 390px, `/portal/preview` 404 — all
pre-existing, unrelated to the clip probe). Every one of the 11
`chq-visually-hidden`/`chq-pub-speaker-list-photo`/`chq-auth-wordmark`-
shaped false positives from task-w17-d's receipt no longer appears.
Full detail: `docs/verification-log/task-w25-a-render-sweep-clip-1950921d.md`.

RESULT: clip probe fixed and verified truthful; one genuine clip offender
(`.chq-forms-header-titles`/`h1`, `app/src/pages/forms/forms.css`) and a
handful of pre-existing unrelated FAILs (tap-target size, `/portal/preview`
404, `/portal/tasks` horizontal overflow) remain open, recorded not fixed
per this task's scope.

