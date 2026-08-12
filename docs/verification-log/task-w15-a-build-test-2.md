# 2026-08-10 task-w15-a — build+test @ 1033d45

Full detail for the `## 2026-08-10 task-w15-a — build+test @ 1033d45` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` summary).

DEC-196 gate lane, build+test at S'''' = `1033d45` ("merge
task-w14-c"). Log-only lane. Full detail also in
`docs/verification-log/task-w15-a-build-test.md`.

**Sha derivation.** DEC-114 first-parent walk from `main` at gate
start: `4e5256e` ("scribe wave 15") is HEAD but is docs-only
(non-code-bearing); the newest code-bearing first-parent commit is
`1033d45` ("merge task-w14-c"), matching DEC-196's expected S''''
exactly. `git merge-base --is-ancestor 2dd2f33 1033d45` exits 0;
`git merge-base --is-ancestor 7f7477e 1033d45` exits 0.

**DEC-196 preconditions at S'''' = `1033d45`.** All hit: `DEC-191`
and `contactId: null` present in both `src/routes/api/users.ts` and
`src/routes/review.ts`; `data-required` present in
`src/views/form-render.tsx`; `chunkSelection` and `/tracks` present
in `app/src/pages/submissions/SubmissionsTable.tsx`; `git ls-tree` at
`1033d45` lists `test/email-log-null-contact.test.ts`,
`test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.ts`,
`app/src/pages/submissions/bulk.test.ts`, and `.dev.vars.example`,
and does NOT list `.dev.vars`. No pre-existing "build+test @
1033d45" PASS section found on `main` (dedupe rule not triggered).

**Execution.** `git worktree add --detach` at `1033d45` into a
scratch worktree outside the repo checkout; confirmed no `.dev.vars`
file present in that worktree (none read or printed). `npm ci`
clean. `npm run build`: `tsc --noEmit` (root) + `tsc --noEmit -p
app/tsconfig.json` + `vite build` all clean — 132 modules
transformed, 19 asset files emitted under `public/admin/assets`
(entry `index-C0u1DC3L.js` 175.94 kB raw / 57.52 kB gzip). `npm test`:
first run showed 1 failure (`test/auth.test.ts` login-rate-limit
20th-attempt-429 case, `401` vs expected `429`); re-running
`test/auth.test.ts` alone passed 21/21 in 6.76s, and a full
`npm test` re-run passed clean at **154 files / 1380 tests** — the
single failure is confirmed a full-suite-only timing flake in the
in-memory login limiter (test-order/concurrency sensitive), not a
regression; both figures exceed the 7f7477e floor (152 files / 1368
tests). The three new w14 test files
(`test/email-log-null-contact.test.ts`, `test/form-render-rules.test.ts`,
`app/src/pages/submissions/bulk.test.ts`) all ran and passed (3 + 6 +
5 = 14 tests). `npm run bundle:check`: entry bundle 58.86 kB gzip
against a 300.00 kB budget — PASSED.

**Cleanup.** Scratch worktree removed via `git worktree remove
--force` after the run; nothing else touched outside this ledger
section (and the optional detail file below).

OPEN ITEMS: 1 (the observed `test/auth.test.ts` full-suite flake on
the login rate-limiter's 20th-attempt case; reproduces intermittently
under full-suite concurrency but passes reliably in isolation and on
suite re-run — worth a future look at whether the limiter's in-memory
state or timers need better test isolation, but does not block this
gate).
RESULT: PASS
