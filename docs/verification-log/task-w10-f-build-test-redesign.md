# Build/Test Gate — Redesign wave 10 (DEC-419), task-w10-f

Gate lane, LOG-ONLY. This report is the entire diff for this branch.

## Frozen SHA

```
a7d00594196b329ff3d95b7dd4ac185ba63e529c
```

Captured via `git -C .../chautauqua-wt/task-w10-f rev-parse HEAD` immediately
after `git worktree add ... -b task-w10-f main`, before any command below ran.
Worktree cut from `main` (last redesign build/test gate on record:
`docs/verification-log/task-w5-h-build-test-redesign.md`, wave 5 — none run
since, though waves 6-9 re-skinned every surface and landed DEC-402/409/410).

## Commands run, in order

| # | Command | Exit code |
|---|---------|-----------|
| 1 | `npm ci` (node_modules absent at worktree creation) | 0 |
| 2 | `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`) | 0 |
| 3 | `npm test` (`vitest run`) | 0 |
| 4 | `npm run bundle:check` | 0 |

## (1) npm ci

```
added 366 packages, and audited 367 packages in 8s

64 packages are looking for funding
  run `npm fund` for details

4 vulnerabilities (2 moderate, 2 high)

To address all issues, run:
  npm audit fix

Run `npm audit` for details.
```

No further action taken on the audit findings — out of scope for this gate
(LOG-ONLY, no product code/config changes permitted).

## (2) npm run build — full transcript

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts

vite v6.4.3 building for production...
transforming...

/fonts/FamiljenGrotesk-var.woff2 referenced in /fonts/FamiljenGrotesk-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime

/fonts/Figtree-var.woff2 referenced in /fonts/Figtree-var.woff2 didn't resolve at build time, it will remain unchanged to be resolved at runtime
✓ 154 modules transformed.
rendering chunks...
computing gzip size...
../public/admin/index.html                                  0.62 kB │ gzip:  0.33 kB
../public/admin/assets/Settings-DyiNaKEH.css                3.53 kB │ gzip:  0.97 kB
../public/admin/assets/Speakers-BG5PBYj4.css                4.02 kB │ gzip:  0.96 kB
../public/admin/assets/FormsPage-BJZJaevv.css               4.08 kB │ gzip:  1.03 kB
../public/admin/assets/Content-ZNNVBerL.css                 4.39 kB │ gzip:  1.05 kB
../public/admin/assets/Overview-VbSISKfW.css                4.66 kB │ gzip:  1.11 kB
../public/admin/assets/Contacts-Bghxb9Tv.css                5.28 kB │ gzip:  1.21 kB
../public/admin/assets/SubmissionDetailPage-CJP2LPId.css    5.30 kB │ gzip:  1.29 kB
../public/admin/assets/Agenda-BUVBFwyi.css                  5.61 kB │ gzip:  1.25 kB
../public/admin/assets/Comms-geJfdN3P.css                   5.67 kB │ gzip:  1.25 kB
../public/admin/assets/Review-lOhh-lE9.css                  5.86 kB │ gzip:  1.19 kB
../public/admin/assets/Submissions-Bu6LtK62.css             6.63 kB │ gzip:  1.37 kB
../public/admin/assets/ImportWizard-BMXO_HP7.css            7.66 kB │ gzip:  1.41 kB
../public/admin/assets/index-C7tew5xN.css                  17.87 kB │ gzip:  3.60 kB
../public/admin/assets/types-CEJHopH4.js                    0.35 kB │ gzip:  0.22 kB
../public/admin/assets/filters-DykXP0H-.js                  0.47 kB │ gzip:  0.28 kB
../public/admin/assets/columns-H9BM_BWy.js                  0.47 kB │ gzip:  0.31 kB
../public/admin/assets/NotFound-DCzNVu0I.js                 0.57 kB │ gzip:  0.34 kB
../public/admin/assets/dates-C3d6Pa2g.js                    0.68 kB │ gzip:  0.33 kB
../public/admin/assets/ImportWizard-1ejy4RDm.js             7.39 kB │ gzip:  2.82 kB
../public/admin/assets/Overview-CwdVglnj.js                10.89 kB │ gzip:  2.88 kB
../public/admin/assets/SubmissionDetailPage-BQIB7Pi3.js    11.66 kB │ gzip:  3.19 kB
../public/admin/assets/FormsPage-7cN5iz_1.js               12.35 kB │ gzip:  3.75 kB
../public/admin/assets/Submissions-Bg7O-hE9.js             14.15 kB │ gzip:  4.20 kB
../public/admin/assets/Agenda-Cm1yJI65.js                  16.44 kB │ gzip:  4.94 kB
../public/admin/assets/Comms-iB8YvKnT.js                   17.03 kB │ gzip:  4.58 kB
../public/admin/assets/Content-D95zo96H.js                 18.13 kB │ gzip:  5.33 kB
../public/admin/assets/Speakers-B-o68gDn.js                19.02 kB │ gzip:  4.84 kB
../public/admin/assets/Settings-B8oAdmVq.js                22.27 kB │ gzip:  5.70 kB
../public/admin/assets/Review-CjUA_jmK.js                  35.95 kB │ gzip:  8.72 kB
../public/admin/assets/Contacts-CyMz2rSI.js                40.27 kB │ gzip:  9.71 kB
../public/admin/assets/index-OGWrPj8G.js                  183.82 kB │ gzip: 59.96 kB
✓ built in 672ms
```

Both `tsc --noEmit` invocations (root `tsconfig.json`, `app/tsconfig.json`)
produced **zero diagnostics** — no output at all before the `vite build`
banner, which is `tsc`'s silent-success behavior. No type errors, no
warnings beyond the two Vite font-resolution notices shown verbatim above
(those are pre-existing dev-server-relative asset warnings, not build
failures — build still exits 0 and writes the chunk manifest).

## (3) npm test — summary and full failure transcript

Summary line (verbatim, from vitest's own footer):

```
 Test Files  260 passed (260)
      Tests  2147 passed (2147)
   Start at  03:05:13
   Duration  27.08s (transform 5.23s, setup 0ms, collect 71.29s, tests 33.27s, environment 23.10s, prepare 17.88s)
```

Exit code: `0`.

Failing tests: **none**. 0 failed test files, 0 failed tests — there is no
failure transcript to include because there were no failures. (Per the task
instructions this must be stated explicitly rather than omitted: the full
name + failure message of every failing test would be transcribed here if
any existed.)

Non-failure stderr noise observed during the run (React Router v6→v7 future
flag deprecation warnings, emitted by several `*.render.test.tsx` files,
e.g. `app/src/pages/review/Recusal.render.test.tsx`,
`app/src/App.render.test.tsx`, `app/src/pages/review/Review.render.test.tsx`,
`app/src/pages/submissions/Submissions.render.test.tsx`,
`app/src/pages/content/ContentApp.render.test.tsx`,
`app/src/pages/submissions/SubmissionDetailPage.render.test.tsx`,
`app/src/pages/review/PlanEditor.render.test.tsx`,
`app/src/pages/Overview.render.test.tsx`,
`app/src/pages/review/Scorecard.render.test.tsx`,
`app/src/pages/review/ResultsTable.render.test.tsx`) — these are React
Router's own upstream deprecation warnings about `v7_startTransition` /
`v7_relativeSplatPath`, unrelated to product code, and do not fail any test.

## (4) npm run bundle:check — full transcript

```
> bundle:check
> tsx scripts/bundle-check.ts

Bundle chunk sizes (public/admin/assets):

file                               raw          gzip
index-OGWrPj8G.js                  179.51 kB    58.55 kB
Contacts-CyMz2rSI.js               39.32 kB     9.48 kB
Review-CjUA_jmK.js                 35.11 kB     8.52 kB
Settings-B8oAdmVq.js               21.75 kB     5.56 kB
Content-D95zo96H.js                17.70 kB     5.20 kB
Agenda-Cm1yJI65.js                 16.05 kB     4.82 kB
Speakers-B-o68gDn.js               18.58 kB     4.73 kB
Comms-iB8YvKnT.js                  16.63 kB     4.47 kB
Submissions-Bg7O-hE9.js            13.82 kB     4.10 kB
FormsPage-7cN5iz_1.js              12.06 kB     3.67 kB
index-C7tew5xN.css                 17.45 kB     3.52 kB
SubmissionDetailPage-BQIB7Pi3.js   11.39 kB     3.11 kB
Overview-CwdVglnj.js               10.63 kB     2.81 kB
ImportWizard-1ejy4RDm.js           7.22 kB      2.75 kB
ImportWizard-BMXO_HP7.css          7.48 kB      1.38 kB
Submissions-Bu6LtK62.css           6.47 kB      1.34 kB
SubmissionDetailPage-CJP2LPId.css  5.17 kB      1.26 kB
Agenda-BUVBFwyi.css                5.48 kB      1.22 kB
Comms-geJfdN3P.css                 5.53 kB      1.22 kB
Contacts-Bghxb9Tv.css              5.16 kB      1.18 kB
Review-lOhh-lE9.css                5.72 kB      1.17 kB
Overview-VbSISKfW.css              4.55 kB      1.09 kB
Content-ZNNVBerL.css               4.29 kB      1.02 kB
FormsPage-BJZJaevv.css             3.98 kB      1.01 kB
Settings-DyiNaKEH.css              3.45 kB      0.95 kB
Speakers-BG5PBYj4.css              3.93 kB      0.93 kB
NotFound-DCzNVu0I.js               0.55 kB      0.33 kB
dates-C3d6Pa2g.js                  0.67 kB      0.32 kB
columns-H9BM_BWy.js                0.46 kB      0.30 kB
filters-DykXP0H-.js                0.46 kB      0.27 kB
types-CEJHopH4.js                  0.34 kB      0.21 kB

Entry bundle: index-OGWrPj8G.js + index-C7tew5xN.css = 62.07 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

Measured gzipped initial-bundle (entry chunk `index-OGWrPj8G.js` +
`index-C7tew5xN.css`, which is what actually loads before any route code
splits in): **62.07 KB gzip**, against the SPEC.md:355 budget of **300 KB**.
20.7% of budget consumed; 237.93 KB of headroom remains. Largest
route-split chunk is `Contacts-CyMz2rSI.js` at 9.48 KB gzip (lazy-loaded,
not part of the initial bundle and not counted against the 300 KB figure).

## Three source conformance guards

| Guard file | Decision | Result |
|---|---|---|
| `test/table-class-conformance.test.ts` | DEC-402 | **PASS** — 2/2 tests passed (`vitest run` log line: `✓ test/table-class-conformance.test.ts (2 tests) 10ms`) |
| `test/focus-ring-conformance.test.ts` | DEC-409 | **PASS** — 4/4 tests passed (`vitest run` log line: `✓ test/focus-ring-conformance.test.ts (4 tests) 5ms`) |
| DEC-410 repo-wide interactive-control-class guard | DEC-410 | **PASS** — the guard file exists at this SHA: `test/control-class-conformance.test.ts`, and passed 2/2 (`vitest run` log line: `✓ test/control-class-conformance.test.ts (2 tests) 59ms`). Per the task's own instruction to check for absence first: this file *is* present at SHA `a7d00594196b329ff3d95b7dd4ac185ba63e529c`, so DEC-410 has in fact landed at this SHA — it is not a case of reporting a pass over an absent guard. |

## Decisions verified present/absent at this SHA (`a7d00594196b329ff3d95b7dd4ac185ba63e529c`)

- **DEC-410** (repo-wide interactive-control-class guard, app/src only):
  **present**. Constant declared at `src/decisions.ts:415`. Guard test file
  `test/control-class-conformance.test.ts:1-30` (header comment cites
  DEC-406/DEC-410 explicitly, scope note at lines 12-19 restricting scan to
  `app/src`). Test passes (2/2, see table above).
- **DEC-411** (Playwright `__name` keepNames shim + whole-portal phone
  manifest): **present**. Constant at `src/decisions.ts:416`. Shim string
  defined at `scripts/render-sweep-lib.ts:263`
  (`globalThis.__name = globalThis.__name || function (fn) { return fn; };`)
  and injected via `page.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM })`
  at `scripts/render-sweep.ts:232` and `scripts/render-sweep.ts:279`
  (before any `page.evaluate` call, per the decision).
- **DEC-412** (walkthrough repair policy — design owns copy, SPEC §9 owns
  behaviour, one owning lane per area): **present**. Constant at
  `src/decisions.ts:417`. Applied in git history at commit `feed265`
  ("DEC-412: repair speaker/public walkthroughs against redesigned
  portal/public markup") and referenced in wave-9 gate commits
  `fbb7a49` (w9-e, data + scale areas) and `b6225fb` (w9-c, producer +
  review, no repair needed). `scripts/walkthrough.ts` is the DEC-062
  orchestrator this policy governs the repair work under; the policy
  itself is a process decision (which lane fixes what) rather than a
  runtime code path, so there is no single call site beyond the commits
  that executed it.
- **DEC-413** (speaker portal renders every date in the owning event's
  timezone, per row): **present**. Constant at `src/decisions.ts:418`.
  Applied at `src/routes/portal/index.tsx:116`
  (`formatEventDate(s.submittedAt, s.timezone)`),
  `src/routes/portal/index.tsx:144`
  (`formatEventDate(t.dueDate, t.timezone)`), and
  `src/routes/portal/index.tsx:239`
  (`formatEventDate(detail.submittedAt, detail.timezone)`) — each call
  passes a per-row `timezone` field rather than a single portal-wide
  timezone, satisfying "carried per row."
- **DEC-414** (390px overflow closed by scroller or wrap, never
  `overflow:hidden` or sub-44px controls): **present**. Constant at
  `src/decisions.ts:419`. Applied at `app/src/styles.css:537`
  (`.chq-chipstrip { ... overflow-x: auto; -webkit-overflow-scrolling:
  touch; }`) paired with `app/src/styles.css:544`
  (`.chq-chipstrip > * { flex-shrink: 0; }`) — the wide region gets its
  own scroller and children don't shrink below their intrinsic (44px
  floor per DEC-393) size.

## RESULT: PASS

Build exits 0 with zero tsc diagnostics on both configs. Test suite is
260/260 files, 2147/2147 tests green, exit 0. Bundle-check passes with
62.07 KB gzip against a 300 KB budget. All three source conformance guards
(DEC-402, DEC-409, DEC-410) exist at this SHA and pass. DEC-410 through
DEC-414 are all present at this SHA with file:line citations.

## OPEN ITEMS: 1

1. `package.json` — `npm audit` reports 4 vulnerabilities (2 moderate, 2
   high) in transitive dependencies, surfaced by `npm ci`'s post-install
   summary (see §1 transcript above). No existing decision in
   `decisions/` addresses dependency-audit remediation policy for this
   repo; this is not settled by DEC-410 through DEC-414 or any other
   decision found under `decisions/`. Per this task's LOG-ONLY scope, no
   fix or `npm audit fix` was applied — flagging only, per "if you find a
   bug, you write it down; you do not fix it."

## RECHECK SHA

`a7d00594196b329ff3d95b7dd4ac185ba63e529c` (== frozen SHA; no source
changes were made in this worktree other than adding this one report file,
so the recheck SHA and frozen SHA are identical for every command above).

## POST-S DELTA

`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w10-f status --porcelain`:

```
?? docs/verification-log/task-w10-f-build-test-redesign.md
```

This one new file is the entire diff for this branch — no product code, no
tests, no scripts, no config were touched.
