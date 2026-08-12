# task-w13-g — rubric-coverage @ 0578511 (evidence lane, log-only)

FROZEN SHA: 0578511 (worktree HEAD at task start; `git -C
/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w13-g rev-parse HEAD`
= `05785116a4f14650b0a8c04e62ffc67d931467fb`)
OPEN ITEMS: 0
RESULT: PASS

## Method

No prior wave of *this* campaign (STAGE1-CLOSE, w1..w13) had audited
`docs/eval-rubric/*.yaml`. A prior campaign's own audit exists —
`docs/verification-log/task-w11-h-c3-rubric-coverage.md`, frozen at SHA
`29101f335c2099cf9c78e511eb1e25fa24e18bee`, tabling all 116 `- id:` rows
(20 scenario `*-S1..S3` rows + 96 rubric-criterion rows) across the 7
files, RESULT: PASS, OPEN ITEMS: 0. That SHA is an ancestor of this
worktree's HEAD (`git merge-base --is-ancestor 29101f3.. HEAD` — confirmed),
so it is a valid starting index of file locations — used only as a *map*,
not as evidence; every citation below was independently re-grepped/re-Read
against the current tree, not copied from that log's prose, per this
task's instruction.

`grep -h "^\s*- id:" docs/eval-rubric/*.yaml | wc -l` = **116** at current
HEAD (unchanged file set/count from the prior audit). Per-file: CFP=20
(S1-S4 + 01-16), ABS=17 (S1-S3 + 01-14), SPK=19 (S1-S3 + 01-16), CNT=17
(S1-S3 + 01-14), AIA=10 (S1-S2 + 01-08), EMB=19 (S1-S3 + 01-16), CRM=14
(S1-S2 + 01-12). Sum = 116, matches.

244 product/log commits landed between the prior audit's SHA and this
worktree's HEAD (waves 12-15 of a later-numbered lineage merged into
`main` ahead of this branch's cut, per this repo's parallel-lane
convention — see `git log --oneline 29101f3..HEAD -- src app migrations
scripts test`). None of those commits' subjects describe removing a
rubric-relevant surface; several *reinforce* prior COVERED verdicts
(DEC-310/DEC-309 schedule.ics id-scoping and perf class grading — EMB-11;
DEC-317/DEC-319 portal/compose invite-state scoping — SPK-07/CNT-03/
SPK-13; DEC-321/DEC-322 default CFP job-title/company/bio + safe social
links — EMB-01/EMB-04/EMB-13; DEC-323 schedule.ics empty-agenda bug fix
and DEC-324 public onError cache leak fix — EMB-11/EMB-16 stayed intact
after the fix). `src/routes/review.ts` was decomposed into
`src/routes/review/{index,plans,recusals,reviewer,shared}.ts` and
`src/server/repo/public.ts` into `src/server/repo/public/{gates,sessions,
speakers,agenda,detail,event}.ts` since the prior audit — citations below
use the current split-file locations, independently re-grepped.

Per DEC-272, ABS-14 is WAIVED and excluded from OPEN ITEMS (may not be
re-listed as open). Per DEC-271, ABS-12 is COVERED (recusal machinery).
Per DEC-293, the two doc-typo baseline-count rows from an unrelated wave
are WAIVED and never counted OPEN — not relevant to this table (they were
never rubric rows).

The rubric is the **regression floor**, not the requirements document
(SPEC.md:24-27); a NOT-COVERED verdict is only a stage-1 gap if SPEC.md
independently requires the same capability — none found below (0 gaps).

Scenario rows (`*-S1..S3`) are end-to-end walkthrough scripts naming no
single implementing file; each cites the rubric ids it exercises and is
marked `COVERED (scenario)`, not counted toward OPEN ITEMS — consistent
with the prior campaign's rubric-coverage logs' treatment.

## 01-call-for-papers.yaml (CFP-S1..S4, CFP-01..16) — 20 rows

| id | file:line | test | verdict |
|---|---|---|---|
| CFP-S1 | scenario — exercises CFP-01/02/03/07; src/forms/builder.ts, src/routes/api/events.ts tracks/formats, src/routes/public/submit.tsx | walkthrough battery | COVERED (scenario) |
| CFP-S2 | scenario — exercises CFP-05/07/09; src/routes/public/submit.tsx, src/lib/draft.ts, src/routes/portal/edit.tsx | walkthrough battery | COVERED (scenario) |
| CFP-S3 | scenario — exercises CFP-10/11/12; src/routes/review/{plans,reviewer}.ts, src/domain/status.ts | walkthrough battery | COVERED (scenario) |
| CFP-S4 | scenario — exercises CFP-13/14/15/16; src/routes/comms.ts, src/domain/acceptance.ts | walkthrough battery | COVERED (scenario) |
| CFP-01 | src/forms/builder.ts:8 `FIELD_KINDS`; :101 `validateFieldDefInput` kind check; src/forms/validate.ts required-field checks | test/forms.test.ts, test/form-render-rules.test.ts, test/forms-api.test.ts | COVERED |
| CFP-02 | src/forms/visibility.ts:7 `export function isVisible(...)` | test/form-render-rules.test.ts | COVERED |
| CFP-03 | src/routes/public/index.tsx, src/routes/public/submit.tsx logged-out portal handlers | test/public.test.ts | COVERED |
| CFP-04 | src/lib/submit-core.ts:23 `formWindowState` | test/submit-core.test.ts | COVERED |
| CFP-05 | src/routes/public/submit.tsx account+submit; src/routes/portal/index.tsx dashboard | test/portal.test.ts, test/submit-mailer-failure.test.ts | COVERED |
| CFP-06 | src/routes/api/submissions.ts organizer GET; src/db/schema.ts submission table | test/api-submissions.test.ts | COVERED |
| CFP-07 | src/lib/draft.ts `draftCookieName`, `saveDraft`, `readDraft`; src/routes/public/submit.tsx:434-444 draft-resume path | test/submit-draft-notice.test.ts | COVERED |
| CFP-08 | src/routes/public/submit.tsx mailer.send call; dev sink -> email_log | test/submit-mailer-failure.test.ts, test/dev-mailbox.test.ts | COVERED |
| CFP-09 | src/routes/portal/edit.tsx; src/domain/edit-lock.ts:10 `canEditSubmission` | test/portal-edit-track-validation.test.ts, test/edit-lock.test.ts | COVERED |
| CFP-10 | src/routes/api/users.ts `POST /api/v1/users`; src/routes/review/reviewer.ts reviewer dashboard route | test/users-api.test.ts, test/events-reviewer-access.test.ts | COVERED |
| CFP-11 | src/routes/review/reviewer.ts scorecard submit; src/domain/evaluation.ts:27 `computeWeightedScore` | test/round-criteria.test.ts, test/evaluation.test.ts | COVERED |
| CFP-12 | src/routes/api/submissions.ts `POST .../submissions/status`; src/domain/status.ts `changeStatus` | test/status-bulk-full-match.test.ts | COVERED |
| CFP-13 | src/routes/portal/index.tsx reads submission.status | test/portal.test.ts | COVERED |
| CFP-14 | src/routes/comms.ts `POST /compose/send` | test/compose.test.ts, test/compose-full-set.test.ts, test/comms-send-mailer-failure.test.ts | COVERED |
| CFP-15 | src/domain/acceptance.ts:120 `planAcceptance` | test/domain.test.ts, test/api-submissions.test.ts | COVERED |
| CFP-16 | src/domain/edit-lock.ts:10 `canEditSubmission` consumed by src/routes/portal/edit.tsx | test/portal-edit-speaker-locked.test.ts, test/edit-lock.test.ts | COVERED |

## 02-abstract-management.yaml (ABS-S1..S3, ABS-01..14) — 17 rows

| id | file:line | test | verdict |
|---|---|---|---|
| ABS-S1 | scenario — exercises ABS-01/02/03/04; src/routes/review/plans.ts | walkthrough battery | COVERED (scenario) |
| ABS-S2 | scenario — exercises ABS-05/06/07/08/09; src/domain/evaluation.ts | walkthrough battery | COVERED (scenario) |
| ABS-S3 | scenario — exercises ABS-10/11/12/13; src/routes/review/{plans,recusals}.ts | walkthrough battery | COVERED (scenario) |
| ABS-01 | src/routes/review/plans.ts `POST /events/:eventId/plans`, round advance route; src/domain/evaluation.ts `isPlanOpen` | test/review-rounds.test.ts, test/rounds.test.ts | COVERED |
| ABS-02 | src/routes/review/plans.ts `POST /plans/:id/reviewers` (plan-scoped) | test/round-criteria.test.ts | COVERED |
| ABS-03 | src/domain/evaluation.ts `computeWeightedScore`, dropdown/free-text criteria handling; src/routes/review/reviewer.ts scorecard submit | app/src/pages/review/scorecardLogic.test.ts, test/round-criteria.test.ts | COVERED |
| ABS-04 | src/domain/evaluation.ts:27 `computeWeightedScore` | test/evaluation.test.ts | COVERED |
| ABS-05 | src/domain/evaluation.ts:334 `buildReviewerQueue`; src/routes/review/reviewer.ts `GET /review/plans/:id/queue` | test/review-queue-shape.test.ts, test/review-idor.test.ts | COVERED |
| ABS-06 | src/routes/review/plans.ts assignment route w/ `trackId` (track-filtered bulk assignment) | test/round-criteria.test.ts | COVERED |
| ABS-07 | src/domain/evaluation.ts `anonymizeForReviewer` | test/round-criteria.test.ts | COVERED |
| ABS-08 | src/routes/review/plans.ts `GET /plans/:id/progress` | app/src/pages/review/progress.test.ts | COVERED |
| ABS-09 | src/routes/review/plans.ts `POST /plans/:id/remind` | test/review-remind-mailer-failure.test.ts | COVERED |
| ABS-10 | src/routes/review/plans.ts `GET /plans/:id/results`; app/src/pages/review/resultsSort.ts | app/src/pages/review/resultsSort.test.ts | COVERED |
| ABS-11 | src/routes/api/submissions.ts `POST /submissions/:id/participants` | test/participant-attribution.test.ts | COVERED |
| ABS-12 | DEC-271: src/db/schema.ts `reviewRecusal` table; src/routes/review/recusals.ts:17 `POST .../recusals/:submissionId`, :47 `DELETE ...`; src/routes/review/reviewer.ts:67-68 queue exclusion (`partitionRecused`) | test/review-recusal.test.ts | COVERED |
| ABS-13 | src/routes/review/plans.ts results feed; app/src/pages/review/resultsCsv.ts `buildResultsCsvHref` | app/src/pages/review/resultsCsv.test.ts | COVERED |
| ABS-14 | self-conditional (only if the clone claims AI-assisted review) | n/a | WAIVED — DEC-272 (`src/decisions.ts` `DEC_272`); Chautauqua claims AI review nowhere and no external model API key is permitted in stage 1 |

## 03-speaker-management.yaml (SPK-S1..S3, SPK-01..16) — 19 rows

| id | file:line | test | verdict |
|---|---|---|---|
| SPK-S1 | scenario — exercises SPK-01/02/04; app/src/pages/speakers/rowFilters.ts | walkthrough battery | COVERED (scenario) |
| SPK-S2 | scenario — exercises SPK-03/05/06/07/08/09; src/routes/api/contacts/import.ts, src/routes/tasks.ts | walkthrough battery | COVERED (scenario) |
| SPK-S3 | scenario — exercises SPK-10/11/12/13/14/15/16; src/routes/files.ts, app/src/pages/speakers/overdue.ts | walkthrough battery | COVERED (scenario) |
| SPK-01 | src/routes/tasks.ts `GET /events/:eventId/onboarding`; app/src/pages/speakers/rowFilters.ts `filterOnboardingRows` | app/src/pages/speakers/rowFilters.test.ts | COVERED |
| SPK-02 | src/routes/api/contacts/crud.ts `POST /contacts`, `PATCH /contacts/:id` | test/contacts.test.ts, test/contacts-profile-admin.test.ts | COVERED |
| SPK-03 | src/routes/api/contacts/import.ts `POST /contacts/import` (DEC-290 optional `eventId` roster-scopes the same import action); app/src/pages/contacts/csv.ts client parser | test/contacts-import.test.ts, app/src/pages/contacts/csv.test.ts | COVERED |
| SPK-04 | app/src/pages/speakers/rowFilters.ts `filters.status` | app/src/pages/speakers/rowFilters.test.ts | COVERED |
| SPK-05 | src/routes/tasks.ts `POST /events/:eventId/tasks`, `POST /tasks/:id/assign`; `isActiveParticipant` gate (DEC-283, src/server/repo/tasks.ts) | test/tasks-assign-org-scope.test.ts, test/task-assignment-kind-gates.test.ts | COVERED |
| SPK-06 | src/routes/portal/index.tsx `POST /invitations/:participantId` | test/portal-signout.test.ts | COVERED |
| SPK-07 | src/routes/portal/index.tsx `GET /` session-scoped to own contact; DEC-317 invite-state gate | test/portal.test.ts | COVERED |
| SPK-08 | src/routes/portal/profile.tsx `POST /profile`, `POST /profile/headshot` | test/profile.test.ts, test/headshot-gate.test.ts | COVERED |
| SPK-09 | src/routes/portal/tasks.tsx `GET /tasks`, `POST /tasks/:assignmentId/complete` | test/portal-tasks.test.ts | COVERED |
| SPK-10 | src/routes/files.ts `GET /events/:eventId/files` | test/files.test.ts, test/files-library.test.ts | COVERED |
| SPK-11 | src/routes/api/submissions.ts organizer detail; src/routes/portal/index.tsx | test/api-participants.test.ts | COVERED |
| SPK-12 | app/src/pages/speakers/overdue.ts:24 `computeOnboardingCounts` | app/src/pages/speakers/overdue.test.ts | COVERED |
| SPK-13 | src/routes/api/contacts/bulk-email.ts `POST /contacts/bulk-email`, `event` param; DEC-319 caps+de-dupes reminder batches | test/contacts-bulk-email-mailer-failure.test.ts, test/contacts-bulk-email-preview-route.test.ts | COVERED |
| SPK-14 | src/mail/render.ts `renderTemplate`, `MERGE_FIELDS` | test/mail.test.ts, test/compose.test.ts | COVERED |
| SPK-15 | app/src/pages/contacts/customFields.ts `TRAVEL_KEY = 'travel_logistics'`; persisted via src/routes/api/contacts/crud.ts `patch.customFields` | app/src/pages/contacts/customFields.test.ts, test/contacts-profile-admin.test.ts | COVERED |
| SPK-16 | src/server/scheduled.ts `runDueReminders`; src/domain/reminders.ts `isReminderDue`, `planReminders` | test/tasks-due-reminders.test.ts, test/reminders.test.ts | COVERED |

## 04-content-management.yaml (CNT-S1..S3, CNT-01..14) — 17 rows

| id | file:line | test | verdict |
|---|---|---|---|
| CNT-S1 | scenario — exercises CNT-01/02/03/06; src/routes/tasks.ts, src/routes/portal/tasks.tsx | walkthrough battery | COVERED (scenario) |
| CNT-S2 | scenario — exercises CNT-04/05/07/08; app/src/pages/content/version-chain.ts, src/routes/files.ts | walkthrough battery | COVERED (scenario) |
| CNT-S3 | scenario — exercises CNT-09/10/11/12/13/14; src/routes/api/submissions.ts, src/lib/zip.ts | walkthrough battery | COVERED (scenario) |
| CNT-01 | src/routes/tasks.ts `POST /events/:eventId/tasks` (kind=file-request) | test/acceptance-form-tasks.test.ts | COVERED |
| CNT-02 | src/routes/portal/tasks.tsx `GET /tasks`, `POST /tasks/:assignmentId/upload` | test/task-upload-content.test.ts, test/portal-tasks.test.ts | COVERED |
| CNT-03 | `requireSpeaker` middleware in src/routes/portal/*.tsx; `requireOrganizer` on admin routes; DEC-317 invite-status gate on portal/file access | test/reviewer-file-access.test.ts, test/task-file-access.test.ts | COVERED |
| CNT-04 | app/src/pages/content/version-chain.ts `orderVersionsNewestFirst`, `orderVersionChains` (via `previous_file_id`) | app/src/pages/content/version-chain.test.ts | COVERED |
| CNT-05 | src/routes/files.ts `GET /files/:fileId/comments`, `POST` | test/files.test.ts | COVERED |
| CNT-06 | app/src/pages/content/upload-validation.ts `formatAcceptedTypesMessage` | app/src/pages/content/upload-validation.test.ts | COVERED |
| CNT-07 | app/src/pages/content/worklist.ts | app/src/pages/content/worklist.test.ts | COVERED |
| CNT-08 | src/routes/tasks.ts `POST /events/:eventId/onboarding/remind` | test/tasks-due-reminders-mailer-failure.test.ts | COVERED |
| CNT-09 | src/routes/api/submissions.ts `PATCH /submissions/:id` | test/api-submissions.test.ts | COVERED |
| CNT-10 | src/routes/api/contacts/crud.ts `PATCH /contacts/:id`, headshot route | test/contacts-profile-admin.test.ts | COVERED |
| CNT-11 | src/routes/api/submissions.ts `GET .../revisions`, `POST .../restore`; src/server/repo/revisions.ts `appendSubmissionRevision` | test/submission-revisions.test.ts | COVERED |
| CNT-12 | src/routes/files.ts:179-187 `POST /submissions/:id/content-status`; src/server/repo/public/gates.ts:26 `and(eq(status,"accepted"), eq(contentStatus,"approved"))` | test/public.test.ts, test/files.test.ts | COVERED |
| CNT-13 | app/src/pages/content/FilesLibrary.tsx; src/routes/files.ts `GET /events/:eventId/files` | app/src/pages/content/FilesLibrary.render.test.tsx | COVERED |
| CNT-14 | src/routes/files.ts `POST /events/:eventId/files/archive`; src/lib/zip.ts `buildZip` | test/zip.test.ts, test/files-archive-route.test.ts | COVERED |

## 05-ai-agenda.yaml (AIA-S1..S2, AIA-01..08) — 10 rows

| id | file:line | test | verdict |
|---|---|---|---|
| AIA-S1 | scenario — exercises AIA-01/02/03/04/05/06; app/src/pages/Agenda.tsx, src/domain/schedule.ts | walkthrough battery | COVERED (scenario) |
| AIA-S2 | scenario — exercises AIA-07/08; src/routes/agenda.ts publish/auto-schedule | walkthrough battery | COVERED (scenario) |
| AIA-01 | app/src/pages/Agenda.tsx, app/src/pages/agenda/DayGrid.tsx, agenda/state.ts | app/src/pages/agenda/Agenda.render.test.tsx, app/src/pages/agenda/state.test.ts | COVERED |
| AIA-02 | src/routes/api/events.ts:318 `GET /events/:eventId/tracks`, :326 `POST ...` + rooms CRUD routes | test/events-api.test.ts | COVERED |
| AIA-03 | src/routes/agenda.ts `PUT /submissions/:id/slot` | test/agenda-repo.test.ts | COVERED |
| AIA-04 | src/domain/schedule.ts:36 `findConflicts` (speaker dimension) | test/overlap-lanes.test.ts | COVERED |
| AIA-05 | src/domain/schedule.ts:36 `findConflicts` (room dimension) | test/overlap-lanes.test.ts, test/agenda-room-ownership.test.ts | COVERED |
| AIA-06 | src/routes/agenda.ts slot PUT recomputes via `findConflicts` | test/agenda-repo.test.ts | COVERED |
| AIA-07 | src/routes/agenda.ts:107 `POST /events/:eventId/agenda/publish`, :115 returns `{published: ...}` | test/agenda-publish.test.ts | COVERED |
| AIA-08 | src/routes/agenda.ts:156 `POST /events/:eventId/agenda/auto-schedule` | test/agenda-repo.test.ts | COVERED |

## 06-public-widgets.yaml (EMB-S1..S3, EMB-01..16) — 19 rows

| id | file:line | test | verdict |
|---|---|---|---|
| EMB-S1 | scenario — exercises EMB-01/02/03/04/05; src/routes/public/sessions.tsx, src/routes/public/speakers.tsx | walkthrough battery | COVERED (scenario) |
| EMB-S2 | scenario — exercises EMB-06/07/08/09/10/11; src/routes/public/agenda.tsx | walkthrough battery | COVERED (scenario) |
| EMB-S3 | scenario — exercises EMB-12/13/14/15/16; app/src/pages/settings/EmbedsPanel.tsx | walkthrough battery | COVERED (scenario) |
| EMB-01 | src/routes/public/cards.tsx `SessionCard`, rendered by src/routes/public/sessions.tsx; DEC-321 default CFP now collects job title/company/bio so cards populate them | test/public.test.ts | COVERED |
| EMB-02 | src/routes/public/sessions.tsx (`q` param handling) | test/public.test.ts | COVERED |
| EMB-03 | src/routes/public/sessions.tsx:43 `<nav aria-label="Track filters">`; Format/Location facets NOT found (`grep -n "format\|location" src/routes/public/query.ts` shows only card-field toggles, not facet query params — re-confirmed unchanged since prior campaign's audit) | test/public.test.ts | PARTIAL (minimum Track bar met per pass_criteria; Format/Location depth absent — not counted OPEN) |
| EMB-04 | src/routes/public/speakers.tsx; src/server/repo/public/speakers.ts `.orderBy(asc(lastName), asc(firstName), ...)` | test/public.test.ts | COVERED |
| EMB-05 | src/routes/public/detail.tsx; src/server/repo/public/speakers.ts name search | test/public.test.ts | COVERED |
| EMB-06 | src/routes/public/agenda.tsx `AgendaDayGrid` | test/public.test.ts | COVERED |
| EMB-07 | src/routes/public/agenda.tsx via src/routes/public/dispatch.tsx | test/public.test.ts | COVERED |
| EMB-08 | src/routes/public/detail.tsx; back control src/routes/public/shell.tsx | test/public.test.ts | COVERED |
| EMB-09 | src/routes/public/agenda.tsx itinerary toggle | test/itinerary-roundtrip.test.ts | COVERED |
| EMB-10 | src/routes/public/agenda.tsx `itineraryStorageKey`, client toggle | test/itinerary-roundtrip.test.ts | COVERED |
| EMB-11 | localStorage key + `?ids=` query .ics export; DEC-310 queries requested ids not whole agenda; DEC-323 fixed a since-resolved empty-agenda schedule.ics bug (both post-date the prior campaign's audit and reinforce this verdict) | test/ics-download.test.ts, test/itinerary-roundtrip.test.ts | COVERED |
| EMB-12 | src/routes/public/dispatch.tsx `case "gallery"` | test/public.test.ts | COVERED |
| EMB-13 | same drill-in mechanism as EMB-05/EMB-08; DEC-322 makes social-link publishing safe | test/public.test.ts | COVERED |
| EMB-14 | no `requireOrganizer`/`requireSpeaker` in src/routes/public/*.tsx | test/public-invite-visibility.test.ts, test/public.test.ts | COVERED |
| EMB-15 | app/src/pages/settings/EmbedsPanel.tsx imports `EMBED_SURFACES` from app/src/pages/settings/embedSnippet.ts:9 `export const EMBED_SURFACES = ['sessions','speakers','agenda','schedule','gallery']` (all 5 types); multi-format (iframe/link/json/ics) + `fields` allowlist param present. `grep -n "branding\|color" embedSnippet.ts` — no hits, branding/color option absent | app/src/pages/settings/embedSnippet.test.ts | COVERED (minimum bar of format+field config met; branding/color depth absent, not counted OPEN) |
| EMB-16 | src/server/repo/public/*.ts single read path for all public surfaces; src/server/pubcache.ts is an HTTP cache layer, not a data copy; DEC-324 fixed a public onError cache leak (post-dates prior audit, reinforces consistency) | test/pubcache.test.ts | COVERED |

## 07-speaker-crm.yaml (CRM-S1..S2, CRM-01..12) — 14 rows

| id | file:line | test | verdict |
|---|---|---|---|
| CRM-S1 | scenario — exercises CRM-01/02/03/04; src/routes/api/contacts/crud.ts | walkthrough battery | COVERED (scenario) |
| CRM-S2 | scenario — exercises CRM-05/06/07/08/09/10/11/12; src/routes/api/contacts/*.ts, src/routes/api/pipeline.ts | walkthrough battery | COVERED (scenario) |
| CRM-01 | src/routes/api/contacts/crud.ts `GET /contacts` (org-scoped) | test/contacts-repo.test.ts, test/contacts.test.ts | COVERED |
| CRM-02 | src/domain/contacts.ts pure filter fns (DEC-266); app/src/pages/contacts/FilterRulesPanel.tsx | test/contacts-rules-param.test.ts | COVERED |
| CRM-03 | src/routes/api/contacts/crud.ts `GET /contacts/:id` | test/contact-profile-roundtrip.test.ts | COVERED |
| CRM-04 | src/routes/api/contacts/crud.ts `patch.customFields` | test/contacts-profile-admin.test.ts | COVERED |
| CRM-05 | src/routes/api/contacts/import.ts `POST /contacts/import` | test/contacts-import.test.ts | COVERED |
| CRM-06 | src/routes/api/contacts/merge.ts `GET /contacts/duplicates`, `POST /contacts/merge`; src/server/repo/contacts/query.ts `CONTACT_FK_TABLES` (7 entries) | test/contacts-duplicates-merge-route.test.ts | COVERED |
| CRM-07 | src/routes/api/pipeline.ts `POST /pipeline`, `PATCH /pipeline/:id` | test/pipeline-api.test.ts | COVERED |
| CRM-08 | src/routes/api/pipeline.ts `POST /pipeline/:id/notes` | test/pipeline-api.test.ts | COVERED |
| CRM-09 | src/routes/api/contacts/segments.ts `POST /segments` | app/src/pages/contacts/segments.test.ts | COVERED |
| CRM-10 | src/routes/api/contacts/crud.ts `POST /contacts/:id/add-to-event` (DEC-156) | test/contacts-add-to-event.test.ts | COVERED |
| CRM-11 | src/routes/api/contacts/bulk-email.ts `POST /contacts/bulk-email`, preview | test/contacts-bulk-email-preview-route.test.ts | COVERED |
| CRM-12 | src/routes/api/contacts/crud.ts `GET /contacts/stats`; app/src/pages/contacts/StatsStrip.tsx | test/contacts-repo.test.ts | COVERED |

## Row count check

CFP 20 + ABS 17 + SPK 19 + CNT 17 + AIA 10 + EMB 19 + CRM 14 = **116** rows,
matching `grep -h "^\s*- id:" docs/eval-rubric/*.yaml | wc -l` = 116 exactly.

## Per-area COVERED/total

- 01-call-for-papers: 16/16 rubric criteria COVERED (+4 scenarios COVERED)
- 02-abstract-management: 13/14 COVERED, 1 WAIVED (ABS-14, DEC-272) (+3 scenarios)
- 03-speaker-management: 16/16 COVERED (+3 scenarios)
- 04-content-management: 14/14 COVERED (+3 scenarios)
- 05-ai-agenda: 8/8 COVERED (+2 scenarios)
- 06-public-widgets: 14/16 COVERED, 2 PARTIAL-meets-minimum (EMB-03, EMB-15 — not OPEN) (+3 scenarios)
- 07-speaker-crm: 12/12 COVERED (+2 scenarios)

Totals: 93 COVERED + 1 WAIVED + 2 PARTIAL-meets-minimum = 96/96 rubric-criterion
rows disposed, 0 NOT-COVERED. 20/20 scenario rows COVERED (scenario).

## Stage-1 gaps (rubric NOT-COVERED that SPEC.md also requires)

None. Zero rubric-criterion rows are NOT-COVERED. The two depth-partials
(EMB-03: Format/Location facets beyond the required Track minimum; EMB-15:
branding/color option in the embed panel) are aspirational rubric prose
beyond each item's own stated minimum pass bar — neither is independently
required by SPEC.md at a stricter bar than the rubric itself states, so
neither is a stage-1 gap. ABS-14 (AI-assisted triage) is self-conditional
("if the clone claims AI-assisted triage") and formally WAIVED per DEC-272;
SPEC.md nowhere claims AI-assisted review, and stage-1's no-secrets/
no-external-API rule (SPEC.md §0, "stage-1 code must run with no secrets
present") forecloses adding one, so it is out of scope by house rule, not a
gap.

Out-of-scope items per SPEC.md:59-69 (stage-2 platform wiring, or explicit
non-goals — Accelevents, attendee registration/ticketing, sponsors/
exhibitors, agentic admin, calendar-API integration, pixel fidelity): none
of the 96 rubric-criterion rows fall in these categories — the rubric's
scope (CFP, abstract review, speaker management, content/deliverables,
agenda scheduling, public widgets, speaker CRM) is entirely stage-1
in-scope per SPEC §0's "entire feature surface J1-J12" framing. No
rubric-only feature is proposed here (task instruction honored).

OPEN ITEMS: 0
RESULT: PASS
