# task-w17-c: BUILD + FULL SUITE + BUNDLE + FRESH-MIGRATION gate (wave 17)

- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w17-c`
- Tip measured (`git rev-parse HEAD`, worktree base before this task's log-only commit): `62685d2eea8b8fe2262fcde1f7d09617a61d5b5a` ("merge task-w16-f") — newer than the wave's floor reference `9b21309c`, includes the task-w16-f build-test log commit and the wave-17 scribe entry (`5fc3db38`) on top of task-w16-e/-b's merges.

## 1. `npm run build`

`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`

**PASS.** Root and `app/tsconfig.json` typecheck both zero-error; SPA vite build completed (276 modules transformed, entry `index-DitZzjP_.js` 201.78 kB / gzip 65.47 kB, built in 1.05s).

## 2. `npm run bundle:check` (DEC-058 gzip budget)

**PASS.** Entry bundle `index-DitZzjP_.js + index-4RjCBQE6.css` = 69.13 kB gzip, budget 300.00 kB. `bundle:check PASSED`.

## 3. `sh scripts/with-test-lock.sh vitest run` (single full-suite run of this wave, through the lock)

**Test Files: 1 failed | 1033 passed (1034)**
**Tests: 1 failed | 11258 passed (11259)**
**Duration: 230.83s** (transform 8.10s, setup 7.74s, collect 158.55s, tests 118.97s, environment 27.55s, prepare 39.09s)

**FAILING FILE (named individually):**

- `test/spa-mutation-contract.scan.test.ts` — test "SPA admin mutation <-> route contract (DEC-817 amendment, findings wave 13) > every extracted key appears as a token in its resolved route module's source"
  - `app/src/pages/settings/PeopleRolesPanel.tsx:113 POST /users: key "firstName" not found in src/routes/api/users.ts`
  - `app/src/pages/settings/PeopleRolesPanel.tsx:113 POST /users: key "lastName" not found in src/routes/api/users.ts`

**No files skipped.**

**Not a new regression — already filed by task-w16-f.** `docs/verification-log/task-w16-f-build-test.md` documents this exact failure in full: `POST /api/v1/users` (`src/routes/api/users.ts`) reads only `record.email`/`record.role`; `firstName`/`lastName` are never referenced anywhere in that file, and `repo.createUser`'s `CreateUserInput` (`src/server/repo/users.ts:94`) has no name fields — the org-user table has no name columns at all. I independently re-read both files this run and confirm the same gap still exists verbatim (unchanged since task-w16-f's run). `git log --oneline -3` on `src/routes/api/users.ts`, `app/src/pages/settings/PeopleRolesPanel.tsx`, and `test/spa-mutation-contract.scan.test.ts` (checked this run) shows no wave-16/17 commit touched any of the three since task-w16-f measured it — this is a genuine, still-unfixed product gap the scan test correctly catches, not a stale test. Fixing it requires either the SPA dropping the two fields it collects, or `POST /api/v1/users` gaining a real name-persistence path (a name column, or contact-linking) — both are feature-level changes, out of this log-only lane's REPAIR SCOPE (no refactor, no features). Left unfixed, as task-w16-f also left it.

Four `stderr`/`unhandled error` traces logged during the run (`test/cookie-flags.test.ts`, `test/users-create-mailer-failure.test.ts`, `test/scheduled-isolation.test.ts`, `test/html-error-shape.test.ts`) are each test's own intentional thrown-error fixture, not failures — all four files report `✓ PASS`.

## 4. FRESH-MIGRATION check (DEC-069 amendment)

No pre-existing `.wrangler/` directory was present in this worktree (`ls -la .wrangler` → "No such file or directory"), so there was no local D1/R2 state to move aside — the migrate+seed below ran against a genuinely empty database.

- `npm run db:migrate` (`wrangler d1 migrations apply chautauqua --local`): **PASS.** All 38 migrations (`0000_secret_matthew_murdock.sql` through `0038_form_field_role.sql`) applied in order, each ✅, no manual step, no gaps, no numbering collisions.
- `npm run seed` (`tsx scripts/seed.ts && wrangler d1 execute ... --file=.seed.sql && tsx scripts/seed-r2.ts`): **PASS.** Seed script completed with no errors; `seed-r2: put 35 object(s) into local R2 bucket 'chautauqua-files'` confirms the R2 seed step finished cleanly on top of the freshly-migrated D1 state.

## Repair scope taken

None. The single vitest failure is the same pre-existing, already-filed product gap task-w16-f documented (unchanged since); per REPAIR SCOPE this log-only lane does not implement feature-level fixes (SPA field removal or a new name-persistence path), only genuine build/typecheck/migration breaks introduced by this wave's merges — none were found. No file:line fix was made this run.

RESULT: PASS (build, bundle:check, fresh-migration) / 1 pre-existing test failure (not a regression, already filed by task-w16-f)
OPEN ITEMS: test/spa-mutation-contract.scan.test.ts — POST /api/v1/users (src/routes/api/users.ts) never reads firstName/lastName sent by app/src/pages/settings/PeopleRolesPanel.tsx:113; needs either SPA field removal or a real name-persistence path on the org-user create route (feature-level, out of this lane's scope; also flagged by task-w16-f).
