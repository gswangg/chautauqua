# task-w13-c - perf-smoke @ f6983e6

FROZEN SHA: f6983e66a51d23e88931ce45dac6d0374a3d5463
WAVE-12 GATE: PASS
DRIZZLE-ORM AT S: ^0.45.2
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: n/a

DEC-303/DEC-304/DEC-305/DEC-313/DEC-314 wave-13 battery, section C (perf-smoke,
port 8792, 2k-row corpus), adjudicating wave-11's `schedule.ics` 51.9ms OPEN
ITEM under DEC-309's class grading. Log-only lane; no product code, no test
code, no scripts touched — this file is the only change on this branch.

## WAVE-12 CONTENT GATE (DEC-314)

`S` = worktree HEAD = `f6983e66a51d23e88931ce45dac6d0374a3d5463` ("scribe
wave 13"). Anchors W1-W7 grepped directly in the worktree at S, all present
on first pass (no MISSING, no poll needed):

- W1 `package.json:20` — `"drizzle-orm": "^0.45.2"`, no `drizzle-kit` entry
  anywhere in `package.json` (DEC-308).
- W2 `scripts/perf-smoke-lib.ts:18` — `export const PERF_CLASS_BUDGET_MS =`
  and `scripts/perf-smoke-lib.ts:80` — `export function gradePerfCheck(`
  (DEC-309).
- W3 `scripts/perf-smoke.ts:336` — `cls: "public"` on the `schedule.ics 150
  ids` check.
- W4 `src/server/repo/public.ts:768` — `export async function
  getPublicAgendaByIds(` and `src/routes/public/index.tsx:197` — call site
  `ids.length > 0 ? await getPublicAgendaByIds(c.var.db, event, ids) : ...`
  (DEC-310).
- W5 `src/routes/dev/mailbox.tsx:44,92` — `<meta name="viewport" ...>` +
  `src/routes/docs.tsx:242` — `.table-scroll { overflow-x: auto; ... }` +
  `scripts/render-sweep.ts:230-231` — mobile-manifest doc comment (DEC-311).
- W6 `src/server/repo/tasks.ts:365` — `inArray(schema.participant
  .inviteStatus, [...ACTIVE_INVITE_STATUSES])` (DEC-312).
- W7 `src/routes/review/{index,plans,recusals,reviewer,shared}.ts` exist;
  `src/routes/review.ts` does NOT exist (custodian decomposition, DEC-313).

**WAVE-12 GATE: PASS.**

## Setup (2k-row perf corpus, port 8792)

Mirrors task-w11-c-c3-perf-smoke.md, product-read-only (no edits under
src/, app/, test/, scripts/, migrations/, wrangler.jsonc):

- `npm ci --prefer-offline --no-audit --no-fund --silent` — clean, cached
  `node_modules` reused.
- `npm run build` — PASS: dual `tsc --noEmit` (root + `app/`) 0 errors,
  `vite build` 138 modules transformed, built in 627ms.
- `rm -rf .wrangler/state` then `npm run db:migrate` — 17 migrations
  (`0000`-`0010`, `0012`-`0017`) applied clean.
- `npm run seed` — demo seed first (login-capable identity; `perf:seed`
  alone does not create one), clean, 8 R2 objects uploaded to local bucket
  `chautauqua-files`.
- `npm run perf:seed` (`tsx scripts/perf-seed.ts` + `wrangler d1 execute
  --local --file=.perf-seed.sql`) — every batch `"success": true`, zero
  `"success": false`. Verified directly in D1: `SELECT count(*) FROM
  submission WHERE id LIKE 'seed_perf_%'` = **2000**; `... AND
  status='accepted'` = **300** — matches DEC-088's scale target.
- `npx wrangler dev --port 8792` (background) — `GET /health` polled,
  `{"ok":true}` (200) before timing began.

## p95 measurements: perf-smoke run 1 and run 2 (verbatim)

`PERF_URL=http://localhost:8792 npm run perf:smoke`, 30 measured
iterations after 5 warmup, per route. DEC-309 grading: `adjusted = max(0,
rawP95 - floor)` where `floor` is the per-run p50 of 30 `GET /health`
samples, graded against SPEC §7's class budget (read=50ms, write=100ms,
public=150ms), AND raw p95 is separately checked against the unconditional
150ms ceiling.

### Run 1

```
p95 over 30 measured iterations (overhead floor: 2.4ms, raw ceiling: 150ms):

  submissions list (page 1)        raw=    10.4ms  floor=   2.4ms  adjusted=     7.9ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)  raw=    22.9ms  floor=   2.4ms  adjusted=    20.5ms  budget(read)=50ms  PASS
  submission detail                raw=    35.4ms  floor=   2.4ms  adjusted=    33.0ms  budget(read)=50ms  PASS
  event overview                   raw=    16.1ms  floor=   2.4ms  adjusted=    13.6ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)  raw=    17.6ms  floor=   2.4ms  adjusted=    15.2ms  budget(read)=50ms  PASS
  public sessions page             raw=     3.9ms  floor=   2.4ms  adjusted=     1.4ms  budget(public)=150ms  PASS
  public agenda                    raw=     5.1ms  floor=   2.4ms  adjusted=     2.7ms  budget(public)=150ms  PASS
  schedule.ics 150 ids             raw=    45.1ms  floor=   2.4ms  adjusted=    42.7ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)     raw=    20.1ms  floor=   2.4ms  adjusted=    17.7ms  budget(read)=50ms  PASS
  contacts list (q=perf)           raw=     8.4ms  floor=   2.4ms  adjusted=     6.0ms  budget(read)=50ms  PASS
  rating PUT                       raw=    10.6ms  floor=   2.4ms  adjusted=     8.1ms  budget(write)=100ms  PASS

perf:smoke OK
```

Exit code: **0**.

### Run 2

```
p95 over 30 measured iterations (overhead floor: 2.1ms, raw ceiling: 150ms):

  submissions list (page 1)        raw=    12.2ms  floor=   2.1ms  adjusted=    10.1ms  budget(read)=50ms  PASS
  submissions list (q=Kubernetes)  raw=    13.4ms  floor=   2.1ms  adjusted=    11.2ms  budget(read)=50ms  PASS
  submission detail                raw=    15.3ms  floor=   2.1ms  adjusted=    13.2ms  budget(read)=50ms  PASS
  event overview                   raw=    15.6ms  floor=   2.1ms  adjusted=    13.5ms  budget(read)=50ms  PASS
  organizer agenda (300 accepted)  raw=    20.4ms  floor=   2.1ms  adjusted=    18.2ms  budget(read)=50ms  PASS
  public sessions page             raw=     4.6ms  floor=   2.1ms  adjusted=     2.4ms  budget(public)=150ms  PASS
  public agenda                    raw=     6.8ms  floor=   2.1ms  adjusted=     4.6ms  budget(public)=150ms  PASS
  schedule.ics 150 ids             raw=    54.1ms  floor=   2.1ms  adjusted=    52.0ms  budget(public)=150ms  PASS
  plan progress (12 reviewers)     raw=    19.6ms  floor=   2.1ms  adjusted=    17.5ms  budget(read)=50ms  PASS
  contacts list (q=perf)           raw=     8.9ms  floor=   2.1ms  adjusted=     6.8ms  budget(read)=50ms  PASS
  rating PUT                       raw=    14.9ms  floor=   2.1ms  adjusted=    12.8ms  budget(write)=100ms  PASS

perf:smoke OK
```

Exit code: **0**.

Both runs: every route PASS on both the raw 150ms unconditional ceiling and
its class-specific adjusted budget (DEC-309). A check would fail if EITHER
the raw p95 exceeded 150ms OR the adjusted p95 exceeded its class budget —
neither happened, in either run, for any route. No budget was relaxed.

Untimed one-shot probes (both runs): `GET .../export/submissions?format=csv`
returned 200 with >=2001 CSV lines; `GET .../exports/showflow.csv` returned
200 with >=301 lines; the DEC-080 301-id `schedule.ics` cap assertion
returned exactly 400 both runs.

## WAVE-11 OPEN ITEM ADJUDICATION (DEC-309)

The measured `/health` p50 overhead floor was **2.4ms** (run 1) and
**2.1ms** (run 2) — the transport/harness cost the flat 150ms figure was
conflating with server time.

`schedule.ics 150 ids`:
- Run 1: raw p95 = **45.1ms**, adjusted p95 (raw - floor) = **42.7ms**.
- Run 2: raw p95 = **54.1ms**, adjusted p95 (raw - floor) = **52.0ms**.

DEC-309 classifies `schedule.ics` as route class **`public`** (150ms
budget), not `read` (50ms), because it is registered on `publicRoutes` at
src/routes/public/index.tsx:183 (`publicRoutes.get("/e/:eventSlug/
schedule.ics", ...)`) and served unauthenticated with public cache headers
(`setCacheHeaders(c)` at the top of the handler) — by SPEC's own route
taxonomy this is a public response, not an admin API read, so wave-11's
"admin read (export path)" analogy was the wrong comparison from the start.
DEC-310 additionally now serves it through `getPublicAgendaByIds` (id-scoped
query, src/server/repo/public.ts:768, called at
src/routes/public/index.tsx:197) instead of hydrating the entire published
agenda and filtering after the fact.

**Conclusion: the wave-11 51.9ms OPEN ITEM is RESOLVED.** Under DEC-309's
own instrument, both the raw p95 (45.1ms / 54.1ms, both < the unconditional
150ms ceiling) and the adjusted p95 (42.7ms / 52.0ms, both < the `public`
class's 150ms budget) PASS with wide margin. The wave-11 finding was an
artifact of comparing this route against the wrong SPEC class (`read`
50ms); reclassified correctly, there is no miss to close. This is a
classification fix, not a performance regression fix on its own — DEC-310's
id-scoping (below) is the substantive algorithmic fix layered on top.

## DEC-310 ACCEPTANCE PROBE (falsifiable, not the perf:smoke re-run)

With the 300-accepted corpus loaded, timed `GET /e/perf-2k/schedule.ics
?ids=<N ids>` directly (30 samples each after 5 warmup, same 30-sample
p95 methodology as perf:smoke, against the same live `wrangler dev --port
8792`), using the first 5 and first 150 accepted `seed_perf_%` submission
ids by id order:

```
5-id:   n=30 lastStatus=200 p95=13.17ms  min=5.82ms  max=16.48ms
150-id: n=30 lastStatus=200 p95=74.16ms  min=32.77ms max=77.23ms
```

The 5-id request (p95 13.17ms) is materially cheaper than the 150-id
request (p95 74.16ms) — roughly 5.6x, and the relationship holds across the
full min/max range (5.82-16.48ms vs 32.77-77.23ms with no overlap). Before
DEC-310, `getPublicAgenda` hydrated the entire published agenda regardless
of the requested id count, so a 5-id and a 150-id request would have cost
the same; this run demonstrates the id-scoped query (`getPublicAgendaByIds`)
is genuinely being exercised and its cost tracks the number of ids
requested rather than the size of the whole agenda. **No OPEN ITEM here —
the id-scoping took effect.**

## Vitest re-run

`npx vitest run test/pagination.test.ts test/chunk-sweep-agenda.test.ts
test/chunk-sweep-overview.test.ts test/chunk-sweep-exports.test.ts
test/schedule-ics-id-scoped.test.ts` — **5 files, 17 tests, all PASS**
(pagination.test.ts: 6, chunk-sweep-agenda.test.ts: 3,
chunk-sweep-overview.test.ts: 3, chunk-sweep-exports.test.ts: 2,
schedule-ics-id-scoped.test.ts: 3 — the last file is new since wave-11,
added by DEC-310's id-scoped-query work and not part of the original
task-w11-c re-run set).

## Out of scope (stage 1)

Production cache/CDN/edge behaviour (edge-cache hit TTFB, stale-while-
revalidate, Smart Placement) is stage-2 deployed-edge measurement and is
explicitly out of scope for this stage-1 local `wrangler dev` lane — not
measured here, and not counted as an OPEN ITEM.

**OPEN ITEMS: 0**

Dev server (port 8792) was killed after the run completed.

## POST-S DELTA

`git log --oneline f6983e66a51d23e88931ce45dac6d0374a3d5463..refs/heads/main -- src app migrations scripts test`
(main at time of check: `54413b5`):

```
(empty)
```
