## 2026-08-15 task-w42-d — content-lifecycle adjudication @ e01f237e

QUALIFYING

INVALIDATED BY: src/** app/src/** migrations/** package.json

FILE, NEVER FIX (DEC-453 w42, frozen wave): no product-code byte touched.
`git merge --no-edit main` from worktree branch tip: "Already up to date."
`npm run ref-state` receipt: HEAD `e01f237e`; newest first-parent
product-code-bearing sha `ed5c679e`; every live ref (`main`, `manual-qa`,
`task-custodian-w68-4`, `task-w40-e`, `task-w40-g`, `task-w41-c`,
`task-w42-a`, `task-w42-c`, `task-w42-d`, `task-w68-d`, `task-w71-c`,
`task-w71-d`, `task-w71-e`) confirmed ancestor of HEAD. NON-ancestor refs
(unrelated older/parallel work): `mail-rich-shape-fallback`, `task-w17-i`,
`task-w41-a/b/d/e/f`, `task-w68-b/c/e`, `task-w71-a`, `task-w72-a`
through `task-w72-j`.

### Claim 1 — re-upload silently unpublishes a live session; no producer signal

The REOPEN itself is deliberate, DEC-020's wave-60 amendment: "a new
deliverable version REOPENS content review — approved/changes_requested
returns to pending on upload" (decisions/DEC-020.md line 5-7), reasoned
explicitly against public-gate exposure (gates.ts's `content_status='approved'`
requirement, DEC-274). Not re-litigated here.

The claim's factual premise — "the portal path (tasks.tsx:481) has none [no
uploader-facing disclosure], and there is no producer-facing signal" — does
not hold against the current tree. Verified at the cited files:

- Speaker portal upload (src/routes/portal/tasks.tsx:614-635): DEC-020's
  wave-10 amendment built exactly this — a pre-upload notice
  (`ReuploadReviewNotice`, src/routes/portal/tasks/views.tsx:187-199,
  rendered whenever `scope.deliverableKind` is non-null) stating the
  session leaves the public schedule pending re-approval, and a post-upload
  receipt via `?uploaded=<assignmentId>` on the redirect (tasks.tsx:629-634)
  when `submissionId` is non-null (i.e. a real deliverable, not a plain
  handout).
- Organizer/API upload (src/routes/files.ts:237): DEC-020's wave-58
  amendment made `reopenContentReview` return `{ reopened }` from the same
  UPDATE statement (files-content-status.ts:105-117) and the 201 carries
  `contentReviewReopened` (files.ts:237) plus `contentStatus: 'pending'`
  when true, consumed by app/src/pages/content/DeliverableDetail.tsx and
  UploadZone.tsx to disclose the same fact to whichever role (organizer or
  active-participant speaker) performed that upload.

So BOTH upload surfaces already disclose to their own uploader — the
"portal path has none" premise is false on main today (it may describe a
pre-wave-10/wave-58 tree state).

The narrower, real question — is a PRODUCER-facing signal (distinct from
the uploader's own disclosure) REQUIRED when the UPLOADER is the speaker,
not the organizer — was searched for and not found as an obligation:
SPEC.md has no "producer notification on content-status regression" line
(grep of "content.status|reopen" in SPEC.md returns only the version-chain
description at line 147 and an unrelated Forge-mirror bonus at line 368);
docs/clarifications.md (top of precedence, overrides all) has zero matches
for content-status/reopen/producer-notification vocabulary;
docs/sessionboard-reference/04-content-management.md documents SessionBoard's
own approval/version-chain behavior in full (sections 2-3) with no
reopen-on-reupload mechanic at all — DEC-020's reopen is this product's own
invention, so the reference source cannot obligate a signal for a behavior
it doesn't have. DEC-009's binding invariant ("status changes never
auto-email") forecloses the one obvious form a push signal could take.

What DOES already exist, independent of any new signal: Overview §03
(src/server/repo/overview.ts:247-268) is exactly `accepted AND
content_status='pending'` — the wave-60 amendment names this the
organizer's own queue, and it already surfaces a speaker-triggered reopen
without any additional wiring, the same way it surfaces an organizer's own
reopen. A producer who never has to be told because the fact is already on
the screen they use for this workflow is the DEC-020 wave-60 design intent
stated verbatim ("keeping 'approved' would trade a public-visibility bug
for producer blindness" — decisions/DEC-020.md line 15).

Verdict: NOT A CONFIRMED DEFECT. The reopen is deliberate and already
disclosed on both upload surfaces to their own uploader (wave 10 + wave
58); no SPEC/clarifications/sessionboard-reference text requires a
SEPARATE producer-facing push signal, DEC-009 forbids the auto-email form
such a signal would likely take, and the producer's existing "needs a
decision" queue (Overview §03 / content_status='pending' filter) already
surfaces the regression without a new mechanism. No amendment filed to
DEC-020: wave-10 and wave-58 already cover the ground this claim asks
about, and re-litigating a settled ruling with no new evidence is not
warranted.

### Claim 2 — acceptance back-fill silently overwrites selective task assignment

decisions/DEC-932.md already carries an on-point ruling: "Amendment
(findings wave 6): acceptance back-filling every event task to the newly
accepted is the DENSE model on purpose — affirmed, not a defect" (line
5-7). That amendment was filed against the SAME claim shape this task
describes (a review lens filing the back-fill as silently overwriting
`POST /api/v1/tasks/:id/assign` scoping) and rules it DELIBERATE: the J6
grid is speaker x task and dense by design; DEC-746's own createTask
back-fill (src/server/repo/tasks/crud.ts:326-329) already expands every new
task to every active accepted contact with no opt-out, so the acceptance
back-fill is the SAME model applied on the other axis (new contact, not
new task); and the SPA never calls the assign endpoint (re-verified today:
`grep -rn "tasks/\${" app/src` returns zero hits, confirming "zero call
sites" still holds on `e01f237e` as it did at wave 6). `POST
/api/v1/tasks/:id/assign` (src/routes/tasks.ts:449) is a real,
organizer/API-reachable capability — it is not dead code — but DEC-932
knowingly subordinates it to the dense back-fill model rather than the
back-fill contradicting an intended sparse-assignment feature the product
otherwise supports end-to-end.

The exercised check that pins this, already in tree and green today: `npx
vitest run test/onboarding-task-backfill.test.ts` — 7/7 passing (see
Verification below). In particular `"an already-complete assignment is
never UPDATEd or DELETEd by the back-fill pass"` (line 283-311) proves the
mechanism a selective assignment relies on for survival: the back-fill's
`onConflictDoNothing` (DEC-556 unique index) never touches an EXISTING
(task, contact) row regardless of its status, so a subset assignment made
via `/assign` is preserved verbatim for the contacts it already names —
the back-fill only ever ADDS missing pairs for newly-active participants,
which is exactly DEC-932's stated invariant text ("an active accepted
participant of this event holds a task_assignment for every task row the
event owns") applied to speakers who accept AFTER the selective `/assign`
call, not a mutation of the assignment the organizer made. This is the
intended "dense model" tension named in the wave-6 amendment, not a bug:
a task assigned to a subset today will still gain rows for every
LATER-accepted participant, by design, because there is no `task.audience`
scoping concept in the product (wave-6 amendment, final sentence). No new
test added — none of the three named-in-task candidates
(acceptance-due-dates, acceptance-write-burst, task-assignment-chunking)
target this invariant as precisely as onboarding-task-backfill.test.ts
already does, and DEC-932 already carries a wave-6 amendment closing this
exact claim, so a second amendment restating identical reasoning with no
new evidence was not filed.

Verdict: NOT A CONFIRMED DEFECT — DELIBERATE per DEC-932's own wave-6
amendment, re-verified against `e01f237e` (SPA still has zero `/assign`
call sites; `test/onboarding-task-backfill.test.ts` still green,
7/7).

### Verification

`npx vitest run test/exit-predicate-corpus.test.ts
test/verification-log-assemble.test.ts test/onboarding-task-backfill.test.ts`
— 3 files, 29 tests, all PASS.

RESULT: PASS — both review-lens claims investigated against SPEC.md,
docs/clarifications.md, docs/sessionboard-reference/**, and the binding
decisions (DEC-020, DEC-932); neither is a confirmed defect. Claim 1: the
reopen is deliberate (DEC-020 wave-60) and already disclosed to the
uploader on both surfaces (wave-10 portal, wave-58 organizer/API); no
producer-facing push signal is required by any authority source, and the
producer's existing content-approval queue (Overview §03) already surfaces
it. Claim 2: DEC-932's own wave-6 amendment already rules the back-fill's
subordination of selective assignment deliberate, and the exercised test
(`test/onboarding-task-backfill.test.ts`) still pins the mechanism
(existing rows never touched) that makes that ruling true on `e01f237e`.
No amendment filed to either DEC (nothing new to add — both were already
settled with matching reasoning); frozen-wave scope
(`src/**` `app/src/**` `migrations/**` `package.json`) left untouched.
OPEN ITEMS: 0

Full detail: `docs/verification-log/task-w42-d-content-lifecycle-adjudication-e01f237e.md`.
