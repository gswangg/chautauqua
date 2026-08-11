# task-w25-a: build+test exit gate @ b2dc2c1

Frozen sha under gate: `b2dc2c103309433732bc689b933610fc7cfb3b06` (merge task-w23-b), per DEC-223/DEC-225.

## Step 1 — sha check

`git log --first-parent --oneline -10 main` (run from
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua`):

```
b2991ec scribe wave 25
c36a77c merge task-w24-f
e591034 merge task-w24-c
e92f8b4 merge task-w24-e
bfc8099 merge task-w24-d
04350dd merge task-w24-b
80dc009 merge task-w24-a
cde03cd scribe wave 24
b2dc2c1 merge task-w23-b
871ee28 merge task-w23-a
```

`git diff --name-only b2dc2c1 main`:

```
decisions/DEC-221.md
decisions/DEC-222.md
decisions/DEC-223.md
decisions/DEC-224.md
decisions/DEC-225.md
docs/verification-log/task-w24-a-build-test.md
docs/verification-log/task-w24-b-walkthrough.md
docs/verification-log/task-w24-c-perf-smoke.md
docs/verification-log/task-w24-d-render-sweep.md
docs/verification-log/task-w24-e-spec-audit.md
docs/verification-log/task-w24-f-triage-closure.md
field-guide/index.md
src/decisions.ts
```

Every path is under `decisions/`, `docs/verification-log/`, or `field-guide/`,
except `src/decisions.ts`. Inspecting `git diff b2dc2c1 main -- src/decisions.ts`
shows only five new trailing `export const DEC_22x = "...";` lines appended
after the existing `DEC_220` line — a pure string-append, no other edits.

Per DEC-224, the stray `task-w24-*` merges are expected late-drain artifacts
and are explicitly allow-listed as non-code-bearing (they only touch
decisions/, docs/verification-log/, field-guide/, and append to
src/decisions.ts). **PASS-precondition satisfied — proceeding to Step 2.**

## Step 2 — build/test/bundle at b2dc2c1

Detached worktree created via:

```
git worktree add --detach /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chq-w25a b2dc2c1
```

HEAD confirmed: `b2dc2c1 merge task-w23-b`.

### `npm ci --prefer-offline --no-audit --no-fund`

```
added 423 packages in 2s
```
Exit: 0 (PASS). (npm warn deprecated notices only, non-fatal.)

### `npm run build`

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...
✓ 132 modules transformed.
rendering chunks...
computing gzip size...
../public/admin/index.html                                 0.41 kB │ gzip:  0.28 kB
../public/admin/assets/index-easpJsYc.css                  4.59 kB │ gzip:  1.38 kB
...
../public/admin/assets/index-DrYi63OQ.js                 180.16 kB │ gzip: 58.90 kB
✓ built in 694ms
```
Exit: 0 (PASS) — both `tsc --noEmit` passes (root + app/tsconfig.json) and the
vite production build succeeded with zero type errors.

### `npm test`

```
 Test Files  158 passed (158)
      Tests  1420 passed (1420)
   Start at  23:13:33
   Duration  18.15s
```
Exit: 0 (PASS). Total: **158 test files, 1420 tests, all green, 0 failed,
0 skipped.**

Specifically confirmed (re-run in isolation to double check overlapping
DEC-215 coverage per DEC-221/223):

```
npx vitest run test/users-reset-password.test.ts test/users-api.test.ts
```
```
 ✓ test/users-reset-password.test.ts (6 tests) 928ms
 ✓ test/users-api.test.ts (17 tests) 1312ms

 Test Files  2 passed (2)
      Tests  23 passed (23)
```
Both `test/users-reset-password.test.ts` (6 tests) and `test/users-api.test.ts`
(17 tests, including its own reset-password coverage) run green together with
no conflicts — the intentional DEC-215 coverage overlap accepted by
DEC-221/DEC-223 does not cause any collision or duplicate-test failure.

### `npm run bundle:check`

```
> bundle:check
> tsx scripts/bundle-check.ts

...
Entry bundle: index-DrYi63OQ.js + index-easpJsYc.css = 58.86 kB gzip (budget 300.00 kB)
bundle:check PASSED
```
Exit: 0 (PASS).

## Cleanup

Worktree removed after verification:
```
git worktree remove /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chq-w25a
```

## Verdict

**PASS** — sha-drift check passed the allow-list precondition (DEC-224), and
at frozen sha `b2dc2c1` (`b2dc2c103309433732bc689b933610fc7cfb3b06`): install
clean, `npm run build` clean (0 TS errors, vite build succeeded), `npm test`
158/158 files and 1420/1420 tests green (including both
`test/users-reset-password.test.ts` and `test/users-api.test.ts` green
together), and `npm run bundle:check` PASSED (58.86 kB gzip entry, well under
the 300 kB budget).
