# task-w20-e — Campaign-2 Wave 19 Composition Gate: Build/Test Evidence (main tip)

## FROZEN SHA

`7e795e1397b57e16f1686dbf60b32e7007b7988e` (main tip at worktree creation, commit
message "merge task-w20-c"). Note: an initial worktree was created at an earlier
tip (`7c0eb662afbc3709189eb071bbb424c705f5a39d`, "scribe wave 20") and Steps 1-4
were fully run and green there, but that worktree and its `task-w20-e` branch
were externally removed mid-task (observed via `git worktree list` /
`git branch -a` no longer showing them — presumably concurrent swarm activity
pruned it). The worktree and branch were recreated from `main` at its new tip
above, and all steps were re-run in full from a clean `npm ci`. This log
reports only the evidence gathered at the FROZEN SHA recorded here.

Wave 19 rewrote `src/server/repo/tasks.ts` (onboarding grid), `src/routes/
tasks.ts`, `app/src/pages/speakers/OnboardingGrid.tsx`, the submissions-list
`contentStatus`/worklist path and `app/src/pages/content/*`, so earlier
build/test evidence is stale by construction. This log re-establishes it.

Per DEC-349(1), this is the wave-19 composition gate. Presence check of the
wave-19 lanes that were in flight when this wave was planned, verified via
`git log --oneline --all | grep -i "w19-"` at the FROZEN SHA:

- **task-w19-a** (gate lane build/test verification at post-wave-18 tip) —
  PRESENT (merge commits `6ed7615` / `8e84281`, on top of commits `e3039cf`).
- **task-w19-b** (walkthrough gate, DEC-135 battery) — PRESENT (merge commits
  `9c2400f` and `7fd9da7`, on top of commits `93d8a7f` / `2df0712`).
- **task-w19-c** (perf-smoke gate) — PRESENT (merge commits `15ed651` and
  `5f89797`, on top of commits `ca6ca71` / `061ffc9`).
- **task-w19-d** (spec-audit) — PRESENT (merge commits `992987b` and
  `791c0f6`, on top of commit `b07d503`).
- **task-w19-e** (triage-closure) — PRESENT (merge commits `ce49fd6` and
  `24f6f84`, on top of commit `a17d591`).

All five wave-19 lanes are present in the FROZEN SHA's ancestry. No POST-S
DELTA is required for an absent lane, since none are absent — see the
POST-S DELTA section below for other deltas. Wave-20 lanes `task-w20-b` and
`task-w20-c` had also already merged into main by the time this worktree was
(re)created (visible above as `merge task-w20-b` / `merge task-w20-c`); that
is expected concurrent-wave activity, not a defect in this gate.

## Step 1: `npm ci`

`node_modules` was absent in the freshly (re)created worktree, so ran:

```
npm ci --prefer-offline --no-audit --no-fund
```

Result: `added 366 packages in 5s`. Clean install, no errors.

## Step 2: `npm run build`

Ran verbatim `npm run build`, which executes:
`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`

- First `tsc --noEmit` (root, server/core code): 0 errors, exited clean.
- Second `tsc --noEmit -p app/tsconfig.json` (SPA): 0 errors, exited clean.
- `vite build`: succeeded, 136 modules transformed, 21 output chunks emitted to
  `../public/admin/assets/*`, `✓ built in 612ms`.

Confirmed strict mode is still on in both tsconfigs:
- `tsconfig.json:6` → `"strict": true,`
- `app/tsconfig.json:8` → `"strict": true,`

Full build log had 0 occurrences of the string "error" (`grep -c "error" build.log` → 0).

## Step 3: `npm test`

Ran verbatim `npm test`. Result:

```
Test Files  228 passed (228)
     Tests  1905 passed (1905)
  Start at  17:34:59
  Duration  19.22s (transform 4.22s, setup 0ms, collect 51.36s, tests 22.13s, environment 11.07s, prepare 13.99s)
```

All 228 test files / 1905 tests passed, 0 failed, 0 skipped. (Higher than the
1890/226 recorded at the wave-18 gate, `task-w19-a`, consistent with wave-19
and the already-merged wave-20-b/c lanes adding coverage.)

Skip-pattern grep across `test/` and `app/src/`:

```
grep -rn '\.skip(\|it\.todo\|xit(\|describe\.skip' test/ app/src/
```

Result: 0 matches (grep exit code 1 — no matches found).

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
0000-0018 with a pre-existing, intentional gap at 0011 — not introduced by
wave 19 or wave 20) to a clean local D1 instance. All 18 reported status `✅`:

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

No migration file was added by wave 19 or wave 20 — `ls migrations/` at the
FROZEN SHA lists the same 18 files (0000-0018, gap at 0011) as at the
`task-w19-a` gate. Wave 19's `src/server/repo/tasks.ts` and submissions-list
rewrites, and wave 20's DEC-345/DEC-346 result/queue changes, did not require
schema changes.

`npm run seed` completed successfully: seed SQL applied via
`wrangler d1 execute`, then `seed-r2.ts` put 8 objects into the local R2
bucket `chautauqua-files` ("seed-r2: put 8 object(s) into local R2 bucket
'chautauqua-files'"). No errors.

Re-ran `test/migration-parity.test.ts` and `test/schema-fk-indexes.test.ts`
against the freshly-applied local D1 schema after seeding — both green (3
tests, 3 passed), confirming per DEC-337 that every index declared in
`src/db/schema.ts` has a corresponding `CREATE INDEX` migration that was
actually applied to D1.

## Step 6: `npm audit`

```
npm audit --omit=dev
```
Result: `found 0 vulnerabilities` — zero production-dependency advisories.

```
npm audit
```
Result: 4 vulnerabilities (2 moderate, 2 high), all in devDependencies —
unchanged from the `task-w19-a` gate:

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
or the devDependencies-declared `react-router-dom`:

```
chautauqua@ .../task-w20-e
├─┬ @testing-library/jest-dom@6.6.3
│ └── lodash@4.17.21
├─┬ jsdom@25.0.1
│ └── form-data@4.0.5
└─┬ react-router-dom@6.30.4
  └── react-router@6.30.4
```

`npm audit --omit=dev` returning 0 vulnerabilities corroborates npm's own
dev/prod classification. Per DEC-302, these are recorded findings, not open
items.

## OPEN ITEMS

0 (none). No fix commits were required — every step passed on first run at the
FROZEN SHA with no code changes. No server was started; port 8812 was not
needed for any step in this gate.

## RESULT: PASS

## RECHECK SHA

`7e795e1397b57e16f1686dbf60b32e7007b7988e` (unchanged — no fixes were needed,
so no new commit altered the tree beyond this verification-log file itself).

## POST-S DELTA

Non-empty, logged per DEC-280 (a non-empty delta is logged, never a STOP):

- This verification-log file itself
  (`docs/verification-log/task-w20-e-c3-build-test.md`) is new, added by this
  task.
- The worktree/branch loss and recreation described in FROZEN SHA above: the
  FROZEN SHA advanced from `7c0eb66` to `7e795e1` between the first (lost) and
  second (reported) run, because wave-20 lanes `task-w20-b` and `task-w20-c`
  merged into `main` in the interim. This is a scheduling artifact of running
  inside an active swarm, not a defect surfaced by this gate.
- Local, git-ignored working-tree artifacts produced by running the fresh-
  schema proof and seed: `.wrangler/state/**` (recreated D1/R2 local storage)
  and `.seed.sql` (generated seed SQL dump). These are build/dev artifacts,
  not source changes, and are not committed.

## Not covered by this gate (per DEC-349)

This is NOT the final gate. DEC-349 assigns the full six-module walkthrough
and the authoritative `perf:smoke` run to wave 21, to be run at ONE sha with
all wave-19 and wave-20 lanes present (ports d=8811, e=8812). Neither the
walkthrough orchestrator nor `perf:smoke` was run as part of this task; this
log covers only build/test/tripwires/fresh-schema/audit per DEC-349(1)'s
wave-19 composition gate scope.
