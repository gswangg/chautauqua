## 2026-08-15 task-w45-a — review-integrity adjudication @ 8c194ec9

QUALIFYING (advisory to the DEC-069 predicate — this scope classifies to none of the five slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

STEP 0 — `git merge --no-edit main`: "Already up to date." (this worktree
was cut from `main` tip `8c194ec9`, which already contains scribe wave 45).

`npm run ref-state` receipt (verbatim):

> DEC-644 three-sha boundary: HEAD `8c194ec91ede63942022550bbced9bf3ba00f1b5`; newest first-parent product-code-bearing sha `14da2921a5be66408057712be877bc44c19de6c4`; every live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w44-a`, `task-w44-b`, `task-w44-c`, `task-w44-d`, `task-w44-f`, `task-w44-g`, `task-w45-a`, `task-w45-b`, `task-w45-c`, `task-w45-d`, `task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed an ancestor of HEAD via `git merge-base --is-ancestor`. NON-ancestor refs (NOT confirmed via `git merge-base --is-ancestor`): `mail-rich-shape-fallback`, `task-w17-i`, `task-w44-e`, `task-w44-i`, `task-w68-b`, `task-w68-c`, `task-w68-e`, `task-w71-a`, `task-w72-a`, `task-w72-b`, `task-w72-c`, `task-w72-d`, `task-w72-e`, `task-w72-f`, `task-w72-g`, `task-w72-h`, `task-w72-i`, `task-w72-j`.

Adjudication-only lane (DEC-069/DEC-099/DEC-068/DEC-358/DEC-644 w45): FILE,
NEVER FIX. Four named J4 (SPEC.md:114-121) claims, each adjudicated against
a code-read PLUS an exercised check (DEC-358 w45 evidence standard: a
code-read alone is UNFALSIFIABLE, never CLOSED).

| # | Claim | File:line | Exercised check | Verdict |
|---|-------|-----------|------------------|---------|
| 1 | anonymization is server-side (queue title, submission detail, scorecard form answers, file listings) | `src/domain/evaluation/anonymization.ts:81-104` (strip+redact), `src/routes/review/reviewer.ts:270-317,320-405` (server-side call sites), `src/server/repo/files-authz.ts:186-216` (file download excluded for anonymized plans), `src/forms/validate.ts:184-192` (file-kind answer is an opaque id, never a filename) | `test/review-queue-anonymized-titles.test.ts` (4/4), `test/review-scorecard-form-answers.test.ts` (1/1, non-anonymized fixture — locked-key stripping only), `test/files-authz-anonymized-plan.test.ts` (4/4, existing test run to corroborate the named file-name risk) | NOT-CONFIRMED (1 UNRECHECKED sub-item: anonymized-plan `sessionAnswers[].value` redaction has no independently exercised test in the targeted set, though the code path is the same `redactIdentity` call the confirmed title path uses) |
| 2 | max-evaluations cap enforced at the write door (PUT), not just display | `src/routes/review/reviewer.ts:452-457` (`needsMoreRatings` gate inside `!existing` branch, before `upsertEvaluation`) | throwaway probe test (not committed, deleted before commit): PUT a new evaluation with `maxEvaluations:1`, `countEvaluationsForSubmission` mocked to 1 → `409 conflict "This submission has reached its evaluation cap"` | NOT-CONFIRMED |
| 3 | queue sorted fewest-ratings-first, total order (deterministic tiebreak) | `src/domain/evaluation/queue.ts:35-51` (`buildReviewerQueue`: alreadyRatedByMe asc, ratingsCount asc, submissionId asc, index) | `test/review-queue-shape.test.ts` (10/10), `test/review-queue-totals.test.ts` (3/3), `test/review-queue-roundtrips.test.ts` (2/2) | NOT-CONFIRMED |
| 4 | results are producer-only (table + CSV export) | `src/routes/review/plans-progress.ts:166` (`requireOrganizer` mounted directly on the route), `src/server/middleware.ts:246-259` (`requireRole` throws 403 for role mismatch before handler body runs), `src/routes/review/shared.ts:370-376` (`requireOwnedPlan` 404s cross-org, existence-hiding per the DEC-211 pattern documented at `reviewer.ts:413-416`) | throwaway probe test (not committed, deleted before commit): reviewer-role GET on `/api/v1/plans/:id/results` and `?format=csv` → both `403 forbidden "Requires role 'organizer'"` | NOT-CONFIRMED |

Zero CONFIRMED-DEFECT rows — no fix direction or wave-46 owner is required
by the contract (OPEN ITEMS counts CONFIRMED-DEFECT rows only, DEC-615).
One verification gap (not a defect) is named for wave-46 as a
recommendation, not a required fix: add a targeted test exercising
`anonymization.ts:90-93`'s `sessionAnswers[].value` redaction directly
against an anonymized plan's submission detail (claim 1's sub-item above).

Targeted tests run (brief's named 9, all passed): `npm run test:targeted --
test/review-plan-anonymized-at-repo.test.ts
test/review-queue-anonymized-titles.test.ts
test/review-scorecard-form-answers.test.ts test/review-queue-shape.test.ts
test/review-queue-totals.test.ts test/review-queue-roundtrips.test.ts
test/review-idor.test.ts test/cross-org-reviewer-probe.test.ts
test/review-results-download.test.ts` → 9 files, 47/47 tests passed.
Additionally run to corroborate specific sub-claims (existing test not in
the brief's list, plus two throwaway probes deleted before commit, per
DEC-358): `test/files-authz-anonymized-plan.test.ts` (4/4 passed).

Full detail: docs/verification-log/task-w45-a-review-integrity-adjudication-8c194ec9.md.

RESULT: PASS — all four J4 claims adjudicated NOT-CONFIRMED (zero
CONFIRMED-DEFECT), each backed by an exercised check, not a bare code read;
one verification gap named for wave-46 (not a product defect).

OPEN ITEMS: 0
