# task-w27-c: build + test evidence lane (DEC-507, wave 27 sha)

Verification only. No product behavior changed.

Environment: node `v24.1.0`, npm `11.3.0`.

## `git rev-parse HEAD`

```
$ git rev-parse HEAD
2950e40fed71ab2dd9924414487bf49341ad6d7f
```

Freezing this sha as the literal for this artifact: **`2950e40fed71ab2dd9924414487bf49341ad6d7f`**.

## `git log --oneline -12`

```
$ git log --oneline -12
2950e40 scribe wave 27
5ef2486 merge task-w26-f
1ca9d6f merge task-w26-c
867f058 merge task-w26-d
db97baa merge task-w26-e
4342353 merge task-w25-f
30de7a1 DEC-504: fix README alternate-port quickstart to include predev
ac96388 DEC-501: delete stale answers for portal-edit-hidden fields
3e2afa9 DEC-502: window the JSON embed feed to one page, not the cumulative prefix
667d603 merge task-w26-b
11c127b DEC-503: fix phone-sweep manifest parity for embed/schedule + embed/gallery
101c8d9 docs(verification-log): stage-1 completion ledger (DEC-496, task-w25-f)
```

## `npm i`

```
$ npm i
added 366 packages, and audited 367 packages in 3s

64 packages are looking for funding
  run `npm fund` for details

4 vulnerabilities (2 moderate, 2 high)

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
```

(pre-existing `npm audit` advisories in transitive deps; out of scope for this evidence lane, not a build/test failure.)

## `npm run build`

`build` = `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...

/fonts/FamiljenGrotesk-var.woff2 referenced in /fonts/FamiljenGrotesk-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime

/fonts/Figtree-var.woff2 referenced in /fonts/Figtree-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime
✓ 155 modules transformed.
rendering chunks...
computing gzip size...
../public/admin/index.html                                  0.62 kB │ gzip:  0.33 kB
../public/admin/assets/Settings-DyiNaKEH.css                3.53 kB │ gzip:  0.97 kB
../public/admin/assets/FormsPage-CfB824cN.css               4.08 kB │ gzip:  1.03 kB
../public/admin/assets/Speakers-DLf3hUZv.css                4.31 kB │ gzip:  1.03 kB
../public/admin/assets/Content-ZNNVBerL.css                 4.39 kB │ gzip:  1.05 kB
../public/admin/assets/Overview-VbSISKfW.css                4.66 kB │ gzip:  1.11 kB
../public/admin/assets/Contacts-Bghxb9Tv.css                5.28 kB │ gzip:  1.21 kB
../public/admin/assets/SubmissionDetailPage-CJP2LPId.css    5.30 kB │ gzip:  1.29 kB
../public/admin/assets/Agenda-BUVBFwyi.css                  5.61 kB │ gzip:  1.25 kB
../public/admin/assets/Comms-geJfdN3P.css                   5.67 kB │ gzip:  1.25 kB
../public/admin/assets/Review-B-Wm165v.css                  5.98 kB │ gzip:  1.21 kB
../public/admin/assets/Submissions-Bu6LtK62.css             6.63 kB │ gzip:  1.37 kB
../public/admin/assets/ImportWizard-BekNN279.css            7.71 kB │ gzip:  1.43 kB
../public/admin/assets/index-BOb7RLKn.css                  17.87 kB │ gzip:  3.60 kB
../public/admin/assets/types-CEJHopH4.js                    0.35 kB │ gzip:  0.22 kB
../public/admin/assets/filters-DykXP0H-.js                  0.47 kB │ gzip:  0.28 kB
../public/admin/assets/columns-H9BM_BWy.js                  0.47 kB │ gzip:  0.31 kB
../public/admin/assets/NotFound-CDEMcbxm.js                 0.57 kB │ gzip:  0.34 kB
../public/admin/assets/dates-C3d6Pa2g.js                    0.68 kB │ gzip:  0.33 kB
../public/admin/assets/ImportWizard-PFdzTHL0.js             7.39 kB │ gzip:  2.82 kB
../public/admin/assets/Overview-Dpmupge5.js                10.89 kB │ gzip:  2.88 kB
../public/admin/assets/SubmissionDetailPage-CArCv1SZ.js    11.66 kB │ gzip:  3.19 kB
../public/admin/assets/FormsPage-CVlwTwsU.js               12.35 kB │ gzip:  3.75 kB
../public/admin/assets/Submissions-DIyQ3kC2.js             14.15 kB │ gzip:  4.20 kB
../public/admin/assets/Agenda-DfW4f3Xw.js                  16.44 kB │ gzip:  4.93 kB
../public/admin/assets/Comms-Bzvcs_2H.js                   17.31 kB │ gzip:  4.70 kB
../public/admin/assets/Content-CiRLN_vu.js                 18.28 kB │ gzip:  5.36 kB
../public/admin/assets/Speakers-CLaU0dlv.js                20.50 kB │ gzip:  5.14 kB
../public/admin/assets/Settings-Bk3J-6wA.js                22.67 kB │ gzip:  5.81 kB
../public/admin/assets/Review-BlBuEh9I.js                  36.14 kB │ gzip:  8.79 kB
../public/admin/assets/Contacts-CxuGBVLX.js                40.72 kB │ gzip:  9.82 kB
../public/admin/assets/index-Flt4w77N.js                  183.82 kB │ gzip: 59.95 kB
✓ built in 917ms
```

Result: **PASS** -- `tsc --noEmit` (src), `tsc --noEmit -p app/tsconfig.json` (SPA), and the Vite build all completed with zero errors. The two font-resolution notices are informational (fonts served at runtime, not bundled) and are not errors.

## `npm test` (vitest run)

Full output not reproduced in full (2798 individual test lines); summary line and every stderr/failure line are recorded verbatim below.

```
 Test Files  306 passed (306)
      Tests  2798 passed (2798)
   Start at  08:30:06
   Duration  30.93s (transform 5.86s, setup 0ms, collect 89.26s, tests 44.04s, environment 14.83s, prepare 19.56s)
```

Passed: 2798. Failed: 0. Skipped: 0.

The `stderr |` lines observed during the run are expected, intentional console output from tests that deliberately exercise mailer-failure / best-effort-notice code paths (DEC-238 class 2), not failures:

- `test/tasks-due-reminders-mailer-failure.test.ts` -- `sendDueRemindersForEvent` (src/server/repo/tasks/reminders.ts:277) logs the simulated provider rejection it is asserting against.
- `test/tasks-remind-now-mailer-failure.test.ts` -- `remindNow` (src/server/repo/tasks/reminders.ts:188) via `sendReminderEmails` (src/server/repo/tasks/reminders.ts:131) logs `reminder email failed for bad@example.com`.
- `test/users-create-mailer-failure.test.ts` -- `src/routes/api/users.ts:96` logs `account-creation welcome email failed (account still created)`.
- Several `App.render.test.tsx` / page render-smoke tests emit React Router v7 future-flag deprecation warnings (`v7_startTransition`, `v7_relativeSplatPath`) -- library-level notices, not assertion failures.

Result: **PASS** -- 306/306 test files, 2798/2798 tests, 0 failed, 0 skipped.

## `npm run bundle:check`

```
> bundle:check
> tsx scripts/bundle-check.ts

Bundle chunk sizes (public/admin/assets):

file                               raw          gzip
index-Flt4w77N.js                  179.51 kB    58.55 kB
Contacts-CxuGBVLX.js               39.76 kB     9.59 kB
Review-BlBuEh9I.js                 35.30 kB     8.58 kB
Settings-Bk3J-6wA.js               22.13 kB     5.67 kB
Content-CiRLN_vu.js                17.85 kB     5.24 kB
Speakers-CLaU0dlv.js               20.02 kB     5.02 kB
Agenda-DfW4f3Xw.js                 16.05 kB     4.82 kB
Comms-Bzvcs_2H.js                  16.90 kB     4.59 kB
Submissions-DIyQ3kC2.js            13.82 kB     4.10 kB
FormsPage-CVlwTwsU.js              12.06 kB     3.67 kB
index-BOb7RLKn.css                 17.45 kB     3.51 kB
SubmissionDetailPage-CArCv1SZ.js   11.39 kB     3.11 kB
Overview-Dpmupge5.js               10.63 kB     2.81 kB
ImportWizard-PFdzTHL0.js           7.22 kB      2.75 kB
ImportWizard-BekNN279.css          7.53 kB      1.39 kB
Submissions-Bu6LtK62.css           6.47 kB      1.34 kB
SubmissionDetailPage-CJP2LPId.css  5.17 kB      1.26 kB
Agenda-BUVBFwyi.css                5.48 kB      1.22 kB
Comms-geJfdN3P.css                 5.53 kB      1.22 kB
Review-B-Wm165v.css                5.83 kB      1.18 kB
Contacts-Bghxb9Tv.css              5.16 kB      1.18 kB
Overview-VbSISKfW.css              4.55 kB      1.09 kB
Content-ZNNVBerL.css               4.29 kB      1.02 kB
Speakers-DLf3hUZv.css              4.21 kB      1.01 kB
FormsPage-CfB824cN.css             3.98 kB      1.00 kB
Settings-DyiNaKEH.css              3.45 kB      0.95 kB
NotFound-CDEMcbxm.js               0.55 kB      0.33 kB
dates-C3d6Pa2g.js                  0.67 kB      0.32 kB
columns-H9BM_BWy.js                0.46 kB      0.30 kB
filters-DykXP0H-.js                0.46 kB      0.27 kB
types-CEJHopH4.js                  0.34 kB      0.21 kB

Entry bundle: index-Flt4w77N.js + index-BOb7RLKn.css = 62.06 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

### SPEC.md section 7 assertion

SPEC.md section 7 requires the initial SPA bundle be under 300 KB gzipped. Quoting the script's own numbers verbatim (not paraphrased): `Entry bundle: index-Flt4w77N.js + index-BOb7RLKn.css = 62.06 kB gzip (budget 300.00 kB)` and `bundle:check PASSED`.

62.06 kB gzip < 300.00 kB budget: **PASS**, with 237.94 kB of headroom.

## Product edits made

None. This is a verification-only evidence lane per DEC-507; no product code was touched, no single-line typecheck fix was needed.

## Overall result

`npm i`, `npm run build` (tsc x2 + vite build), `npm test` (2798/2798 passed, 0 failed, 0 skipped), and `npm run bundle:check` (62.06 kB gzip entry bundle, under the 300 KB SPEC section 7 budget) all **PASS** at sha `2950e40fed71ab2dd9924414487bf49341ad6d7f`.
