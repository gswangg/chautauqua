# w41 falsifiability batch B (DEC-358 wave-41 amendment)

Source: the `### DO-NOT-RE-FILE (carried, waves 14-23...)` block in
`docs/eval-findings.md` (~lines 362-407), a run-on paragraph of code-shape
citations with no exercised check named, closed "UNFALSIFIABLE — owner:
wave-40 lane". This mandate discharges eight of its claims (six via
existing tests, two via a new test file) by opening both the cited
artifact and a candidate test and confirming (or, where none existed,
adding) an assertion against the real function's observable behavior. The
two new-test items surfaced no actual defect — both were genuine test-
coverage gaps against code that, once exercised, behaves exactly as the
DO-NOT-RE-FILE claim/RULING comment describes — so there is nothing to
file under GAPS for either.

## Discharged claims

- **`createUser` insert-then-select onConflictDoNothing race guard**
  (`src/server/repo/users.ts:98-129`, DEC-552) — no existing test reached
  this branch (every existing conflict case is caught earlier by the
  pre-insert duplicate-email SELECT). FALSIFYING CHECK: NEW —
  `test/tier0-falsifiability-legacy.test.ts`,
  `describe("createUser onConflictDoNothing race guard")`, `it("throws the
  same ApiError('conflict') as the pre-check when the post-insert
  re-select comes up empty")` — a fake db returns no pre-existing row at
  dup-check time (so the fast-path check passes) and a no-op
  `onConflictDoNothing()` followed by an empty re-select-by-id (modeling a
  concurrent insert winning the race for this exact id); asserts the same
  `ApiError('conflict', {email: "already in use"})` the pre-check throws,
  drives the specific race-guard branch DEC-552 describes.

- **`send.ts`'s unconditional `bumpIcsSequences`, ruled deliberate**
  (`src/routes/comms/send.ts:243-258`) — the RULING comment claims the
  bump stays unconditional over the full `submissionIds` set even when a
  submission's only recipient was skipped by dedupe; no existing test
  built that scenario with `attachIcs: true`. FALSIFYING CHECK: NEW —
  `test/tier0-falsifiability-legacy.test.ts`,
  `describe("send.ts unconditional bumpIcsSequences")`, `it("bumps a
  submission whose ONLY recipient was skipped by cross-call dedupe, same
  as one that actually sent")` — sends once to prime the dedupe window,
  then a second call selecting `["sub-1", "sub-2"]` with `attachIcs: true`
  where sub-2's sole recipient is fully skipped (`sent: 1`, one entry in
  `skipped`); asserts `bumpIcsSequences` was called exactly once with both
  submission ids, including the fully-skipped one.

- **Bulk-email two-stage dedupe** (`src/routes/api/contacts/bulk-email.ts:214-250`,
  DEC-238) — FALSIFYING CHECK: `test/contacts-bulk-email-dedupe.test.ts`,
  `it("two contact rows sharing one email in a single batch produce exactly
  one send, with skipped===1")` (intra-batch stage) and `it("an immediate
  second identical POST sends zero and reports skipped for every
  recipient")` (cross-call COMPOSE_DEDUPE_WINDOW_MS stage, backed by a
  `repo.loadRecentlySent` mock reading a `loggedRows` array written by the
  first call) — both stages of the two-stage dedupe are exercised directly
  against the real route, not a shape guess.

- **Breaks validation accumulates rather than first-error-wins**
  (`src/routes/api/breaks.ts:130-166`) — FALSIFYING CHECK:
  `test/schedule-breaks.test.ts`, `it("accumulates day, label, startMin,
  and durationMin problems into one 400")` — POSTs a body with all four
  fields simultaneously invalid (`day: "not-a-day"`, `label: ""`,
  `startMin: -1`, `durationMin: MINUTES_PER_DAY + 1`) and asserts all four
  land in `error.fields` on a single 400 response with zero rows written —
  directly falsifies a first-error-wins implementation.

- **`MAX_PARTICIPANTS_PER_SUBMISSION` binds all four participant-writer
  doors** (`src/routes/api/submissions.ts:598`,
  `src/server/repo/portal-edit.ts:487`,
  `src/routes/api/contacts/import.ts:194`,
  `src/server/repo/import/sessionboard.ts:622`) — FALSIFYING CHECK: each
  door is exercised at the cap boundary against the SAME imported constant
  (no door has its own hardcoded number): `test/api-participants.test.ts`
  `it("rejects a 7th organiser invite once the submission is already at
  MAX_PARTICIPANTS_PER_SUBMISSION, writing nothing")`;
  `test/portal-copresenter.test.ts` `it("caps at 5 co-presenters and
  surfaces the cap as a field error, not a crash")`;
  `test/contacts-import-participant-cap.test.ts` `it("refuses a roster
  import whose batch would exceed the cap, WITHOUT writing any contact row
  or submission")`; `test/sessionboard-participant-cap.test.ts` `it("writes
  exactly up to the cap and reports the surplus rows in skipped with a
  reason naming the cap")`. All four import
  `MAX_PARTICIPANTS_PER_SUBMISSION` from `src/domain/participant-roles`
  rather than a local literal, so the four assertions are pinned to one
  shared value, not four independently-drifting numbers.

- **Mail envelope via `addressValue`** (`src/mail/email-binding.ts:236-240`)
  — FALSIFYING CHECK: `test/mail-envelope-address.test.ts`, `it.each(...)`
  "strips the hostile %s from the envelope, identical to the header" —
  constructs an `EmailBindingMailer` with a hostile (comma/angle-bracket)
  address, captures the envelope `from`/`to` args passed to the raw
  binding, and asserts they equal `addressValue(dirtyAddress)` AND are
  byte-identical to the address rendered inside the raw MIME's `To:`/`From:`
  headers — plus a static scan asserting every address-position
  interpolation in `email-binding.ts`/`ics.ts` is `addressValue(...)`-
  wrapped. Directly exercises the real mailer, not a signature check.

- **Duplicate `trackIds` deduped on BOTH write doors** (DEC-598) —
  FALSIFYING CHECK: `test/submission-tracks-are-a-set.test.ts`,
  `describe("POST /api/v1/events/:eventId/submissions dedupes trackIds")`
  `it("a repeated valid track id inserts ONE join row, never a 500")` (organizer
  door, `src/routes/api/submissions.ts`) and
  `describe("public CFP POST dedupes trackIds and never rolls back on a
  duplicate")` `it("a repeated valid trackId succeeds with ONE
  submission_track row, no rollback")` (public door,
  `src/routes/public/submit-body.ts`) — both doors asserted to produce
  exactly one join row from a repeated id, against the real route/db, not
  a shared-helper existence check.

- **Saved-view cap predicate is authorship, not visibility**
  (`src/routes/api/views.ts:87`, DEC-422) — FALSIFYING CHECK:
  `test/saved-view-cap-authorship.test.ts`, `it("organiser B can still
  create a view when A alone authored MAX shared views")` and `it("refuses
  B once B's OWN views reach the cap, with the authorship-scoped copy")` —
  two organisers in the same org/event, real sqlite-backed
  `countSavedViewsCreatedBy`, asserting the cap counts only the caller's
  own authored rows (not every visible shared row) — a visibility-scoped
  implementation would fail both assertions.

## STILL UNFALSIFIABLE

Verbatim carry-forward of `DO-NOT-RE-FILE` claims not reached this wave
(not one of the eight discharged above; not re-checked beyond the
citations already in the block): `answerFieldRoleCondition` missing event
join — DISMISSED, DEC-592 wave-18 amendment
(`src/server/repo/form-roles.ts:16`);
`countEvaluationsBySubmission`'s whole-plan map — DISMISSED, DEC-449;
reviewer plan window on lone-submission read + file authz
(`src/routes/review/reviewer.ts:288`,
`src/server/repo/files-authz.ts:185-209`, DEC-018); `task-w14-d` AUTH_CSS
`.chq-field-invalid` cascade (`app/src/components/error-states.css:31`,
DEC-124 wave-14 amendment); `task-w15-c/d` `updateEvent` slug guard
(`src/server/repo/events.ts:224-259`, DEC-111); `task-w15-d` sessionboard
participant cap (`src/server/repo/import/sessionboard.ts:620-627`,
DEC-604); `task-w15-b` send.ts intra-batch collapse
(`src/routes/comms/send.ts:125-138`, DEC-238); `task-w8-c` review round
name+window (`app/src/pages/review/ReviewerQueue.tsx:31,508`); `task-w8-d`
compose step-1 slot+footer
(`app/src/pages/comms/ComposeWizard.tsx:713-716,1226-1230`); `task-w8-b`
Submissions→Comms `?ids=` handoff
(`app/src/pages/submissions/BulkActionBar.tsx:77`); `task-w8-e` Comms
History pager (`app/src/pages/comms/HistoryTab.tsx:42-160`); `task-w10-b`
MERGED; `task-w17-b` perf-seed/perf-smoke harness bugs MERGED
(`956fe263`); `task-w23-e` frame-citation quoting audit MERGED
(`c0fe6948`); `task-w18-b/c/d/e/f/g` (reviewer-scope, compose defaults,
History Export, files-library table-layout, templates Delete,
ENVELOPE_ALLOWLIST) all MERGED between `956fe263` and `39ac22d0`;
`task-w23-f` MERGED via `f519f562` (DEC-902 column contract + DEC-937
review phone label). This remainder is still UNFALSIFIABLE — owner: next
falsifiability-batch lane.

## GAPS FOR THE NEXT CODE WAVE

None found. Both items that required a new test (`createUser`'s
onConflictDoNothing race guard and `send.ts`'s unconditional
`bumpIcsSequences`) turned out, once actually exercised, to behave exactly
as their doc comment / RULING claimed — a coverage gap, not a behavioral
defect. See `test/tier0-falsifiability-legacy.test.ts` for the assertions
that now pin both.
