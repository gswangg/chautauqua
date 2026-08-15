## 2026-08-15 task-w29-b — files library perf fix @ c50e56f3

INVALIDATED BY: src/server/repo/files-library.ts, src/db/schema/**, migrations/**

Fixed the `files library (page 1)` TIER-0 perf defect
(`docs/verification-log.md:3750-3759`, adjusted p95 474.4ms/414.7ms,
worst read in the harness, both over the 150ms raw ceiling). Instrumented
the four diagnosed passes FIRST (DEC-773 wave-29 amendment) and found the
task's stated cause (`loadDeliverableChains` materializing every matching
submission's file rows) measured only 6-10ms — cheap. The actual dominant
cost (~92% of the read, ~460ms) was `computeKindCounts`'s headshot
`count(distinct file.id)`, driven by the old
`contact.headshot_url = '/headshots/' || file.id` join predicate — a
computed string concatenation no index can serve. Since the timings showed
the headshot branch dominant, applied BOTH sanctioned fixes: (1) replaced
`totalSizeBytes`'s chain materialization with one SQL aggregate over a new
chain-TIP predicate (`buildDeliverableTipWhere`, `not exists` test),
closing the DEC-344 bounded-cost gap the module's own comment admitted,
independent of which branch was measured dominant; (2) added
`contact.headshot_file_id` (indexed FK, migration 0040, backfilled from
the existing url pattern), replacing `HEADSHOT_JOIN` with a plain
indexable `eq()` at all three call sites, kept in sync everywhere
`headshot_url` is written (`setContactHeadshot`, contact merge, the demo
seed).

`files library (page 1)`: raw 466.1ms/adj 463.9ms (FAIL, before, this
task's own baseline re-measurement) -> raw 17.7ms/adj 13.0ms (PASS, after)
at perf-2k scale (`wrangler dev --port 8892`, DEFAULT profile only,
server killed after use). Full four-pass instrumentation numbers,
before/after perf:smoke output, and the FK-write-site audit:
`docs/verification-log/task-w29-b-files-library-perf-c50e56f3.md`.

TESTS: `npx vitest related src/server/repo/files-library.ts` plus every
existing `test/*files-library*`/`test/*file-version*`/`test/*archive*` —
227 test files / 1613 tests green; `npm run build` (strict tsc, both
tsconfigs) green. Adding the schema column rippled into 23 test files that
hand-roll the `contact` table's raw DDL and 4 fake-DB test files that
evaluate `files-library.ts`'s drizzle query shapes structurally — all
updated in the same commit (never the full suite, per this task's TARGETED
ONLY instruction).

GAP FLAGGED: `contacts/merge.ts`'s merge write sets `contact.headshot_url`
directly (never through `setContactHeadshot`) — outside this task's
"wherever setContactHeadshot writes" literal scope, but left un-mirrored it
would silently desync `headshot_file_id` from `headshot_url` on every
contact merge (the merged contact's headshot would stop resolving in the
files library). Fixed narrowly (re-derive `headshotFileId` from whichever
`headshotUrl` `planMerge` kept, same `/headshots/<fileId>` parse the
migration's backfill uses) since leaving it broken would have been a new
regression introduced by this task's own FK, not a pre-existing gap.

RESULT: PASS — `files library (page 1)` p95 474.4ms -> 13.0ms adjusted, under both the 150ms raw ceiling and the 50ms read-class budget.

