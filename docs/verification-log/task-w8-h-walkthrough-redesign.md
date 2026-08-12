# task-w8-h — J1-J12 persona walkthrough gate (redesign wave 8)

LOG-ONLY per DEC-384/389: this file records findings; no product code was
changed. Worktree
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w8-h`,
branch `task-w8-h`.

Measured `git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua
rev-parse main` at task start: `ee6ef3457e023941b2b4064435874a03d59a9595`
("merge task-w8-d").

**Operational note for the scribe:** partway through this run, the
`task-w8-h` worktree directory and branch were externally deleted out from
under this agent (mid-session, between two tool calls, with no action taken
by this agent) — `git worktree list` stopped showing it and the directory
was reduced to an empty `.wrangler/` stub. The branch was recreated (`git
worktree add ... task-w8-h main`, since the old `task-w8-h` ref itself no
longer existed) and re-cut from main's tip at that moment,
`8fff9f3f48ffc3ec2d9eb86d0337a0f58c18fe2f` ("merge task-w8-e") — three
merges ahead of the `ee6ef34` this task started against. All npm ci /
migrate / seed / dev-server / area-module work below was **redone from
scratch** after the recreation, so every result in this log is against
`8fff9f3`'s tree, not `ee6ef34`'s. Concurrent sibling worktree activity
(`task-w8-g`, `task-w8-i`, a `task-w11-f-scratch` etc. all live in
`chautauqua-wt/` alongside this one) makes this plausibly an artifact of
another agent's cleanup script matching on the reused `task-w8-h` name
across waves — flagging as an open item since it cost real turns and could
silently discard another lane's uncommitted work the same way.

**Second occurrence:** the same thing happened again immediately after
this file was first written (worktree+branch wiped a second time, with
only this file itself, mid-write, surviving on disk under an orphaned
`docs/` directory with no `.git` above it) — recovered by copying the
file's content out to a scratch path, re-cutting the worktree yet again
(this time from main's tip at that later moment,
`45ac3d8d64a672d77725f6764a8b51a9a5296c97`, "merge task-w9-c"), and
restoring this file before committing immediately. This is now confirmed
as a recurring pattern, not a one-off — see OPEN ITEMS item 4.

## STEP 1 — install / migrate / seed / dev boot (zero secrets)

All commands run from
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w8-h`
against tree `8fff9f3`. No `.env`, no `.dev.vars` present before the run;
`.dev.vars` does not exist in the repo and is not required to exist —
`npm run dev`'s `predev` hook (`scripts/ensure-dev-vars.ts`) creates it by
copying the checked-in `.dev.vars.example`, which contains only
`DEV_MODE=1` and `PUBLIC_BASE_URL=http://localhost:8787` — no secret, no
API key, no external account. This is a stage-1 pass, not a violation.

| step | command | exit code |
|---|---|---|
| install | `npm ci --prefer-offline --no-audit --no-fund --silent` | 0 |
| migrate | `npm run db:migrate` (`wrangler d1 migrations apply chautauqua --local`) | 0 (18 migrations applied, 0000..0018, the `0011` numbering gap is the documented DEC-164 skip) |
| seed | `npm run seed` | 0 (`tsx scripts/seed.ts && wrangler d1 execute ... && tsx scripts/seed-r2.ts`; 8 R2 objects put) |
| build | `npm run build` | 0 (dual `tsc --noEmit` + `vite build`, 154 modules, clean) |
| dev | `npm run dev` (`predev` -> `ensure-dev-vars.ts` + `vite build --config app/vite.config.ts`, then `wrangler dev`) | long-running; `GET /health` returned 200 once up (~20s cold boot including the predev vite build) |

No step at any point prompted for or required a secret. `.dev.vars` after
creation contains only the two non-secret vars above (verified by reading
it — DEV_MODE and PUBLIC_BASE_URL, no key/token/password).

One operational note: the dev server crashed once under the `scale` area's
heavy-write load (see STEP 2 below) with an empty wrangler `[ERROR]` block
and "Network connection lost" from miniflare; it was restarted clean for
the subsequent manual exercises. This looks like a local miniflare/D1
capacity limit under bulk sequential writes, not a stage-1-secrets issue,
but is worth the scribe's attention since it makes `scale`'s FAIL
non-actionable as a product defect without more investigation.

## STEP 2 — per-area walkthrough modules, run directly (not only the orchestrator)

Each module run as `npx tsx scripts/walkthrough/<area>.ts --url
http://localhost:8787` in isolation, in order, against the single freshly
migrated+seeded DB from STEP 1 (so each area's assertions reflect its own
correctness, not orchestrator-order side effects — except where noted).

| area | exit code | result | notes |
|---|---|---|---|
| producer | 0 | PASS | J1, J2, J3, J5, DEC-175 probes — all `ok` |
| review | 1 then 0 | PASS (on retry) | First invocation threw `TypeError: fetch failed` / `ECONNRESET` inside `Persona.login` (`scripts/walkthrough/review.ts:123`) — a transient connection reset immediately after `producer.ts` had just finished a burst of writes (server's `GET /health` was 200 at the same moment, so this was not a genuine crash). Re-run immediately after with no other change: exit 0, all 20 checks `ok`. |
| speaker | 1 | **FAIL** | See exact assertion below |
| public | 1 | **FAIL** | See exact assertion below |
| data | 0 | PASS | J11, J12 — all steps printed, "walkthrough:data OK — J11/J12 checks passed" |

### speaker — FAIL detail

Assertion text (verbatim), file:line:

```
FAIL [GET /portal/tasks shows the DEC-244 deliverable panel for the completed 'Finalize bio + headshot' assignment]: could not find the 'Finalize bio + headshot' task row on /portal/tasks
```

- Failing `assert()` call: `scripts/walkthrough/speaker.ts:704`
  (`assert(rowMatch, "could not find the 'Finalize bio + headshot' task row on /portal/tasks");`)
- Regex that failed to match, `scripts/walkthrough/speaker.ts:701-702`:
  `` `Finalize bio \+ headshot(?:(?!<\/li>)[\s\S])*?<\/li>` `` against the
  `GET /portal/tasks` HTML body.
- Everything up to this point in the script passed (26 prior `ok` lines,
  including the immediately preceding `POST
  /portal/tasks/:assignmentId/upload` returning 302 as expected at
  `speaker.ts:692-693`). The upload itself succeeds; the subsequent re-GET
  of `/portal/tasks` fails to locate the row via this regex. Whether the
  row's markup changed (making the regex stale) or the deliverable panel
  genuinely regressed was not investigated further — LOG-ONLY, fixing
  nothing.
- `speaker.ts`'s `check()` helper calls `process.exit(1)` on the first
  failed assertion (`speaker.ts:51`), so the remaining ~15+ later checks in
  the file (DEC-244 file download, comment posting, MAX_COMMENT_BODY_LENGTH
  cap, etc.) never ran this session — an unrelated, real bug in that same
  area could be hiding behind this one.

### public — FAIL detail

Assertion text (verbatim), file:line:

```
FAIL [J10 /sessions: cards + track filter nav present]: no session cards found
```

- Failing `assert()` call: `scripts/walkthrough/public.ts:431`
  (`assert(sessionsHtml.includes('class="chq-card"'), "no session cards found");`)
- Everything before this in the script passed: J9 agenda placement/
  overlap/auto-schedule/unschedule (9 checks) and J10's five bare
  `returns 200 with content` checks for `/sessions`, `/speakers`,
  `/agenda`, `/schedule`, `/gallery` on `/e/devflow-conf-2027/...` all
  `ok`. Only this stricter follow-up check — that the already-200
  `/sessions` page's body actually contains a `class="chq-card"` element —
  fails. Same caveat as above: `public.ts` also exits at first failure, so
  whatever comes after this check in the file did not run.

## STEP 3 — `npm run walkthrough` once, as-is

`npm run walkthrough -- --url http://localhost:8787` (against the same
already-seeded, not-re-seeded DB, i.e. state already mutated by the STEP 2
direct runs above — so its per-area verdicts below are **not** a clean
comparison to STEP 2's fresh-DB verdicts, they reflect state pollution as
much as product behavior):

Exit code: **1**

```
Summary:
  PASS producer
  FAIL review
  FAIL speaker
  FAIL public
  PASS data
  FAIL scale
```

The orchestrator (as landed at this tree, `8fff9f3`) now runs **all six**
areas and prints a full summary rather than stopping at the first failing
area — i.e. task-w8-d's runner fix is present in this tree. Detail on the
three verdicts that differ from STEP 2's fresh-DB runs, all attributable to
running on top of already-mutated state rather than new defects:

- `review`: `FAIL: provision second reviewer via /api/v1/users` — `expected
  status 201, got 409: {"error":{"code":"conflict","message":"A user with
  this email already exists",...}}` — the STEP 2 direct run of `review.ts`
  already created that reviewer account; a fresh DB was not re-seeded
  between STEP 2 and STEP 3.
- `speaker`: fails earlier than in STEP 2 —
  `FAIL [find a pending fixture submission belonging to the seeded speaker]:
  no pending submission found for Priya Raman` — because STEP 2's
  `producer.ts`+`speaker.ts` runs had already accepted/consumed the pending
  fixture submissions.
- `public`: same `no session cards found` failure as STEP 2 (this one does
  reproduce on the polluted DB too, consistent with it being a genuine,
  state-independent defect rather than a fixture-exhaustion artifact).
- `scale` (new area, not run individually per the task's four-module list,
  but appears in the orchestrator's fixed six-area order): `FAILED: step1:
  create submission 99` — `expected status 201, got 500` with body `Error:
  Network connection lost.` from miniflare's `entry.worker.js`. This is the
  same class of dev-server crash noted in STEP 1 — the local `wrangler dev`
  process itself died partway through `scale`'s bulk-write step, taking
  down producer/data's already-passed connections along with it (the dev
  server had to be restarted for the manual exercises below).

## STEP 4 — three manual exercises

Server restarted clean (fresh `npm ci` skipped — already installed;
`db:migrate` + `seed` re-run for a clean DB) after the STEP 3 orchestrator
run and the dev-server crash. Organizer login via
`sbek-organizer@example.com` / the fixture password from
`docs/fixtures/sample-data.json`'s `identities.organizer` (fixture
credentials only used here as a login credential, never referenced in
product code).

### (1) DEC-400 — /admin/overview renders + GET overview API shape

- `POST /login` with form-encoded `email`, `password`, `chq_csrf` (value
  scraped from the GET `/login` page's hidden field) -> `302 Found`,
  `Location: /admin`, `Set-Cookie: chq_session=...`.
- Headless Chromium (Playwright, already vendored as a devDependency) load
  of `GET /admin/overview` after that login: `#root` is non-empty (9358
  chars of rendered markup, not an empty SPA shell), and
  `.chq-overview-section-label` text content on the page is:
  `["01 — Overdue speaker tasks", "02 — Submissions awaiting triage", "03
  — Session content awaiting approval", "04 — Unplaced sessions and
  conflicts", "No action needed"]` — i.e. the five worklist sections DEC-400
  specifies (four numbered actionable sections plus the "No action needed"
  fallback section for a fully-clear worklist), confirmed rendering, not
  an empty `#root`.
- `GET /api/v1/events/seed_event_0001/overview` (same session cookie) ->
  `200`, JSON top-level keys: `["triage-counts", "review", "speakers",
  "content", "agenda", "comms", "deadlines", "overdueTasks", "triage",
  "contentApproval", "agendaWork"]`. Confirmed: `triage` is present and is
  an object with a `rows` array (`triage.rows`, length 5 in this run,
  `triage.total` and `triage.oldestSubmittedAt` also present), AND
  `triage-counts` is retained as a separate top-level key. Both DEC-400 wire
  contracts hold simultaneously.

### (2) J5 — bulk status change sends no email; compose send does

- Baseline: `GET /api/v1/events/seed_event_0001/email-log` -> `total: 3`
  (seed fixture rows only).
- `POST /api/v1/events/seed_event_0001/submissions/status` with header
  `x-chq-csrf: 1` (JSON mutations use the literal `x-chq-csrf: 1` header
  per DEC-004/the middleware comment — NOT the `chq_csrf` cookie's value;
  tripped over this once, got a 400 "Missing or invalid CSRF header" using
  the cookie value first) and body `{"ids":["seed_submission_0018"],
  "status":"accepted"}` -> `200 {"updated":1}`.
- Re-check: `GET .../email-log` -> `total: 3` still (unchanged), and `GET
  /dev/mailbox` shows no new subject line. Confirmed: bulk status change
  sent no email.
- `POST /api/v1/events/seed_event_0001/compose/send` with body
  `{"submissionIds":["seed_submission_0018"],"subject":"Walkthrough manual
  test for {speaker_name}","bodyText":"Hi {speaker_name}, walkthrough
  manual test body."}` (note: compose merge fields use single-brace
  `{speaker_name}` syntax, not `{{double}}` — confirmed against
  `scripts/walkthrough/producer.ts`'s usage after an initial 400 "missing
  merge field") -> `200 {"sent":1,"failed":[],"items":[{...,"subject":
  "Walkthrough manual test for Oakley Ueda",...}]}`.
- Re-check: `GET .../email-log` -> `total: 4` (grew by exactly 1), and `GET
  /dev/mailbox` body now contains the string "Walkthrough manual test".
  Confirmed: compose send does write an email_log row and does surface in
  the dev mailbox. J5's core invariant (status changes never auto-email;
  email is only ever an explicit compose/send action) holds in this run.

### (3) J2 — public CFP deadline line, timezone

- `GET /submit/devflow-conf-2027` -> `200`.
- Rendered deadline line, quoted verbatim from the response body:

  ```
  Call for papers · closes Mon, Mar 01, 2027, 15:59 PST
  ```

  (full surrounding markup:
  `<span class="chq-cfp-sub">Call for papers · closes Mon, Mar 01, 2027,
  15:59 PST</span>`)

- This reads **PST** (the seeded event's `timezone` field is
  `America/Los_Angeles`, confirmed via `GET /api/v1/events` ->
  `"timezone": "America/Los_Angeles"`), not GMT/UTC. DEC-408 ("public dates
  use event.timezone via src/lib/event-time.ts, never toUTCString") has
  landed in this tree (`8fff9f3`) and the chrome word "closes" is present
  as J2's assertion expects.

## RESULT: **FAIL**

Two of four directly-run walkthrough area modules fail on a fresh DB
(speaker, public); the orchestrator's own run also exits 1 (a sixth area,
`scale`, additionally fails due to a dev-server crash under load). The
three DEC-400/J5/J2 manual spot checks all pass cleanly.

## OPEN ITEMS

1. `scripts/walkthrough/speaker.ts:704` — `FAIL [GET /portal/tasks shows
   the DEC-244 deliverable panel for the completed 'Finalize bio +
   headshot' assignment]: could not find the 'Finalize bio + headshot'
   task row on /portal/tasks`. Reproduces on a fresh seed. Upload itself
   (302) succeeds; the re-GET's regex match against `/portal/tasks` fails
   immediately after. Needs a triage lane to determine whether this is a
   stale walkthrough regex or a real DEC-244 panel regression — the script
   exits at first failure so everything after this check in `speaker.ts`
   (file download, comments, MAX_COMMENT_BODY_LENGTH cap) is unverified
   this run.
2. `scripts/walkthrough/public.ts:431` — `FAIL [J10 /sessions: cards +
   track filter nav present]: no session cards found` — `/e/devflow-conf-
   2027/sessions` returns 200 with content but the body has no
   `class="chq-card"` element. Reproduces both on a fresh seed and on the
   polluted-state orchestrator run, i.e. state-independent. Needs a triage
   lane; same first-failure-exits caveat, everything after this check in
   `public.ts` (track filter nav itself) is unverified.
3. `scale` walkthrough area (`npm run walkthrough`'s sixth area): the local
   `wrangler dev`/miniflare process itself crashed mid-run
   (`FAILED: step1: create submission 99 — expected status 201, got 500 —
   Error: Network connection lost.`, empty wrangler `[ERROR]` block, logged
   to `~/Library/Preferences/.wrangler/logs/wrangler-2026-08-12_06-19-
   17_091.log`) partway through its 110-submission bulk-write fixture. This
   reads as a local dev-server capacity/stability limit under sustained
   sequential writes rather than a product-code defect, but it took the
   whole server down (also breaking the concurrently-running orchestrator's
   later assertions) — worth a stability pass if `scale` is meant to be a
   reliable regression gate rather than a stress test that's expected to
   occasionally take the dev server down.
4. Environmental/process: this task's assigned worktree+branch
   (`chautauqua-wt/task-w8-h`) was destroyed mid-session by something other
   than this agent (see the note under STEP 1's header) and had to be
   recreated from a newer `main` tip, discarding no committed work (nothing
   had been committed yet) but costing real turns and shifting every result
   in this log from the originally-measured `ee6ef34` to `8fff9f3`. If
   branch names are being reused/recycled across waves by an automated
   cleanup step, that step should not touch a worktree whose branch has
   independent, uncommitted-but-in-progress work — flagging for the scribe/
   planner, not something this LOG-ONLY lane can fix.
5. `review.ts` run #1 hit a transient `ECONNRESET`/`fetch failed` in
   `Persona.login` (`scripts/walkthrough/review.ts:123`) immediately after
   `producer.ts` finished a large write burst, while `GET /health` was
   simultaneously answering 200 — i.e. the server was up but momentarily
   refused/reset a new connection under load. Not re-flagging as a defect
   (retry immediately succeeded, all 20 checks `ok`), but noting the
   pattern alongside item 3's harder crash: this dev stack shows signs of
   being close to a concurrency/connection-handling ceiling under the
   walkthrough's write-heavy areas.
