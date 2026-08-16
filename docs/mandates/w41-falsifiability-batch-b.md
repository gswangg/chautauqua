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

Verbatim carry-forward of `DO-NOT-RE-FILE` claims not reached that wave,
now adjudicated by `task-w49-g` (DEC-358: this branch is the owner named
by the census, not a re-filing). `answerFieldRoleCondition` missing event
join — DISMISSED, DEC-592 wave-18 amendment
(`src/server/repo/form-roles.ts:16`); `countEvaluationsBySubmission`'s
whole-plan map — DISMISSED, DEC-449. Neither dismissal is reopened here
per task-w49-g's instructions.

**DISCHARGED — w49-g, all four server-side items re-confirmed TRUE at
runtime; three already had a real, exercised, non-tautological check
in-tree (re-confirmed passing, not re-filed as gaps), one gained a new
independent DB-level check:**

- `task-w15-c/d` reviewer plan window on lone-submission read
  (`src/routes/review/reviewer.ts:288-334`) + file-authz twin
  (`src/server/repo/files-authz.ts:185-209`, DEC-018) — FALSIFYING CHECK
  (pre-existing, re-confirmed): `test/review-plan-window-reads.test.ts`
  (`describe("DEC-018 (wave-10): review-plan window gates detail GET +
  recusal writes")` and `describe("reviewerCanAccessSubmissionFile —
  DEC-018 ...")`) — a real Hono app + a fake queue-shaped db, exercising
  both the route's 409 and `reviewerCanAccessSubmissionFile`'s
  true/false directly across closed/not-yet-open/unbounded windows.
- `task-w15-c/d` `updateEvent` slug guard (`src/server/repo/events.ts:224-259`,
  DEC-111) — FALSIFYING CHECK: `test/events-update-slug-race.test.ts`
  (pre-existing, route-level, a fake thrown error mimicking the D1 shape)
  PLUS new `test/tier0-falsifiability-w49-batch-b.test.ts`
  (`describe("DEC-111: updateEvent slug guard -- real sqlite UNIQUE index,
  not a mocked error shape")`) — calls the real (unmocked) `updateEvent`
  against a real `node:sqlite` `DatabaseSync` with the actual
  `event_slug_idx` UNIQUE index, so the translated `ApiError('invalid',
  {slug: ...})` is driven by a genuine SQLite constraint violation, not a
  fabricated error object. Confirmed falsifying: reverting the
  try/catch translation (verified at runtime, then reverted) surfaces the
  raw `DrizzleQueryError`/SQLite cause instead.
- `task-w15-d` sessionboard participant cap
  (`src/server/repo/import/sessionboard.ts:620-627`, DEC-604) —
  FALSIFYING CHECK (pre-existing, re-confirmed):
  `test/sessionboard-participant-cap.test.ts` — exercises
  `applySessionboardPlans` directly (both the real-run and dryRun paths)
  against `MAX_PARTICIPANTS_PER_SUBMISSION`.
- `task-w15-b` send.ts intra-batch dedupe collapse
  (`src/routes/comms/send.ts:125-138`, DEC-238) — FALSIFYING CHECK
  (pre-existing, re-confirmed): `test/comms-send-dedupe.test.ts`
  (`describe("... intra-batch dedupe (DEC-238 wave-15 amendment)")`) —
  a real Hono app against the real send route, three scenarios: same
  address+subject collapses to one send; a different per-submission
  subject sends both; the intra-batch stage runs before the cross-call
  window stage.

**DISCHARGED — w49-g, UI items, with remaining budget after the four
server-side items:**

- `task-w8-b` Submissions→Comms `?ids=` handoff
  (`app/src/pages/submissions/BulkActionBar.tsx:77`) — FALSIFYING CHECK
  (pre-existing, re-confirmed): emit side,
  `app/src/pages/submissions/BulkActionBar.render.test.tsx`'s
  `it('links "Email these N submissions" to
  /comms?tab=compose&ids=<selection>')`; receive side,
  `app/src/pages/comms/ComposeWizard.idsParam.render.test.tsx`'s
  `describe('ComposeWizard ?ids= landing')` (hydration, over-cap
  truncation, garbage-id tolerance).
- `task-w8-e` Comms History pager (`app/src/pages/comms/HistoryTab.tsx:42-160`)
  — FALSIFYING CHECK (pre-existing, re-confirmed):
  `app/src/pages/comms/HistoryTab.render.test.tsx`'s `it('paginates: shows
  the summary, Previous disabled on page 1, Next fetches page 2, and a new
  search returns to page 1')` — drives the real component's
  Previous/Next buttons and asserts the real fetch calls carry `page=2`/
  `page=1`.
- `task-w8-c` review round name+window
  (`app/src/pages/review/ReviewerQueue.tsx:31,508-516`) — NEW FALSIFYING
  CHECK: `app/src/w49-batch-b.render.test.tsx`,
  `describe('ReviewerQueue plan-scoped subtitle: round name + window
  (DEC-147/DEC-522)')` — no prior render-test fixture ever set
  `rounds > 1`, so the round-name branch of the subtitle was never
  actually rendered before this check. Two tests: a `rounds: 2` envelope
  renders both the round's resolved name AND the closes-in-N-days window
  in scope→round→window order; a `rounds: 1` envelope with the identical
  `roundMeta` present never composes the round name in, proving the gate
  is live, not decorative.
- `task-w8-d` compose step-1 slot+footer
  (`app/src/pages/comms/ComposeWizard.tsx:713-716,1226-1230`) — the
  step-1 slot half (`"1. Pick submissions"`) was already asserted present
  in five existing tests (`ComposeWizard.idsParam.render.test.tsx`,
  `Comms.render.test.tsx`, `ComposeWizard.render.test.tsx`,
  `ComposeWizard.templateParam.render.test.tsx`). The footer half
  (`:1226-1230`, the send-step per-row unscheduled-recipient list) had
  only a NEGATIVE assertion (`ComposeWizard.render.test.tsx:1289`,
  `queryByText(/have no slot yet/)).not.toBeInTheDocument()` for the
  all-scheduled case) — nothing positively asserted the footer's actual
  content. NEW FALSIFYING CHECK: `app/src/w49-batch-b.render.test.tsx`,
  `describe('ComposeWizard attachIcs footer: names the exact unscheduled
  rows (DEC-954)')` — two recipients, exactly one unscheduled; asserts the
  send-step footer names that row's ref (`DFC-014`) and name (`Priya
  Raman`) and does NOT name the scheduled row's ref/name.

Nothing remains undischarged from this list except the two already-ruled
DISMISSED items above (never reopened) and the `task-w10-b`/`task-w17-b`/
`task-w23-e`/`task-w18-b..g`/`task-w23-f` lines, which this mandate's own
prior text already recorded as MERGED (verified again this wave, not
re-checked beyond that citation).

## GAPS FOR THE NEXT CODE WAVE

None found. Both items that required a new test (`createUser`'s
onConflictDoNothing race guard and `send.ts`'s unconditional
`bumpIcsSequences`) turned out, once actually exercised, to behave exactly
as their doc comment / RULING claimed — a coverage gap, not a behavioral
defect. See `test/tier0-falsifiability-legacy.test.ts` for the assertions
that now pin both.
