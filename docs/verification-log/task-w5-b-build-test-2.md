# 2026-08-10 task-w5-b — build+test @ 64ec7de

Full detail for the `## 2026-08-10 task-w5-b — build+test @ 64ec7de` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` summary).

SHA derivation (DEC-114/165): walked `git log --first-parent main`
from HEAD. HEAD (`64ec7de merge task-w5-a`) is not bookkeeping-only,
so no further walk was needed. Confirmed `.github/workflows/ci.yml`
at 64ec7de contains the `render-sweep` job (DEC-166, task-w5-a or
later), and `git merge-base --is-ancestor 2dd2f33 64ec7de` exits 0
(DEC-129/139). Adopted sha: 64ec7de.

`npm ci --prefer-offline --no-audit --no-fund --silent` clean (fresh
worktree). `npm run build` (tsc x2 + vite) PASS — 131 modules
transformed, 18 chunk/CSS assets + index.html under `public/admin/`.
`npm run bundle:check` (DEC-058, 300KB gzip budget) PASS — entry
bundle 58.86 kB gzip. `npm test --silent` PASS — 151 test files, 1308
tests, 0 failures.

File counts: `src/**/*.ts` = 93 files; `app/src/**/*.{ts,tsx}` = 150
files.

Full detail: docs/verification-log/task-w5-b-build-test.md

OPEN ITEMS: none — build, bundle:check, and test all PASS at 64ec7de.
RESULT: PASS — build+test green at 64ec7de (131 modules, 18 assets,
58.86 kB gzip entry bundle, 151 test files / 1308 tests, 0 failures).
