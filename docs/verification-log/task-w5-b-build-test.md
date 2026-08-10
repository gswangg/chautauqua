# task-w5-b — build+test gate re-run

Fresh worktree of `main` (contains task-w5-a's script-fix merge).

## sha derivation (DEC-091)

Walked `git log main` skipping commits touching only
docs/verification-log.md, docs/verification-log/, docs/eval-findings.md,
field-guide/index.md, decisions/*.md, and scribe string-appends to
src/decisions.ts:

```
3d1e838 merge task-w5-a               <- exempt (merge commit, no diff of its own)
b638f75 Fix two gate-failing probe scripts (DEC-094/095/096)   <- newest code-bearing
6e1db15 scribe wave 5                 <- exempt
281a31b scribe wave 4                 <- exempt
f9a33fd scribe wave 3                 <- exempt
3878d4f merge task-w2-d
...
```

Newest code-bearing commit: **b638f75** ("Fix two gate-failing probe
scripts (DEC-094/095/096)" — scripts/walkthrough/scale.ts,
scripts/perf-smoke.ts, scripts/perf-smoke-lib.ts,
test/perf-smoke.test.ts; "No src/ or product-code changes" per its own
commit body). This matches the expected task-w5-a script-fix commit.
Short sha used throughout: `b638f75`.

## Commands

- `npm ci --prefer-offline --no-audit --no-fund --silent`: completed, no
  output (node_modules already present from harness bootstrap; ran clean
  regardless).
- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
  vite build --config app/vite.config.ts`): PASS. Both tsc passes clean
  (0 errors), vite build produced 17 asset files (125 modules
  transformed), entry `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB.
- `npm run bundle:check` (DEC-058 300KB gz budget): PASS. Entry bundle +
  css = 58.60 kB gzip vs 300.00 kB budget.
- `npm test --silent`: PASS. **94 test files / 976 tests**, all green,
  0 failures. Duration 7.34s.

## Post-run re-check

Re-ran `git log main -3 --oneline` after the test run completed; tip is
still `3d1e838 merge task-w5-a` — no code-bearing merge landed on main
during this run.

RESULT: PASS
