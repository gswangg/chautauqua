# task-w2-c - perf-smoke @ 1e08bc8

Wave-2 exit battery, section C (DEC-256). Read-only lane: this file is the
only change on branch `task-w2-c`. Methodology, endpoint list, and
local-runtime advisory threshold mirror `task-w27-c-perf-smoke.md` (@
f01459a), the most recent prior perf-smoke baseline.

## Freeze derivation (DEC-256)

All `task-w1-*` refs (`task-w1-e`, `task-w1-f`, `task-w1-g`) were already
ancestors of `main` at the start of this lane (no wait required). `main`
tip at that time was `1e08bc84e70c30419910d716335febeb9808b2dc` ("merge
task-w1-h"). Walking `--first-parent` back from that tip, the newest
commit touching anything outside the DEC-256 allow-list
(`decisions/`, `field-guide/`, `docs/verification-log/`,
`docs/eval-findings.md`, `src/decisions.ts` appends) is that same tip
commit itself — it also touches `src/routes/docs.tsx` and
`test/docs-route-coverage.test.ts`.

FROZEN SHA: `1e08bc84e70c30419910d716335febeb9808b2dc`

Worktree `chautauqua-wt/task-w2-c` was created directly on `main` at this
sha (branch `task-w2-c`).

## Re-derivation / drift check (end of lane)

At the end of the run, `main` had advanced to `f626a74b9a8e18f2a7131fa4d5c14786a341c91e`
("merge task-w2-a"), but `git show --stat` on that commit shows it touches
only `docs/verification-log/task-w2-a-build-test.md` — inside the
allow-list. Re-deriving S from the new tip therefore yields the same
answer: `1e08bc84e70c30419910d716335febeb9808b2dc`. No drift — sha check
PASSES.

## Fresh-state run

1. `rm -rf .wrangler`
2. `npx tsx scripts/ensure-dev-vars.ts` — created `.dev.vars` from
   `.dev.vars.example` (absent before this run), contents never read or
   printed (DEC-187)
3. `npm ci --prefer-offline --no-audit --no-fund` — clean, 423 packages
4. `npm run build` — clean (`tsc --noEmit` root + app, `vite build`)
5. `npm run db:migrate` — 14 migrations `0000`-`0014` applied (no `0011`
   file, same gap as prior gates)
6. `npm run seed` — clean, 8 R2 objects uploaded into `chautauqua-files`
   (matches w27-c baseline count)
7. `npm run perf:seed` — all SQL batches `"success": true`
8. `npx wrangler dev --port 8822 --inspector-port 9822` (background) —
   `/health` returned `{"ok":true}` on first poll
9. `PERF_URL=http://localhost:8822 npm run perf:smoke` — run 1 exit 0

## p95 table (budget 150ms) vs w27-c @ f01459a

Run 1 (first run post-seed):

| probe                              | w27-c p95 | w2-c p95 (run1) | ratio | status |
|-------------------------------------|-----------|------------------|-------|--------|
| submissions list (page 1)           | 11.5ms    | 15.7ms           | 1.37x | ok     |
| submissions list (q=Kubernetes)     | 11.8ms    | 10.1ms           | 0.86x | ok     |
| submission detail                   | 13.7ms    | 13.5ms           | 0.99x | ok     |
| event overview                      | 13.6ms    | 12.4ms           | 0.91x | ok     |
| organizer agenda (300 accepted)     | 20.3ms    | 16.2ms           | 0.80x | ok     |
| public sessions page                | 3.5ms     | 3.8ms            | 1.09x | ok     |
| public agenda                       | 5.9ms     | 5.9ms            | 1.00x | ok     |
| schedule.ics 150 ids                | 48.6ms    | 46.3ms           | 0.95x | ok     |
| plan progress (12 reviewers)        | 16.1ms    | 16.8ms           | 1.04x | ok     |
| rating PUT                          | 11.3ms    | 10.2ms           | 0.90x | ok     |

All ten probes stay well under the 150ms local-runtime advisory budget.
No probe regressed by more than 2x against the w27-c baseline (largest
ratio: `submissions list (page 1)` at 1.37x, still under budget and under
the 2x open-item threshold). Script exit code 0.

A second confirmatory run against the same live `wrangler dev --port
8822` process also exited 0 with all ten probes under budget
(`submissions list` 11.0ms, `q=Kubernetes` 11.6ms, `submission detail`
15.5ms, `event overview` 15.5ms, `organizer agenda` 20.6ms, `public
sessions` 4.9ms, `public agenda` 5.7ms, `schedule.ics 150 ids` 52.4ms,
`plan progress` 16.9ms, `rating PUT` 27.7ms) — normal Miniflare run-to-run
noise, no isolated regression signature.

## DEC-080 cap assertion

`scripts/perf-smoke.ts` contains a one-shot untimed DEC-080 assertion
(lines ~201-219): it builds a 301-id `schedule.ics` request (300 real
accepted-submission ids + one nonexistent probe id) and asserts the
response status is exactly `400`. This assertion runs unconditionally
before the timed probe loop and is part of `perf:smoke`'s single exit
code — both runs above exited 0, confirming the 301-id -> 400 cap held.

## Scope note

These are local Miniflare (`wrangler dev`) numbers on a single developer
machine, not production Cloudflare Workers measurements. SPEC's
edge-cache and Smart Placement clauses are stage-2 platform-wiring
concerns and are explicitly out of scope for this local perf-smoke gate.

## Cleanup

`wrangler dev` stopped; `lsof -i :8822` returned no output (port free)
before this report was committed.

## Open items

None.

OPEN ITEMS: 0
RESULT: PASS - all ten p95 probes under the 150ms local budget, no probe
regressed more than 2x vs the w27-c baseline (max 1.37x on `submissions
list page 1`), `perf:smoke` exited 0 on two independent runs, and the
DEC-080 301-id `schedule.ics` -> 400 cap assertion is confirmed inside
`perf:smoke`'s check set and passed on both runs. Freeze sha
`1e08bc84e70c30419910d716335febeb9808b2dc` re-derived unchanged at the
end of the lane (no drift).
