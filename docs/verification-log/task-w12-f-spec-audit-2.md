# 2026-08-10 task-w12-f — spec-audit @ 7f7477e

Full detail for the `## 2026-08-10 task-w12-f — spec-audit @ 7f7477e` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` summary).

DEC-188 GATE spec-audit lane. S'' derived by first-parent walk from
`main`: `7f7477e` = "merge task-w12-a" — matches expected S'' exactly;
precondition satisfied. `2dd2f33`, `629d57e`, and `38860f9` (audit
baseline) all confirmed ancestors of S'' via
`git merge-base --is-ancestor`. DEC-188 precondition grep set
(DEC-177/179..183 markers, extended through DEC-188) all present in
`src/decisions.ts` at S''.

Audited `git diff 38860f9..7f7477e` (58 files, +4377/-105) against
SPEC.md and docs/ precedence. Full detail in
`docs/verification-log/task-w12-f-spec-audit.md`. Summary:

1. Wave-10 fixes DEC-179..183 all conform: `formatCell` in
   `src/lib/csv.ts` neutralizes leading `=+-@`/tab/CR on string cells
   only (numbers/null exempt), fully tested in `test/csv.test.ts`. The
   login limiter (`src/routes/auth.tsx` + new `peekScopedLimit`/
   `incrementScopedLimit`/`resetScopedLimit` in `src/lib/rate-limit.ts`)
   peeks read-only, increments only on failed credential checks, and
   resets the per-email window on success; `checkAndIncrementScopedLimit`
   (claim/submit scopes) is unchanged and public submit's rate-limit
   code path has no diff in this range. `csrfFormOrHeader`
   (`src/server/middleware.ts`) gates `POST /logout`; every
   `/portal/*` page threads a real `csrfToken` into `PortalLayout`'s
   sign-out form, including two GET handlers that previously didn't
   mint one. `parseBoundedIdArray` (`src/server/http.ts`) is used at
   all five bulk-ids call sites (`api/submissions.ts`, `tasks.ts` x2,
   `api/contacts.ts`, `files.ts`), throwing `ApiError("invalid", ...)`
   (the standard `{error:{code,message,fields?}}` envelope) on any
   non-array/empty/oversized/non-string/out-of-range input — no silent
   filtering. `wrangler.jsonc`'s `vars.DEV_MODE` block is removed.
2. Operator commit 629d57e: `.dev.vars` is confirmed untracked at S''
   (`git ls-files 7f7477e` has no match); `.dev.vars.example` contains
   only `DEV_MODE=1`; `.gitignore` re-ignores `.dev.vars`. Note:
   `.dev.vars` was briefly re-tracked with a real `AIRTABLE_TOKEN` value
   at `bdc472b` (within this range, after 629d57e) and removed again
   before the wave-11 merges — a two-endpoint diff nets this to no
   visible change, which is the intended tracked-diff-only audit method.
   This residual git-history exposure (not pushed) is the same issue
   already flagged by a prior audit note and accepted/scheduled for a
   post-convergence history scrub per DEC-187's commit message; not a
   new finding, does not block this gate since the tree at S'' never
   tracks the file.
3. DEC-187 fix: `scripts/ensure-dev-vars.ts` (`ensureDevVars`,
   create-if-absent/never-overwrite/throw-if-example-missing), wired via
   `predev` in `package.json`, `scripts/render-sweep.ts`, and
   `.github/workflows/ci.yml`'s walkthrough + perf-smoke jobs;
   `test/wrangler-config.test.ts` retargeted to `.dev.vars.example` plus
   direct unit tests of `ensureDevVars` in a temp dir. Node-fs-only,
   confined to `scripts/`; introduces no stage-2 wiring and requires no
   secrets to run.
4. Secrets scan over `git diff 38860f9..7f7477e` (tracked diff only,
   local untracked `.dev.vars` never read): only truncated/partial
   prose references to the already-resolved incident inside
   `docs/verification-log.md`/`docs/verification-log/*.md`; no live
   credential in the diff.

`npm run build` clean at S''; targeted vitest run (csv, rate-limit,
auth, wrangler-config, server-http, portal-signout, api-submissions —
7 files, 119 tests) all passing.

Findings: none. All four audited areas conform.

OPEN ITEMS: 0
RESULT: PASS
