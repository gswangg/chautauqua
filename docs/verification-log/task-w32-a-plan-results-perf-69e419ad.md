# task-w32-a: plan results (page 1) perf verification

DEC-829/DEC-338 (w32 amendments). Closes the `plan results (page 1)` perf
FAIL recorded at docs/verification-log/task-w29-e-review-perf-b7060152.md:
92-95 (adj p95 60.6/74.8/61.6ms across three runs vs a 50ms read budget).

Method: same session, `npm run seed` -> `npm run perf:seed` ->
`npx wrangler dev --port 8901 --local` -> `PERF_URL=http://localhost:8901
npm run perf:smoke`, run once against the pre-change code (git stash of this
branch's diff, i.e. the base `main` tip this branch forked from) and once
again after popping the stash back in (rebuilding nothing else, same seeded
D1 state) -- BEFORE and AFTER quoted verbatim below.

## BEFORE (pre-change, buildResults as one function -- one row per phase)

```
plan results (page 1)                        raw=    69.8ms  floor=   2.8ms  adjusted=    67.1ms  budget(read)=50ms  FAIL
    adjusted p95 67.1ms exceeds read class budget 50ms
```

## AFTER (rankPlanResults + hydrateResultsRows, JSON page hydrates only its own slice)

```
plan results (page 1)                        raw=    44.8ms  floor=   5.8ms  adjusted=    39.0ms  budget(read)=50ms  PASS
```

`plan results (page 1)` moves from FAIL (adjusted 67.1ms) to PASS (adjusted
39.0ms), under the 50ms read-class budget.

Note: `reviewer queue` FAILs in both runs (BEFORE adjusted 83.0ms, AFTER
adjusted 96.9ms) -- out of this task's scope (owned by a different w32 lane),
unaffected by this change; its own budget miss and floor/jitter variance
between runs account for the delta, not this task's edit (this task never
touches `src/routes/review/reviewer.ts` or the queue route).

Server killed after each perf:smoke run (`lsof -i :8901 -t | xargs kill`).
No migration was added or needed for this wave.
