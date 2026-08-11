# task-w1-b — mobile pass @ 137dfe6

DEC-253/DEC-254: mobile pass (390x844) on every no-login surface, plus a
render-sweep gate extension that keeps it. Base sha `137dfe6` ("merge
task-w1-d", `main` tip this branch was cut from).

## Method

Own worktree (`chautauqua-wt/task-w1-b`), `npm ci`, `npm run build`,
`rm -rf .wrangler/state/v3/d1` (clean local D1 — a from-scratch
`gate:render-sweep` run self-migrates + self-seeds; running a manual
`db:migrate`/`seed` immediately before it collides with the gate's own
reseed against the same local D1 state — `UNIQUE constraint failed:
pipeline_entry.org_id, pipeline_entry.contact_id`), then `npm run
gate:render-sweep` (`npx playwright install chromium` already present).
The gate's new mobile pass (`scripts/render-sweep.ts`,
`MOBILE_ROUTE_MANIFEST`) re-visits every route below at a 390x844 Playwright
viewport and asserts:

- zero page-level horizontal overflow:
  `document.scrollingElement.scrollWidth <= window.innerWidth + 1px`
- every primary nav/filter/submit control (`nav a`, search-form
  input/button, form submit buttons) measures `getBoundingClientRect().height
  >= 40px`

Pass criteria implemented + unit-tested in `scripts/render-sweep-lib.ts`
(`evaluateMobileRoute` + 10 new cases in `test/render-sweep-lib.test.ts`).

## Before (pre-fix code, inspected/measured against an earlier identical
## implementation of this same change in an interrupted first attempt)

- `src/routes/public/agenda.tsx:41` (before): fixed `grid-template-columns:
  70px repeat(N, 1fr)` with no scroll container — a many-room day would
  collapse every room column below a legible width on a 390px viewport (the
  seeded fixture's agenda days don't reach 15 rooms, so this exact overflow
  never showed up in the current fixture data, but the column-width math was
  unconditionally wrong for any event with more rooms).
- No `<meta name="viewport">` on `/portal` (`src/routes/portal/shared.tsx`),
  `/submit/<slug>` (`src/routes/public/submit.tsx`), or `/login`
  (`src/routes/auth.tsx`) — mobile browsers render those pages zoomed out to
  fit an assumed desktop layout width instead of the actual 390px viewport.
- No tap-target sizing anywhere on the public/portal/login surfaces: default
  browser control heights (measured at 21px for `<input type=search>` /
  `<button>` / `<input type=submit>` in Chromium) fall well short of the
  40px bar.
- First attempt at the CSS fix (before catching the escaping bug below)
  measured 5/13 mobile routes passing: `/e/<slug>/agenda`, `/schedule`,
  session detail, and speaker detail passed (they have no `form[role=search]`
  search box), but every route with a search/filter form —
  `/submit/<slug>`, `/e/<slug>/sessions`, `/speakers`, `/gallery`,
  `/embed/<slug>/sessions`, `/embed/<slug>/speakers`, `/login`, `/portal` —
  still measured a 21px control. Root cause: hono/jsx HTML-escapes
  `<style>{...}</style>` text content like any other text child, so a
  template literal containing `input[type="search"]` rendered as literal
  `input[type=&quot;search&quot;]` — an invalid CSS attribute selector that
  browsers silently never match, so the `min-height: 40px` rule for those
  inputs/buttons never applied. Fix: use unquoted attribute selectors
  (`input[type=search]`, `form[role=search]`, `button[type=submit]`)
  throughout the added CSS — valid CSS for identifier-like values and immune
  to hono/jsx's text-child escaping.

## After (fixed code, this commit — full gate run)

```
path                                                                            role       status
/admin/overview                                                                 organizer  PASS
... (31 more desktop routes) ...
/admin/*                                                                        organizer  PASS

34/34 routes passed

render-sweep: mobile pass (390x844)...

path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             40  PASS
/e/devflow-conf-2027/sessions                                0             40  PASS
/e/devflow-conf-2027/speakers                                0             40  PASS
/e/devflow-conf-2027/agenda                                  0             40  PASS
/e/devflow-conf-2027/schedule                                0             40  PASS
/e/devflow-conf-2027/gallery                                 0             40  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             40  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001              0             40  PASS
/embed/devflow-conf-2027/sessions                            0             40  PASS
/embed/devflow-conf-2027/agenda                              0             40  PASS
/embed/devflow-conf-2027/speakers                            0             40  PASS
/login                                                       0             40  PASS
/portal                                                      0             40  PASS

13/13 mobile routes passed
gate:render-sweep OK
```

Full 34/34 desktop routes + 13/13 mobile routes PASS in one invocation.
Zero horizontal overflow on every mobile route (before-vs-after: N/A for
overflow on the current fixture data — the agenda grid fix is a
markup/layout correctness fix that only manifests as overflow on
higher-room-count events than the seed provides; the day grid and per-block
tap targets on `/agenda` and `/schedule` measured 40px both before and after
since those pages have no search form). Control-height before/after per
affected route: 21px -> 40px on `/submit/<slug>`, `/e/<slug>/sessions`,
`/speakers`, `/gallery`, `/embed/<slug>/sessions`, `/embed/<slug>/speakers`,
`/login`, `/portal`.

## What changed (CSS/markup only, no functional/behavioral change)

- `src/routes/public/agenda.tsx`: `AgendaDayGrid`'s day grid now wraps in a
  `.chq-agenda-day-scroll` (`overflow-x: auto`) container, and the grid's
  column template changed from `repeat(N, 1fr)` to
  `repeat(N, minmax(140px, 1fr))` so a many-room day scrolls sideways in its
  own container and stays legible instead of collapsing page-wide.
- `src/routes/public/shell.tsx` (`BaseStyles`): `box-sizing: border-box`
  reset, `nav a`/form-control/button tap-target sizing (`min-height: 40px`),
  `form[role=search]` flex-wrap layout, `img { max-width: 100% }`.
- `src/routes/public/submit.tsx` (`PageShell`): added
  `<meta name="viewport">` (previously missing) + the same box-sizing/
  tap-target/full-width-input CSS treatment.
- `src/routes/portal/shared.tsx` (`PortalLayout`): added
  `<meta name="viewport">` (previously missing) + matching CSS; portal
  `nav a` and buttons now meet the 40px tap target.
- `src/routes/portal/index.tsx`: wrapped the "My Submissions" `<table>` in a
  `.chq-table-scroll` (`overflow-x: auto`) div — markup-only, no query/data
  change.
- `src/routes/auth.tsx` (`/login`, `/claim`): added viewport meta + a small
  inline stylesheet for tap-target sizing (scope gap, see below).

No changes to `src/views/form-render.tsx` were needed beyond what the parent
page shells' global input/button CSS already covers (its markup has no
fixed-width elements).

## Scope gap (flagged, not decided)

The task's edit-file list did not include `src/routes/auth.tsx`, but `/login`
is one of the DEC-254-listed mobile test routes and failed the tap-target
check with the file untouched (bare unstyled `<button type=submit>`). Took
the narrowest reading: fixed `/login` (and `/claim`, same shared inline
style, for consistency) with a CSS/markup-only change confined to that one
file, styling only, no route/behavior change. Flagging for the scribe/
planner in case `auth.tsx` ownership needs to be reconciled with another
lane.

## Procedural note (harness gotcha)

Mid-task the assigned worktree/branch was unexpectedly removed by the
harness while work was in progress (uncommitted at the time) — likely
reclaimed on a perceived timeout. Recreated the worktree from the (empty,
main-tip) `task-w1-b` branch and reapplied every edit from scratch before
this commit; no data was lost since the branch had not yet received a
commit at the time of the removal. Recommend the scribe note this as a
"commit early, commit often within a task" reminder for future lanes if the
harness's worktree lifecycle allows mid-task reclamation.

## Supplementary: build + full test suite

- `npm run build`: PASS (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json
  && vite build`).
- `npm test --silent`: PASS — 185 test files / 1595 tests, 0 failures (10 new
  cases in `test/render-sweep-lib.test.ts` for `evaluateMobileRoute` +
  `allMobilePassed`/`formatMobileSummary`/`formatMobileResultsTable`).

OPEN ITEMS: 0
RESULT: PASS
