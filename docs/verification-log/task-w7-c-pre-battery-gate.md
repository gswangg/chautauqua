# Pre-battery mechanical gate (DEC-284) -- task-w7-c

MAIN SHA AT START: 80b811d250285de0d37417ddc12f65445ce27f9

Procedure per DEC-284: work done in a detached worktree at the sha above
(`git worktree add --detach .../chautauqua-wt/task-w7-c-scratch 80b811d250285de0d37417ddc12f65445ce27f9`),
never in a worktree tracking main. This lane changes no product code, no
tests, no decisions/, no src/decisions.ts, no field-guide/, no
docs/eval-findings.md; a red result is reported, never fixed.

## Commands run, in order

1. `npm ci`
   - EXIT: 0
   - 423 packages installed, 9 audit advisories (moderate/high, unrelated to
     this gate -- not investigated per scope).

2. `npm run build` (== `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`)
   - EXIT: 0
   - Both tsc --noEmit passes clean, vite build of the admin SPA produced
     133 modules / 19 chunks, entry ~180 kB raw / 58.9 kB gzip, built in
     586ms.

3. `npm test` (== `vitest run`)
   - EXIT: 0
   - Test Files: 199 passed (199)
   - Tests: 1690 passed (1690)
   - Duration: 14.65s
   - No failures, no skips.

4. `npm run bundle:check` (== `tsx scripts/bundle-check.ts`)
   - EXIT: 0
   - Entry bundle 58.87 kB gzip vs 300.00 kB budget.
   - Output: `bundle:check PASSED`

5. `npm run gate:render-sweep` (== `tsx scripts/render-sweep.ts`)
   - RUNNABLE. Started `wrangler dev` locally (local D1/R2, no external
     accounts), seeded fixtures, logged in as organizer/reviewer/speaker,
     and swept routes.
   - Desktop pass: 34/34 routes PASS (admin organizer/reviewer, portal
     speaker, public event pages, submit form, account/password for all
     three roles, `/admin/*` catch-all).
   - Mobile pass (390x844): 13/13 routes PASS, 0px horizontal overflow on
     every route, min control size 40px on every route (meets the 44px-ish
     touch-target convention noted in the field guide's mobile section).
   - Output: `gate:render-sweep OK`
   - EXIT: 0

## Standing tripwires (glob of test/)

All four confirmed present under `test/` and confirmed from the vitest
output as run and passed:

- `test/docs-route-coverage.test.ts` -- 2 tests, PASS
- `test/spa-contract-sweep.test.ts` -- 8 tests, PASS
- `test/schema-fk-indexes.test.ts` -- 1 test, PASS
- `test/migration-parity.test.ts` -- 1 test, PASS

## git log --oneline -12 (at MAIN SHA AT START)

```
80b811d scribe wave 7
32d740f merge task-w6-e
8685362 DEC-278: plan onboarding tasks for late-added/late-accepted participants
61a1c6f merge task-w6-c
16fc3c8 merge task-w6-a
a60f51c merge task-w6-d
c7645c6 DEC-276: bearer auth re-resolves the minting user every request
d0d3039 DEC-274: split session visibility gate from participant gate in public.ts
1a4d55b merge task-w6-b
b18a794 DEC-277: reject out-of-range slot days, classify stale slots as unscheduled
096aaae DEC-275: cloneSubmission copies active participant rows
2d091ef scribe wave 6
```

Note for wave 8's planner: at MAIN SHA AT START (80b811d) the wave-6 defect
fixes DEC-274 (public.ts session/participant gate split), DEC-275
(cloneSubmission active-participant copy), DEC-276 (bearer re-resolve),
DEC-277 (slot-day range check), and DEC-278 (onboarding task timing) are
ALL already landed and merged into main, and their constants
(`DEC_274`..`DEC_278`) are present in `src/decisions.ts`. This differs from
the field-guide's w7 entry, which described DEC-274/276/277 as "still in
flight" as of an earlier main sha (1a4d55b); by this gate's sha they have
landed. No product-code or decision changes were made by this lane -- this
is a factual observation for the next wave's planning, not a fix.

## Verdict

PRE-BATTERY GATE: GREEN
- npm ci: PASS (exit 0)
- npm run build (tsc x2 + vite build): PASS (exit 0)
- npm test (vitest run): PASS (exit 0) -- 199/199 files, 1690/1690 tests
- npm run bundle:check: PASS (exit 0) -- 58.87 kB gzip entry vs 300 kB budget
- npm run gate:render-sweep: PASS (exit 0) -- 34/34 desktop routes, 13/13 mobile routes, RUNNABLE (wrangler dev started successfully in this environment)
- Tripwires present and passing: docs-route-coverage.test.ts, spa-contract-sweep.test.ts, schema-fk-indexes.test.ts, migration-parity.test.ts
