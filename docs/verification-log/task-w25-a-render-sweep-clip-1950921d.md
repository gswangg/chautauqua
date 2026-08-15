# task-w25-a — render-sweep clip probe @ 1950921d

Branch: `task-w25-a`. Tip: `1950921df0dc91a5d392227cea6f8c5619343731`.

## What changed

DEC-620's vertical-clip probe (`scripts/render-sweep.ts` + `scripts/render-sweep-lib.ts`)
previously flagged any visible element where `scrollHeight > clientHeight +
2px` and its own computed `overflow-y` was `visible|hidden`. That rule is
correct-by-construction wrong: `scrollHeight > clientHeight` alone doesn't
mean anything is actually clipped from the user.

Per DEC-620's wave-25 amendment, the in-page probe now measures raw
geometry + three boolean facts per candidate element (self is a deliberate
scroll container, a real clipping context exists on self/ancestor, the
overflowing content is a replaced-content crop) and hands them to a pure,
unit-tested predicate — `isGenuineClipOffender` / `selectClipOffenders` in
`scripts/render-sweep-lib.ts` — that only flags an element when **all**
of the following hold:

- (0) it is **not** itself a deliberate scroll container (own computed
  `overflow-y` is `auto`/`scroll`) — the pre-existing DEC-620 rule the
  amendment does not repeal. `main.chq-main` (`app/src/styles.css:404-409`,
  `overflow-y: auto`, "the ONLY [scrolling region]" per `styles.css:179`)
  is exactly this shape and was a false-positive on nearly every admin
  route before this exclusion was restored (see "Regression found and
  fixed" below).
- (i) it or an ancestor establishes a real clipping context (computed
  `overflow-x`/`overflow-y` is `hidden|scroll|auto`, or a clipping
  `clip`/`clip-path`)
- (ii) it is not the deliberate visually-hidden collapse
  (`clientHeight <= 1px`)
- (iii) the overflowing content is not a replaced-content crop (an
  `img`/`video` element, or an element that declares `object-fit`)

No product CSS was touched. A row surviving all four conditions stays FAIL
and is recorded below, not fixed here.

## Regression found and fixed during this task

A first pass implemented condition (i) literally (`overflow-x/y
hidden|scroll|auto` establishes a clipping context) without also keeping
the original probe's "own `overflow-y: auto|scroll` means the element
resolves its own overflow via a scrollbar, not a clip" exclusion. Because
`overflow-y: auto` satisfies (i), that first pass flagged `main.chq-main`
— the app's one deliberate scroll region — as a clip offender on almost
every admin route (desktop FAIL count went from 13 to 20, `40/60 routes
passed`). Condition (0) above was added to restore the pre-existing
self-scroll exclusion; the corrected run below shows `main.chq-main` no
longer appears as an offender anywhere.

## Verified exemptions (unit + reproduced against the w17-d receipt)

- `label/button.chq-visually-hidden` (clip=18px, all `/e/<slug>/*` and
  `/embed/*` public routes) — exempted by (ii), `clientHeight <= 1px`.
- `div.chq-pub-speaker-list-photo` (clip=4px) — exempted by (iii),
  `object-fit: cover` on the child `<img>`.
- `h1.chq-auth-wordmark` / `div.chq-forms-header-titles h1` (clip=3px, no
  overflow declared anywhere in the ancestry) — exempted by (i), no real
  clipping context.
- `main.chq-main` (all admin routes) — exempted by (0), deliberate
  self-scroll container.

Unit tests: `test/render-sweep-lib.test.ts`, `isGenuineClipOffender (DEC-620
wave-25 amendment)` and `selectClipOffenders (DEC-620 wave-25 amendment)`
describe blocks — one case per exemption (0)-(iii), plus a genuine-clip
case (`div.chq-summary-box`, `overflow:hidden`, real content cut) proving
the exemptions never swallow a real defect.

```
$ npx vitest run test/render-sweep-lib.test.ts
 Test Files  1 passed (1)
      Tests  95 passed (95)
```

`npm run build` (`tsc --noEmit` x2 + `vite build`) is green.

## `npm run gate:render-sweep` — full run, own wrangler dev on a free port (DEC-119)

Command: `npm run gate:render-sweep` (boots + tears down its own `wrangler
dev`, no fixed port passed, no server pre-started).

### Desktop pass — 59/60 routes passed

Surviving FAIL:

```
/admin/submissions/forms  organizer  FAIL  (2 vertical clip offender(s):
  div.chq-forms-header-titles clip=3px (scrollHeight 57 > clientHeight 54)
  | h1 clip=3px (scrollHeight 31 > clientHeight 28))
```

This is a genuine clip surviving all four conditions: `.chq-forms-header-
titles` (and its `h1`) are 3px shorter than their content, with a real
clipping context established somewhere in the ancestry (not `.chq-main`'s
own scroll — this fires on the header block nested inside it), not the
visually-hidden collapse, not a replaced-content crop. Recorded, not fixed
here (out of task-w25-a's scope: no product CSS touched).

### Mobile pass (390x844) — 25/26 routes passed

Surviving FAIL (unrelated to the clip probe — horizontal overflow):

```
/portal/tasks  170  44  FAIL  (horizontal overflow 170px (scrollWidth 560
  > viewport 390) — widest: main.chq-measure w=560px right=560px)
```

### Admin mobile pass (390x844, advisory) — 25/28 routes passed

Surviving FAIL:

```
/admin/submissions          FAIL  (control height 26px < 44px
  (input.chq-input.chq-submissions-filterbar-search))
/admin/submissions/forms    FAIL  (2 vertical clip offender(s):
  div.chq-forms-header-titles clip=3px (scrollHeight 54 > clientHeight 51)
  | h1 clip=3px (scrollHeight 28 > clientHeight 25))
/portal/preview              FAIL  (status 404 !== 200)
```

The `/admin/submissions/forms` clip is the same genuine
`.chq-forms-header-titles`/`h1` offender as the desktop pass, at the
390x844 viewport. The other two admin-mobile FAILs (tap-target size,
`/portal/preview` 404) are unrelated to the clip probe.

### Advisory passes (never flip exit code)

```
114/114 font-floor checks passed
6/7 type-role checks passed
57/60 contrast checks passed
2/4 interaction-state checks passed
```

## Scope note

Per the task brief, product CSS was not touched. The surviving
`div.chq-forms-header-titles`/`h1` clip (desktop + admin-mobile) is a real
3px clip and is left for a future task to fix at its CSS source
(`app/src/pages/forms/forms.css`).
