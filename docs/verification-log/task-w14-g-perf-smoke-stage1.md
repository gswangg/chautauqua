# task-w14-g — perf smoke at 2,000-row scale (SPEC.md:326-338)

Log-only task: no source changed. Sha under test: `0474bcf` (`merge
task-w14-e`, HEAD of `main` at the point this task's worktree was built —
this task adds only this log file, no other diff).

## Method

1. `npm run db:migrate` (18 local D1 migrations applied), `npm run seed`
   (base fixture + R2 objects), `npm run perf:seed` (2,000-submission /
   800-contact / 12-reviewer synthetic scale seed, `scripts/perf-seed.ts` +
   `scripts/perf-seed-lib.ts`, `PERF_EVENT_ID=seed_perf_event`,
   `PERF_EVENT_SLUG=perf-2k`).
2. `npm run predev && npx wrangler dev` against local D1/KV/R2 (Miniflare).
3. `npm run perf:smoke` (`scripts/perf-smoke.ts`) — 5 warmup + 30 measured
   iterations per check, graded against `PERF_CLASS_BUDGET_MS`
   (`scripts/perf-smoke-lib.ts:19-21`: read 50ms / write 100ms / public
   150ms) with the harness's own overhead-floor adjustment
   (`adjustedP95(rawP95, floor)`, floor = p50 of 30 `GET /health` timings).
4. A scratch harness (not committed — lived only in the session scratchpad
   directory, never under the repo, reusing `scripts/perf-smoke-lib.ts`'s
   `computeP95`/`computePercentile`/`adjustedP95` unmodified) timed the
   four DEC-432/DEC-433 endpoints this task names by name, since
   `scripts/perf-smoke.ts` doesn't check any of them individually (item 2
   below). One extra local D1 row was inserted directly via `wrangler d1
   execute --local` (a `speaker`-role `user` row for seeded contact
   `seed_perf_contact_0001`, needed to log in to the portal and exercise
   `getMyResources`, since `perf-seed.ts` seeds password credentials only
   for the organizer and the 12 reviewers, not for any speaker/contact) —
   this is local D1 test fixture data only, not a source change, and lives
   in `.wrangler/` (gitignored, not committed).

Note: mid-task the worktree directory was found emptied (external
worktree/branch state under contention with other in-flight lanes) after
the first full run; it was recreated from the `task-w14-g` branch tip
(still at `main`'s HEAD, no orphaned commits lost) and every measurement
below is from the re-run against that fresh worktree, not the discarded
first pass.

## 1. `scripts/perf:smoke` full run — p95 per endpoint

Overhead floor measured at 2.7ms (p50 of 30 `GET /health` timings). All 21
checks PASS, both on the raw ceiling (150ms) and their class budget.

| endpoint | class | raw p95 | adjusted p95 | budget | result |
|---|---|---:|---:|---:|---|
| submissions list (page 1) | read | 8.2ms | 5.6ms | 50ms | PASS |
| submissions list (q=Kubernetes) | read | 12.5ms | 9.9ms | 50ms | PASS |
| submission detail | read | 13.8ms | 11.1ms | 50ms | PASS |
| event overview | read | 19.2ms | 16.6ms | 50ms | PASS |
| organizer agenda (300 accepted) | read | 18.4ms | 15.7ms | 50ms | PASS |
| public sessions page | public | 3.9ms | 1.2ms | 150ms | PASS |
| public agenda | public | 6.0ms | 3.3ms | 150ms | PASS |
| schedule.ics 150 ids | public | 45.1ms | 42.5ms | 150ms | PASS |
| public speakers page | public | 3.1ms | 0.5ms | 150ms | PASS |
| public gallery page | public | 4.1ms | 1.4ms | 150ms | PASS |
| public schedule page | public | 6.6ms | 3.9ms | 150ms | PASS |
| agenda.ics | public | 6.6ms | 4.0ms | 150ms | PASS |
| schedule.ics (bare, whole agenda) | public | 80.2ms | 77.5ms | 150ms | PASS |
| plan progress (12 reviewers) | read | 20.9ms | 18.2ms | 50ms | PASS |
| contacts list (q=perf) | read | 5.3ms | 2.6ms | 50ms | PASS |
| rating PUT | write | 12.9ms | 10.2ms | 100ms | PASS |
| onboarding grid (800 speakers x 5 tasks) | read | 11.6ms | 9.0ms | 50ms | PASS |
| reviewer queue | read | 21.0ms | 18.4ms | 50ms | PASS |
| email log list (page 1) | read | 14.0ms | 11.4ms | 50ms | PASS |
| files library (page 1) | read | 8.4ms | 5.7ms | 50ms | PASS |
| plan results (page 1) | read | 33.2ms | 30.5ms | 50ms | PASS |

Plus two untimed one-shot assertions, both passed: DEC-080's 301-id
`schedule.ics` cap (400), and DEC-105's CSV export size floors (submissions
CSV >= 2,001 lines, showflow CSV >= 301 lines).

`schedule.ics (bare, whole agenda)` is the closest to its budget (77.5ms
adjusted of 150ms, ~52%) but still comfortably passes — worth watching if
the perf seed's accepted/scheduled count grows in a future wave.

## 2. The four DEC-432/DEC-433 reads, by name and with numbers

Measured with the scratch harness described above, same overhead floor
methodology (this run's floor: 2.3ms), 5 warmup + 30 measured iterations.

| endpoint | status | raw p95 | adjusted p95 |
|---|---:|---:|---:|
| `getMyResources` (`GET /portal/resources`, `src/server/repo/portal.ts:683`) | 200 | 15.7ms | 13.4ms |
| `getContactStats` (`GET /api/v1/contacts/stats`, `src/server/repo/contacts/stats.ts:16`) | 200 | 7.1ms | 4.8ms |
| `getPublicSessions` `?page=1` (default) (`GET /e/perf-2k/sessions?page=1`) | 200 | 7.7ms | 5.4ms |
| `getPublicSessions` `?page=50&limit=100` (hostile) | 200 | 5.9ms | 3.6ms |
| `getPublicSpeakers` `?page=1` (default) (`GET /e/perf-2k/speakers?page=1`) | 200 | 7.1ms | 4.7ms |
| `getPublicSpeakers` `?page=50&limit=100` (hostile) | 200 | 4.5ms | 2.2ms |

All classify as `read`/`public` budgets (50ms/150ms respectively) and pass
comfortably at this scale.

**`getMyResources` (`src/server/repo/portal.ts:683-719`, DEC-432): the
inArray/chunkIds rewrite HAS landed.** Confirmed by reading the current
source, not inferred from timing: the function batches `eventIds` through
`chunkIds()` and pushes the scope into the SQL `WHERE` via
`inArray(schema.resource.eventId, batch)` joined to `schema.event` filtered
on `orgId`, then re-sorts the unioned rows by `position` in JS to restore
cross-chunk ordering — it is no longer a `rows.filter(...)` pass over every
org resource. The perf-seeded speaker used for this check belongs to only
one event (`seed_perf_event`), so this particular run exercises a
single-chunk, single-batch call and doesn't stress multi-event chunking;
the 13.4ms adjusted p95 reflects that shape, not a multi-hundred-event
worst case.

**`getContactStats` (`src/server/repo/contacts/stats.ts:16-56`, DEC-432):
the rewrite HAS landed.** The "returning speakers" count is now a single
`count(*)` over a `GROUP BY contact.id HAVING count(distinct
submission.eventId) > 1` subquery (aliased `returning_contacts`) rather
than pulling one row per contact into JS and filtering there; no
per-contact rows cross the wire for that KPI. Measured against the
800-contact perf pool, 4.8ms adjusted p95.

**`getPublicSessions` / `getPublicSpeakers` (DEC-433): the clamp HAS
landed as of this sha** — `src/routes/public/query.ts:10-15`'s `parsePage`
now clamps to `[1, MAX_PUBLIC_PAGE=50]` (out-of-range clamps down to the
cap, matching the decision doc's "stays useful" requirement rather than
resetting to 1), and both `src/server/repo/public/sessions.ts:326`
(`getPublicSessions`) and `src/server/repo/public/speakers.ts:68`
(`getPublicSpeakers`) now compute their SQL `LIMIT` via
`boundedRowLimit(page, perPage)` (`src/server/repo/public/bounds.ts`),
`min(page*perPage, MAX_PUBLIC_ROWS=600)`, which also throws on a
non-finite/non-positive-integer argument per the decision. The hostile
`?page=50&limit=100` probe (nominal, pre-cap `page*perPage = 5000`) is
now demonstrably bounded in practice: it measured *faster* than the
default `?page=1` probe for both endpoints (sessions: 3.6ms adjusted vs
5.4ms for page=1; speakers: 2.2ms adjusted vs 4.7ms for page=1) — the
`LIMIT` is capped to 600 rows rather than growing with `page*perPage`, so
the "hostile" request does no more DB work than a bounded read, matching
DEC-433's intent. (The earlier, discarded first pass against a pre-DEC-433
sha had measured the hostile sessions query at 23.4ms adjusted before this
clamp existed — consistent with the fix actually doing something, not just
a decision doc with no code behind it.)

## 3. Deferred rows — STAGE-2

| row | status | reason |
|---|---|---|
| edge-cache-hit TTFB | STAGE-2 | Miniflare (this harness's `wrangler dev` runtime) has no Cloudflare edge cache — there is no `cf.cacheEverything`/edge PoP to hit, so there is no TTFB to measure for a *cache hit* specifically (as opposed to the uncached-SSR numbers already reported above). SPEC.md:59-62 explicitly defers production cache/CDN validation to deployment. No number is reported here rather than substituting an uncached or guessed figure. |
| Smart Placement | STAGE-2 | Same root cause: Smart Placement is a Cloudflare Workers production routing feature with no Miniflare/local-dev equivalent to measure against. Not exercised, not guessed. |

## 4. Bottom line

No endpoint measured today exceeds its class budget or the raw ceiling —
neither the 21 checks in `scripts/perf-smoke.ts`'s standing suite nor the
four DEC-432/DEC-433 endpoints named by this task. All four named reads
confirm their decision's code-side fix is present and doing real work
(`getMyResources`/`getContactStats` no longer pull unbounded rows into JS;
`getPublicSessions`/`getPublicSpeakers` cap their SQL `LIMIT` regardless of
`?page=`/`?limit=` input). Nothing in this run requires a source fix or
flags an unowned gap.
