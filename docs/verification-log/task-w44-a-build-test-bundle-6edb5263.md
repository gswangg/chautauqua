# task-w44-a build+test+bundle @ 6edb5263 — full detail

Sanctioned entrypoint (DEC-644, one lock acquisition for the whole heavy
phase):

```
sh scripts/with-test-lock.sh sh -c 'npm run build && npx vitest run && npm run bundle:check'
```

Exit code: non-zero (the `vitest run` stage failed, so the `&&` chain
aborted before reaching `npm run bundle:check`).

## Step 0: sync-then-measure

- `git merge --no-edit main`: "Already up to date." (worktree cut directly
  from `main` tip `6edb5263`.)
- `git for-each-ref --format='%(objectname) %(refname:short)' refs/heads`
  listed one `task-w43-*` head: `task-w43-c` at
  `44e990427ee12ab930405b4f533dd3c15bfe5620`.
- `git merge-base --is-ancestor 44e990427ee12ab930405b4f533dd3c15bfe5620
  HEAD` exited 0 (ANCESTOR). No non-ancestor `task-w43-*` refs found;
  retry count = 0 (no retries needed, loop never entered).
- `npx tsx scripts/ref-state.ts` receipt (verbatim):

```
DEC-644 three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`; newest first-parent product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w43-c`, `task-w44-a`, `task-w44-d`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.
```

- MEASURED_SHA = `git rev-parse --short HEAD` (post-sync, pre-commit) =
  `6edb5263`.

## Build (`npm run build`: worker `tsc --noEmit`, app `tsc --noEmit -p
app/tsconfig.json`, then `vite build --config app/vite.config.ts`)

Ran clean, exit 0. Tail of output:

```
../public/admin/assets/import-C_QAv3hQ.js                   2.61 kB │ gzip:  1.23 kB
../public/admin/assets/files-CpUqmCod.js                    3.81 kB │ gzip:  1.49 kB
../public/admin/assets/DeleteSubmissionsPage-BSlMhZCy.js    4.38 kB │ gzip:  1.59 kB
../public/admin/assets/speakers-PJbcr8uY.js                 4.87 kB │ gzip:  1.80 kB
../public/admin/assets/MergePage-UBuFG16p.js                6.18 kB │ gzip:  2.34 kB
../public/admin/assets/SpeakerDetailPage-h5j5YSV_.js        9.99 kB │ gzip:  2.84 kB
../public/admin/assets/DuplicateEmailNotice-CTbgCZWq.js    14.00 kB │ gzip:  4.54 kB
../public/admin/assets/Overview-CO6s6odz.js                15.88 kB │ gzip:  4.37 kB
../public/admin/assets/FormsPage-B5Y9SxGB.js               18.90 kB │ gzip:  5.99 kB
../public/admin/assets/Submissions-D6XiXZFj.js             22.79 kB │ gzip:  6.99 kB
../public/admin/assets/SubmissionDetailPage-Dq-K1Bm7.js    28.92 kB │ gzip:  7.47 kB
../public/admin/assets/Speakers-B5CX9Yq-.js                31.44 kB │ gzip:  9.18 kB
../public/admin/assets/Agenda-4E1JSRq8.js                  33.33 kB │ gzip:  9.23 kB
../public/admin/assets/Content-CBh-3W-q.js                 33.94 kB │ gzip:  9.46 kB
../public/admin/assets/Comms-7vuF8rw7.js                   42.42 kB │ gzip: 11.26 kB
../public/admin/assets/Contacts-DoOl-ajL.js                69.55 kB │ gzip: 18.68 kB
../public/admin/assets/Review-n4kj5U6K.js                  82.89 kB │ gzip: 21.67 kB
../public/admin/assets/Settings-B7ClIZzU.js                89.49 kB │ gzip: 22.24 kB
../public/admin/assets/index-DLJqKX_u.js                  201.78 kB │ gzip: 65.47 kB
✓ built in 1.00s
```

No `tsc` errors from either compile step. No TypeScript strict-mode
weakening — tsconfig files untouched (frozen wave, docs-only lane).

## Tests (`npx vitest run`, inside the same lock acquisition as build+bundle)

Tail of the run (final summary):

```
 Test Files  1 failed | 1101 passed (1102)
      Tests  3 failed | 12078 passed (12081)
   Start at  19:08:11
   Duration  219.87s (transform 7.35s, setup 7.42s, collect 146.58s, tests 120.15s, environment 26.78s, prepare 36.24s)
```

Three failing tests, all in `test/contacts-repo.test.ts`, `mergeContacts
(DEC-101 participant dedupe + six-table FK repoint)` describe block:

1. `repoints file and file_comment (and the other five tables) from
   mergeId to keepId` (`test/contacts-repo.test.ts:241`):
   `Error: merge: keep contact ct_keep not found` thrown from
   `src/server/repo/contacts/merge.ts:385` (`mergeOnePair`), called via
   `mergeContacts` (`merge.ts:770`) from `test/contacts-repo.test.ts:257`.

2. `dedupes: deletes mergeId's participant row for a shared submission
   instead of repointing it, but still repoints its row on a distinct
   submission` (`test/contacts-repo.test.ts` around line 299):
   `TypeError: Cannot read properties of undefined (reading 'getTime')`
   thrown from `src/server/repo/contacts/rows.ts:49` (`toRow`), called via
   `findContactById` (`src/server/repo/contacts/crud.ts:67`) from
   `mergeOnePair` (`merge.ts:384`).

3. `preserves duplicate-only bio/headshotUrl/phone/notes/social links onto
   the kept row (DEC-167)` (`test/contacts-repo.test.ts` around line 341):
   `Error: merge: keep contact ct_keep not found` — same shape as failure
   1, thrown from `merge.ts:385`.

### Root cause (filed, not fixed — DEC-453; owner: wave-45 lane)

`mergeContacts` (`src/server/repo/contacts/merge.ts:719-774`) begins with
its own `findContactById(db, keepId)` and, per merge id,
`findContactById(db, mergeId)` calls (`merge.ts:727-733`) — this is the
DEC-026 w43 amendment that hoists the whole-list preflight (login check,
email-conflict check) ahead of any per-pair write. That preflight then
issues two more `db.select()` calls: one chunked login-lookup
(`merge.ts:741-749`) and one chunked email-owner lookup
(`merge.ts:753-761`). Only after all of that does `mergeContacts` call
`mergeOnePair` (`merge.ts:770`), which itself re-fetches both rows via
`findContactById` (`merge.ts:383-384`) for its own per-pair fixups.

For a single-mergeId call (`mergeContacts(db, KEEP_ID, [MERGE_ID])`, as
used by the three failing tests) that is 4 `db.select()` calls
(`mergeContacts`'s own 2 `findContactById` + 2 chunked preflight selects)
before `mergeOnePair`'s own 2 `findContactById` calls ever run — 6 total
selects before any of `mergeOnePair`'s post-fetch merge logic executes.

`test/contacts-repo.test.ts`'s `fakeDb` (`test/contacts-repo.test.ts:215-239`)
serves canned rows from a queue in call order. The three failing tests'
queues (e.g. `test/contacts-repo.test.ts:242-255`) are commented and
ordered as though only 2 selects (`findContactById(keepId)`,
`findContactById(mergeId)`) precede `mergeOnePair`'s own
`findContactById` pair — i.e. the queue comments say slots 0-1 are
`mergeContacts`'s `findContactById` calls and slots 2-3 are "user rows for
keepId"/"user rows for mergeId" which the test evidently intends as
`mergeOnePair`'s per-pair login recheck (`merge.ts:393-403`), not
`mergeContacts`'s whole-list preflight. But in the actual call sequence,
slots 2-3 are consumed by `mergeContacts`'s own chunked preflight selects
(`merge.ts:742-745` and `merge.ts:754-757`), and `mergeOnePair`'s
`findContactById(keepId)`/`findContactById(mergeId)` calls
(`merge.ts:383-384`) land on slots 4-5 — which the queue comments label
"DEC-479 email conflict pre-check" (empty array) and "mergeParticipants"
(empty array) respectively. An empty array for `findContactById(keepId)`
means `keepRow` is `null`, tripping the `merge.ts:385` throw in failures 1
and 3. In failure 2 the misalignment instead hands `findContactById` a
row object lacking `createdAt`/`updatedAt` Date fields (from a queue slot
that was never meant to represent a contact row), so `toRow`
(`src/server/repo/contacts/rows.ts:49`) throws when calling `.getTime()`
on `undefined`.

This is a test-vs-production call-order desync: the DEC-026 w43 hoist
added 2 new `mergeContacts`-level `db.select()` calls (login check,
email-conflict check) ahead of `mergeOnePair`, but
`test/contacts-repo.test.ts`'s mock select queues in the `mergeContacts
(DEC-101 participant dedupe + six-table FK repoint)` describe block
(roughly lines 241-345) were not updated to insert 2 additional queue
entries to account for them. Per DEC-453 (LOCAL-D1 FIXUP IS A
MEASUREMENT, COMMITTED ONE IS A FIX) and this task's HARD SCOPE
(docs/verification-log/** only), this lane does not touch
`test/contacts-repo.test.ts` or `src/server/repo/contacts/merge.ts`. Filed
for wave-45 lane: insert 2 queue entries (login-check rows, e.g. `[]`, and
email-conflict-check rows, e.g. `[]`) immediately after each queue's
initial keep/merge `findContactById` pair, in each of the three affected
`fakeDb([...])` calls in `test/contacts-repo.test.ts`'s `mergeContacts
(DEC-101 participant dedupe + six-table FK repoint)` suite (approx. lines
242-255, and the two further `fakeDb([...])` call sites for the other two
failing tests in the same describe block, around lines 260-345).

## Bundle (`npm run bundle:check`)

NOT executed inside the sanctioned single lock acquisition: the wrapped
`sh -c 'npm run build && npx vitest run && npm run bundle:check'` command
uses `&&`, and `npx vitest run` exited non-zero (3 failing tests), so the
chain aborted before `npm run bundle:check` ran.

For informational purposes only, `npm run bundle:check` was run standalone
afterward, outside `scripts/with-test-lock.sh` (a lightweight vite-output
inspection script, not a full-suite run, so it carries no DEC-644 re-entrancy
risk):

```
> bundle:check
> tsx scripts/bundle-check.ts
...
Entry bundle: index-DLJqKX_u.js + index-DpG2gFFa.css = 69.20 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

This number (69.20 kB gzip vs SPEC §7's 300 kB budget) is consistent with
prior waves' bundle measurements and is reported for completeness, but it
is not part of this wave's sole sanctioned full-suite run per the task's
own STEP 1 instructions, since that run never reached the bundle step.

## Overall result

Build: clean. Tests: 3/12081 failed (all in `test/contacts-repo.test.ts`,
root-caused above to a DEC-026 w43 preflight-hoist test/mock desync, filed
for wave-45, not fixed here per DEC-453 and this lane's docs-only HARD
SCOPE). Bundle: not measured inside the sanctioned run (chain aborted);
69.20 kB gzip measured out-of-band, informational only.

RESULT: FAIL — 3 test failures block a clean PASS for this frozen gate
slot; see index file for the compact RESULT line and DEFECT FILED summary.
