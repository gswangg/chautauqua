# task-w40-b — J1-J12 persona walkthrough @ 14db7b30

DEC-069 required section 2 (SPEC §9: "the real bar", ranked above the eval
harness). FROZEN-PRODUCT lane (DEC-069 w40), own tip `task-w40-b`, wrote
only under `docs/`.

## DEC-644 three-sha boundary block (STEP 0)

- `git -C <worktree> merge --no-edit main` reported "Already up to date"
  — HEAD (measured sha) `14db7b30` ("scribe wave 40") is `main`'s current
  tip.
- `npm run ref-state` confirmed every live ref (`main`, `manual-qa`,
  `task-custodian-w68-4`, `task-w39-e`, `task-w40-a`, `task-w40-b`,
  `task-w40-c`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) an
  ancestor of HEAD via `git merge-base --is-ancestor`; newest first-parent
  product-code-bearing sha `ed5c679e`. Non-ancestor refs named by that run
  (`mail-rich-shape-fallback`, `task-w17-i`, `task-w68-b`, `task-w68-c`,
  `task-w68-e`, `task-w71-a`, `task-w72-a..j`) are not `task-w39-*`, so
  they are out of this task's ancestry-loop scope per the brief.
- `git for-each-ref --format='%(objectname) %(refname:short)'
  refs/heads | grep task-w39` found exactly one local ref,
  `task-w39-e` (`cc77ed76c986c983cc07bb756d08a837ee6393fc`); `git
  merge-base --is-ancestor cc77ed76... HEAD` exited 0 (`ANCESTOR_OK`). No
  non-ancestor `task-w39-*` refs remained, so the retry loop (sleep 120 /
  re-merge main / re-check, max 5 attempts) never triggered.
- MEASURED_SHA = `14db7b30` (`git rev-parse --short HEAD`, taken before
  this task's own commit).

## Recipe run (STEP 1, one acquisition of the default `/tmp/chq-test.lock`)

`npm run db:migrate` -> `npm run seed` -> `npm run predev` (created
`.dev.vars` from `.dev.vars.example` via `ensure-dev-vars.ts`, then this
task appended `PUBLIC_BASE_URL=http://localhost:8811` after stripping any
prior `PUBLIC_BASE_URL=` line — gitignored local config, not a product
edit, precedented at
docs/verification-log/index/0163-2026-08-15-task-w26-f-walkthrough-73f380f2.md
and docs/verification-log/index/0190-2026-08-15-task-w36-b-walkthrough-f5783479.md)
-> `npx wrangler dev --port 8811 --var PUBLIC_BASE_URL:http://localhost:8811`
backgrounded -> polled `curl -sf http://localhost:8811/login` until ready
-> `npm run walkthrough -- --url http://localhost:8811` -> killed the
wrangler process.

The lock (`/tmp/chq-test.lock`) was held by concurrent wave-40 lanes
(`task-w40-c`'s `perf:seed` + `d1 execute`, `task-w40-d`'s `npm run build
&& npm run bundle:check`, and a separate perf-run script) at the moment
this task tried to acquire it; this task's `with-test-lock.sh` invocation
waited (polling every ~2s) rather than stealing an unexpired lock — the
whole recipe above ran inside that single acquisition, no `npm test`
nested inside the wrapper.

Because the correct port was written into `.dev.vars` before `wrangler
dev` ever booted, there was no off-origin reset-link abort this run
(contrast the first-run failures at
docs/verification-log/index/0163-2026-08-15-task-w26-f-walkthrough-73f380f2.md
and docs/verification-log/index/0190-2026-08-15-task-w36-b-walkthrough-f5783479.md)
— a single clean run sufficed.

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

Zero `FAIL` lines anywhere in the transcript. Areas ran in the fixed
`scripts/walkthrough-lib.ts:15` order producer -> review -> speaker ->
public -> data -> scale (producer runs first because it seeds the event
the other five areas depend on; scale runs last because it exercises
>100-id volume paths against that same seeded event).

Per-area highlights actually observed in the transcript (not merely
assumed from the summary line):

- **review**: 21/21 checks, incl. DEC-175 existence-hiding pairs
  (reviewer probing an out-of-scope submission -> 404, not 403, and the
  probe itself confirmed not-403) and DEC-039 cross-org 404/403 on both
  queue and results.
- **speaker**: DEC-111 self-healed form tasks (Hotel stay requirement,
  Flight reimbursement — real `formId` at task creation, GET returns 200
  not the old 400 "not a form task"), ad hoc `kind='form'`/`kind
  ='file_request'` tasks, DEC-244 deliverable versioning (v1 -> v2
  replace-upload, panel version bump, comment thread incl. the
  MAX_COMMENT_BODY_LENGTH=4000 inline re-render case), DEC-070 invite
  flow (accept/decline/no-IDOR/already-resolved), DEC-108
  invite_status public-visibility gate, form-close-date gating
  (accepted speaker can still edit past close, unaccepted cannot), file
  upload allowlist + 25MB cap enforcement, seven DEC-175 cross-speaker
  IDOR probes (404 existence-hiding for another speaker's submission,
  403 for task/file/API access).
- **public**: J9 agenda scheduling incl. non-blocking room-overlap and
  same-speaker-overlap conflict surfacing, auto-schedule, unscheduling;
  J10 public surfaces (sessions/speakers/agenda/schedule/gallery),
  five embed routes chromeless with no frame-blocking headers,
  schedule.ics idempotent UID lines, DEC-274 hidden-participant gate
  (name vanishes, session stays public with `speakers:[]`), DEC-108
  invite-visibility gate on the public speaker/session surfaces.
- **data**: J11 contacts/CSV-import/segments/bulk-email (incl. the
  >100-recipient cap rejecting) /dashboard-stats; J12 bearer token mint +
  cookie-less use + revocation -> 401, cross-role 403, per-kind CSV/JSON
  exports incl. `showflow.csv` fixed columns, cross-org export 404,
  `/docs/api` 200.
- **scale**: 110 fresh contacts/submissions/participants seeded; single
  bulk-accept POST of 110 ids in 83ms (email-log row count unchanged —
  no auto-email on bulk status change, confirming the platform-wide
  invariant); onboarding task_assignments confirmed on a 5-contact
  sample; re-POST of the identical bulk request is exactly-once
  (assignment counts unchanged); purge-refresh probe confirms a title
  change reflects immediately on the public sessions surface.

Full raw transcript captured verbatim in this task's background-command
log at run time; the tail beyond the last ~200 lines (producer's own
J1/J2/J3/J5/J9 line-by-line output) was not retained verbatim in this
file, but the summary table's `PASS producer` line and the fact that
`review` (which runs immediately after `producer` and depends on
producer-created submissions) passed all 21 of its checks together
confirm producer completed cleanly — no truncation-masked failure is
plausible given the downstream areas' dependence on producer's seeded
state.

RESULT: PASS — all six walkthrough areas pass at product sha `14db7b30`.
No product code touched (frozen wave, docs/** only).
OPEN ITEMS: 0
