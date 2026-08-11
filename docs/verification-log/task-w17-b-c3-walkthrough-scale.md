# task-w17-b — campaign-3 first execution of scripts/walkthrough/scale.ts

FROZEN SHA: 1fbc7f6b9cfa77c0efe33a0069206b14ef3ecf17 (main, worktree branch point)
RECHECK SHA: 1fbc7f6b9cfa77c0efe33a0069206b14ef3ecf17 (no src/, app/, test/, or migrations/ changes this wave — sole edit is scripts/walkthrough/scale.ts)

## Context

`scripts/walkthrough/scale.ts` (DEC-086/DEC-089) is a first-class member of
`WALKTHROUGH_AREAS` (scripts/walkthrough-lib.ts:15: `producer -> review ->
speaker -> public -> data -> scale`) and `npm run walkthrough` runs it, but
task-w13-b-c3-walkthrough.md explicitly excluded it and no prior -c3- log
records a run. This is that first run.

Setup followed the brief exactly: fresh worktree from main (branch point
1fbc7f6), `npm ci`, `npm run build`, `rm -rf .wrangler/state`, `npm run
db:migrate`, `npm run seed`, `.dev.vars` copied from `.dev.vars.example`
with `PUBLIC_BASE_URL=http://localhost:8792`, `npx wrangler dev --port
8792`, then `npx tsx scripts/walkthrough/scale.ts --url
http://localhost:8792`.

## OPEN ITEMS

**0 product defects found.** One PROBE defect was found and repaired in
this file (scripts/walkthrough/scale.ts), per the DEC-329 classification
rule — see "Probe repair" below.

## Probe repair (DEC-329)

**First run (pre-repair) failed at step 3**, verbatim:

```
Running step 1 (110 fresh contacts + submissions + participants)...
PASS step1 (110 fresh contacts + submissions + speaker participants)
Running step 2 (one bulk accept, 110 ids)...
step2: wall-clock for the 110-row bulk accept: 164ms
step2: email-log total before bulk accept: 3, after: 3
PASS step2 (one bulk POST, 110 ids, updated=110, 164ms, email-log unchanged)
Running step 3 (onboarding task_assignments for a sample of fresh contacts)...
FAILED: step3: sampled contact 6emxzpdqf7q6yuzagn3v has onboarding task_assignments
  expected 5 task_assignment cells, got 0
```

**Root cause investigation** (direct sqlite inspection of
`.wrangler/state/v3/d1/.../*.sqlite`): all 110 submissions reached
`status='accepted'`, but every scale-fixture `participant` row had
`invite_status='invited'`, not `'none'`/`'accepted'`. The original step 1
built each participant via `POST /api/v1/contacts` (create contact) then
`POST /api/v1/submissions/:id/participants` (invite). That route,
`inviteParticipant` in src/server/repo/participants.ts:61-113, *always*
writes `inviteStatus: "invited"` — a deliberate DEC-070 invariant ("creating
an invitation NEVER sends email; notifying the invitee is a separate,
explicit action"). `isActiveParticipant` (src/domain/acceptance.ts:80-84,
DEC-278) only treats `'none'`/`'accepted'` as active, and
`ensureOnboardingTasks` (src/server/repo/submissions/status.ts:118-135)
plans onboarding tasks only for active participants on the accept
transition. So the product correctly excluded these `'invited'`
participants from onboarding planning — this is DEC-274/278/317 working as
designed, not a bug.

This is a stale probe premise, not a product defect: the probe's step 1
assumed an organizer-created participant becomes onboarding-eligible
immediately on accept, which no binding decision supports. The narrowest
fix that derives from the real API surface (not a hardcoded date/id, not a
weakened assertion) is `POST /api/v1/events/:eventId/submissions` with an
inline `contact: {email, firstName, lastName}` body
(src/server/repo/submissions/create.ts:67-107 `createSubmission`), which
inserts the participant with `inviteStatus: "none"` directly — the same
"this person is the submitter, no invite needed" path public submissions
use. Repaired scale.ts's `seedScaleFixture` (step 1) to use this single
POST instead of the three-call contact+submission+invite-participant
sequence, reading `contactId` back from the response's
`participants[0].contactId`. No assertion was loosened; step 3's assertion
(`n === ONBOARDING_TASK_COUNT`, i.e. exactly 5) is unchanged.

**Second run (post-repair) passed all 6 steps** — see full output below.

## RESULT: PASS (6/6 steps)

Full verbatim output of the successful run:

```
Running step 1 (110 fresh contacts + submissions + participants)...
PASS step1 (110 fresh contacts + submissions + speaker participants)
Running step 2 (one bulk accept, 110 ids)...
step2: wall-clock for the 110-row bulk accept: 639ms
step2: email-log total before bulk accept: 3, after: 3
PASS step2 (one bulk POST, 110 ids, updated=110, 639ms, email-log unchanged)
Running step 3 (onboarding task_assignments for a sample of fresh contacts)...
PASS step3 (onboarding task_assignments exist for 5 sampled fresh contacts)
Running step 4 (re-accept is exactly-once)...
PASS step4 (re-POST identical bulk request: assignment counts unchanged, exactly-once)
Running step 5 (no auto-email on status change)...
PASS step5 (dev mailbox message count unchanged by bulk accept)
Running step 6 (purge-refresh probe)...
PASS step6 (purge-refresh probe: title change reflected immediately on /e/<slug>/sessions)

scale walkthrough OK
```

Exit code: 0.

## SPEC §5/§7 required data points (J5 rubric hook)

- **Wall-clock of the 110-row bulk accept POST**: 639ms (first run,
  pre-repair, measured the same code path: 164ms — both well within any
  reasonable operator-facing latency budget for a >100-id chunked
  operation, DEC-078/079 ID_CHUNK_SIZE=90).
- **`GET /api/v1/events/:id/email-log` total, immediately before vs. after
  the bulk accept**: 3 before, 3 after (both runs) — identical, confirming
  "status changes never send email" (SPEC §5 invariant, house invariant,
  J5 rubric hook) holds at the email-log layer, not just the dev-mailbox
  layer already checked by step 5. This check (`readEmailLogTotal`,
  `bulkAccept` in scripts/walkthrough/scale.ts) is new this wave, added
  per the task brief's explicit ask.

## POST-S DELTA (DEC-280 — informational, never a STOP)

None. The single edit (scripts/walkthrough/scale.ts, step 1's fixture
seeding) touches only scripts/, no product code, no schema, no route
surface. Nothing to reconcile against a post-decomposition or
post-migration state.

## Scope note

Per the task brief, this worker is sole owner of
scripts/walkthrough/scale.ts this wave; no src/, app/, test/, or
migrations/ files were touched. The build (`npm run build`) and the
existing scale-related unit test suite (`test/walkthrough-lib.test.ts`, 29
tests covering `WALKTHROUGH_AREAS` including "scale") both pass unchanged.
