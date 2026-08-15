## 2026-08-15 task-w44-e — render-sweep @ 6edb5263

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Advisory lane (DEC-069 w44): the scope literal `render-sweep` classifies to
null under `classifyScope` (`scripts/exit-predicate.ts:145`) by design —
this is not a DEC-069 slot, run alongside the frozen wave's slots per the
wave-39 amendment.

STEP 0 sync-then-measure: `git merge --no-edit main` from the freshly cut
worktree branch reported "Already up to date." (branched directly off
`main`'s post-wave-44-scribe tip `6edb5263`). Only one live `task-w43-*`
ref exists, `task-w43-c` (`44e990427ee12ab930405b4f533dd3c15bfe5620`),
already confirmed an ancestor of HEAD via `git merge-base --is-ancestor` —
no retry loop needed. `npx tsx scripts/ref-state.ts` receipt (verbatim):

DEC-644 three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`;
newest first-parent product-code-bearing sha
`14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w43-c`, `task-w44-c`,
`task-w44-e`, `task-w44-g`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
`task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
--is-ancestor`. NON-ancestor refs (unrelated older work, not part of this
wave): `mail-rich-shape-fallback`, `task-w17-i`, `task-w44-a`, `task-w44-b`,
`task-w44-d`, `task-w44-f`, `task-w68-b`, `task-w68-c`, `task-w68-e`,
`task-w71-a`, `task-w72-a` through `task-w72-j`.

MEASURED_SHA = `6edb5263`.

`npx playwright install chromium` — no-op (already present), run outside
the lock. Ran the sweep inside one acquisition of the default test lock:
`sh scripts/with-test-lock.sh sh -c 'npm run db:migrate && npm run predev
&& npm run seed && npm run gate:render-sweep'`. The gate booted its own
migrated+seeded `wrangler dev` (`scripts/render-sweep.ts:1203`) on a
self-selected free port internally (`findFreePort()` — the sweep does not
accept a port argument, so no manual 8789 pin was needed / no collision
with the 8787 walkthrough or 8788 perf lanes was possible). Exit code
**0**.

### Per-pass PASS/FAIL table (all seven passes, verbatim score lines)

| pass | scope | result |
|---|---|---|
| desktop route sweep | 200 + non-empty content + zero console/pageerror, `app/src/routeManifest.ts` | 60/60 PASS |
| public mobile (390x844) — `MOBILE_ROUTE_MANIFEST` | blocking | 26/26 PASS |
| admin mobile (390x844) — `ADMIN_MOBILE_ROUTE_MANIFEST` | ADMIN_MOBILE_PASS_BLOCKING=true | 28/28 PASS |
| font-floor (10px min) | advisory | 114/114 PASS |
| type-role (/admin/overview desktop) | advisory | 7/7 PASS |
| contrast (WCAG AA) | advisory, incl. NAMED_CONTRAST_SELECTOR | 60/60 PASS (1 EXEMPT-BY-RULE row) |
| interaction-state (B8 focus/hover/disabled) | advisory | 3/3 PASS |

Zero FAIL rows across all seven passes.

DEC-253 mobile pass detail (390px, both `MOBILE_ROUTE_MANIFEST` public
routes and `ADMIN_MOBILE_ROUTE_MANIFEST` admin routes): every row reported
`overflowPx=0` (no page-level horizontal overflow on any route in either
manifest) and every row with an interactive control reported
`minControlPx>=44`, meeting the `MIN_TAP_TARGET_PX` floor
(`scripts/render-sweep-lib.ts:258`); rows with no measurable control
(e.g. `/`, `/docs/api`, `/dev/mailbox`, `/portal/preview`,
`/embed/devflow-conf-2027/schedule`) report `minControlPx=-` and are
still PASS. 26/26 public-mobile blocking rows PASS, 28/28 admin-mobile
blocking rows PASS — zero BLOCKING FAIL rows on either manifest.

Contrast pass detail: `/admin/speakers` and `/admin/speakers/seed_contact_0001`
both carry the measured `NAMED-PAIR .chq-participation-menu-caret` row
(`span.chq-participation-menu-caret ratio=6.82 fg=rgb(247,249,240)
bg=rgb(78,92,49) PASS`, `scripts/render-sweep-contrast.ts:43`) — PASS, not
folded blindly into the count without inspection.
`/admin/review/plans/seed_evaluation_plan_0001` carries one
`EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component):
label.chq-review-checkbox-label ratio=3.09` row per DEC-426 — reported
here as EXEMPT, not as an unqualified PASS and not folded into the FAIL
count.

Interaction-state pass (3/3, all PASS): `.chq-content-row` hover,
`.chq-review-field-disabled .chq-review-checkbox-label` disabled,
`.chq-cfp-step-next` focus.

Console/pageerror: zero `console`/`pageerror` events collected across
every route on both desktop and 390px mobile viewport passes (no
non-zero counts observed in the sweep output for any manifest entry).

Full per-row tables and detail:
`docs/verification-log/task-w44-e-render-sweep-6edb5263.md`.

RESULT: PASS — exit code 0, all seven render-sweep passes clean (desktop
60/60, public mobile 26/26 blocking, admin mobile 28/28 blocking,
font-floor 114/114, type-role 7/7, contrast 60/60 with one correctly-
reported EXEMPT-BY-RULE row, interaction-state 3/3); zero console/
pageerror on either viewport; frozen-wave scope (`src/**` `app/src/**`
`migrations/**` `package.json`) left untouched.
OPEN ITEMS: 0
