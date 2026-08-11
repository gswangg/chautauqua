# task-w2-f - triage-closure @ e4e7b03

FROZEN SHA: e4e7b03d43cb5903064c0d1563aa03a572255628

DEC-256 freeze derivation: waited (loop, <15 min, actual ~7 min) for every
`refs/heads/task-w1-*` branch to become an ancestor of `main`. `task-w1-e`
and `task-w1-g` were briefly NOT ancestors while their merges were still in
flight; once `task-w1-f`'s merge landed (and `task-w1-e`/`task-w1-g` were
pruned post-merge, leaving only `task-w1-f` as a ref), `git branch --list
'task-w1-*'` showed a single remaining branch, `task-w1-f`, which IS an
ancestor of `main`. With the wait condition satisfied, `S` = the newest
`main` first-parent commit that touches anything outside
`{decisions/, field-guide/, docs/verification-log/, docs/eval-findings.md,
src/decisions.ts}`. Walking `git log --first-parent main` and
`git diff-tree --no-commit-id --name-only -r -m --first-parent <sha>` for
each commit from the tip down: `e4e7b03` ("merge task-w1-f") is the first
commit whose diff includes non-excluded paths (`app/src/pages/contacts/
ImportWizard.tsx`, `app/src/pages/contacts/csv.ts`/`csv.test.ts`,
`src/server/repo/contacts.ts`, `test/contacts-add-to-event.test.ts`,
`app/src/pages/content/VersionList.tsx`/`.render.test.tsx`,
`app/src/pages/content/version-chain.ts`/`.test.ts` — all real product/test
files). `FROZEN SHA: e4e7b03d43cb5903064c0d1563aa03a572255628`.

All read-only inspection below was done against a detached `git worktree
add --detach <scratch>/verify-S e4e7b03d43cb5903064c0d1563aa03a572255628`
(outside both the base repo and this task's worktree — no product commit,
no server booted, matches the section's read-only mandate) so that `npx
vitest run <file>` results are provably taken at the frozen tree, not at
whatever commit this branch happened to be cut from.

## STEP 1 — every `docs/verification-log/task-w1-*.md` present at S

Eight files exist at S, one per DEC-254 browser-persona lane (a-h, covering
J1-J12). All eight carry both machine-greppable lines; quoted verbatim:

- `task-w1-a-origin-walkthrough.md` (DEC-252 origin fix + walkthrough):
  `## OPEN ITEMS: 0` / `## RESULT: PASS`
- `task-w1-b-mobile.md` (DEC-253 mobile pass + render-sweep extension):
  `OPEN ITEMS: 0` / `RESULT: PASS`
- `task-w1-c-producer-browser.md` (J1/J3/J5, 0 files touched, 0 defects):
  `OPEN ITEMS: 0` / `RESULT: PASS`
- `task-w1-d-review-browser.md` (J4 committee review):
  `OPEN ITEMS: 0` / `RESULT: PASS`
- `task-w1-e-speaker-content-browser.md` (J6/J7/J8):
  `## OPEN ITEMS: 0` / `## RESULT: PASS — organizer onboarding/reminders
  (J6), speaker portal/profile/invitations/scoping (J7), and organizer
  Content review/versioning/comments/approval-gating (J8) all verified
  working end-to-end...`
- `task-w1-f-crm-browser.md` (J11 speaker CRM):
  `OPEN ITEMS: 0` / `RESULT: PASS`
- `task-w1-g-agenda-browser.md` (J9 agenda, 0 files touched, 0 defects):
  `OPEN ITEMS: 0` / `RESULT: PASS`
- `task-w1-h-data-settings-browser.md` (J12 own-your-data + Settings):
  `OPEN ITEMS: 0` / `RESULT: PASS`

No wave-1 lane merged without a log, and no log is missing either line —
DEC-254's "one log per lane" requirement is satisfied. No lane-naming open
item to raise here.

## STEP 2 — disposition of every open item wave-1 logs raise

Every wave-1 log's own machine-greppable count reads `OPEN ITEMS: 0`, but
per the task's instruction to disposition every item the logs *raise* (not
just the ones counted in their own header), two logs additionally admit
real, unfixed defects that were out of that lane's file authority and
explicitly not counted toward their own total. Both are dispositioned below
as this triage lane's own OPEN items, since a defect admitted-but-not-fixed
in the tree is exactly what STEP 2 exists to catch.

1. **Claimed fix: DEC-252 origin/absolute-link bug** (`task-w1-a`).
   CLOSED — `src/server/origin.ts` (`resolveBaseUrl`) exists at S;
   regression test `test/origin.test.ts` exists at S.
   `npx vitest run test/origin.test.ts` -> 10/10 pass.
   Companion on-page-relative-link case in
   `test/claim-onscreen-scope.test.ts` also exists and passes (4/4).

2. **Claimed fix: DEC-253 mobile 390x844 zero-overflow + 40px tap targets**
   (`task-w1-b`). CLOSED — `scripts/render-sweep-lib.ts`
   (`evaluateMobileRoute`) exists at S; regression test
   `test/render-sweep-lib.test.ts` exists at S.
   `npx vitest run test/render-sweep-lib.test.ts` -> 21/21 pass. (The
   full Playwright `gate:render-sweep` mobile pass itself is a server-
   booting gate and is out of this read-only section's scope; the unit-
   level pass-criteria logic it depends on is what's verified here, per
   the "regression test file that locks it" requirement.)

3. **Claimed fix: reviewer-assignment `PlanEditor` shows raw `userId`
   instead of email immediately after Assign** (`task-w1-d`). CLOSED —
   fix at `app/src/pages/review/PlanEditor.tsx` (`assignReviewer` resolves
   email from `reviewerOptions` before appending to state); regression
   test `app/src/pages/review/PlanEditor.render.test.tsx` exists at S.
   `npx vitest run app/src/pages/review/PlanEditor.render.test.tsx` ->
   3/3 pass.

4. **Claimed fix: Content version-chain cross-chain mislabeling**
   (`task-w1-e`). CLOSED — fix at `app/src/pages/content/version-chain.ts`
   (`orderVersionChains`) and `app/src/pages/content/VersionList.tsx`
   (per-chain numbering); regression tests
   `app/src/pages/content/version-chain.test.ts` and
   `app/src/pages/content/VersionList.render.test.tsx` exist at S.
   `npx vitest run app/src/pages/content/version-chain.test.ts
   app/src/pages/content/VersionList.render.test.tsx` -> 12/12 pass.

5. **Claimed fix: CSV import full-name column silently drops last name**
   (`task-w1-f`). CLOSED — fix at `app/src/pages/contacts/csv.ts`
   (`FULL_NAME_TARGET`/`splitFullName`/`expandFullNameMapping`) and
   `app/src/pages/contacts/ImportWizard.tsx`; regression test
   `app/src/pages/contacts/csv.test.ts` exists at S.
   `npx vitest run app/src/pages/contacts/csv.test.ts` -> 20/20 pass.

6. **Claimed fix: "Add to event" (`pushContactToEvent`) creates the
   submission pre-accepted, bypassing the onboarding-task planner so the
   pushed speaker never appears in the Speakers/onboarding grid**
   (`task-w1-f`). CLOSED — fix at `src/server/repo/contacts.ts`
   (`pushContactToEvent` now inserts `pending` then drives to `accepted`
   via `updateSubmissionStatuses`); regression test
   `test/contacts-add-to-event.test.ts` exists at S.
   `npx vitest run test/contacts-add-to-event.test.ts` -> 6/6 pass.

7. **Claimed fix: `/docs/api` route-coverage drift (12 mounted-but-
   undocumented routes)** (`task-w1-h`). CLOSED — fix at
   `src/routes/docs.tsx` (`ROUTE_GROUPS` extended); regression test
   `test/docs-route-coverage.test.ts` exists at S (mounts every real
   `/api/v1` sub-app and asserts mounted == documented).
   `npx vitest run test/docs-route-coverage.test.ts` -> 2/2 pass.

8. **Admitted, NOT fixed: co-presenter add renders blank Name/Email until
   next page load** (flagged by `task-w1-e`, out of that lane's file
   authority — `app/src/pages/submissions/SubmissionDetailPage.tsx`,
   `src/routes/api/submissions.ts`, `src/server/repo/participants.ts`).
   Verified still present at S:
   `src/server/repo/participants.ts`'s `inviteParticipant` (around
   `contactId`/`role`/`order`/`visible`/`inviteStatus`, line ~84) returns
   `{ id, contactId, role, order, visible: true, inviteStatus: "invited" }`
   with no name/email projection, and
   `app/src/pages/submissions/SubmissionDetailPage.tsx:234-237` appends
   that raw POST response directly to `detail.participants` local state.
   No regression test exists guarding a populated name/email on the
   optimistic-append path (only a reload/refetch shows it correctly).
   **OPEN** — real defect still in the tree, no test present, not waived
   by any decision. Counted in this lane's OPEN ITEMS total below.

9. **Admitted, NOT fixed: Contacts directory search is single-field
   substring, so a two-word query like "Priya Raman" (first + last) does
   not match** (flagged by `task-w1-e`, out of that lane's file authority
   — `src/server/repo/contacts.ts`). Verified still present at S:
   `listContacts`'s `q` filter (`src/server/repo/contacts.ts:317-328`) ORs
   a single `LIKE %q%` across `firstName`/`lastName`/`email`/`company`
   independently — no substring of the combined "first last" query is
   attempted against any single column, so a full-name query matches
   nothing unless one column alone contains the whole query string. No
   regression test exists for multi-word full-name search (grepped
   `test/` and `app/src` for "multi-word"/"full-name search"/
   "fullNameSearch" — only an unrelated CSV-import "keeps multi-word
   surnames together" hit). **OPEN** — real defect still in the tree, no
   test present, not waived by any decision. Counted below.

No wave-1 lane logged a claimed fix without also shipping the regression
test it names; items 1-7 are the full set of claimed fixes and all seven
are CLOSED with a passing test. Items 8-9 are the full set of admitted,
never-picked-up defects; both are OPEN.

## STEP 3 — re-disposition of `docs/eval-findings.md` against the frozen tree

The frozen tree's `docs/eval-findings.md` ("Production round") has exactly
four lettered sections, A-D — there is no Section E or Section F in the
file at S (confirmed: `grep -n '^## [A-Z]\.' docs/eval-findings.md` at S
returns only `## A.`, `## B.`, `## C.`, `## D.`; the field guide's
"DEC-069/139/176/189/195/206/223/251" citation chain is this same A-D
file's disposition history, not evidence of E/F sections ever existing in
the current file). Restating the existing chain's disposition per-item,
not re-opening anything:

- **Section A** (2 items: PBKDF2 100k cap; best-effort confirmation email).
  Both RATIFIED with regression tests present at S: `ITERATIONS = 100_000`
  at `src/auth/password.ts:16`, test `test/password-iterations.test.ts`
  (`npx vitest run` -> pass); best-effort mailer at
  `src/routes/public/submit.tsx:604-615` (`try`/`catch`, logs an `error`
  email_log row, submission already persisted), test
  `test/submit-mailer-failure.test.ts` (`npx vitest run` -> 1/1 pass, plus
  the 3 other tests in the same run from `test/password-iterations.test.ts`
  — 4/4 total). CLOSED.
- **Section B** (3 P1s: reviewer-assignment "User not found"; reviewer
  queue `/submissions/undefined`; CRM duplicate-merge no-op). All three
  CLOSED, corroborated by live-browser evidence in `task-w1-d` (reviewer
  assignment + queue links, both scopes) and `task-w1-f` (merge dialog
  success banner, row count drop 33->32) at S, plus present regression
  coverage: `test/contacts-duplicates-merge-route.test.ts` and
  `app/src/pages/contacts/DuplicatesView.render.test.tsx`
  (`npx vitest run` -> 4/4 pass). Reviewer-assignment/queue fixes predate
  this wave (already-fixed-and-verified per `task-w1-d`'s log, not a new
  fix in this wave) — restated CLOSED, not re-opened.
- **Section C** (4 P2s: deliverables dashboard vs. Files-tab disagreement;
  no file version history; no file comment threads; submissions
  table track-count/no-format column + review-results dropdown-column/
  sort). All CLOSED per DEC-240/DEC-243/DEC-249 (cited by the field guide
  as already-landed) and re-confirmed live at S in `task-w1-e` (Files tab
  and worklist agree on the same task-uploaded file, version chain fixed
  this wave with tests per STEP 2 item 4) and `task-w1-d` (results table
  Average-column sort control is live, dropdown criterion renders its own
  per-option-distribution column separate from Average, CSV export header
  confirms the same non-folded shape). File comment threads confirmed
  live end-to-end (organizer comment -> speaker portal thread -> speaker
  reply) in `task-w1-e`.
- **Section D** (8 P3 items, D1-D8). Per DEC-251 (binding, cited by the
  field guide): D1/D2/D3/D4/D6 FIXED with cited evidence
  (`?draft=saved` banner, `SegmentsPanel.tsx` `onDeletedActiveSegment`,
  `?headshot=1` notice + preview `<img>`, portal deliverable panel,
  `ReviewerQueue.tsx` `ratingsCount`) — restated CLOSED, not re-opened.
  D5 (stale Content>Files load) and D8 (first-login double-click) WAIVED
  by DEC-251 itself (production-infra-only / not locally reproducible;
  PBKDF2 cost already reduced to 100k). D7 (broad a11y audit) WAIVED by
  DEC-251 as polish beyond the findings-closure bar, with its concrete
  sub-complaints (ColumnPicker labeling, criteria-editor draft
  persistence) already fixed. Restated verbatim, not re-opened.

No new eval-findings.md disposition was invented, and nothing was re-opened
that the DEC-069/139/176/189/195/206/223/251 chain already closed or
waived.

## STEP 4 — ref hygiene, as-is

`.git/refs/heads` in the base repo at the time of this check (after the
freeze-wait loop completed and while wave-2 sibling lanes were still
running):

```
main
task-w2-e
task-w2-f
task-w2-g
task-w2-h
task-w3-a
```

- `main`: n/a (the base branch).
- `task-w2-e`, `task-w2-f`, `task-w2-g`, `task-w2-h`: all ANCESTORS of the
  current `main` tip (`f3d0140f...`) at check time — expected mid-battery,
  since this wave's own log-only lanes commit forward-only appends to
  `main` as they land; not a failure.
- `task-w3-a`: a wave-3 branch already exists (base repo cut a new lane
  before this wave-2 battery finished). Not this section's scope to judge;
  noted as-is per the task's instruction, not treated as a failure.
- No stray `task-w1-*` branch remains — all of them (`task-w1-a` through
  `task-w1-h`) were fully merged and pruned by the time of this check,
  consistent with STEP 1's finding that every wave-1 log exists on `main`.

`main` moved forward twice during this task's freeze-wait/verification
window (observed tips `e4e7b03` -> `f3d0140` -> further, per DEC-256's
expectation that sibling lanes keep landing during a mid-battery section).
Re-deriving `S` at the very end against the-then-current `main` tip: the
newest first-parent commit on `main` is `f3d0140...` (or later), but its
diff touches only `decisions/DEC-258.md`..`DEC-261.md`,
`field-guide/index.md`, `src/decisions.ts` — every path in the DEC-256
exclusion set. Walking back from there, `e4e7b03d43cb5903064c0d1563aa03a572255628`
remains the newest commit touching anything outside the exclusion set.
**Re-derived S == original S — no drift.**

## OPEN ITEMS: 2

## RESULT: FAIL - all 7 fixes wave-1 lanes claimed are CLOSED with a
present, passing regression test (see STEP 2 items 1-7), and every
`docs/eval-findings.md` A-D item restates CLOSED/WAIVED against the frozen
tree per the existing DEC-069/139/176/189/195/206/223/251 chain with no
re-opening (STEP 3). But two real defects that wave-1's own `task-w1-e` log
admitted and explicitly left unfixed (out of that lane's file authority) —
the co-presenter blank-name-until-reload optimistic-update bug in
`SubmissionDetailPage.tsx`/`participants.ts`, and the Contacts directory
single-field substring search that misses multi-word full-name queries in
`src/server/repo/contacts.ts` — are still present in the frozen tree with
no fix and no regression test guarding either. Per DEC-254's "a claimed fix
with no test present is an OPEN ITEM" and this section's own mandate to
disposition *every* open item the wave-1 logs raise, both are dispositioned
OPEN, not CLOSED or WAIVED (no decision waives either), so stage-1 cannot
be declared complete from this battery: OPEN ITEMS: 2.
