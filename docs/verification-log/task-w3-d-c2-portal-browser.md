# task-w3-d-c2-portal-browser

J6 onboarding + J7 speaker portal browser pass (DEC-259). Chromium via
Playwright (`.scratch/browser-pass.ts` and `.scratch/cron-check.ts`, both
deleted before this commit per the task instructions), zero
console/pageerror allowlist, against `wrangler dev --port 8833 --var
PUBLIC_BASE_URL:http://localhost:8833` (a second instance on 8834 with
`--test-scheduled` for the cron check — both share the project's local D1/R2
persistence). Organizer, speaker (`sbek-speaker@example.com`), and
speaker2 (`sbek-speaker2@example.com`) browser contexts. Base main SHA for
this wave: `cf35a87` ("merge task-w2-h").

**Worktree note:** this task's worktree was reclaimed mid-task once already
(directory emptied, branch left in place at main's tip) before any commit
landed — re-created via `git worktree add .../task-w3-d task-w3-d` (branch
already existed at `cf35a87`, matching current main) and the whole browser
pass was re-run from scratch. No product code changed between the two runs
(`npm run build` output hashes were identical).

## (1) Accept-fires-J6-once + idempotent re-accept

Created a fresh submission via the organizer API
(`POST /api/v1/events/:eventId/submissions`, same real write path
`scripts/walkthrough/scale.ts` uses) with a brand-new contact, so the
before-state had zero pre-existing tasks for that contact. Accepted it
(`POST /api/v1/events/:eventId/submissions/status`), then read the
onboarding grid:

- new speaker contact created on acceptance — PASS
- default task set is exactly 5 tasks: Hotel stay requirement form, Flight
  reimbursement form, Finalize talk description, Finalize bio + headshot,
  Announce participation — PASS (includes both swyx must-haves,
  `docs/clarifications.md:36`)
- decline (`status: 'declined'` — DEC-003 literal, not `'rejected'`) then
  re-accept: `assignments after == assignments before` (5 == 5), proving
  `runAcceptancePlanning`'s existing-title skip
  (`src/server/repo/submissions/status.ts`) is real and idempotent — PASS

This exercises the exact-once/idempotent guarantee already covered by
`src/domain/acceptance.ts`'s `planAcceptance` (skips any (contact,title)
pair already present) and DEC-079's planning-before-commit ordering; this
pass is live evidence at the HTTP+DB layer, not just the pure-function unit
tests.

## (2) Organizer onboarding grid

`/admin/speakers` renders `.chq-onboarding-table` (waited specifically for
the `<table>`, not the always-present `.chq-onboarding-counts` summary
frame, which renders immediately with placeholder zeros before the
`/onboarding` fetch resolves — a timing trap for any future browser
driver). First screen shows "N accepted speakers / N outstanding required
tasks / N overdue" plus one due-date per task column
(`.chq-task-due`) — "who still owes me what" is answerable without
drilling in. `GridFilters`/`filterOnboardingRows` exist for status/overdue
filtering (`app/src/pages/speakers/{GridFilters,rowFilters}.tsx`, not
re-verified beyond render since untouched this pass).

## (3) Remind everyone outstanding

Clicked "Remind everyone outstanding" → confirm dialog parses "email N
contacts" → "Confirm and send" → toast "Reminder sent to N contacts". N
(outstanding contact count) matched between confirm-dialog and toast on
every run (10, 132, 133, 135 across re-runs as seed/walkthrough data
accumulated). `/dev/mailbox`'s paginated summary line ("N message(s) — page
P") gained exactly N rows each time (a naive `<tr>` count is wrong here —
the mailbox list is paginated and undercounts past the first page; fixed
mid-pass). Opened our test contact's reminder email body: it lists every
one of that contact's outstanding task titles (all 5, since none were
completed) in one message — confirms per-contact grouping, not per-task
sends.

## (4) Cron reminders

`npx wrangler dev --port 8834 --test-scheduled --var
PUBLIC_BASE_URL:http://localhost:8834` (a second instance, same project
directory → same local D1/R2 state as the 8833 instance) worked — `/health`
200s and `GET /__scheduled` returns 200 and runs `handleScheduled` ->
`runDueReminders`. Live-triggered evidence:

- Set every task in a fresh contact's onboarding row to a due date 1h from
  now (inside DEC-023's 72h `DUE_WINDOW_MS`) via `PATCH /api/v1/tasks/:id`.
- First `GET /__scheduled`: mailbox message count increased (72h window
  fires) — PASS.
- Immediate second `GET /__scheduled`: mailbox count unchanged (DEC-023's
  24h `DEDUPE_WINDOW_MS` suppresses the repeat) — PASS.

For "one bad recipient does not abort the tick" (DEC-238 class 1): the live
cron pass above only had good recipients, so this specific guarantee is
proven by a new regression test rather than by inducing a real bad send
live (there's no supported way to get a malformed-but-accepted recipient
through the CFP/portal write paths). Added
`test/tasks-due-reminders-mailer-failure.test.ts`, mirroring the existing
class-2 (`remindNow`) mailer-failure test's fakeDb/fakeMailer convention but
calling `sendDueRemindersForEvent` — the exact function `runDueReminders`
(`src/routes/tasks.ts`) invokes per event — directly: two outstanding
assignments on one event, one recipient's `mailer.send` throws, the other
succeeds; asserts the call does not throw, the good recipient is sent to,
only their assignment is stamped `last_reminded_at`. `runDueReminders`
itself additionally wraps each event's `sendDueRemindersForEvent` call in
its own try/catch (`src/routes/tasks.ts`, existing code, unchanged this
wave) so a whole-event failure can't abort other events' passes either —
that outer-loop guarantee has no dedicated unit test (would need a full D1/
miniflare harness `makeDb(env)` can't be faked the way the plain-object
`Db` stub above is), so it's evidenced live: the `/__scheduled` triggers
above ran across the seeded `devflow-conf-2027` event plus every walkthrough
event accumulated in this D1 from prior `npm run walkthrough` runs, without
crashing.

## (5) Portal (J7)

- `/portal/tasks` renders "My Tasks"; `/portal` dashboard renders and shows
  the pending session invitation.
- Invitation accept/decline: organizer invited the seeded speaker as a
  co-presenter on the fresh test submission
  (`POST /api/v1/submissions/:id/participants`, `inviteStatus: 'invited'`
  in the response). Speaker portal dashboard showed
  `Invited to co-present "Browser Pass Test Talk"`; clicked Accept; the
  invitation line for that submission disappeared; organizer's
  `GET /api/v1/submissions/:id` then showed that participant's
  `inviteStatus: 'accepted'` — PASS, confirms the flip is visible to the
  organizer without any extra plumbing.
- Bio round-trip: filled `/portal/profile`'s `textarea[name="bio"]` with a
  unique string, saved, reloaded the page, read it back via
  `.inputValue()` (note: `body.innerText()` does **not** reflect a
  `<textarea>`'s rendered value in Chromium — a driver-methodology trap,
  not a product bug; fixed mid-pass) — matched. Then loaded the public
  speaker detail page `/e/devflow-conf-2027/speakers/<contactId>` (SPK-08)
  — the same unique bio string appeared there too. PASS both hops.
- Headshot: `section[aria-label="Headshot"] img` (the current-headshot
  preview) is present on `/portal/profile`. Revisiting the profile page
  without uploading anything does **not** show "Headshot uploaded." (DEC-245's
  dedicated `headshotSavedMessage`, gated on `?headshot=1`, distinct from
  the details form's "Profile saved.") — confirms a no-op GET is
  distinguishable from a real upload success (eval-findings D3), matching
  the DEC-245 fix already in `src/routes/portal/profile.tsx`.

## (6) Absolute scoping

- `sbek-speaker2@example.com` hitting `sbek-speaker@example.com`'s task
  assignment form (`/portal/tasks/:assignmentId/form`, a seeded assignment
  id) — 403 (existence-hiding via `getAssignmentScope` +
  `assertOwnAssignmentOr403`).
- `sbek-speaker2` hitting `/admin` — server-side redirected to `/portal`
  (`src/routes/root.tsx`'s `rootRoutes.get("/admin", ...)`: speaker role ->
  redirect, never served the SPA shell) — PASS.

## Console capture

Zero-allowlist `page.on('console')`/`page.on('pageerror')` across all
contexts for the whole pass. One entry captured, and it's the deliberate
403 fetch from item (6) above (`Failed to load resource: ... 403`) —
expected noise from the negative-authz check itself, not a real error.

## Bugs found / fixed this pass

None in product code — every failure encountered during this pass was a
driver-methodology bug in the Playwright script itself (status literal
`'rejected'` vs `'declined'`; waiting on the wrong selector before the grid
table mounts; counting mailbox rows instead of reading the paginated total;
reading a `<textarea>`'s value via `innerText()` instead of
`inputValue()`), not a product defect — all fixed in the (uncommitted,
deleted) driver before the final green run recorded above. No files in the
owned list (`src/routes/portal/{index,profile,edit,shared}.tsx`,
`src/routes/tasks.ts`, `src/server/repo/{tasks,portal,portal-edit,
profile}.ts`, `app/src/pages/Speakers.tsx`, `app/src/pages/speakers/**`)
needed a fix.

## OPEN ITEMS

None discovered in owned scope this wave. (No `participants.ts`/schema
work touched — that's task w3-f's territory per this task's boundary and
wasn't exercised beyond the read paths already covered above.)

## Verification

`npm run build` and `npm test --silent`: 188 test files, 1613 tests
passed, 0 failed (one new file added:
`test/tasks-due-reminders-mailer-failure.test.ts`). `.scratch/` deleted
before this commit.

OPEN ITEMS: 0

RESULT: PASS
