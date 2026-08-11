# task-w23-a — STAGE-1 Exit Gate 1/6: Build/Test/Tripwire/Bundle-Check/Fresh-Schema Evidence (main tip)

## FROZEN SHA

`e3d558ea5628cbe1a7260489c2c5ddc1d487c7db` (main tip at worktree creation,
commit message "scribe wave 23").

### DEC-361 presence check (wave-21 and wave-22 lanes)

`git log --oneline -60` at the FROZEN SHA. Raw log, lines 2-14:

```
3703b51 merge-train fix: DEC-357 test expects DEC-355's single chunked UPDATE
8574ee6 merge task-w22-e
34d276d DEC-357: batch CSV-import roster-add (set-based push-to-event)
530dd08 merge task-w22-d
32926e6 merge task-w22-c
1789274 DEC-356: CSV import looks up only the file's emails, not the whole org
d7122b0 DEC-355: make bulk acceptance planning set-based
33eeac7 merge task-w22-a
e34db85 DEC-353: bound bulk ZIP archive to a 40MB total-byte budget
cb32e0f merge task-w22-b
fc77740 DEC-354: close reviewer-assignment FK hole at write path and repo predicate
24155d9 scribe wave 22
7570072 merge task-w21-c
```

and lines 15-19 (continuing further back):

```
dfca1f7 docs: wave-21 authoritative perf:smoke gate log (DEC-352)
87b802c merge task-w21-e
0d8c941 merge task-w21-a
010d2c5 DEC-351: /progress and /remind stop loading full evaluation rows
005e367 merge task-w21-b
```

Lane-by-lane presence:

- **task-w21-a** — PRESENT (`0d8c941 merge task-w21-a`).
- **task-w21-b** — PRESENT (`005e367 merge task-w21-b`).
- **task-w21-c** — PRESENT (`7570072 merge task-w21-c`).
- **task-w21-d** — PRESENT (`c84d8ec merge task-w21-d`, at line 20 of the
  60-line window).
- **task-w21-e** — PRESENT (`87b802c merge task-w21-e`).
- **task-w22-a** — PRESENT (`33eeac7 merge task-w22-a`).
- **task-w22-b** — PRESENT (`cb32e0f merge task-w22-b`).
- **task-w22-c** — PRESENT (`32926e6 merge task-w22-c`).
- **task-w22-d** — PRESENT (`530dd08 merge task-w22-d`).
- **task-w22-e** — PRESENT (`8574ee6 merge task-w22-e`).

All ten required merge commits are present in the 60-line window. No
re-check loop was needed.

Code-fact corroboration:

```
grep -n ARCHIVE_MAX_TOTAL_BYTES src/routes/files.ts
```
```
228:export const ARCHIVE_MAX_TOTAL_BYTES = 40 * 1024 * 1024;
254:  if (totalBytes > ARCHIVE_MAX_TOTAL_BYTES) {
256:    const capMb = (ARCHIVE_MAX_TOTAL_BYTES / (1024 * 1024)).toFixed(0);
```

```
grep -n trackExistsInEvent src/routes/review/plans.ts
```
```
189:    const trackOk = await repo.trackExistsInEvent(c.var.db, trackId, plan.eventId);
```

```
grep -rn DEC-355 src/server/repo/submissions/status.ts
```
```
105: * DEC-355: set-based core shared by ensureOnboardingTasks (single-submission
324:    // DEC-355 set-based planning: ONE chunked participant SELECT for all
```

```
grep -rn DEC-356 src/server/repo/contacts/import.ts
```
```
27:/** Hard cap on rows per CSV import (DEC-356): protects against an unbounded
35: * DEC-356: rather than loading the org's entire contact table, this looks up
```

```
grep -rn DEC-357 src/routes/api/contacts.ts
```
Result: **0 matches** at the literal path given in the task. Corroboration
was found instead at `src/server/repo/contacts/push.ts:57` ("Set-based
counterpart to pushContactToEvent (DEC-357), for batch roster ..."), which is
imported and used by `src/routes/api/contacts.ts` (that route file imports
`import * as repo from "../../server/repo/contacts"`, whose index re-exports
`push.ts`). Functionally DEC-357 is present and wired into the contacts API
route; only the exact grep target file:line in the task brief was stale
(the DEC-357 marker comment lives in the repo module, not the route file).
Logged under POST-S DELTA below, not treated as a missing lane per DEC-361
(the merge-commit presence check, which is definitive, showed all ten lanes
present).

## Step 1: `npm ci`

```
npm ci --prefer-offline --no-audit --no-fund
```

Result: `added 366 packages in 3s`. Clean install, no errors.

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
✓ built in 658ms
```

- First `tsc --noEmit` (root, server/core code): 0 errors, exited clean.
- Second `tsc --noEmit -p app/tsconfig.json` (SPA): 0 errors, exited clean.
- `vite build`: succeeded, 136 modules transformed, 20 output chunks emitted.

Confirmed `"strict": true` is still set in both `tsconfig.json` (line 6) and
`app/tsconfig.json` (line 8).

## Step 3: `npm test`

Ran verbatim `npm test`. Result:

```
Test Files  235 passed (235)
     Tests  1950 passed (1950)
  Start at  18:20:25
  Duration  24.24s (transform 4.84s, setup 0ms, collect 71.99s, tests 30.38s, environment 12.21s, prepare 16.14s)
```

All 235 test files / 1950 tests passed, 0 failed, 0 skipped.

Skip-pattern grep:

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

## Step 5: `npm run bundle:check` (DEC-058/186/226/284)

Not run at the wave-21 gate; recorded here in full for the first time.

```
> bundle:check
> tsx scripts/bundle-check.ts

Bundle chunk sizes (public/admin/assets):

file                              raw          gzip
index-wZmPmRXe.js                 175.97 kB    57.54 kB
Contacts-RS-B5RRH.js              29.77 kB     8.02 kB
Review-hfmukXBc.js                29.55 kB     7.94 kB
Settings-CVu53IpC.js              19.19 kB     5.13 kB
Content-BD2xaPj-.js               15.48 kB     4.93 kB
Speakers-DZ0p6h2t.js              13.23 kB     4.05 kB
Submissions-S46oDovE.js           11.15 kB     3.77 kB
Comms-G4xqLaz7.js                 12.01 kB     3.61 kB
FormsPage-DPbyhWI1.js             10.07 kB     3.35 kB
Agenda-CQxUYI6b.js                8.09 kB      2.89 kB
SubmissionDetailPage-om-smVgy.js  9.36 kB      2.84 kB
ImportWizard-BkT89Zad.js          6.14 kB      2.51 kB
index-easpJsYc.css                4.48 kB      1.34 kB
Overview-s0SYl1zJ.js               3.06 kB     1.22 kB
useCurrentEvent-DEC1sod7.js       0.64 kB      0.40 kB
dates-AozCN46i.js                 0.66 kB      0.32 kB
columns-H9BM_BWy.js               0.46 kB      0.30 kB
filters-DykXP0H-.js               0.46 kB      0.27 kB
NotFound-CYD9hJsr.js              0.36 kB      0.25 kB
types-CEJHopH4.js                 0.34 kB      0.21 kB

Entry bundle: index-wZmPmRXe.js + index-easpJsYc.css = 58.89 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

Entry bundle gzip (58.89 kB) is well under the 300 kB budget. PASSED.

## Step 6: Fresh-schema proof

```
rm -rf .wrangler/state
npm run db:migrate   # wrangler d1 migrations apply chautauqua --local
npm run seed          # tsx scripts/seed.ts && wrangler d1 execute ... && tsx scripts/seed-r2.ts
```

`ls migrations/` shows **18 files** (numbers 0000-0018 with the pre-existing,
intentional gap at 0011 — matches wave-21's count of 18, unchanged):

```
0000_secret_matthew_murdock.sql
0001_worthless_arachne.sql
0002_narrow_vulcan.sql
0003_w2c_form_open_date.sql
0004_wave3.sql
0005_w4_segment.sql
0006_w4_api_token.sql
0007_w4_saved_view.sql
0008_w7_ics_sequence.sql
0009_review_rounds.sql
0010_round_criteria.sql
0012_pipeline.sql
0013_submission_revision.sql
0014_task_deliverable_kind.sql
0015_participant_attribution.sql
0016_w4c2_fk_indexes.sql
0017_review_recusal.sql
0018_w18_scale_indexes.sql
```

`db:migrate` applied all 18 to a clean local D1 instance; all 18 reported
status `✅`.

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

## Step 7: `npm audit`

```
npm audit --omit=dev
```
Result: `found 0 vulnerabilities` — zero production-dependency advisories.

```
npm audit
```
Result: 4 vulnerabilities (2 moderate, 2 high), all in devDependencies:

- `form-data` 4.0.0-4.0.5 (high, CRLF injection via unescaped multipart
  field names/filenames) — transitive dep of `jsdom` (test-only).
- `lodash` <=4.17.23 (high, code injection via `_.template` / prototype
  pollution via `_.unset`/`_.omit`) — transitive dep of test tooling.
- `react-router` / `react-router-dom` 6.0.0-7.17.0 (moderate, open redirect
  via backslash in `<Link>`/`useNavigate`; arbitrary constructor injection
  via `deserializeErrors()` in SSR hydration) — `react-router-dom` is
  declared in `package.json`'s `devDependencies` block.

`npm audit --omit=dev`'s "0 vulnerabilities" corroborates that `package.json`
`dependencies` (`drizzle-orm`, `hono`) does not pull in any of the four
flagged packages. Per DEC-302, these are recorded findings, not open items.

## OPEN ITEMS: 0

No fix commits were required — every step passed on first run at this
FROZEN SHA with no code changes beyond this verification-log file. No server
was started; no ports were used for any step in this gate (per the task
brief, "no ports").

## RESULT: PASS

## RECHECK SHA

`e3d558ea5628cbe1a7260489c2c5ddc1d487c7db` (unchanged — no fixes were
needed, so no new commit altered the tree beyond this verification-log file
itself).

## POST-S DELTA

Non-empty, logged per DEC-280 (a non-empty delta is logged, never a STOP):

- **DEC-357 grep-target mismatch.** The task brief's code-fact check
  `grep -rn DEC-357 src/routes/api/contacts.ts` returns 0 matches; the
  DEC-357 marker comment actually lives in
  `src/server/repo/contacts/push.ts:57` ("Set-based counterpart to
  pushContactToEvent (DEC-357), for batch roster ..."), which is imported by
  and used from `src/routes/api/contacts.ts`. Functionally the feature is
  present and wired in; the discrepancy is purely which file carries the
  `DEC-357` text marker. Did not trigger a re-check loop because the
  merge-commit presence check (the definitive DEC-361 signal) showed all ten
  required lanes present in the 60-line log window.
- This verification-log file itself
  (`docs/verification-log/task-w23-a-c3-build-test.md`) is new, added by
  this task.
- Local, git-ignored working-tree artifacts produced by running the
  fresh-schema proof and seed: `.wrangler/state/**` (recreated D1/R2 local
  storage) and `.seed.sql` (generated seed SQL dump). These are build/dev
  artifacts, not source changes, and are not committed.
- `npm run bundle:check` (Step 5) ran for the first time at a wave-23 gate
  (not run at wave-21); it PASSED with the entry bundle at 58.89 kB gzip
  against a 300 kB budget.

## Not covered by this gate

Per DEC-359 (six-gate exit set), this gate (task-w23-a) covers build/test/
tripwires/bundle-check/fresh-schema/audit only. The render-sweep,
spec/rubric audit, full six-module walkthrough, fresh-clone+cron proof, and
`perf:smoke` are separate wave-23 lanes (task-w23-b..f) and are not run
here.
