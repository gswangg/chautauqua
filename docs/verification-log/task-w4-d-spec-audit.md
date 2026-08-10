# task-w4-d — spec-audit @ 3878d4f

Full detail for the `## 2026-08-10 task-w4-d — spec-audit @ 3878d4f`
section of `docs/verification-log.md`. Wave-4 gate (DEC-093: wave-3 gate
tasks never executed, so all four gates run in parallel at code-bearing
sha `3878d4f`), log-only lane per DEC-069/077/090, fresh worktree of
`main` branched from `60bbedb` ("merge task-w3-f").

Code-bearing sha derivation: `git diff 3878d4f..HEAD --stat` at the
branch point shows only `decisions/DEC-090.md`, `DEC-091.md`,
`DEC-092.md`, `DEC-093.md`, `docs/eval-findings.md` (pruning),
`docs/verification-log.md` (appends), `field-guide/index.md`, and a
4-line constant-only addition to `src/decisions.ts` — no product/test/
script/config file changed since `3878d4f`. This confirms the field
guide's / DEC-093's derived sha of `3878d4f` and matches task-w3-e's own
derivation exactly.

## SPEC §8/§9 checklist (re-run of w16-d/w3-e checklist)

- `README.md:19-22` quickstart (`npm i`, `npm run db:migrate`, `npm run
  seed`, `npm run dev`) matches `package.json` `scripts` (`dev`, `build`,
  `db:migrate`, `seed`, `perf:seed`, `perf:smoke`, `bundle:check`,
  `walkthrough`, `test`) and SPEC.md's quickstart block verbatim. PASS.
- README "For evaluators" credentials table diffed against
  `docs/fixtures/sample-data.json` `identities.{organizer,speaker,
  speaker2,reviewer}` via direct JSON read: all four email+password pairs
  (`sbek-organizer@example.com`/`SbekTest!2027-org`,
  `sbek-speaker@example.com`/`SbekTest!2027-spk`,
  `sbek-speaker2@example.com`/`SbekTest!2027-spk2`,
  `sbek-reviewer@example.com`/`SbekTest!2027-rev`) match byte-for-byte, no
  drift since w3-e/w16-d. PASS.
- `.github/workflows/ci.yml`: `build-and-test` job runs `npm run build`
  (dual `tsc --noEmit` + `vite build`) then `npm run bundle:check` then
  `npm test`; separate `perf-smoke` and `walkthrough` (DEC-063) jobs each
  bring up `wrangler dev` against a freshly migrated+seeded local D1 and
  run `npm run perf:smoke` / `npm run walkthrough`. The walkthrough
  runner derives its area list from `WALKTHROUGH_AREAS`
  (`scripts/walkthrough/index.ts`), which includes `scale` (added by
  DEC-089/`scripts/walkthrough/scale.ts`), so CI automatically covers the
  scale probe with no separate CI wiring needed. All four checks named
  in the task present. PASS, unchanged since w13-e/w15-e/w16-d/w3-e.
- SPEC §9 four named invariants, each still mapped to a concrete existing
  passing test (line numbers re-grepped at this sha):
  - close-date lock: `test/edit-lock.test.ts` + `test/submit-core.test.ts`
    (`isFormClosed`, `formWindowState` boundary cases, DEC-036).
  - speaker isolation: `test/task-file-access.test.ts:117`
    `it("403s for another speaker (IDOR)", ...)`.
  - hidden-speaker exclusion: `test/headshot-gate.test.ts:80`
    `it("404s unauthenticated when the speaker isn't publicly visible
    (pending/hidden)", ...)` against `visibleSubmissionConditions()`
    (`src/server/repo/public.ts`).
  - decision-status-change-never-auto-emails:
    `test/spec9-invariants.test.ts:58`
    `it("updateSubmissionStatuses (pending -> declined) never touches
    email_log", ...)`.
  All four PASS, unchanged since w3-e (no code has landed between
  `3878d4f` and `60bbedb`, so no invariant regressed).

## DEC-086 scale-path closure audit (file:line citations, re-confirmed in-tree)

- **DEC-078** `src/lib/chunk.ts:5` `export const ID_CHUNK_SIZE = 90;`
  and `chunkIds()` (lines 7-13); used in `src/server/repo/submissions/
  status.ts:15` (import), `src/server/repo/public.ts:13`, `src/server/
  repo/comms.ts:11`.
- **DEC-079** plan-before-commit acceptance:
  `src/server/repo/submissions/status.ts:104-142`
  (`updateSubmissionStatuses`) — doc comment at lines 104-115 states
  "planning runs BEFORE the row's UPDATE"; `chunkIds(participantContactIds)`
  loop at line 58 batches contact lookups before `planAcceptance` runs;
  `DEC_079` referenced at line 18 (`void DEC_079;`).
- **DEC-080** chunked hydration + capped `?ids=`:
  `src/server/repo/public.ts:13` imports `chunkIds`, batches at lines
  157/178/210/286; `src/lib/itinerary.ts:11`
  `export const MAX_ITINERARY_IDS = 300;`; `src/server/repo/comms.ts:11`
  imports `chunkIds`, batches at lines 137/155/232.
- **DEC-081** set-based `resolveAssignments`:
  `src/domain/evaluation.ts:289` `export function resolveAssignments<T
  extends { id: string; trackIds: string[] }>(...)`; used from
  `src/server/repo/review.ts:351` ("One set-based load plus the pure
  resolveAssignments core (DEC-081)", comment at line 343) and directly
  in `src/routes/review.ts` (imported line 20, called lines 281/352) —
  no per-reviewer full table scans found in either file.
- **DEC-082/087** multi-round: `migrations/0009_review_rounds.sql`
  present (journal idx 9); `src/server/repo/review.ts:528`
  `export async function listEvaluationsForPlan(db: Db, planId: string,
  round: number): Promise<EvaluationRecord[]>` (three-arg signature);
  `src/routes/review.ts:226` `POST /api/v1/plans/:id/advance-round`
  (comment lines 224-225: rejects 409 once `current_round === rounds`).
- **DEC-083** versioned purge: `src/server/pubcache.ts:1-20` header
  comment documents the KV-versioned purge design;
  `export const PUBVER_KEY = "chq:pubver";` at line 20;
  `bumpPublicVersionMiddleware` (per header comment) writes a fresh
  token after any successful non-GET/HEAD/OPTIONS request, and
  `publicCacheMiddleware` folds the version into the cache key on reads.
- **DEC-084** image-dims gate: `src/lib/image-dims.ts:10`
  `export const MAX_HEADSHOT_EDGE_PX = 2048;`.

All six DEC-086 scale paths confirmed in-tree at this sha, identical to
task-w3-e's citations (no drift — no product code changed between
`3878d4f` and this worktree's branch point).

## Build/test

`npm run build`: PASS (`tsc --noEmit` x2 + `vite build` clean, bundle
output unchanged in shape from w3-e/w16-d).

`npm test --silent`: PASS — **94 test files / 971 tests, 0 failures**,
identical counts to task-w3-e's barrier run (`3878d4f`), confirming zero
code drift between `3878d4f` and this worktree's HEAD (`60bbedb`, "merge
task-w3-f").

## Findings

No named SPEC §9 invariant, README/package.json quickstart command, CI
check, or DEC-086 scale-path lacked coverage or drifted at this sha.
Per DEC-077/090/093 this is a log-only re-verification lane — no
product code or test was changed (no genuine gap was found that would
require a FAIL).

OPEN ITEMS: 0

RESULT: PASS
