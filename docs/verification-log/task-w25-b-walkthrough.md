# task-w25-b — golden-walkthrough exit gate @ b2dc2c1

Task: golden-walkthrough exit gate at FROZEN sha
`b2dc2c103309433732bc689b933610fc7cfb3b06` (DEC-223/225), constrained by
DEC-223, DEC-224, DEC-225, DEC-215, DEC-220, DEC-217.

## Step 1 — DEC-114 sha check (DEC-225 allow-list)

`git -C chautauqua log --oneline b2dc2c1..main` (checked from the assigned
worktree's branch point on `main`, `b2991ec`):

| sha | subject | files touched |
|---|---|---|
| `b2991ec` | scribe wave 25 | `decisions/DEC-223.md`, `decisions/DEC-224.md`, `decisions/DEC-225.md`, `field-guide/index.md`, `src/decisions.ts` (const appends) |
| `c36a77c` | merge task-w24-f | `docs/verification-log/task-w24-f-triage-closure.md` |
| `e591034` | merge task-w24-c | `docs/verification-log/task-w24-c-perf-smoke.md` |
| `fa2ae17` | task-w24-f: triage-closure gate FAILS | `docs/verification-log/task-w24-f-triage-closure.md` |
| `7dcbe65` | task-w24-c: perf-smoke gate PASS @ 0a263d2 | `docs/verification-log/task-w24-c-perf-smoke.md` |
| `e92f8b4` | merge task-w24-e | `docs/verification-log/task-w24-e-spec-audit.md` |
| `bfc8099` | merge task-w24-d | `docs/verification-log/task-w24-d-render-sweep.md` |
| `04350dd` | merge task-w24-b | `docs/verification-log/task-w24-b-walkthrough.md` |
| `80dc009` | merge task-w24-a | `docs/verification-log/task-w24-a-build-test.md` |
| `121f398` | task-w24-e: spec-audit gate FAIL-STOP | `docs/verification-log/task-w24-e-spec-audit.md` |
| `40b1d14` | task-w24-d: FAIL-STOP | `docs/verification-log/task-w24-d-render-sweep.md` |
| `0a8eb56` | task-w24-b: walkthrough gate FAIL-STOP | `docs/verification-log/task-w24-b-walkthrough.md` |
| `3adb523` | task-w24-a: FAIL-stop build+test gate log | `docs/verification-log/task-w24-a-build-test.md` |
| `cde03cd` | scribe wave 24 | `decisions/DEC-221.md`, `decisions/DEC-222.md`, `field-guide/index.md`, `src/decisions.ts` (const appends) |
| `b2dc2c1` | merge task-w23-b | **FROZEN binding — newest code-bearing sha (DEC-223)** |

Every commit strictly above `b2dc2c1` touches only
`docs/verification-log/*.md`, `decisions/DEC-*.md`, `field-guide/index.md`,
or pure string-constant appends to `src/decisions.ts` — the DEC-114/DEC-225
bookkeeping-exclusion set. The stray `task-w24-*` log merges (both the
FAIL-STOP logs and their re-merged duplicates) are non-code-bearing per
DEC-224/225 and are correctly allow-listed, not drift. **Sha check: PASS,
no drift.**

## Step 2 — run

Ran inside a **detached** worktree,
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w25-b-run`,
checked out at `b2dc2c1` (`git worktree add --detach ... b2dc2c1`), separate
from the branch worktree (`task-w25-b`, based on `main`) used only to author
this log file. `.dev.vars` was never read or printed (DEC-187).

- `npm ci --prefer-offline --no-audit --no-fund --silent`
- `npm run build` — green (`tsc --noEmit` x2 + vite build, no errors)
- `rm -rf .wrangler`
- `npm run db:migrate` — all migrations applied clean (0000-0013)
- `npm run seed` — D1 rows + 8 R2 objects seeded clean
- `npx tsx scripts/ensure-dev-vars.ts` then `npx wrangler dev --port 8963`
  (port 8963 per DEC-225, avoiding 8961/8962 possibly held by stragglers)
  — `Ready on http://localhost:8963`
- `npm run walkthrough -- --url http://localhost:8963`

All required modules passed, plus `scale`:

```
Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK
```

`scale` step5 explicitly re-confirms the no-auto-email invariant for a bulk
accept (110 ids); this task adds a second, independent confirmation below
using single-id transitions and a raw mailbox-count diff (§ (c)).

## (a) DEC-215/220 reset-password — curl transcripts

All requests against the running server at `http://localhost:8963`, using
`docs/fixtures/sample-data.json` seeded identities plus the `wk_review_org2_*`
throwaway second-org organizer that the `review` walkthrough module leaves
behind (`wk-review-org2-organizer@example.test` / `Wk-Review-Org2-Pass!1`,
org `wk_review_org2` — used here for the cross-org check, per that module's
own DEC-039 convention).

Target user for reset: `seed_user_0004` (`sbek-reviewer@example.com`,
org `seed_org_0001`).

**Pre-reset session baseline** — logged in as the reviewer first to capture
a live session cookie:

```
$ curl -s -c jar-rev-pre -b jar-rev-pre http://localhost:8963/login   # csrf cookie
$ curl -s -c jar-rev-pre -b jar-rev-pre -X POST http://localhost:8963/login \
    --data-urlencode email=sbek-reviewer@example.com \
    --data-urlencode password=SbekTest!2027-rev \
    --data-urlencode chq_csrf=<csrf>
-> 302, Set-Cookie: chq_session=VCMvt5ce...

$ curl -s -b jar-rev-pre http://localhost:8963/api/v1/events
-> 200   (pre-reset session confirmed live)
```

**Organizer reset with CSRF header → 200, one-time password in body:**

```
$ curl -s -b jar-org -X POST http://localhost:8963/api/v1/users/seed_user_0004/reset-password \
    -H "Content-Type: application/json" -H "x-chq-csrf: 1" -d '{}'
-> 200
{"id":"seed_user_0004","email":"sbek-reviewer@example.com","role":"reviewer","password":"6wf7-ich3-iez6"}
```

**Login with the OLD password → 401:**

```
$ curl -s -c jar -X POST http://localhost:8963/login \
    --data-urlencode email=sbek-reviewer@example.com \
    --data-urlencode password=SbekTest!2027-rev \
    --data-urlencode chq_csrf=<csrf>
-> 401
body: <p role="alert">Invalid email or password.</p>
```

**Login with the NEW password → works (302 + session cookie):**

```
$ curl -s -c jar -X POST http://localhost:8963/login \
    --data-urlencode email=sbek-reviewer@example.com \
    --data-urlencode password=6wf7-ich3-iez6 \
    --data-urlencode chq_csrf=<csrf>
-> 302, Set-Cookie: chq_session=J940Rtis...
```

**Target's pre-reset session cookie is now revoked:**

```
$ curl -s -b jar-rev-pre http://localhost:8963/api/v1/events
-> 401
{"error":{"code":"unauthorized","message":"Login required"}}
```

**Unknown id → 404:**

```
$ curl -s -b jar-org -X POST http://localhost:8963/api/v1/users/nonexistent_id_xyz/reset-password \
    -H "Content-Type: application/json" -H "x-chq-csrf: 1" -d '{}'
-> 404
{"error":{"code":"not_found","message":"User not found"}}
```

**Cross-org id → 404** (org2 organizer targets `seed_org_0001`'s reviewer id):

```
$ curl -s -b jar-org2 -X POST http://localhost:8963/api/v1/users/seed_user_0004/reset-password \
    -H "Content-Type: application/json" -H "x-chq-csrf: 1" -d '{}'
-> 404
{"error":{"code":"not_found","message":"User not found"}}
```

(`repo.getOrgUserById` scopes the lookup by `orgId` — a cross-org id is
indistinguishable from an unknown id, same as every other object-level
ownership check in this codebase.)

**Reviewer/speaker caller → 403:**

```
$ curl -s -b jar-reviewer-session -X POST http://localhost:8963/api/v1/users/seed_user_0001/reset-password \
    -H "Content-Type: application/json" -H "x-chq-csrf: 1" -d '{}'
-> 403
{"error":{"code":"forbidden","message":"Requires role 'organizer'"}}

$ curl -s -b jar-speaker-session -X POST http://localhost:8963/api/v1/users/seed_user_0001/reset-password \
    -H "Content-Type: application/json" -H "x-chq-csrf: 1" -d '{}'
-> 403
{"error":{"code":"forbidden","message":"Requires role 'organizer'"}}
```

**Missing CSRF — note on task wording vs. actual behavior:**

```
$ curl -s -b jar-org -X POST http://localhost:8963/api/v1/users/seed_user_0004/reset-password \
    -H "Content-Type: application/json" -d '{}'
-> 400
{"error":{"code":"invalid","message":"Missing or invalid CSRF header"}}
```

This task's instructions state "missing CSRF → 403"; the actual, correct
behavior per this repo's house convention is **400** (`code: "invalid"`),
per `src/server/http.ts`'s `STATUS_BY_CODE` map (`invalid: 400`,
`forbidden: 403` is reserved for role/ownership failures) — every
`csrfJson`-guarded route in the codebase behaves identically, and this is
consistent with prior verification logs (no route in this codebase maps
missing-CSRF to 403). Treated as a narrow-interpretation flag, not a
defect: the CSRF check demonstrably blocks the unauthenticated-header
request end-to-end; only the specific status code named in the task
prompt does not match the implementation. **Verdict for this check: PASS
(with note).**

## (b) DEC-217 /account/password SSR — one role (speaker)

```
$ curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:8963/account/password
-> 302 http://localhost:8963/login

$ curl -s -b jar-speaker http://localhost:8963/account/password
-> 200, contains <form method="post" action="/account/password"> with
   name="current", name="next", name="confirm", name="chq_csrf" fields

$ curl -s -b jar-speaker -X POST http://localhost:8963/account/password \
    --data-urlencode current=WrongPassword! \
    --data-urlencode next=NewSpeakerPass!2027 \
    --data-urlencode confirm=NewSpeakerPass!2027 \
    --data-urlencode chq_csrf=<form-csrf>
-> 400, role="alert">Current password is incorrect.</p>

$ curl -s -c jar-speaker -b jar-speaker -X POST http://localhost:8963/account/password \
    --data-urlencode current=SbekTest!2027-spk \
    --data-urlencode next=NewSpeakerPass!2027 \
    --data-urlencode confirm=NewSpeakerPass!2027 \
    --data-urlencode chq_csrf=<form-csrf>
-> 200, role="status">Password changed. Every other signed-in session has
   been signed out.</p>
   Set-Cookie: chq_session=<fresh token> (this browser stays signed in)

$ curl -s -c jar2 -X POST http://localhost:8963/login \
    --data-urlencode email=sbek-speaker@example.com \
    --data-urlencode password=NewSpeakerPass!2027 \
    --data-urlencode chq_csrf=<csrf>
-> 302   (new password confirmed working end-to-end)
```

## (c) Status transitions never auto-email

Used `seed_submission_0002` (a seeded `pending` submission on
`seed_event_0001`) and the organizer session. Mailbox message count read
from the `/dev/mailbox` page header (`<p>N message(s) — page 1</p>`) before
and after each transition:

```
BEFORE:            20 message(s)

POST /api/v1/events/seed_event_0001/submissions/status
  {"ids":["seed_submission_0002"],"status":"accept_queue"}
-> 200 {"updated":1}

AFTER accept_queue: 20 message(s)   (unchanged)

POST /api/v1/events/seed_event_0001/submissions/status
  {"ids":["seed_submission_0002"],"status":"accepted"}
-> 200 {"updated":1}

AFTER accepted:     20 message(s)   (unchanged)
```

Both status-changing POSTs returned `200 {"updated":1}` and the dev
mailbox count stayed at 20 across `pending -> accept_queue -> accepted`.
Confirms SPEC.md's "status changes never auto-send email" invariant; a
notification would require the separate, explicit action documented
elsewhere in the walkthrough (`producer` module's send-decision-email
check). This corroborates the `scale` walkthrough module's own
step5 (bulk accept of 110 ids, dev-mailbox count unchanged), using a
single-id, non-bulk code path this time.

## (d) Authz spot-checks

**Unauthenticated `/admin` → redirect, `/api/v1/contacts` → 401:**

```
$ curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:8963/admin
-> 302 http://localhost:8963/login

$ curl -s http://localhost:8963/api/v1/contacts
-> 401 {"error":{"code":"unauthorized","message":"Login required"}}
```

**Speaker A cannot read speaker B's task assignment (and vice versa):**

Speaker A (`sbek-speaker@example.com`) task list contains only
`seed_task_assignment_0001`; speaker B (`sbek-speaker2@example.com`) task
list contains only `4muh5ynab3pz277xq2bh` and others — disjoint sets.

```
$ curl -s -b jar-speakerA http://localhost:8963/portal/tasks/4muh5ynab3pz277xq2bh/form
-> 403

$ curl -s -b jar-speakerB http://localhost:8963/portal/tasks/seed_task_assignment_0001/form
-> 403
```

**Speaker A cannot read speaker B's submission (and vice versa):**

Each speaker's `/portal` submission list was diffed to find a submission
id present for one speaker only (`4od3s4o2bdylhqg3xnwl` — A only,
`54lmdgwuaq7vgkfdzqm3` — B only; both speakers share co-presenter
`d2r5rta5a4dz4uudw2rv`, correctly excluded from this cross-access check).

```
$ curl -s -b jar-speakerA http://localhost:8963/portal/submissions/54lmdgwuaq7vgkfdzqm3
-> 404

$ curl -s -b jar-speakerB http://localhost:8963/portal/submissions/4od3s4o2bdylhqg3xnwl
-> 404
```

**Unapproved (pending) submission absent from public surfaces:**

Used the seeded `pending` submission "Beyond the Hype: Prompt Engineering
in Practice" (`seed_event_0001`, still pending — distinct from the
`seed_submission_0002` used in § (c), which was deliberately promoted to
`accepted` and is therefore expected to remain absent from public surfaces
too pending content approval per the J10 gate already exercised by the
`walkthrough:public` module).

```
$ curl -s http://localhost:8963/e/devflow-conf-2027/sessions | grep -c "Beyond the Hype: Prompt Engineering"
-> 0

$ curl -s http://localhost:8963/e/devflow-conf-2027/schedule.ics | grep -c "Beyond the Hype: Prompt Engineering"
-> 0
```

Both surfaces correctly omit the unapproved submission. (The full J9/J10
existence-hiding and content-approval visibility gates were already
exercised exhaustively by the `walkthrough:public` module above — this is
a targeted spot-check against a fresh title from this run, not a
duplicate of that coverage.)

## Cleanup

`npx wrangler dev` (port 8963) was killed after the run
(`lsof -ti tcp:8963 | xargs kill`); the detached run worktree at
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w25-b-run`
was removed after this log was authored in the branch worktree.

**OPEN ITEMS:** 1 (documentation-only) — this task's own instructions
named "missing CSRF -> 403" for the reset-password check; the
implemented, correct, house-convention behavior is 400
(`code: "invalid"`). No code defect found; flagged for the scribe in case
the task-authoring convention should be corrected for future waves.

**RESULT: PASS**
