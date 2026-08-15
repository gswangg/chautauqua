## 2026-08-15 task-w28-b — build+test+bundle @ c6dbdb7c

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Full detail: docs/verification-log/task-w28-b-build-test-c6dbdb7c.md

`git rev-parse HEAD` recorded first: `c6dbdb7cc615248d1a49485d63320570168f4c7b`
(main tip, "scribe wave 28"). `npm run build` (tsc --noEmit root + app,
then vite build): exit 0, 0 tsc errors, vite `✓ built in 1.14s` (276
modules). `sh scripts/with-test-lock.sh npx vitest run`: exit 0, no lock
contention, single run — `Test Files 1061 passed (1061)`, `Tests 11745
passed (11745)`, Duration 228.32s. `npm run bundle:check`: exit 0, entry
bundle `index-BhPrbvpM.js + index-DpG2gFFa.css` = 69.19 kB gzip vs SPEC
§7's 300 kB budget.

OPEN ITEMS: 0
RESULT: PASS — build, full 1061-file/11745-test suite, and bundle gate
all green at c6dbdb7c; no fixes applied (measurement-only lane).

