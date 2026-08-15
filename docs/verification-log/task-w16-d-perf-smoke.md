# task-w16-d: perf-smoke gate at current tip (2k-row seed, SPEC §7)

- Port: **8873** (pinned per task instructions; never 8871, which task-w16-c
  used — DEC-060's wave-16 amendment exists because a prior run measured the
  wrong worktree's server).
- Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w16-d`
- `git rev-parse HEAD` (base commit before this task's harness repairs):
  `c557cff9f0e5bcd68d0d7815956d83a94eb9dc4e`

## Procedure run

1. `npm run build` — PASS (tsc --noEmit x2 + vite build, no errors).
2. `npm run db:migrate` — PASS, all 38 migrations applied to a fresh local D1.
3. `npm run seed` (demo/base seed — required first: `perf:seed`'s organizer
   login credentials and org come from `docs/fixtures/sample-data.json`,
   which only the base seed writes) — PASS.
4. `npm run perf:seed` (default profile, 2,000 submissions) — PASS after a
   harness repair (see below).
5. `npm run perf:seed:aie` (DEC-644 AIE profile, 2,500 submissions) — PASS
   after harness repairs (see below). **The harness supports the AIE
   profile end-to-end as of this task.**
6. `npx wrangler dev --port 8873` (background) — started clean, `/health`
   200 within a few seconds.
7. `PERF_URL=http://localhost:8873 npm run perf:smoke` (default profile) —
   ran to completion; **4 checks FAIL** (see table).
8. `PERF_URL=http://localhost:8873 npm run perf:smoke:aie` (AIE profile) —
   ran to completion; **2 checks FAIL** (see table).
9. `npm run bundle:check` — PASS.

**Gate note (important, read before re-running):** `npm run perf:seed` and
`npm run perf:seed:aie` share the same D1 and both delete-then-reinsert every
`seed_perf_`-prefixed row before writing their own — running one WIPES the
other's rows. To re-verify both profiles you must reseed+retest them one at
a time in the same order as above (default first, then aie), never
concurrently, and never assume both are present in the DB at once.

## Harness repairs made (scripts/ only, per task's repair scope; product code untouched)

All three repairs are in `scripts/perf-seed.ts` and `scripts/perf-smoke.ts`.
None change `default`-profile output except repair 1 below (which was
already silently broken for `default` too — see below).

1. **`scripts/perf-seed.ts`, file-row insert (`version_no` missing).** The
   `file` table's `version_no` column (migration `0025_file_version_no.sql`,
   DEC-818: "version_no is set at INSERT time... from this migration
   forward") was never set by the perf seeder's `file` INSERT — every
   perf-seeded file row had `version_no = NULL`. This tripped
   `src/server/repo/exports/showflow.ts`'s fail-loudly guard
   (`latestDeckBySubmission: file ... has no stored version_no — data
   corruption`), 500ing `GET .../exports/showflow.csv` for **both**
   profiles (confirmed broken on `default` before the fix, not just
   `aie`). Fix: set `version_no: spec.versionIndex + 1` (0-based
   `versionIndex` within each file's own chain, matching migration 0025's
   backfill formula root=1/successor=predecessor+1).

2. **`scripts/perf-smoke.ts`, DEC-089/DEC-080 cap probe (300-id literal
   hardcoded).** The one-shot untimed "301 ids on schedule.ics -> 400"
   assertion fetched exactly 300 real accepted-submission ids
   unconditionally; `aie` only has 250 accepted submissions, so the fetch
   threw before the assertion ran. Fix: fetch
   `min(300, PERF_PROFILE.statusCounts.accepted)` real ids and pad the
   remainder with synthetic nonexistent ids up to 301 total (the existing
   code comment already established that a nonexistent id still exercises
   the cap predicate correctly, since the length check fires before
   hydration).

3. **`scripts/perf-smoke.ts`, DEC-105 export min-line literals (2001 / 301
   hardcoded to `default`'s scale).** `assertMinCsvLines` calls for
   `export/submissions` and `exports/showflow.csv` hardcoded `2001` and
   `301` (the `default` profile's submissionCount+1 / accepted+1). Fix:
   derive both from `PERF_PROFILE.submissionCount + 1` and
   `(PERF_PROFILE.statusCounts.accepted ?? 0) + 1` so `aie` (2,500 subs /
   250 accepted) is graded against its own scale.

4. **`scripts/perf-seed.ts`, task_assignment contact selection (speaker/
   assignee window mismatch).** The onboarding grid
   (`GET .../onboarding`, `src/routes/tasks.ts`) only lists contacts with a
   participant row (i.e. real speakers on accepted submissions). The perf
   seeder assigned `task_assignment` rows to the raw contact-pool head
   (`contactIds[0..contactsPerTaskCount-1]`), which for `default`
   (`contactsPerTaskCount` = 800 = the full contact pool) happens to fully
   overlap the speaker window, but for `aie` (`contactsPerTaskCount` = 80
   out of a 6,000-contact pool, speaker window a disjoint 250-wide slice at
   index ~1875-2124) has **zero overlap** — every one of the 400 seeded
   `aie` assignments was invisible to the onboarding grid (`GET
   .../onboarding` always returned `cells: []` for every row; `total: 0`
   when searched by any of the assigned contacts' emails). Fix: draw
   assignment contacts from `acceptedContactIds` (the real speaker pool)
   whenever it's large enough to cover `contactsPerTaskCount` without
   reuse; `default` (800 > 300) falls through unchanged to the original
   pool-head selection, so `default`'s seed output is bit-for-bit
   unchanged. This is a seed-only structural fix, not a product-code
   change — no file under `src/` was touched.

No product code was modified. Every product-side gap found (the 4 FAIL
rows below) is recorded as a finding for the next wave, not repaired here.

## Timed checks (default profile, p95 over 30 iterations, overhead floor 2.9ms, raw ceiling 150ms)

Budgets per SPEC §7: admin API reads p95 < 50ms, writes p95 < 100ms,
uncached public SSR < 150ms (graded on the overhead-adjusted p95; raw p95
additionally capped at 150ms per DEC-309/PERF_P95_BUDGET_MS).

| Check | Class | Raw p95 (ms) | Adjusted p95 (ms) | Budget (ms) | Verdict |
|---|---|---|---|---|---|
| submissions list (page 1) | read | 15.4 | 12.5 | 50 | PASS |
| submissions list (q=Kubernetes) | read | 21.6 | 18.8 | 50 | PASS |
| submission detail | read | 26.6 | 23.7 | 50 | PASS |
| event overview | read | 30.8 | 28.0 | 50 | PASS |
| organizer agenda (300 accepted) | read | 23.1 | 20.2 | 50 | PASS |
| public sessions page | public | 9.3 | 6.5 | 150 | PASS |
| public agenda | public | 8.8 | 6.0 | 150 | PASS |
| schedule.ics 150 ids | public | 52.1 | 49.2 | 150 | PASS |
| public speakers page | public | 7.7 | 4.9 | 150 | PASS |
| public speakers page at row ceiling | public | 12.7 | 9.8 | 150 | PASS |
| public speakers deepest page | public | 14.8 | 11.9 | 150 | PASS |
| public sessions deepest rows | public | 11.8 | 8.9 | 150 | PASS |
| public gallery page | public | 17.7 | 14.9 | 150 | PASS |
| public schedule page | public | 9.2 | 6.4 | 150 | PASS |
| public programme (whole agenda) | public | 7.1 | 4.3 | 150 | PASS |
| home hub (anonymous) | public | 11.2 | 8.3 | 150 | PASS |
| agenda.ics | public | 4.1 | 1.2 | 150 | PASS |
| schedule.ics (bare, whole agenda) | public | 5.8 | 3.0 | 150 | PASS |
| contacts list (q=perf) | read | 6.3 | 3.4 | 50 | PASS |
| rating PUT | write | 13.7 | 10.8 | 100 | PASS |
| contacts duplicates | read | 9.6 | 6.7 | 50 | PASS |
| **onboarding grid (800 speakers x 5 tasks)** | read | 115.3 | 112.5 | 50 | **FAIL** |
| **reviewer queue** | read | 72.9 | 70.0 | 50 | **FAIL** |
| email log list (page 1) | read | 6.9 | 4.1 | 50 | PASS |
| **files library (page 1)** | read | 513.7 | 510.8 | 50 | **FAIL (also over raw 150ms ceiling)** |
| **plan results (page 1)** | read | 77.3 | 74.5 | 50 | **FAIL** |
| pipeline list (page 1) | read | 10.8 | 8.0 | 50 | PASS |
| org users list (page 1) | read | 8.7 | 5.8 | 50 | PASS |
| contacts bulk-email preview (50 recipients) | write | 9.8 | 6.9 | 100 | PASS |
| onboarding remind preview (all outstanding) | write | 31.4 | 28.5 | 100 | PASS |
| submission PATCH (description edit) | write | 22.3 | 19.4 | 100 | PASS |
| pipeline stage move | write | 15.5 | 12.6 | 100 | PASS |
| bulk status change | write | 48.5 | 45.7 | 100 | PASS |
| schedule slot PUT | write | 30.5 | 27.7 | 100 | PASS |
| task assignment check-off | write | 9.7 | 6.8 | 100 | PASS |

## Timed checks (AIE profile, p95 over 30 iterations, overhead floor 3.0ms, raw ceiling 150ms)

`rating PUT` / `reviewer queue` / `plan results (page 1)` are SKIPPED on this
profile per the harness's existing DEC-644 gate (PERF_PLAN_ID/
PERF_REVIEWER_EMAIL are `default`-profile-only fixtures today).

| Check | Class | Raw p95 (ms) | Adjusted p95 (ms) | Budget (ms) | Verdict |
|---|---|---|---|---|---|
| submissions list (page 1) | read | 17.0 | 14.0 | 50 | PASS |
| submissions list (q=Kubernetes) | read | 23.3 | 20.3 | 50 | PASS |
| submission detail | read | 31.3 | 28.3 | 50 | PASS |
| event overview | read | 27.7 | 24.6 | 50 | PASS |
| organizer agenda (300 accepted) | read | 21.3 | 18.3 | 50 | PASS |
| public sessions page | public | 8.5 | 5.4 | 150 | PASS |
| public agenda | public | 9.3 | 6.2 | 150 | PASS |
| schedule.ics 150 ids | public | 39.4 | 36.3 | 150 | PASS |
| public speakers page | public | 7.6 | 4.5 | 150 | PASS |
| public speakers page at row ceiling | public | 13.2 | 10.2 | 150 | PASS |
| public speakers deepest page | public | 11.9 | 8.9 | 150 | PASS |
| public sessions deepest rows | public | 11.3 | 8.3 | 150 | PASS |
| public gallery page | public | 8.5 | 5.4 | 150 | PASS |
| public schedule page | public | 9.9 | 6.8 | 150 | PASS |
| public programme (whole agenda) | public | 8.1 | 5.1 | 150 | PASS |
| home hub (anonymous) | public | 12.3 | 9.3 | 150 | PASS |
| agenda.ics | public | 5.4 | 2.3 | 150 | PASS |
| schedule.ics (bare, whole agenda) | public | 6.9 | 3.9 | 150 | PASS |
| contacts list (q=perf) | read | 10.6 | 7.6 | 50 | PASS |
| contacts duplicates | read | 30.2 | 27.2 | 50 | PASS |
| **onboarding grid (800 speakers x 5 tasks)** | read | 1080.2 | 1077.2 | 50 | **FAIL (also over raw 150ms ceiling)** |
| email log list (page 1) | read | 12.1 | 9.1 | 50 | PASS |
| **files library (page 1)** | read | 374.8 | 371.7 | 50 | **FAIL (also over raw 150ms ceiling)** |
| pipeline list (page 1) | read | 10.4 | 7.4 | 50 | PASS |
| org users list (page 1) | read | 7.4 | 4.4 | 50 | PASS |
| contacts bulk-email preview (50 recipients) | write | 10.9 | 7.9 | 100 | PASS |
| onboarding remind preview (all outstanding) | write | 20.4 | 17.4 | 100 | PASS |
| submission PATCH (description edit) | write | 21.7 | 18.7 | 100 | PASS |
| pipeline stage move | write | 12.2 | 9.1 | 100 | PASS |
| bulk status change | write | 53.9 | 50.9 | 100 | PASS |
| schedule slot PUT | write | 22.2 | 19.1 | 100 | PASS |
| task assignment check-off | write | 10.0 | 7.0 | 100 | PASS |

## Untimed DEC-105 export min-line probes

| Probe | Profile | Result | Budget | Verdict |
|---|---|---|---|---|
| submissions CSV line count | default | 2001 lines (2000 rows + header) | >= 2001 | PASS |
| showflow.csv line count | default | 301 lines (300 rows + header) | >= 301 | PASS |
| submissions CSV line count | aie | 2501 lines (2500 rows + header) | >= 2501 (profile-derived; see repair 3) | PASS |
| showflow.csv line count | aie | 251 lines (250 rows + header) | >= 251 (profile-derived; see repair 3) | PASS |

Both required 500 to be fixed first (harness repair 1 above) — before that
fix, both profiles' showflow.csv 500ed unconditionally.

## Untimed DEC-089/DEC-080 cap probe (301 ids -> 400)

| Profile | Result |
|---|---|
| default | 400 (PASS) |
| aie | 400 (PASS, after harness repair 2 above) |

## Bundle check (SPEC §7: initial SPA bundle < 300KB gz)

`npm run bundle:check`: entry bundle (`index-*.js` + `index-*.css`) =
**69.13 kB gzip**, budget 300.00 kB. **PASS.**

## FAIL summary — bugs for the next wave (product code, not touched here)

Per SPEC §7, a route over budget is a bug. Recording route, measured value,
and a suspected query shape; no product-code changes were made in this task
(repair scope was harness-only).

1. **`GET /api/v1/events/:eventId/onboarding`** ("onboarding grid") —
   default: adjusted p95 112.5ms (budget 50ms); aie: adjusted p95 1077.2ms,
   raw p95 1080.2ms (also over the unconditional 150ms raw ceiling). The aie
   number (2,500 submissions / 6,000 contacts / 750 grid rows) is
   dramatically worse than default's (2,000 subs / 800 contacts, 112.5ms),
   suggesting an N+1 or per-row subquery over the (task x contact) cell
   matrix that scales with contact-pool size or grid-row count rather than
   being bounded by the page size — `src/routes/tasks.ts`'s `getOnboardingGrid`
   is the likely site to check first (does it batch-fetch task_assignment
   rows for the whole page in one query, or loop per contact/task?).
2. **`GET /api/v1/review/plans/:planId/queue`** ("reviewer queue") —
   default only (aie profile skips this check per DEC-644): adjusted p95
   70.0ms (budget 50ms), moderately over. `src/routes/review.ts` (or
   equivalent reviewer-queue repo function) is the likely site — check
   whether it's paginated/bounded per reviewer or scans the full
   evaluation set.
3. **`GET /api/v1/events/:eventId/files`** ("files library") — default:
   adjusted p95 510.8ms, raw 513.7ms (also over the 150ms raw ceiling);
   aie: adjusted p95 371.7ms, raw 374.8ms (also over ceiling). Both
   profiles are dramatically over budget (roughly 10x), suggesting a
   structural issue independent of scale differences between profiles (not
   just an N-scaling problem) — likely a missing index or an unbounded join
   across `file`/`submission`/`participant`/`contact` per page rather than
   a properly paged query. `src/server/repo/...files...` (DEC-347's files
   library repo function) is the likely site.
4. **`GET /api/v1/plans/:planId/results`** ("plan results") — default only
   (aie skips per DEC-644): adjusted p95 74.5ms (budget 50ms), moderately
   over. Likely site: the results aggregation query in the evaluation/plan
   results repo function — check whether it aggregates per-reviewer scores
   in SQL (single query) or loops per submission/reviewer in application
   code.

Files library (3) is the most severe (~10x over on both profiles) and
should be looked at first.
