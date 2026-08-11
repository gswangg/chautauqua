# task-w18-d — perf-smoke admin-screen extension (DEC-338, companion to DEC-331)

## FROZEN SHA

`ac64dc0` (`main` tip at worktree creation, "merge task-w18-c"). This gate
is a within-lane implementation + measurement task (extends `checks[]` in
`scripts/perf-smoke.ts` alongside `task-w17-d`, which is adding its own
public-surface checks on its own branch), not a battery gate walking S
from an anchor commit, so FROZEN SHA is simply the branch point.

## Scope

DEC-338: the perf harness measured public surfaces, submissions, review,
and contacts screens, but never the three hot **admin** screens that see
the heaviest real usage at scale — the onboarding grid, the reviewer
queue, and the email log list. This task seeds the rows that make those
screens measurable, then times them.

### `scripts/perf-seed-lib.ts` additions

- `PERF_TASK_COUNT = 5`, `PERF_TASKS` — a fixed 5-task onboarding set, one
  of them `kind: 'file_request'` (`deliverableKind: 'presentation'`,
  mirroring `scripts/seed.ts`'s convention), four `kind: 'general'`.
- `PERF_TASK_ASSIGNMENT_COUNT = PERF_TASK_COUNT * PERF_CONTACT_COUNT = 4000`.
- `isTaskAssignmentComplete(taskIndex, contactIndex)` — deterministic
  `(taskIndex + contactIndex) % 3 !== 0` mix (same shape as
  `scripts/seed.ts`'s own onboarding-grid mix), pure and index-only.
- `PERF_EMAIL_LOG_COUNT = 5000`, `PERF_EMAIL_LOG_RECENT_WINDOW_DAYS = 7`,
  `PERF_EMAIL_LOG_SPREAD_DAYS = 30`.
- `sentAtForEmailLogRow(n, nowMs)` — deterministic sent_at spread across
  the trailing 30 days (day-of-week + minute-of-day index-modulo), so the
  email-log route's realistic trailing-7-day view is a strict, non-trivial
  subset of the full 5,000-row table (verified in the test suite: some
  rows fall in the last 7 days, most don't, none fall outside 30 days).

### `scripts/perf-seed.ts`

Extended the idempotent delete block (`task_assignment` before `task`
before parents, `email_log` as its own leaf, both scoped to
`event_id = 'seed_perf_event'` / `task_id LIKE 'seed_perf_%'` — never a
blanket `DELETE FROM`) and added two new insertion blocks: 5 tasks + 4,000
task_assignment rows (one per task x contact, `seedId('perf_task_assignment',
n)`), and 5,000 `email_log` rows (`seedId('perf_email_log', n)`,
`sent_at` from `sentAtForEmailLogRow`). `npm run perf:seed` now writes
22,765 statements to `.perf-seed.sql` (up from the pre-DEC-338 count),
applied as one `wrangler d1 execute --local --file=.perf-seed.sql` batch —
all sub-batches reported `"success": true`.

### `test/perf-seed.test.ts`

Added two `describe` blocks: `DEC-338 onboarding task/task_assignment
scale` (exact 5/4,000 counts, exactly one file_request task, the
pending/complete mix spans both buckets, index-guard rejection tests) and
`DEC-338 email_log scale + spread` (exact 5,000 count, every row's
`sentAt` falls within `[now-30d, now]`, some-but-not-all rows fall within
the trailing 7 days — the "strict subset" assertion — determinism +
index-guard rejection tests).

### `scripts/perf-smoke.ts`

Added three `cls: "read"` checks to `checks[]`, appended after the
existing `rating PUT` check (to minimize merge-conflict overlap with
`task-w17-d`'s public-surface checks, which live earlier in the array):

- `onboarding grid (800 speakers x 5 tasks)` → `GET
  /api/v1/events/${PERF_EVENT_ID}/onboarding`
- `reviewer queue` → `GET
  /api/v1/review/plans/${PERF_PLAN_ID}/queue` with the existing
  `reviewerHeaders` (built at the reviewer login above)
- `email log list (page 1)` → `GET
  /api/v1/events/${PERF_EVENT_ID}/email-log?page=1&perPage=50`

Removed `optional: true` from the `event overview` check per DEC-331/
DEC-338 — a check is never optional. No existing check's name, class,
budget, or `run()` body was otherwise touched.

**Unplanned harness fix (in scope, plumbing not check content):**
`timeCheck`'s shared warmup/measured loops unconditionally called
`res.arrayBuffer()` on every check's response, even for checks whose
`run()` had already fully drained the body via `res.clone().text()` for
an inline assertion (the five HTML-surface / two `.ics` checks added by
`task-w17-d`). Under this environment's Node 24.1.0 / undici, that
double-drain reproduced **deterministically** (100% of runs, always at
`public schedule page`, the largest of the cloned-body checks at ~168KB)
as `TypeError: Body is unusable: Body has already been read`, which
aborts `main()` before any check after it — including all three new
DEC-338 admin checks — ever runs. This blocked the gate entirely, not
just a budget/flake concern. Fixed by guarding both loops with `if
(!res.bodyUsed) await res.arrayBuffer();` — a no-op for every check that
doesn't pre-drain its body, and a correctness fix (not a re-timing or
re-wording) for the ones that do. No check's name, class, budget, or
`run()` implementation changed. Left a comment explaining the guard.

## Build / test

`npm ci --prefer-offline --no-audit --no-fund --silent` (skipped,
`node_modules` present). `npm run build` — `tsc --noEmit` root + `tsc
--noEmit -p app/tsconfig.json` + `vite build` — PASS, 138 modules
transformed, twice (before and after the `perf-smoke.ts` `bodyUsed`
fix). `npm test --silent` — **226 test files / 1890 tests**, all green
(includes the two new `test/perf-seed.test.ts` `describe` blocks).

## Real-scale measurement

`rm -rf .wrangler/state`; `npm run db:migrate` (19 migrations `0000`
through `0018`, all applied clean — `0018_w18_scale_indexes.sql` landed
from a concurrently-merged wave-18 task); `npm run seed` (organizer
identity + R2 headshot seeding, 8 objects into local `chautauqua-files`);
`npm run perf:seed` (DEC-088 2,000 submissions / 300 accepted / 800
contacts scale, plus this task's 5 tasks / 4,000 task_assignment rows /
5,000 email_log rows — 22,765 statements, all D1 SQL batches `"success":
true`); `cp .dev.vars.example .dev.vars` with
`PUBLIC_BASE_URL=http://localhost:8798` (port `d` per the wave's port
table); `npx wrangler dev --port 8798` — `GET /health` ready.

`PERF_URL=http://localhost:8798 npm run perf:smoke` — full verbatim
result table (overhead floor 2.1ms, raw ceiling 150ms), confirmed
reproducible across two consecutive clean runs after the `bodyUsed` fix:

```
p95 over 30 measured iterations (overhead floor: 2.1ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=    10.3ms  floor=   2.1ms  adjusted=     8.2ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    15.5ms  floor=   2.1ms  adjusted=    13.4ms  budget(read)=50ms  PASS
  submission detail                         raw=    16.6ms  floor=   2.1ms  adjusted=    14.5ms  budget(read)=50ms  PASS
  event overview                            raw=    18.5ms  floor=   2.1ms  adjusted=    16.4ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    35.4ms  floor=   2.1ms  adjusted=    33.3ms  budget(read)=50ms  PASS
  public sessions page                      raw=     6.0ms  floor=   2.1ms  adjusted=     3.9ms  budget(public)=150ms  PASS
  public agenda                             raw=     5.6ms  floor=   2.1ms  adjusted=     3.5ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    63.8ms  floor=   2.1ms  adjusted=    61.8ms  budget(public)=150ms  PASS
  public speakers page                      raw=     8.7ms  floor=   2.1ms  adjusted=     6.6ms  budget(public)=150ms  PASS
  public gallery page                       raw=     4.0ms  floor=   2.1ms  adjusted=     1.9ms  budget(public)=150ms  PASS
  public schedule page                      raw=     6.9ms  floor=   2.1ms  adjusted=     4.8ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     3.6ms  floor=   2.1ms  adjusted=     1.5ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=    90.0ms  floor=   2.1ms  adjusted=    87.9ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    16.8ms  floor=   2.1ms  adjusted=    14.7ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     6.3ms  floor=   2.1ms  adjusted=     4.2ms  budget(read)=50ms  PASS
  rating PUT                                raw=    10.9ms  floor=   2.1ms  adjusted=     8.8ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    24.2ms  floor=   2.1ms  adjusted=    22.1ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    18.7ms  floor=   2.1ms  adjusted=    16.6ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     9.0ms  floor=   2.1ms  adjusted=     6.9ms  budget(read)=50ms  PASS

perf:smoke OK
```

`perf:smoke OK`, exit code 0. The pre-loop DEC-080 cap assertion and the
DEC-105 CSV export size probes passed silently before the timed loop, as
in every prior perf-smoke run (unaffected by this task's changes).

Server and `workerd` child processes killed after the run; `lsof -i
:8798` confirmed no listener remains.

## OPEN ITEMS

None. All three new DEC-338 admin checks (`onboarding grid`, `reviewer
queue`, `email log list (page 1)`) passed both their raw 150ms ceiling
and their `read` class budget (50ms adjusted) at the seeded scale (800
speakers x 5 tasks = 4,000 task_assignment rows; 12 reviewers / 600
evaluations against the DEC-088 seed; 5,000 email_log rows). The
`event overview` check (no longer `optional`) also passed at 16.4ms
adjusted — the DEC-334 finding this check previously guarded against
(materialized-row dashboard aggregation) is already fixed and owned by
`task-w18-a`; no new finding to log here.

OPEN ITEMS: 0

## RESULT

PASS

## RECHECK SHA

`task-w18-d` branch HEAD after this commit (see branch log) — no
`main`-side product code (`src/`) changes were made; this lane's changes
are `scripts/perf-seed-lib.ts`, `scripts/perf-seed.ts`,
`scripts/perf-smoke.ts` (admin checks + the `bodyUsed` harness-plumbing
fix), `test/perf-seed.test.ts`, and this log.

## POST-S DELTA

None observed beyond the concurrently-merged `0018_w18_scale_indexes.sql`
migration, applied cleanly and orthogonal to this task's scope (index
DDL, not seed/harness code). Per DEC-280, any future post-S delta
discovered against this result is a delta to log, never a STOP.
