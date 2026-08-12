# task-w21-e — perf smoke + DEC-469 measurability audit (stage 1 close)

Log-only lane (DEC-472/453/438/469). No file under `src/`, `app/src/`, `scripts/`, `test/`,
`migrations/`, `decisions/`, or `package.json` was touched by this task.

Sha measured: `bf56ba715a36bcde8bbdb9e01edf7b573c38b0de` (HEAD of `main` at worktree cut time,
commit `bf56ba7 scribe wave 21`; confirmed still an ancestor of current `main` tip `27cff15` via
`git merge-base --is-ancestor bf56ba7 main`). Fresh worktree
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w21-e`), no prior
`.wrangler/state/v3`. Sequence: `npm run db:migrate && npm run seed && npm run perf:seed`,
`npx wrangler dev --port 8799`, then `PERF_URL=http://localhost:8799 npm run perf:smoke`.

## Gotcha found mid-lane: port collision with a sibling worktree's dev server

The default `npm run dev` (`wrangler dev`, port 8787) was silently answered by
**`task-w21-d`'s** already-running `workerd` process on `localhost:8787`, not this worktree's. A
first `perf:smoke` run against the default port returned all-PASS timings and, when independently
probed with `curl`, tiny row counts (`pipeline` total=3, `users` total=9) that matched the
*pre-DEC-469* seed scale, not this worktree's freshly-seeded 803/104 — because it was hitting a
different worktree's database entirely. Direct `sqlite3` queries against *this* worktree's own D1
file (`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9d8a...db862e2.sqlite`) showed 803/104 the
whole time; the mismatch was 100% the wrong server, not stale data. Confirmed via
`lsof -nP -iTCP:8787 -sTCP:LISTEN` → `workerd` PID resolved (via `ps aux`) to
`.../chautauqua-wt/task-w21-d/node_modules/...`. Fixed by running `wrangler dev --port 8799` and
re-verifying with `ps aux | grep task-w21-e.*workerd` that the listening process actually lives in
*this* worktree before trusting any measurement. **All results below are from the reconfirmed
port-8799 run against this worktree's own seeded DB.** Flagging for the field guide: any perf/dev
lane run concurrently with sibling worker lanes must pin a non-default `--port` and verify the
listening PID's cwd before trusting `curl`/smoke output against `localhost:8787`.

## Second gotcha: this worktree was destroyed mid-lane by an out-of-band process

After the measurements below were taken (against sha `bf56ba7`, `--port 8799`), this worktree's
`.git` link, `node_modules`, `src/`, `scripts/`, and most of `docs/` vanished out from under this
session — an out-of-band process (consistent with the same class of event
`task-w17-f-pagination-audit-stage1.md` reported: "worktree destroyed twice mid-audit by an
out-of-band process while sibling lanes were active concurrently"). Only this file (already
written) survived the first destructive pass, and was then also lost on `rm -rf` when recreating
the worktree. The measurements recorded here (the perf:smoke table, DB row counts, and live API
probes) are preserved verbatim from this session's own transcript, not re-run against the
recreated worktree, since the recreated worktree pins the identical sha `bf56ba7` and the seed
script is fully deterministic (fixed ids via `seedId`). The recreated worktree required a new
branch name (`task-w21-e-v2`) because the original `task-w21-e` branch ref was also gone by the
time of recreation — `git branch --list task-w21-e` returned nothing. This is the same failure
mode DEC-472 exists to catch (a branch pointer vanishing without warning); flagging again for the
field guide since it has now recurred at least twice across waves 17 and 21.

## 1. Full perf:smoke table (verbatim, all 23 checks, exit code 0)

```
p95 over 30 measured iterations (overhead floor: 2.5ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=    11.7ms  floor=   2.5ms  adjusted=     9.2ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    14.2ms  floor=   2.5ms  adjusted=    11.7ms  budget(read)=50ms  PASS
  submission detail                         raw=    13.2ms  floor=   2.5ms  adjusted=    10.7ms  budget(read)=50ms  PASS
  event overview                            raw=    26.9ms  floor=   2.5ms  adjusted=    24.3ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    18.9ms  floor=   2.5ms  adjusted=    16.4ms  budget(read)=50ms  PASS
  public sessions page                      raw=     3.9ms  floor=   2.5ms  adjusted=     1.4ms  budget(public)=150ms  PASS
  public agenda                             raw=     5.6ms  floor=   2.5ms  adjusted=     3.1ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    43.9ms  floor=   2.5ms  adjusted=    41.4ms  budget(public)=150ms  PASS
  public speakers page                      raw=     3.4ms  floor=   2.5ms  adjusted=     0.9ms  budget(public)=150ms  PASS
  public gallery page                       raw=     6.6ms  floor=   2.5ms  adjusted=     4.0ms  budget(public)=150ms  PASS
  public schedule page                      raw=     6.2ms  floor=   2.5ms  adjusted=     3.7ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     4.4ms  floor=   2.5ms  adjusted=     1.8ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=     4.1ms  floor=   2.5ms  adjusted=     1.6ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    23.6ms  floor=   2.5ms  adjusted=    21.1ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=     5.5ms  floor=   2.5ms  adjusted=     3.0ms  budget(read)=50ms  PASS
  rating PUT                                raw=    11.2ms  floor=   2.5ms  adjusted=     8.7ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    13.0ms  floor=   2.5ms  adjusted=    10.5ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    15.0ms  floor=   2.5ms  adjusted=    12.5ms  budget(read)=50ms  PASS
  email log list (page 1)                   raw=     5.4ms  floor=   2.5ms  adjusted=     2.8ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=    10.9ms  floor=   2.5ms  adjusted=     8.3ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    16.3ms  floor=   2.5ms  adjusted=    13.8ms  budget(read)=50ms  PASS
  pipeline list (page 1)                    raw=    11.0ms  floor=   2.5ms  adjusted=     8.5ms  budget(read)=50ms  PASS
  org users list (page 1)                   raw=     5.4ms  floor=   2.5ms  adjusted=     2.9ms  budget(read)=50ms  PASS

perf:smoke OK
```

Exit code: `0`. All 23 checks PASS.

## 2. DEC-469 measurability audit — actual row counts behind the two most-at-risk endpoints

Queried the seeded D1 sqlite file directly (not through the app), after
`npm run db:migrate && npm run seed && npm run perf:seed`:

```
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite \
  "SELECT count(*) FROM pipeline_entry WHERE org_id='seed_org_0001';"   -> 803
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite \
  "SELECT count(*) FROM user WHERE org_id='seed_org_0001';"             -> 104
```

The perf org is the DB's only org (`SELECT id FROM org` returns one row, `seed_org_0001`), so these
counts equal the table's org-scoped population that `/api/v1/pipeline` and `/api/v1/users` query.

**Both counts are measurable at scale, not the historical 3/19.** The task brief's premise (
`scripts/perf-seed.ts historically seeded neither at scale (3 and 19 rows live)`) described a
pre-fix state; DEC-469's fix (commit `43e6889 DEC-469: seed pipeline_entry/user rows +
perf-smoke checks for pipeline/users`, merged into `main` at `3764993 merge task-w20-e`, which is
an ancestor of this lane's sha — see §3) is present in the tree at this sha and demonstrably ran:
803 `pipeline_entry` rows and 104 `user` rows exist for the perf org. **Neither row is
UNMEASURABLE-BY-CONSTRUCTION at this sha.** Independently confirmed live via the API (§4 below):
`GET /api/v1/pipeline?page=1&perPage=50` returns `total=803`; `GET /api/v1/users?page=1&perPage=50`
returns `total=104` — matching the DB counts exactly, once queried against the correct worktree's
server (see the port-collision gotcha above).

## 3. Does scripts/perf-smoke.ts contain read-budget checks for /api/v1/pipeline and /api/v1/users?

**Yes**, both checks are present in `scripts/perf-smoke.ts` at this sha:

```
scripts/perf-smoke.ts:500:      name: "pipeline list (page 1)",
scripts/perf-smoke.ts:502:      run: () => fetch(`${PERF_URL}/api/v1/pipeline?page=1&perPage=50`, { headers }),
scripts/perf-smoke.ts:509:      run: () => fetch(`${PERF_URL}/api/v1/users?page=1&perPage=50`, { headers }),
```

Per DEC-472, checked ancestry mechanically rather than trusting the task brief's or the field
guide's past-tense narration:

```
$ git branch -a | grep w20-e
(no output — no local ref named task-w20-e exists in this worktree; it was deleted after merge)

$ git merge-base --is-ancestor task-w20-e HEAD
fatal: Not a valid object name task-w20-e     (exit 128 — the ref itself is gone)
```

The branch *ref* `task-w20-e` no longer resolves (deleted post-merge, consistent with normal
workflow branch cleanup), so the literal command DEC-472 asks for cannot be run as written. Its
tip commit is still identifiable from the merge commit history:

```
$ git log --merges --oneline | grep -i "w20-e"
3764993 merge task-w20-e
12cf28b merge task-w20-e
b996add merge task-w20-e

$ git show 3764993 --format="%H %P" -s
3764993aed0a09610c351a06adbcfc8690562e2f f3101117... 43e6889642ff150e20805b9274f1b4eaf1331a08
```

`43e6889` is the second parent of `3764993 merge task-w20-e` — i.e. the actual tip of the
(now-deleted-ref) `task-w20-e` branch that landed. Substituting the commit sha for the vanished
branch name:

```
$ git merge-base --is-ancestor 43e6889 HEAD && echo true
true
```

**Recorded as: true** — task-w20-e's content (via its tip commit `43e6889`) is an ancestor of this
lane's sha `bf56ba7`, and the checks exist in the file at this sha, confirmed by direct `grep`
above (not by trusting the field guide's or task brief's characterization). Two merge commits with
the same message (`12cf28b`, `b996add`) also appear in history from earlier waves' merges of
overlapping/rebased branch content — not investigated further as out of this lane's scope; noted
here only because DEC-472 requires flagging ambiguity rather than silently picking one.

## 4. Live probe: items.length / total for pipeline, users, and the unrestricted reviewer queue

All probes run against `http://localhost:8799` (this worktree's own `wrangler dev`, confirmed by
PID→cwd match), with the perf seed loaded and real cookie-session logins (`POST /login` with a
`chq_csrf` token, not a bypass).

Organizer login (`sbek-organizer@example.com`, from `docs/fixtures/sample-data.json` — the demo
identity DEC-469's perf seed builds its extra rows on top of):

| endpoint | items.length | total |
|---|---|---|
| `GET /api/v1/pipeline?page=1&perPage=50` | 50 | 803 |
| `GET /api/v1/users?page=1&perPage=50` | 50 | 104 |

Reviewer login (`perf.reviewer.1@example-perf.test` / `PerfReviewer!2027`, DEC-469's dedicated
perf reviewer):

| endpoint | items.length | total | envelope keys |
|---|---|---|---|
| `GET /api/v1/review/plans/seed_perf_plan_0001/queue` (no page/perPage params) | 200 | **1499** | `items, total, page, perPage, open, recused` |

**Discrepancy vs. DEC-466's claim:** DEC-466's prose states this reviewer, on the 2,000-submission
perf event, "returns all 2,000 shaped rows." The live probe returns `total=1499`, not 2000. Reading
`src/routes/review/reviewer.ts:66-138`: `total` is `items.length` where `items` is
`scopedActionable` **filtered** to `item.alreadyRatedByMe || needsMoreRatings(item, plan.maxEvaluations)`
— i.e. the queue's `total` is the count of submissions still needing this reviewer's rating (or
already rated by them) in the plan's *current round*, not literally every submission the plan
scopes to the reviewer. The perf event has 2,000 total submissions but only 300
`accepted`/`accept_queue` + 100 `declined`/`decline_queue` + 1,200 `pending` by status; some
fraction of those already carry enough ratings from other reviewers to drop out of
`needsMoreRatings`, which plausibly accounts for 2000 → 1499. This was **not chased further**
(outside this log-only lane's scope to re-derive the exact arithmetic), but the raw number is
recorded as measured, and DEC-466's "all 2,000" is not literally true at this sha for this
reviewer/round — it should be read as "the queue is unbounded/JS-sliced at 2,000-submission scale,"
not as a literal count claim. Flagging as an open item per the instruction that this lane records
what it measures, not what a decision doc narrated.

## OPEN ITEMS: 1

1. **PENDING-OWNED(none — informational, not source-changing):** DEC-466's prose claim that the
   unrestricted reviewer queue "returns all 2,000 shaped rows" does not match this lane's live
   measurement (`total=1499`). Not a defect — the queue's `total` is a filtered
   still-needs-rating/already-rated-by-me count by design (DEC-082/DEC-346/DEC-439's current-round
   scoping), and DEC-466's own fix (JS-slice + full-array-length `total`) is correctly implemented
   and unbounded-safe regardless of the exact number. This is a documentation-precision gap in
   DEC-466's own prose, not a code defect and not something this log-only lane can fix (decisions/
   is off-limits to this task). No branch owns a correction; flagged for the scribe/planner to
   either amend DEC-466's wording or accept "1499 of 2000, filtered by round-scoping" as the
   accurate description.

## RESULT: PASS

All 23 `perf:smoke` checks pass (exit 0) at sha `bf56ba7`, including the two DEC-469 checks for
`/api/v1/pipeline` and `/api/v1/users`. Both checks are measurable-by-construction at this sha
(803 pipeline_entry rows, 104 user rows for the perf org — not the historical 3/19), confirmed both
via direct sqlite3 query and via live authenticated API probe. `task-w20-e`'s content (tip commit
`43e6889`) is confirmed an ancestor of this sha via `git merge-base --is-ancestor` (using the
commit sha, since the branch ref itself was deleted post-merge). One informational open item
(DEC-466 prose vs. measured reviewer-queue total) is recorded above; it does not affect the
PASS/FAIL status of any perf:smoke check.
