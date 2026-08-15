# task-w17-b: perf-smoke gate at current tip (DEC-086/DEC-089/DEC-069 amendment)

Owner: task-w17-b (own port 8873 exclusively). Ran entirely LOCAL against
`npx wrangler dev --port 8873`, D1 local sqlite.

Tip: `main` at worktree creation = `5fc3db38a9bb1f7a1f29ca6374cb17c519c8fbe5`
("scribe wave 17"). All work committed on top of this tip on branch
`task-w17-b`.

## RESULT: FAIL (both profiles) — real product perf regressions found, not harness artifacts

## Harness repair performed (scope: scripts/perf-seed.ts, scripts/perf-smoke.ts — my own harness)

This gate had never run to completion before (task-w16-d's ref pointed at
main's own parent, zero commits). Getting it to run at all surfaced three
harness bugs, all fixed in this branch:

1. **scripts/perf-seed.ts never set `file.version_no`.** Every DEC-818
   writer must stamp `version_no` at INSERT time (migration
   0025_file_version_no.sql; the backfill CTE only ran once, historically).
   perf-seed.ts's deliverable-file-chain insert (DEC-347) omitted the
   column entirely, so `GET .../exports/showflow.csv` 500'd immediately
   with `latestDeckBySubmission: file seed_perf_file_0003 has no stored
   version_no — data corruption`. Fixed: `version_no: spec.versionIndex + 1`
   (spec.versionIndex is already the 0-based per-chain position used to
   build the `v${versionIndex + 1}` filename).

2. **scripts/perf-smoke.ts's DEC-080/DEC-089 cap assertion and DEC-105 CSV
   size probes were hardcoded to the `default` profile's exact scale**
   (300 accepted / 2000 submissions), not resolved from `PERF_PROFILE` like
   the rest of the file (DEC-644/645 pattern). `--profile=aie` only seeds
   250 accepted submissions, so `fetchAcceptedSubmissionIds(headers, 300)`
   threw before the aie run ever reached the timed loop. Fixed: the cap
   probe now fetches `min(accepted, MAX_ITINERARY_IDS)` real ids and pads
   the remainder to `MAX_ITINERARY_IDS + 1` with synthetic nonexistent ids
   (the route's raw-length check fires before hydration per the existing
   DEC-094 comment, so this is still an exact test of the DEC-080 cap, not
   a weakened one); the two CSV line-count assertions now use
   `PERF_PROFILE.submissionCount + 1` / `capAcceptedCount + 1` instead of
   the literals `2001` / `301`.

3. **scripts/perf-seed.ts's task_assignment seeding had zero overlap with
   accepted-submission speakers under the `aie` profile.** Assignments were
   always drawn from `contactIds[0..contactsPerTaskCount)`, the front of
   the full contact pool in generation order. For `default`,
   `contactsPerTaskCount == PERF_CONTACT_COUNT` (800 of 800), so this
   trivially includes every accepted speaker too — coincidentally correct.
   For `aie`, `contactsPerTaskCount` is only 80 of 6000, and the accepted
   submissions (indices 1875–2124 of 2500) map to a disjoint contact-index
   range never touched by that front slice — the onboarding grid's
   accepted-speaker predicate matched **zero** rows, so
   `GET .../onboarding?page=1&perPage=1` returned an empty page and the
   "task assignment check-off" write check had no row to act on. Fixed:
   introduced `taskAssignmentContactIds`, which is `contactIds` unchanged
   whenever `contactsPerTaskCount >= PERF_CONTACT_COUNT` (default's exact
   historical branch, bit-for-bit preserved — verified by re-running
   `perf:smoke` on `default` before and after and confirming the same 4
   FAILs at matching magnitudes), and otherwise
   `[...new Set([...acceptedContactIds, ...contactIds])]` so the front
   slice is guaranteed to contain real accepted-speaker contacts.

Targeted tests after the fix: `npx vitest run test/perf-smoke.test.ts
test/perf-seed-lib.test.ts test/perf-seed.test.ts` — 160/160 passed.

Also required (not a harness bug, just an ordering fact recorded for the
next runner): `scripts/perf-smoke.ts` logs in as the **demo seed's**
organizer (`docs/fixtures/sample-data.json`'s `identities.organizer`), not
a perf-seeded user (`scripts/perf-seed.ts`'s own header comment: "on top of
the demo seed's ~19 users"). `npm run seed` must run before `npm run
perf:seed`, or login 401s. Also: `perf-seed.ts`'s idempotent-delete
prologue deletes **both** profiles' event-scoped rows on every run
(deliberate, DEC-645, so switching `--profile=` never orphans rows) — the
two profiles can never be seeded simultaneously, so `perf:smoke` must run
immediately after `perf:seed` (default) and `perf:smoke:aie` immediately
after a subsequent `perf:seed:aie`, not both smokes back-to-back off one
seed.

## Seeded row counts numbers were measured at

**default profile** (after `npm run seed && npm run perf:seed`):
- submissions: 2000 (event `seed_perf_event`)
- accepted: 300, contacts: 800, tracks: 8
- task_assignment: 4000 rows / 800 distinct contacts (all overlap accepted speakers)

**aie profile** (after `npm run seed && npm run perf:seed:aie` — reseeded,
replacing default's rows per the shared-namespace delete above):
- submissions: 2500 (event `seed_perf_aie_event`)
- accepted: 250, contacts: 6000, tracks: 20
- task_assignment: 400 rows / 80 distinct contacts (all now overlap accepted speakers, post-fix)

## Per-probe p50/p95 vs. SPEC §7 budget

SPEC §7: admin API reads p95 < 50ms, writes p95 < 100ms (server time);
public pages uncached SSR < 150ms. `scripts/perf-smoke-lib.ts` grades
against an overhead-adjusted number (raw minus a measured per-run overhead
floor) so localhost fetch overhead doesn't eat the budget, plus a 150ms
raw ceiling as a second, unadjusted check.

### default profile (`perf:smoke`, PERF_URL=http://localhost:8873)

| check | class | adjusted p95 | budget | result |
|---|---|---|---|---|
| submissions list (page 1) | read | 16.7ms | 50ms | PASS |
| submissions list (q=Kubernetes) | read | 17.3ms | 50ms | PASS |
| submission detail | read | 22.6ms | 50ms | PASS |
| event overview | read | 33.9ms | 50ms | PASS |
| organizer agenda (300 accepted) | read | 27.3ms | 50ms | PASS |
| public sessions page | public | 14.0ms | 150ms | PASS |
| public agenda | public | 12.2ms | 150ms | PASS |
| schedule.ics 150 ids | public | 59.6ms | 150ms | PASS |
| public speakers page | public | 10.5ms | 150ms | PASS |
| public speakers page at row ceiling | public | 16.5ms | 150ms | PASS |
| public speakers deepest page | public | 13.1ms | 150ms | PASS |
| public sessions deepest rows | public | 22.8ms | 150ms | PASS |
| public gallery page | public | 5.6ms | 150ms | PASS |
| public schedule page | public | 20.5ms | 150ms | PASS |
| public programme (whole agenda) | public | 5.4ms | 150ms | PASS |
| home hub (anonymous) | public | 12.6ms | 150ms | PASS |
| agenda.ics | public | 3.8ms | 150ms | PASS |
| schedule.ics (bare, whole agenda) | public | 2.6ms | 150ms | PASS |
| contacts list (q=perf) | read | 7.1ms | 50ms | PASS |
| rating PUT | write | 9.9ms | 100ms | PASS |
| contacts duplicates | read | 18.9ms | 50ms | PASS |
| **onboarding grid (800 speakers x 5 tasks)** | read | **156.4ms** (raw 159.4ms, over the 150ms raw ceiling too) | 50ms | **FAIL** |
| **reviewer queue** | read | **65.8ms** | 50ms | **FAIL** |
| email log list (page 1) | read | 6.8ms | 50ms | PASS |
| **files library (page 1)** | read | **486.3ms** (raw 489.4ms) | 50ms | **FAIL** |
| **plan results (page 1)** | read | **77.8ms** | 50ms | **FAIL** |
| pipeline list (page 1) | read | 8.5ms | 50ms | PASS |
| org users list (page 1) | read | 2.0ms | 50ms | PASS |
| contacts bulk-email preview (50 recipients) | write | 7.5ms | 100ms | PASS |
| onboarding remind preview (all outstanding) | write | 19.3ms | 100ms | PASS |
| submission PATCH (description edit) | write | 10.6ms | 100ms | PASS |
| pipeline stage move | write | 10.8ms | 100ms | PASS |
| bulk status change | write | 36.5ms | 100ms | PASS |
| schedule slot PUT | write | 17.2ms | 100ms | PASS |
| task assignment check-off | write | 4.1ms | 100ms | PASS |

DEC-080 cap assertion (301 ids -> 400): PASS. DEC-105 export probes
(submissions.csv >= 2001 lines, showflow.csv >= 301 lines): PASS.

### aie profile (`perf:smoke:aie`, PERF_URL=http://localhost:8873)

| check | class | adjusted p95 | budget | result |
|---|---|---|---|---|
| submissions list (page 1) | read | 27.1ms | 50ms | PASS |
| submissions list (q=Kubernetes) | read | 16.3ms | 50ms | PASS |
| submission detail | read | 20.2ms | 50ms | PASS |
| event overview | read | 23.0ms | 50ms | PASS |
| organizer agenda | read | 12.8ms | 50ms | PASS |
| public sessions page | public | 3.7ms | 150ms | PASS |
| public agenda | public | 5.5ms | 150ms | PASS |
| schedule.ics 150 ids | public | 31.6ms | 150ms | PASS |
| public speakers page | public | 4.0ms | 150ms | PASS |
| public speakers page at row ceiling | public | 8.1ms | 150ms | PASS |
| public speakers deepest page | public | 7.2ms | 150ms | PASS |
| public sessions deepest rows | public | 7.0ms | 150ms | PASS |
| public gallery page | public | 4.2ms | 150ms | PASS |
| public schedule page | public | 6.6ms | 150ms | PASS |
| public programme (whole agenda) | public | 3.7ms | 150ms | PASS |
| home hub (anonymous) | public | 15.1ms | 150ms | PASS |
| agenda.ics | public | 4.6ms | 150ms | PASS |
| schedule.ics (bare, whole agenda) | public | 1.2ms | 150ms | PASS |
| contacts list (q=perf) | read | 6.2ms | 50ms | PASS |
| contacts duplicates | read | 22.6ms | 50ms | PASS |
| **onboarding grid (80 assignable speakers x 5 tasks, 6000 contacts)** | read | **981.1ms** (raw 983.9ms, over the 150ms raw ceiling too) | 50ms | **FAIL — worse at aie scale than default (156ms -> 981ms)** |
| email log list (page 1) | read | 4.3ms | 50ms | PASS |
| **files library (page 1)** | read | **345.2ms** (raw 347.9ms) | 50ms | **FAIL — better than default's 486ms (fewer accepted: 250 vs 300) but still far over budget** |
| pipeline list (page 1) | read | 5.1ms | 50ms | PASS |
| org users list (page 1) | read | 2.2ms | 50ms | PASS |
| contacts bulk-email preview (50 recipients) | write | 4.0ms | 100ms | PASS |
| onboarding remind preview (all outstanding) | write | 16.3ms | 100ms | PASS |
| submission PATCH (description edit) | write | 13.6ms | 100ms | PASS |
| pipeline stage move | write | 7.4ms | 100ms | PASS |
| bulk status change | write | 39.0ms | 100ms | PASS |
| schedule slot PUT | write | 22.2ms | 100ms | PASS |
| task assignment check-off | write | 4.6ms | 100ms | PASS |

DEC-080 cap assertion (251 real + padding to 301 total -> 400): PASS.
DEC-105 export probes (submissions.csv >= 2501 lines, showflow.csv >= 251
lines): PASS.

SKIPPED (as-designed, DEC-644): rating PUT, reviewer queue, plan results
(page 1) — `PERF_PLAN_ID`/`PERF_REVIEWER_EMAIL` are `default`-profile-only
fixtures today; not run, not silently passed.

## OPEN ITEMS (product defects, out of this task's scope — recorded, not fixed)

- **Onboarding grid** (`GET /api/v1/events/:eventId/onboarding`): FAILs
  under both profiles, and gets **markedly worse, not better, at aie scale**
  despite fewer assignable speakers (80 vs 800) — adjusted p95 156ms
  (default) -> 981ms (aie). The route's query plan likely scales with the
  full contact/task cross-product or an unindexed join rather than the
  roster actually returned; worth a query-plan audit before the next perf
  wave. Route: `src/routes/tasks.ts:174-182`,
  `src/server/repo/tasks/grid.ts` (`getOnboardingGrid`).
- **Files library** (page 1): FAILs under both profiles at 5-10x budget
  (486ms default / 345ms aie). Route not identified further within this
  task's scope (perf-seed*/perf-smoke* only) — flagged for the owning
  route's next perf pass.
- **Reviewer queue**: FAILs under default (65.8ms vs 50ms budget) — only
  ~1.3x over, closest to budget of the four failures.
- **Plan results (page 1)**: FAILs under default (77.8ms vs 50ms budget).

All four FAILs are consistent with the pre-existing product code at this
tip (not introduced by this task's harness fixes) — the default-profile
FAIL set and magnitudes were re-verified unchanged after fixing the
task_assignment contact-overlap bug in perf-seed.ts (fix #3 above was
scoped to only branch for non-default profiles).

## Commands run (for reproduction)

```
npx tsx scripts/ensure-dev-vars.ts
npx vite build --config app/vite.config.ts
npm run db:migrate
npm run seed                    # demo seed — perf-smoke.ts logs in as its organizer
npm run perf:seed               # default profile volume seed
npx wrangler dev --port 8873 &
PERF_URL=http://localhost:8873 npm run perf:smoke
npm run perf:seed:aie           # replaces default's rows with aie's (shared delete namespace)
PERF_URL=http://localhost:8873 npm run perf:smoke:aie
```
