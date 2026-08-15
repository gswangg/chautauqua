## 2026-08-15 task-w44-a — build+test+bundle @ 6edb5263

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

Step 0 sync-then-measure: `git merge --no-edit main` in this worktree
(cut directly from `main` tip) reported "Already up to date." Only one
`task-w43-*` head exists locally (`task-w43-c`, tip
`44e990427ee12ab930405b4f533dd3c15bfe5620`); `git merge-base --is-ancestor
44e990427ee12ab930405b4f533dd3c15bfe5620 HEAD` exited 0 (ANCESTOR). No
`task-w43-*` ref was found non-ancestor; zero retry cycles were needed.

`npx tsx scripts/ref-state.ts` receipt (verbatim):

DEC-644 three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`;
newest first-parent product-code-bearing sha
`14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w43-c`, `task-w44-a`,
`task-w44-d`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`)
confirmed an ancestor of HEAD via `git merge-base --is-ancestor`.
NON-ancestor refs (NOT confirmed via `git merge-base --is-ancestor`):
`mail-rich-shape-fallback`, `task-w17-i`, `task-w68-b`, `task-w68-c`,
`task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`,
`task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`,
`task-w72-i`, `task-w72-j`.

MEASURED_SHA = `git rev-parse --short HEAD` = `6edb5263` (taken after the
last sync, before this commit).

`npm run build` (worker `tsc --noEmit`, app `tsc --noEmit -p
app/tsconfig.json`, then `vite build --config app/vite.config.ts`): clean,
no errors.

Full suite run inside the single lock acquisition per DEC-644 (`sh
scripts/with-test-lock.sh sh -c 'npm run build && npx vitest run && npm run
bundle:check'`, never nesting `npm test`/`test:full` inside the wrapper):

```
 Test Files  1 failed | 1101 passed (1102)
      Tests  3 failed | 12078 passed (12081)
```

3 failures, all in `test/contacts-repo.test.ts` (`mergeContacts` (DEC-101
participant dedupe + six-table FK repoint) suite). Because the wrapped
command chain uses `&&`, `npm run bundle:check` did NOT execute inside the
sanctioned lock acquisition (the chain aborted at the `vitest run` failure
exit code). `npm run bundle:check` was subsequently run standalone,
outside the lock, purely to obtain the informational bundle figure for
this report: `Entry bundle: index-DLJqKX_u.js + index-DpG2gFFa.css = 69.20
kB gzip (budget 300.00 kB)` — `bundle:check PASSED` in isolation, but this
number is NOT part of the sanctioned single full-suite run since that run
did not reach the bundle step.

Full detail: docs/verification-log/task-w44-a-build-test-bundle-6edb5263.md.

DEFECT FILED (owner: wave-45 lane, per DEC-453 — this frozen gate lane
does not fix):
- `src/server/repo/contacts/merge.ts:727-734` (`mergeContacts`) now calls
  `findContactById(db, keepId)` and `findContactById(db, mergeId)` up
  front (DEC-026 w43 amendment: whole-list preflight hoisted before any
  write), then `merge.ts:741-749` and `merge.ts:753-761` each issue an
  additional chunked `db.select()` (login check, email-conflict check)
  before `mergeOnePair` (`merge.ts:770`) is ever called. `mergeOnePair`
  (`merge.ts:383-384`) then calls `findContactById` for keepId/mergeId
  AGAIN. That is 4 `db.select()` calls before `mergeOnePair`'s internal
  per-pair work even starts, but `test/contacts-repo.test.ts:242-255`'s
  `fakeDb` select queue (see comments at `test/contacts-repo.test.ts:243-254`)
  still assumes only 2 selects (`findContactById(keepId)`,
  `findContactById(mergeId)`) happen before `mergeOnePair`'s own
  `findContactById` calls consume queue slots 2-3. The result: queue
  misalignment — `mergeOnePair`'s `findContactById(keepId)` call
  (`merge.ts:383`) reads the empty array queued for "DEC-479 email
  conflict pre-check" (`test/contacts-repo.test.ts:247`), so `keepRow` is
  `null` and `mergeOnePair` throws `merge: keep contact ct_keep not found`
  (`merge.ts:385`) in two of the three failing tests. In the third
  (`test/contacts-repo.test.ts:299`), the misaligned queue instead hands
  `findContactById` a row shape missing `createdAt`, and `toRow`
  (`src/server/repo/contacts/rows.ts:49`) throws
  `Cannot read properties of undefined (reading 'getTime')`. This is a
  test/production desync introduced when the DEC-026 w43 whole-list
  preflight was hoisted into `mergeContacts` without updating
  `test/contacts-repo.test.ts`'s mock select-queue comments/ordering to
  match the new call sequence. Fix belongs in
  `test/contacts-repo.test.ts`'s three `fakeDb([...])` queues in the
  `mergeContacts (DEC-101 participant dedupe + six-table FK repoint)`
  describe block (lines ~241-345): each queue needs 2 additional entries
  inserted after the initial keep/merge `findContactById` pair to account
  for the `mergeContacts`-level login-check and email-conflict-check
  selects, ahead of `mergeOnePair`'s own re-fetch of keep/merge rows.

RESULT: FAIL — 3/12081 tests failed in `test/contacts-repo.test.ts`
(`mergeContacts` suite), root-caused to a test-mock/production call-order
desync from the DEC-026 w43 preflight hoist (see DEFECT FILED above,
owner: wave-45 lane); build was clean; bundle check did not run inside the
sanctioned lock acquisition because the `&&` chain aborted at the test
failure (a standalone out-of-lock bundle:check run afterward measured
69.20 kB gzip vs the 300 kB budget, informational only); at 6edb5263, sole
live task-w43-* ref (task-w43-c) confirmed ANCESTOR, zero retries needed.
OPEN ITEMS: 1
