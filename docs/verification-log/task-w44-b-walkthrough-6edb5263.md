# task-w44-b — J1-J12 persona walkthrough @ 6edb5263

DEC-069 required section 2 (SPEC §9: "the real bar", ranked above the eval
harness). FROZEN-PRODUCT lane (DEC-069 w44), own tip `task-w44-b`, wrote
only under `docs/verification-log/**`.

## DEC-644 three-sha boundary block (STEP 0)

- `git -C <worktree> merge --no-edit main` reported "Already up to date"
  — HEAD (measured sha) `6edb5263` ("scribe wave 44") is `main`'s current
  tip.
- `git for-each-ref 'refs/heads/task-w43-*' 'refs/remotes/origin/task-w43-*'`
  found exactly one local ref, `task-w43-c`
  (`44e990427ee12ab930405b4f533dd3c15bfe5620`); `git merge-base
  --is-ancestor 44e99042... HEAD` exited 0 (ancestor confirmed). No other
  `task-w43-*` refs existed to check, so no non-ancestor `task-w43-*` refs
  remained and the retry loop (sleep 60 / re-merge main / re-check, max 8
  attempts) never triggered — 0 retries.
- `npx tsx scripts/ref-state.ts` receipt (verbatim):

```
DEC-644 three-sha boundary: HEAD `6edb526323f8ce3af8f8e71d791a722a7b1a69ad`;
newest first-parent product-code-bearing sha
`14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`,
`manual-qa`, `task-custodian-w68-4`, `task-w43-c`, `task-w44-a`,
`task-w44-b`, `task-w44-d`, `task-w68-d`, `task-w71-c`, `task-w71-d`,
`task-w71-e`) confirmed an ancestor of HEAD via `git merge-base
--is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base
--is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w68-b`,
`task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`,
`task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`,
`task-w72-h`, `task-w72-i`, `task-w72-j`.
```

- MEASURED_SHA = `6edb5263` (`git rev-parse --short HEAD`, taken before
  this task's own commit).

## Recipe run (STEP 1, one acquisition of the default `/tmp/chq-test.lock`)

`npm run db:migrate` (42 migrations applied, all ✅ — see migration table
tail in `/tmp/w44b-migrate.log` for this run) -> `npm run predev`
(`ensure-dev-vars.ts` created `.dev.vars` from `.dev.vars.example`, then
`vite build --config app/vite.config.ts`) -> `npm run seed` (`seed.ts` +
`wrangler d1 execute` + `seed-r2.ts`, 35 R2 objects) -> `npx wrangler dev
--port 8787` backgrounded -> polled `curl -sf http://localhost:8787/login`
until ready (ready after 7 polls, roughly 14s) -> `npx tsx
scripts/walkthrough.ts --url http://localhost:8787` -> killed the
port-8787 wrangler process afterward (`lsof -ti tcp:8787 | xargs kill`).

No `.dev.vars` `PUBLIC_BASE_URL` override was written this run:
`wrangler.jsonc`'s configured `PUBLIC_BASE_URL` is `https://chautauqua.cc`
(non-loopback), and per `scripts/walkthrough.ts`'s w37-d pre-flight a
configured non-loopback `PUBLIC_BASE_URL` always wins per
`resolveBaseUrl`'s precedence and is never a mismatch against `--url
http://localhost:8787` — no origin-mismatch abort occurred, unlike
docs/verification-log/index/0163-2026-08-15-task-w26-f-walkthrough-73f380f2.md
and docs/verification-log/index/0190-2026-08-15-task-w36-b-walkthrough-f5783479.md.
Single run, no retries needed. The lock was uncontended at acquisition
time in this run.

## Result: all six areas PASS

Summary quoted verbatim:

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

Zero `FAIL` lines anywhere in the transcript (`grep -c "FAIL"
/tmp/w44b-walkthrough.log` -> `0`). Areas ran in the fixed
`scripts/walkthrough-lib.ts:15` order producer -> review -> speaker ->
public -> data -> scale.

Per-area PASS line locations (`grep -n "^PASS \|^FAIL "` over the
transcript, verbatim):

```
21:PASS producer
46:PASS review
130:PASS speaker
167:PASS public
193:PASS data
197:PASS step1 (110 fresh contacts + submissions + speaker participants)
201:PASS step2 (one bulk POST, 110 ids, updated=110, 82ms, email-log unchanged)
203:PASS step3 (onboarding task_assignments exist for 5 sampled fresh contacts)
205:PASS step4 (re-POST identical bulk request: assignment counts unchanged, exactly-once)
207:PASS step5 (dev mailbox message count unchanged by bulk accept)
209:PASS step6 (purge-refresh probe: title change reflected immediately on /e/<slug>/sessions)
212:PASS scale
```

Per-area highlights actually observed in the transcript:

- **producer**: J1/J2/J3/J5/J9 flows including the J9 break lifecycle
  (create -> list -> public agenda -> delete) and DEC-175 unauthenticated
  authz probes.
- **review**: 20 checks (queue ordering fewest-ratings-first, anonymized
  detail with no speaker-identifying fields, scorecard round-trip,
  max-evaluations cap, DEC-039 cross-org 404/403 on both queue and
  results, DEC-175 existence-hiding pairs — reviewer probing an
  out-of-scope submission gets 404 not 403 on both GET and PUT, remind
  sends only to the laggard reviewer and writes exactly one email_log
  row, results sorted by weighted aggregate score descending, results CSV
  download).
- **speaker**: organizer accept/re-accept idempotency, bulk remind
  writing email_log rows, portal dashboard (submissions/tasks), DEC-111
  self-healed form tasks (Hotel stay requirement, Flight reimbursement —
  real `formId` at task creation, GET 200 not the old 400 "not a form
  task"), ad hoc `kind='form'` task creation + assignment via API and
  completion via the portal.
- **public**: J9 agenda scheduling; J10 public surfaces
  (sessions/speakers/agenda/schedule/gallery/programme), five embed
  routes chromeless with no frame-blocking headers, schedule.ics
  idempotent UID lines across two downloads, Settings embed-generator
  snippet URLs matching live embed routes, anonymous hub redirect for a
  signed-in user, DEC-274 hidden-participant gate (name vanishes, session
  stays public with `speakers:[]`), DEC-108 invite-visibility gate
  (accepted invitee shown, pending/declined absent), visibility gates for
  non-accepted and accepted-but-content-unapproved submissions.
- **data**: J11 contact search, contact + custom field + note creation,
  CSV import with column mapping, per-contact history, duplicate merge
  preserving history, segment creation + filter, bulk-email to a segment
  (per-recipient email_log rows), bulk-email >100-recipient cap
  rejection, dashboard stats; J12 bearer token mint (cookie + CSRF),
  cookie-less bearer-token GETs on two endpoints, revoked-token 401,
  speaker-role session hitting an organizer endpoint 403, non-empty
  CSV/JSON exports per kind incl. `showflow.csv` fixed columns, cross-org
  export 404, `/docs/api` 200.
- **scale**: 110 fresh contacts/submissions/participants seeded; single
  bulk-accept POST of 110 ids in 82ms (email-log row count unchanged —
  no auto-email on bulk status change, confirming the platform-wide
  invariant); onboarding task_assignments confirmed on a 5-contact
  sample; re-POST of the identical bulk request is exactly-once
  (assignment counts unchanged); dev mailbox message count unchanged by
  the bulk accept; purge-refresh probe confirms a title change reflects
  immediately on the public sessions surface.

RESULT: PASS — all six walkthrough areas pass at product sha `6edb5263`.
No product code touched (frozen wave, `docs/verification-log/**` only).
OPEN ITEMS: 0
