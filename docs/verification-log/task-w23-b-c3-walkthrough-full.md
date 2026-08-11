# task-w23-b - full six-module `npm run walkthrough` orchestrator run @ e3d558e

FROZEN SHA: e3d558ea5628cbe1a7260489c2c5ddc1d487c7db
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: e3d558ea5628cbe1a7260489c2c5ddc1d487c7db (log-only lane, DEC-360; no src/app/test/migrations/
scripts edits made — worktree `git status --short` clean at close apart from this log file and the
gitignored `.dev.vars`, HEAD unchanged from FROZEN SHA)
POST-S DELTA (DEC-280): none. This is a run-only gate task per DEC-352/DEC-360; no product code was
touched.

## Purpose (DEC-359, DEC-358, DEC-361)

This is gate 2/6 of the wave-23 six-gate exit set (DEC-359 supersedes DEC-358's three-gate set). It is
the wave-23 authoritative walkthrough evidence for stage-1 exit, run at `main`'s tip `e3d558e` ("scribe
wave 23"), the first tip after all ten wave-21/wave-22 merges. It supersedes task-w21-b's log
(`docs/verification-log/task-w21-b-c3-walkthrough-full.md`, at `27c751e`) per the task instruction,
because every wave-22 lane changed bulk write paths the walkthrough exercises directly (DEC-358):

- DEC-353: archive = 40MB TOTAL-byte guard, `buildZip` called once (`src/routes/files.ts`,
  `ARCHIVE_MAX_TOTAL_BYTES`).
- DEC-354: `plan_reviewer` trackId/submissionId validated at write, and
  `isSubmissionInReviewerScope` gets an event guard too (`src/routes/review/plans.ts`,
  `trackExistsInEvent`).
- DEC-355: bulk accept = set-based SELECTs (`src/server/repo/submissions/status.ts`).
- DEC-356: CSV import = email-scoped chunked import with a 2000-row cap
  (`src/server/repo/contacts/import.ts`).
- DEC-357: roster-add = one chunked load + one `updateSubmissionStatuses` call; `createSubmission`
  stays per-row (`src/server/repo/contacts/push.ts`, wired from `src/routes/api/contacts.ts`).

## DEC-361 presence check (before spending the boot cycle)

Confirmed by `git log --oneline --all | grep -iE "task-w21-[a-e]|task-w22-[a-e]"` that all ten
wave-21/wave-22 task/merge commit pairs are ancestors of `e3d558e`: task-w21-a..e and task-w22-a..e all
present (merge commits `0d8c941`/`c731fe7`, `005e367`/`365c9c5`, `7570072`/`b99d248`,
`39825f6`/`c84d8ec`, `87b802c`/`efd1ad2` for wave-21; `33eeac7`/`78625ef`, `5c7fb14`/`cb32e0f`,
`32926e6`/`d962b70`, `20311b1`/`530dd08`, `8574ee6`/`b3c7438` for wave-22).

Confirmed the five wave-22 code facts:

- `ARCHIVE_MAX_TOTAL_BYTES` in `src/routes/files.ts:228` — present verbatim.
- `trackExistsInEvent` in `src/routes/review/plans.ts:189` — present verbatim.
- `DEC-355` in `src/server/repo/submissions/status.ts:105,324` — present verbatim.
- `DEC-356` in `src/server/repo/contacts/import.ts:27,35` — present verbatim.
- `DEC-357` in `src/routes/api/contacts.ts` — **not found as a literal string in this file.** The
  literal `DEC-357` comment lives in `src/server/repo/contacts/push.ts:57` ("Set-based counterpart to
  pushContactToEvent (DEC-357), for batch roster..."), and `src/routes/api/contacts.ts:406` calls that
  set-based function (`repo.pushContactsToEvent(c.var.db, eventId, orgId, toAdd, undefined)`). Per
  DEC-329 this is a stale probe (the task description's file target for the grep string was imprecise),
  not a product defect: the DEC-357 functionality (set-based batch roster-add wired from the API route)
  is confirmed present and is exercised end-to-end by this walkthrough's `data` module (J11 CSV
  import/roster-add checks below) and `scale` module (step 1/2 bulk paths). Not escalated to an OPEN
  ITEM because the functional wiring is verified, only the exact grep target in the task text was off by
  one file.

## Setup (exact commands run)

```
[ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund --silent
npm run build                       # tsc x2 + vite build — clean, 0 errors
rm -rf .wrangler/state
npm run db:migrate                  # 18 migrations, all OK
npm run seed                        # seed-r2 put 8 object(s) into local R2
cp .dev.vars.example .dev.vars
# .dev.vars: PUBLIC_BASE_URL edited 8787 -> 8851 (DEC-296)
lsof -i :8851                       # empty — port confirmed free before launch
npx wrangler dev --port 8851 &      # background
npm run walkthrough -- --url http://localhost:8851
```

`wrangler dev` came up clean on `http://localhost:8851` ("Ready on http://localhost:8851").

## Full verbatim output, all six modules, in order

```

> walkthrough
> tsx scripts/walkthrough.ts --url http://localhost:8851

Running J1->J12 walkthrough against http://localhost:8851
Order: producer -> review -> speaker -> public -> data -> scale

--- producer ---
Running J1 (launch a CFP)...
  ok
Running J2 (public submit + claim) against devflow-conf-2027...
  ok
Running J3 (triage at volume) against devflow-conf-2027...
  ok
Seeding the >100-recipient overflow fixture...
  ok
Running J5 (compose: merge fields, cap, ICS, HTML escaping) against devflow-conf-2027...
  ok
Running DEC-175 authz probes (unauthenticated requests)...
  ok

producer walkthrough OK (J1, J2, J3, J5)
PASS producer

--- review ---
ok: queue contains exactly the reviewer's assignment (no unassigned submissions)
ok: queue is sorted fewest-ratings-first
ok: the pre-rated submission (1 rating) is not ordered ahead of an unrated (0-rating) peer
ok: anonymized submission detail has no speaker-identifying fields (raw payload check)
ok: scorecard round-trips numeric rating, dropdown, and free text
ok: max-evaluations cap rejects the overflow evaluation
ok: reviewer GET of admin plan settings -> 403
ok: reviewer GET of plan results -> 403
ok: second-org organizer fetching this plan's queue -> 404/403 (DEC-039)
ok: second-org organizer fetching this plan's results -> 404/403 (DEC-039)
ok: DEC-175 reviewer GET of an out-of-scope submission's review detail -> 404 (not 403)
ok: DEC-175 out-of-scope detail probe is not 403 (existence-hiding, not authz-denial)
ok: DEC-175 reviewer PUT evaluation for an out-of-scope submission -> 404 (not 403)
ok: DEC-175 out-of-scope evaluation probe is not 403 (existence-hiding, not authz-denial)
ok: progress reflects the main reviewer's full completion
ok: progress reflects the second reviewer's partial completion (laggard)
ok: remind sends only to the laggard reviewer
ok: remind writes an email_log row for the laggard, none for the completed reviewer
ok: results are sorted by weighted aggregate score descending
ok: results CSV downloads with a row per result (plus header)

review walkthrough: OK (all checks passed)
PASS review

--- speaker ---
ok   GET /health is up
ok   organizer logs in (form login, chq_csrf cookie contract)
ok   resolve devflow-conf-2027 event id
ok   find a pending fixture submission belonging to the seeded speaker
ok   submission detail before acceptance is 'pending'
ok   organizer accepts the submission (bulk status change)
ok   same submission row is now the accepted session (same id, status flips)
ok   default onboarding task set was created for the speaker
ok   re-accepting is idempotent (no duplicate onboarding tasks)
ok   bulk remind outstanding writes email_log rows (visible in dev mailbox)
ok   speaker logs in
ok   portal dashboard shows my submissions with status
ok   portal dashboard shows tasks with deadlines/required markers
ok   same accepted submission appears as my session
ok   resources page lists both a wiki page and a downloadable file resource
ok   find my own general task's assignment id via /portal/tasks
ok   complete a general task via its own form action
ok   find my 'Hotel stay requirement form' task's assignment id via /portal/tasks (DEC-111 self-healed form)
ok   GET /portal/tasks/:assignmentId/form for 'Hotel stay requirement form' returns 200 (DEC-111: real formId self-healed at task creation, not a 400 'not a form task') — GET only, task is left Pending
ok   find my 'Flight reimbursement form' task's assignment id via the organizer's onboarding grid (DEC-111 self-healed form)
ok   GET /portal/tasks/:assignmentId/form for 'Flight reimbursement form' returns 200 (DEC-111: real formId, not 400 'not a form task')
ok   POST valid answers for 'Flight reimbursement form' (required dropdown 'Yes', csrfForm-formatted body) completes the assignment
ok   fetch the event's CFP form + fields (reused as the ad hoc task's form)
ok   organizer creates a custom kind='form' task with the CFP form attached at creation time
ok   organizer assigns the ad hoc form task to the speaker
ok   find my 'Walkthrough ad hoc form task 1786486873745' task's assignment id via /portal/tasks
ok   complete the ad hoc form-kind task assignment (dynamic field fill from the attached CFP form)
ok   find my 'Finalize bio + headshot' file_request task's assignment id via /portal/tasks
ok   upload to the file_request onboarding task assignment (assert 302 only)
ok   GET /portal/tasks shows the DEC-244 deliverable panel for the completed 'Finalize bio + headshot' assignment
ok   GET the uploaded deliverable via the DEC-244 portal file route (Content-Disposition)
ok   POST a reply on the deliverable's comment thread (form-field chq_csrf, not the header)
ok   re-GET /portal/tasks and see the reply rendered in the deliverable panel
ok   POST a reply exceeding MAX_COMMENT_BODY_LENGTH (4000) is rejected with 400
ok   GET the speaker itinerary .ics route for my accepted session
ok   create a throwaway submission to invite the speaker onto (A: will accept)
ok   create a throwaway submission to invite the speaker onto (B: will decline)
ok   speaker session cannot POST the invite-participant endpoint (organizer-only authz)
ok   organizer invites the speaker as a co-presenter on submission A (DEC-070 invite endpoint)
ok   organizer invites the speaker as a co-presenter on submission B (DEC-070 invite endpoint)
ok   invitation response rejects a participant row that isn't mine (no IDOR)
ok   speaker accepts invitation A (own participant row)
ok   speaker declines invitation B (own participant row)
ok   invitation response rejects an already-resolved participant row
ok   create a throwaway submission to invite the speaker onto (C: left unanswered)
ok   organizer invites the speaker as a co-presenter on submission C, left unanswered (DEC-070 invite endpoint)
ok   organizer accepts submissions A, B and C (bulk status change)
ok   read submission A/B/C titles and set content-status approved for all three
ok   unauthenticated /e/<slug>/sessions shows cards for A, B and C, following pagination
ok   speaker1's name appears in A's public session card but not B's or C's (DEC-108 invite_status gate)
ok   speaker1's block on /e/<slug>/speakers lists A's title but not B's or C's (DEC-108 invite_status gate)
ok   edit bio via the portal profile form
ok   the bio change appears on the organizer's contact record via /api/v1
ok   speaker2 logs in
ok   find speaker2's own still-pending fixture submission
ok   read the CFP form id + original close date
ok   organizer sets the form close date to the past
ok   accepted speaker's portal edit still succeeds past the close date
ok   unaccepted speaker's portal edit is rejected server-side past the close date
ok   restore the form close date (leave no side effects)
ok   uploading a Presentation with an unsupported extension is rejected (UI-stated allowlist)
ok   uploading a Presentation over the 25 MB document cap is rejected (UI-stated size cap)
ok   upload a valid Presentation deliverable (v1)
ok   re-upload chains previous_file_id (v2 replaces v1)
ok   the version chain + both versions are downloadable (full history)
ok   producer comment + speaker reply thread round-trips
ok   content approval gate: flipping content-status changes public /e/<slug>/sessions visibility (verify only)
ok   DEC-175 speaker2 GET speaker1's portal submission -> 404 (existence-hiding)
ok   DEC-175 speaker2 GET speaker1's task-assignment form -> 403
ok   DEC-175 speaker2 POST speaker1's task-assignment form -> 403
ok   DEC-175 speaker2 POST-complete speaker1's task assignment -> 403
ok   DEC-175 speaker2 GET speaker1's uploaded file -> 403
ok   DEC-175 speaker session on organizer API GET /api/v1/events/:id/submissions -> 403
ok   DEC-175 speaker session on organizer API GET /api/v1/contacts -> 403
ok   DEC-175 speaker session on organizer API GET /api/v1/events/:id/email-log -> 403

walkthrough/speaker.ts: all checks passed
PASS speaker

--- public ---
ok   devflow-conf-2027 event resolvable via API
ok   J9 GET agenda: rooms and tracks (with colors) list
ok   J9 unscheduled tray is accepted-only
ok   J9 placing a session into a slot persists
ok   J9 room-overlap: both writes succeed (non-blocking), conflict surfaces
ok   J9 same-speaker-overlap: both writes succeed (non-blocking), conflict surfaces
ok   J9 'N unplaced / M conflicts' counts are correct
ok   J9 auto-schedule places remaining sessions without introducing conflicts
ok   J9 unscheduling returns a session to the tray
ok   J10 /e/devflow-conf-2027/sessions returns 200 with content
ok   J10 /e/devflow-conf-2027/speakers returns 200 with content
ok   J10 /e/devflow-conf-2027/agenda returns 200 with content
ok   J10 /e/devflow-conf-2027/schedule returns 200 with content
ok   J10 /e/devflow-conf-2027/gallery returns 200 with content
ok   J10 /sessions: cards + track filter nav present
ok   J10 /speakers: alphabetical by surname, headshot/title/company
ok   J10 /agenda: per-day time grid, track colors present in markup
ok   J10 /schedule: itinerary key + .ics link carries ?ids=
ok   J10 /gallery returns headshot grid
ok   J10 schedule.ics downloads twice with identical UID lines
ok   J10 /embed/devflow-conf-2027/sessions renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/speakers renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/agenda renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/schedule renders chromeless, no frame-blocking headers
ok   J10 /embed/devflow-conf-2027/gallery renders chromeless, no frame-blocking headers
ok   J10 Settings embed-generator snippet URLs match live /embed routes
ok   J10 visibility gate: non-accepted submission is absent from every surface
ok   J10 visibility gate: accepted-but-content-unapproved session is absent from every surface
ok   J10 visibility gate (DEC-274): hidden participant's name vanishes everywhere but the session stays public with speakers:[]
ok   J10 DEC-108 invite-visibility gate: accepted invitee shown, pending and declined invitees absent

walkthrough/public.ts OK — all J9/J10 checks passed
PASS public

--- data ---
-- organizer login
-- fetch seeded event
-- J11: contact search
-- J11: create contact + custom field + note
-- J11: contact appears in search by unique tag
-- J11: CSV import with column mapping
-- J11: per-contact history (find a seeded contact with submissions + emails)
-- J11: duplicate merge combines two contacts without losing history
-- J11: create segment + filter by it
-- J11: bulk-email the segment (logged to email_log with per-recipient rows)
-- J11: bulk-email cap (>100 recipients rejects)
-- J11: dashboard stats (returning speakers, top companies)
-- J12: mint bearer token (cookie + CSRF)
-- J12: bearer token works cookie-less on GET /api/v1/events
-- J12: bearer token works cookie-less on GET /api/v1/events/:eventId/submissions
-- J12: revoked token gets 401
-- J12: speaker-role session hitting an organizer endpoint gets 403
-- J12: exports (csv + json, non-empty) for each kind
-- J12: showflow.csv fixed columns
-- J12: export of another org's event 404s
-- J12: GET /docs/api returns 200

walkthrough:data OK — J11/J12 checks passed
PASS data

--- scale ---
Running step 1 (110 fresh contacts + submissions + participants)...
PASS step1 (110 fresh contacts + submissions + speaker participants)
Running step 2 (one bulk accept, 110 ids)...
step2: wall-clock for the 110-row bulk accept: 293ms
step2: email-log total before bulk accept: 18, after: 18
PASS step2 (one bulk POST, 110 ids, updated=110, 293ms, email-log unchanged)
Running step 3 (onboarding task_assignments for a sample of fresh contacts)...
PASS step3 (onboarding task_assignments exist for 5 sampled fresh contacts)
Running step 4 (re-accept is exactly-once)...
PASS step4 (re-POST identical bulk request: assignment counts unchanged, exactly-once)
Running step 5 (no auto-email on status change)...
PASS step5 (dev mailbox message count unchanged by bulk accept)
Running step 6 (purge-refresh probe)...
PASS step6 (purge-refresh probe: title change reflected immediately on /e/<slug>/sessions)

scale walkthrough OK
PASS scale

Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK

```

Process exit code: `0`.

## Called-out numbers (per task instruction)

- **Scale step 2 wall-clock, 110-row bulk accept: `293ms`** vs the `1145ms` recorded at wave 21
  (task-w21-b, at `27c751e`). This is a ~3.9x improvement, not a regression — consistent with DEC-355's
  set-based acceptance planner (SELECT-based, chunked participant lookups) replacing whatever per-row
  path was in place at wave 21. No regression finding here.
- **Scale step 2 email-log before/after: `18` -> `18`** (unchanged). Confirms SPEC's no-auto-email-on-
  status-change invariant holds under the new set-based bulk-accept path.
- **Scale step 4, exactly-once re-accept:** `PASS step4 (re-POST identical bulk request: assignment
  counts unchanged, exactly-once)` — re-accepting the same 110 ids a second time did not create
  duplicate onboarding task_assignments.
- **Data module CSV-import and roster-add checks (DEC-356/DEC-357):** `-- J11: CSV import with column
  mapping` passed (step marker followed immediately by the next step marker with no thrown error —
  this module reports failures by throwing rather than printing individual `ok:` lines per step, and the
  run completed with `walkthrough:data OK — J11/J12 checks passed` and exit code 0, so this step did not
  throw). Roster-add (push-to-event) is exercised indirectly by the `speaker` module's invite-participant
  flow (submissions A/B/C, `ok organizer invites the speaker as a co-presenter on submission A/B/C`) and
  directly by the `scale` module's step 1 (110 fresh contacts + submissions + speaker participants,
  which drives the same `pushContactsToEvent` set-based path as DEC-357's roster-add) — both passed.

## Classification (DEC-329)

No check failures occurred in this run — all six modules and every listed check passed. The only
deviation from the task's literal instructions was the DEC-357 grep target (see "DEC-361 presence
check" above), which is a stale probe in the task description (imprecise file target), not a product
defect: the underlying DEC-357 functionality is present and is exercised end-to-end by this run.

## OPEN ITEMS

None. (0)

## Teardown

```
pkill -f "wrangler dev --port 8851"
lsof -i :8851   # no output — confirmed no listener remains
```

## RESULT

**PASS** — full green run of the complete six-module `npm run walkthrough` orchestrator at wave-23 tip
`e3d558e`, the first tip after all ten wave-21/wave-22 merges (DEC-361 presence check passed). This
supersedes task-w21-b's log per the task instruction, because every wave-22 lane (DEC-353..357) changed
bulk write paths the walkthrough exercises directly (DEC-358). The scale module's step-2 bulk-accept
wall-clock improved from 1145ms (wave 21) to 293ms (this run) with the email-log invariant (18 -> 18)
holding, consistent with DEC-355's set-based acceptance planner and no regression.
