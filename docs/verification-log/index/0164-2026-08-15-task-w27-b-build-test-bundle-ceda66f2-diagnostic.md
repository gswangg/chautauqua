## 2026-08-15 task-w27-b — build+test+bundle @ ceda66f2 [DIAGNOSTIC]

INVALIDATED BY: src/**, app/src/**, test/**, package.json, migrations/**

Full detail: docs/verification-log/task-w27-b-build-test-ceda66f2.md

Ref truth at read time: `main` = `ceda66f2` (S). All six wave-26 lanes
(`task-w26-a`..`task-w26-f`) are ancestors of main (merged). `task-w27-a`,
`task-w27-b`, `task-w27-c`, `task-w27-d` all equal S exactly when this
worktree was cut — per DEC-069's wave-17 amendment, PRODUCED NOTHING at
that point (expected: task-w27-a lands code later this same wave, observed
mid-run to have advanced to `900f8326`).

Detached worktree at S: `npm ci` PASS; `npm run build` (tsc x2 + vite)
PASS; `sh scripts/with-test-lock.sh npx vitest run` **FAIL** — 37 failing
tests / 11703 passed (11740 total), 11 failing files (`test/auth-login-
lockout.test.ts`, `test/count-grammar.test.ts`, `test/cross-org-reviewer-
probe.test.ts`, `test/file-put-compensation.scan.test.ts`, `test/forgot-
response-path-parity.test.ts`, `test/login-account-budget.test.ts`,
`test/password-reset-flow.test.ts`, `test/plural-scan.test.ts`, `test/
reaccept-onboarding.test.ts`, `test/review-plan-scope-real-rows-probe.
test.ts`, `test/users-name-persistence.test.ts`). Two root causes visible
in the transcript: (1) an in-process vitest SQLite fixture bootstrap that
several suites share throws `table user has no column named name` even
though `src/db/schema/org.ts` and `migrations/0039_user_name.sql` both
already declare/add that column (landed by task-w26-c) — the D1/wrangler
`db:migrate` path below is clean, so this looks like a stale fixture-
bootstrap gap specific to the in-process test harness, not the schema
itself; (2) `test/users-name-persistence.test.ts`'s two mutating cases 500
with `TypeError: db.select is not a function` thrown from
`getAnchorEventForOrg` (`src/server/repo/events.ts:96`) via `POST /api/v1/
users` (`src/routes/api/users.ts:100`). Neither diagnosed further or fixed
(log-only lane).

`test/spa-mutation-contract.scan.test.ts` (red since wave 16, `expect(gaps)
.toEqual([])` at :560) is **GREEN** at S — 6/6 tests passed — confirming
wave-26 lane c's fix (`POST /api/v1/users` now reads `firstName`/
`lastName`) landed and holds.

`npm run bundle:check` PASS: entry 69.19 kB gzip vs 300 kB budget (SPEC
§7). `rm -rf .wrangler && npm run db:migrate` PASS: all 40 migrations
0000-0039 applied clean, including `0039_user_name.sql`. `npm run seed`
PASS: D1 rows + 35 R2 objects seeded with no errors.

OPEN ITEMS: 2 — (1) in-process test SQLite fixture bootstrap missing
`user.name` column despite schema.ts/migrations already having it,
breaking 9+ test files; (2) `POST /api/v1/users` 500s via `db.select is
not a function` in `getAnchorEventForOrg` on the mutating path.
RESULT: FAIL — full-suite vitest run has 37 failing tests across 11 files
at S; build, bundle:check, db:migrate, and seed all PASS; the wave-16 red
spa-mutation-contract scan is confirmed GREEN.

