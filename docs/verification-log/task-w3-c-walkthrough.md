# task-w3-c — walkthrough gate detail

DEC-069 J1-J12 walkthrough gate (DEC-077 log-only lane; NO code/product/
test/script/config changes made — this run is grep/log-only per the
code freeze). Newest code-bearing main short-sha per DEC-091: `3878d4f`
("merge task-w2-d"), same sha task-w3-a and task-w3-b cited (all commits
since then — `f9a33fd` scribe wave 3, `31fa021`/`1c75d92` task-w3-a,
`fc32e81`/`d6bc978` task-w3-b — touch only `decisions/`, `field-guide/
index.md`, the scribe-owned constant table in `src/decisions.ts`, and
`docs/verification-log.md`; none are code-bearing).

Sequence run from a fresh worktree branched off main (`1c75d92`, which
contains `3878d4f`'s tree): `npm ci`, `npm run build` (clean, tsc x2 +
vite), `npm run db:migrate` (all 10 migrations applied, through
`0009_review_rounds.sql`), `npm run seed` (fixture org/event/contacts +
6 R2 objects), `npx wrangler dev --port 8801` (never 8787), waited for
`GET /health` -> `{"ok":true}`, then `npm run walkthrough -- --url
http://localhost:8801`.

Areas ran in the required order producer -> review -> speaker -> public
-> data -> scale (confirmed via `WALKTHROUGH_AREAS` output headers):

- producer: PASS — all checks (event/form/CFP setup, submission intake).
- review: PASS — queue ordering, anonymization, scorecard round-trip,
  max-evaluations cap, cross-org 403/404 isolation (DEC-039), reviewer
  progress + laggard-only remind + email_log rows, weighted-aggregate
  results sort + CSV export.
- speaker: PASS — accept/onboarding-task defaults, idempotent re-accept,
  portal dashboard, form/file-request onboarding tasks, CFP-reuse form
  attach, co-presenter invite/accept/decline (DEC-070, IDOR-safe),
  post-close-date portal-edit gating, deliverable version chaining,
  producer/speaker comment thread, content-approval visibility gate.
- public: PASS — J9 agenda (rooms/tracks/placement/conflict
  surfacing/auto-schedule/unscheduling) and J10 public surfaces + embeds
  + .ics idempotent UID + visibility gates (unaccepted/content-
  unapproved/hidden-participant all absent).
- data: PASS — J11 contacts/search/import/merge/segments/bulk-email
  (+ >100-recipient cap) + dashboard stats; J12 bearer-token mint/use/
  revoke, role-403, exports (csv+json, showflow.csv), cross-org export
  404, API docs.
- scale: FAILED at step 6 — this is the DEC-086/089 mandatory scale
  area and it did execute (not missing), exercising all six probes:
  step1 110 fresh contacts/submissions/speaker participants (PASS),
  step2 one 110-id bulk-accept POST via DEC-078/079 chunking (PASS),
  step3 onboarding task_assignments present for a 5-contact sample
  (PASS), step4 exactly-once re-accept on identical re-POST (PASS),
  step5 no-auto-email assertion — dev mailbox count unchanged by the
  bulk accept (PASS), step6 DEC-083 purge-refresh probe (public submit
  -> claim -> organizer accept -> speaker portal edit -> immediate
  `/e/<slug>/sessions` title check) — FAILED: the speaker portal-edit
  POST (`/portal/submissions/:id/edit`) returned HTTP 400 instead of
  the expected 302 redirect. Full walkthrough run aborted at this point
  per the runner's fail-fast contract (scale runs last, so no
  downstream areas were skipped).

Dev server on port 8801 was stopped after the run (`pkill -f "wrangler
dev --port 8801"`; confirmed via `curl` connection-refused).

Re-checked main after the run: `main` had advanced to `d6bc978` (merge
of task-w3-b's own build+test gate, log-only) — no code-bearing merge
landed mid-run; `3878d4f` remains the newest code-bearing sha.

OPEN ITEMS: step6 of the walkthrough "scale" area (DEC-086/089
purge-refresh probe) fails with 400 on the speaker portal-edit POST at
`3878d4f`. Per DEC-077 this lane made no code changes to investigate or
fix the 400's root cause; a follow-up task should reproduce
`scripts/walkthrough/scale.ts`'s step 6 in isolation against a running
dev server to get the JSON/HTML error detail and determine whether the
defect is in the walkthrough script's form-field construction or in the
`/portal/submissions/:id/edit` handler itself.

RESULT: FAIL — walkthrough scale area step6 (DEC-083 purge-refresh
probe via speaker portal-edit) returns 400 instead of 302 at `3878d4f`;
producer/review/speaker/public/data areas and scale steps 1-5 all PASS.
