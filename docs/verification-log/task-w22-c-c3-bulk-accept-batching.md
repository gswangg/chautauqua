# task-w22-c: DEC-355 bulk-accept planning made set-based

FROZEN SHA (base commit, before this task's changes): 24155d94b6020e807970bb37b4959a00687cc1ec

## What changed

`src/server/repo/submissions/status.ts`:

- Extracted a new private helper `planAndPersistOnboardingTasks(db, eventId,
  participantContactIds, now)` containing the "load existing (contactId,
  title) pairs -> planAcceptance -> getOrCreateTask per distinct title ->
  insert task_assignment per planned pair" logic previously inlined in
  `ensureOnboardingTasks`. `ensureOnboardingTasks`'s exported signature
  (`db, eventId, submissionId, contactIds, now`) is unchanged; it now
  resolves `participantContactIds` (from the `contactIds` param, or by
  loading+filtering the submission's participants when null) and delegates
  to the new helper.
- `updateSubmissionStatuses` no longer loops per firing row calling
  `ensureOnboardingTasks` + a single-row UPDATE. It now: (1) partitions rows
  into `firingIds`/`nonFiringIds` first; (2) for all firing ids, does ONE
  chunked (`chunkIds`, 90/batch) SELECT over `schema.participant` for every
  firing submissionId; (3) filters `isActiveParticipant` and dedups
  `contactId` in memory (a `Set`); (4) calls
  `planAndPersistOnboardingTasks` ONCE over the deduped contact list (which
  itself does one chunked existing-titles SELECT, one `planAcceptance` call,
  and `getOrCreateTask` once per distinct planned title); (5) only then
  issues one chunked UPDATE (status + `acceptedAt: now` + `updatedAt: now`)
  over all firing ids. `changeStatus`'s `enteringAcceptedFirstTime` branch
  always sets `acceptedAt = now` for a firing row, so a single shared
  `now` value across the whole batch is correct (verified by reading
  `src/domain/status.ts`) — no per-row `acceptedAt` bookkeeping needed.
  The non-firing chunked UPDATE path, the DEC-133 full-set id guard, and
  the DEC-009 no-mailer invariant are byte-for-byte unchanged.

DEC-079 ordering is preserved: all planning (participant load + existing-
titles load + task/form find-or-create + task_assignment inserts) for the
*entire batch* runs before any firing row's status UPDATE. A throw anywhere
in planning leaves every firing row un-accepted; retrying re-plans
idempotently (task_assignment inserts are already deduped against existing
(contact, title) pairs).

`test/status-bulk-statement-count.test.ts` (new): a call-counting fake Db
drives `updateSubmissionStatuses` with 200 firing submission ids (above the
90-id DEC-078 chunk boundary) and asserts:
- SELECT counts are `O(ids/90)` for the submission/participant/existing-
  titles loads (3 each, for 200 ids -> chunks of 90/90/20) plus `O(distinct
  titles)` for `getOrCreateTask`/`getOrCreateFormTaskForm` (5 + 2), for a
  total of 16 SELECTs — asserted `< 30`, nowhere near `O(ids) = 200`.
- INSERT counts: exactly `N * distinctTitles` (1000) `task_assignment` rows,
  exactly `distinctTitles` (5) `task` rows, exactly `formTitles` (2) `form`
  rows — proportional to distinct (contact, title) pairs / distinct titles,
  not to submission count.
- Exactly one chunked UPDATE per id-chunk (3), each with
  `{status: "accepted", acceptedAt: now, updatedAt: now}`.

## Build / test results

- `npm run build`: PASS (tsc --noEmit x2 + vite build, no errors).
- `npm test`: PASS — 231 test files, 1931 tests, all green, including every
  pre-existing status/submissions test
  (`test/status-bulk-full-match.test.ts`, `test/acceptance-form-tasks.test.ts`,
  `test/api-submissions.test.ts`, and the rest) with assertions UNCHANGED.

## Scope notes

- `planAcceptance`'s `submissionId` input field is unused inside the pure
  function body (verified by reading `src/domain/acceptance.ts`); the new
  batched call site passes `""` since there is no longer a single owning
  submission id for a multi-submission plan call. This is a no-op change in
  behavior (the field was already dead for planning purposes).
- Left `ensureOnboardingTasks`'s per-submission single-select participant
  load path (used by the DEC-278 single-contact callers) exactly as-is,
  per the task's explicit "signature ... used by ... callers all stay
  exactly as they are" instruction — only its internals were refactored to
  share the new helper, with the same statement shape as before for the
  single-submission case.

OPEN ITEMS: 0
RESULT: PASS
