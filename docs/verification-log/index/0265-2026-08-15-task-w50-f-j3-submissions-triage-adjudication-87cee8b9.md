## 2026-08-15 task-w50-f — J3 submissions-triage adjudication @ 87cee8b9

NOT QUALIFYING (docs-only — DEC-069)

INVALIDATED BY: src/** app/src/** migrations/** package.json

DOCS-ONLY ADJUDICATION (DEC-358 w50: J3 area no wave has ever owned). This
lane wrote nothing under `src/**`, `app/src/**`, `migrations/**` or
`package.json` (DEC-069 w50 freeze) — every clause below is read from the
tree at `87cee8b9` and, where the evidence standard calls for a test, an
EXISTING test was run (no new test files added to the worktree; running a
new ad-hoc test in this frozen wave would still be a src-adjacent write and
this lane's scope is adjudication, not fixing). Defects are FILED with
file:line + `owner: wave-51 lane`, never fixed here (DEC-453).

MEASURED_SHA = `87cee8b9` (`git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w50-f
rev-parse HEAD` = `87cee8b9fec30d190f93156c99ddf7011b68bc92`, worktree
branched directly off `main`'s tip, no other wave-50 lane's commits present
in this worktree at measurement time).

Population read (SPEC.md:108-112, J3): "any form answer as a column, saved
views, search, filters by track/format/status, bulk select -> bulk status
change... Status pipeline: pending -> accept-queue/decline-queue ->
accepted/declined... Manual session creation and cloning for invited
talks." Files read: `src/routes/api/submissions.ts`,
`src/server/repo/submissions/create.ts`, `src/server/repo/submissions/
query.ts`, `src/server/repo/submissions/status.ts`, `src/routes/api/
views.ts`, `src/server/repo/views.ts`, `app/src/pages/submissions/**`
(columns.ts, ViewTabs.tsx, SubmissionsTable.tsx), `src/server/repo/
files-authz.ts`, `src/routes/public/submit-post.tsx`, `src/db/schema/
content.ts`.

---

CLAUSE: any form answer as a column. `app/src/pages/submissions/
columns.ts:deriveColumnsFromFormFields` derives one ColumnDef per current
custom (non-locked) form field; `visibleColumns` filters the derived list
by a caller-supplied id set. CLOSES clean — no defect found in this
clause on its own.

CLAUSE: search / filters by track/format/status. `src/server/repo/
submissions/query.ts:73-157` (`parseListQuery`) bounds `q`
(MAX_SEARCH_QUERY_LENGTH), `trackId` (MAX_FILTER_ID_LENGTH), and validates
status tokens against `SUBMISSION_STATUSES` — read-side bounding per
DEC-417 (line 11: `void DEC_417`). Already covered by existing DEC
machinery; not re-adjudicated here as new territory.

CLAUSE: status pipeline pending -> accept-queue/decline-queue ->
accepted/declined, bulk select -> bulk status change.
`POST /api/v1/events/:eventId/submissions/status`
(`src/routes/api/submissions.ts:729-742`) calls
`updateSubmissionStatuses` (`src/server/repo/submissions/status.ts:506`).

NAMED QUESTION (2): is bulk status change set-based and provably free of a
mailer import? YES on both counts.
  - Set-based: `updateSubmissionStatuses` chunks the id lookup
    (`chunkIds(ids)` + `inArray`, lines 516-526), routes rows in-memory into
    at most three disjoint id lists (planIds/stampIds/restIds, lines
    537-574), and issues chunked batch UPDATEs/one set-based participant
    SELECT for onboarding planning (lines 576-589) — no per-row loop issuing
    its own DB round trip.
  - No mailer import: `status.ts:8-24`'s import list has no `mail` module
    specifier, and `test/status-change-mail-ledger.scan.test.ts` — a
    file-level static scan of every `src/routes/**` file for the
    co-occurrence of a STATUS_WRITER identifier (including
    `updateSubmissionStatuses`, ledgered at line 136) and a mailer identifier
    (`makeMailer`/`mailer.send`/an import from `.../mail/`) — asserts the
    population of route files matching BOTH equals a fixed, reasoned
    2-entry ledger (`content-notes.ts`, `tasks.ts`; neither is
    `submissions.ts`). Ran it plus the two clone tests that also touch this
    surface:

    `npx vitest run test/status-change-mail-ledger.scan.test.ts
    test/clone-participants.test.ts test/clone-submission-write-burst.test.ts`
    -> `Test Files  3 passed (3)` / `Tests  9 passed (9)`.

  CLAUSE CLOSES: not a defect. A revert that made `submissions.ts` both
  a status-writer AND a mailer-importer would fail
  `status-change-mail-ledger.scan.test.ts`'s
  "population... equals the ledger exactly" assertion
  (`test/status-change-mail-ledger.scan.test.ts:214-237`).

CLAUSE: manual session creation. `createSubmission`
(`src/server/repo/submissions/create.ts:98-141`) — optional contact,
`status` defaults to `'pending'`. Reachable from
`src/routes/api/submissions.ts` (organizer POST). No defect found.

CLAUSE: cloning for invited talks.
`cloneSubmission` (`src/server/repo/submissions/create.ts:175-263`).

NAMED QUESTION (1): does the verbatim `submission_answer` copy for a
`file`-kind form field alias/expose/allow mutation of the original's
uploaded file, and does file authz resolve through the answer or through
`file.submissionId`?

CONFIRMED-DEFECT. Evidence:
  - A `file`-kind answer's `valueJson` IS the uploaded file's row id, not a
    copy of file bytes or a submission-scoped pointer:
    `src/routes/public/submit-post.tsx:399-409` inserts the file row with
    `submissionId: submission.id` (the ORIGINAL submission) via
    `insertAttachmentFile`, then `cleaned[pf.fieldId] = fileId;` — the
    answer literally stores the file's id.
  - `cloneSubmission`'s answer-copy block
    (`src/server/repo/submissions/create.ts:214-228`) selects
    `{formFieldId, valueJson}` from `submission_answer` and re-inserts every
    row verbatim onto the new submission id, with no branch on the source
    field's `kind` — a `file`-kind answer's `valueJson` (the original
    fileId) is copied unchanged. No new `file` row is minted for the
    clone (confirmed also by `test/clone-participants.test.ts:176-179`'s
    assertion that `schema.file` is never inserted by `cloneSubmission`) and
    `file.submissionId` on the referenced row is never updated to point at
    the clone.
  - File authz resolves exclusively through `file.submissionId`, never
    through any `submission_answer` row: `getFileScope`
    (`src/server/repo/files-authz.ts:113-141`) loads the file by `fileId`,
    reads `fileRow.submissionId` (line 122, the ORIGINAL submission, per the
    point above), and calls `getSubmissionScope(db, fileRow.submissionId)`
    (line 129) to build the read/write participant populations used by
    `canAccessFile` (lines 149-168). The clone's own participant list
    (independently copied/filterable by `cloneSubmission`'s DEC-275 active-
    only rule, lines 230-260) is never consulted for this file.

  Consequence: the clone's copied answer still names the original file, but
  access to that file is gated on the ORIGINAL submission's participant
  population, not the clone's — a participant added to the clone after
  cloning (and never invited to the original) sees the answer but cannot
  download the file `canAccessFile` denies them (`readParticipantContactIds`
  come from the original); conversely a participant removed from the clone
  but still active on the original retains access via the original's scope.
  The two submissions silently diverge on who may read/write a file the
  clone's own answer still references, and `file.submissionId` is never
  re-pointed or the row re-copied. This is the identical failure shape to
  the field guide's MERGE REPOINTS, DELETE NULLS finding (DEC-979) — a
  clone should re-point or refuse, not silently alias.
  FILE:LINE: `src/server/repo/submissions/create.ts:214-228`,
  `src/server/repo/files-authz.ts:113-141`,
  `src/routes/public/submit-post.tsx:399-409`.
  OWNER: wave-51 lane.

CLAUSE: saved views (create/list/delete; DEC-031/DEC-904/DEC-422/DEC-975).

NAMED QUESTION (3): what happens to a saved view whose config names a
`formFieldId` that has since been deleted?

`isValidSavedViewConfig` (`src/server/repo/views.ts:38-58`) validates
`columns` as an array of bounded strings — it never checks a column id
against the live form-field population (no DB read at all; the function
takes no `db` argument). Nothing at write time or read time refuses a
config naming a now-deleted field. Consumption-side:
`app/src/pages/submissions/ViewTabs.tsx`'s `onApply(view.config)` feeds
`config.columns` straight into the page's visible-field-id set, and
`visibleColumns(columns, visibleFieldIds)` (`app/src/pages/submissions/
columns.ts:31-35`) filters the CURRENT `columns` list (derived fresh from
the CURRENT live form fields via `deriveColumnsFromFormFields`) by that id
set — a stale id simply matches nothing in the current list and is dropped.
RESULT: silent narrowing (a smaller-than-saved column set), never a throw,
never a refusal, never a visible "missing field" indicator. FILE:LINE:
`src/server/repo/views.ts:38-58`, `app/src/pages/submissions/
columns.ts:31-35`, `app/src/pages/submissions/ViewTabs.tsx` (`onApply`
call site). NOT adjudicated as a defect: no DEC or SPEC clause requires a
refusal or a stale-field indicator here, and the failure mode is silent
data narrowing (fewer columns shown), not silent data exposure/mutation —
distinguishable from the file-clone finding above. Documented for the
record per the task's named-question requirement; zero OPEN ITEMS
contribution.

NAMED QUESTION (4): is there any way to EDIT a saved view, or only
create/delete, and does SPEC require one?

Only create/delete. `src/server/repo/views.ts` exports exactly
`listSavedViews`, `countSavedViews`, `countSavedViewsCreatedBy`,
`createSavedView`, `getSavedViewOwnership`, `deleteSavedView` — no
update/patch function. `src/routes/api/views.ts` registers exactly three
routes: `GET /events/:eventId/views` (line 40), `POST
/events/:eventId/views` (line 61), `DELETE /views/:id` (line 106) — no
PATCH/PUT. SPEC.md:108-112 (J3) names "saved views" as a bare noun phrase
with no edit/rename verb attached, unlike its explicit "bulk select ->
bulk status change" phrasing elsewhere in the same clause. NOT adjudicated
as a defect: SPEC does not require an edit path (a user can already
delete-and-recreate to the same effect, and DEC-031/DEC-904/DEC-422/DEC-975
— the four DECs governing this surface — say nothing about edit either).
Documented for the record; zero OPEN ITEMS contribution.

---

RESULT: FAIL — 1 CONFIRMED-DEFECT (cloneSubmission file-answer aliasing across
file-kind form-field answers, file.submissionId never re-pointed) filed
above with file:line and owner `wave-51 lane`; every other adjudicated
clause (form-answer columns, search/filters, bulk status change including
the DEC-009 no-mailer invariant, manual session creation, saved-view
stale-column-id handling, saved-view edit-path absence) closes clean or is
a documented non-defect finding with no SPEC/DEC requirement violated.

OPEN ITEMS: 1
