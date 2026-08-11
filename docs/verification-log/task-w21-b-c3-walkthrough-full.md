# task-w21-b - full six-module `npm run walkthrough` orchestrator run @ 27c751e

FROZEN SHA: 27c751e8e2b9eb497017c4675150f140890b02bf
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: 27c751e8e2b9eb497017c4675150f140890b02bf (run-only lane; no src/app/test/migrations/scripts
edits made — worktree `git status --short` clean at close apart from this log file, HEAD unchanged from
FROZEN SHA)
POST-S DELTA (DEC-280): none. This is a RUN-ONLY gate task per DEC-352; no code was touched.

## Purpose (DEC-352, DEC-343)

This is the wave-21 authoritative walkthrough evidence for stage-1 exit, run at the first tip
containing the wave-20 lanes: DEC-344 (files library server-paged), DEC-345 (results rank->sort->slice
in order, `resultsSort.ts` deleted), and DEC-346 (review load-shedding: plan loads shed `description`,
queue counts via SQL `GROUP BY`). It supersedes task-w19-b's log
(`docs/verification-log/task-w19-b-c3-walkthrough-full.md`, at `48387c3`) per the task instruction,
because that run predates the wave-20 lanes.

Per DEC-343, this green six-module run is also what closes task-w17-e's historical `RESULT: FAILED`
(recorded in `docs/verification-log/task-w17-e-c3-walkthrough-full.md`) — restated explicitly here since
task-w19-b already closed it once and this run reconfirms the closure at a newer tip: **a green
six-module orchestrator run closes task-w17-e's FAILED; this run is green.**

## Task premise verified before running

Confirmed `scripts/walkthrough-lib.ts` defines all six `WALKTHROUGH_AREAS` (producer, review, speaker,
public, data, scale) at line 15 of the worktree tip, and that the wave-20 lanes cited above are present
in this worktree's history:

```
git log --oneline -3
27c751e scribe wave 21
<earlier wave-20 merges, including DEC-344/345/346 lanes>
```

Branched via `git -C .../chautauqua worktree add .../chautauqua-wt/task-w21-b -b task-w21-b main`,
landing exactly at `main`'s tip (`27c751e`).

## Setup (exact commands run)

```
[ -d node_modules ] || npm ci --prefer-offline --no-audit --no-fund --silent
npm run build                       # tsc x2 + vite build — clean, 0 errors
rm -rf .wrangler/state
npm run db:migrate                  # 18 migrations, all ✅
npm run seed                        # seed-r2 put 8 object(s) into local R2
cp .dev.vars.example .dev.vars
# .dev.vars: PUBLIC_BASE_URL edited 8787 -> 8821 (DEC-296)
lsof -i :8821                       # empty — port confirmed free before launch
npx wrangler dev --port 8821 &      # background
npm run walkthrough -- --url http://localhost:8821
```

`wrangler dev` came up clean on `http://localhost:8821` ("Ready on http://localhost:8821").

## Full verbatim output, all six modules, in order

```
> walkthrough
> tsx scripts/walkthrough.ts --url http://localhost:8821

Running J1->J12 walkthrough against http://localhost:8821
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
ok   find my 'Walkthrough ad hoc form task 1786484838837' task's assignment id via /portal/tasks
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
step2: wall-clock for the 110-row bulk accept: 1145ms
step2: email-log total before bulk accept: 18, after: 18
PASS step2 (one bulk POST, 110 ids, updated=110, 1145ms, email-log unchanged)
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

## Classification (DEC-329)

No failures occurred in this run — all six modules and every listed check passed. There is nothing to
classify as stale-probe-vs-product-defect. The DEC-344 (files library), DEC-345 (results sort), and
DEC-346 (review load-shedding) lanes are all exercised end-to-end by this run's `review`, `speaker`, and
`data` module checks (queue ordering, results sort, deliverable panels) and none regressed.

## OPEN ITEMS

None. (0)

## Teardown

```
lsof -ti :8821 | xargs kill
lsof -i :8821   # no output — confirmed no listener remains
```

## RESULT

**PASS** — full green run of the complete six-module `npm run walkthrough` orchestrator at wave-21 tip
`27c751e`, the first tip containing the wave-20 lanes (DEC-344/345/346). This supersedes task-w19-b's
log per DEC-352's task instruction, and per DEC-343 this green run (again) closes task-w17-e's
historical `RESULT: FAILED`.
