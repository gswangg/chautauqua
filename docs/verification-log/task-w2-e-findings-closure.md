# task-w2-e — findings-closure walkthrough @ 4813650

Worktree `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w2-e`,
branch `task-w2-e`, cut from `main` tip `4813650` ("merge task-w2-b", which
includes `5374348` "DEC-245: SSR confirmation trio"). Local wrangler dev
(`npm run db:migrate` then `npm run seed`, zero secrets), server on
`http://localhost:8787`.

Method: extended `scripts/walkthrough-lib.ts` with additive, dependency-free
pure helpers (request/body builders + response-shape validators) for each
finding below — unit-tested in `test/walkthrough-lib.test.ts` (29 new
assertions, all green). The existing `scripts/walkthrough/review.ts` module
could not be reused as-is for B2/ABS-10: it currently asserts
`queue.items.map(i => i.id)` (its local `QueueItem` interface only declares
`id`), but the real `GET /api/v1/review/plans/:id/queue` payload is shaped
`{submissionId, ref, title, ratingsCount, alreadyRatedByMe}` per DEC-239 (see
`src/routes/review.ts:590-639`, comment at line 623-625) — so
`scripts/walkthrough/review.ts`'s own queue-composition check fails
(`FAIL: queue contains exactly the reviewer's assignment ... got
[null,null,...]`) even though the underlying API is correct. Per this task's
scope (touch only `walkthrough-lib.ts`/its test/this doc — no product code,
and `scripts/walkthrough/review.ts` is neither), I did not fix that script;
flagging it here as a real but out-of-scope bug for the planner (see
"Housekeeping" below). Instead I drove direct authenticated HTTP against the
running dev server (fetch, DEC-053 cookie-jar/CSRF conventions, same pattern
as `scripts/walkthrough/review.ts`) from a throwaway driver script that
imports the new `walkthrough-lib.ts` validators, run via
`npx tsx <scratchpad>/verify-w2e.ts` — not committed (scratchpad only, per
"one-off curl" guidance: the reusable *validators* are what's committed).

Two full runs were done: an initial exploratory run, and a final run against
a freshly re-migrated + re-seeded DB (`rm -rf .wrangler/state && npm run
db:migrate && npm run seed`) whose full PASS/FAIL lines are what's quoted
below.

## B1 — reviewer directory + assignment

**PASS.** `GET /api/v1/users?role=reviewer` → 200, all 4 items carry a
non-empty string `id` (checked with the new `userListItemHasId`):
```
[{"id":"seed_user_0004","email":"sbek-reviewer@example.com","role":"reviewer",...}, ...]
```
`POST /api/v1/plans/:id/reviewers` with `{userId: "seed_user_0004", trackId:
"seed_track_0001"}` (built with the new `buildReviewerAssignmentBody`) → 201:
```
{"id":"soamzxrkf46flyvac5q3","planId":"2ipq3yx3ha6d32zsd7i5","userId":"seed_user_0004","trackId":"seed_track_0001","submissionId":null}
```
`GET /api/v1/plans/:id/progress` → 200, lists the assignment:
`{"userId":"seed_user_0004","email":"sbek-reviewer@example.com","assigned":12,"completed":0}`.

## B2 — reviewer queue shape + submission detail (DEC-239)

**PASS.** `GET /api/v1/review/plans/:id/queue` (as the reviewer) → 200, all
12 items shaped `{submissionId, ref, title, ratingsCount, alreadyRatedByMe}`
(checked with the new `queueItemHasSubmissionId`), e.g.
`{"submissionId":"seed_submission_0002","ref":"SES-002","title":"Your AI Pair Programmer Is Lying to You: Verification Patterns That Scale","ratingsCount":0,"alreadyRatedByMe":false}`.
`GET /api/v1/review/submissions/seed_submission_0002?planId=<plan>` → 200.

See "Method" above for the stale (unrelated) local-harness bug this
surfaced in `scripts/walkthrough/review.ts`.

## B3 — contact merge closes a duplicate pair

**PASS.** `GET /api/v1/contacts/duplicates` → 200, a seeded pair present:
`{"contactIds":["seed_contact_0001","seed_contact_0003"], ...}` (Priya Raman
/ Priya Raman-dup). `POST /api/v1/contacts/merge` with
`{keepId:"seed_contact_0001", mergeId:"seed_contact_0003"}` (built with the
new `buildContactsMergeBody`) → 200, returns the merged contact record.
Re-fetching `GET /api/v1/contacts/duplicates` → 200; the pair no longer
appears (checked with the new `duplicatePairStillOpen` → `false`).

## C/CNT-07 — portal task upload → central files library, worklist counts

**PARTIAL — one half closed, one half FAIL (real defect, not a harness
artifact).**

**CNT-07a PASS:** logged in as the speaker (Priya Raman), located her
`file_request` "Finalize bio + headshot" task assignment via `GET
/portal/tasks`, uploaded a file with `POST
/portal/tasks/:assignmentId/upload` (form-encoded `chq_csrf` field — the
double-submit `csrfForm` middleware requires the cookie value as a *form
field*, not the `x-chq-csrf` header used by JSON mutations; this differs
from `csrfJson` and is worth noting for anyone extending
`scripts/walkthrough/*.ts`) → 302. The upload then appears in `GET
/api/v1/events/:id/files` → 200, with a matching chain entry:
`{"filename":"verify-w2e.pdf","kind":"presentation","submissionId":"seed_submission_0001",...,"versionCount":1}`
(checked with the new `eventFilesContainsUpload`).

**CNT-07b FAIL:** the organizer Content worklist's per-row deliverable
counts do NOT move. Root cause: `GET
/api/v1/submissions/:id/files` returns `{"files": {"presentation": [...],
...}}` (grouped by kind — `src/routes/files.ts:146-151` /
`src/server/repo/files.ts`'s `listSubmissionFiles`/`FilesByKind`), but
`app/src/pages/content/ContentApp.tsx:43-48` calls
`apiList<DeliverableFile>('/submissions/${item.id}/files')` — which expects
a flat `{items: DeliverableFile[]}` list envelope — and then does
`files.items.filter((f) => f.kind === kind).length`. Since the real response
has no `items` key, `files.items` is `undefined` and `.filter` throws; the
surrounding `.catch(() => item)` (`ContentApp.tsx:49-51`) silently swallows
this, so `deliverableCounts` is never set and `SessionList.tsx:100`'s
`item.deliverableCounts?.[kind] ?? 0` always renders `0` — for every
worklist row, not just the one touched here. `app/src/pages/content/
ContentApp.render.test.tsx:43,92` already mocks this endpoint with the
*correct* (real) shape `{files: {}}`, but neither test asserts on
`deliverableCounts` values, so this has been passing silently. Direct
evidence:
```
GET /api/v1/submissions/seed_submission_0001/files -> 200
{"files":{"presentation":[{"id":"seed_file_...","filename":"slides-v2.pdf",...},{"id":"seed_file_...","filename":"slides-v1.pdf",...}]}}
```
(no top-level `items` key). Repro: seed, log in as organizer, open
Content > worklist for any event with uploaded deliverables — every row's
per-kind version/deliverable count column reads 0 regardless of actual
uploads. Fix belongs to whoever owns `app/src/pages/content/ContentApp.tsx`
(either adapt it to read `files.files[kind]?.length`, or add a
`{items:[...]}`-shaped list endpoint) — out of this task's scope (no
product-code edits).

## C/CFP-06 — trackIds→names, Format answer surfaces (DEC-243)

**PARTIAL — trackIds/answers closed; the specific seeded-event auto-show
demo does not trigger, by design-vs-fixture-label mismatch, not a bug.**

**CFP-06b PASS:** a submission's `trackIds` (`["seed_track_0003"]`) resolve
against `GET /api/v1/events/:id/tracks` to the real name
`"Developer Experience"` (checked with the new `resolveTrackNames`, which
independently reimplements `SubmissionsTable.tsx`'s `trackNames()` for a
server-side-only check).

**CFP-06c PASS:** `GET /api/v1/events/:id/submissions?includeAnswers=1` → 200
surfaces the form's dropdown answer keyed by `form_field_id`:
`"field_session_format":"Talk (30 min)"` alongside the other answers.

**CFP-06a — not demonstrated (design-conformant, not a defect):**
`hasExactFormatDropdownField` (new helper, mirrors
`app/src/pages/submissions/columns.ts:46`'s `findFormatField`, which DEC-243
specifies as an exact case-insensitive match on the label `"Format"`)
returns `false` against the seeded devflow-conf-2027 form's fields:
```
[{"label":"Title","kind":"text"},{"label":"First name","kind":"text"},{"label":"Description","kind":"long_text"},{"label":"Last name","kind":"text"},{"label":"Session format","kind":"dropdown"},{"label":"Email","kind":"text"},{"label":"Audience level","kind":"dropdown"},{"label":"Notes for reviewers","kind":"long_text"}]
```
The seeded field (`scripts/seed.ts:367`) is labeled `"Session format"`, not
`"Format"` — `findFormatField`'s exact-match (`field.label.trim().
toLowerCase() === 'format'`) correctly does NOT match it, per DEC-243's own
wording ("a dropdown field whose label is 'Format' (case-insensitive)").
There is also no unit test for `findFormatField`/`hasExactFormatDropdownField`
anywhere in the tree (`app/src/pages/submissions/columns.test.ts` covers
`deriveColumnsFromFormFields`/`visibleColumns`/`formatAnswerValue` only).
Net: the mechanism is implemented exactly as decided, but it is currently
*unreachable* with the demo seed data (no seeded form field is literally
labeled "Format") and *untested* at the unit level — flagging both for the
planner; not a product-code fix I can make from this task's scope (touches
either `scripts/seed.ts` or `app/src/pages/submissions/columns.ts`/its
tests, neither of which this task may touch).

## C/ABS-10 — perDropdown counts, excluded from average (DEC-241)

**PASS.** Created a plan with one rating criterion (`content_quality`,
weight 1) and one dropdown criterion (`length_fit`, options Too
short/Just right/Too long). Reviewer submitted `{content_quality: 4,
length_fit: "Just right"}`. `GET /api/v1/plans/:id/results` → 200:
```
{"submissionId":"seed_submission_0002","count":1,"average":4,"perCriterion":{"content_quality":4},"perDropdown":{"length_fit":{"counts":{"Too short":0,"Just right":1,"Too long":0},"modal":"Just right"}}}
```
`length_fit` appears only under `perDropdown`, never in `perCriterion`
(checked with the new `dropdownCriterionExcludedFromAverage`) — `average`
(4) reflects only the rating criterion, confirming `src/routes/review.ts`'s
`ratingCriteria(roundCriteria)`/`dropdownCriteria(roundCriteria)` split
(lines 444-463) works as designed.

## A — *-mailer-failure tests exist and pass

**PASS, count updated from 4 to 6.** `npx vitest run` across all six
`test/*-mailer-failure.test.ts` files — all green:
```
✓ test/comms-send-mailer-failure.test.ts (1 test)
✓ test/submit-mailer-failure.test.ts (1 test)
✓ test/users-create-mailer-failure.test.ts (1 test)
✓ test/tasks-remind-now-mailer-failure.test.ts (1 test)
✓ test/contacts-bulk-email-mailer-failure.test.ts (1 test)
✓ test/review-remind-mailer-failure.test.ts (1 test)
Test Files  6 passed (6)
Tests  6 passed (6)
```
This task's brief named "the four *-mailer-failure tests"; two more
(`tasks-remind-now-mailer-failure.test.ts`,
`review-remind-mailer-failure.test.ts`) exist in this tree and also pass —
DEC-238's best-effort/continue mailer contract is exercised (and closed) for
all six send sites, a superset of the original four.

## Summary

| Finding | Status | Notes |
|---|---|---|
| B1 | PASS | |
| B2 | PASS | local walkthrough harness (`scripts/walkthrough/review.ts`) has an unrelated stale-field bug; API itself is correct |
| B3 | PASS | |
| CNT-07a (files library) | PASS | |
| CNT-07b (worklist counts) | **FAIL** | `ContentApp.tsx:43-48` reads `.items` from an endpoint shaped `{files:{...}}` — deliverable counts never populate, silently swallowed by a catch |
| CFP-06b (trackIds→names) | PASS | |
| CFP-06c (Format answer via includeAnswers) | PASS | |
| CFP-06a (Format column auto-show) | Not demonstrated | design-conformant exact-label match; seed's field is "Session format", not "Format"; also untested at unit level |
| ABS-10 | PASS | |
| A (mailer-failure tests) | PASS | 6 exist and pass (was 4) |

## Housekeeping (not this task's scope; flagging for the planner)

1. `scripts/walkthrough/review.ts`'s `QueueItem` interface (line 243-245)
   and its `queue.items.map((i) => i.id)` (line 437) are stale against the
   DEC-239 queue payload shape (`submissionId`, not `id`) — the module fails
   at "queue contains exactly the reviewer's assignment" every run. Product
   API is correct (see B2 above); only the harness script needs a one-line
   fix (`i.submissionId`).
2. `app/src/pages/content/ContentApp.tsx:43-48` vs.
   `src/routes/files.ts:146-151` response-shape mismatch — see CNT-07b
   above. This silently zeroes every worklist deliverable-count cell.
3. CFP-06a / DEC-243's Format-column auto-show is unreachable with the
   current seed data (`scripts/seed.ts:367` labels the field "Session
   format") and has no unit test for `findFormatField`/the auto-show effect
   in `SubmissionsTable.tsx`.
