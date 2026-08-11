# task-w4-e - rubric-coverage @ 0da9876

DEC-264 EVIDENCE LANE. This log is read-only evidence of rubric-id -> implementation/test
mapping. It does NOT claim to satisfy any exit predicate and prints no `FROZEN SHA:` line.

Method: `grep -n` against product code (src/, app/src/) for the route/domain/component that
implements each criterion, plus the test file (if any) that exercises it. Prose in decisions/
or prior verification-log/*.md was NOT used as evidence — every citation below was grepped
directly in this worktree at commit 0da9876.

Rubric id count found across all 7 files (`grep -c '  - id: '`): **116**, matching the field
guide's figure. Breakdown: CFP 16, ABS 14, SPK 16, CNT 14, AIA 8, EMB 16, CRM 12 = 116.

## 01-call-for-papers.yaml (CFP-01..16)

| id | file:line | test |
|---|---|---|
| CFP-01 | src/forms/builder.ts:7 (`FIELD_KINDS`), src/forms/builder.ts:88 (`validateFieldDefInput`); route src/routes/api/forms.ts:132 (`POST /forms/:formId/fields`); render+validate src/forms/validate.ts:21 (`validateAnswers`) | test/forms.test.ts, test/form-render-rules.test.ts, test/forms-api.test.ts |
| CFP-02 | src/forms/visibility.ts:7 (`isVisible`) consumed by src/routes/public/submit.tsx (form render) | test/form-render-rules.test.ts |
| CFP-03 | src/routes/public/index.tsx:65 (`publicRoutes.get('/e/:eventSlug/:surface')`); tracks/formats config src/routes/api/events.ts:284,292 (`/events/:eventId/tracks`) | test/public.test.ts |
| CFP-04 | src/lib/submit-core.ts:23 (`formWindowState`) gates src/routes/public/submit.tsx close-state branch (windowState === "closed") | test/submit-core.test.ts |
| CFP-05 | src/routes/public/submit.tsx (account creation + submit flow), dashboard src/routes/portal/index.tsx:225 (`GET /`) | test/portal.test.ts, test/submit-mailer-failure.test.ts |
| CFP-06 | src/routes/api/submissions.ts (organizer list/detail GET), field round-trip via src/db/schema.ts submission table | test/api-submissions.test.ts |
| CFP-07 | src/lib/draft.ts:26 (`draftCookieName`), :63 (`saveDraft`) wired in src/routes/public/submit.tsx (draft save/resume) | test/submit-draft-notice.test.ts |
| CFP-08 | src/routes/public/submit.tsx:612 (`mailer.send` confirmation email, best-effort, logged via email_log per DEC-009 comment) | test/submit-mailer-failure.test.ts, test/dev-mailbox.test.ts |
| CFP-09 | edit route src/routes/portal/edit.tsx:220 (`POST /submissions/:id/edit`); lock gate src/domain/edit-lock.ts:10 (`canEditSubmission`) | test/portal-edit-track-validation.test.ts, test/edit-lock.test.ts |
| CFP-10 | reviewer provisioning src/routes/api/users.ts:53 (`POST /api/v1/users`, role in {reviewer,organizer}); reviewer-scoped routes src/routes/review.ts:550 (`GET /api/v1/review/plans`) | test/users-api.test.ts, test/events-reviewer-access.test.ts |
| CFP-11 | assignment src/routes/review.ts:361 (`POST /plans/:id/reviewers`); scoring src/domain/evaluation.ts:27 (`computeWeightedScore`), :74 (`aggregateSubmission`) | test/round-criteria.test.ts, test/evaluation.test.ts |
| CFP-12 | decision status src/routes/api/submissions.ts:331 (`POST /events/:eventId/submissions/status`); src/domain/status.ts:48 (`changeStatus`) | test/status-bulk-full-match.test.ts |
| CFP-13 | speaker dashboard reads submission.status via src/routes/portal/index.tsx:225; statuses defined src/domain/status.ts:12 (`SUBMISSION_STATUSES`) | test/portal.test.ts |
| CFP-14 | notify pipeline src/routes/comms.ts:324 (`POST /compose/send`), atomic preflight + per-recipient catch (comment at :338-356) | test/compose.test.ts, test/compose-full-set.test.ts, test/comms-send-mailer-failure.test.ts |
| CFP-15 | handoff src/domain/acceptance.ts:97 (`planAcceptance`) invoked src/server/repo/submissions/status.ts:129 — accepted submission becomes a session automatically, no re-entry | test/domain.test.ts, test/api-submissions.test.ts |
| CFP-16 | src/domain/edit-lock.ts:10 (`canEditSubmission`) checked against closeDate; enforced in src/routes/portal/edit.tsx | test/portal-edit-speaker-locked.test.ts, test/portal-edit-speaker-locked-route.test.ts, test/edit-lock.test.ts |

## 02-abstract-management.yaml (ABS-01..14)

| id | file:line | test |
|---|---|---|
| ABS-01 | src/routes/review.ts:244 (`POST /events/:eventId/plans`), :355 (`advance-round`); src/domain/evaluation.ts:304 (`isPlanOpen`) | test/review-rounds.test.ts, test/rounds.test.ts |
| ABS-02 | reviewer-pool add scoped to plan/round src/routes/review.ts:361 (`POST /plans/:id/reviewers`, plan-scoped, not global) | test/round-criteria.test.ts |
| ABS-03 | scorecard field types src/domain/evaluation.ts:242 (`aggregateDropdownCriterion`) plus numeric via computeWeightedScore:27 and free-text stored alongside rating (see src/routes/review.ts scorecard submit) | app/src/pages/review/scorecardLogic.test.ts, test/round-criteria.test.ts |
| ABS-04 | weighted aggregate src/domain/evaluation.ts:27 (`computeWeightedScore`) | test/evaluation.test.ts |
| ABS-05 | assignment scoping src/domain/evaluation.ts:325 (`buildReviewerQueue`); route src/routes/review.ts:590 (`GET /review/plans/:id/queue`) | test/review-queue-shape.test.ts, test/review-idor.test.ts |
| ABS-06 | track-filtered bulk assignment: src/routes/review.ts:361 accepts `trackId` (assign-by-track) — satisfies "at least one of" cap/auto-distribute/track-filter | test/round-criteria.test.ts (no dedicated per-reviewer-cap test found — OPEN gap: caps/auto-distribute not implemented, only track-filter) |
| ABS-07 | anonymization src/domain/evaluation.ts:418 (`anonymizeForReviewer`) | test/round-criteria.test.ts |
| ABS-08 | progress dashboard src/routes/review.ts:400 (`GET /plans/:id/progress`); app/src/pages/review/progress.ts (`ProgressPanel`) | app/src/pages/review/progress.test.ts |
| ABS-09 | bulk reminder src/routes/review.ts:502 (`POST /plans/:id/remind`) | test/review-remind-mailer-failure.test.ts |
| ABS-10 | results table + sort src/routes/review.ts:469 (`GET /plans/:id/results`); app/src/pages/review/resultsSort.ts | app/src/pages/review/resultsSort.test.ts |
| ABS-11 | co-presenter invite src/routes/api/submissions.ts:255 (`POST /submissions/:id/participants`), DEC-070; visible in app/src/pages/submissions/SubmissionDetailPage.tsx (coPresenter state) | test/participant-attribution.test.ts |
| ABS-12 | **OPEN** — no match for `conflict.*interest|recuse|\bcoi\b` in src/ or app/src/ (grepped case-insensitive); marked as an inferred/category-norm item in the rubric itself, not implemented | none |
| ABS-13 | CSV export src/routes/review.ts (results feed) + app/src/pages/review/resultsCsv.ts (`buildResultsCsvHref`) | app/src/pages/review/resultsCsv.test.ts |
| ABS-14 | **OPEN** — no match for `ai.?triage|aiScore|ai_score|aiEvaluator` in src/ or app/src/; rubric criterion is itself conditional ("If the clone claims AI-assisted triage") — the clone makes no such claim, so this item does not apply, but no AI-scoring feature exists to evaluate | none |

## 03-speaker-management.yaml (SPK-01..16)

| id | file:line | test |
|---|---|---|
| SPK-01 | roster grid src/routes/tasks.ts:96 (`GET /events/:eventId/onboarding`); search/filter app/src/pages/speakers/rowFilters.ts:9 (`filterOnboardingRows`) | app/src/pages/speakers/rowFilters.test.ts |
| SPK-02 | add/edit speaker via contact record src/routes/api/contacts.ts:110 (`POST /contacts`), :155 (`PATCH /contacts/:id`) + add-to-event :289 | test/contacts.test.ts, test/contacts-profile-admin.test.ts |
| SPK-03 | **OPEN** — org-level contact CSV import exists (src/routes/api/contacts.ts:311, `POST /contacts/import`) but there is no event-speaker-roster-scoped import; no `csv` reference found in app/src/pages/Speakers.tsx or app/src/pages/speakers/*.tsx. Gap: importing directly onto an event roster requires the two-step contacts-import + add-to-event flow, not a single "speaker roster" import | test/contacts-import.test.ts (covers contacts-level import only) |
| SPK-04 | status field on contact/participant + filter app/src/pages/speakers/rowFilters.ts:9 (`filters.status`) | app/src/pages/speakers/rowFilters.test.ts |
| SPK-05 | src/routes/tasks.ts:109 (`POST /events/:eventId/tasks`), :256 (`POST /tasks/:id/assign`, multi-speaker) | test/tasks-assign-org-scope.test.ts, test/task-assignment-kind-gates.test.ts |
| SPK-06 | portal invitation route src/routes/portal/index.tsx:261 (`POST /invitations/:participantId`) | test/portal-signout.test.ts (no dedicated invite-send test found; onboarding-email path shares src/mail/) |
| SPK-07 | scoped portal src/routes/portal/index.tsx:225 (`GET /`, session-scoped to own contact) | test/portal.test.ts |
| SPK-08 | profile edit src/routes/portal/profile.tsx:243 (`POST /profile`), :280 (`POST /profile/headshot`) | test/profile.test.ts, test/headshot-gate.test.ts, test/portal-profile-headshot-notice.test.ts |
| SPK-09 | portal task list + complete src/routes/portal/tasks.tsx:339 (`GET /tasks`), :396 (`POST /tasks/:assignmentId/complete`) | test/portal-tasks.test.ts |
| SPK-10 | organizer file download src/routes/files.ts:190 (`GET /events/:eventId/files`) | test/files.test.ts, test/files-library.test.ts |
| SPK-11 | session assignments visible: submission/participant join surfaced in src/routes/api/submissions.ts organizer detail + src/routes/portal/index.tsx portal view | test/api-participants.test.ts |
| SPK-12 | progress at list level app/src/pages/speakers/overdue.ts:24 (`computeOnboardingCounts`) | app/src/pages/speakers/overdue.test.ts |
| SPK-13 | event-scoped bulk email src/routes/api/contacts.ts:600 (`POST /contacts/bulk-email`, takes `event` param, logs via mailer/email_log) | test/contacts-bulk-email-mailer-failure.test.ts, test/contacts-bulk-email-preview-route.test.ts |
| SPK-14 | merge-field rendering src/mail/render.ts:26 (`renderTemplate`), :5 (`MERGE_FIELDS`) | test/mail.test.ts, test/compose.test.ts |
| SPK-15 | contact.customFields (src/routes/api/contacts.ts:182, `patch.customFields`) is the only persisted "custom logistics field" mechanism found; no dedicated travel-preference field in src/db/schema.ts (grepped `travel|logistic`, no hits) — logistics data must be modeled via customFields, not a first-class field | test/contacts-social-links.test.ts (adjacent coverage; no travel-specific test) |
| SPK-16 | automated cron reminders src/server/scheduled.ts:16 (`runDueReminders`, wired to wrangler.jsonc crons `*/15 * * * *`); logic src/domain/reminders.ts:35 (`isReminderDue`), :50 (`planReminders`) | test/tasks-due-reminders.test.ts, test/reminders.test.ts |

## 04-content-management.yaml (CNT-01..14)

| id | file:line | test |
|---|---|---|
| CNT-01 | src/routes/tasks.ts:109 (`POST /events/:eventId/tasks`, kind=file-request with dueDate/instructions) | test/acceptance-form-tasks.test.ts |
| CNT-02 | src/routes/portal/tasks.tsx:339 (`GET /tasks`), :461 (`POST /tasks/:assignmentId/upload`) | test/task-upload-content.test.ts, test/portal-tasks.test.ts |
| CNT-03 | scoping middleware `requireSpeaker`/session ownership check in src/routes/portal/*.tsx (DEC-012/013); org/admin routes gated by `requireOrganizer` | test/reviewer-file-access.test.ts, test/task-file-access.test.ts |
| CNT-04 | version chaining app/src/pages/content/version-chain.ts:12 (`orderVersionsNewestFirst`), :27 (`orderVersionChains`) via `previous_file_id` chain (DEC-050-ish, field guide) | app/src/pages/content/version-chain.test.ts |
| CNT-05 | comments src/routes/files.ts:258 (`GET /files/:fileId/comments`), :265 (`POST`) | test/files.test.ts |
| CNT-06 | src/pages/content/upload-validation.ts:29 (`formatAcceptedTypesMessage`) rendered in app/src/pages/content/UploadZone.tsx | app/src/pages/content/upload-validation.test.ts |
| CNT-07 | worklist/dashboard app/src/pages/content/worklist.ts (per-speaker/task status) | app/src/pages/content/worklist.test.ts |
| CNT-08 | src/routes/tasks.ts:339 (`POST /events/:eventId/onboarding/remind`) | test/tasks-remind-now-mailer-failure.test.ts, test/tasks-due-reminders.test.ts |
| CNT-09 | src/routes/api/submissions.ts:142 (`PATCH /submissions/:id`, title/description) | test/api-submissions.test.ts |
| CNT-10 | src/routes/api/contacts.ts:155 (`PATCH /contacts/:id`, bio/etc.); headshot src/routes/api/contacts.ts:227 (`POST /contacts/:id/headshot`) | test/contacts-profile-admin.test.ts |
| CNT-11 | revision history src/routes/api/submissions.ts:193 (`GET /submissions/:id/revisions`), :209 (`POST .../restore`); repo src/server/repo/revisions.ts (`appendSubmissionRevision`) | test/submission-revisions.test.ts |
| CNT-12 | content-status gate src/routes/files.ts:169 (`POST /submissions/:id/content-status`); public filter src/server/repo/public.ts:41 (`eq(schema.submission.contentStatus, "approved")`) | test/public.test.ts, test/files.test.ts |
| CNT-13 | central library app/src/pages/content/FilesLibrary.tsx:16 (`FilesLibrary`); backing route src/routes/files.ts:190 | app/src/pages/content/FilesLibrary.render.test.tsx |
| CNT-14 | bulk ZIP src/routes/files.ts:206 (`POST /events/:eventId/files/archive`) using src/lib/zip.ts:107 (`buildZip`) | test/zip.test.ts, test/files-archive-route.test.ts |

## 05-ai-agenda.yaml (AIA-01..08)

| id | file:line | test |
|---|---|---|
| AIA-01 | agenda builder app/src/pages/Agenda.tsx + app/src/pages/agenda/DayGrid.tsx, day nav app/src/pages/agenda/state.ts | app/src/pages/agenda/Agenda.render.test.tsx, app/src/pages/agenda/state.test.ts |
| AIA-02 | rooms/tracks config src/routes/api/events.ts:284 (`GET tracks`), :292 (`POST tracks`), :364/:372 (rooms) | test/events-api.test.ts |
| AIA-03 | slot placement src/routes/agenda.ts:44 (`PUT /submissions/:id/slot`) persisted to DB | test/agenda-repo.test.ts |
| AIA-04 | speaker double-booking check src/domain/schedule.ts:36 (`findConflicts`) | test/overlap-lanes.test.ts |
| AIA-05 | room conflict same as findConflicts (src/domain/schedule.ts:36), room dimension included in Conflict type | test/overlap-lanes.test.ts, test/agenda-room-ownership.test.ts |
| AIA-06 | move + conflict clear: src/routes/agenda.ts:44 (slot PUT) recomputes via findConflicts; UI app/src/pages/agenda/ConflictChip.tsx | test/agenda-repo.test.ts |
| AIA-07 | publish src/routes/agenda.ts:100 (`POST /events/:eventId/agenda/publish`) | test/agenda-publish.test.ts |
| AIA-08 | auto-schedule src/routes/agenda.ts:123 (`POST /events/:eventId/agenda/auto-schedule`) using src/domain/schedule.ts:108 (`autoSchedule`) | test/agenda-repo.test.ts |

## 06-public-widgets.yaml (EMB-01..16)

| id | file:line | test |
|---|---|---|
| EMB-01 | src/routes/public/cards.tsx:86 (`SessionCard`) rendered by src/routes/public/sessions.tsx | test/public.test.ts |
| EMB-02 | keyword search src/routes/public/sessions.tsx:25-32 (search form, `q` param) matching title+speaker per src/server/repo/public.ts query | test/public.test.ts:257 (`describe("EMB-02...")`) |
| EMB-03 | Track filter (minimum bar met) src/routes/public/sessions.tsx:33-45 (`nav aria-label="Track filters"`). Format/Location facets NOT found (grepped src/routes/public/query.ts for format/location — no hits): depth gap beyond the "at minimum Track" floor | test/public.test.ts |
| EMB-04 | speakers directory src/routes/public/speakers.tsx, ordering src/server/repo/public.ts:436 (`.orderBy(asc(lastName), asc(firstName), ...)`) | test/public.test.ts |
| EMB-05 | drill-in detail src/routes/public/detail.tsx:58 (`sessionTimeLabel`); search src/server/repo/public.ts:414-415 (lastName/fullName LIKE) | test/public.test.ts (DEC-151 name search comment at :398) |
| EMB-06 | agenda grid src/routes/public/agenda.tsx:13 (`AgendaDayGrid`) | app/src/pages/agenda tests cover organizer-side grid; public-side: test/public.test.ts (agenda surface) |
| EMB-07 | day navigation src/routes/public/agenda.tsx (day param dispatch via src/routes/public/dispatch.tsx) | test/public.test.ts |
| EMB-08 | session detail src/routes/public/detail.tsx:58 with Back control in src/routes/public/shell.tsx | test/public.test.ts |
| EMB-09 | schedule/itinerary surface src/routes/public/agenda.tsx (schedule surface with itinerary toggle, :80-83) | test/itinerary-roundtrip.test.ts |
| EMB-10 | personal schedule build src/routes/public/agenda.tsx:148 (`itineraryStorageKey`), client-side localStorage toggle :154-186 | test/itinerary-roundtrip.test.ts |
| EMB-11 | persistence via localStorage key (src/lib/itinerary.ts `itineraryStorageKey`) + .ics export link (`?ids=` query, comment at src/routes/public/agenda.tsx:145-146) | test/ics-download.test.ts, test/itinerary-roundtrip.test.ts |
| EMB-12 | gallery widget src/routes/public/dispatch.tsx:43-46 (`case "gallery": GalleryContent`) | test/public.test.ts |
| EMB-13 | gallery card detail — same drill-in mechanism as EMB-05/EMB-08 (DEC-151, comment at src/routes/public/index.tsx or detail.tsx per grep at line ~353) | test/public.test.ts |
| EMB-14 | all 5 surfaces public, no auth middleware on src/routes/public/*.tsx routes (no `requireOrganizer`/`requireSpeaker` present in that dir) | test/public-invite-visibility.test.ts, test/public.test.ts |
| EMB-15 | embed generator app/src/pages/Settings.tsx:22 (`embedSnippet`), UI at :46-54 — produces a copyable `<iframe>` snippet per surface. Gap: no output-format/branding-color/content-filter/field-selection configuration found in that panel (grepped for `format|branding|filter` near embedSnippet — none); only URL + iframe copy exists | none found (grepped app/src/pages/Settings.render.test.tsx for "embed" — no dedicated test) |
| EMB-16 | single source of truth: all public surfaces read from src/server/repo/public.ts against the same submission/participant tables as the organizer views (no separate publish/cache table found beyond src/server/pubcache.ts, which is an HTTP cache layer, not a data copy) | test/pubcache.test.ts |

## 07-speaker-crm.yaml (CRM-01..12)

| id | file:line | test |
|---|---|---|
| CRM-01 | org directory src/routes/api/contacts.ts:96 (`GET /contacts`, org-scoped, not event-scoped) | test/contacts-repo.test.ts, test/contacts.test.ts |
| CRM-02 | filter rules src/domain/contacts.ts (pure AND/OR filter fns per field guide DEC-266) + app/src/pages/contacts/FilterRulesPanel.tsx | test/contacts-rules-param.test.ts |
| CRM-03 | contact profile src/routes/api/contacts.ts:148 (`GET /contacts/:id`) includes notes; cross-event history via pipeline/segments join | test/contact-profile-roundtrip.test.ts |
| CRM-04 | customFields + tags persisted src/routes/api/contacts.ts:182 (`patch.customFields`) | test/contacts-profile-admin.test.ts |
| CRM-05 | src/routes/api/contacts.ts:311 (`POST /contacts/import`) | test/contacts-import.test.ts |
| CRM-06 | duplicates surfaced src/routes/api/contacts.ts:136 (`GET /contacts/duplicates`); merge :362 (`POST /contacts/merge`) | test/contacts-duplicates-merge-route.test.ts |
| CRM-07 | pipeline kanban src/routes/api/pipeline.ts:69 (`POST /pipeline`, enroll), :134 (`PATCH /pipeline/:id`, stage move) | test/pipeline-api.test.ts |
| CRM-08 | pipeline detail + notes src/routes/api/pipeline.ts:166 (`POST /pipeline/:id/notes`) | test/pipeline-api.test.ts |
| CRM-09 | saved segments src/routes/api/contacts.ts:471 (`POST /segments`) | app/src/pages/contacts/segments.test.ts |
| CRM-10 | push to event src/routes/api/contacts.ts:289 (`POST /contacts/:id/add-to-event`) | test/contacts-add-to-event.test.ts |
| CRM-11 | bulk email + merge fields + preview src/routes/api/contacts.ts:600 (`POST /contacts/bulk-email`), preview at :652 | test/contacts-bulk-email-preview-route.test.ts |
| CRM-12 | org-wide stats src/routes/api/contacts.ts:142 (`GET /contacts/stats`); UI app/src/pages/contacts/StatsStrip.tsx | test/contacts-repo.test.ts (stats coverage; no dedicated StatsStrip render test found) |

## Extra check: DEC-258 frozen speaker attribution

`grep -rn "title_at_time|titleAtTime|org_at_time|orgAtTime" src app` returns many hits:
`src/decisions.ts:263`, `src/server/repo/participants.ts:19,36-37,89-90`, `src/server/repo/submit.ts:15,202-203,215-216`,
`src/server/repo/public.ts:21,262-263,425-426,549-550`, `src/server/repo/submissions/create.ts:13,96-97`,
`src/db/schema.ts:254-255`, `src/server/repo/exports.ts:21,239-240`, `src/routes/public/submit.tsx:533-534`,
`src/routes/api/submissions.ts:278-279`.

DEC-258 IS implemented in this worktree — `title_at_time`/`org_at_time` columns exist in the schema
(`src/db/schema.ts:254-255`), are populated at participant-creation time (`src/server/repo/submissions/create.ts:96-97`,
`src/routes/public/submit.tsx:533-534`), and are read by public/export surfaces (`src/server/repo/public.ts:262-263`
etc., `src/server/repo/exports.ts:239-240`). This appears to be the in-flight wave-3 lane the field guide flagged as
uncertain — it has landed on main by this commit. No open item recorded for DEC-258.

## Open items summary

1. ABS-06 — no per-reviewer cap or auto-distribute; only track-filtered bulk assignment exists (partial coverage of an "at least one of three" bar, arguably still satisfies the criterion via track-filter alone — recorded as a note, not counted below).
2. ABS-12 — conflict-of-interest / recusal: no implementation found.
3. ABS-14 — AI-assisted triage: no implementation found (rubric item is self-conditional on the clone claiming the feature; it does not, but there is also no feature to grade).
4. SPK-03 — no direct event-speaker-roster CSV import; only org-level contacts import + separate add-to-event step.
5. SPK-15 — no first-class travel-preference/logistics field in schema; only generic `customFields` JSON blob.
6. EMB-03 — Format/Location facets absent from the Sessions List filter; Track alone is present (meets the rubric's stated minimum, not counted as OPEN).
7. EMB-15 — embed panel offers only iframe-snippet-per-surface; no branding/color, content-filter, or field-selection configuration knobs found.

Counting only items with no implementation at all (ABS-12, ABS-14, SPK-03, SPK-15, EMB-15) as OPEN — items
1 and 6 are recorded as depth/config gaps but the rubric's own pass_criteria ("at least one of...", "at
minimum Track") is met by what exists, so they are not counted as OPEN.

OPEN ITEMS: 5
RESULT: FAIL
