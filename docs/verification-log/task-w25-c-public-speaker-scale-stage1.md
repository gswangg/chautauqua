# task-w25-c: public speaker scale filled to SPEC's 800-speaker top end (DEC-495)

Sha measured: `58c8ec1` (task-w25-c, HEAD at time of measurement — the code
content measured is identical to this commit's `scripts/perf-seed-lib.ts`,
`scripts/perf-seed.ts`, and `test/perf-seed.test.ts`).

## What changed

`scripts/perf-seed-lib.ts` gains `coSpeakerContactIndexesForAccepted(j,
coSpeakerCount = PERF_CO_SPEAKERS_PER_ACCEPTED)` — a pure, deterministic
helper mapping each accepted-submission index (0-based, in [0, 300)) to
`PERF_CO_SPEAKERS_PER_ACCEPTED` (2) contact-pool indexes drawn from the
exact complement of the accepted block's own primary-speaker contact
window (both are derived generically from `PERF_STATUS_COUNTS` and
`PERF_CONTACT_COUNT`, not hardcoded literals), so co-speaker contacts never
collide with any submission's own primary speaker, and a simple sequential
walk across `j * coSpeakerCount + k` sweeps that 500-contact complement
pool fully at least once across the 300 accepted submissions.

`scripts/perf-seed.ts`'s existing accepted-submission loop now emits
`PERF_CO_SPEAKERS_PER_ACCEPTED` extra `participant` rows per accepted
submission (`visible: true`, `invite_status: 'accepted'`, `role: 'speaker'`,
ascending `order` starting at 1, ids via `seedId('perf_cospeaker', n)`).
`PERF_SUBMISSION_COUNT` (2,000) and the accepted-submission count (300) are
unchanged. The existing `DELETE FROM participant WHERE submission_id LIKE
'seed_perf_%'` cleanup (scripts/perf-seed.ts:91) filters on `submission_id`,
not the participant row's own id, so it already catches the new rows
regardless of their `perf_cospeaker`-prefixed ids.

## Unit test

`test/perf-seed.test.ts`'s new `DEC-495 coSpeakerContactIndexesForAccepted`
describe block asserts: distinct-per-call output, determinism +
input-validation throws, no collision with any accepted submission's own
primary-speaker contact, and — the scale assertion this task requires — that
walking all 300 accepted submissions' primary + co-speaker contact indexes
together covers >= 800 distinct contacts (measured: exactly 800, the full
`PERF_CONTACT_COUNT` pool). `npx vitest run test/perf-seed.test.ts`: 48
tests passed. Full suite (`npm test --silent`): 303 files / 2,759 tests
passed, no regressions.

## Procedure

1. `npm run db:migrate` (fresh local D1, migrations 0000-0018).
2. `npm run seed` (base demo seed).
3. `npm run perf:seed` (perf-scale fixtures on top of the demo seed, now
   including the co-speaker participant rows from this task).
4. `npx wrangler dev --port 8792` (port 8792 owned by this task per DEC-498;
   killed only this task's own spawned PID afterward, no `pkill -f`).
5. `PERF_URL=http://localhost:8792 npm run perf:smoke`.

## Reachable speaker count

`GET /e/perf-2k/speakers?page=1` reports **"12 of 800 speaker(s)"** — up
from the pre-task "12 of 300 speaker(s)" (task-w23-f), reaching SPEC.md:73-
76's 200-800 speaker range's top end (M = 800 >= 800).

## perf:smoke results (30 measured iterations each, overhead floor 5.7ms,
raw ceiling 150ms per `PERF_P95_BUDGET_MS`)

| check | class | budget | raw p95 | adjusted p95 | verdict |
|---|---|---|---|---|---|
| public speakers page at row ceiling (`?page=100`) | public | 150ms | 24.7ms | 19.0ms | PASS |
| public speakers deepest page (`?page=MAX_PUBLIC_PAGE`) | public | 150ms | 25.3ms | 19.6ms | PASS |
| public sessions deepest rows | public | 150ms | 19.5ms | 13.8ms | PASS |
| onboarding grid (800 speakers x 5 tasks) | read | 50ms | 24.0ms | 18.3ms | PASS |

All 26 checks in the full harness passed (`perf:smoke OK`), including every
pre-existing check — no check's asserted budget was exceeded, and no exact-
count assertion needed updating (the two DEC-477 deepest-page/deepest-row
checks assert 200-with-non-empty-body only, not a specific row count, so
they were unaffected by the M=300 -> M=800 change).

## OPEN ITEMS

None. This task's scope (fill the perf seed's public speaker count to
SPEC's 800-speaker top end and measure it) is fully closed: the seed now
produces 800 distinct publicly-visible speaker contacts for the `perf-2k`
event, and the deepest public speakers page reads well inside its 150ms
public-class budget (19.6ms adjusted p95, ~7.7x headroom) at that scale.

## RESULT

PASS. `perf-2k`'s public speakers list reports 800 of 800 speakers;
`npm run perf:smoke` against `http://localhost:8792` passed all 26 checks
with no budget violations.
