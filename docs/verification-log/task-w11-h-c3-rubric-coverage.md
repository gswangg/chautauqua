# task-w11-h - rubric-coverage @ 29101f3

FROZEN SHA: 29101f335c2099cf9c78e511eb1e25fa24e18bee
WAVE-10 GATE: PASS
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: n/a

DEC-303/304/305 evidence lane. `S=$(git rev-parse refs/heads/main)` = FROZEN SHA above,
verified by `git merge-base --is-ancestor $S refs/heads/main` in a detached worktree
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/scratch/w11-h`) before
any grep below ran. The WAVE-10 CONTENT GATE (DEC-303) was run verbatim at S first:

- G1 `src/routes/root.tsx:47` `if (!res.ok && res.status !== 304) {` — PRESENT
- G2 `.dev.vars.example:6` `PUBLIC_BASE_URL=http://localhost:8787`; `src/server/origin.ts:123`
  `function firstLoopbackCandidate(...)` — PRESENT
- G3 `src/routes/public/index.tsx:55` `c.header("Cache-Control", "no-store");` on the
  non-200 path — PRESENT
- G4 `src/routes/agenda.ts:140` `function parseBoundedInt(...)`, `:133`
  `gridMin: { min: 1, max: 480 },` — PRESENT
- G5 `src/server/repo/attribution.ts:40`
  `isNull(schema.participant.titleAtTime)` — PRESENT
- G6 `src/server/repo/forms.ts:281` (cascade repo helper) +
  `src/routes/api/forms.ts:217-218` (`?cascade=1` / 409) — PRESENT
- G7 `src/routes/api/events.ts:223` `name: "General"` — PRESENT

All seven present at S: **WAVE-10 GATE: PASS**, no poll needed, no items counted OPEN from
the gate.

## Method

`grep -h "^\s*- id:" docs/eval-rubric/*.yaml | wc -l` = **116**. Per-file counts:
`01-call-for-papers.yaml`=20 (CFP-S1..S4 scenarios + CFP-01..16 rubric),
`02-abstract-management.yaml`=17 (ABS-S1..S3 + ABS-01..14),
`03-speaker-management.yaml`=19 (SPK-S1..S3 + SPK-01..16),
`04-content-management.yaml`=17 (CNT-S1..S3 + CNT-01..14),
`05-ai-agenda.yaml`=10 (AIA-S1..S2 + AIA-01..08),
`06-public-widgets.yaml`=19 (EMB-S1..S3 + EMB-01..16),
`07-speaker-crm.yaml`=14 (CRM-S1..S2 + CRM-01..12).
20+17+19+17+10+19+14 = **116**, matching the grep count exactly.

Unlike `task-w8-h-c2-rubric-coverage.md` and `task-w4-e-c2-rubric-coverage.md` (which tabled
only the 96 `- id: XXX-NN` regression-hook rows and excluded the 20 `- id: XXX-SN` scenario
rows from the table entirely), this log tables **all 116** rows per the task instruction, so a
silently dropped id is structurally impossible. The 20 scenario ids (`*-S1`..`*-S3`) are
end-to-end browser-walkthrough scripts, not independently-gradable code targets — each names no
single implementing file, so its row cites the rubric ids it exercises and defers to the
walkthrough battery (section b, `docs/verification-log/task-w11-b-c3-walkthrough.md`) as its
"test". Verdicts for scenario rows are `COVERED (scenario)` and are not counted toward OPEN
ITEMS, consistent with the prior two logs' treatment of the same 20 rows. Every one of the 96
non-scenario file:line citations below was independently re-grepped/re-Read against the tree at
S in this session (not copied from `task-w8-h`/`task-w4-e` prose); those two logs were consulted
only as a starting index of which files to look in, per the task's stated method. Per DEC-293,
this log never cites `task-w8-h`/`task-w4-e`'s two waived doc-typo count rows, and per DEC-272,
ABS-14 is recorded WAIVED and excluded from OPEN ITEMS.

Special attention (task instruction) — the three ids wave 9 closed, reconfirmed at file:line at
S, not from prose:

- **SPK-03**: `app/src/pages/contacts/csv.ts` exists (RFC 4180 client parser feeding the import
  wizard) and, decisively, `src/routes/api/contacts.ts:335`
  `contactsRoutes.post("/contacts/import", csrfJson, async (c) => {` with `:349` comment
  "DEC-290: an optional eventId puts every imported/updated contact ... on the roster" — the
  single import action is now event-scoped via the optional `eventId` param, closing the w8-h
  PARTIAL (two-step producer flow). Test: `test/contacts-import.test.ts`,
  `app/src/pages/contacts/csv.test.ts`. **COVERED** (was PARTIAL at w8-h; CLOSED by DEC-290,
  wave 9).
- **SPK-15**: `app/src/pages/contacts/customFields.ts:6`
  `export const TRAVEL_KEY = 'travel_logistics';`, consumed by the contact-drawer custom-fields
  UI; persists via `src/routes/api/contacts.ts:182` `patch.customFields`. Test:
  `app/src/pages/contacts/customFields.test.ts`, `test/contacts-profile-admin.test.ts`.
  **COVERED**.
- **EMB-15**: `app/src/pages/settings/EmbedsPanel.tsx:14` imports `EMBED_SURFACES` from
  `app/src/pages/settings/embedSnippet.ts:9`
  `export const EMBED_SURFACES = ['sessions', 'speakers', 'agenda', 'schedule', 'gallery'] as const;`
  (all 5 widget types); `embedSnippet.ts` now also exposes multiple output formats
  (`format: EmbedFormat` — iframe/link/json/ics, lines 21-45/61-74) and a `fields` allowlist
  param (`:25,52-53`), closing the w8-h PARTIAL (no output-format picker / no field selection).
  Branding/color option was not found (`grep -n "branding\|color" embedSnippet.ts` — no hits),
  so full depth is not total, but the pass_criteria's stated minimum ("configuration such as
  output format... and field selection") is met. Test:
  `app/src/pages/settings/embedSnippet.test.ts`. **COVERED** (minimum bar met; branding/color
  depth still absent, not counted OPEN — same two-tier treatment as EMB-03 below).

## 01-call-for-papers.yaml (CFP-S1..S4, CFP-01..16) — 20 rows

| id | criterion (short) | file:line | test | verdict |
|---|---|---|---|---|
| CFP-S1 | organizer builds+publishes CFP (form builder, tracks/formats, conditional field, window, publish) | scenario — exercises CFP-01/02/03/07; src/forms/builder.ts, src/routes/api/events.ts tracks/formats, src/routes/public/submit.tsx | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CFP-S2 | speaker drafts, submits, edits proposals | scenario — exercises CFP-05/07/09; src/routes/public/submit.tsx, src/lib/draft.ts, src/routes/portal/edit.tsx | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CFP-S3 | reviewer scores, organizer decides | scenario — exercises CFP-10/11/12; src/routes/review.ts, src/domain/status.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CFP-S4 | decision notification + accepted-to-session handoff | scenario — exercises CFP-13/14/15/16; src/routes/comms.ts, src/domain/acceptance.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CFP-01 | custom field types + required validation, renders + enforced on public form | src/forms/builder.ts:7 `FIELD_KINDS`, :88 `validateFieldDefInput`; src/forms/validate.ts:21 `validateAnswers` | test/forms.test.ts, test/form-render-rules.test.ts, test/forms-api.test.ts | COVERED |
| CFP-02 | conditional field show/hide keyed to format/track | src/forms/visibility.ts:7 `isVisible` | test/form-render-rules.test.ts | COVERED |
| CFP-03 | logged-out public portal w/ branding, deadline, tracks/formats | src/routes/public/index.tsx (publicRoutes `/e/:eventSlug/...` handlers, e.g. :110, :124) | test/public.test.ts | COVERED |
| CFP-04 | submission window enforced, closed state past close date | src/lib/submit-core.ts:23 `formWindowState` | test/submit-core.test.ts | COVERED |
| CFP-05 | speaker account, submit, confirmation, dashboard status | src/routes/public/submit.tsx (account+submit); src/routes/portal/index.tsx:226 `portalRoutes.get("/", ...)` | test/portal.test.ts, test/submit-mailer-failure.test.ts | COVERED |
| CFP-06 | round-trip to organizer list/detail (title/abstract/track/format/custom fields) | src/routes/api/submissions.ts (organizer GET); src/db/schema.ts submission table | test/api-submissions.test.ts | COVERED |
| CFP-07 | save-as-draft, resume | src/lib/draft.ts:26 `draftCookieName`, :63 `saveDraft` | test/submit-draft-notice.test.ts | COVERED |
| CFP-08 | automated confirmation email on submit | src/routes/public/submit.tsx mailer.send call; dev sink -> email_log | test/submit-mailer-failure.test.ts, test/dev-mailbox.test.ts | COVERED |
| CFP-09 | speaker edit round-trips to organizer view while open | src/routes/portal/edit.tsx (edit route); src/domain/edit-lock.ts:10 `canEditSubmission` | test/portal-edit-track-validation.test.ts, test/edit-lock.test.ts | COVERED |
| CFP-10 | reviewer provisioning + isolated reviewer-only dashboard | src/routes/api/users.ts (`POST /api/v1/users`); src/routes/review.ts:569 `GET /api/v1/review/plans` | test/users-api.test.ts, test/events-reviewer-access.test.ts | COVERED |
| CFP-11 | reviewer records rating+comment, visible to organizer, completion state updates | src/routes/review.ts (assignment/scorecard submit); src/domain/evaluation.ts:27 `computeWeightedScore` | test/round-criteria.test.ts, test/evaluation.test.ts | COVERED |
| CFP-12 | accept/reject decisions, distinct list statuses | src/routes/api/submissions.ts:348 `POST .../submissions/status`; src/domain/status.ts:48 `changeStatus` | test/status-bulk-full-match.test.ts | COVERED |
| CFP-13 | decision propagates to speaker dashboard | src/routes/portal/index.tsx:226 reads submission.status | test/portal.test.ts | COVERED |
| CFP-14 | send/queue decision notification emails, UI confirms dispatch | src/routes/comms.ts (`POST /compose/send`) | test/compose.test.ts, test/compose-full-set.test.ts, test/comms-send-mailer-failure.test.ts | COVERED |
| CFP-15 | accepted submission becomes session w/ metadata, no re-entry | src/domain/acceptance.ts:111 `planAcceptance` | test/domain.test.ts, test/api-submissions.test.ts | COVERED |
| CFP-16 | editing locks after CFP close date | src/domain/edit-lock.ts:10 `canEditSubmission` consumed by src/routes/portal/edit.tsx | test/portal-edit-speaker-locked.test.ts, test/edit-lock.test.ts | COVERED |

## 02-abstract-management.yaml (ABS-S1..S3, ABS-01..14) — 17 rows

| id | criterion (short) | file:line | test | verdict |
|---|---|---|---|---|
| ABS-S1 | organizer configures multi-round plan w/ scorecards | scenario — exercises ABS-01/02/03/04; src/routes/review.ts plans/rounds routes | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| ABS-S2 | reviewer assignment, anonymized scoring, progress tracking | scenario — exercises ABS-05/06/07/08/09; src/domain/evaluation.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| ABS-S3 | results/export, co-authors, recusal | scenario — exercises ABS-10/11/12/13; src/routes/review.ts results/recusal routes | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| ABS-01 | 2+ independent review rounds, own dates+scorecard, persists | src/routes/review.ts:247 `POST /events/:eventId/plans`, :358 `advance-round`; src/domain/evaluation.ts `isPlanOpen` (imported :18, used :614) | test/review-rounds.test.ts, test/rounds.test.ts | COVERED |
| ABS-02 | reviewer pool scoped per round, not shared | src/routes/review.ts (`POST /plans/:id/reviewers`, plan-scoped) | test/round-criteria.test.ts | COVERED |
| ABS-03 | scorecard supports numeric/dropdown/free-text, all render+store | src/domain/evaluation.ts:242-area `aggregateDropdownCriterion`, :27 `computeWeightedScore`; free-text alongside rating in src/routes/review.ts scorecard submit | app/src/pages/review/scorecardLogic.test.ts, test/round-criteria.test.ts | COVERED |
| ABS-04 | weighted criteria, aggregate reflects weighting | src/domain/evaluation.ts:27 `computeWeightedScore` | test/evaluation.test.ts | COVERED |
| ABS-05 | reviewer queue = exactly assigned set | src/domain/evaluation.ts:325 `buildReviewerQueue`; src/routes/review.ts:609 `GET /review/plans/:id/queue` | test/review-queue-shape.test.ts, test/review-idor.test.ts | COVERED |
| ABS-06 | assignment tooling at scale (cap/auto-distribute/track-filter) | src/routes/review.ts assignment route w/ `trackId` (track-filtered bulk assignment) | test/round-criteria.test.ts | COVERED |
| ABS-07 | anonymization hides identity from reviewer, visible to organizer | src/domain/evaluation.ts `anonymizeForReviewer` | test/round-criteria.test.ts | COVERED |
| ABS-08 | progress dashboard per-reviewer completion matches real state | src/routes/review.ts:403 `GET /plans/:id/progress` | app/src/pages/review/progress.test.ts | COVERED |
| ABS-09 | bulk reminder to reviewers with outstanding reviews | src/routes/review.ts (`POST /plans/:id/remind`) | test/review-remind-mailer-failure.test.ts | COVERED |
| ABS-10 | aggregate score in sortable results table | src/routes/review.ts (`GET /plans/:id/results`); app/src/pages/review/resultsSort.ts | app/src/pages/review/resultsSort.test.ts | COVERED |
| ABS-11 | co-authors persist w/ role labels, visible in review/results | src/routes/api/submissions.ts (`POST /submissions/:id/participants`) | test/participant-attribution.test.ts | COVERED |
| ABS-12 | reviewer can declare COI/recuse, excluded from queue, organizer sees it | DEC-271: src/db/schema.ts:354 `reviewRecusal`; src/routes/review.ts:785 `POST .../recusals/:submissionId`, :815 `DELETE ...`, :636-640 queue exclusion | test/review-recusal.test.ts | COVERED |
| ABS-13 | export scores/statuses to CSV/XLSX | src/routes/review.ts results feed; app/src/pages/review/resultsCsv.ts `buildResultsCsvHref` | app/src/pages/review/resultsCsv.test.ts | COVERED |
| ABS-14 | AI-assisted triage (self-conditional: only if clone claims AI review) | WAIVED — DEC-272 (src/decisions.ts DEC_272 constant); Chautauqua claims AI review nowhere, and no external model API key is permitted in stage 1 | n/a | WAIVED-DEC-272 |

## 03-speaker-management.yaml (SPK-S1..S3, SPK-01..16) — 19 rows

| id | criterion (short) | file:line | test | verdict |
|---|---|---|---|---|
| SPK-S1 | roster CRUD, search/filter, status | scenario — exercises SPK-01/02/04; app/src/pages/speakers/rowFilters.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| SPK-S2 | CSV import, tasks, portal onboarding | scenario — exercises SPK-03/05/06/07/08/09; src/routes/api/contacts.ts import, src/routes/tasks.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| SPK-S3 | deliverables, progress, bulk email, custom fields | scenario — exercises SPK-10/11/12/13/14/15/16; src/routes/files.ts, app/src/pages/speakers/overdue.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| SPK-01 | roster grid, search/filter | src/routes/tasks.ts (`GET /events/:eventId/onboarding`); app/src/pages/speakers/rowFilters.ts:9 `filterOnboardingRows` | app/src/pages/speakers/rowFilters.test.ts | COVERED |
| SPK-02 | add speaker w/ profile fields, edits persist | src/routes/api/contacts.ts (`POST /contacts`, `PATCH /contacts/:id`, add-to-event) | test/contacts.test.ts, test/contacts-profile-admin.test.ts | COVERED |
| SPK-03 | bulk-import speakers from CSV | src/routes/api/contacts.ts:335 `POST /contacts/import` with DEC-290 optional `eventId` (roster-scoped in one action); app/src/pages/contacts/csv.ts client parser | test/contacts-import.test.ts, app/src/pages/contacts/csv.test.ts | COVERED (closed post-w8 by DEC-290, wave 9) |
| SPK-04 | workflow status changeable/persists/filterable | app/src/pages/speakers/rowFilters.ts:9 `filters.status` | app/src/pages/speakers/rowFilters.test.ts | COVERED |
| SPK-05 | create general/action tasks w/ due dates, assign to multiple speakers | src/routes/tasks.ts (`POST /events/:eventId/tasks`, `POST /tasks/:id/assign`); assignToAllAccepted gated via `isActiveParticipant` (DEC-283, src/server/repo/tasks.ts) | test/tasks-assign-org-scope.test.ts, test/task-assignment-kind-gates.test.ts | COVERED |
| SPK-06 | speaker portal invitation/onboarding email | src/routes/portal/index.tsx (`POST /invitations/:participantId`) | test/portal-signout.test.ts | COVERED |
| SPK-07 | personalized portal scoped to own content | src/routes/portal/index.tsx:226 `GET /`, session-scoped to own contact | test/portal.test.ts | COVERED |
| SPK-08 | speaker updates bio/social/headshot from portal, appears on organizer record | src/routes/portal/profile.tsx (`POST /profile`, `POST /profile/headshot`) | test/profile.test.ts, test/headshot-gate.test.ts | COVERED |
| SPK-09 | portal task list w/ due dates, mark complete persists | src/routes/portal/tasks.tsx (`GET /tasks`, `POST /tasks/:assignmentId/complete`) | test/portal-tasks.test.ts | COVERED |
| SPK-10 | organizer sees+downloads speaker-uploaded deliverable w/ metadata | src/routes/files.ts (`GET /events/:eventId/files`) | test/files.test.ts, test/files-library.test.ts | COVERED |
| SPK-11 | session assignments visible on organizer record + speaker portal | src/routes/api/submissions.ts organizer detail; src/routes/portal/index.tsx | test/api-participants.test.ts | COVERED |
| SPK-12 | progress view: per-speaker task completion at list level, reflects portal | app/src/pages/speakers/overdue.ts:24 `computeOnboardingCounts` | app/src/pages/speakers/overdue.test.ts | COVERED |
| SPK-13 | bulk email to selected/filtered speaker group, send logged | src/routes/api/contacts.ts (`POST /contacts/bulk-email`, `event` param) | test/contacts-bulk-email-mailer-failure.test.ts, test/contacts-bulk-email-preview-route.test.ts | COVERED |
| SPK-14 | email templates w/ merge fields personalize per recipient | src/mail/render.ts (`renderTemplate`, `MERGE_FIELDS`) | test/mail.test.ts, test/compose.test.ts | COVERED |
| SPK-15 | speaker record stores travel-preference/custom logistics fields, persist | app/src/pages/contacts/customFields.ts:6 `TRAVEL_KEY = 'travel_logistics'`; persisted via src/routes/api/contacts.ts:182-area `patch.customFields` | app/src/pages/contacts/customFields.test.ts, test/contacts-profile-admin.test.ts | COVERED |
| SPK-16 | automated reminder emails to speakers with incomplete tasks | src/server/scheduled.ts `runDueReminders` (wrangler cron); src/domain/reminders.ts `isReminderDue`, `planReminders` | test/tasks-due-reminders.test.ts, test/reminders.test.ts | COVERED |

## 04-content-management.yaml (CNT-S1..S3, CNT-01..14) — 17 rows

| id | criterion (short) | file:line | test | verdict |
|---|---|---|---|---|
| CNT-S1 | organizer creates file-request task, speaker uploads | scenario — exercises CNT-01/02/03/06; src/routes/tasks.ts, src/routes/portal/tasks.tsx | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CNT-S2 | versioning, comments, deliverables dashboard, reminders | scenario — exercises CNT-04/05/07/08; app/src/pages/content/version-chain.ts, src/routes/files.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CNT-S3 | central edit, approval gate, files library, bulk download | scenario — exercises CNT-09/10/11/12/13/14; src/routes/api/submissions.ts, src/lib/zip.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CNT-01 | file-request task w/ instructions+due date, assigned to speakers | src/routes/tasks.ts (`POST /events/:eventId/tasks`, kind=file-request) | test/acceptance-form-tasks.test.ts | COVERED |
| CNT-02 | portal lists assigned tasks w/ deadlines, accepts upload recorded against task/session | src/routes/portal/tasks.tsx (`GET /tasks`, `POST /tasks/:assignmentId/upload`) | test/task-upload-content.test.ts, test/portal-tasks.test.ts | COVERED |
| CNT-03 | speaker access scoped to own sessions/tasks, admin views blocked | `requireSpeaker` in src/routes/portal/*.tsx; `requireOrganizer` on admin routes | test/reviewer-file-access.test.ts, test/task-file-access.test.ts | COVERED |
| CNT-04 | re-upload creates new version, latest marked, previous accessible | app/src/pages/content/version-chain.ts (`orderVersionsNewestFirst`, `orderVersionChains` via `previous_file_id`) | app/src/pages/content/version-chain.test.ts | COVERED |
| CNT-05 | comments on uploaded file, logged w/ author+timestamp, visible across roles | src/routes/files.ts (`GET /files/:fileId/comments`, `POST`) | test/files.test.ts | COVERED |
| CNT-06 | upload UI communicates accepted types/max size | app/src/pages/content/upload-validation.ts (`formatAcceptedTypesMessage`) | app/src/pages/content/upload-validation.test.ts | COVERED |
| CNT-07 | deliverables dashboard: per-speaker per-task status, due dates, filterable, reflects uploads | app/src/pages/content/worklist.ts | app/src/pages/content/worklist.test.ts | COVERED |
| CNT-08 | bulk reminder emails to speakers w/ outstanding tasks, send confirmation | src/routes/tasks.ts (`POST /events/:eventId/onboarding/remind`) | test/tasks-due-reminders-mailer-failure.test.ts | COVERED |
| CNT-09 | organizer edits session title/abstract centrally, persists | src/routes/api/submissions.ts (`PATCH /submissions/:id`) | test/api-submissions.test.ts | COVERED |
| CNT-10 | organizer edits speaker bio/headshot from admin area, persists | src/routes/api/contacts.ts (`PATCH /contacts/:id`, `POST /contacts/:id/headshot`) | test/contacts-profile-admin.test.ts | COVERED |
| CNT-11 | version/change history w/ editor attribution+timestamps, restore prior version | src/routes/api/submissions.ts (`GET .../revisions`, `POST .../restore`); src/server/repo/revisions.ts `appendSubmissionRevision` | test/submission-revisions.test.ts | COVERED |
| CNT-12 | content approval/review status; unapproved excluded from public agenda | src/routes/files.ts (`POST /submissions/:id/content-status`); src/server/repo/public.ts filters `contentStatus === 'approved'` | test/public.test.ts, test/files.test.ts | COVERED |
| CNT-13 | central files library aggregates uploads across sessions w/ metadata | app/src/pages/content/FilesLibrary.tsx; src/routes/files.ts (`GET /events/:eventId/files`) | app/src/pages/content/FilesLibrary.render.test.tsx | COVERED |
| CNT-14 | multi-select bulk ZIP download of latest versions | src/routes/files.ts (`POST /events/:eventId/files/archive`); src/lib/zip.ts `buildZip` | test/zip.test.ts, test/files-archive-route.test.ts | COVERED |

## 05-ai-agenda.yaml (AIA-S1..S2, AIA-01..08) — 10 rows

| id | criterion (short) | file:line | test | verdict |
|---|---|---|---|---|
| AIA-S1 | agenda builder, rooms/tracks config, placement, conflicts | scenario — exercises AIA-01/02/03/04/05/06; app/src/pages/Agenda.tsx, src/domain/schedule.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| AIA-S2 | publish + auto-schedule | scenario — exercises AIA-07/08; src/routes/agenda.ts publish/auto-schedule | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| AIA-01 | agenda builder view, time+room/track dimension, day nav | app/src/pages/Agenda.tsx, app/src/pages/agenda/DayGrid.tsx, agenda/state.ts | app/src/pages/agenda/Agenda.render.test.tsx, app/src/pages/agenda/state.test.ts | COVERED |
| AIA-02 | rooms/tracks configurable, newly added usable immediately | src/routes/api/events.ts (tracks+rooms CRUD routes) | test/events-api.test.ts | COVERED |
| AIA-03 | unscheduled session placed into day/time/room, persists across reload | src/routes/agenda.ts:45 `PUT /submissions/:id/slot` | test/agenda-repo.test.ts | COVERED |
| AIA-04 | overlapping speaker double-booking warning | src/domain/schedule.ts:36 `findConflicts` | test/overlap-lanes.test.ts | COVERED |
| AIA-05 | overlapping room conflict blocked/flagged | src/domain/schedule.ts:36 `findConflicts` (room dimension) | test/overlap-lanes.test.ts, test/agenda-room-ownership.test.ts | COVERED |
| AIA-06 | session move takes effect, conflicts clear once overlap removed | src/routes/agenda.ts slot PUT recomputes via `findConflicts` | test/agenda-repo.test.ts | COVERED |
| AIA-07 | publish action exists, reports success, hands off to public surface | src/routes/agenda.ts:107 `POST /events/:eventId/agenda/publish` | test/agenda-publish.test.ts | COVERED |
| AIA-08 | assisted/auto scheduling places unscheduled sessions in one action | src/routes/agenda.ts:156 `POST /events/:eventId/agenda/auto-schedule` | test/agenda-repo.test.ts | COVERED |

## 06-public-widgets.yaml (EMB-S1..S3, EMB-01..16) — 19 rows

| id | criterion (short) | file:line | test | verdict |
|---|---|---|---|---|
| EMB-S1 | sessions list + speakers list widgets | scenario — exercises EMB-01/02/03/04/05; src/routes/public/sessions.tsx, src/routes/public/speakers.tsx | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| EMB-S2 | agenda + schedule itinerary widgets | scenario — exercises EMB-06/07/08/09/10/11; src/routes/public/agenda.tsx | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| EMB-S3 | speaker gallery + embed config + consistency | scenario — exercises EMB-12/13/14/15/16; app/src/pages/settings/EmbedsPanel.tsx | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| EMB-01 | session cards: title, description Show more, date/time, room, speakers, tags | src/routes/public/cards.tsx `SessionCard` rendered by src/routes/public/sessions.tsx | test/public.test.ts | COVERED |
| EMB-02 | keyword search over title+speaker, narrows list, updates count | src/routes/public/sessions.tsx (`q` param handling) | test/public.test.ts | COVERED |
| EMB-03 | faceted Filters, at minimum Track | src/routes/public/sessions.tsx:43 `<nav aria-label="Track filters">`; Format/Location facets NOT found (`grep -n "format\|location\|room" src/routes/public/query.ts` shows only card-field toggles, no facet query params) | test/public.test.ts | PARTIAL (minimum Track bar met; Format/Location depth absent — not counted OPEN, stated minimum passes) |
| EMB-04 | speaker directory, alpha by surname, headshot/name/title/company | src/routes/public/speakers.tsx; src/server/repo/public.ts `.orderBy(asc(lastName), asc(firstName), ...)` | test/public.test.ts | COVERED |
| EMB-05 | speaker detail drill-in w/ bio+sessions, search by name | src/routes/public/detail.tsx; src/server/repo/public.ts name search | test/public.test.ts | COVERED |
| EMB-06 | agenda per-day grid, room/time-structured, session blocks placed correctly | src/routes/public/agenda.tsx `AgendaDayGrid` | test/public.test.ts | COVERED |
| EMB-07 | agenda day navigation switches days, re-renders | src/routes/public/agenda.tsx via src/routes/public/dispatch.tsx | test/public.test.ts | COVERED |
| EMB-08 | click session block opens detail (time/room/description/format/track), back restores agenda | src/routes/public/detail.tsx; back control src/routes/public/shell.tsx | test/public.test.ts | COVERED |
| EMB-09 | schedule itinerary widget, chronological w/in day tabs, full card data | src/routes/public/agenda.tsx itinerary toggle | test/itinerary-roundtrip.test.ts | COVERED |
| EMB-10 | personal schedule add/star sessions, view exactly the chosen set | src/routes/public/agenda.tsx `itineraryStorageKey`, client toggle | test/itinerary-roundtrip.test.ts | COVERED |
| EMB-11 | itinerary persists across reload, export/add-to-calendar affordance | localStorage key + `?ids=` query .ics export | test/ics-download.test.ts, test/itinerary-roundtrip.test.ts | COVERED |
| EMB-12 | speaker gallery: photo grid, alpha by surname, search-by-name, graceful missing photo/title | src/routes/public/dispatch.tsx `case "gallery"` | test/public.test.ts | COVERED |
| EMB-13 | gallery card opens detail (photo/name/title/bio Show more/company/sessions), closes back to grid | same drill-in mechanism as EMB-05/EMB-08 | test/public.test.ts | COVERED |
| EMB-14 | all 5 widget surfaces publicly reachable, no login | no `requireOrganizer`/`requireSpeaker` in src/routes/public/*.tsx | test/public-invite-visibility.test.ts, test/public.test.ts | COVERED |
| EMB-15 | organizer embed/share area: snippet/URL per widget type, output format/branding/filter/field config | app/src/pages/settings/EmbedsPanel.tsx:14 `EMBED_SURFACES` (5/5 types); app/src/pages/settings/embedSnippet.ts:9 `EMBED_SURFACES`, :21-45/61-74 multi-format (`iframe/link/json/ics`), :25/52-53 `fields` allowlist | app/src/pages/settings/embedSnippet.test.ts | COVERED (branding/color option still absent, not counted OPEN — minimum bar of format+field config met; closed post-w8 by wave 9) |
| EMB-16 | cross-surface + organizer-source data consistency | src/server/repo/public.ts single read path for all public surfaces; src/server/pubcache.ts is an HTTP cache layer, not a data copy | test/pubcache.test.ts | COVERED |

## 07-speaker-crm.yaml (CRM-S1..S2, CRM-01..12) — 14 rows

| id | criterion (short) | file:line | test | verdict |
|---|---|---|---|---|
| CRM-S1 | org-wide directory, filters, profile, custom fields/tags | scenario — exercises CRM-01/02/03/04; src/routes/api/contacts.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CRM-S2 | CSV import, merge, pipeline, segments, push-to-event, bulk email, dashboard | scenario — exercises CRM-05/06/07/08/09/10/11/12; src/routes/api/contacts.ts, src/routes/api/pipeline.ts | docs/verification-log/task-w11-b-c3-walkthrough.md | COVERED (scenario) |
| CRM-01 | org-level speaker directory outside any single event, searchable table | src/routes/api/contacts.ts (`GET /contacts`, org-scoped) | test/contacts-repo.test.ts, test/contacts.test.ts | COVERED |
| CRM-02 | multi-criteria filter, clearable | src/domain/contacts.ts pure filter fns (DEC-266); app/src/pages/contacts/FilterRulesPanel.tsx | test/contacts-rules-param.test.ts | COVERED |
| CRM-03 | contact profile: identity + notes + cross-event history | src/routes/api/contacts.ts (`GET /contacts/:id`) | test/contact-profile-roundtrip.test.ts | COVERED |
| CRM-04 | custom fields/tags persist on profile | src/routes/api/contacts.ts (`patch.customFields`) | test/contacts-profile-admin.test.ts | COVERED |
| CRM-05 | bulk CSV import at org level, rows appear in directory | src/routes/api/contacts.ts:335 `POST /contacts/import` | test/contacts-import.test.ts | COVERED |
| CRM-06 | near-duplicate detection + merge into chosen primary, total over every FK table | src/routes/api/contacts.ts (`GET /contacts/duplicates`, `POST /contacts/merge`); src/server/repo/contacts/query.ts:108-115 `CONTACT_FK_TABLES` = 7 entries (`user, participant, task_assignment, email_log, file, file_comment, pipeline_entry`) | test/contacts-duplicates-merge-route.test.ts | COVERED |
| CRM-07 | kanban pipeline, staged columns, enroll+move, persists across reload | src/routes/api/pipeline.ts (`POST /pipeline`, `PATCH /pipeline/:id`) | test/pipeline-api.test.ts | COVERED |
| CRM-08 | pipeline card detail: notes + timestamped stage transitions | src/routes/api/pipeline.ts (`POST /pipeline/:id/notes`) | test/pipeline-api.test.ts | COVERED |
| CRM-09 | filtered directory view saved as named reusable segment | src/routes/api/contacts.ts (`POST /segments`) | app/src/pages/contacts/segments.test.ts | COVERED |
| CRM-10 | push org contact into specific event's roster, profile intact | src/routes/api/contacts.ts (`POST /contacts/:id/add-to-event`) | test/contacts-add-to-event.test.ts | COVERED |
| CRM-11 | bulk email to selected contacts, template/merge-tag, preview, send logged | src/routes/api/contacts.ts (`POST /contacts/bulk-email`, preview) | test/contacts-bulk-email-preview-route.test.ts | COVERED |
| CRM-12 | CRM dashboard w/ org-wide metrics, populated analytics widget | src/routes/api/contacts.ts (`GET /contacts/stats`); app/src/pages/contacts/StatsStrip.tsx | test/contacts-repo.test.ts | COVERED |

## Row count check

CFP 20 + ABS 17 + SPK 19 + CNT 17 + AIA 10 + EMB 19 + CRM 14 = **116** rows, matching the
`grep -h "^\s*- id:" docs/eval-rubric/*.yaml | wc -l` count of **116** exactly. Assertion holds:
row count == id count.

## Open items

Zero. All 96 non-scenario ids are COVERED (two, EMB-03 and EMB-15, are PARTIAL/COVERED-with-
depth-gaps against the *aspirational* criterion prose but meet each id's own stated *minimum*
pass bar, per the same two-tier treatment `task-w4-e`/`task-w8-h` used — not counted OPEN). All
20 scenario ids are COVERED (scenario), deferred to the walkthrough battery, not independently
gradable. ABS-14 is WAIVED per DEC-272 and excluded from the OPEN ITEMS count per DEC-272's own
instruction. SPK-03, SPK-15, and EMB-15 — the three ids wave 9 targeted — are all now COVERED,
each reconfirmed at file:line above, not from `task-w8-h`'s prose. No new regressions were found
in any of the 96 non-scenario ids relative to `task-w8-h`'s RECHECK SHA disposition; every cited
file exists at S and every cited function/route/constant name was independently grepped.

OPEN ITEMS: 0
RESULT: PASS

## POST-S DELTA

```
(empty)
```

`git log --oneline 29101f335c2099cf9c78e511eb1e25fa24e18bee..refs/heads/main -- src app migrations scripts test`
returned no output — zero product commits landed after S, as required by DEC-303/DEC-305 (wave
11 is battery-only).
