# 2026-08-10 task-w4-d — spec-audit @ 3878d4f

Full detail for the `## 2026-08-10 task-w4-d — spec-audit @ 3878d4f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-4 gate (DEC-093: wave-3 gate tasks never executed, so all four
gates run in parallel at code-bearing sha `3878d4f`), log-only lane per
DEC-069/077/090, fresh worktree of `main` branched from `60bbedb` ("merge
task-w3-f"). `git diff 3878d4f..HEAD --stat` at the branch point shows
only DEC-090..093 decision docs, `docs/eval-findings.md` pruning,
`docs/verification-log.md` appends, `field-guide/index.md`, and a
4-line constant-only `src/decisions.ts` addition — no product/test/
script/config changes, confirming `3878d4f` as the code-bearing sha.

SPEC §8/§9 checklist re-run (mirrors w13-e/w15-e/w16-d/w3-e): README
quickstart matches `package.json` scripts and SPEC.md verbatim; README
evaluator credentials table matches `docs/fixtures/sample-data.json`
`identities` block byte-for-byte; CI (`.github/workflows/ci.yml`) covers
build+bundle:check+test plus separate perf-smoke and walkthrough
(DEC-063) jobs — the walkthrough runner derives its area list from
`WALKTHROUGH_AREAS`, so CI automatically includes the `scale` area with
no extra wiring; SPEC §9's four invariants (close-date lock, speaker
isolation, hidden-speaker exclusion, decision-never-auto-emails) each
still map to a passing regression test at unchanged locations
(`test/edit-lock.test.ts`+`test/submit-core.test.ts`,
`test/task-file-access.test.ts:117`, `test/headshot-gate.test.ts:80`,
`test/spec9-invariants.test.ts:58`). All PASS.

DEC-086 scale-path closure audit, all six paths re-confirmed in-tree:
DEC-078 `src/lib/chunk.ts:5` `ID_CHUNK_SIZE=90`, used in
`src/server/repo/submissions/status.ts:15`, `src/server/repo/public.ts:13`,
`src/server/repo/comms.ts:11`. DEC-079 plan-before-commit at
`src/server/repo/submissions/status.ts:104-142`
(`updateSubmissionStatuses`), `void DEC_079;` at line 18. DEC-080
chunked hydration at `src/server/repo/public.ts:157/178/210/286`,
`MAX_ITINERARY_IDS = 300` at `src/lib/itinerary.ts:11`, chunked
`src/server/repo/comms.ts:137/155/232`. DEC-081 set-based
`resolveAssignments` at `src/domain/evaluation.ts:289`, used from
`src/server/repo/review.ts:351` and `src/routes/review.ts:281/352`
(no per-reviewer full scans). DEC-082/087 multi-round:
`migrations/0009_review_rounds.sql`, three-arg
`listEvaluationsForPlan(db, planId, round)` at
`src/server/repo/review.ts:528`, 409 `advance-round` at
`src/routes/review.ts:226`. DEC-083 versioned purge:
`PUBVER_KEY = "chq:pubver"` at `src/server/pubcache.ts:20`. DEC-084
`MAX_HEADSHOT_EDGE_PX = 2048` at `src/lib/image-dims.ts:10`.

`npm run build`: PASS (dual `tsc --noEmit` + `vite build` clean).
`npm test --silent`: PASS — 94 test files / 971 tests, 0 failures,
identical counts to task-w3-e's barrier run, confirming zero code drift
between `3878d4f` and this worktree's HEAD.

Full detail: `docs/verification-log/task-w4-d-spec-audit.md`.

No genuine gap found. Log-only lane per DEC-077/090/093 — no product
code or test changed.

OPEN ITEMS: 0

RESULT: PASS
