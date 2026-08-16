## TIER 1 — open items (gate-7 evidence, boundary `ea2a5543`; re-derived at
wave-55 runtime per DEC-358 wave-55 amendment)

1. Compose-flow turn diet — OWNED by `task-w54-e`, which is discharging the
   user's standing ruling in `docs/eval-findings/01-user-filed.md` right now
   (structural fixes `task-w8-b`/`task-w8-d` MERGED; diet half
   `task-w12-c`/`647a61b4`/DEC-967). Not re-verified or re-filed here — see
   that branch's own disposition.
2. CNT-S3 session-edit loop — CLOSED. Falsifying check run this task:
   `POST /api/v1/submissions/:id/revisions/:revisionId/restore`
   (`src/routes/api/submissions.ts:513-557`) applies the snapshot's
   title/description through `updateSubmissionFields`, then — only when the
   content actually changed — appends its own attributed revision via
   `appendSubmissionRevision` (editorUserId/editorName resolved from the
   restoring actor) and bumps the ICS sequence
   (`bumpIcsSequences(c.var.db, [id])`, DEC-519). `listRevisions`
   (`src/server/repo/revisions.ts:20-26,46-60`) selects and returns
   `editorName` + `createdAt` alongside title/description for every row,
   newest-first. Read both files in full at this task's runtime; no gap
   found between rubric steps 7-9
   (`docs/eval-rubric/04-content-management.yaml:110-150`) and the landed
   route/repo pair.
3. Gate-7 fleet MARJORs, walked sub-item by sub-item (nothing deleted):
   12-home chrome — CLOSED, SUPERSEDED-BY-VENDORED-PACK
   (`docs/design/README.md:407-417`, `src/routes/public/home.css.ts:21`).
   07 comms step-1 SLOT/footer — CLOSED (`task-w8-d`); templates-grid
   overlap — CLOSED, re-verified this task: `templates.map` renders a plain
   two-column `<table>` (Name / Last used) with no absolute-positioned
   overlay, the empty state is a distinct `EmptyState variant="fresh"`
   branch that never coexists with the table
   (`app/src/pages/comms/TemplatesTab.tsx:205-233`). History-tab chrome —
   CLOSED, re-verified this task: the tab has its own head block
   (breadcrumb, `<h1>History</h1>`, subtitle count line) with the Export
   CSV control rendered as a plain cookie-authed anchor beside it, matching
   the door named at `task-w18-f` (`app/src/pages/comms/HistoryTab.tsx:103-
   118`, `src/routes/api/exports.ts:120-147`). 05 files-library column swap
   + orphan row — CLOSED (`app/src/pages/content/FilesLibrary.tsx:252-
   253,340`); upload-reject modal — CLOSED, re-verified this task: a
   dedicated `ModalFrame`-built 560px dialog
   (`app/src/pages/content/UploadRejectedModal.tsx:26-64`) distinct from any
   inline ribbon, per the cited design pack anchor
   (`docs/design/Chautauqua Content.dc.html:431-457`). content-detail
   container — CLOSED, re-verified this task: `DeliverableDetail` carries no
   measure token on the `chq-page` root and delegates the 1180 reading
   measure to a `.chq-content-page-content` sibling wrapped around
   everything below the header/status band, so the band itself can bleed
   full width while the body clamps (`app/src/pages/content/ContentApp.tsx:
   313-326`, `app/src/pages/content/content.css:746-`, DEC-989 wave-23
   amendment). 04 participation/speaker-detail — "search excluded from
   hasActiveNarrowing" CLOSED
   (`app/src/pages/speakers/OnboardingGrid.tsx:128-135`, DEC-678);
   "reminders modal localhost:8799" CLOSED (no literal under `app/src`);
   remaining sub-clauses VERIFIED-OPEN-NOT-RECHECKED (out of this task's
   named scope). CLASS 1 admin measure — CLOSED, SUPERSEDED-BY-VENDORED-PACK
   (`app/src/styles.css:109-111`, DEC-744/989). 11 AUTH_CSS cascade —
   CLOSED (`task-w14-d`). 02 SESSION DETAILS label-left grid — CLOSED
   (`app/src/pages/submissions/SubmissionDetailPage.tsx:1197-1205,1413`).
   03 FORM ANSWERS stacked — CLOSED (`:1101,1106-1127`); results-head —
   CLOSED, re-verified this task: the empty branch renders a dedicated
   `EmptyState` ("Nothing has been scored yet.") that is mutually exclusive
   with the `chq-review-results-table` — no shared head chrome between the
   two states (`app/src/pages/review/ResultsTable.tsx:368-382`).
   plan-editor footer — CLOSED, re-verified this task: the delete-plan
   control lives in its own `.chq-review-editor-footer-row`, disabled via
   the `planHasSubmittedReview` (DEC-213) predicate with adjacent caption
   copy naming the alternative rather than silently disappearing
   (`app/src/pages/review/PlanEditor.tsx:2278-2296`). 09/10 — "TBD room
   public" CLOSED (no literal under `src/routes/public`); CFP-edit
   intro/description binding — likely CLOSED via `submit-views.tsx:421-431`
   (DEC-976 wave-25 amendment), not independently re-read this task;
   remaining sub-clauses VERIFIED-OPEN-NOT-RECHECKED; "speakers toolbar
   right-cluster" moved to TIER 0 DISMISSED-VERIFIED-CLOSED (see above).

   Corroboration: `docs/verification-log/index/0267-2026-08-15-task-w50-h-
   tier-1-fidelity-recheck-87cee8b9.md` and `docs/verification-log.md:6009-
   6014` independently re-derived these same six sub-clauses (templates-grid
   overlap, History-tab chrome, upload-reject modal, content-detail
   container, results-head, plan-editor footer) at boundary `87cee8b9` with
   quoted path:line citations and reported zero CONFIRMED-DEFECT rows; this
   task re-ran each citation against the current tree independently and
   reached the same CLOSED verdict on every one.

**CFP-16 — RECORDED DELIBERATE FORFEIT** (DEC-041): accepted speakers keep
editing past close per `docs/clarifications.md:39` + `SPEC.md:297-298`.
Joins ABS-14 as a deliberate forfeit (~0.5-1.1 composite ceded).
