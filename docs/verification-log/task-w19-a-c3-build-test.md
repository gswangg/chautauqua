# task-w19-a — Campaign-2 Wave 19 Gate: Build/Test Evidence (post-wave-18 tip)

## FROZEN SHA

`48387c39d71bc3b4420046a14a3eb62b18a3eb49` (main tip at worktree creation, commit message
"scribe wave 19"). Wave 18 rewrote `src/server/repo/overview.ts`,
`src/server/repo/submissions/list.ts`, `src/server/repo/contacts/crud.ts`,
`src/domain/contacts.ts`, `src/db/schema.ts` and added
`migrations/0018_w18_scale_indexes.sql`, so all earlier build/test evidence (including
the pre-existing `task-w19-a-build-test.md`) is stale by construction. This log
re-establishes evidence at the FROZEN SHA above.

## Step 1: `npm ci`

`node_modules` was absent in the freshly created worktree, so ran:

```
npm ci --prefer-offline --no-audit --no-fund
```

Result: `added 366 packages in 2s`. Clean install, no errors.

## Step 2: `npm run build`

Ran verbatim `npm run build`, which executes:
`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`

- First `tsc --noEmit` (root, server/core code): 0 errors, exited clean.
- Second `tsc --noEmit -p app/tsconfig.json` (SPA): 0 errors, exited clean.
- `vite build`: succeeded, 138 modules transformed, 21 output chunks emitted to
  `../public/admin/assets/*`, `✓ built in 609ms`.

Confirmed strict mode is still on in both tsconfigs:
- `tsconfig.json:6` → `"strict": true,`
- `app/tsconfig.json:8` → `"strict": true,`

Full build log had 0 occurrences of the string "error" (grep -c "error" build.log → 0).

## Step 3: `npm test`

Ran verbatim `npm test`. Result:

```
Test Files  226 passed (226)
     Tests  1890 passed (1890)
  Start at  16:44:34
  Duration  22.66s
```

All 226 test files / 1890 tests passed, 0 failed, 0 skipped.

Skip-pattern grep across `test/` and `app/src/`:

```
grep -rn '\.skip(\|it\.todo\|xit(\|describe\.skip' test/ app/src/
```

Result: 0 matches.

## Step 4: Tripwires

```
npx vitest run test/docs-route-coverage.test.ts test/spa-contract-sweep.test.ts \
  test/schema-fk-indexes.test.ts test/migration-parity.test.ts
```

Result:

```
Test Files  4 passed (4)
     Tests  13 passed (13)
```

- `test/migration-parity.test.ts` — 2 tests passed
- `test/schema-fk-indexes.test.ts` — 1 test passed
- `test/spa-contract-sweep.test.ts` — 8 tests passed
- `test/docs-route-coverage.test.ts` — 2 tests passed

## Step 5: Fresh-schema proof

```
rm -rf .wrangler/state
npm run db:migrate   # wrangler d1 migrations apply chautauqua --local
npm run seed          # tsx scripts/seed.ts && wrangler d1 execute ... && tsx scripts/seed-r2.ts
```

`db:migrate` applied all 18 migration files present in `migrations/` (numbering
0000-0018 with a pre-existing, intentional gap at 0011 — not introduced by this
task) to a clean local D1 instance. All 18 reported status `✅`:

```
0000_secret_matthew_murdock.sql  ✅
0001_worthless_arachne.sql       ✅
0002_narrow_vulcan.sql           ✅
0003_w2c_form_open_date.sql      ✅
0004_wave3.sql                   ✅
0005_w4_segment.sql              ✅
0006_w4_api_token.sql            ✅
0007_w4_saved_view.sql           ✅
0008_w7_ics_sequence.sql         ✅
0009_review_rounds.sql           ✅
0010_round_criteria.sql          ✅
0012_pipeline.sql                ✅
0013_submission_revision.sql     ✅
0014_task_deliverable_kind.sql   ✅
0015_participant_attribution.sql ✅
0016_w4c2_fk_indexes.sql         ✅
0017_review_recusal.sql          ✅
0018_w18_scale_indexes.sql       ✅
```

`npm run seed` completed successfully: seed SQL applied via
`wrangler d1 execute`, then `seed-r2.ts` put 8 objects into the local R2 bucket
`chautauqua-files` ("seed-r2: put 8 object(s) into local R2 bucket
'chautauqua-files'"). No errors.

Re-ran `test/migration-parity.test.ts` and `test/schema-fk-indexes.test.ts`
against the freshly-applied local D1 schema after seeding — both green (3
tests, 3 passed), confirming per DEC-337 that every index declared in
`src/db/schema.ts`, including the wave-18 additions in
`0018_w18_scale_indexes.sql`, has a corresponding `CREATE INDEX` migration
that was actually applied to D1.

## Step 6: `npm audit`

```
npm audit --omit=dev
```
Result: `found 0 vulnerabilities` — zero production-dependency advisories.

```
npm audit
```
Result: 4 vulnerabilities (2 moderate, 2 high), all in devDependencies:

- `form-data` 4.0.0–4.0.5 (high, CRLF injection) — transitive dep of `jsdom`
  (test-only).
- `lodash` <=4.17.23 (high, code injection / prototype pollution) — transitive
  dep of `@testing-library/jest-dom` (test-only).
- `react-router` / `react-router-dom` 6.0.0–7.17.0 (moderate, open redirect /
  constructor injection) — listed in the devDependencies block of
  `package.json` (line 35, alongside `jsdom`, `playwright`, `react`,
  `react-dom`).

`npm ls form-data lodash react-router react-router-dom` confirms all four
resolve only under dev-tooling packages (`@testing-library/jest-dom`, `jsdom`)
or the devDependencies-declared `react-router-dom`. `npm audit --omit=dev`
returning 0 vulnerabilities corroborates npm's own dev/prod classification.
Per DEC-302, these are recorded findings, not open items.

## OPEN ITEMS

0 (none). No fix commits were required — every step passed on first run at the
FROZEN SHA with no code changes.

## RESULT: PASS

## RECHECK SHA

`48387c39d71bc3b4420046a14a3eb62b18a3eb49` (unchanged — no fixes were needed,
so no new commit altered the tree beyond this verification-log file itself).

## POST-S DELTA

Non-empty, logged per DEC-280 (a non-empty delta is logged, never a STOP):

- This verification-log file itself
  (`docs/verification-log/task-w19-a-c3-build-test.md`) is new, added by this
  task.
- Local, git-ignored working-tree artifacts produced by running the fresh-
  schema proof and seed: `.wrangler/state/**` (recreated D1/R2 local storage)
  and `.seed.sql` (generated seed SQL dump). These are build/dev artifacts,
  not source changes, and are not committed.
