# 2026-08-10 task-w15-h — walkthrough @ 675219f

Full detail for the `## 2026-08-10 task-w15-h — walkthrough @ 675219f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-114 newest code-bearing sha confirmed `675219f` (merge task-w14-k);
tip `21ea856` (scribe wave 15) adds only a new `DEC_127` string constant
to `src/decisions.ts` plus docs/field-guide — bookkeeping, not
code-bearing, so the gate targets `675219f`.

DEC-127 six-marker preflight (all present, run at worktree HEAD which
is a descendant of `675219f`):
- `src/routes/tasks.ts` — `DEC-120` present (2 hits)
- `src/forms/types.ts` — `LOCKED_SPEAKER_FIELDS` present, used in
  `src/server/repo/portal-edit.ts` and `src/routes/public/submit.tsx`
- `src/routes/comms.ts` — `requireFullMatch` present, used twice
- `src/server/repo/review.ts` / `src/routes/review.ts` — `DEC-123`
  present
- `src/forms/validate.ts` — `MAX_TEXT_LENGTH` present
- `scripts/perf-seed.ts` — `kind: "rating"` present at line 273

Preflight: PASS (six of six markers present).

Fresh local state (DEC-127 fresh-port rule, port 8851): `rm -rf
.wrangler`, `node_modules` already present (no reinstall needed),
`npm run db:migrate` (10/10 migrations applied incl. `0009_review_
rounds.sql`), `npm run seed` (seed.sql + seed-r2 6 objects, clean),
`npx wrangler dev --port 8851` backgrounded and confirmed `Ready on
http://localhost:8851`.

`npm run walkthrough -- --url http://localhost:8851` — per-module
outcomes:
- PASS producer (J1 launch CFP, J2 public submit+claim, J3 triage at
  volume, J5 compose merge/cap/ICS/HTML-escape)
- PASS review (queue ordering, anonymization, scorecard round-trip,
  max-evaluations cap, cross-org 403/404 DEC-039, reminders, weighted
  results + CSV)
- PASS speaker (onboarding tasks incl. DEC-111 self-healed form tasks,
  ad hoc form task, file_request upload, itinerary .ics, DEC-070
  invite/accept/decline incl. IDOR + already-resolved rejects, DEC-108
  invite_status public-visibility gate, portal bio edit sync, form
  close-date gating, deliverable version chain, comment/reply thread)
- PASS public (J9 agenda placement/overlap/auto-schedule/counts, J10
  all public + embed surfaces incl. .ics idempotent UID, DEC-108
  invite-visibility gate, all three visibility-gate negative checks)
- PASS data (J11 contacts/CSV import/merge/segments/bulk-email incl.
  >100 cap reject/dashboard stats; J12 bearer token mint+use+revoke,
  role 403, exports incl. showflow.csv, cross-org 404, /docs/api)
- PASS scale (110-contact bulk accept, onboarding task_assignments
  sample, exactly-once re-accept, no auto-email on status change, DEC-
  099 purge-refresh probe) — note per task spec: scale module's
  speaker-field re-type step (scripts/walkthrough/scale.ts:483-485) is
  a benign DEC-121 no-op (posted `field__email` ignored, same-value
  name re-post syncs harmlessly); it ran and passed as part of step1-6,
  no separate failure surfaced.

Full walkthrough summary line: `PASS producer / PASS review / PASS
speaker / PASS public / PASS data / PASS scale` — `walkthrough OK`.

Wrangler process killed after the run (confirmed no `wrangler dev
--port 8851` process remains).

RESULT: PASS
