# 2026-08-10 task-w13-c — perf-smoke @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w13-c — perf-smoke @ 3b7ed3d` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

DEC-069 perf-smoke gate, verify-or-run (DEC-103), code-frozen (DEC-077)
log-only lane. Re-derived the newest code-bearing sha per DEC-091/
DEC-114 from a fresh worktree of `main`: `3b7ed3d` ("merge
task-w11-a"), matching DEC-118's expectation. `grep -n "perf-smoke @"
docs/verification-log.md` found `task-w11-d — perf-smoke @ 3b7ed3d`
(ends `RESULT: FAIL`) and `task-w12-c — perf-smoke @ 3543f09` (VOID
sha per this task's brief, but independently confirmed code-equivalent
to `3b7ed3d`, and also ends `RESULT: FAIL`) — no `RESULT: PASS`
section exists at this sha, so the full gate was run rather than
confirmed.

Full gate: `npm ci`, `npm run build` (clean), `npm run db:migrate` (10
migrations), `npm run seed` (REQUIRED before `perf:seed` per the
task-w16-c precedent — `perf-smoke.ts` logs in as the fixture
organizer), `npm run perf:seed` (DEC-088 scale verified via `wrangler
d1 execute`: 2,000 submissions / 300 accepted for `seed_perf_event`,
12 `seed_perf_reviewer*` users), `npx wrangler dev --port 8843` (DEC-119,
never 8787; `/health` 200), `PERF_URL=http://localhost:8843 npm run
perf:smoke`.

**w7-c/w8-b OPEN ITEM disposition:** the DEC-104 fix is confirmed
in-tree — `src/server/repo/overview.ts:11` imports `chunkIds`;
`overview.ts:170-177` batches the `placedIds` participant fan-out via
`for (const batch of chunkIds(placedIds))` before each
`inArray(schema.participant.submissionId, batch)`, replacing the prior
unbounded `inArray(..., placedIds)` that produced `D1_ERROR: too many
SQL variables` at `d12eb25`. This run's "event overview" check reached
full 5-warmup + 30-measured completion with 200 on every request; a
standalone repo-unmodifying probe (same login + timing methodology,
run from scratch space after the harness aborted) measured **p95 =
16.09ms** (well under the 150ms budget). The w7-c/w8-b 500/D1-error
failure mode does not reproduce at DEC-088 scale — **OPEN ITEM
CLOSED**, reconfirming task-w11-d/task-w12-c.

DEC-089/DEC-080 cap probe (300 real + 1 nonexistent id -> 400) and the
DEC-105 CSV export min-line probes both PASS. All checks in the timed
loop before the final one — "submissions list (page 1)", "submissions
list (q=...)", "submission detail", "event overview", "organizer
agenda", "public sessions page", "public agenda", "schedule.ics 150
ids", "plan progress" — completed cleanly (the harness's fail-fast
`timeCheck` never named any of them). The harness itself errors during
warmup on the tenth and final check, "rating PUT": `400`,
`"criterion \"overall\" has no options defined"`. Root cause unchanged
from task-w11-d/task-w12-c and reconfirmed by `git log --oneline --
scripts/perf-seed.ts` (last touched `2a1c2c8`, before `3b7ed3d`):
`scripts/perf-seed.ts:269`'s seeded `criteria_json` omits the `kind:
"rating"` discriminant `src/domain/evaluation.ts`'s
`EvaluationCriterionDef` union requires, so `validateEvaluationScores`
falls into the `dropdown` branch and rejects for lacking `options`.
Pre-existing seed-script bug, not a product/domain defect; left
unfixed per this code-frozen (DEC-077) lane's scope.

`npm test --silent`: 104 test files, 1030 tests, all PASS. Dev server
killed after the run; `lsof -i :8843` confirmed the port released.

Full detail: `docs/verification-log/task-w13-c-perf-smoke.md`.

RESULT: FAIL — the w7-c/w8-b `event overview` D1-error OPEN ITEM is
independently reconfirmed CLOSED (200 on all requests, p95 16.09ms,
DEC-104 fix verified in-tree), and 9 of 10 timed checks plus all
DEC-089/DEC-094/DEC-105 probes PASS, but the harness does not complete
a clean run — it errors on the pre-existing, unfixed
`scripts/perf-seed.ts:269` `kind: "rating"` omission during the
"rating PUT" check, an out-of-scope defect for this code-frozen lane.
