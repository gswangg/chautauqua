# task-w27-f: perf smoke at SPEC's scale targets (DEC-507)

Sha measured: `2950e40fed71ab2dd9924414487bf49341ad6d7f` (main tip at the
time this worktree was branched — `task-w27-f`; verification only, no
product code changed in this task).

## Procedure

1. `npm i` (fresh worktree, `node_modules` was absent).
2. `npm run build` — clean.
3. `npm run db:migrate` — 18 migrations applied to a fresh local D1.
4. `npm run seed` — base demo seed (organizer identity + demo event
   `perf-2k`'s siblings and small event `mini-demo`; perf-seed's login
   depends on this for the organizer credentials in
   `docs/fixtures/sample-data.json`).
5. `npm run perf:seed` — perf-scale fixtures (idempotent, additive on top
   of the demo seed; deletes/re-inserts only `seed_perf_`-prefixed rows).
6. `npx wrangler dev --port 8813` (port 8813 owned by this task per
   DEC-498; killed only this task's own spawned PID — 61029 — afterward,
   no `pkill -f`).
7. `PERF_URL=http://localhost:8813 npm run perf:smoke`.

Note for future lanes: `npm run perf:smoke`'s login step requires the base
`npm run seed` to have been run first in this checkout — `perf:seed` alone
seeds only `seed_perf_`-prefixed rows and does not create the organizer
account the harness logs in as. Running `perf:seed` before `seed` produces
`POST /login failed: expected 302, got 401`.

## Actual seeded row counts (measured via direct D1 query, not asserted)

```
SELECT (SELECT COUNT(*) FROM submission) AS submissions,
       (SELECT COUNT(*) FROM contact) AS contacts,
       (SELECT COUNT(*) FROM submission WHERE status='accepted') AS accepted;
```

| metric | perf-seed alone (before base seed) | after `npm run seed` + `npm run perf:seed` |
|---|---|---|
| submissions | 2,000 | 2,030 (2,000 perf + 30 demo) |
| contacts | 800 | 831 (800 perf + 31 demo) |
| accepted submissions | 300 | 309 (300 perf + 9 demo) |

The perf-seed contribution alone reaches SPEC.md §7's top-end scale
targets exactly: **2,000 submissions** (SPEC's stated ceiling) and **800
speakers/contacts** (DEC-495's confirmed top of the 200-800 range). The
demo seed's ~30 additional rows ride on top and do not reduce this —
`perf-smoke.ts`'s checks are scoped to the `PERF_EVENT_ID`/`PERF_EVENT_SLUG`
event specifically (e.g. `submissions list`, `organizer agenda (300
accepted)`), so the measured endpoints see the full perf-scale data, not a
smaller demo-only slice. A ceiling never filled is not a measurement: this
run confirms the ceiling **was** filled (2,000/800/300, matching the w25-c
report's row counts).

## Transport-overhead floor

Measured separately per DEC-309 as the p50 of 30 untimed `GET /health`
samples (negligible server-side work, so its latency is dominated by
connection/fetch overhead): **2.3ms**. Each check's "adjusted" p95 below is
its raw p95 minus this floor — the floor is reported here so a number is
never credited to the wrong layer (e.g. connection setup time misread as
server processing time).

## perf:smoke results (30 measured iterations each; raw ceiling
`PERF_P95_BUDGET_MS` = 150ms; class budgets per SPEC §7: admin reads
p95 < 50ms, writes p95 < 100ms, uncached public SSR < 150ms)

| check | class | budget | raw p95 | adjusted p95 | verdict |
|---|---|---|---|---|---|
| submissions list (page 1) | read | 50ms | 9.2ms | 6.9ms | PASS |
| submissions list (q=Kubernetes) | read | 50ms | 13.3ms | 11.0ms | PASS |
| submission detail | read | 50ms | 14.7ms | 12.4ms | PASS |
| event overview | read | 50ms | 27.2ms | 24.9ms | PASS |
| organizer agenda (300 accepted) | read | 50ms | 25.1ms | 22.7ms | PASS |
| public sessions page | public | 150ms | 4.9ms | 2.5ms | PASS |
| public agenda | public | 150ms | 7.7ms | 5.4ms | PASS |
| schedule.ics 150 ids | public | 150ms | 45.8ms | 43.5ms | PASS |
| public speakers page | public | 150ms | 4.7ms | 2.4ms | PASS |
| public speakers page at row ceiling (`?page=100`) | public | 150ms | 9.9ms | 7.5ms | PASS |
| public speakers deepest page (`?page=MAX_PUBLIC_PAGE`) | public | 150ms | 10.8ms | 8.5ms | PASS |
| public sessions deepest rows | public | 150ms | 9.3ms | 7.0ms | PASS |
| public gallery page | public | 150ms | 4.9ms | 2.6ms | PASS |
| public schedule page | public | 150ms | 8.5ms | 6.2ms | PASS |
| agenda.ics | public | 150ms | 5.3ms | 3.0ms | PASS |
| schedule.ics (bare, whole agenda) | public | 150ms | 6.0ms | 3.7ms | PASS |
| plan progress (12 reviewers) | read | 50ms | 25.1ms | 22.8ms | PASS |
| contacts list (q=perf) | read | 50ms | 6.9ms | 4.6ms | PASS |
| rating PUT | write | 100ms | 12.0ms | 9.7ms | PASS |
| onboarding grid (800 speakers x 5 tasks) | read | 50ms | 15.9ms | 13.6ms | PASS |
| reviewer queue | read | 50ms | 17.7ms | 15.4ms | PASS |
| email log list (page 1) | read | 50ms | 6.7ms | 4.4ms | PASS |
| files library (page 1) | read | 50ms | 11.0ms | 8.7ms | PASS |
| plan results (page 1) | read | 50ms | 18.7ms | 16.4ms | PASS |
| pipeline list (page 1) | read | 50ms | 7.5ms | 5.2ms | PASS |
| org users list (page 1) | read | 50ms | 4.4ms | 2.1ms | PASS |

All 26 checks passed (`perf:smoke OK`, exit 0). No check's raw p95
exceeded the 150ms raw ceiling, and no check's overhead-adjusted p95
exceeded its class budget.

The one-shot untimed assertions also passed: the DEC-080 cap probe
(`schedule.ics` with 301 ids) returned exactly 400, `export/submissions?
format=csv` returned >= 2,001 lines, and `exports/showflow.csv` returned
>= 301 lines.

## Regression check against `task-w25-c-public-speaker-scale-stage1.md`

The two rounds that touched the public sessions/speakers queries since
w25-c are DEC-502 (paged JSON = one window, not HTML's cumulative
show-more) and DEC-506 (LIKE escaping consolidated to one home with
`ESCAPE '\'`, closing the `?q=%` roster-leak). Comparing the shared checks:

| check | w25-c raw p95 | w25-c adjusted p95 | w27-f raw p95 | w27-f adjusted p95 |
|---|---|---|---|---|
| public speakers page at row ceiling (`?page=100`) | 24.7ms | 19.0ms | 9.9ms | 7.5ms |
| public speakers deepest page (`?page=MAX_PUBLIC_PAGE`) | 25.3ms | 19.6ms | 10.8ms | 8.5ms |
| public sessions deepest rows | 19.5ms | 13.8ms | 9.3ms | 7.0ms |
| onboarding grid (800 speakers x 5 tasks) | 24.0ms | 18.3ms | 15.9ms | 13.6ms |

No regression: every shared check's w27-f p95 is at or below its w25-c
measurement (lower on this run's hardware/load, well inside budget either
way — the DEC-502/DEC-506 changes did not add measurable per-row overhead
to the paged public queries at the same 800-speaker/2,000-submission
scale). All 26 checks still pass with no exact-count assertion broken by
either change (DEC-502's per-page windowing and DEC-506's `ESCAPE '\''`
clause are both correctness fixes, not scale changes, so they were not
expected to move these numbers materially).

## OPEN ITEMS

None. This is a verification-only task; no product code was changed.

## RESULT

PASS. `npm run perf:smoke` against `http://localhost:8813` (this lane's
own port, DEC-498) passed all 26 checks with zero budget violations, at
the actual seeded scale of 2,000 submissions / 800 contacts / 300 accepted
submissions (2,030/831/309 including the base demo seed's rows) — SPEC.md
§7's top-end targets, confirmed reached by direct measurement rather than
assumed from code presence. No regression against the w25-c baseline.
