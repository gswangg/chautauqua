# task-w13-d — perf:smoke @ 2,000-submission seed (DEC-419, DEC-432 baseline)

Evidence lane, log-only (DEC-419): no source file was changed by this task.
Method: `npm run perf:seed` against a fresh `npm run db:migrate` +
`npm run seed` + `npm run perf:seed` local D1, then `npm run perf:smoke`
(PERF_URL default `http://localhost:8787`, `wrangler dev`) run four times in
a row against the same seed to characterize variance before picking a
representative table to grade.

Environment note: during this run, `ps aux` showed a second worktree's
(`task-w8-i`) `wrangler d1 execute ... --file=.perf-seed.sql` process alive
on the host since well before this task started, contending for CPU
alongside this lane's own `wrangler dev`. That is the most likely
explanation for the run-to-run variance below (Miniflare/D1 in local dev has
no query planner changes between runs — the code path is identical every
time) rather than a data-dependent regression; it is flagged, not treated as
grounds to discard the readings.

## Primary transcribed table (run 1, cold cache, worst-case of the four)

```
p95 over 30 measured iterations (overhead floor: 2.5ms, raw ceiling: 150ms):

  submissions list (page 1)                 raw=    10.8ms  floor=   2.5ms  adjusted=     8.3ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)           raw=    14.0ms  floor=   2.5ms  adjusted=    11.5ms  budget(read)=50ms  PASS
  submission detail                         raw=    14.8ms  floor=   2.5ms  adjusted=    12.3ms  budget(read)=50ms  PASS
  event overview                            raw=    22.8ms  floor=   2.5ms  adjusted=    20.3ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)           raw=    21.0ms  floor=   2.5ms  adjusted=    18.5ms  budget(read)=50ms  PASS
  public sessions page                      raw=     4.7ms  floor=   2.5ms  adjusted=     2.2ms  budget(public)=150ms  PASS
  public agenda                             raw=     8.0ms  floor=   2.5ms  adjusted=     5.5ms  budget(public)=150ms  PASS
  schedule.ics 150 ids                      raw=   123.0ms  floor=   2.5ms  adjusted=   120.5ms  budget(public)=150ms  PASS
  public speakers page                      raw=    14.1ms  floor=   2.5ms  adjusted=    11.6ms  budget(public)=150ms  PASS
  public gallery page                       raw=    11.5ms  floor=   2.5ms  adjusted=     9.0ms  budget(public)=150ms  PASS
  public schedule page                      raw=    30.9ms  floor=   2.5ms  adjusted=    28.4ms  budget(public)=150ms  PASS
  agenda.ics                                raw=    11.1ms  floor=   2.5ms  adjusted=     8.6ms  budget(public)=150ms  PASS
  schedule.ics (bare, whole agenda)         raw=   216.2ms  floor=   2.5ms  adjusted=   213.7ms  budget(public)=150ms  FAIL
      raw p95 216.2ms exceeds 150ms ceiling; adjusted p95 213.7ms exceeds public class budget 150ms
  plan progress (12 reviewers)              raw=    40.4ms  floor=   2.5ms  adjusted=    37.9ms  budget(read)=50ms  PASS
  contacts list (q=perf)                    raw=    24.6ms  floor=   2.5ms  adjusted=    22.1ms  budget(read)=50ms  PASS
  rating PUT                                raw=    22.8ms  floor=   2.5ms  adjusted=    20.3ms  budget(write)=100ms  PASS
  onboarding grid (800 speakers x 5 tasks)  raw=    28.9ms  floor=   2.5ms  adjusted=    26.4ms  budget(read)=50ms  PASS
  reviewer queue                            raw=   112.6ms  floor=   2.5ms  adjusted=   110.1ms  budget(read)=50ms  FAIL
      adjusted p95 110.1ms exceeds read class budget 50ms
  email log list (page 1)                   raw=    29.8ms  floor=   2.5ms  adjusted=    27.3ms  budget(read)=50ms  PASS
  files library (page 1)                    raw=    22.3ms  floor=   2.5ms  adjusted=    19.8ms  budget(read)=50ms  PASS
  plan results (page 1)                     raw=    91.9ms  floor=   2.5ms  adjusted=    89.4ms  budget(read)=50ms  FAIL
      adjusted p95 89.4ms exceeds read class budget 50ms

perf:smoke FAILED — at least one check exceeded its raw ceiling or class budget
```

## Variance across 4 back-to-back runs (same seed, same server process)

| check | run1 raw p95 | run2 raw p95 | run3 raw p95 | run4 raw p95 | verdict |
|---|---|---|---|---|---|
| schedule.ics (bare, whole agenda) | 216.2ms FAIL | 101.4ms PASS | 105.5ms PASS | 79.9ms PASS | borderline/noisy |
| reviewer queue | 112.6ms FAIL | 24.7ms PASS | 24.4ms PASS | 23.4ms PASS | borderline/noisy |
| plan results (page 1) | 91.9ms FAIL | 37.0ms PASS | 53.9ms FAIL | 36.8ms PASS | borderline/noisy |
| everything else | PASS | PASS | PASS | PASS | stable |

Exit codes across the 4 runs: FAIL, PASS, FAIL, PASS.

## Per-endpoint grading against scripts/perf-smoke-lib.ts:19-21 and SPEC.md:331-335

18 of 21 checks are comfortably under budget on every run (read <50ms adjusted,
write <100ms adjusted, public <150ms raw, all with wide margin). Three checks
are borderline — they PASS on the majority of runs but FAIL under host
contention, which per SPEC.md:331-332 ("an over-budget route is a bug, not a
tuning opportunity") means they have no safety margin and should be treated
as findings, not dismissed as pure noise:

1. **`schedule.ics (bare, whole agenda)`** — `src/routes/public/index.tsx:197`
   (handler), calling `getPublicAgenda` in
   `src/server/repo/public/agenda.ts:29`. Class: **waterfall** — the handler
   does 3 sequential awaited queries (scheduleSlot scan, then room lookup,
   then `hydrateSessions`) with no batching between them, and unlike
   `agenda.ics` (`src/routes/public/index.tsx:234`, same `getPublicAgenda`
   call, consistently 3.7-11.1ms across all 4 runs) it showed 4-20x higher
   and far noisier latency for an identical code path and dataset size. The
   two routes sharing the same repo call but diverging this much on timing
   is itself the finding: either `schedule.ics`'s response-body assembly
   (`buildIcsCalendar`/`agendaIcsEvents`, invoked identically by both
   routes) is not actually identical cost on this path, or there is
   response-size/GC pressure specific to this handler's route registration
   order. Recommend the next perf lane isolate `schedule.ics` from
   `agenda.ics` with a repeated back-to-back A/B rather than accept "host
   noise" as the full explanation, since 216ms >> the 11ms sibling reading.

2. **`reviewer queue`** — `src/routes/review/reviewer.ts:50`, calling
   `resolveReviewerSubmissions` in
   `src/server/repo/review/submissions.ts:110-119`. Class: **oversized
   payload / full-scan-per-request** — `resolveReviewerSubmissions` loads
   ALL of `listPlanFilteredSubmissions(db, plan)` (every plan-scoped
   submission) plus every plan_reviewer row, then runs
   `resolveAssignments(all, reviewerRows)` in JS to recompute the round-robin
   assignment for all 12 reviewers on every single reviewer's queue request,
   rather than a query scoped to the one requesting reviewer. At 300
   plan-scoped submissions x 12 reviewers this is cheap most of the time
   (23-25ms) but spiked to 112.6ms under contention — recomputing the whole
   plan's assignment table per request has no per-reviewer scoping to fall
   back on when the DB is momentarily slow.

3. **`plan results (page 1)`** — `src/routes/review/plans.ts:290`, calling
   `buildResults` in `src/routes/review/shared.ts:251`. Class: **oversized
   payload / full-scan-per-request** — `buildResults` loads
   `listPlanFilteredSubmissions` (up to 2,000 submissions) and
   `listEvaluationsForPlan` (up to 6,000 evaluation rows for the round) in
   full, aggregates every submission's scores in JS, and only *then* is the
   result sliced by page/perPage server-side. The route claims to be a
   paginated `page=1&perPage=50` read but the actual per-request DB+CPU cost
   scales with the whole plan (2,000 submissions/6,000 evaluations), not with
   the 50-row page returned — this is the textbook "oversized payload,"
   not a tuning opportunity: 36-92ms observed, FAILed outright on 1 of 4
   runs and was the second-highest of the three borderline checks even on
   PASS runs.

None of the above required a source change (DEC-419, log-only) — flagged for
a following implementation lane.

## Edge-cache / Smart Placement — STAGE-2-only, no number reported

Per SPEC.md:59-62, production edge-cache and Smart Placement behavior is
explicitly deferred to stage 2. Miniflare's local `wrangler dev` has no
Cloudflare edge in front of it — every request in this harness terminates
directly at the local Workers runtime, so there is no true edge-cache-hit
TTFB to measure and no Smart Placement routing to observe. Both rows are
marked **STAGE-2-only** rather than backfilled with a Miniflare number that
would misrepresent production edge behavior.

| surface | status |
|---|---|
| true edge-cache-hit TTFB | STAGE-2-only — no Cloudflare edge under Miniflare |
| Smart Placement | STAGE-2-only — no Smart Placement routing under Miniflare |

## DEC-432 sibling-lane baseline pair (before fix, for the next wave's before/after)

Not part of `scripts/perf-smoke.ts`'s check list; measured with a standalone,
throwaway script (not committed to the repo) using the same
5-warmup/30-measured/p95/overhead-floor methodology, against the same 2k
perf seed, on the same running server:

- `GET /api/v1/contacts/stats` (`src/server/repo/contacts/stats.ts`, route
  registered at `src/routes/api/contacts/crud.ts:113`), authenticated as the
  perf-seeded organizer (800 contacts): raw p95 17.5-22.1ms across 3 runs,
  overhead-adjusted 11.5-16.1ms — comfortably PASSes the 50ms read budget at
  this scale. `getContactStats`'s `returningSpeakers` computation currently
  loads one row per (contact, distinct-event-count) pair via a
  `GROUP BY contact.id` join and counts client-side how many have
  `eventCount > 1` (`src/server/repo/contacts/stats.ts:29-40`) — DEC-432's
  fix moves this to a SQL `GROUP BY`/`HAVING` — but at the perf seed's scale
  (800 contacts, 1 event) this doesn't yet show up as a budget miss; it is a
  correctness/scale-ceiling concern in front of a still-fast reading, not an
  observed regression today.
- `GET /portal` (`src/server/repo/portal.ts` `getMyResources`,
  `src/server/repo/portal.ts:682-714`), authenticated as a speaker (contact
  `seed_perf_contact_0001`, participant in 3 of the 2,000 perf submissions,
  one accepted): raw p95 22.8-48.8ms across 3 runs, overhead-adjusted
  16.8-42.8ms — PASSes but noisy, consistent with the other borderline
  checks' host-contention pattern above. `getMyResources` loads every
  `resource` row for the WHOLE ORG's events (`src/server/repo/portal.ts:686-699`,
  a `resource` JOIN `event` WHERE `event.orgId = orgId`, no `contactId`/
  `eventIds` scoping in SQL) and only filters down to the speaker's own
  event(s) in JS afterward (`.filter((r) => eventIds.includes(r.eventId))`,
  line 701) — an org-wide unscoped read, the shape DEC-432's `inArray` +
  `chunkIds` fix targets. The perf seed doesn't populate `resource` rows at
  scale, so this reading doesn't yet demonstrate a budget miss either; it is
  the "before" number for the next wave's before/after pair, not a passing
  grade on the query shape.

Speaker session for the `GET /portal` measurement was created by inserting a
`user` (role `speaker`, `contactId = seed_perf_contact_0001`) and matching
`auth_session` row directly into the local D1 database (same mechanism
`scripts/perf-seed.ts` itself uses to write rows — a data insert, not a
source-file change) since the perf seed does not create a speaker login for
any of its 800 contacts; both rows were deleted again after measurement.

## Open items

1. `schedule.ics` (bare, whole-agenda) shows a large, unexplained latency gap
   vs. its `agenda.ics` sibling on the identical `getPublicAgenda` code path
   — needs an isolated A/B, not just chalked up to host noise.
2. `reviewer queue` recomputes the whole plan's reviewer assignment table
   per request instead of a per-reviewer-scoped query (waterfall/full-scan).
3. `plan results` loads the full plan's submissions+evaluations and
   aggregates in JS before paging server-side (oversized payload/full-scan);
   both this and (2) share the same "compute-everything-then-slice" shape.

OPEN ITEMS: 3
RESULT: FAIL
