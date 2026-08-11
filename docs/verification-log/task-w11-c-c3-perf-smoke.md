# task-w11-c - perf-smoke @ 84e2c04

FROZEN SHA: 84e2c04de087310f39877140cb6e239fab018e6c
WAVE-10 GATE: PASS
OPEN ITEMS: 1
RESULT: FAIL
RECHECK SHA: n/a

DEC-303/DEC-304/DEC-305 wave-11 battery, section C (perf-smoke, port 8792,
2k-row corpus). Log-only lane; no product code, no test code, no scripts
touched — this file is the only change on this branch.

## WAVE-10 CONTENT GATE (DEC-303)

`S = git rev-parse refs/heads/main` = `84e2c04de087310f39877140cb6e239fab018e6c`
("scribe wave 11"). Worktree: `git worktree add --detach <scratch>/w11-c $S`;
`git merge-base --is-ancestor $S refs/heads/main` exits 0 — ancestor
confirmed. All seven G1-G7 anchors greeped directly in that worktree, all
present on first pass (no MISSING, no poll needed):

- G1 `src/routes/root.tsx:47` — `if (!res.ok && res.status !== 304) {`
- G2a `.dev.vars.example:6` — `PUBLIC_BASE_URL=http://localhost:8787`
- G2b `src/server/origin.ts:107,114,123` — `firstLoopbackCandidate`
- G3 `src/routes/public/index.tsx:55` — `c.header("Cache-Control", "no-store")`
  on the non-200 path (comment at line 48 documents the contract)
- G4a `src/routes/agenda.ts:140` — `function parseBoundedInt(`
- G4b `src/routes/agenda.ts:133` — `gridMin: { min: 1, max: 480 },`
- G5 `src/server/repo/attribution.ts:40` —
  `isNull(schema.participant.titleAtTime)`
- G6 `src/routes/api/forms.ts:206-218` (409 unless `?cascade=1`, DEC-300
  cited at line 17) + `src/server/repo/forms.ts:281` (cascade clears
  dependent siblings' rules)
- G7 `src/routes/api/events.ts:223` — `{ name: "General", color: null }`
  at event create

**WAVE-10 GATE: PASS.**

## Setup (2k-row perf corpus, port 8792)

All inside the detached-at-S worktree, product-read-only (no edits under
src/, app/, test/, scripts/, migrations/, wrangler.jsonc):

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean (cached
  `node_modules` reused after first install).
- `npm run build` — PASS: dual `tsc --noEmit` (root + `app/`) 0 errors,
  `vite build` 138 modules transformed, built in 616ms.
- `rm -rf .wrangler/state` then `npm run db:migrate` — 17 migrations
  (`0000`-`0010`, `0012`-`0017`) applied clean.
- `npm run seed` — demo seed first (required for a login-capable identity;
  `perf:seed` alone does not create one), clean, 8 R2 objects uploaded to
  local bucket `chautauqua-files`.
- `npm run perf:seed` (`tsx scripts/perf-seed.ts` + `wrangler d1
  execute --local --file=.perf-seed.sql`) — every batch `"success": true`,
  zero `"success": false`. Verified directly in D1:
  `SELECT count(*) FROM submission WHERE id LIKE 'seed_perf_%'` = **2000**;
  `... AND status='accepted'` = **300** — matches DEC-088's scale target.
- `npx wrangler dev --port 8792` (background) — `GET /health` polled,
  `{"ok":true}` (200) before timing began.

## p95 measurements vs SPEC.md section 7 budget

SPEC.md section 7 quoted verbatim: "Admin API reads p95 < 50 ms, writes
p95 < 100 ms server time." and "CI perf smoke: hit the hot endpoints
against the 2k-row seed and fail the build over budget." The harness
(`scripts/perf-smoke-lib.ts`) encodes a single uniform
`PERF_P95_BUDGET_MS = 150` for every check it runs — looser than the
50ms/100ms split SPEC.md states for admin reads/writes respectively, so
each measured route below is graded against BOTH: the harness's own
150ms gate (which is what makes `perf:smoke` exit non-zero) AND the
tighter SPEC section-7 figure that actually applies to that route
(50ms for reads, 100ms for writes; the two public-page checks are
graded against SPEC's separate "uncached SSR < 150 ms" public-page
budget, which matches the harness figure for those two rows only).

`PERF_URL=http://localhost:8792 npm run perf:smoke`, run 1 and run 2
(30 measured iterations each after 5 warmup, per route):

| Route (harness label) | SPEC §7 budget | Run 1 p95 | Run 2 p95 | vs harness 150ms | vs SPEC §7 budget |
|---|---|---|---|---|---|
| submissions list (page 1) | admin read <50ms | 10.5ms | 10.1ms | PASS | PASS |
| submissions list (q=Kubernetes) | admin read <50ms | 10.1ms | 12.3ms | PASS | PASS |
| submission detail | admin read <50ms | 13.2ms | 13.2ms | PASS | PASS |
| event overview | admin read <50ms | 12.1ms | 13.3ms | PASS | PASS |
| organizer agenda (300 accepted) | admin read <50ms | 18.5ms | 16.4ms | PASS | PASS |
| public sessions page | public uncached SSR <150ms | 3.7ms | 4.0ms | PASS | PASS |
| public agenda | public uncached SSR <150ms | 6.7ms | 5.0ms | PASS | PASS |
| schedule.ics 150 ids | admin read <50ms (export path) | 48.7ms | 51.9ms | PASS | Run 1 PASS (48.7<50), Run 2 FAIL (51.9>50) |
| plan progress (12 reviewers) | admin read <50ms | 18.8ms | 17.6ms | PASS | PASS |
| contacts list (q=perf) | admin read <50ms | 8.3ms | 7.8ms | PASS | PASS |
| rating PUT | admin write <100ms | 12.1ms | 10.9ms | PASS | PASS |

Both runs: `perf:smoke OK`, exit 0 — every route under the harness's own
150ms gate (`PERF_P95_BUDGET_MS`), which is the number that actually
fails the build. Against the *tighter* SPEC.md section-7 50ms admin-read
figure specifically, `schedule.ics 150 ids` measured 51.9ms p95 in run 2
(48.7ms in run 1) — an OPEN ITEM stated in full below, not rounded away,
even though it is well inside the harness's enforced budget and the
route is arguably an export/download rather than an interactive admin
read (SPEC §7 does not carve out a separate export-route number, so the
strict reading of "Admin API reads p95 < 50 ms" is applied here rather
than assumed away).

Two additional untimed correctness probes the harness runs at 2k-row
scale (not latency-budgeted per DEC-105, but still part of `perf:smoke
OK` both runs): `GET .../export/submissions?format=csv` returned 200
with >=2001 CSV lines (header + 2000 seeded submissions); `GET
.../exports/showflow.csv` returned 200 with >=301 lines (every one of
the 300 accepted perf submissions scheduled, DEC-088). A one-shot
untimed DEC-080 cap assertion (301-id `schedule.ics` request) returned
exactly 400 both runs.

## OPEN ITEMS

1. `schedule.ics 150 ids` p95 = **51.9ms** (run 2; 48.7ms in run 1)
   against SPEC.md section 7's literal "Admin API reads p95 < 50 ms"
   figure. Both runs pass the harness's own enforced
   `PERF_P95_BUDGET_MS = 150` gate (`perf:smoke` exits 0 both times), so
   this is not a CI-failing regression, but it is a measured miss
   against the stricter number SPEC.md states for admin reads and is
   recorded here rather than silently rounded into the "ok" column.

**OPEN ITEMS: 1**

## Pagination/chunking guarantees exercised live at 2k rows

The perf-seed corpus (2000 submissions, 300 accepted) is exactly the
scale the following unit-level guards assume; this lane's live
measurement is what actually walks routes at that scale, while the
guards below assert the pagination/chunking contract those routes rely
on holds at the boundaries. Re-run in this worktree (product-read-only,
no changes made):

`npx vitest run test/pagination.test.ts test/chunk-sweep-agenda.test.ts test/chunk-sweep-overview.test.ts test/chunk-sweep-exports.test.ts`
— 4 files, 14 tests, all PASS.

The live routes above that depend on this contract and were measured
against the actual 2000-submission/300-accepted D1 corpus: `submissions
list` (server pagination, DEC-034 §7 "server pagination + filtering on
all admin lists"), `organizer agenda (300 accepted)` (DEC-105's
chunk-sweep target — the exact route the w7-c FAIL originally caught
unbounded at scale), `event overview`, and the two untimed CSV export
probes (`export/submissions` at 2000 rows, `exports/showflow.csv` at
300 accepted rows) which are the chunk-sweep-exports scenario exercised
live rather than mocked.

## Out of scope (stage 1)

Production cache/CDN behaviour (edge-cache hit TTFB < 50ms,
stale-while-revalidate, Smart Placement) is stage-2 deployed-edge
measurement and is explicitly out of scope for this stage-1 local
`wrangler dev` lane — not measured here, and not counted as an OPEN
ITEM.

## POST-S DELTA

`git log --oneline 84e2c04de087310f39877140cb6e239fab018e6c..refs/heads/main -- src app migrations scripts test`
(expected empty, per DEC-303):

```
(empty)
```
