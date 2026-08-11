# task-w4-c — perf-smoke @ c211d4c

DEC-250 exit battery, section w4-c. FROZEN sha
`c211d4c02bb49c9d01f0730b9d8788c156d3a459` ("merge task-w3-d"). Same
methodology, endpoint list, and local-runtime advisory threshold as
`task-w27-c-perf-smoke.md` (@ f01459a) / `task-w25-c-perf-smoke.md` (@
b2dc2c1) / `task-w20-c-perf-smoke.md` (@ 6807b67).

## Sha derivation / drift check (DEC-114, DEC-250 allow-list)

`main` tip at the time of this run was `93a16b6` ("scribe wave 4"), one
commit above the frozen sha:

```
93a16b6 scribe wave 4
c211d4c merge task-w3-d   <- FROZEN
```

`git diff --name-only c211d4c main`:

```
decisions/DEC-250.md
decisions/DEC-251.md
field-guide/index.md
src/decisions.ts
```

All four touched paths fall inside the DEC-250 allow-list (`decisions/**`,
`field-guide/**`, `src/decisions.ts` pure-constant-append). No first-parent
product drift. Sha check PASSES; `c211d4c` confirmed the newest code-bearing
commit — proceed. Worktree `chautauqua-wt/task-w4-c` was created from
`main` (byte-identical to the frozen sha for every product path per the
diff above), branch `task-w4-c`.

## Fresh-state run

1. `rm -rf .wrangler`
2. `npm ci --prefer-offline --no-audit --no-fund` — clean, 423 packages
3. `npm run build` — clean (`tsc --noEmit` root, `tsc --noEmit -p
   app/tsconfig.json`, `vite build`)
4. `npm run db:migrate` — 15 migrations `0000`-`0014` (no `0011` file at
   this sha, same gap noted at prior gates), all applied
5. Read `scripts/perf-smoke.ts` and `scripts/perf-seed.ts` headers first
   (per task instructions) to confirm conventions before running anything:
   - `perf-smoke.ts` reads `PERF_URL` env var (default
     `http://localhost:8787`), not a `--url` CLI flag — there is no
     `--url` argument in this script; `PERF_URL=<url> npm run perf:smoke`
     is the actual invocation convention, matching every prior gate's
     report. Logs in as "the seeded organizer" (comment, line 2-3) against
     the perf-seeded event.
   - `perf-seed.ts` writes `.perf-seed.sql` (idempotent, `seed_perf_`-
     prefixed rows only) and reuses `ORG_ID = seedId("org", 1)` — the
     same fixed org `npm run seed`'s demo data creates — and inserts only
     the 12 reviewer users itself, not the organizer. This confirms `npm
     run seed` (the demo seed) is a prerequisite for the organizer login
     `perf-smoke.ts` performs, exactly as prior gates ran it.
6. `npm run seed` — clean, 8 R2 objects uploaded
7. `npm run perf:seed` — all SQL batches `"success": true`
8. `npx tsx scripts/ensure-dev-vars.ts` — created `.dev.vars` from
   `.dev.vars.example` (absent), never read/printed (DEC-187)
9. `npx wrangler dev --port 8972` (background) — `/health` returned 200
   on the first poll
10. `PERF_URL=http://localhost:8972 npm run perf:smoke` — run 1 exit 0

## p95 table (budget 150ms)

Run 1 (first run post-seed):

| probe                              | run1 p95 | status |
|-------------------------------------|----------|--------|
| submissions list (page 1)           | 11.5ms   | ok     |
| submissions list (q=Kubernetes)     | 13.2ms   | ok     |
| submission detail                   | 15.7ms   | ok     |
| event overview                      | 14.3ms   | ok     |
| organizer agenda (300 accepted)     | 18.8ms   | ok     |
| public sessions page                | 4.5ms    | ok     |
| public agenda                       | 8.1ms    | ok     |
| schedule.ics 150 ids                | 50.7ms   | ok     |
| plan progress (12 reviewers)        | 18.6ms   | ok     |
| rating PUT                          | 15.3ms   | ok     |

Run 2 (repeat against same live process, confirming stability):

| probe                              | run2 p95 | status |
|-------------------------------------|----------|--------|
| submissions list (page 1)           | 14.2ms   | ok     |
| submissions list (q=Kubernetes)     | 13.7ms   | ok     |
| submission detail                   | 17.3ms   | ok     |
| event overview                      | 16.7ms   | ok     |
| organizer agenda (300 accepted)     | 24.6ms   | ok     |
| public sessions page                | 5.1ms    | ok     |
| public agenda                       | 6.2ms    | ok     |
| schedule.ics 150 ids                | 58.5ms   | ok     |
| plan progress (12 reviewers)        | 27.8ms   | ok     |
| rating PUT                          | 17.4ms   | ok     |

All ten probes stay well under the 150ms local-runtime advisory budget on
both runs (worst case `schedule.ics 150 ids` at 58.5ms, ~0.39x budget).
Script exit code 0 on both runs.

DEC-080 cap assertion (301-id `schedule.ics` -> exactly 400) passed
implicitly via the clean `perf:smoke OK` exit — `perf:smoke` includes this
untimed assertion in its check set ahead of the timed loop, and a non-zero
exit would have surfaced any 400-cap regression.

## Cleanup

`wrangler dev` (port 8972) killed via `lsof -ti :8972 | xargs kill`; `lsof
-i :8972` confirmed the port free afterward.

## Open items

None. Both runs passed cleanly with wide headroom under budget; no
anomalies observed.

OPEN ITEMS: 0
RESULT: PASS — 10/10 probes under the 150ms budget on both runs (worst
case 58.5ms), DEC-080 cap assertion implicitly passed, `perf:smoke` exit
0 both times.
