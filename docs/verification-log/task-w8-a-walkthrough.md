# task-w8-a — walkthrough @ d12eb25

Full stdout of `npm run walkthrough -- --url http://localhost:8811` run
against a wrangler dev instance on port 8811 (DEC-103 alternate port),
built/migrated/seeded from a worktree whose code is identical to
`d12eb25` (only a pure-string `src/decisions.ts` append differs).

```

> walkthrough
> tsx scripts/walkthrough.ts --url http://localhost:8811

Running J1->J12 walkthrough against http://localhost:8811
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
ok   fetch the event's CFP form + fields (reused as the attached form)
ok   resolve the 'Hotel stay requirement form' task id
ok   organizer attaches the CFP form to the 'Hotel stay requirement form' task
ok   find my 'Hotel stay requirement form' task's assignment id via /portal/tasks
ok   complete the form-kind onboarding task assignment (dynamic field fill from the attached form)
ok   find my 'Finalize bio + headshot' file_request task's assignment id via /portal/tasks
ok   upload to the file_request onboarding task assignment (assert 302 only)
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
ok   J10 visibility gate: hidden participant is absent from every surface

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
PASS step2 (one bulk POST, 110 ids, updated=110)
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
