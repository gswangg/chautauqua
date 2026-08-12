# 2026-08-10 task-w8-c — walkthrough @ 38860f9

Full detail for the `## 2026-08-10 task-w8-c — walkthrough @ 38860f9` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-8 exit-gate battery (DEC-069/139/176/177 rebinding), walkthrough
lane, log-only (no code changes). Fresh worktree cut from `main` tip.

**STEP 1 — sha derivation, ancestor check, precondition greps.**
`main` HEAD was `38860f9` ("merge task-w8-a", merging `52dd2b2` "w8-a:
harness-closure lane — DEC-173/174/175 walkthrough fixes + authz
probes" on top of `a8a4785` "scribe wave 9"). Per DEC-114 first-parent
walk, this merge commit is the newest non-bookkeeping (code-bearing)
commit and is the DEC-177-designated S for wave 8. Worktree
`task-w8-c` branched directly from `main`, confirmed at `38860f9`.

`git merge-base --is-ancestor 2dd2f33 38860f9` exits 0 — DEC-139
ancestor check passes.

DEC-177 precondition grep list, all found present at `38860f9`:
- six w6 fixes: `DEC-167` comment in `src/domain/contacts.ts:165`;
  `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts:15`; `"unknown track id"`
  in `src/routes/api/forms.ts:113`; `"anonymized === false"` in
  `src/server/repo/files.ts:153`; `openDate` in `app/src/pages/
  review/PlanEditor.tsx:107,138,143`; `FORM_TASK_FIELD_SPECS` in
  `scripts/seed.ts:19,909,931`.
- harness closure: `DEC-174` in `scripts/seed.ts:975`; `DEC-173` in
  `scripts/walkthrough/public.ts:440` and `scripts/walkthrough/
  speaker.ts:923`; `DEC-175` in `scripts/walkthrough/producer.ts:773`,
  `scripts/walkthrough/speaker.ts:1156,1162,1167`, and `scripts/
  walkthrough/review.ts:312,321,603`.

No precondition miss — gate proceeds.

**STEP 2 — install/build/migrate/seed/wrangler-dev/walkthrough.**
`npm ci` (node_modules already present, skipped per gate script). `npm
run build`: clean (`tsc --noEmit` x2 + `vite build`, 131 modules, no
errors). `rm -rf .wrangler/state` then `npm run db:migrate`: **13
migrations applied** — `0000_secret_matthew_murdock` through
`0010_round_criteria`, then `0012_pipeline`, `0013_submission_
revision` (the `0011` gap is the DEC-164-sanctioned numbering skip).
`npm run seed`: completed clean, 8 objects put into local R2 bucket
`chautauqua-files`, no errors. Started `npx wrangler dev --port 8822`
in the background; `GET /health` returned `{"ok":true}` (200) on the
first poll.

`npm run walkthrough -- --url http://localhost:8822` ran all six
modules in the fixed DEC-062 order (producer -> review -> speaker ->
public -> data -> scale) in a single orchestrator invocation with
**zero FAILs** — the orchestrator did not halt, so no individual
per-module re-runs were needed.

Per-area results:
- **producer**: J1/J2/J3/J5 all `ok`, plus the DEC-175 unauthenticated-
  probe block `ok`. PASS.
- **review**: 19/19 checks PASS, including both DEC-175 out-of-scope
  probes (`reviewer GET of an out-of-scope submission's review detail
  -> 404 (not 403)`, `reviewer PUT evaluation for an out-of-scope
  submission -> 404 (not 403)`) and DEC-039 cross-org 404s. PASS.
- **speaker**: all checks PASS, specifically including `find my own
  general task's assignment id via /portal/tasks` and `complete a
  general task via its own form action` — the DEC-174 seed override
  (`contactIdx 0` / "Announce participation" forced to `pending`)
  unblocked this round-trip that was FAIL at `64ec7de` (task-w5-c).
  All 8 DEC-175 speaker-lens probes (`speaker2 GET speaker1's portal
  submission -> 404`, task-assignment form GET/POST/complete -> 403,
  uploaded file GET -> 403, speaker-session-on-organizer-API GET
  `/api/v1/events/:id/submissions`/`/api/v1/contacts`/`/api/v1/
  events/:id/email-log` -> 403) all PASS. PASS.
- **public**: all checks PASS, specifically including `J10 /speakers:
  alphabetical by surname, headshot/title/company` — the DEC-173
  anchor-tolerant extractor unblocked this check that was FAIL at
  `64ec7de` (task-w5-c). PASS.
- **data**: J11/J12 all PASS (contact search/create/CSV-import/
  history/dedupe-merge/segment/bulk-email+cap/dashboard-stats; bearer
  token mint/cookie-less GET/revocation/role-403/exports/showflow.csv/
  cross-org 404/`/docs/api`). PASS.
- **scale**: all 6 steps PASS (110 fresh contacts+submissions+
  participants; bulk-accept of 110 ids; onboarding task_assignments
  sampled for 5 fresh contacts; re-accept exactly-once; no auto-email
  on bulk status change; purge-refresh probe). PASS.

Server killed after the run (`kill -9` on the `wrangler dev --port
8822` process, its `esbuild --service` helper, and the surviving
`workerd` child that outlived the parent); `lsof -i :8822` confirmed
empty (port free). An unrelated sibling worktree (`task-w9-a`) was
observed running `wrangler dev --port 8831` concurrently on the same
machine and was left untouched (different port, out of scope, expected
per DEC-176's concurrent-sibling-gate precedent).

OPEN ITEMS: 0

RESULT: PASS (6/6 modules PASS at S = `38860f9` — producer, review,
speaker, public, data, scale all clean; both prior task-w5-c FAILs
[speaker general-task round-trip, public surname-ordering extractor]
are now confirmed fixed by the DEC-173/174 harness closure; every
DEC-175 authz probe across producer/review/speaker/data PASSes with
correct existence-hiding semantics).
