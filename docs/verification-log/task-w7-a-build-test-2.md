# 2026-08-10 task-w7-a — build+test @ d12eb25

Full detail for the `## 2026-08-10 task-w7-a — build+test @ d12eb25` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-7 code-frozen build+test gate (DEC-077, DEC-102). Re-derived the
newest code-bearing sha per DEC-091 by walking `main` from tip
`9e7ac53`: `9e7ac53` (scribe wave 7 — DEC-102 doc + a pure
string-constant append to `src/decisions.ts`), `4e2d53e` (merge
task-w5-f, no own diff), `0828e32` (task-w5-f gate section,
docs/verification-log.md only) are all DEC-090-exempt bookkeeping.
Newest code-bearing commit: **d12eb25** ("merge task-w6-d") — matches
the task's stated expectation.

Ran from a worktree at `main`'s tip `9e7ac53` (content-identical to
`d12eb25` for every code/test/config path, since the intervening
commits are verified-exempt):

- `npm ci --prefer-offline --no-audit --no-fund --silent`: node_modules
  already present, skipped clean.
- `npm run build`: PASS — `tsc --noEmit` (root) clean, `tsc --noEmit -p
  app/tsconfig.json` clean, `vite build` succeeded (125 modules, 17
  output files, entry `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB).
- `npm run bundle:check`: PASS — entry bundle + css = 58.60 kB gzip vs
  300.00 kB budget.
- `npm test --silent`: PASS — **96 test files / 984 tests**, 0
  failures, 6.27s.

Post-run re-check: `git log --oneline -5 main` still shows tip
`9e7ac53`; no code-bearing merge landed mid-run. sha `d12eb25` stands.

Full detail: `docs/verification-log/task-w7-a-build-test.md`.

OPEN ITEMS: 0

RESULT: PASS
