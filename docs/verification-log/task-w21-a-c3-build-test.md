# task-w21-a — Wave-21 Gate: Build/Test/Tripwire/Fresh-Schema Evidence (main tip)

## FROZEN SHA

`c84d8ecc55f911c331f91bb677d2b1044b0eb324` (main tip at worktree creation,
commit message "merge task-w21-d"). Note: an initial worktree was created at
an earlier tip (`27c751e8e2b9eb497017c4675150f140890b02bf`, "scribe wave 21")
and Steps 1-6 were fully run and green there, but that worktree and its
`task-w21-a` branch were externally removed mid-task (observed as a `fatal:
not a git repository` error when running `git status` immediately after
writing this file the first time; `git worktree list` in the main checkout no
longer showed the worktree or branch — presumably concurrent swarm activity
pruned it, matching the phenomenon logged in `task-w20-e-c3-build-test.md`).
The worktree and branch were recreated from `main` at its new tip above (via
`git worktree prune` then `git worktree add ... -b task-w21-a main`), and all
steps were re-run in full from a clean `npm ci`. This log reports only the
evidence gathered at the FROZEN SHA recorded here.

Presence check of the wave-19 and wave-20 lanes named in the task, verified
via `git log --oneline --all | grep -i "<lane>"` plus `git merge-base
--is-ancestor <sha> HEAD` at the FROZEN SHA:

- **task-w19-a** — PRESENT (`6ed7615 merge task-w19-a`).
- **task-w19-b** — PRESENT (`9c2400f merge task-w19-b`).
- **task-w19-c** — PRESENT (`15ed651 merge task-w19-c`).
- **task-w19-d** — PRESENT (`791c0f6 merge task-w19-d`).
- **task-w19-e** — PRESENT (`ce49fd6 merge task-w19-e`).
- **task-w20-a** (DEC-344 files library) — PRESENT (`20bd5b3 merge
  task-w20-a`). Per the task brief, this lane was still an unmerged branch
  at plan time; it landed on `main` before this gate started.
- **task-w20-b** — PRESENT (`a44066a merge task-w20-b`).
- **task-w20-c** — PRESENT (`7e795e1 merge task-w20-c`).
- **task-w20-d** (DEC-347 perf-seed extension for files library + review
  scale) — PRESENT (`7056ecb merge task-w20-d`, containing `5113485 DEC-347:
  extend perf harness for files library + review scale` and `d91cabe docs:
  verification log for task-w20-d perf-smoke baseline (DEC-347)`). Per the
  task brief, this lane was also still an unmerged branch at plan time; at
  the first (lost) worktree's tip (`27c751e`) it was confirmed ABSENT via
  `git merge-base --is-ancestor 5113485... HEAD` (reported "NOT ANCESTOR")
  and logged as a POST-S DELTA. It merged into `main` in the interim
  (visible above as `merge task-w20-d`, itself containing `merge
  task-w20-d` at `7056ecb` on top of the wave-19-tip commit `27c751e`) and
  is PRESENT at this (recreated, later) FROZEN SHA.
- **task-w20-e** — PRESENT (`12cf28b merge task-w20-e`).
- **task-custodian-w20-4** — PRESENT (`dff7ae8 merge task-custodian-w20-4`).

All 11 named lanes are present in this FROZEN SHA's ancestry (task-w20-d was
absent at the earlier, lost worktree's tip but has since merged — see
POST-S DELTA below). `task-w21-d` had also already merged into `main` by the
time this worktree was recreated (visible as the FROZEN SHA's own commit
message, "merge task-w21-d"); that is expected concurrent-wave activity, not
a defect in this gate.

## Step 1: `npm ci`

```
npm ci --prefer-offline --no-audit --no-fund
```

Result: `added 366 packages in 2s`. Clean install, no errors.

## Step 2: `npm run build`

Ran verbatim `npm run build`, which executes:
`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`

Output:

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...
✓ 136 modules transformed.
rendering chunks...
computing gzip size...
../public/admin/index.html                                 0.41 kB │ gzip:  0.27 kB
../public/admin/assets/index-easpJsYc.css                  4.59 kB │ gzip:  1.38 kB
../public/admin/assets/types-CEJHopH4.js                   0.35 kB │ gzip:  0.22 kB
../public/admin/assets/NotFound-CYD9hJsr.js                0.37 kB │ gzip:  0.25 kB
../public/admin/assets/filters-DykXP0H-.js                 0.47 kB │ gzip:  0.28 kB
../public/admin/assets/columns-H9BM_BWy.js                 0.47 kB │ gzip:  0.31 kB
../public/admin/assets/useCurrentEvent-DEC1sod7.js         0.66 kB │ gzip:  0.41 kB
../public/admin/assets/dates-AozCN46i.js                   0.68 kB │ gzip:  0.32 kB
../public/admin/assets/Overview-s0SYl1zJ.js                3.13 kB │ gzip:  1.25 kB
../public/admin/assets/ImportWizard-BkT89Zad.js            6.29 kB │ gzip:  2.57 kB
../public/admin/assets/Agenda-CQxUYI6b.js                  8.29 kB │ gzip:  2.96 kB
../public/admin/assets/SubmissionDetailPage-om-smVgy.js    9.58 kB │ gzip:  2.91 kB
../public/admin/assets/FormsPage-DPbyhWI1.js              10.32 kB │ gzip:  3.43 kB
../public/admin/assets/Submissions-S46oDovE.js            11.42 kB │ gzip:  3.86 kB
../public/admin/assets/Comms-G4xqLaz7.js                  12.30 kB │ gzip:  3.70 kB
../public/admin/assets/Speakers-DZ0p6h2t.js               13.55 kB │ gzip:  4.15 kB
../public/admin/assets/Content-BD2xaPj-.js                15.86 kB │ gzip:  5.05 kB
../public/admin/assets/Settings-CVu53IpC.js               19.65 kB │ gzip:  5.26 kB
../public/admin/assets/Review-hfmukXBc.js                 30.26 kB │ gzip:  8.13 kB
../public/admin/assets/Contacts-RS-B5RRH.js               30.48 kB │ gzip:  8.21 kB
../public/admin/assets/index-wZmPmRXe.js                 180.20 kB │ gzip: 58.93 kB
✓ built in 611ms
```

- First `tsc --noEmit` (root, server/core code): 0 errors, exited clean.
- Second `tsc --noEmit -p app/tsconfig.json` (SPA): 0 errors, exited clean.
- `vite build`: succeeded, 136 modules transformed, 21 output chunks emitted.

Confirmed strict mode is still on in both tsconfigs (`tsconfig.json` and
`app/tsconfig.json` both have `"strict": true,`).

Full build log had 0 occurrences of the string "error" (`grep -c "error"
build.log` → 0).

## Step 3: `npm test`

Ran verbatim `npm test`. Result:

```
Test Files  229 passed (229)
     Tests  1928 passed (1928)
  Start at  17:49:40
  Duration  19.33s (transform 4.41s, setup 0ms, collect 50.64s, tests 22.78s, environment 11.23s, prepare 13.99s)
```

All 229 test files / 1928 tests passed, 0 failed, 0 skipped. (Up from
1914/228 recorded at the first, lost run of this same task at the earlier
tip, and from 1905/228 at the prior `task-w20-e` gate — consistent with
`task-w20-d`, `task-w21-d`, and other wave-21 lanes merging in the interim.)

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

- `test/schema-fk-indexes.test.ts` — 1 test passed
- `test/migration-parity.test.ts` — 2 tests passed
- `test/spa-contract-sweep.test.ts` — 8 tests passed
- `test/docs-route-coverage.test.ts` — 2 tests passed

## Step 5: Fresh-schema proof

```
rm -rf .wrangler/state
npm run db:migrate   # wrangler d1 migrations apply chautauqua --local
npm run seed          # tsx scripts/seed.ts && wrangler d1 execute ... && tsx scripts/seed-r2.ts
```

`db:migrate` applied all 18 migration files present in `migrations/` (numbers
0000-0018 with a pre-existing, intentional gap at 0011 — unchanged since the
`task-w20-e` gate, and unchanged by `task-w20-d`'s perf-harness-only DEC-347
work) to a clean local D1 instance. All 18 reported status `✅`:

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
`wrangler d1 execute`, then `seed-r2.ts` put 8 objects into the local R2
bucket `chautauqua-files` ("seed-r2: put 8 object(s) into local R2 bucket
'chautauqua-files'"). No errors.

Re-ran `test/migration-parity.test.ts` and `test/schema-fk-indexes.test.ts`
against the freshly-applied local D1 schema after seeding — both green:

```
Test Files  2 passed (2)
     Tests  3 passed (3)
```

confirming per DEC-337 that every index declared in `src/db/schema.ts` has a
corresponding `CREATE INDEX` migration that was actually applied to D1.

## Step 6: `npm audit`

```
npm audit --omit=dev
```
Result: `found 0 vulnerabilities` — zero production-dependency advisories.

```
npm audit
```
Result: 4 vulnerabilities (2 moderate, 2 high), all in devDependencies —
unchanged from the `task-w20-e` gate:

- `form-data` 4.0.0–4.0.5 (high, CRLF injection) — transitive dep of `jsdom`
  (test-only).
- `lodash` <=4.17.23 (high, code injection / prototype pollution) — transitive
  dep of `@testing-library/jest-dom` (test-only).
- `react-router` / `react-router-dom` 6.0.0–7.17.0 (moderate, open redirect /
  constructor injection) — `react-router-dom` is declared in the
  devDependencies block of `package.json` (`"react-router-dom": "^6.28.0"`).

`npm ls form-data lodash react-router react-router-dom` confirms all four
resolve only under dev-tooling packages:

```
chautauqua@ .../task-w21-a
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

0 (none). No fix commits were required — every step passed on first run at
this FROZEN SHA with no code changes beyond this verification-log file. No
server was started; ports 8821/8822 were not used for any step in this gate.

## RESULT: PASS

## RECHECK SHA

`c84d8ecc55f911c331f91bb677d2b1044b0eb324` (unchanged — no fixes were needed,
so no new commit altered the tree beyond this verification-log file itself).

## POST-S DELTA

Non-empty, logged per DEC-280 (a non-empty delta is logged, never a STOP):

- **Worktree/branch loss and recreation.** The FROZEN SHA advanced from
  `27c751e` ("scribe wave 21") to `c84d8ec` ("merge task-w21-d") between the
  first (lost) run and the second (reported) run, because `task-w20-d` and
  `task-w21-d` (and other wave-21 lanes) merged into `main` in the interim.
  This is a scheduling artifact of running inside an active swarm — the same
  phenomenon `task-w20-e-c3-build-test.md` documented for its own gate — not
  a defect surfaced by this gate.
- **`task-w20-d` absence, now resolved.** At the first (lost) worktree's tip
  (`27c751e`), `task-w20-d` (DEC-347) was confirmed absent via
  `git merge-base --is-ancestor`, matching the task brief's expectation that
  it was still an unmerged branch at plan time. It has since merged and is
  PRESENT at this FROZEN SHA — see the FROZEN SHA section above. Per
  instructions this was CONTINUE, not STOP, at the time it was observed.
- This verification-log file itself
  (`docs/verification-log/task-w21-a-c3-build-test.md`) is new, added by
  this task.
- Local, git-ignored working-tree artifacts produced by running the
  fresh-schema proof and seed: `.wrangler/state/**` (recreated D1/R2 local
  storage) and `.seed.sql` (generated seed SQL dump). These are build/dev
  artifacts, not source changes, and are not committed.

## Not covered by this gate

Per DEC-352, this gate (task-w21-a) covers build/test/tripwires/fresh-schema/
audit only. The full six-module walkthrough and the authoritative
`perf:smoke` run are separate wave-21 lanes and are not run here. Neither was
run as part of this task.
