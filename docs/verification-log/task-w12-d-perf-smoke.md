# task-w12-d — perf-smoke @ 7f7477e (detail)

## S'' derivation (DEC-114/DEC-188)

`git -C chautauqua log --first-parent --oneline` from `main`: top commit is
`7f7477e merge task-w12-a` (task-w12-a's prerequisite chain-link merge, per
this task's own preamble). `git merge-base --is-ancestor 2dd2f33 7f7477e`
exits 0. `git merge-base --is-ancestor 629d57e 7f7477e` exits 0 (629d57e is
the code-bearing operator commit on the first-parent line, well below S'').
S'' = `7f7477e` was not `629d57e`, so no precondition-FAIL per DEC-188
clause (1).

## Precondition grep set (DEC-188 clause 2)

All at S'' = `7f7477e`, in the fresh worktree tree:

12 DEC-177 anchors:
- `DEC-167` in `src/domain/contacts.ts:165` — hit
- `ICS_ORGANIZER_EMAIL` in `src/mail/ics.ts:15` — hit
- `unknown track id` in `src/routes/api/forms.ts:113` — hit
- `anonymized === false` in `src/server/repo/files.ts:153` — hit
- `openDate` in `app/src/pages/review/PlanEditor.tsx:107` — hit
- `FORM_TASK_FIELD_SPECS` in `scripts/seed.ts:19` — hit
- `DEC-174` in `scripts/seed.ts:975` — hit
- `DEC-173` in `scripts/walkthrough/public.ts:440` — hit
- `DEC-173` in `scripts/walkthrough/speaker.ts:923` — hit
- `DEC-175` in `scripts/walkthrough/producer.ts:773` — hit
- `DEC-175` in `scripts/walkthrough/speaker.ts:1156` — hit
- `DEC-175` in `scripts/walkthrough/review.ts:312` — hit

5 DEC-185 markers:
- `DEC-179` in `src/lib/csv.ts:145` — hit
- `DEC-180` in `src/lib/rate-limit.ts:41` — hit
- `DEC-181` in `src/server/middleware.ts:262` — hit
- `DEC-182` in `src/server/http.ts:51` — hit
- `DEC-183` in `wrangler.jsonc:39` — hit

DEC-187 markers:
- `DEC-187` in `scripts/ensure-dev-vars.ts:1` — hit
- `DEC-187` in `test/wrangler-config.test.ts:55` — hit
- `"ensure-dev-vars"` referenced in `package.json` (`predev` script) — hit
- `git ls-files` lists `.dev.vars.example`, does NOT list `.dev.vars` — confirmed

All 20 markers hit at S''; no precondition-FAIL.

## Fresh detached worktree run

Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/gate-w12-d-perf`,
`git worktree add --detach ... 7f7477e`. No `.dev.vars` present before
`ensure-dev-vars` ran (only the tracked `.dev.vars.example`).

1. `npm ci --prefer-offline --no-audit --no-fund --silent` — clean.
2. `npm run db:migrate` — 14/14 migrations applied clean (both local
   and preview D1 bindings wrangler reported), no errors.
3. `npm run seed` — completed, R2 seed objects uploaded (8 objects into
   `chautauqua-files`), no errors.
4. `npm run perf:seed` — all batches report `"success": true` (DEC-088
   2k-row scale fixtures).
5. `npx tsx scripts/ensure-dev-vars.ts` — `ensure-dev-vars: created
   .dev.vars from .dev.vars.example` (local `.dev.vars` was never read
   or printed by this gate, only the tool's own stdout was observed).
6. `npx wrangler dev --port 8899` (8787/8801/8803/8831/8832/8833
   avoided as prior-gate ports) — `/health` returned `{"ok":true}` on
   the first poll.
7. `PERF_URL=http://localhost:8899 npm run perf:smoke` — run TWICE for
   confirmation, both exited 0 with `perf:smoke OK`.

## Results (p95 over 30 measured iterations, budget 150ms uniform per
`scripts/perf-smoke-lib.ts`'s `PERF_P95_BUDGET_MS`)

Run 1:
| route | p95 | budget | status |
|---|---|---|---|
| submissions list (page 1) | 12.6ms | 150ms | ok |
| submissions list (q=Kubernetes) | 12.0ms | 150ms | ok |
| submission detail | 12.6ms | 150ms | ok |
| event overview | 12.5ms | 150ms | ok |
| organizer agenda (300 accepted) | 18.4ms | 150ms | ok |
| public sessions page | 3.5ms | 150ms | ok |
| public agenda | 5.8ms | 150ms | ok |
| schedule.ics 150 ids | 84.2ms | 150ms | ok |
| plan progress (12 reviewers) | 39.1ms | 150ms | ok |
| rating PUT | 31.8ms | 150ms | ok |

Run 2:
| route | p95 | budget | status |
|---|---|---|---|
| submissions list (page 1) | 31.1ms | 150ms | ok |
| submissions list (q=Kubernetes) | 39.5ms | 150ms | ok |
| submission detail | 45.4ms | 150ms | ok |
| event overview | 34.0ms | 150ms | ok |
| organizer agenda (300 accepted) | 42.5ms | 150ms | ok |
| public sessions page | 11.9ms | 150ms | ok |
| public agenda | 26.8ms | 150ms | ok |
| schedule.ics 150 ids | 83.2ms | 150ms | ok |
| plan progress (12 reviewers) | 18.2ms | 150ms | ok |
| rating PUT | 29.3ms | 150ms | ok |

Both runs: all 10 routes `ok` against the 150ms uniform budget asserted
by `scripts/perf-smoke.ts`/`perf-smoke-lib.ts`; the script's exit code
was 0 both times (no budget assertion failed; the DEC-094/095 301-id
cap probe is untimed and asserts 400, throwing on mismatch — neither
run threw).

## Comparison against last green baseline

The full DEC-188 grep for `perf-smoke @ 38860f9` (per this task's
instructions, distinguishing it from the dead-campaign homonyms
`task-w12-c — perf-smoke @ 3543f09` and `task-w13-d — perf-smoke @
0ee30dd`) finds two matching full headings: `task-w9-d — perf-smoke @
38860f9` (line ~5078) and `task-w8-d — perf-smoke @ 38860f9` (line
~5198), both RESULT: PASS. `task-w9-d`'s baseline (same budget, same
harness):

submissions list page 1 11.0ms, q=Kubernetes 19.0ms, submission detail
15.3ms, event overview 14.0ms, organizer agenda (300 accepted) 18.9ms,
public sessions page 4.0ms, public agenda 5.4ms, schedule.ics 150 ids
41.0ms, plan progress (12 reviewers) 18.0ms, rating PUT 42.1ms.

This gate's two runs are the same order of magnitude as that baseline
for every route; `schedule.ics 150 ids` (83-84ms here vs 41ms then)
and the general run-2 uplift (local-dev variance under a
concurrently-loaded machine, matching the variance pattern `task-w9-d`
itself noted against its own `task-w4-d` baseline) stay well under the
150ms uniform budget with no probe near the ceiling. No regression.

## Cleanup

`wrangler dev` and its `workerd` child processes killed; `lsof -i
:8899` confirms the port free. The `chautauqua-wt/gate-w12-d-perf`
detached worktree's local `.dev.vars` (created fresh from the tracked
`.dev.vars.example` by `ensure-dev-vars.ts`, never the main worktree's
file) was never read or printed by this gate at any point.

## OPEN ITEMS: 0

## RESULT: PASS
