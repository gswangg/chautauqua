## 2026-08-10 task-w5-d — perf-smoke @ 64ec7de

Full detail: docs/verification-log/task-w5-d-perf-smoke.md

STEP 1: frozen sha derivation identical to task-w5-b's spec (first-parent
walk from `main` tip, skipping bookkeeping, must contain the ci.yml
render-sweep job, must descend from `2dd2f33`). `main` tip at worktree
creation is `64ec7de` ("merge task-w5-a"), the first-parent commit
immediately preceding it in the log being `54005df` ("merge task-w4-e").
`64ec7de` is code-bearing: it is the merge of task-w5-a, whose sole
change was adding the `render-sweep` job to `.github/workflows/ci.yml`
(confirmed present: `grep -n render-sweep .github/workflows/ci.yml` hits
`render-sweep:` at line 87, `npx playwright install --with-deps
chromium` at line 96, `npm run gate:render-sweep` at line 97). Ancestor
guard: `git merge-base --is-ancestor 2dd2f33 64ec7de` exits 0 — PASS.
Adopted sha: `64ec7de`.

OPEN ITEMS: 0

RESULT: PASS

