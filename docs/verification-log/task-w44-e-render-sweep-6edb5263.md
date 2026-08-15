# task-w44-e render-sweep @ 6edb5263

Advisory lane (DEC-069 w44, index sequence 0224 pre-allocated): no
`src/**`, `app/src/**`, `migrations/**`, or `package.json` touched by this
task. Full `npm run gate:render-sweep` re-run against `main` at `6edb5263`
(task-w44-e's own HEAD equals `main` post-scribe-merge — `git merge
--no-edit main` reported "Already up to date").

## STEP 0: sync-then-measure

`git merge --no-edit main` -> "Already up to date." (worktree branched
directly off `main` tip `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`, scribe
wave 44 merge commit). Only one live `task-w43-*` ref exists,
`task-w43-c` -> `44e990427ee12ab930405b4f533dd3c15bfe5620`, confirmed an
ancestor of HEAD via `git merge-base --is-ancestor` on the first try — no
retry loop needed.

`npx tsx scripts/ref-state.ts` receipt (verbatim):

DEC-644 three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`;
newest first-parent product-code-bearing sha
`14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w43-c`, `task-w44-c`,
`task-w44-e`, `task-w44-g`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
`task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
--is-ancestor`. NON-ancestor refs: `mail-rich-shape-fallback`,
`task-w17-i`, `task-w44-a`, `task-w44-b`, `task-w44-d`, `task-w44-f`,
`task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a..j`.

MEASURED_SHA = `git rev-parse --short HEAD` = `6edb5263`.

## STEP 1: gate:render-sweep (single default-lock acquisition)

`npx playwright install chromium` — no-op, browser already present, run
outside the lock.

`sh scripts/with-test-lock.sh sh -c 'npm run db:migrate && npm run predev
&& npm run seed && npm run gate:render-sweep'` — single acquisition of the
DEFAULT `/tmp/chq-test.lock`; the gate boots its own migrated+seeded
`wrangler dev` (`scripts/render-sweep.ts:1203`) on a self-selected free
port internally via `findFreePort()` (the sweep does not accept a port
argument, so there was nothing to pin to 8789, and no collision with the
8787 walkthrough or 8788 perf-seed lanes was possible). Exit code **0**
(`gate:render-sweep OK` printed).

### Score lines (verbatim, all seven passes)

- desktop route sweep (`app/src/routeManifest.ts`, 200 + non-empty content
  + zero console/pageerror): `60/60 routes passed`
- public mobile pass, `MOBILE_ROUTE_MANIFEST` (390x844, blocking): `26/26
  mobile routes passed`
- admin mobile pass, `ADMIN_MOBILE_ROUTE_MANIFEST` (390x844,
  ADMIN_MOBILE_PASS_BLOCKING = true): `28/28 mobile routes passed`
- font-floor pass (10px minimum, advisory): `114/114 font-floor checks
  passed`
- type-role pass (`/admin/overview` desktop, advisory): `7/7 type-role
  checks passed`
- contrast pass (WCAG AA, advisory, includes NAMED_CONTRAST_SELECTOR
  `.chq-participation-menu-caret` named-pair rows): `60/60 contrast checks
  passed`
- interaction-state pass (B8 focus/hover/disabled, advisory): `3/3
  interaction-state checks passed`

Zero FAIL rows anywhere across all seven passes.

### DEC-253 mobile pass detail (390px, MIN_TAP_TARGET_PX floor + overflow)

Every row in both `MOBILE_ROUTE_MANIFEST` (public, 26 routes) and
`ADMIN_MOBILE_ROUTE_MANIFEST` (admin, 28 routes) reported `overflowPx=0` —
zero page-level horizontal overflow on any route at 390px, on either
manifest. Every row exposing an interactive control reported
`minControlPx>=44`, meeting the `MIN_TAP_TARGET_PX` floor
(`scripts/render-sweep-lib.ts:258`); representative values: `/login` and
`/forgot` at `minControlPx=46`, `/account/password` at `46`,
`/e/devflow-conf-2027/sessions` and most content routes at `44`. Routes
with no measurable interactive control (`/`, `/docs/api`, `/dev/mailbox`,
`/portal/preview`, `/embed/devflow-conf-2027/schedule`,
`/e/devflow-conf-2027/programme`) report `minControlPx=-` and are still
PASS (no control to fail the floor). Both manifests are BLOCKING passes
(`ADMIN_MOBILE_PASS_BLOCKING=true`) and both landed 100% PASS: 26/26
public, 28/28 admin — zero BLOCKING FAIL rows.

### Contrast pass detail (NAMED-PAIR and EXEMPT-BY-RULE rows)

`/admin/speakers` and `/admin/speakers/seed_contact_0001` both carry:
`[NAMED-PAIR .chq-participation-menu-caret: span.chq-participation-menu-caret
ratio=6.82 fg=rgb(247,249,240) bg=rgb(78,92,49) PASS]` (`scripts/render-sweep-
contrast.ts:43` `NAMED_CONTRAST_SELECTOR`) — measured PASS, ratio ~6.82,
clears WCAG AA 4.5:1 normal-text minimum with margin (matches the expected
~6.8 named-pair value).

`/admin/review/plans/seed_evaluation_plan_0001` carries one
`[EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component):
label.chq-review-checkbox-label ratio=3.09 fg=rgb(125,120,105)
bg=rgb(221,216,200)]` row — reported here as EXEMPT per DEC-426, not
folded into the PASS or FAIL count as an unqualified result (matches the
expected `EXEMPT-BY-RULE` classification, not FAIL).

### Interaction-state pass detail (3/3, all PASS)

- `.chq-content-row` — role `content-row-hover`, kind `hover` — PASS
- `.chq-review-field-disabled .chq-review-checkbox-label` — role
  `review-anonymize-disabled`, kind `disabled` — PASS
- `.chq-cfp-step-next` — role `cfp-primary-focus`, kind `focus` — PASS

### Console/pageerror detail

No route on either the desktop pass or either 390px mobile pass
(public/`MOBILE_ROUTE_MANIFEST` or admin/`ADMIN_MOBILE_ROUTE_MANIFEST`)
produced a non-zero `console`/`pageerror` count in the sweep output — the
desktop route sweep's 60/60 PASS result folds in the zero-console/
zero-pageerror check per route, and no route surfaced an elevated count
requiring individual callout.

## RESULT

PASS — exit code 0, all seven passes 100% clean (desktop 60/60, public
mobile 26/26 blocking, admin mobile 28/28 blocking, font-floor 114/114,
type-role 7/7, contrast 60/60 with the named-pair rows measured and one
expected EXEMPT-BY-RULE row, interaction-state 3/3). No console/pageerror
collected on either viewport. No regression found against `main` at
`6edb5263`; frozen-wave scope untouched (`src/**`, `app/src/**`,
`migrations/**`, `package.json` all clean per `git status`).

OPEN ITEMS: 0
