# task-w23-f: public ceiling measured (DEC-477, DEC-453)

Sha measured: `eac56b417af0e7a4959b1aff77036ed1034814d0` (task-w23-f, HEAD at
time of measurement — the code content measured is identical to this
commit's `scripts/perf-smoke.ts`).

Bounds at measurement time (`src/server/repo/public/bounds.ts`, unchanged by
this task): `PUBLIC_PER_PAGE = 12`, `MAX_PUBLIC_PAGE = 100`,
`MAX_PUBLIC_ROWS = 1200`.

## Procedure

1. `npm run db:migrate` (fresh local D1, migrations 0000-0018).
2. `npm run seed` (base demo seed).
3. `npm run perf:seed` (DEC-088 perf-scale fixtures on top of the demo seed:
   2,000 submissions / 300 accepted+scheduled, 800-contact perf pool, 12
   reviewers, etc).
4. `npx wrangler dev` (local, `http://localhost:8787`).
5. `npm run perf:smoke`.

## Results (30 measured iterations each, overhead floor 2.2ms, raw ceiling
150ms per `PERF_P95_BUDGET_MS`, class budgets from `PERF_CLASS_BUDGET_MS` in
`scripts/perf-smoke-lib.ts`)

| check | class | budget | raw p95 | adjusted p95 | verdict |
|---|---|---|---|---|---|
| public speakers deepest page (`?page=100`) | public | 150ms | 5.6ms | 3.5ms | PASS |
| public sessions deepest rows (`?limit=100&page=12`) | public | 150ms | 7.0ms | 4.8ms | PASS |

Both checks also passed their untimed warmup 200-with-non-empty-body assertion
before the measured loop ran.

Full harness run (all 26 checks, this task's two included) passed with no
`overBudget` failures; `perf:smoke OK`.

## Reachable speaker count

`GET /e/perf-2k/speakers?page=1` reports "12 of 300 speaker(s)" — this perf
event's public speaker list (speakers attached to accepted+scheduled
submissions) tops out at 300 rows regardless of page depth; `?page=25`
(ceil(300/12)) and `?page=100` both return the same "300 of 300 speaker(s)"
body once the natural result set is exhausted, and both are 200s with
non-empty bodies (the deepest-page check's only assertion).

The seed's *speaker* total (300 for this event's public list) is below
SPEC.md:73-76's 200-800 target range's top end, but that is a seed/fixture
scale property, not a ceiling property: `MAX_PUBLIC_ROWS` (1200) is derived
from `MAX_PUBLIC_PAGE` (100) x `PUBLIC_PER_PAGE` (12) and is what actually
bounds how many speaker rows the public route will ever serve across pages.
1200 >= 800, so the current ceiling is not the limiting factor for reaching
SPEC's 800-speaker top end — a real 800-speaker event's public speaker list
would be fully reachable (800 <= 1200) within `MAX_PUBLIC_PAGE`. No lowering
of `MAX_PUBLIC_PAGE` was needed: both new deepest-page/deepest-row checks
measured well inside their 150ms public-class budget (adjusted p95 3.5ms and
4.8ms respectively, against a 150ms budget — ~30-40x headroom), so
`MAX_PUBLIC_PAGE` remains 100 / `MAX_PUBLIC_ROWS` remains 1200.

Stated plainly per the task's instruction: this run does not itself exercise
an 800-speaker event (the perf seed's public-visible speaker count for
`perf-2k` is 300, bounded by its 300 accepted+scheduled submissions, not by
the paging ceiling), so it does not directly measure performance at the
800-speaker mark. What it does establish is that the ceiling arithmetic
(1200 >= 800) does not exclude an 800-speaker event, and that reading the
deepest page under the current 1200-row ceiling at the seeded scale (2,000
submissions / 300 accepted) is fast (single-digit ms), leaving substantial
headroom before 150ms even if per-row cost scaled linearly to 800 rows.
