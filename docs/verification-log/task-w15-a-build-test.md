# task-w15-a — build+test @ 1033d45 (detail)

Gate lane task-w15-a (DEC-196, DEC-114, DEC-068, DEC-069, DEC-129).
Ledger-only lane; see `docs/verification-log.md` section
"## 2026-08-10 task-w15-a — build+test @ 1033d45" for the citable
summary. This file records raw command output for reference.

## Sha derivation

```
$ git log --first-parent --oneline -5 main
4e5256e scribe wave 15
1033d45 merge task-w14-c
a8c8c69 merge task-w14-a
64a4687 merge task-w14-b
f0d0cf8 scribe wave 14
```

`4e5256e` is docs-only (scribe commit) -> newest code-bearing
first-parent commit is `1033d45`, matching DEC-196's expected S''''.

```
$ git merge-base --is-ancestor 2dd2f33 1033d45; echo $?
0
$ git merge-base --is-ancestor 7f7477e 1033d45; echo $?
0
```

## DEC-196 precondition greps at 1033d45

- `src/routes/api/users.ts`: `DEC-191` (comment) + `contactId: null` — present
- `src/routes/review.ts`: `DEC-191` (comment) + `contactId: null` — present
- `src/views/form-render.tsx`: `data-required` — present (4 occurrences)
- `app/src/pages/submissions/SubmissionsTable.tsx`: `chunkSelection` + `/tracks` — present
- `git ls-tree -r --name-only 1033d45` includes: `test/email-log-null-contact.test.ts`,
  `test/form-render-rules.test.ts`, `app/src/pages/submissions/bulk.ts`,
  `app/src/pages/submissions/bulk.test.ts`, `.dev.vars.example` — all present
- `.dev.vars` — absent from the tree (confirmed via same `git ls-tree` grep)

Dedupe check: `grep -n "@ 1033d45" docs/verification-log.md` returned
no prior hits before this section was appended — no duplicate PASS
section existed, so this is a fresh run (not a citation section).

## Execution environment

Scratch worktree: `git worktree add --detach <scratch> 1033d45`
outside the repo checkout tree; confirmed via `ls -la
<scratch>/.dev.vars` -> "No such file or directory" before running
anything. No local `.dev.vars` was read or printed at any point.

## npm ci

Clean, no errors (silent flags used).

## npm run build

```
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts
vite v6.4.3 building for production...
✓ 132 modules transformed.
... (19 files under public/admin/assets)
✓ built in 760ms
```

Entry bundle: `index-C0u1DC3L.js` 175.94 kB raw / 57.52 kB gzip,
plus `index-easpJsYc.css` — combined 58.86 kB gzip.

## npm test

First run: 153/154 test files passed, 1379/1380 tests passed. Sole
failure:

```
FAIL  test/auth.test.ts > POST /login rate limiting (DEC-180) > 20 failed logins for one email then a 429
AssertionError: expected 401 to be 429
```

Isolation re-run (`npx vitest run test/auth.test.ts`): 21/21 passed
in 6.76s, including all three rate-limiting cases.

Full-suite re-run (`npm test --silent`): **154 files / 1380 tests**,
all passed, zero failures.

Conclusion: the single failure on the first full-suite run was a
concurrency/timing flake specific to the in-memory login-attempt
counter under full-suite parallel test execution, not a code defect
at `1033d45`. Both the flaky-run and clean-run totals meet or exceed
the 7f7477e floor (152 files / 1368 tests).

New w14 test files confirmed present and passing in the suite run
(via `npx vitest list`):

- `test/email-log-null-contact.test.ts` — 3 tests
- `test/form-render-rules.test.ts` — 6 tests
- `app/src/pages/submissions/bulk.test.ts` — 5 tests

## npm run bundle:check

```
Entry bundle: index-C0u1DC3L.js + index-easpJsYc.css = 58.86 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

## Cleanup

`git worktree remove --force <scratch>` after the run. No other
files were touched outside `docs/verification-log.md` and this
detail file.

RESULT: PASS
