# 2026-08-10 task-w11-d — perf-smoke @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w11-d — perf-smoke @ 3b7ed3d` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

DEC-069 perf-smoke gate, log-only lane (DEC-077): no product/test/
script/config changes made in this task; the run below surfaced a real
defect, recorded as `RESULT: FAIL` per this lane's own rule rather than
fixed in-place.

Newest code-bearing sha per DEC-091/DEC-114, walking `main` from tip
`546cbcc`: `546cbcc` ("merge task-w11-e") and its sole commit `6cd04a3`
("task-w11-e: spec-audit @ 3b7ed3d") touch only `docs/verification-log.md`
(134 insertions, 0 other files) — bookkeeping-only, non-code-bearing per
DEC-114. That leaves **`3b7ed3d`** ("merge task-w11-a") as the newest
code-bearing sha, matching this task's prerequisite (task-w11-a already
merged) exactly as expected. Fresh worktree branched from `main` at this
sha; no mid-run code-bearing merges landed on `main` during this task's
execution window (only the pre-existing `546cbcc`/`6cd04a3` bookkeeping
pair above, already accounted for).

**Closing the w7-c/w8-b OPEN ITEM:** `GET /api/v1/events/:id/overview`
at DEC-088 scale (300 accepted + placed submissions) now succeeds. The
DEC-104 chunk-sweep landed the fix in
`src/server/repo/overview.ts:170-177`: the participant fan-out for
`placedIds` is now batched via `for (const batch of chunkIds(placedIds))`
(imported from `src/lib/chunk.ts`, DEC-078's `ID_CHUNK_SIZE=90`) before
each `inArray(schema.participant.submissionId, batch)` query, replacing
the prior single unbounded `inArray(..., placedIds)` call that produced
`D1_ERROR: too many SQL variables` at `d12eb25` (`task-w7-c`/`task-w8-b`).
This run's `event overview` check (marked `optional: true` in
`scripts/perf-smoke.ts` for 404-tolerance, but not for 500s) completed
with a 200 response during warmup with no D1 error — the too-many-SQL-
variables failure recorded at `d12eb25` is superseded.

Run detail — fresh local D1 state (`rm -rf .wrangler/state`), `npm ci`
(cached), `npm run build` (PASS, tsc + app tsc + vite build all clean),
`npm run db:migrate` (10 migrations applied), `npm run seed`, `npm run
perf:seed` (DEC-088 scale: 2,000 submissions / 300 accepted+placed, 12
reviewers, verified via `.perf-seed.sql`). `npx wrangler dev --port
8823` came up healthy (`GET /health` 200). `PERF_URL=
http://localhost:8823 npm run perf:smoke`:

- DEC-089/DEC-080 cap probe (300 real accepted ids + 1 nonexistent id ->
  public unauthenticated `schedule.ics` 400): **PASS**.
- DEC-105 untimed export min-line probes: `export/submissions?format=csv`
  200 with >=2001 lines (**PASS**), `exports/showflow.csv` 200 with
  >=301 lines (**PASS**).
- Organizer-agenda timed check (`/api/v1/events/:id/agenda`, 300
  accepted) and `event overview` (DEC-104 chunked fan-out, see above):
  both reached warmup successfully — no D1 error, no timeout.
- DEC-094/095 `@200/page` pagination checks (`fetchAcceptedSubmissionIds`
  paginating at `perPage=200` for both the 300-id cap probe and the
  150-id `.ics` set): **PASS** — all pages returned exactly 200 rows
  (or a shorter terminal page), matching the server-side clamp.
- The run **aborted during warmup on the `rating PUT` check**
  (`PUT /api/v1/review/plans/seed_perf_plan_0001/evaluations/:id`):
  HTTP 400, `{"error":{"code":"invalid","message":"Invalid
  scores","fields":{"overall":"criterion \"overall\" has no options
  defined"}}}`. Root cause isolated via a standalone repro script
  (login as `perf.reviewer.1@example-perf.test`, PUT `{scores:{overall:
  4}}`): `scripts/perf-seed.ts:269`'s seeded `criteria_json` is
  `[{"id":"overall","label":"Overall","weight":1}]` — it omits the
  `kind: "rating"` discriminant that
  `src/domain/evaluation.ts`'s `EvaluationCriterionDef` union (added in
  `a870c5c`, "J4 review API + wave-3 migration", predating perf-seed's
  DEC-088 extension in `2a1c2c8`) requires on every criterion.
  `validateEvaluationScores` (`src/domain/evaluation.ts:161-187`)
  branches on `criterion.kind === "rating"`; with `kind` absent
  (`undefined`), it falls into the `dropdown` `else` branch and rejects
  the criterion for having no `options` array. This is a genuine
  seed/domain-contract mismatch in `scripts/perf-seed.ts`'s
  `criteria_json` literal (a script bug, not a product/domain bug —
  `src/domain/evaluation.ts` behaves exactly per its own DEC-018
  docstring contract), previously unexercised because `task-w7-c` and
  `task-w8-b` never reached this check (they aborted earlier at the
  now-fixed `event overview` D1 error). Per this task's log-only-lane
  scope (DEC-077), the seed script was left unmodified and this is
  recorded as a failure rather than patched.
- No p95 timing table was produced (the harness aborts on first
  non-`ok` response before printing results), so none of the later
  timed checks (`public sessions page`, `public agenda`, `schedule.ics
  150 ids`, `plan progress`) ran either.

OPEN ITEMS: 1 — `scripts/perf-seed.ts`'s `criteria_json` literal (line
~269) is missing the `kind: "rating"` field required by
`src/domain/evaluation.ts`'s `EvaluationCriterionDef` (`RatingCriterionDef
| DropdownCriterionDef` union), causing every `rating PUT` perf-smoke
check to fail 400 with "criterion \"overall\" has no options defined".
The w7-c/w8-b `overview.ts` OPEN ITEM is CLOSED (see above); this is a
new, distinct OPEN ITEM. A future code-bearing wave must add `kind:
"rating"` to the seeded criterion and re-run perf-smoke to close the
DEC-069 predicate.

RESULT: FAIL — perf-smoke gate scope is not green at the newest
code-bearing sha `3b7ed3d` (`event overview`/DEC-104 chunking now
confirmed fixed, closing the w7-c/w8-b OPEN ITEM; a new, distinct
`scripts/perf-seed.ts` criteria-schema defect blocks the `rating PUT`
check and all subsequent timed checks from running).
