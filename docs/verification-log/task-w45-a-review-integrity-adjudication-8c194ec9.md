# task-w45-a — review-integrity adjudication @ 8c194ec9

Adjudication-only lane (DEC-069/DEC-099/DEC-068/DEC-358/DEC-644 w45): FILE,
NEVER FIX. No file under `src/**`, `app/src/**`, `migrations/**`, or
`package.json` was touched by this task. Scope: adjudicate the four named
J4 (review & evaluation integrity, SPEC.md:114-121) claims in the task
brief, each against a verdict of CONFIRMED-DEFECT / NOT-CONFIRMED /
DELIBERATE-BY-DESIGN / UNFALSIFIABLE / UNRECHECKED, with a quoted file:line
and the exercised check actually run (DEC-358 w45 evidence standard: a
code-read alone is UNFALSIFIABLE, never CLOSED).

## CLAIM 1 — "anonymization is server-side"

**Read:** `src/domain/evaluation/anonymization.ts:81-104`
(`anonymizeForReviewer`) strips `speakers`/`speakerAnswers` entirely
(`undefined`) and masks every occurrence of a speaker identity
(name/email/company) out of `title`, `description`, and every
`sessionAnswers[].value` via `redactIdentity` (:45-69, word-boundary regex,
longest-identity-first). This is called server-side in
`src/routes/review/reviewer.ts:403` (`const out = plan.anonymized ?
anonymizeForReviewer(detail, identities) : detail;`) before the
`c.json(out)` response — never client-side, never CSS-hiding.

- **Reviewer queue** (`reviewer.ts:270-317`): when `plan.anonymized`, the
  route loads `listSpeakerIdentitiesForSubmissions` (`submissions.ts:764-790`
  — deliberately a superset of any display predicate, no `inviteStatus`
  filter) and masks each queue item's title via `maybeRedactTitle` (:278-279)
  before it reaches `pagedItems`/`recusedOut`. CONFIRMED server-side.
- **Submission detail** (`reviewer.ts:320-405`): `speakers`/`speakerAnswers`
  stripped, `title`/`description`/`sessionAnswers` redacted, exactly as
  above. CONFIRMED server-side.
- **Scorecard's form answers**: `speakerAnswers` is wholly `undefined` under
  `anonymizeForReviewer`; `sessionAnswers[].value` is redacted through the
  same `redactIdentity` pass. Exercised: `npm run test:targeted -- test/
  review-scorecard-form-answers.test.ts` passed (1/1) — though that fixture
  runs a NON-anonymized plan (`anonymized: false`) and only asserts locked
  built-ins are excluded from the answers list; it does not itself exercise
  the anonymized-redaction branch. The anonymized-redaction branch is
  exercised by `test/review-queue-anonymized-titles.test.ts` (4/4 passed) for
  titles specifically, not for `speakerAnswers`/`sessionAnswers` bodies.
  **UNRECHECKED** for the specific claim "every custom form answer value is
  redacted on an anonymized plan's scorecard" — the code path exists
  (`anonymization.ts:90-93`) and is structurally identical to the title path
  that IS exercised, but no test in the targeted set PUTs an anonymized
  plan's submission detail and inspects `sessionAnswers[].value` for a
  masked identity. Flagged, not filed as a defect (code read shows the same
  `redactIdentity` call site is used, so a live defect is unlikely, but this
  lane's evidence standard requires marking it honestly as unrechecked
  rather than asserting CLOSED off a read).
- **Named risk — a file's NAME can carry the speaker's name even when
  title/participants are stripped:** Read `src/forms/validate.ts:184-192` —
  a `kind: "file"` form answer's stored value is "an opaque file-id string
  referencing an already-uploaded file", never the filename itself; no route
  under `src/routes/review/**` resolves a file-kind answer's id to a
  filename (`grep -rn "kind.*=.*'file'" src/routes/review/**` and
  `src/server/repo/review/**` returns nothing). Separately, actual file
  downloads for a reviewer are gated by `reviewerCanAccessSubmissionFile`
  (`src/server/repo/files-authz.ts:186-216`), which filters candidate plans
  to `p.anonymized === false` at :208 — "a reviewer must never download a
  submission's files via an anonymized plan assignment" (docstring,
  :176-181). So under an anonymized plan a reviewer both never sees a
  filename in any JSON payload AND cannot reach the file bytes at all.
  **Exercised:** `npm run test:targeted -- test/files-authz-anonymized-plan.test.ts`
  (an existing, pre-authored test not in the brief's named list, run here
  as the DEC-358 "exercised check" this specific sub-claim needs) — 4/4
  passed, confirming the anonymized-plan file-access exclusion. **NOT-CONFIRMED**
  (the named risk does not manifest in the current code: no defect).

**Claim 1 overall verdict: NOT-CONFIRMED**, with one UNRECHECKED sub-item
(scorecard form-answer value redaction on an anonymized plan — structurally
covered by the same code path as the confirmed title-redaction, but not
independently exercised by any test in the targeted set).

## CLAIM 2 — "max-evaluations cap"

**Read:** `src/routes/review/reviewer.ts:452-457`:

```
if (!existing) {
  const ratingsCount = await repo.countEvaluationsForSubmission(c.var.db, plan.id, submissionId, round);
  if (!needsMoreRatings({ ratingsCount }, plan.maxEvaluations ?? undefined)) {
    throw new ApiError("conflict", "This submission has reached its evaluation cap");
  }
}
```

This is the WRITE door — `PUT /api/v1/review/plans/:planId/evaluations/
:submissionId` — not merely a display/queue read. `needsMoreRatings`
(`src/domain/evaluation/queue.ts:57-63`) is the shared pure predicate the
queue read (`reviewer.ts:226`) also uses, so the write-door check and the
display-filter check cannot silently drift apart (same function, same
semantics). The check only fires for a NEW evaluation (`!existing`) —
re-scoring an already-submitted-by-this-reviewer row does not re-count
against the cap, which is correct: the cap bounds distinct reviewers per
submission, not edits.

**Exercised check actually run:** none of the 9 named targeted test files
exercises a PUT against a submission whose cap is already reached (`grep -n
"maxEvaluations|evaluation cap" <9 files>` finds only plan-config fixture
values, no cap-refusal assertion). Per DEC-358, a code-read alone is
UNFALSIFIABLE — so this lane wrote and ran a throwaway probe test (NOT
committed; copied test/review-idor.test.ts's mocked-repo harness, deleted
before commit) that PUTs a new evaluation with `maxEvaluations: 1` and
`countEvaluationsForSubmission` mocked to return `1`. Result:
`409 {"error":{"code":"conflict","message":"This submission has reached its
evaluation cap"}}` — confirming the refusal actually fires at the write
door, not merely in the code text.

**Claim 2 verdict: NOT-CONFIRMED** (no defect — the cap IS enforced at the
write door, and this lane confirmed it via an exercised probe, not just a
read).

## CLAIM 3 — "sorted fewest-ratings-first so coverage closes"

**Read:** `src/domain/evaluation/queue.ts:35-51` (`buildReviewerQueue`):
sorts by `(alreadyRatedByMe ? 1 : 0)` asc, then `ratingsCount` asc, then
`submissionId` asc (string comparison), then original array index. This
IS a total order: every comparator step has a deterministic tiebreak, and
`submissionId asc` is the final discriminating key before falling back to
stable input order — matching the field-guide's "pagination ONE shape +
count* + id asc" convention (id, not seq, but still a total, deterministic
key). `reviewer.ts:228-240` then paginates over the already-materialized
`ordered` array via a JS slice (DEC-466/DEC-461(e), a blessed exception for
an already-bounded reviewer-scope array, per `MAX_PLAN_SUBMISSION_SCAN` in
`src/server/repo/review/submissions.ts:22` bounding the input upstream) —
so no page can repeat or skip rows across requests for a stable underlying
data set.

**Exercised:** `npm run test:targeted -- test/review-queue-shape.test.ts
test/review-queue-totals.test.ts test/review-queue-roundtrips.test.ts`
(subset of the 9) all passed; `review-queue-roundtrips.test.ts` (2/2) name
implies pagination-roundtrip coverage specifically.

**Claim 3 verdict: NOT-CONFIRMED** (no defect — the ordering has a
deterministic total-order tiebreak, satisfying the field guide's pagination
contract in spirit even though the tiebreak key is `submissionId`, not a
numeric `seq`).

## CLAIM 4 — "Results are producer-only"

**Read:** `src/routes/review/plans-progress.ts:166`
(`reviewPlansProgressRoutes.get("/api/v1/plans/:id/results", requireOrganizer,
...)`) — `requireOrganizer` (`src/server/middleware.ts:246-259`,
`requireRole("organizer")`) throws `ApiError("forbidden", ...)` (→ 403) for
any non-organizer role BEFORE the handler body runs, so a reviewer-role
principal cannot reach either the results table or the `?format=csv`
export via this route at all. Existence-hiding: `requireOwnedPlan`
(`src/routes/review/shared.ts:370-376`) 404s a cross-org organizer (via
`repo.getPlanForOrg` scoping) — role-mismatch is a 403 (from the earlier
`requireOrganizer` middleware gate), cross-org-but-same-role is a 404 (from
`requireOwnedPlan`'s own existence-hiding, matching the `DEC-211`
existence-hiding pattern documented elsewhere in this file, e.g.
`reviewer.ts:413-416`'s comment "existence-hiding 404 for a submission
outside the plan's event, enforced for EVERY role"). This is a deliberate,
documented split (two different guards for two different failure modes),
not an accident.

**Exercised check actually run:** none of the 9 named targeted test files
asserts a reviewer-role 403 on `/api/v1/plans/:id/results` (`grep -n
"results|export" test/review-idor.test.ts test/cross-org-reviewer-probe.test.ts`
returns nothing). Per DEC-358, this lane wrote and ran a throwaway probe
test (NOT committed; copied `test/review-results-download.test.ts`'s
mocked-repo harness, deleted before commit) that issues a reviewer-role GET
against both `/api/v1/plans/:id/results` and `?format=csv`. Result: both
return `403` (`{"error":{"code":"forbidden","message":"Requires role
'organizer'"}}`).

**Claim 4 verdict: NOT-CONFIRMED** (no defect — a reviewer-role principal
is refused 403 on both the results table and the CSV export before any
plan/submission data is touched, and the 404-vs-403 split is deliberate and
documented in the surrounding code's own comments, cf. DEC-211).

## Verdict summary

| # | Claim | Verdict |
|---|-------|---------|
| 1 | anonymization is server-side | NOT-CONFIRMED (1 UNRECHECKED sub-item: scorecard form-answer value redaction on an anonymized plan, not independently exercised) |
| 2 | max-evaluations cap enforced at write door | NOT-CONFIRMED |
| 3 | queue sorted fewest-ratings-first with total-order tiebreak | NOT-CONFIRMED |
| 4 | results are producer-only | NOT-CONFIRMED |

Zero CONFIRMED-DEFECT rows. All four named claims hold under an exercised
check (three via existing/probe test runs, one via existing targeted test
coverage plus a corroborating adjacent test file); one sub-item (claim 1's
scorecard form-answer redaction) is honestly marked UNRECHECKED rather than
CLOSED, per this lane's DEC-358 evidence standard, and is named as a
wave-46 follow-up (not a defect — a verification gap): wave-46 owner should
add a targeted test that PUTs an anonymized plan's `GET
/api/v1/review/submissions/:id` and asserts a `sessionAnswers[].value`
containing a speaker's name/email/company comes back masked, exercising
`anonymization.ts:90-93` directly (the queue-title test already covers the
sibling `redactIdentity` call site at `reviewer.ts:279`).

RESULT: PASS — all four J4 claims adjudicated NOT-CONFIRMED (no
CONFIRMED-DEFECT), each backed by an exercised check per DEC-358 (not a
bare code read); one verification gap named for wave-46, not a product
defect.

OPEN ITEMS: 0
