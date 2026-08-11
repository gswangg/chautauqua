# task-w22-e (DEC-357): CSV-import roster-add batched

FROZEN SHA (branch point): 24155d94b6020e807970bb37b4959a00687cc1ec

## What changed

- `src/server/repo/contacts/push.ts`: added `pushContactsToEvent(db, eventId,
  orgId, contacts, title?)` — creates one submission per contact via the
  existing per-row `createSubmission` (kept per-row deliberately:
  `submissionSeqSubquery` at `src/server/repo/submit.ts:225` would collide on
  `seq` under a multi-row `VALUES` insert), applying the same
  `Invited: <First> <Last>` default title per contact, then calls
  `updateSubmissionStatuses` **exactly once** over every created id. Returns
  submission ids in input order. The single-contact `pushContactToEvent` is
  unchanged and still used by the two other callers
  (`POST /contacts/:id/add-to-event`, `POST /contacts` with `eventId`).
- `src/server/repo/contacts.ts` (barrel): re-exports `pushContactsToEvent`.
  `findContactsForOrg` (chunked by `ID_CHUNK_SIZE`=90, DEC-078) already
  existed in `src/server/repo/contacts/bulk.ts` and was already barreled —
  no new function needed for that half of the task.
- `src/routes/api/contacts.ts` (`POST /contacts/import` with `eventId`):
  replaced the per-contact loop (`findContactForOrg` + `pushContactToEvent`
  per id) with one `findContactsForOrg` call over the not-already-on-roster
  subset and one `pushContactsToEvent` call. Response shape
  (`created`/`updated`/`skipped`/`addedToEvent`), the already-on-roster skip,
  and the loud throw naming a contactId `applyImportRows` returned that
  isn't org-owned are all preserved.

## Tests

`test/contacts-import-roster-batch.test.ts` (new):
- Repo-level `pushContactsToEvent`: a counting fake db asserts the
  `updateSubmissionStatuses` row-status read happens exactly once for 3
  contacts (not 3 times), each row still gets its own commit (3 update
  calls, all `status: 'accepted'`), it's a no-op for an empty list, and the
  default title is applied per contact.
- Repo-level `findContactsForOrg`: asserts `ceil(95/90) = 2` select
  statements for 95 ids and 0 for an empty list.
- Route-level `POST /contacts/import` with `eventId`: a real per-row
  filtering fake db (WHERE conditions walked via the established
  `queryChunks` token-extraction pattern, e.g.
  `test/agenda-room-ownership.test.ts`) confirms importing 3 new contacts
  issues exactly one `repo.findContactsForOrg` call and one
  `repo.pushContactsToEvent` call (via `vi.spyOn` call-through), with
  `addedToEvent: 3` and response shape unchanged; and that re-importing with
  one already-on-roster contact + one new contact only pushes the new one.

Ran the full suite (not just this file) to catch any regression in the two
other `pushContactToEvent` call sites and the existing
`test/contacts-roster-import.test.ts` / `test/contacts-add-to-event.test.ts`
coverage.

## Build / test results

- `npm run build`: PASS (tsc --noEmit x2 + vite build), zero errors.
- `npm test`: PASS — 231 test files, 1937 tests, 0 failures.

## OPEN ITEMS: 0

## RESULT: PASS
