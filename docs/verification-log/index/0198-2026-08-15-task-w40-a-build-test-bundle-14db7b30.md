## 2026-08-15 task-w40-a — build+test+bundle @ 14db7b30

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

DEC-644 three-sha boundary block, produced by `npm run ref-state`:
DEC-644 three-sha boundary: HEAD `14db7b30fb424954f9a3604563ff6a95ae5d1127`;
newest first-parent product-code-bearing sha
`ed5c679e59828c5600cb84b51208056f7e38a445`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w39-e`, `task-w40-a`,
`task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an
ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs (NOT
confirmed via `git merge-base --is-ancestor`): `mail-rich-shape-fallback`,
`task-w17-i`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`,
`task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`,
`task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.

Per this task's own explicit check of every `task-w39-*` head
(`git for-each-ref --format='%(objectname) %(refname:short)' refs/heads`
matching `task-w39-*`): only `task-w39-e` (tip `cc77ed76`) exists among
local heads, and `git merge-base --is-ancestor cc77ed76 HEAD` exits 0
(ANCESTOR). No `task-w39-*` ref was found non-ancestor; zero retry cycles
were needed.

`git merge --no-edit main` at this worktree's creation from `main` reported
"Already up to date" — this branch was cut directly from `main` tip
`14db7b30` (= scribe wave 40), so MEASURED_SHA = HEAD = `14db7b30`.

`npm run build` (worker `tsc --noEmit`, app `tsc --noEmit -p
app/tsconfig.json`, then `vite build --config app/vite.config.ts`): clean,
no errors.

Full suite run inside the single lock acquisition per DEC-644 w40 (`sh
scripts/with-test-lock.sh sh -c 'npm run build && npx vitest run && npm run
bundle:check'`, never nesting `npm test`/`test:full` inside the wrapper):

```
 Test Files  1092 passed (1092)
      Tests  12002 passed (12002)
```

No failures.

`npm run bundle:check`: `Entry bundle: index-DRSpxsXW.js +
index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)` — `bundle:check
PASSED`. 69.20 kB gzip vs SPEC §7's 300 kB budget.

Full detail: docs/verification-log/task-w40-a-build-test-bundle-14db7b30.md.

RESULT: PASS (build clean, 1092/1092 test files and 12002/12002 tests
green, entry bundle 69.20 kB gzip vs 300 kB budget) at 14db7b30, sole live
task-w39-* ref (task-w39-e) confirmed ANCESTOR, zero retries needed.
OPEN ITEMS: 0
