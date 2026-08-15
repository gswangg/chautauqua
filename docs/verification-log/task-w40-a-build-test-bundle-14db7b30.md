# task-w40-a build+test+bundle @ 14db7b30 — full detail

Sanctioned entrypoint (DEC-644 w40, one lock acquisition for the whole heavy
phase):

```
sh scripts/with-test-lock.sh sh -c 'npm run build && npx vitest run && npm run bundle:check'
```

Exit code: 0.

## Build (`npm run build`: worker `tsc --noEmit`, app `tsc --noEmit -p
app/tsconfig.json`, then `vite build --config app/vite.config.ts`)

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...

/fonts/FamiljenGrotesk-var.woff2 referenced in /fonts/FamiljenGrotesk-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime

/fonts/Figtree-var.woff2 referenced in /fonts/Figtree-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime
✓ 276 modules transformed.
rendering chunks...
computing gzip size...
```

No `tsc` errors from either compile step (worker or app); vite build
completed and emitted all chunks (see bundle section below for full asset
listing). No TypeScript strict-mode weakening — tsconfig files untouched
(frozen wave, docs-only lane).

## Tests (`npx vitest run`, inside the same lock acquisition as build+bundle)

Tail of the run (final summary):

```
 Test Files  1092 passed (1092)
      Tests  12002 passed (12002)
   Start at  17:38:47
   Duration  218.03s (transform 7.32s, setup 7.62s, collect 144.95s, tests 118.02s, environment 27.42s, prepare 36.15s)
```

No failing tests, no skipped tests. Full raw log (3411 lines, including
every individual test file's pass line) was captured to a scratch log
outside the repo during this run and is not committed; the summary above is
the authoritative count per DEC-644.

## Bundle (`npm run bundle:check`)

```
> bundle:check
> tsx scripts/bundle-check.ts

Bundle chunk sizes (public/admin/assets):

file                               raw          gzip
index-DRSpxsXW.js                  197.05 kB    63.93 kB
Settings-C3zLFnxY.js               87.39 kB     21.72 kB
Review-CnVyAYdP.js                 80.95 kB     21.16 kB
Contacts-BXQ36p6M.js               67.92 kB     18.24 kB
Comms-Dl0jA1jN.js                  41.42 kB     11.00 kB
Content-t4HdrS17.js                33.14 kB     9.24 kB
Speakers-BDfNaLte.js               30.71 kB     8.96 kB
Agenda-CAK_ZxYs.js                 32.44 kB     8.96 kB
SubmissionDetailPage-DvQVKsAG.js   28.24 kB     7.30 kB
Submissions-DUKaHoMl.js            22.26 kB     6.83 kB
FormsPage-DpfxULx9.js              18.46 kB     5.85 kB
index-DpG2gFFa.css                 25.97 kB     5.26 kB
DuplicateEmailNotice-DPOLF-hx.js   13.67 kB     4.43 kB
Overview-DekTdMF_.js               15.51 kB     4.27 kB
Review-C6SMDTCk.css                22.05 kB     3.81 kB
Settings-CY92fVG-.css              15.40 kB     2.80 kB
SpeakerDetailPage-Dq0ReUGW.js      9.76 kB      2.78 kB
Comms-CPR_tBr0.css                 15.00 kB     2.73 kB
Agenda-DvCUWeK1.css                13.13 kB     2.47 kB
contacts-panels-Bf-fhxUp.css       13.07 kB     2.31 kB
speakers-D1FEvZhg.css              11.31 kB     2.29 kB
MergePage-BuBguYna.js              6.03 kB      2.28 kB
SubmissionDetailPage-BvA3qQHj.css  11.71 kB     2.28 kB
Content-Dh5QtDRZ.css               10.37 kB     2.08 kB
submissions-CTk8UqWZ.css           8.66 kB      1.76 kB
speakers-BPB-d8YT.js               4.75 kB      1.76 kB
contacts-DiyYQnpr.css              8.11 kB      1.69 kB
DeleteSubmissionsPage-CqHtB8tD.js  4.28 kB      1.55 kB
files-69uzEnK4.js                  3.72 kB      1.45 kB
FormsPage-D_qXKcA0.css             5.37 kB      1.34 kB
Overview-B8vfD7v1.css              6.50 kB      1.32 kB
import-C_QAv3hQ.js                 2.55 kB      1.20 kB
compose-DctmQRyQ.js                0.90 kB      0.55 kB
ConflictChip-C8XByREZ.js           0.94 kB      0.50 kB
EmptyState-i7-MmZ3q.js             1.24 kB      0.50 kB
NotFound--oVBBZjU.js               0.83 kB      0.47 kB
filters-MJ3PqNz1.js                0.94 kB      0.46 kB
event-time-LkqnVMdW.js             0.89 kB      0.45 kB
sendResult-D2pEtIR-.js             0.55 kB      0.35 kB
ConfirmDialog-14l_cjP9.js          0.58 kB      0.33 kB
selection-Cr-2dDMd.js              0.59 kB      0.30 kB
DelayedLoading-j3jNuPhc.js         0.35 kB      0.28 kB
ErrorSummary-BuQ6K9rU.js           0.42 kB      0.27 kB
NotFound-D5qVxldx.css              0.44 kB      0.26 kB
SendFailures-BRKx6-K4.js           0.45 kB      0.26 kB
clock-XmfjxFPG.js                  0.36 kB      0.23 kB
types-C_04a5F3.js                  0.38 kB      0.23 kB
SendFailures-C9hZcs_Z.css          0.41 kB      0.23 kB
types-CO0W--Z8.js                  0.30 kB      0.22 kB
merge-CCnIGaMG.js                  0.32 kB      0.21 kB
types-aLClatR2.js                  0.24 kB      0.21 kB
schedule-DA7FdIk2.js               0.25 kB      0.19 kB
participant-roles-C9_dMI3M.js      0.29 kB      0.19 kB
answer-text-CtoChXf3.js            0.23 kB      0.19 kB
session-vocabulary-BmzV95Xg.js     0.19 kB      0.18 kB
pagination-summary-BGzgEOZX.js     0.16 kB      0.15 kB
clipboard-VBZvJEMR.js              0.18 kB      0.13 kB
ConfirmDialog-CfYXYekh.css         0.13 kB      0.12 kB
score-copy-D7F2BK-v.js             0.08 kB      0.10 kB
pagination-BMokKbS6.js             0.04 kB      0.06 kB

Entry bundle: index-DRSpxsXW.js + index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

Entry bundle 69.20 kB gzip vs SPEC §7's 300 kB budget — well within budget.

## DEC-644 boundary block (from `npm run ref-state`, verbatim)

DEC-644 three-sha boundary: HEAD
`14db7b30fb424954f9a3604563ff6a95ae5d1127`; newest first-parent
product-code-bearing sha `ed5c679e59828c5600cb84b51208056f7e38a445`; every
live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w39-e`,
`task-w40-a`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`)
confirmed an ancestor of HEAD via `git merge-base --is-ancestor`.
NON-ancestor refs (NOT confirmed via `git merge-base --is-ancestor`):
`mail-rich-shape-fallback`, `task-w17-i`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`,
`task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`,
`task-w72-i`, `task-w72-j`.

## task-w39-* sync check

`git for-each-ref --format='%(objectname) %(refname:short)' refs/heads |
grep task-w39` returned exactly one local head: `task-w39-e` at
`cc77ed76c986c983cc07bb756d08a837ee6393fc`. `git merge-base --is-ancestor
cc77ed76... HEAD` exited 0 (ANCESTOR). No non-ancestor `task-w39-*` ref
exists; the STEP 0 wait loop never triggered (0 of the allotted 5
attempts used).

`git merge --no-edit main` at the top of this lane reported "Already up to
date" — the worktree was cut directly from `main`'s tip (`14db7b30`, =
scribe wave 40), so this lane's own commit lands directly on top of that
sha, and MEASURED_SHA = `14db7b30`.

## Scope

Frozen wave (DEC-069 w40): no file under `src/**`, `app/src/**`,
`migrations/**`, or `package.json` was touched by this lane. This lane
wrote only under `docs/verification-log/`.

RESULT: PASS
OPEN ITEMS: 0
