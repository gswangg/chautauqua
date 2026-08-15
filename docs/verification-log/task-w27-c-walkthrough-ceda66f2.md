# task-w27-c — J1-J12 walkthrough @ ceda66f2

Tip sha at runtime: `ceda66f20989684f702384e60a574a4e9c4fa68a` (short `ceda66f2`,
= main tip = "scribe wave 27"). Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w27-c`,
branch `task-w27-c`. Port 8881 (own workerd PID, confirmed via `lsof -i :8881` +
`ps -p <pid> -o pid,ppid,command` showing the worker process rooted in this
worktree's `node_modules`, per DEC-119).

## Setup

`npm ci` (already had `node_modules`), `npm run build` (vite + tsc, clean),
`rm -rf .wrangler`, `npm run db:migrate` (all 39 migrations `0001`-`0039`
applied), `npm run seed` (35 R2 objects put into local `chautauqua-files`),
`npx tsx scripts/ensure-dev-vars.ts` (created `.dev.vars` from
`.dev.vars.example`; content NOT printed/read beyond that per DEC-187, except
for one operational correction below), `npx wrangler dev --port 8881`,
`curl -s http://localhost:8881/health` -> `{"ok":true}`.

## Operational correction (not a product defect, but required to get a clean
## run): PUBLIC_BASE_URL port mismatch

The freshly generated `.dev.vars` ships `PUBLIC_BASE_URL=http://localhost:8787`
(the DEC-296-documented default — the file itself carries a comment: "Change
this ... when running wrangler dev on another port"). Under `wrangler dev`,
`wrangler.jsonc`'s `routes`/`custom_domain` entry (`chautauqua.cc`) shadows
`new URL(c.req.url).origin` away from the local loopback (see
`src/server/origin.ts:1-10`'s own comment), so `resolveBaseUrl()`
(`src/server/origin.ts:104`) falls through its loopback-sniffing branches
(no `Origin`/`Referer` header on the walkthrough's plain `fetch()` calls) to
the configured (loopback) `PUBLIC_BASE_URL` — i.e. port 8787, not the 8881
this lane is running on. This produced a first-run FAIL at `producer`
(`resolveScrapedHref: scraped href
"http://localhost:8787/reset/..." resolved to origin http://localhost:8787,
which is off-origin from --url's http://localhost:8881`,
`scripts/walkthrough/producer.ts:592/601`).

This exact failure mode (and fix) is already on record at
`docs/verification-log.md` — task-w26-f's section describes hitting the same
thing on port 8823 and correcting the gitignored `.dev.vars`. I did the same:
edited (not printed) `.dev.vars` to set `PUBLIC_BASE_URL=http://localhost:8881`,
killed the port-8881 listener, `rm -rf .wrangler`, re-`db:migrate`, re-`seed`,
relaunched `wrangler dev --port 8881`, reconfirmed `/health`. **This is
operator/harness setup drift, not product code** — flagging per the task's
"say for each whether the harness or product is stale" instruction so a
future RUN recipe adds `--var PUBLIC_BASE_URL:http://localhost:8881` to the
`wrangler dev` invocation rather than relying on the shipped `.dev.vars.example`
default.

## Walkthrough runs

Run 1 (before the `.dev.vars` fix): FAILED at `producer` (off-origin reset
link, harness/env drift as above, not evaluated further).

Run 2 (after the `.dev.vars` fix, but WITHOUT re-`db:migrate`/re-`seed` —
i.e. run twice against the same mutated DB from run 1's partial producer
pass): FAILED at `producer` (`J5 POST compose/preview (template)`), `review`
(`provision second reviewer via /api/v1/users`), `speaker` (bulk-remind
mailbox row), and `data` (`J11: per-contact history` — "no seeded contact
with both submission and email history was found (checked up to 100
contacts)"). This is **self-inflicted test-double-run corruption**, not a
product defect: rerunning `npm run walkthrough` against a DB that a prior
partial walkthrough run already mutated (duplicate template names, contacts,
etc. from run 1) breaks assumptions the walkthrough modules make about a
freshly seeded DB. Discarded; not counted as a finding.

Run 3 (clean: `rm -rf .wrangler`, `db:migrate`, `seed`, fresh `wrangler dev`,
single walkthrough invocation) — **this is the counted result**:

```
Summary:
  PASS producer
  PASS review
  FAIL speaker
  PASS public
  PASS data
  PASS scale
```

Full stdout: see the numbered list below (equivalent to the raw log; the raw
log for run 3 is not separately preserved on disk past this transcript, per
the log-only-lane file-count constraint — every `ok`/`PASS` line is
reproduced above and in `docs/verification-log.md`'s summary).

### FAIL detail: speaker

```
FAIL [GET /portal/tasks shows the DEC-244 deliverable panel for the completed
'Walkthrough ad hoc file task <ts>' assignment]: row is missing 'version 2'
```
Assertion: `scripts/walkthrough/speaker.ts:805`
(`assert(row.includes("version 2"), "row is missing 'version 2'")`), guarded
by the check at `scripts/walkthrough/speaker.ts:784`.

This is the SAME failure task-w26-f's walkthrough recorded at
`docs/verification-log.md:3604-3611` against the wave-26 tip (`73f380f2`,
port 8823) — a completed `file_request` ad hoc task assignment, re-uploaded
onto an already-complete assignment (chaining `previous_file_id` per
DEC-240/242/244), never shows "version 2" in the DEC-244 deliverable panel.
Reproduced verbatim at the wave-27 tip: **this is product-stale, not
harness-stale** — the defect survived the wave-26 merge unfixed.

Candidate source (read, not diagnosed further, not fixed — log-only lane):
- `src/routes/portal/tasks/views.tsx:296` — renders
  `version {fileExtras.version}` from `fileExtrasByAssignmentId`.
- `src/routes/portal/tasks.tsx:171-173` — builds that map by
  `latestByFileId.get(a.fileId)`, where `a.fileId` is read directly off the
  `task_assignment` row (not walked forward through the version chain).
- `src/routes/portal/tasks.tsx:627` — `saveTaskFileCompletion(c.var.db,
  assignmentId, fileId)` on upload; whether this writes the assignment's
  `file_id` column to the NEW (v2) file id, and whether
  `resolveTaskFileChainLatestMany` (`src/server/repo/files-versions.ts:124`)
  correctly resolves "latest" starting from an arbitrary chain member (not
  just the head), is the open question a future code-wave lane should chase.

## Other five modules: PASS, no findings

`producer` (J1/J2/J3/J5/J9), `review` (all DEC-175/DEC-039 authz probes,
scoring, remind, results CSV), `public` (J9 agenda scheduling + J10
visibility gates including DEC-274/DEC-108), `data` (J11 contacts/CRM +
J12 API tokens/exports), `scale` (110-row bulk accept in 113ms, exactly-once
re-accept, zero auto-email, purge-refresh probe) all passed clean on the
single counted run (run 3). No harness-vs-product ambiguity on any of these
five — every assertion in each module resolved as documented.

## Spot checks (curl-level, against the run-3 live server)

### (a) Unauthenticated public CFP submit, two file uploads, induced-failure orphan check

Used the `wk-1786813833103` event ("Producer Walkthrough Event", created
by this same walkthrough run's J1) and its default CFP form's one
`kind='file'` field (`kjyrdyhv6r2elxudmqqj`, "Slides or outline (optional)").
Note: this seeded default CFP form has exactly one file-upload field, so
"two file uploads" was exercised as two separate unauthenticated submissions
each carrying one file (both succeeded), rather than one submission with two
files (no such form field exists on this event) — narrowest reasonable
reading given the fixture shape; flagging the gap.

- `POST /submit/wk-1786813833103` (no cookies beyond the CSRF cookie from
  the preceding anonymous `GET`; no login) with `field__kjyrdyhv6r2elxudmqqj`
  = `slides1.txt` -> `200 OK`, `<title>Submission received - Producer
  Walkthrough Event`. `file` table row created (`filename='slides1.txt'`,
  `r2_key='sub/pending/cbhm6zdisewctfqnbnfy-slides1.txt'`).
- Second unauthenticated submission with `slides2.txt` -> `200 OK`,
  `Submission received`.
- `file` table count: 39 (`SELECT COUNT(*) FROM file`). Local R2 object
  count (`_mf_objects` in `.wrangler/state/v3/r2/miniflare-R2BucketObject/*.sqlite`)
  and on-disk blob count under `.wrangler/state/v3/r2/chautauqua-files/blobs`:
  both 39, matching.
- Induced failure: third unauthenticated `POST /submit/wk-1786813833103`,
  omitting the required `field__description`, WITH a file attached
  (`orphan-candidate.txt`) -> `400 Bad Request`. After: `file` table count
  still 39, R2 object count still 39, blob-directory file count still 39 —
  no `orphan-candidate` row in `file`, no new blob. **No orphan R2 object
  from this validation-rejection path.**
- Caveat: this only exercises the pre-write validation-rejection path (the
  file upload never reaches R2 on this failure mode, since validation runs
  before storage per the unchanged blob/row counts) — it does NOT exercise a
  mid-transaction failure *after* an R2 PUT has already happened (e.g. a DB
  insert throwing after the file write). That scenario is out of this spot
  check's reach with curl alone; flagging as an untested gap, not a finding.

### (b) Status transition pending -> accept_queue -> accepted, mailbox unchanged (organizer-only read)

Organizer login (`sbek-organizer@example.com` fixture credential from
`docs/fixtures/sample-data.json`, form POST `/login`, DEC-053 contract).
`GET /dev/mailbox` (organizer cookie jar, DEC-546 organizer-only) before:
51 messages (`<tr>` row count via regex + the page's own "51 messages" copy,
both agree).

- `POST /api/v1/events/seed_event_0001/submissions/status`
  `{"ids":["5bthdiv4dfsjuurdfqqu"],"status":"accept_queue"}` (header
  `x-chq-csrf: 1`, cookie-authenticated) -> `200 {"updated":1}`.
- Same id, `{"status":"accepted"}` -> `200 {"updated":1}`.
- `GET /dev/mailbox` after (same organizer jar): still 51 messages, `<tr>`
  count still 51. **No auto-email fired across either transition** —
  matches SPEC's never-auto-email invariant and `scale.ts` step 5's own
  assertion of the same property at bulk scale.

### (c) Accepted -> un-accepted session disappears from `/e/<slug>/sessions`, latency

Used `seed_submission_0007` ("Beyond the Hype: Developer Onboarding in
Practice", `status='accepted'`, `content_status='approved'` — confirmed both
gates were satisfied, unlike (b)'s fixture which was accepted-only and
correctly invisible per the J10 "accepted-but-content-unapproved" gate).

- `GET /e/devflow-conf-2027/sessions` before: title string present.
- `POST /api/v1/events/seed_event_0001/submissions/status`
  `{"ids":["seed_submission_0007"],"status":"pending"}` -> `200
  {"updated":1}`.
- Polling loop (Python, `urllib.request`, 50ms interval budget) hit the
  title-string-absent state on the FIRST poll issued after the status API
  call returned (elapsed ~0ms measured from loop start, i.e. sub-poll-
  interval — effectively immediate, well under the 50ms granularity of this
  probe). Re-confirmed with one more direct `curl` — string absent.
  **Observed latency: effectively instantaneous** (no polling delay needed
  to observe the disappearance), consistent with DEC-083's `pubcache`
  purge-on-write design and `scale.ts` step 6's own "reflected immediately"
  assertion. This spot check did not need to wait past the API response
  itself, so no meaningful "N ms until visible" number beyond "already gone
  by the time the very next GET landed" is available — reporting that
  explicitly rather than inventing a number.

## Cleanup

`lsof -i :8881` -> own workerd PID; killed; port free (`lsof -i :8881`
returns nothing) before worktree removal.
