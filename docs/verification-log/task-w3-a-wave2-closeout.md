# task-w3-a — wave-2 closeout barrier detail

Wave-2 closeout barrier (DEC-076/DEC-091). Grep-level re-verification of
everything the plan flagged as merged-during-planning at main `1cc3fe8`,
re-checked against the current tip:

VERIFIED (no changes needed):
- `migrations/0009_review_rounds.sql` present; `migrations/meta/
  _journal.json` idx 9 entry (`0009_review_rounds`, breakpoints true).
- `listEvaluationsForPlan(db: Db, planId: string, round: number)`
  three-arg signature in `src/server/repo/review.ts:528`.
- DEC-088 perf-seed artifacts in `scripts/perf-seed.ts`: `hashPassword`
  import, 10 rooms, `perf_reviewer` seed ids (12 reviewers), 600
  round-1 evaluations, `seed_perf_plan_0001`-style plan seeding.
- DEC-089 perf-smoke checks in `scripts/perf-smoke.ts`: one-shot 301-id
  `schedule.ics` request asserting exactly 400 (independent of the
  timed 150-id check), public agenda check, `perf.reviewer.1@example-
  perf.test` rating PUT.
- task-w2-d's walkthrough area "scale" was already merged: `WALKTHROUGH_
  AREAS` at `scripts/walkthrough-lib.ts:15` is `["producer", "review",
  "speaker", "public", "data", "scale"]` (scale last, per DEC-089);
  `scripts/walkthrough/scale.ts` exists and implements all six steps —
  110 fresh contacts/submissions/speaker participants, one bulk accept
  POST (110 ids), onboarding task_assignment sampling, exactly-once
  re-accept assertion, dev-mailbox-count-unchanged assertion, and a
  purge-refresh probe (public submit -> claim -> organizer accept ->
  speaker portal edit -> immediate `/e/<slug>/sessions` title check).
  Its header GAP NOTE documents that no organizer JSON PATCH-title
  route exists in `src/routes`, so the purge probe uses the real
  title-write path (speaker portal edit, DEC-041) instead — a narrowing
  the w2-d worker flagged rather than deciding broadly, consistent with
  DEC-083's "any successful mutation" purge trigger.
- `test/walkthrough-lib.test.ts` already asserts the six-area order and
  `modulePath("scale")`.

IMPLEMENTED: nothing — all DEC-087/088/089 artifacts and the DEC-089
walkthrough area were already merged onto main before this barrier ran
(landed via the late task-w1-d/w2-d branches noted in wave-3's field
guide entry). This lane made no source changes.

Newest code-bearing main short-sha per DEC-091 (skipping the
bookkeeping-only `f9a33fd` "scribe wave 3" commit, which touches only
`decisions/`, `field-guide/index.md`, and the scribe-owned constant
table in `src/decisions.ts`): `3878d4f` ("merge task-w2-d").

`npm run build` and `npm test` both green at this sha: 94 test files,
971 tests passed, 0 failed.

OPEN ITEMS: 0

RESULT: PASS
