## 2026-08-15 task-w45-c — onboarding-lifecycle adjudication @ 8c194ec9

QUALIFYING (advisory to the DEC-069 predicate — this scope classifies to none of the five slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

`git merge --no-edit main` on `task-w45-c` (forked from `main` tip): "Already
up to date". `npm run ref-state` receipt (verbatim): DEC-644 three-sha
boundary: HEAD `8c194ec91ede63942022550bbced9bf3ba00f1b5`; newest first-parent
product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`; every
live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w44-a`,
`task-w44-b`, `task-w44-c`, `task-w44-d`, `task-w44-f`, `task-w44-g`,
`task-w45-a`, `task-w45-b`, `task-w45-c`, `task-w45-d`, `task-w68-d`,
`task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via
`git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed):
`mail-rich-shape-fallback`, `task-w17-i`, `task-w44-e`, `task-w44-i`,
`task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a..j`.

Adjudicated four named J6/J7 claims (SPEC.md:129-144) by direct code reading
(FILE, NEVER FIX — no product code touched). (1) Cron reminder idempotence:
**CONFIRMED-DEFECT** — `src/server/repo/tasks/reminders.ts:416-459`
(`sendReminderEmails`) sends mail in a loop THEN writes the `lastRemindedAt`
dedupe stamp afterward in a separate chunked UPDATE (`:454-459`); no
claim-before-send, no per-(assignment,day) unique constraint, so an
overlapping/retried cron tick (`src/server/scheduled.ts:23-40` aggregate
rethrow, `src/routes/tasks.ts:665-698` per-event try/catch) can duplicate a
send if the post-send stamp write fails or races. (2) Due-day timezone: NOT A
DEFECT — `src/domain/reminders.ts:99-112` `isReminderDue` compares against
`dayLabelEndInstant(a.dueDate, timeZone)`, event-timezone-aware end-to-end
(DEC-801 wave-58, `src/domain/task-due.ts:1-60`). (3) Onboarding task-set
creation idempotence: NOT A DEFECT — guarded twice, JS pre-check
(`src/server/repo/submissions/status.ts:222-234`) AND a real DB unique index
`task_assignment_task_id_contact_id_idx (task_id, contact_id)`
(`migrations/0019_join_table_uniqueness.sql:32`) enforced via
`.onConflictDoNothing` (`status.ts:290-294`); DEC-932 fan-out not re-filed.
(4) Portal scoping absolute: **CONFIRMED-DEFECT** — `getPortalSubmissionDetail`
(`src/server/repo/portal/data.ts:208-273`) and `getResourceDownloadScope`
(`src/server/repo/portal/resources.ts:117-152`) each run their content-bearing
`SELECT` unscoped by `contactId`, then filter ownership afterward in JS
(`isOwnedByContact`/`isParticipantInEvent`) before returning data — the
DEC-962-audited `listDeliverableCandidates`
(`src/server/repo/portal/tasks.ts:227-232`) is the counter-example these
should converge on. Write-guard "scope resolvers"
(`assertOwnAssignment`/`getParticipantScope`) are a distinct, deliberate
idiom and out of scope here.

Targeted tests (DEC-644, `npm run test:targeted`), 15 files: `task-due`,
`onboarding-grid-query`, `portal-preview`, `reminders`,
`reminders-contact-scope`, `reminders-timezone`, `reminder-window-timezone`,
`reaccept-onboarding`, `tasks-due-reminders`,
`tasks-run-due-reminders-aggregate-failure`, `portal-idor-probe`,
`portal-resources-scope`, `portal-invite-scope`, `portal-batched-scope`,
`portal-submission-detail-round-trip-depth` — `Test Files 15 passed (15)`,
`Tests 84 passed (84)`.

Fix directions: defect 1 → claim-before-send (conditional UPDATE or
per-(assignment,day) unique ledger row with `onConflictDoNothing`), wave-46
J6 lane. Defect 2 → move `contactId` into the query WHERE/JOIN for both
readers mirroring `listDeliverableCandidates`, wave-46 J7 lane. Full detail:
`docs/verification-log/task-w45-c-onboarding-lifecycle-adjudication-8c194ec9.md`.

RESULT: PASS — adjudication complete, targeted tests green (84/84), 2 CONFIRMED-DEFECTs filed with fix directions, no product code touched.
OPEN ITEMS: 2
