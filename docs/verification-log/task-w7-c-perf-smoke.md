# task-w7-c — perf-smoke @ d12eb25

Wave-7 code-frozen perf-smoke gate (DEC-077/DEC-102, log-only lane).
Newest code-bearing `main` short-sha re-derived per DEC-091/DEC-090:
walking `main` from tip `52b9eaa` — `52b9eaa` (merge task-w7-a, no own
diff), `b17595e` (task-w7-a gate section, `docs/verification-log.md` +
`docs/verification-log/task-w7-a-build-test.md` only), `9e7ac53`
(scribe wave 7 — DEC-102 doc + `src/decisions.ts` string-constant
append, doc/decisions-registry only), `4e2d53e`/`0828e32` (task-w5-f,
docs-only) are all DEC-090-exempt bookkeeping. Newest code-bearing
commit: **d12eb25** ("merge task-w6-d") — matches this task's stated
expectation, and matches the sha task-w7-a's own build+test gate cited
in this same wave.

Ran from a fresh worktree `chautauqua-wt/task-w7-c` branched off
`main`'s tip `52b9eaa` (content-identical to `d12eb25` for every
code/test/config path, since the intervening commits are
verified-exempt per DEC-090).

## Note: mid-task worktree loss (environmental, not code-bearing)

Partway through this task's execution, the `chautauqua-wt/task-w7-c`
working directory was externally emptied down to a bare `.wrangler/`
subdirectory (all tracked files, `node_modules`, and the `git worktree`
registration for this path vanished — `git -C
.../chautauqua worktree list` no longer listed it, and the
`task-w7-c` branch itself was gone from `git -C .../chautauqua branch
--list`) while the `npx wrangler dev --port 8803` background process
this task had started was also no longer reachable
(`curl localhost:8803/health` -> connection refused; no `wrangler`
process in `ps aux`). This happened after the perf-smoke run below had
already completed and its output was captured to a scratchpad log, so
the run itself is unaffected. This is recorded honestly per the task's
instruction to note anomalies; it does not reflect a code-bearing
change — `git -C .../chautauqua log --oneline -3` before and after
matches (`52b9eaa` tip, unchanged), and no new commits appeared on
`main` from this event. The worktree/branch were recreated fresh
(`git worktree add .../task-w7-c -b task-w7-c main` at the then-current
`main` tip `52b9eaa`, still `d12eb25` for the newest code-bearing sha)
to write up and commit these docs.

## Steps run

1. `npm ci --prefer-offline --no-audit --no-fund --silent` — clean
   install, no errors (run twice: once in the original worktree instance,
   once again after the worktree was recreated per the note above).
2. `npm run build` — `tsc --noEmit` (root), `tsc --noEmit -p
   app/tsconfig.json`, `vite build` all succeeded (125 modules, entry
   `index-DOwNDQO_.js` 179.18 kB / gzip 58.63 kB — matches task-w7-a's
   same-sha build+test gate figures exactly).
3. `npm run db:migrate` — 10 migrations (`0000`..`0009`, including
   `0009_review_rounds.sql`) applied cleanly to local D1 (`chautauqua`).
4. `npm run seed` — completed with no errors (D1 rows + 6 R2 objects),
   run before `perf:seed` per the DEC-088/w16-c precedent recorded in
   the prior perf-smoke gate files (`perf:seed` seeds only
   `seed_perf_`-prefixed rows; `perf:smoke` logs in as the fixture
   organizer from `docs/fixtures/sample-data.json`, which only exists
   after the regular demo seed runs).
5. `npm run perf:seed` — applied cleanly (D1 batch of INSERT
   statements, all `"success": true`). Verified the DEC-088 extended
   scale directly against local D1:
   - `plan_reviewer` rows for `plan_id='seed_perf_plan_0001'`: **12**
     (matches `PERF_REVIEWER_COUNT`).
   - `submission` rows for `event_id='seed_perf_event'` by status:
     `accept_queue` 300, `accepted` 300, `decline_queue` 100,
     `declined` 100, `pending` 1200 — 2000 total (`PERF_SUBMISSION_COUNT`,
     `PERF_STATUS_COUNTS`), i.e. exactly 300 accepted submissions, not
     301+, matching DEC-088.
6. Started `npx wrangler dev --port 8803` (8803 reserved for this lane,
   never 8787/8801) in the background; confirmed `Ready on
   http://localhost:8803` with D1/KV/R2/ASSETS bindings attached, and a
   `GET /health` 200.
7. `PERF_URL=http://localhost:8803 npm run perf:smoke` — **DEC-089/
   DEC-080/DEC-094 cap probe PASSES**, then fails on the "event
   overview" timed check before any p95 data is collected.

## Cap probe result (DEC-089/DEC-080/DEC-094): PASS

`fetchAcceptedSubmissionIds(headers, 300)` paginated at
`PERF_MAX_PER_PAGE=200` (two pages: 200 + 100) and returned exactly 300
real accepted-submission ids — the DEC-094 fix (`planPerfPages`
pagination, since `src/lib/pagination.ts`'s `MAX_PER_PAGE=200` clamps
any single-page request) works correctly against the DEC-088 seed's
actual 300-accepted ceiling. Those 300 real ids plus one synthetic
`sub_cap_probe_nonexistent_0001` id were sent to
`GET /e/perf-2k/schedule.ics?ids=...` (301 ids total, one over the
DEC-080 300-id cap) and the server returned **400** as required —
confirmed both by the script not throwing past this point and directly
in the `wrangler dev` log: `GET /e/perf-2k/schedule.ics 400 Bad
Request (3ms)`. This closes the open item task-w4-c's perf-smoke gate
recorded (DEC-088/DEC-089 seed-vs-probe mismatch) — the DEC-094/095 fix
now in-tree resolves it.

## Failure: "event overview" check, 500 (new defect, distinct from DEC-094/095)

```
Error: event overview failed during warmup: 500
    at timeCheck (scripts/perf-smoke.ts:135:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async main (scripts/perf-smoke.ts:298:21)
```

`wrangler dev` server-side stack trace for the same request:

```
✘ [ERROR] unhandled error Error: D1_ERROR: too many SQL variables at offset 396: SQLITE_ERROR
    at D1DatabaseSessionAlwaysPrimary._sendOrThrow (cloudflare-internal:d1-api:146:19)
    ...
    at async getOverviewPayload (src/server/repo/overview.ts:170:11)
    ...
[wrangler:info] GET /api/v1/events/seed_perf_event/overview 500 Internal Server Error (14ms)
```

### Root cause (read-only analysis, no code/script changes made — DEC-077 log-only lane)

`src/server/repo/overview.ts`'s `getOverviewPayload` (lines ~144-177)
computes the agenda section by: (a) selecting all `accepted`
submissions for the event, (b) inner-joining `schedule_slot` to get
`placedIds` (accepted submissions with a schedule slot), then (c) at
line 170 running
`db.select(...).from(schema.participant).where(inArray(schema.participant.submissionId, placedIds))`
to fan out speakers for those placed submissions. At the DEC-088
perf-seed scale, all (or nearly all) of the 300 `accepted` submissions
for `seed_perf_event` are placed with schedule slots, so `placedIds`
has ~300 entries — one bind parameter per id in the generated
`IN (?, ?, ..., ?)` clause. D1's local SQLite backend rejects this with
`SQLITE_ERROR: too many SQL variables` (D1's local emulation enforces a
bind-variable ceiling well under 300; the query already fails "at
offset 396" per the error, i.e. partway through building the full
statement including this clause plus surrounding query scaffolding).
This is a genuine scale defect surfaced only by the DEC-088 2k-submission/
300-accepted perf fixture — the regular (non-perf) seed's accepted-count
is far below any `IN`-clause limit, so `npm test` and the walkthrough
gates never exercise this path at this cardinality. It is unrelated to
the DEC-094/DEC-095 pagination/cap-probe fixes (which are confirmed
working above) and to DEC-089's five-check list — this is a **new,
previously-undocumented** finding from this task's own run, not a
disposition of any prior open item.

Because the request throws before returning a response, the timed
`event overview` check's warmup loop's very first iteration fails
`!res.ok`, and `timeCheck` throws — `check.optional: true` only
special-cases a `404` response ("not yet landed") for a skip, not a
`500`, so this correctly surfaces as a hard failure rather than being
silently skipped.

**No p95 data was collected for any check** past this point. Three
checks (`submissions list (page 1)`, `submissions list (q=...)`,
`submission detail`) did complete their full 5-warmup + 30-measured
timing loops before `event overview` was reached, but `main`'s results
table is only assembled and printed after the full `checks` loop
finishes, so none of that timing data was ever printed to stdout or
otherwise persisted — it is lost with the process exit. The remaining
five checks (`public sessions page`, `public agenda`, `schedule.ics
150 ids`, `plan progress (12 reviewers)`, `rating PUT`) never ran at
all.

Per DEC-077 (log-only lane) and this task's explicit "no fixes" scope,
`src/server/repo/overview.ts` was left unmodified. This is flagged as
an open item for a future code-bearing wave to reconcile (e.g. batch
the `participant` fan-out query in chunks per DEC-078's
`ID_CHUNK_SIZE=90` pattern already used elsewhere for exactly this
class of D1 bind-variable-limit problem, rather than a single
unbounded `inArray`).

## `npm test`

`96 test files / 984 tests`, all passed, `9.85s` (run from the
recreated worktree at `main` tip `52b9eaa`, still `d12eb25` for the
newest code-bearing sha) — matches task-w7-a's same-sha citation
exactly (96/984).

## Scope note (DEC-077 log-only lane)

This lane touched only `docs/verification-log.md` and
`docs/verification-log/task-w7-c-perf-smoke.md` — no `src/`, `app/`,
`scripts/`, or `migrations/` changes.

`npx wrangler dev --port 8803` was terminated at the end of this task
(the background process was already gone by the time of the worktree-
loss event noted above; port 8803 confirmed free via `lsof -i :8803`
returning nothing and `curl localhost:8803/health` connection-refused).

## OPEN ITEMS: 1

1. `GET /api/v1/events/:eventId/overview` throws `D1_ERROR: too many
   SQL variables` at the DEC-088 perf-seed scale (~300 accepted+placed
   submissions feeding a single unbounded `inArray(...)` on
   `participant.submissionId` in `src/server/repo/overview.ts:170`).
   This blocks the perf-smoke gate's "event overview" timed check (and
   every check after it in script order) from ever running, so no p95
   data exists for `public sessions page`, `public agenda`, `schedule.ics
   150 ids`, `plan progress (12 reviewers)`, or `rating PUT` at this
   sha. The DEC-089/DEC-080/DEC-094 cap probe (301-id `.ics` -> 400) and
   the first three timed checks (`submissions list page 1`,
   `submissions list search`, `submission detail`) do pass/complete.
   Needs a code-bearing fix (e.g. chunked `IN` queries per DEC-078) in a
   future wave before this gate can go green end-to-end.

RESULT: FAIL
