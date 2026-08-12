# task-w16-c — perf:smoke @ 2,000-submission seed, before/after on DEC-439/442 (DEC-448)

Evidence lane, log-only: no source file was changed by this task.

Method: `npm run db:migrate` + `npm run seed` + `npm run perf:seed`
(`PERF_EVENT_SLUG=perf-2k`, `PERF_PLAN_ID=seed_perf_plan_0001`, 2,000
submissions / 800 contacts / 12 reviewers) against a fresh local D1, then
`npm run dev -- --port 8797` per DEC-448 (never `cp .dev.vars.example` +
bare `npx wrangler dev` — `npm run dev` runs the `predev` `ensure-dev-vars`
step that provisions `.dev.vars` correctly), then
`PERF_URL=http://localhost:8797 npm run perf:smoke` run four times in a
row against the same seed and the same server process.

Port note: `wrangler dev`'s default port 8787 was already bound by another
in-flight worktree's dev server at cut time, so this lane used `--port
8797` explicitly (`npm run dev -- --port 8797`) rather than fighting for
the default.

## Environment / contention note

`ps aux` at measurement time showed **five other** node/wrangler/tsx
processes alive on the host beyond this lane's own `wrangler dev --port
8797`:
- a **stale** `task-w8-i` worktree `wrangler d1 execute ... --file=
  .perf-seed.sql` process, alive since 2:37AM (many hours before this run),
  0% CPU — looks hung/zombied rather than actively contending, but present
  the whole time.
- `task-w16-b` worktree running its own `wrangler dev --port 28787` plus
  live `seed`/`r2 object put` work.
- `task-w16-d` worktree running its own `wrangler dev` (default port,
  since this lane had to move off 8787).
- the main checkout (`/Users/wednesdayniemeyer/.../chautauqua`, not a
  worktree) running its own `wrangler dev --port 18787` plus a `db:migrate`
  + `seed` pipeline mid-flight.
- an unrelated `killmysaas-evals` tsx driver process (different repo
  entirely).

This is materially **more concurrent host contention** than
`task-w13-d-perf-smoke-stage1.md` reported (which flagged one contending
`wrangler d1 execute` process). It is flagged as an aggravating factor for
the borderline/noisy readings below, per that task's precedent — not
treated as grounds to discard them, since SPEC.md:331-332 treats an
over-budget route as a bug regardless of why the DB was momentarily slow.

## Full p95 table (run 1)

```
p95 over 30 measured iterations (overhead floor: 2.5ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=     8.4ms  adjusted=     6.0ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    13.3ms  adjusted=    10.8ms  budget(read)=50ms  PASS
  submission detail                         raw=    13.8ms  adjusted=    11.3ms  budget(read)=50ms  PASS
  event overview                            raw=    21.9ms  adjusted=    19.5ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    22.8ms  adjusted=    20.3ms  budget(read)=50ms  PASS
  public sessions page                      raw=     5.1ms  adjusted=     2.7ms  budget(public)=150ms  PASS
  public agenda                             raw=     6.3ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=    43.0ms  adjusted=    40.6ms  budget(public)=150ms  PASS
  public speakers page                      raw=     3.6ms  adjusted=     1.1ms  budget(public)=150ms  PASS
  public gallery page                       raw=     4.3ms  adjusted=     1.8ms  budget(public)=150ms  PASS
  public schedule page                      raw=     6.2ms  adjusted=     3.8ms  budget(public)=150ms  PASS
  agenda.ics                                raw=     4.7ms  adjusted=     2.3ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=     4.9ms  adjusted=     2.4ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)              raw=    23.0ms  adjusted=    20.6ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=    10.0ms  adjusted=     7.6ms  budget(read)=50ms  PASS
  rating PUT                                raw=    14.3ms  adjusted=    11.9ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    15.6ms  adjusted=    13.1ms  budget(read)=50ms  PASS
  reviewer queue                            raw=    64.4ms  adjusted=    61.9ms  budget(read)=50ms  FAIL
  email log list (page 1)                   raw=    10.8ms  adjusted=     8.4ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=    13.5ms  adjusted=    11.0ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    21.0ms  adjusted=    18.5ms  budget(read)=50ms  PASS

perf:smoke FAILED — at least one check exceeded its raw ceiling or class budget
```

## Variance across 4 back-to-back runs (same seed, same server process)

| check | run1 adjusted p95 | run2 | run3 | run4 | verdict |
|---|---|---|---|---|---|
| reviewer queue | 61.9ms FAIL | 86.5ms FAIL | 53.8ms FAIL | 65.4ms FAIL | **4/4 FAIL — no margin** |
| plan results (page 1) | 18.5ms PASS | 34.9ms PASS | 16.0ms PASS | 18.0ms PASS | stable, wide margin |
| schedule.ics (bare, whole agenda) | 2.4ms PASS | 8.8ms PASS | 2.2ms PASS | 0.8ms PASS | stable, wide margin |
| event overview | 19.5ms PASS | 55.8ms **FAIL** | 26.0ms PASS | 26.1ms PASS | 1/4 FAIL — new borderline flake, not this lane's scope |
| schedule.ics 150 ids | 40.6ms PASS | 140.3ms PASS (close) | 67.7ms PASS | 63.3ms PASS | noisy but PASS every run |
| everything else | PASS | PASS | PASS | PASS | stable |

Exit codes across the 4 runs: FAIL, FAIL, FAIL, FAIL (all four driven by
`reviewer queue`; run 2 additionally FAILed on `event overview`, a check
outside this lane's three named open items — flagged, not investigated
further, since it is not one of w13-d's three items and this is a log-only
lane).

## Before/after on the three w13-d open items

### 1. reviewer queue — DEC-439/task-w15-a landed; STILL FAILS, 4/4 runs, worse-and-more-consistent than before

The fix has landed on `main` (`git log` shows `da17394 perf(review): scope
reviewer queue to one reviewer's slice (DEC-439)`, merged via
`task-w15-a`). I read `resolveReviewerSubmissions`
(`src/server/repo/review/submissions.ts:126-215`): it no longer loads every
plan-scoped submission plus every `plan_reviewer` row and recomputes all 12
reviewers' assignments in JS. It now queries only this `(plan, userId)`'s
`plan_reviewer` rows, then issues one scoped `submission` query using EXISTS
subqueries over `submission_track` — the fix described in DEC-439 is real
and present in the code.

**However, at the perf seed's own scale this reviewer queue is now
*consistently* over budget (61.9-86.5ms adjusted, 4/4 FAIL), where w13-d's
pre-fix reading was *borderline* (23-113ms, 1/4 FAIL).** I traced why by
reading the seed data and the route:

- The perf seed's 12 `plan_reviewer` rows are **all-scope /
  unrestricted** (`trackId` and `submissionId` both null) —
  `scripts/perf-seed.ts:349` inserts one all-scope `plan_reviewer` row per
  reviewer, and the plan itself (`seed_perf_plan_0001`) has `filters_json =
  NULL`. Confirmed directly against the local D1: `SELECT count(*) FROM
  plan_reviewer WHERE plan_id='seed_perf_plan_0001' AND
  user_id='seed_perf_reviewer_0001'` returns `1`, and that row is
  unrestricted.
- For an unrestricted reviewer, DEC-439's own docstring
  (`src/server/repo/review/submissions.ts:120-122`) says "an unrestricted
  row ... grants every plan-filtered submission" — so `matched` is still
  **all 2,000 event-scoped submissions** (`SELECT count(*) FROM submission
  WHERE event_id='seed_perf_event'` = 2000). The per-reviewer *slice* the
  fix targets is, for this seed's realistic "reviewer sees the whole
  event" shape, no smaller than before.
- What changed instead: the post-match track lookup
  (`src/server/repo/review/submissions.ts:196-206`) and the route's
  `countEvaluationsBySubmission` call
  (`src/routes/review/reviewer.ts:60-66` ->
  `src/server/repo/review/evaluations.ts:117-138`) both now `chunkIds`
  (`ID_CHUNK_SIZE = 90`, `src/lib/chunk.ts`) over the 2,000 matched ids and
  issue **one sequential `await`ed query per 90-id chunk** — ceil(2000/90)
  = 23 chunks each, so ~46 sequential round-trips for track lookup +
  count, on top of the `plan_reviewer`/`submission`/`event`/
  `listSubmissionIdsRatedBy`/`listRecusalsForReviewer` calls (5 more). That
  is roughly 51 sequential D1 round-trips per reviewer-queue request for an
  unrestricted reviewer at 2,000 submissions, versus the old code's small,
  fixed number of unchunked whole-table scans. At an observed ~1-1.5ms per
  local-D1 round-trip this reconciles with the 54-88ms readings above.

**This is a new, more precise finding, not a restatement of w13-d's.** The
DEC-439 fix is real and correctly targets the *scoped* (track- or
submission-restricted) reviewer case; it does not help — and appears to add
per-chunk round-trip overhead to — the *unrestricted*-reviewer case, which
is also the case the perf seed itself uses to match its round-robin
evaluation-assignment shape (`scripts/perf-seed-lib.ts:184-185`) and is
plausibly the common real-world shape for a small-track-count event.
**Reported as the number, not inferred: PENDING, task not owned by this
lane** (DEC-439 covers a different mechanism than the one now measured as
the bottleneck — the chunked-round-trip cost on the unrestricted path is a
new observation for the next perf-owning lane, not something task-w15-a
already closed).

### 2. plan results page 1 — DEC-439/DEC-440 landed, confirmed by code and by measurement: PASS, wide margin

`git log` shows `1e30e84 perf(review): narrow ranked-results payload
(DEC-439/DEC-440)`, merged via `task-w15-a`. Read
`src/routes/review/shared.ts:251-293` (`buildResults`): line 259 calls
`repo.listPlanFilteredSubmissions(c.var.db, plan, { withTrackIds: false
})` exactly as expected — the second whole-event `submission_track` scan is
gone. Evaluations load via `repo.listEvaluationScoresForPlan` (line 260),
which I read at `src/server/repo/review/evaluations.ts:47-63`: it selects
only `submissionId, scoresJson` (`db.select({ submissionId: ...,
scoresJson: ... })`), never comment blobs or full `SELECT *`. Measured:
16.0-34.9ms adjusted across all 4 runs, PASS every time, comfortably under
the 50ms read budget — this item is **closed**.

### 3. bare schedule.ics — DEC-442 landed, confirmed by code, measurement, and a live cache-engagement demonstration: PASS, wide margin

`src/server/pubcache.ts:80` `isUncacheableIcsRequest` — read directly:

```
export function isUncacheableIcsRequest(url: string): boolean {
  const parsed = new URL(url);
  return parsed.pathname.endsWith("/schedule.ics") && parsed.searchParams.has("ids");
}
```

Skips the cache only when the URL path ends `/schedule.ics` AND carries an
`ids` param — request-shaped, not path-shaped, matching DEC-442. Measured
0.8-8.8ms adjusted across all 4 runs (vs. w13-d's pre-fix 80-216ms), PASS
every time with wide margin.

Live cache-engagement demonstration against the running dev server (event
`seed_perf_event`, slug `perf-2k`, organizer `sbek-organizer@example.com`
from `docs/fixtures/sample-data.json`, logged in via the same
`/login` cookie flow `scripts/perf-smoke.ts` uses):

- **cold bare** `GET /e/perf-2k/schedule.ics` (1st request after a fresh
  version): no `CF-Cache-Status` header (miss/pass-through).
- **warm bare** (2nd identical request): `CF-Cache-Status: HIT`.
- **`?ids=`-carrying** `GET /e/perf-2k/schedule.ics?ids=seed_perf_submission_0001`,
  issued 3 times in a row: **never** shows `CF-Cache-Status: HIT` on any of
  the 3 requests — confirmed uncached every time, as designed.
- **publish-affecting write**: `POST
  /api/v1/events/seed_perf_event/agenda/publish` (authenticated organizer,
  `x-chq-csrf: 1` header per `src/server/middleware.ts:243`) returned `200
  {"published":300}`. Immediately after, the next bare `schedule.ics`
  request shows **no** `CF-Cache-Status` header (miss — the version bump
  worked), and the request after *that* shows `CF-Cache-Status: HIT` again
  (cache re-engaged on the new version). This item is **closed**.

## Summary of the three w13-d items

| # | item | w13-d (before) | this run (after) | status |
|---|---|---|---|---|
| 1 | reviewer queue | 23-112ms, 1/4 FAIL (borderline) | 54-88ms, **4/4 FAIL** (consistent) | DEC-439 fix landed and is real for the scoped-reviewer path, but does not close the budget miss for the perf seed's unrestricted-reviewer path — chunked round-trip overhead is the new bottleneck. **PENDING, unowned by task-w15-a's landed change** — flagged for the next perf-owning lane |
| 2 | plan results (page 1) | 36-92ms, 2/4 FAIL (borderline) | 16-35ms, 4/4 PASS | **CLOSED** — DEC-439/440 fix confirmed real and effective |
| 3 | schedule.ics (bare) | 80-216ms, borderline/noisy | 0.8-8.8ms, 4/4 PASS + live cache-hit/miss/bump demo | **CLOSED** — DEC-442 fix confirmed real and effective |

## DEC-433 hostile-probe re-confirmation

`/e/perf-2k/sessions` and `/e/perf-2k/speakers` probed with `?page=100000`,
`?page=1e308`, `?limit=100`: all six requests returned `200`, no `500`.
Read `src/routes/public/query.ts:12-15` (`parsePage`): `Number("1e308")` is
finite-but-not-`Number.isInteger` (`Number.isInteger(1e308)` is `false` in
JS since it exceeds `Number.MAX_SAFE_INTEGER`'s exact-integer range) so it
falls into the `n < 1`-style default-to-1 branch; `page=100000` clamps to
`MAX_PUBLIC_PAGE = 50`. `?limit=100` is not a recognized query param on
these routes (no `limit` override exists) so it's inert. Read
`src/server/repo/public/bounds.ts` (`boundedRowLimit`): throws on any
non-finite/non-integer input (fail-loudly per house invariant) and is the
only path to the SQL `LIMIT` clause in `src/server/repo/public/sessions.ts:326`
and `src/server/repo/public/speakers.ts:68`. Both bounds hold; no source
change needed.

## Edge-cache-hit TTFB / Smart Placement — STAGE-2-only, no number reported

Per SPEC.md:59-62 and the same reasoning `task-w13-d-perf-smoke-stage1.md`
gave: Miniflare's local `wrangler dev` has no Cloudflare edge in front of
it, so there is no true edge-cache-hit TTFB to measure and no Smart
Placement routing to observe under this harness.

| surface | status |
|---|---|
| true edge-cache-hit TTFB | STAGE-2-only — no Cloudflare edge under Miniflare |
| Smart Placement | STAGE-2-only — no Smart Placement routing under Miniflare |

## Open items

1. `reviewer queue` (`src/server/repo/review/submissions.ts:126-215` +
   `src/routes/review/reviewer.ts:50-90`) is over the 50ms read budget on
   4/4 runs (54-88ms adjusted) for an **unrestricted** reviewer at 2,000
   event-scoped submissions — the DEC-439 scoping fix does not shrink the
   matched set for this case (unrestricted still means "every plan-
   filtered submission"), and the chunked (`ID_CHUNK_SIZE = 90`) per-90-id
   round-trips for track lookup and evaluation counting appear to be the
   new bottleneck (~46 sequential D1 round-trips for this one request).
   PENDING, no owning decision/task found for this specific mechanism.

OPEN ITEMS: 1
RESULT: FAIL
