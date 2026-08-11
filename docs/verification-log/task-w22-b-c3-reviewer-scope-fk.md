# task-w22-b: DEC-354 reviewer-assignment FK hole closed (both ends)

FROZEN SHA (base, pre-change): 24155d94b6020e807970bb37b4959a00687cc1ec

## What changed

1. **Write path** — `src/routes/review/plans.ts`, `POST /api/v1/plans/:id/reviewers`:
   before writing `body.trackId` / `body.submissionId` into `plan_reviewer`,
   validates each (when a non-empty string) against `plan.eventId`:
   - `trackId` must name a track of the plan's event, checked via new
     `repo.trackExistsInEvent(db, trackId, eventId)`; else
     `ApiError("invalid", ..., { trackId: "unknown track for this event" })`.
   - `submissionId` must name a submission of the plan's event, checked via
     the existing `repo.getSubmissionSummaryInEvent(db, submissionId, eventId)`;
     else the same shape on the `submissionId` field.
   - No `plan_reviewer` row is written when either check fails (validation
     runs before `repo.addReviewer`).

2. **New repo function** — `src/server/repo/review/plans.ts`:
   `export async function trackExistsInEvent(db, trackId, eventId): Promise<boolean>`,
   a bounded single-row existence query against `schema.track`. Re-exported
   through the `src/server/repo/review.ts` barrel (`export * from "./review/plans"`,
   unchanged — DEC-332 barrel semantics apply automatically to new exports).

3. **Repo predicate** — `src/server/repo/review/submissions.ts`,
   `isSubmissionInReviewerScope`: the per-submission branch (previously
   `:157-158`, returned `true` for any `submissionScopes.has(submissionId)`
   with no event check) now performs the same bounded
   `submission.id === submissionId AND submission.eventId === plan.eventId`
   single-row check that the unrestricted branch (`:139-145`) and track
   branch (`:166-177`) already perform. `plan.filters.trackIds` is
   deliberately NOT applied to this branch (DEC-017: a per-submission
   assignment stays explicit). No other semantics or callers changed.

## Tests

New file `test/review-assignment-scope.test.ts`:
- POST `/api/v1/plans/:id/reviewers` with a foreign-event `trackId` -> 400,
  `addReviewer` never called.
- POST with a foreign-event `submissionId` -> 400, `addReviewer` never
  called.
- POST with a valid in-event `trackId` / `submissionId` / neither -> 201,
  `addReviewer` called once (regression guard for the unrestricted-row
  case DEC-354 explicitly preserves).
- `isSubmissionInReviewerScope` (real, unmocked module) against a fake db:
  a `plan_reviewer` row naming a submission from a different event ->
  `false`.

`test/review-idor.test.ts` (existing DEC-039/DEC-211 coverage) required no
changes and stays green.

## Build / test results

- `npm run build`: PASS (tsc --noEmit x2 + vite build), no errors.
- `npm test --silent`: 231 test files, 1936 tests, all PASS (includes the 2
  new review-assignment-scope.test.ts cases and unchanged review-idor.test.ts).

## OPEN ITEMS: 0

RESULT: PASS
