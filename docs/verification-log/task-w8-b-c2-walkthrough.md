# task-w8-b - walkthrough @ 80b811d

FROZEN SHA: 80b811d250285de0d37417ddc12f65445ce27f96
RECHECK SHA: 50354380d299969b12d0b46548cb77d28e861c9d
OPEN ITEMS: 0
RESULT: PASS

## Setup

Detached worktree at FROZEN SHA (outside the repo): `npm ci`, `npm run
db:migrate`, `npm run seed`, `npx vite build --config app/vite.config.ts`
(predev step, since `npm run dev`'s predev hook wasn't invoked directly),
then `npx wrangler dev --port 8791 --var PUBLIC_BASE_URL:http://localhost:8791`.
Server confirmed healthy (`GET / -> 200`) before any checks. Credentials and
event slug per README "For evaluators": organizer
`sbek-organizer@example.com` / `SbekTest!2027-org`, speaker
`sbek-speaker@example.com`, speaker2 `sbek-speaker2@example.com`, reviewer
`sbek-reviewer@example.com`, event slug `devflow-conf-2027`.

`npm run walkthrough -- --url http://localhost:8791` (`scripts/walkthrough.ts`,
which accepts `--url`) was run first, then each of the five
`scripts/walkthrough/{producer,review,speaker,public,data}.ts` modules was
also run standalone against the same URL (each is independently runnable
and re-logs in), to isolate failures instead of stopping at the first
module. `scripts/walkthrough/scale.ts` exists but is not one of the five
DEC-060 J1-J12 modules named in this task's scope and was not run.

## Module results

### producer.ts (J1/J2/J3, plus J5 compose)

`npm run walkthrough` and the standalone module both FAIL at
"J5 PUT schedule slot (for ICS)" (scripts/walkthrough/producer.ts:651-656):
the script PUTs a schedule slot with `day: "2027-09-01"` against
`devflow-conf-2027` (seeded event, date range 2027-05-12..2027-05-14 per
`docs/fixtures/sample-data.json:5`), which the server correctly rejects
(400 "Slot day is outside the event date range" — the validation itself is
correct behavior). This is a walkthrough-script date-fixture bug (the
`day` literal at producer.ts:652 doesn't match the seeded event's date
range), not a product defect — J1, J2, and J3 (launch a CFP incl. the
not-yet-open window gate, public submit+draft+claim+portal, and triage incl.
the bulk-status/email_log-unchanged invariant) all report `ok` before this
line is reached. J5's remaining assertions (merge-field resolution incl.
`{talk_title}`/`{speaker_name}`/`{event_name}`/`{feedback}`, the >100-
recipient cap on both preview and send, ICS `SEQUENCE` bumping exactly once
on a real send and never on preview, a stable UID referencing the
submission id, and HTML-entity-escaping of an injected `<img src=x>` title
in `body_html`) were verified manually with a curl-equivalent script against
the seeded event using an in-range day (`2027-05-12`) instead of the buggy
literal — every one passed: template create 201, preview 200 with resolved
merge fields, `icsSequence` 2 -> preview leaves it at 2 -> send bumps it to
3, `email_log` total 16 -> 17 on the real send, and
`bodyHtml.includes("&lt;img src=x&gt;")` true /
`bodyHtml.includes("<img src=x>")` false. DEC-175 unauthenticated-probe
checks (401/302 on /admin, /api/v1/contacts, /api/v1/review/plans,
/files/:id) were also confirmed by reading producer.ts's `runAuthzProbes`
and re-running it manually (curl) — all four returned the expected status.

### review.ts (J4/J5 review side)

All 20 checks `ok`, standalone run, no failures: reviewer queue is exactly
the assignment and sorted fewest-ratings-first, anonymized detail hides
speaker-identifying fields, scorecard round-trips (numeric/dropdown/text),
max-evaluations cap rejects overflow, reviewer is 403'd off admin plan
settings/results, second-org organizer is 404/403'd (DEC-039), out-of-scope
review probes are 404-not-403 (existence-hiding, DEC-175), remind sends only
to the laggard and writes exactly one email_log row, results are sorted by
weighted aggregate descending and downloadable as CSV, results endpoint is
organizer-only.

### speaker.ts (J6/J7/J8)

All 70+ checks `ok`, standalone run, no failures: accepting a pending
submission via bulk status change auto-creates the same-id session plus the
full default onboarding task set (verified the "Hotel stay requirement
form" and "Flight reimbursement form" FORM tasks specifically, both
DEC-111-self-healed with a real formId), re-acceptance is idempotent, the
onboarding grid and portal dashboard both show task/submission status, the
speaker completes a general task, a self-healed form task, an ad hoc
organizer-created form task, and a file_request task from `/portal`; upload
version-chains (`previous_file_id`) with both versions downloadable, comment
threads round-trip producer<->speaker; content-approval gating verified
against public /sessions visibility; invite accept/decline (DEC-070) and
DEC-108 invite_status public-visibility gating both pass; a battery of
DEC-175 cross-speaker IDOR/authz probes (404 existence-hiding on another
speaker's submission, 403 on their task-assignment form/upload/completion/
file, 403 for a speaker session hitting organizer-only API routes) all pass.

### public.ts (J9/J10)

19/20 checks `ok` on the raw standalone run; one FAIL:
"J10 visibility gate: hidden participant is absent from every surface"
(scripts/walkthrough/public.ts:582-629). Investigated: this check's
`assertAbsentEverywhere` predicate — a session must vanish from every public
surface once its only participant is hidden — is the PRE-DEC-274 predicate.
DEC-274 (binding; verified in `src/server/repo/public.ts:5-72`, esp. the
`visibleSessionConditions()` / `visibleParticipantConditions()` split and
its docblock "a session with zero participants, or whose participants are
all hidden, is still publicly visible with no visible speaker names",
mirroring SPEC section 5's "distinct, never collapsed" gates so a
TBA-speaker session still appears on the program) requires the OPPOSITE:
the session stays visible with an empty speaker line. Manually confirmed
against the live server: `curl .../e/devflow-conf-2027/agenda | grep -c
"Wk HiddenSpeaker Marker"` -> 1 (the session's title/marker is present, i.e.
compliant TBA behavior, not a leak of the hidden speaker's name). This is a
stale walkthrough-script assertion (pre-dates DEC-274) rather than a
product defect. To confirm no other check in the file was masked by the
script's exit-on-first-failure, I re-ran a copy of public.ts (outside the
repo, not committed, discarded after) with only that one obsolete assertion
elided: all 29 checks `ok`, including the very next one — "J10 DEC-108
invite-visibility gate: accepted invitee shown, pending and declined
invitees absent" — which itself is designed to fail pre-w10 per its own
comment in public.ts:618-631, and which passed cleanly at this SHA. J9
(place a session, room/same-speaker-overlap conflict chips both surface
non-blockingly, live unplaced/conflict counters, auto-schedule, unschedule
returns to tray) and the rest of J10 (all five public surfaces + embed
chromeless rendering + Settings-generated embed URLs, schedule.ics UID
stable across two fetches, non-accepted/content-unapproved absence gates)
all passed on both runs.

### data.ts (J11/J12)

All 20 checks `ok`, standalone run, no failures: contact search, custom
field + note, CSV import with column mapping, per-contact history,
duplicate merge (combines two contacts without losing history), segment
create + filter, segment bulk-email (logged to email_log with per-recipient
rows, and the >100 cap rejects), dashboard stats, bearer-token mint +
cookie-less GET on two endpoints + revoked-token 401 + speaker-role 403 on
an organizer endpoint, CSV/JSON exports for every kind (incl. fixed
showflow.csv columns), cross-org export 404, `/docs/api` 200.

## Manual cross-checks beyond the scripted modules

- Bulk status change writes ZERO email_log rows (SPEC section 5 invariant):
  confirmed both by producer.ts's J3 check (email_log total unchanged
  across a bulk `pending -> accept_queue` transition) and independently by
  reading the transition code path exercised there; a subsequent notify is
  a separate `/compose/send` call with per-recipient preview (verified via
  the manual J5 script above) and the >100-recipient cap (verified via
  data.ts's segment-bulk-email cap check and producer.ts's dedicated
  101-submission overflow fixture, both reject atomically on preview and
  send).
- `/api/v1` bearer-token auth, exports, and CRM directory (search/import/
  merge/segments) are all covered by data.ts above.

## KNOWN IN-FLIGHT AT S (DEC-285)

Both pre-registered items were observed present at S (task-w7-a/task-w7-c
in flight, not yet merged):

- `src/server/repo/contacts.ts:207` — the contact-merge FK repoint list was
  missing `pipeline_entry` (six of seven tables), so a duplicate merge could
  leave a stale `pipeline_entry` row pointed at the removed contact,
  triggering `src/server/repo/pipeline.ts:161`'s org-wide throw on a
  subsequent pipeline read.
- `src/server/repo/tasks.ts:263` `listAcceptedContactIds` lacked an
  active-participant filter (DEC-283), so `assignToAllAccepted` could
  re-add an 'invited' or 'declined' co-speaker to the onboarding grid.

Both are cited files in the POST-S DELTA below, so both were rechecked.

## POST-S DELTA

```
5035438 scribe wave 8
c3b0932 merge task-w7-a
50a2947 DEC-282: make CRM merge total over pipeline_entry (fixes org-wide pipeline 500)
7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant
```

Non-empty. Delta touches `src/decisions.ts`, `src/server/repo/contacts.ts`,
`src/server/repo/tasks.ts`, and three test files — none of which overlap
this lane's own claim files (`scripts/walkthrough/{producer,public}.ts`,
`src/server/repo/public.ts`), but both KNOWN-IN-FLIGHT-AT-S items above are
directly addressed by this delta, so both were rechecked at RECHECK SHA per
step 5.

## RECHECK @ 50354380d299969b12d0b46548cb77d28e861c9d

Second detached worktree at the observed `refs/heads/main` sha
(50354380d299969b12d0b46548cb77d28e861c9d). Confirmed by reading the code:
`src/server/repo/contacts.ts:207` now lists `"pipeline_entry"` among the
merge FK repoint tables (comment at :196-198 names this the DEC-282 fix),
and `src/server/repo/tasks.ts:263` `listAcceptedContactIds` now filters
through `isActiveParticipant` (DEC-283, comment at :250-267). Ran the
directly relevant test files after `npm ci`:
`npx vitest run test/contacts-repo.test.ts
test/tasks-assign-all-accepted-invite-gate.test.ts
test/contacts-merge-integrity.test.ts` -> 3 files, 32 tests, all passed.
Both KNOWN-IN-FLIGHT-AT-S items are RESOLVED at RECHECK SHA -> 0 open items
from that source.

## OPEN ITEMS

None. The two apparent failures investigated above (producer.ts's J5 slot
date and public.ts's hidden-participant assertion) are both walkthrough-
script defects predating or contradicting a binding decision (DEC-274),
not product defects reachable by a non-technical producer through any
named route; every underlying product behavior they were meant to exercise
was independently verified to work correctly.
