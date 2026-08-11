# task-w2-a - build+test @ e330aef

FROZEN SHA: e330aef6a55af64f73705a6f3ec9e5a614706046

## Freeze derivation

Ancestry check at startTs (1786461158): every `refs/heads/task-w1-*` branch
present at that time (task-w1-e, task-w1-f, task-w1-g, task-w1-h) was
confirmed an ancestor of `main` (`git merge-base --is-ancestor <branch>
main` returned 0 for all four). No wait was required.

`main` at that time was `de2da75dc09432ae74abd70bb73ff18804687853`.
Walking `git log --first-parent main` and testing each commit with
`git diff --name-only <parent> <commit>` for paths outside
`{decisions/**, field-guide/**, docs/verification-log/**,
docs/eval-findings.md, src/decisions.ts}`:

- `de2da75` (HEAD) touches only `decisions/DEC-256.md`,
  `decisions/DEC-257.md`, `field-guide/index.md`, `src/decisions.ts` ->
  excluded-only, skip.
- `e330aef6a55af64f73705a6f3ec9e5a614706046` ("merge task-w1-b") touches
  `README.md`, `docs/verification-log/task-w1-b-mobile.md`,
  `scripts/render-sweep-lib.ts`, `scripts/render-sweep.ts`,
  `src/routes/auth.tsx`, `src/routes/portal/index.tsx`,
  `src/routes/portal/shared.tsx`, `src/routes/public/agenda.tsx`,
  `src/routes/public/shell.tsx`, `src/routes/public/submit.tsx`,
  `test/render-sweep-lib.test.ts` -> non-excluded paths present ->
  **S = e330aef6a55af64f73705a6f3ec9e5a614706046**.

Ran the gate in a byte-identical detached worktree:
`git worktree add --detach /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w2-a-frozen e330aef6a55af64f73705a6f3ec9e5a614706046`
(worktree removed with `--force` after the gate completed).

## Step 1: npm ci

`npm ci --prefer-offline --no-audit --no-fund` -> `added 423 packages in 3s`,
clean, no errors.

## Step 2: npm run build

`npm run build` = `tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
vite build --config app/vite.config.ts`. Both `tsc --noEmit` passes were
silent (0 errors). `vite build`: `✓ 133 modules transformed`, `✓ built in
1.02s`, 19 output chunks emitted under `public/admin/assets/`. Clean.

## Step 3: npx vitest run (full suite)

```
 Test Files  185 passed (185)
      Tests  1595 passed (1595)
   Start at  11:14:00
   Duration  37.37s (transform 7.05s, setup 0ms, collect 100.39s, tests 45.29s, environment 16.51s, prepare 38.59s)
```

All files/tests passed, including `app/src/**/*.render.test.tsx`.

### Baseline delta explanation

Baseline claim per task instructions: "task-w1-a-origin-walkthrough.md
recorded 185 test files / 1584 tests at c663cf2." To verify the delta
mechanically:

1. `git log --first-parent --name-only c663cf269578d06a72fbebb74e0f89a7ea4aa22f..e330aef6a55af64f73705a6f3ec9e5a614706046 -- test app/src`
   surfaces exactly 3 merge commits (task-w1-a, task-w1-d, task-w1-b) that
   touch test/app files:
   - `test/claim-onscreen-scope.test.ts` (M), `test/origin.test.ts` (A) —
     task-w1-a
   - `app/src/pages/review/PlanEditor.render.test.tsx` (M),
     `app/src/pages/review/PlanEditor.tsx` (M) — task-w1-d
   - `test/render-sweep-lib.test.ts` (M) — task-w1-b
2. `npx vitest run test/render-sweep-lib.test.ts
   app/src/pages/review/PlanEditor.render.test.tsx
   test/claim-onscreen-scope.test.ts test/origin.test.ts` (run in isolation
   at S):
   ```
   ✓ test/render-sweep-lib.test.ts (21 tests) 3ms
   ✓ test/origin.test.ts (10 tests) 3ms
   ✓ test/claim-onscreen-scope.test.ts (4 tests) 14ms
   ✓ app/src/pages/review/PlanEditor.render.test.tsx (3 tests) 111ms
   Test Files  4 passed (4)
        Tests  38 passed (38)
   ```
3. To reconcile against ground truth (rather than trust the recorded
   baseline document verbatim), the baseline commit `c663cf269578d0
   6a72fbebb74e0f89a7ea4aa22f` was checked out into its own detached
   worktree (`chautauqua-wt/task-w2-a-baseline`, removed after use) and
   run fresh: **actual measured baseline = 184 test files / 1573 tests**
   (not the 185/1584 the wave-1 log recorded — see OPEN ITEMS below).
   Delta from this freshly-measured baseline to S: +1 file
   (`test/origin.test.ts`, new), +22 tests, which is exactly explained
   by: `test/origin.test.ts` new file (+10), `test/render-sweep-lib.test.ts`
   11->21 (+10), `test/claim-onscreen-scope.test.ts` 3->4 (+1),
   `PlanEditor.render.test.tsx` 2->3 (+1). 10+10+1+1 = 22. Reconciles
   exactly. No unexplained drop or gain anywhere in the suite.

## Step 4: npm run bundle:check

```
Entry bundle: index-CCRyVO7p.js + index-easpJsYc.css = 58.86 kB gzip (budget 300.00 kB)
bundle:check PASSED
```
58.86 KB gzip, well under the 300 KB SPEC §7 budget.

## Re-derivation of S at end (DRIFT check)

Re-ran the S derivation against current `main` after finishing the gate.
`main` had moved from `de2da75dc09432ae74abd70bb73ff18804687853` (at
freeze time) to `1e08bc84e70c30419910d716335febeb9808b2dc` ("merge
task-w1-h"). That new tip commit touches `src/routes/docs.tsx` and
`test/docs-route-coverage.test.ts` — non-excluded paths — so re-deriving S
from the new `main` HEAD yields a *different* S
(`1e08bc84e70c30419910d716335febeb9808b2dc`), not the S this gate ran
against (`e330aef6a55af64f73705a6f3ec9e5a614706046`). Per DEC-256, this is
DRIFT: `main` moved (task-w1-h, which was still a live/unmerged worktree
at the start of this task per the field guide, landed a further merge)
while this build+test gate was in flight. (After the gate finished, main
continued to be in active flux from other concurrent lanes — even the
worktree/branch scaffolding for this very task (`task-w2-a`) had to be
recreated mid-task after being torn down by concurrent cleanup activity —
reinforcing that `main` was not quiescent during this run.)

All measured results above (build clean, 185/1595 tests green, bundle
58.86 KB) are true and reproducible for the frozen S this lane actually
ran against, but per the DEC-256 protocol a moved S invalidates joint
certification with the other wave-2 sections, since they may freeze
against a different S. Per the task's explicit rule ("if it moved, record
DRIFT, OPEN ITEMS >= 1, RESULT: FAIL"), this is recorded as FAIL.

## OPEN ITEMS

1. DRIFT: `main` advanced from `de2da75d...` to `1e08bc84e7...` (new
   `merge task-w1-h` commit touching `src/routes/docs.tsx` and
   `test/docs-route-coverage.test.ts`) between this lane's freeze-time S
   derivation and its end-of-task re-derivation, and continued moving
   after that (this lane's own worktree/branch scaffolding was torn down
   and had to be recreated mid-task by other concurrent activity). The
   gate above was run correctly against the S that was valid at freeze
   time, but S is not stable — a future wave-2 pass must re-derive S once
   all task-w1-* branches (including task-w1-h) and any other in-flight
   lanes are confirmed to have stopped moving, and re-run this build+test
   gate against the new S.
2. The recorded wave-1 baseline document (task-w1-a-origin-walkthrough.md,
   claimed 185 test files / 1584 tests at c663cf2) does not match this
   lane's fresh measurement of the same commit c663cf2 (184 test files /
   1573 tests, verified directly by checking out c663cf2 into its own
   worktree and running `npx vitest run`). This lane's own delta
   arithmetic reconciles exactly against the freshly-measured 184/1573
   baseline (see Step 3), so this did not affect the PASS/FAIL
   determination of the test-count check itself, but the discrepancy in
   the wave-1 log is unexplained and should be looked at by whoever next
   touches task-w1-a's log or the docs/eval-findings.md closure process.

OPEN ITEMS: 2
RESULT: FAIL - build/tsc/vitest/bundle all clean and green at S=e330aef6a55af64f73705a6f3ec9e5a614706046, but `main` drifted (new merge task-w1-h landing mid-gate, and further concurrent activity after) before this lane's mandatory end-of-task S re-derivation, so per DEC-256 the freeze is not certifiable stable and this section must be re-run once all task-w1-* branches and other in-flight lanes stop moving.
