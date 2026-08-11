# task-w2-d: Interim gate on merged main (post wave-1 seven-branch merge train)

Purpose (DEC-069, DEC-139): sanity-check that `main` still installs, typechecks,
builds, and passes its test suites after the wave-1 merge train (a/b/c/d/e/g/h
branches merged into `main`, including two merge-train fixes already applied
per the field guide). This is the *interim* gate only — the full DEC-069 exit
battery (render-sweep, walkthrough, perf) re-runs next wave once
task-w2-a/task-w2-b land.

Environment: fresh worktree of `main`, branch `task-w2-d`, checked out at
commit `0ee76f52e69801547a9698066b786fbcd4dd04c3` ("scribe wave 2").
Node v24.1.0, npm 11.3.0. Worktree path:
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w2-d`.

## Commands run, in order

### 1. Install

```
cd <worktree> && ([ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund)
```

Result: **PASS**. `added 423 packages in 2s` (with two expected deprecation
warnings for `@esbuild-kit/*`, unrelated to this repo's code — upstream tsx
merge notice). No errors.

### 2. Production build

```
npm run build
```

which runs:

```
tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts
```

Result: **PASS**. Both `tsc --noEmit` passes (root tsconfig covering
`src/`/`test/`, and `app/tsconfig.json` covering the SPA under `app/`)
completed with zero type errors. `vite build` succeeded: 133 modules
transformed, 19 output chunks emitted to `public/admin/assets/`, built in
599ms. No warnings, no errors.

Note on `scripts/bundle-check.ts`: it is **not** wired into the `build` npm
script — `package.json`'s `build` script is exactly `tsc --noEmit && tsc
--noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts`, with
no reference to `bundle-check.ts` or the `bundle:check` script. Per the task's
"if wired into the build" condition, it is out of scope for the mandatory
build gate, but it was run anyway (see below) for completeness since it's part
of the DEC-069 tooling.

### 3. Server + app test suite (single vitest config covers both)

```
npm test --silent
```

which runs `vitest run` against `vitest.config.ts`, whose `include` covers
`test/**/*.test.ts` (server suite) and `app/src/**/*.test.ts` +
`app/src/**/*.render.test.tsx` (app suite, including all render-smoke tests
under `environment: jsdom` via `environmentMatchGlobs`). There are no separate
`test/` vs `app/` vitest configs in this repo — one `vitest.config.ts` at the
repo root already includes both.

Result: **PASS**.

```
 Test Files  180 passed (180)
      Tests  1517 passed (1517)
   Duration  12.72s
```

All `*.render.test.tsx` files under `app/src/` ran and passed (jsdom
environment), e.g. `SubmissionDetailPage.render.test.tsx`,
`Submissions.render.test.tsx`, `Review.render.test.tsx`,
`ContentApp.render.test.tsx`, `ContactsApp.tabs.render.test.tsx`,
`FilesLibrary.render.test.tsx`, `SegmentsPanel.render.test.tsx`,
`Scorecard.render.test.tsx`, `Speakers.render.test.tsx`,
`PlanEditor.render.test.tsx`, `DuplicatesView.render.test.tsx`,
`Settings.render.test.tsx`, `Agenda.render.test.tsx`,
`FormsPage.render.test.tsx`, `App.render.test.tsx`,
`BulkEmailModal.render.test.tsx`, `Overview.render.test.tsx`,
`PipelineBoard.render.test.tsx`, `Comms.render.test.tsx` — 42 render-smoke
tests total across those files, all green.

Several tests intentionally log `stderr` output as part of exercising
DEC-238 best-effort mailer-failure paths (e.g.
`test/comms-send-mailer-failure.test.ts`,
`test/contacts-bulk-email-mailer-failure.test.ts`,
`test/tasks-remind-now-mailer-failure.test.ts`,
`test/users-create-mailer-failure.test.ts`) — these are expected
`console.error`/logged-failure lines from the code under test simulating a
provider rejection, not test failures. All assertions in those files passed.

There were zero React Router "future flag" warnings that indicated failures —
those are informational v6→v7 deprecation notices unrelated to this repo's
code.

### 4. Bundle check (not wired into `build`, run standalone for completeness)

```
npm run bundle:check
```

Result: **PASS**. `bundle:check PASSED` — entry bundle
(`index-*.js` + `index-*.css`) = 58.86 kB gzip against a 300 kB budget.

## Mechanical fixes applied

**None.** No type errors, no duplicate imports, no `noUncheckedIndexedAccess`
fallout, no test failures were encountered. The merge train's prior two fixes
(mentioned in the delegation) evidently already resolved the mechanical
breakage; nothing further was needed at this commit.

## Semantic conflicts found

**None observed.** All 180 test files / 1517 tests, both typecheck passes,
the production build, and the bundle-size check are green on a fresh clone of
`main` at `0ee76f52e69801547a9698066b786fbcd4dd04c3`. No repro to hand off to
the planner for this gate.

## Verdict

Interim gate: **PASS** — install, typecheck (both tsconfigs), vitest (server +
app, incl. all `*.render.test.tsx`), production build, and bundle-check are
all green with zero code changes required. Full DEC-069 exit battery
(render-sweep, walkthrough, perf) still deferred to next wave per task scope,
once task-w2-a/task-w2-b land.
