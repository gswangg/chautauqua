# task-w27-c — perf-smoke @ f01459a

Wave-27 exit battery (DEC-233), FROZEN sha
`f01459a1d52b6867586dd0b5b7c81dfe09601cfd` (DEC-232), port 8966. Same
methodology, endpoint list, and local-runtime advisory threshold as
`task-w25-c-perf-smoke.md` (@ b2dc2c1) / `task-w20-c-perf-smoke.md` (@
6807b67).

## Sha derivation / drift check (DEC-114, DEC-232 allow-list)

`main` tip at the time of this run was `2b5619d` ("scribe wave 27"), one
commit above the frozen sha:

```
2b5619d scribe wave 27
f01459a merge task-w26-d   <- FROZEN
```

`git diff --stat f01459a 2b5619d`:

```
 decisions/DEC-232.md |  3 +++
 decisions/DEC-233.md |  3 +++
 decisions/DEC-234.md |  3 +++
 field-guide/index.md | 72 ++++++++++++++++++++++++++--------------------------
 src/decisions.ts     |  5 +++-
```

All five touched paths fall inside the DEC-225/DEC-232 allow-list
(`decisions/**`, `field-guide/**`, pure-constant-append to
`src/decisions.ts`). Three stray branches (`task-w27-a`, `task-w27-b`,
`task-w27-e`) exist in the repo but are not merged into `main` — no
first-parent drift. Sha check PASSES; `f01459a` confirmed the newest
code-bearing commit — proceed.

## Fresh-state run

Worktree `chautauqua-wt/task-w27-c` created directly at
`f01459a1d52b6867586dd0b5b7c81dfe09601cfd` (branch `task-w27-c` pointed at
the frozen sha, so the working tree is byte-identical to the frozen commit
for the perf run; this report is committed on top of it afterward).

1. `rm -rf .wrangler`
2. `npx tsx scripts/ensure-dev-vars.ts` — created `.dev.vars` (absent),
   never read/printed (DEC-187)
3. `npm ci --prefer-offline --no-audit --no-fund --silent` — clean
4. `npm run build` — clean (tsc + app tsc + vite build)
5. `npm run db:migrate` — 13 migrations `0000`-`0013` (no `0011` file at
   this sha, same as w25-c), all applied
6. `npm run seed` — clean, 8 R2 objects uploaded (same as w25-c)
7. `npm run perf:seed` — all SQL batches `"success": true`
8. `npx wrangler dev --port 8966` — ready
9. `PERF_URL=http://localhost:8966 npm run perf:smoke` — run 1 exit 0

## p95 table (budget 150ms) vs w25-c @ b2dc2c1

Run 1 (first run post-seed, same methodology as prior gates):

| probe                              | w25-c p95 | w27-c p95 (run1) | ratio | status |
|-------------------------------------|-----------|-------------------|-------|--------|
| submissions list (page 1)           | 13.0ms    | 11.5ms            | 0.88x | ok     |
| submissions list (q=Kubernetes)     | 13.8ms    | 11.8ms            | 0.86x | ok     |
| submission detail                   | 27.1ms    | 13.7ms            | 0.51x | ok     |
| event overview                      | 13.9ms    | 13.6ms            | 0.98x | ok     |
| organizer agenda (300 accepted)     | 17.5ms    | 20.3ms            | 1.16x | ok     |
| public sessions page                | 4.3ms     | 3.5ms             | 0.81x | ok     |
| public agenda                       | 6.4ms     | 5.9ms             | 0.92x | ok     |
| schedule.ics 150 ids                | 48.2ms    | 48.6ms            | 1.01x | ok     |
| plan progress (12 reviewers)        | 15.9ms    | 16.1ms            | 1.01x | ok     |
| rating PUT                          | 11.5ms    | 11.3ms            | 0.98x | ok     |

All ten probes stay under the 150ms local-runtime advisory budget; no
probe regressed by more than 2x against w25-c. Script exit code 0.

DEC-080 cap assertion (301-id `schedule.ics` -> 400) passed implicitly via
the clean `perf:smoke OK` exit — `perf:smoke` includes this assertion in
its check set and a non-zero exit would have surfaced any 400-cap
regression.

## `submission detail` trend — w25-c open item

w25-c flagged `submission detail` moving from 14.1ms (w20-c) to 27.1ms
(w25-c, 1.92x), suspected Miniflare noise. Four independent runs against
the same live `wrangler dev --port 8966` process were taken this gate to
confirm or refute:

| run | submission detail p95 | perf:smoke result |
|-----|------------------------|--------------------|
| 1   | 13.7ms                 | OK (exit 0)        |
| 2   | 19.0ms                 | OK (exit 0)        |
| 3   | 37.3ms                 | FAILED (`schedule.ics` 184.7ms, over budget — see below) |
| 4   | 15.3ms                 | OK (exit 0)        |

Three of four runs land at 13.7-19.0ms, at or below the w20-c baseline
(14.1ms) and well below w25-c's 27.1ms. **Confirmed as Miniflare/local-
runtime noise, not a code regression** — `submission detail`'s read path
received no changes across DEC-226-234 (CSV escaping, cookie helpers,
track-deletion 409s, DST algorithm, deleteField visible-if fix), and the
metric settled back to baseline across repeated runs. The w25-c open item
is closed.

## Run 3 anomaly (environment, not code)

Run 3 exceeded budget on `schedule.ics 150 ids` (184.7ms) with every other
probe elevated in lockstep (submissions list 44.2ms, event overview
95.7ms, plan progress 101.6ms, etc.) — a uniform multiplier across all ten
probes rather than an isolated regression, which is the signature of host
contention rather than a code-path slowdown. `uptime` sampled immediately
after showed `load averages: 81.65 48.33 41.73` on the host, with multiple
sibling swarm worktrees (`task-w27-d` tsc, several `vitest` workers,
`run-w27-b`'s own `wrangler dev --port 8965`) running concurrently on the
same machine. Runs 1, 2, and 4 — taken before and after run 3, including
one 15s after under the same elevated load average (82.66) — all passed
cleanly, confirming run 3 was transient host contention from concurrent
sibling agents, not a `f01459a` code defect. Per DEC-233 the gate's exit
condition is "`PERF_URL=http://localhost:8966 npm run perf:smoke` — must
exit 0," which was satisfied (repeatedly).

## Cleanup

`wrangler dev` stopped, port 8966 confirmed free via `lsof -i :8966` (no
output). Worktree `chautauqua-wt/task-w27-c` removed after this report was
committed.

## Open items

- None outstanding. w25-c's `submission detail` noise item is closed
  (see above). Run 3's transient FAIL is host-contention noise from
  concurrent sibling swarm workers, not a code defect; flagged here for
  visibility but not a gate failure per DEC-233's exit condition.

RESULT: PASS
