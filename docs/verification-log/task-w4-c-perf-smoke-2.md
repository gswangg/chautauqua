# 2026-08-10 task-w4-c — perf-smoke @ 3878d4f

Full detail for the `## 2026-08-10 task-w4-c — perf-smoke @ 3878d4f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Gate re-run (wave 4, DEC-077 log-only lane, DEC-093 code-bearing sha
`3878d4f`). Fresh worktree off `main` at `79c4bb3` (all commits after
`3878d4f` are log-only per DEC-090/093). `npm ci`, `npm run build` (PASS),
`npm run db:migrate` (10 migrations), `npm run seed` (required first, per
the w16-c precedent), `npm run perf:seed` (verified against local D1:
`plan_reviewer` count for `seed_perf_plan_0001` = 12, `submission` rows
for `seed_perf_event` = 2000 total / 300 accepted, matching DEC-088),
`wrangler dev --port 8803` (8803 reserved, never 8787/8801), `PERF_URL=
http://localhost:8803 npm run perf:smoke`. Full detail:
docs/verification-log/task-w4-c-perf-smoke.md

**`perf:smoke` FAILS before any timed check runs**, reproduced twice:
`fetchAcceptedSubmissionIds: expected at least 301 accepted submissions,
got 200` (`scripts/perf-smoke.ts:166`). Root cause (read-only analysis,
no fixes made per DEC-077 scope): the DEC-089/DEC-080 one-shot 301-id cap
probe (`scripts/perf-smoke.ts:181`) requires 301 accepted-submission ids,
but the DEC-088 perf-seed status mix (`scripts/perf-seed-lib.ts:20`,
`PERF_STATUS_COUNTS.accepted = 300`) produces exactly 300 for
`seed_perf_event` — one short, regardless of pagination. Independently,
`src/lib/pagination.ts`'s `MAX_PER_PAGE = 200` clamp plus
`fetchAcceptedSubmissionIds`'s single non-paginated request explains the
observed "got 200". No p95 data was collected for any of the checks named
in the task (submissions list, submission detail, event overview, public
sessions page, public agenda, `schedule.ics` 150-id, plan progress w/ 12
reviewers, rating PUT, or the 301-id cap assertion itself) — the script
aborts before the timed loop.

`npm test`: 94 files / 971 tests, all PASS, unchanged from prior gates.
This lane touched only `docs/verification-log.md` and
`docs/verification-log/task-w4-c-perf-smoke.md`.

OPEN ITEMS: 1 — `scripts/perf-smoke.ts`'s 301-id cap probe cannot succeed
against the current DEC-088 perf-seed fixture (300 accepted, needs 301);
needs a code-bearing wave to reconcile the seed status mix, the probe's
id source, or add pagination to `fetchAcceptedSubmissionIds` (not this
lane's call to make).

RESULT: FAIL
