# 2026-08-10 task-w15-k — triage-closure @ 675219f

Full detail for the `## 2026-08-10 task-w15-k — triage-closure @ 675219f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-069 scope-5 triage-closure gate, chained behind task-w15-i's
perf-smoke PASS per DEC-127(4). Code-frozen (DEC-077): the only file
this task modifies is this log (append-only, DEC-068).

**(1) Sha re-derivation (DEC-114).** Worktree cut from `main` tip
`067a5cc` ("scribe wave 16"). First-parent walk back: `067a5cc`
(`decisions/DEC-128.md`, `docs/verification-log.md`,
`field-guide/index.md`, `src/decisions.ts` pure string-constant
append), `2280419` ("merge task-w15-j", diff = `docs/
verification-log.md` only), `ef788c2` ("merge task-w15-h", diff =
`docs/verification-log.md` only), `472dc3a` ("merge task-w15-g", diff
= `docs/verification-log.md` only), `21ea856` ("scribe wave 15", diff
= `decisions/DEC-127.md`, `field-guide/index.md`,
`src/decisions.ts` string-constant append) — every one of these five
commits' first-parent diff falls entirely inside DEC-114's bookkeeping-
exclusion set. **No code-bearing commit has landed after `675219f`**
("merge task-w14-k"); it remains the newest code-bearing sha, matching
DEC-127's expectation exactly. (`task-w15-i`'s own commit `0fde24c` is
an ancestor of `HEAD` — folded into `2280419`'s merge — and is itself
log-only, `docs/verification-log.md` only, consistent with this
finding.)

**(2) Sibling gate sections at `675219f`.** All four are present on
`main` at this sha and end `RESULT: PASS`: `task-w15-g — build+test @
675219f` (line 2495, 110 files/1064 tests, 0 failures), `task-w15-h —
walkthrough @ 675219f` (line 2547, all six `WALKTHROUGH_AREAS` PASS),
`task-w15-j — spec-audit @ 675219f` (line 2608, five wave-14 defects +
DEC-108..111 spot-check, no drift), `task-w15-i — perf-smoke @
675219f` (line 2739, all 10 timed checks `ok`, p95 well under the
150ms budget). Per DEC-127(3), since all four are merged and green, no
spot-verification substitution is needed; ran `npm test --silent`
directly in this worktree as a cheap independent confirmation of the
build+test scope anyway: **110 test files, 1064 tests, all passed, 0
failed, 0 skipped** — matches `task-w15-g`'s figures exactly, no drift.

**(3) Every prior OPEN-ITEM/FAIL section, closed at `675219f` with
fix + test evidence:**

- **task-w3-c** (walkthrough scale step6, 400 on portal-edit) and
  **task-w4-b** (same defect, independently reproduced) — root cause:
  `scripts/walkthrough/scale.ts`'s `purgeRefreshProbe` omitted
  `trackIds` from the portal-edit FormData. **Fix:**
  `scripts/walkthrough/scale.ts` (DEC-094/095/096, landed `b638f75`).
  **Runtime test evidence:** `task-w15-h — walkthrough @ 675219f`
  (this file, line 2547) scale module step6 runs as part of the
  all-six-areas PASS; DEC-094/095/096 previously confirmed by
  `task-w5-c`'s walkthrough PASS.
- **task-w3-d** (perf-smoke 301-id cap probe unreachable), **task-w4-c**
  (same), **task-w4-e** (OPEN ITEMS: 2 — both of the above) — root
  cause: `src/lib/pagination.ts`'s 200-row clamp vs. a single
  `perPage=301` request. **Fix:** `src/lib/pagination.ts`/
  `scripts/perf-smoke.ts` DEC-094/095 `@200/page` pagination (landed
  `b638f75`). **Test evidence:** `task-w15-i — perf-smoke @ 675219f`
  (line 2739) DEC-089/DEC-080 cap probe row: `ok`; DEC-094/095
  `@200/page` pagination re-confirmed in `task-w11-d`'s section (line
  1605) and unchanged since (`src/lib/pagination.ts` untouched by any
  wave-12..14 commit per `task-w15-j`'s file-touch audit, line 2644).
- **task-w7-c**, **task-w7-e** (OPEN ITEMS: 1), **task-w8-b**,
  **task-w8-d** (OPEN ITEMS: 1) — `GET /api/v1/events/:id/overview`
  500s (`D1_ERROR: too many SQL variables`) from an unbounded
  `inArray(..., placedIds)` participant fan-out at DEC-088 perf scale.
  **Fix:** `src/server/repo/overview.ts:170-177` batches the fan-out
  via `for (const batch of chunkIds(placedIds))` (DEC-104,
  `src/lib/chunk.ts`'s `ID_CHUNK_SIZE=90`), confirmed present at
  `675219f` by this task's own read (`src/server/repo/overview.ts:11`
  imports `chunkIds`; `:170-177` batches). **Test evidence:**
  `test/chunk-sweep-overview.test.ts` (source-scan guard asserting the
  chunked pattern, not a raw `inArray` over the unbounded list) plus
  runtime confirmation in `task-w15-i — perf-smoke @ 675219f` (line
  2739): "event overview" p95 11.5ms, 200 on all 35 requests — the
  D1-too-many-variables failure mode does not reproduce.
- **task-w11-d** (OPEN ITEMS: 1), **task-w12-c**/**task-w12-e**
  (OPEN ITEMS: 1), **task-w13-c**/**task-w13-d** (OPEN ITEMS: 1) — the
  `rating PUT` perf-smoke check 400s ("criterion \"overall\" has no
  options defined") because `scripts/perf-seed.ts`'s seeded
  `criteria_json` omitted the `kind: "rating"` discriminant required
  by `src/domain/evaluation.ts`'s `EvaluationCriterionDef` union.
  **Fix:** DEC-125, `scripts/perf-seed.ts:273` —
  `criteria_json: JSON.stringify([{ id: "overall", label: "Overall",
  kind: "rating", weight: 1 }])`, confirmed present at `675219f` by
  direct read in this worktree. **Test evidence:** the green
  `task-w15-i — perf-smoke @ 675219f` section (line 2739): "rating PUT"
  row `ok` at 9.1ms, and its own D1 spot-check confirming
  `evaluation_plan.criteria_json` for `seed_perf_event` carries
  `"kind":"rating"`. (`test/chunk.test.ts` and sibling `chunk-sweep-*`
  files do not cover this path; the perf-seed fix's evidentiary trail
  is the green perf-smoke *run itself*, per this task's brief.)

**(4) Five wave-14 review-lens defects (DEC-120..124), each closed
with file:line + dedicated test file, all independently re-confirmed
by `task-w15-j — spec-audit @ 675219f` (line 2608) and by this task's
own `npm test --silent` run:**

1. Task-assign cross-org IDOR (DEC-120): `src/routes/tasks.ts:235-247`
   — `test/tasks-assign-org-scope.test.ts` (3 tests).
2. Portal-edit locked speaker fields / read-only email (DEC-121):
   `src/server/repo/portal-edit.ts:123-125,184-192`,
   `src/routes/portal/edit.tsx:74-84,155-167` —
   `test/portal-edit-speaker-locked.test.ts` (5 tests) and
   `test/portal-edit-speaker-locked-route.test.ts` (3 tests).
3. Compose full-set id-drop guard (DEC-122): `src/routes/comms.ts:
   302-305,336-339` (`requireFullMatch`) —
   `test/compose-full-set.test.ts` (6 tests).
4. Plan criteria/scale immutability after evaluations exist (DEC-123):
   `src/routes/review.ts:224-238` —
   `test/plan-criteria-guard.test.ts` (7 tests).
5. Server-side answer length caps (DEC-124): `src/forms/validate.ts:
   8-9,59-61` (`MAX_TEXT_LENGTH`/`MAX_LONG_TEXT_LENGTH`) —
   `test/answer-length-caps.test.ts` (10 tests).

**(5) PLANNER: / undispositioned-FAIL final sweep.** `git log
--format='%h %B' 675219f..HEAD | grep -n 'PLANNER:'`: zero hits.
`grep -n '^RESULT: FAIL' docs/verification-log.md`: all 13 hits (lines
422, 451, 586, 627, 699, 973, 1050, 1200, 1298, 1696, 1845, 2101, 2418,
2489 — the w3-c/d, w4-b/c/e, w7-c/e, w8-b/d, w11-d, w12-c/e, w13-c/d
clusters) accounted for and closed above; no `RESULT: FAIL` line falls
outside these two named clusters (walkthrough-scale/perf-cap-probe;
overview.ts-scale; perf-seed-rating-discriminant). `docs/
eval-findings.md` re-read in full: still asserts zero live findings,
unchanged since `task-w13-d`'s read.

**(6) Full DEC-069 five-scope predicate state @ `675219f`:**
build+test PASS (`task-w15-g`), walkthrough PASS (`task-w15-h`),
perf-smoke PASS (`task-w15-i`), spec-audit PASS (`task-w15-j`), and
this triage-closure section closes every carried-forward open item
with file:line + test evidence. All five DEC-069 scopes are green at
a single newest code-bearing sha with no undispositioned defect
remaining.

OPEN ITEMS: 0

RESULT: PASS
