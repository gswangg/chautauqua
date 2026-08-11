# task-w25-c — perf-smoke @ b2dc2c1

Wave-25 exit battery (DEC-225), FROZEN sha `b2dc2c103309433732bc689b933
610fc7cfb3b06` (DEC-223), port 8964. Same methodology, endpoint list, and
local-runtime advisory thresholds as `task-w20-c-perf-smoke.md` (@ 6807b67).

## Sha derivation / drift check (DEC-114, DEC-224, DEC-225 allow-list)

`main` first-parent chain from `b2dc2c1` to tip `b2991ec` ("scribe wave
25"):

```
b2991ec scribe wave 25
c36a77c merge task-w24-f
e591034 merge task-w24-c
e92f8b4 merge task-w24-e
bfc8099 merge task-w24-d
04350dd merge task-w24-b
80dc009 merge task-w24-a
cde03cd scribe wave 24
b2dc2c1 merge task-w23-b   <- FROZEN
```

Per-commit diffs above `b2dc2c1`:

- `cde03cd` — `decisions/DEC-221.md`, `decisions/DEC-222.md`,
  `field-guide/index.md`, `src/decisions.ts` (pure string-append).
- `80dc009` — `docs/verification-log/task-w24-a-build-test.md` only.
- `04350dd` — `docs/verification-log/task-w24-b-walkthrough.md` only.
- `bfc8099` — `docs/verification-log/task-w24-d-render-sweep.md` only.
- `e92f8b4` — `docs/verification-log/task-w24-e-spec-audit.md` only.
- `e591034` — `docs/verification-log/task-w24-c-perf-smoke.md` only.
- `c36a77c` — `docs/verification-log/task-w24-f-triage-closure.md` only.
- `b2991ec` — `decisions/DEC-223.md`, `decisions/DEC-224.md`,
  `decisions/DEC-225.md`, `field-guide/index.md`, `src/decisions.ts`
  (pure string-append).

Every post-freeze commit falls inside the DEC-224/DEC-225 allow-list
(decisions/**, field-guide/**, docs/verification-log/task-w24-*.md,
pure-constant-append to `src/decisions.ts`). No drift. `b2dc2c1` is
confirmed the newest code-bearing commit — sha check PASSES, proceed.

## Fresh-state run

Detached worktree cut at `b2dc2c1` (`chautauqua-wt/task-w25-c-perf`,
separate from this log's own branch worktree).

1. `rm -rf .wrangler`
2. `npx tsx scripts/ensure-dev-vars.ts` — created `.dev.vars` (absent),
   never read/printed (DEC-187)
3. `npm run build` — clean (tsc + app tsc + vite build)
4. `npm run db:migrate` — 13 migrations `0000`-`0013` (no `0011` file
   at this sha), all applied
5. `npm run seed` — clean, 8 R2 objects uploaded
6. `npm run perf:seed` — DEC-086/DEC-088 scale, all SQL batches
   `"success": true`
7. `npx wrangler dev --port 8964` — ready
8. `PERF_URL=http://localhost:8964 npm run perf:smoke` — exit 0

## p95 table (budget 150ms) vs w20-c @ 6807b67

| probe                              | w20-c p95 | w25-c p95 | ratio | status |
|-------------------------------------|-----------|-----------|-------|--------|
| submissions list (page 1)           | 12.2ms    | 13.0ms    | 1.07x | ok     |
| submissions list (q=Kubernetes)     | 15.6ms    | 13.8ms    | 0.88x | ok     |
| submission detail                   | 14.1ms    | 27.1ms    | 1.92x | ok     |
| event overview                      | 15.6ms    | 13.9ms    | 0.89x | ok     |
| organizer agenda (300 accepted)     | 27.2ms    | 17.5ms    | 0.64x | ok     |
| public sessions page                | 3.4ms     | 4.3ms     | 1.26x | ok     |
| public agenda                       | 8.5ms     | 6.4ms     | 0.75x | ok     |
| schedule.ics 150 ids                | 41.4ms    | 48.2ms    | 1.16x | ok     |
| plan progress (12 reviewers)        | 22.2ms    | 15.9ms    | 0.72x | ok     |
| rating PUT                          | 12.6ms    | 11.5ms    | 0.91x | ok     |

All ten probes stay under the 150ms local-runtime advisory budget; no
probe regressed by more than 2x against w20-c (worst ratio: submission
detail at 1.92x, still well inside budget and inside normal Miniflare
noise — flagged as an open item to watch, not a gate failure). Public
event pages (public sessions/agenda), admin list endpoints (submissions
list x2, submission detail, organizer agenda, plan progress), and
`schedule.ics` are all covered per the w20-c endpoint set; DEC-080 cap
assertion (301-id `schedule.ics` -> 400) passed implicitly via the clean
`perf:smoke OK` exit. Script exit code 0.

## Open items

- `submission detail` p95 moved from 14.1ms (w20-c) to 27.1ms (w25-c),
  a 1.92x ratio — still 5.5x under the 150ms budget and re-runs of the
  same probe within this session ranged 18.4-27.1ms, consistent with
  Miniflare/local-runtime noise rather than a code regression. No
  source change touches submission-detail read paths between 6807b67
  and b2dc2c1 (DEC-207-222 scope: conflict-marker repair, review-lens
  fixes, password reset, PlanEditor guard). Not a FAIL condition;
  flagged for the next perf-smoke gate to confirm trend.

## Cleanup

`wrangler dev` stopped (`pkill -f "wrangler dev --port 8964"`), port
8964 confirmed free via `lsof -i :8964` (no output). Detached worktree
`chautauqua-wt/task-w25-c-perf` removed after this report was written.

RESULT: PASS
