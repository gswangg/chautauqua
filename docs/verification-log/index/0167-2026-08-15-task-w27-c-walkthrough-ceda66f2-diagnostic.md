## 2026-08-15 task-w27-c — walkthrough @ ceda66f2 [DIAGNOSTIC]

Full detail: docs/verification-log/task-w27-c-walkthrough-ceda66f2.md

INVALIDATED BY: src/**, app/src/**, scripts/walkthrough/**, migrations/**

Port 8881 confirmed own (workerd PID rooted in this worktree's
`node_modules`, `lsof -i :8881` + `ps -p <pid>`). First run hit a harness/
env footgun, not a product defect: freshly generated `.dev.vars` ships
`PUBLIC_BASE_URL=http://localhost:8787` (DEC-296 default) and
`wrangler.jsonc`'s `chautauqua.cc` `routes` entry shadows the local request
origin under `wrangler dev`, so `resolveBaseUrl()` (src/server/origin.ts:104)
fell through to the stale 8787 default and the walkthrough's scraped
`/reset/<token>` link came back off-origin
(scripts/walkthrough/producer.ts:592/601) — identical to task-w26-f's
already-recorded finding (see this file's own w26-f section above, port
8823). Corrected the gitignored `.dev.vars` (not printed, per DEC-187),
wiped `.wrangler`, re-migrated/re-seeded, relaunched. A second attempt
(same DB, no re-seed between two walkthrough invocations) produced FOUR
unrelated FAILs (producer/review/speaker/data) from self-inflicted
double-run state corruption — discarded, not a finding.

Clean single run (fresh migrate+seed, one walkthrough invocation) —
counted result:

  PASS producer  PASS review  FAIL speaker  PASS public  PASS data  PASS scale

speaker FAIL: `scripts/walkthrough/speaker.ts:805` — a completed
`file_request` ad hoc task assignment re-uploaded (chained
`previous_file_id`) never shows "version 2" in the DEC-244 deliverable
panel at `GET /portal/tasks`. Reproduced VERBATIM from task-w26-f's
`73f380f2` finding — this defect is product-stale (survived the wave-26
merge), not harness-stale. Candidate sources (read, not fixed):
src/routes/portal/tasks/views.tsx:296, src/routes/portal/tasks.tsx:171-173
and :627, src/server/repo/files-versions.ts:124
(resolveTaskFileChainLatestMany).

Three curl-level spot checks, all PASS:
(a) two separate unauthenticated CFP submits to `/submit/wk-<ts>` (the
event's default form has one file field, not two, so "two uploads" =
two submissions each with one file) both 200'd with file rows/R2 objects
created; a third submission with a file attached but a missing required
field 400'd and left `file` table count and local-R2 object/blob counts
unchanged (39 before and after) — no orphan.
(b) `pending -> accept_queue -> accepted` via `POST .../submissions/status`
(x-chq-csrf:1) on one id; organizer-jar `GET /dev/mailbox` (DEC-546) held
at 51 messages before and after both transitions — no auto-email.
(c) un-accepting an accepted+content-approved seeded session
(`seed_submission_0007`) made it vanish from `/e/devflow-conf-2027/sessions`
on the very next GET issued after the status API call returned — no
measurable polling delay was needed to observe the change (reported as
"effectively immediate", not a fabricated ms figure).

OPEN ITEMS: 1 (speaker/DEC-244 "version 2", same open item task-w26-f
already carries — not double-counted as new)
RESULT: FAIL — one J1-J12 walkthrough check (speaker/DEC-244 "version 2")
reproduces unfixed at the wave-27 tip; all three curl spot checks
(orphan-free CFP upload failure, no-auto-email status transitions,
immediate un-accept purge) PASS.

