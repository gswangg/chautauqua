# task-w8-h - rubric-coverage @ 80b811d

FROZEN SHA: 80b811d250285de0d37417ddc12f65445ce27f96
RECHECK SHA: 5ccd4d63ea2648a6cc91ad18f301a77976514efb
OPEN ITEMS: 1
RESULT: FAIL

DEC-286/287 evidence lane. Method: every id below was re-verified by `grep -n`/`Read`
against product code in a detached worktree checked out at the FROZEN SHA
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/scratch-w8-h-S`).
`docs/verification-log/task-w4-e-c2-rubric-coverage.md` (at 0da9876) and
`task-w2-h-rubric-coverage.md` (at e4e7b03) were used as a starting index only — every
citation was re-grepped at S, not copied from prose. `grep -c '  - id: '` across the seven
`docs/eval-rubric/*.yaml` files confirms **116** ids: CFP 20 (16 rubric + 4 scenario), ABS 17
(14+3), SPK 19 (16+3), CNT 17 (14+3), AIA 10 (8+2), EMB 19 (16+3), CRM 14 (12+2) — this table
scores the 96 `rubric:` ids, which are the regression hooks (SPEC §9.2); the 20 `scenarios:`
ids are the browser-walkthrough scripts that feed them evidence, not independently gradable
code targets. Judged against each id's own `pass_criteria` sentence, not the aspirational
`criterion` prose.

## POST-S DELTA

```
5035438 scribe wave 8
c3b0932 merge task-w7-a
50a2947 DEC-282: make CRM merge total over pipeline_entry (fixes org-wide pipeline 500)
7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant
```

Non-empty (task-w7-a merged after S). Both commits are fixes for the two DEC-285
pre-registered KNOWN IN-FLIGHT defects (contacts.ts:207 six-of-seven FK tables;
tasks.ts:263 unfiltered listAcceptedContactIds) — re-checked below at RECHECK SHA
`5ccd4d63ea2648a6cc91ad18f301a77976514efb` in a second detached worktree
(`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/scratch-w8-h-recheck`).

### DEC-285 recheck

- `src/server/repo/contacts.ts` at RECHECK SHA: `CONTACT_FK_TABLES` now lists 7 entries
  (`user, participant, task_assignment, email_log, file, file_comment, pipeline_entry`) —
  DEC-282 landed. CLOSED, not counted OPEN. Affects CRM-06 below (now COVERED, not PARTIAL).
- `src/server/repo/tasks.ts:280` at RECHECK SHA: `listAcceptedContactIds` filters
  `rows.filter((r) => isActiveParticipant(r.inviteStatus))` (imported from
  `src/domain/acceptance.ts:82`) — DEC-283 landed. CLOSED, not counted OPEN. Affects
  SPK-05 below (assign-to-all-accepted expansion now excludes invited/declined co-speakers).

Both DEC-285 items are CLOSED at RECHECK SHA. No new rows outside these two are touched by
the delta (`5035438`/`c3b0932` are the wave-8 scribe/merge commits; the two DEC commits touch
only `src/server/repo/contacts.ts`, `src/server/repo/tasks.ts`, `src/domain/acceptance.ts`
and their tests).

## 01-call-for-papers.yaml (CFP-01..16)

| id | criterion (pass_criteria gist) | file:line | test | verdict |
|---|---|---|---|---|
| CFP-01 | custom field types + required validation | src/forms/builder.ts:7 `FIELD_KINDS`, :88 `validateFieldDefInput`; src/routes/api/forms.ts:132 `POST /forms/:formId/fields`; src/forms/validate.ts:21 `validateAnswers` | test/forms.test.ts, test/form-render-rules.test.ts, test/forms-api.test.ts | COVERED |
| CFP-02 | conditional field show/hide | src/forms/visibility.ts:7 `isVisible` consumed by src/routes/public/submit.tsx | test/form-render-rules.test.ts | COVERED |
| CFP-03 | logged-out public portal w/ deadline+tracks+formats | src/routes/public/index.tsx:65 `publicRoutes.get('/e/:eventSlug/:surface')`; src/routes/api/events.ts:284,292 tracks | test/public.test.ts | COVERED |
| CFP-04 | closed portal blocks new submissions past close date | src/lib/submit-core.ts:23 `formWindowState` gates src/routes/public/submit.tsx | test/submit-core.test.ts | COVERED |
| CFP-05 | signup, submit, confirmation, dashboard status | src/routes/public/submit.tsx (account+submit); src/routes/portal/index.tsx:225 `GET /` | test/portal.test.ts, test/submit-mailer-failure.test.ts | COVERED |
| CFP-06 | round-trip to organizer list/detail | src/routes/api/submissions.ts (organizer GET); src/db/schema.ts submission table | test/api-submissions.test.ts | COVERED |
| CFP-07 | save-as-draft, resume | src/lib/draft.ts:26 `draftCookieName`, :63 `saveDraft` in src/routes/public/submit.tsx | test/submit-draft-notice.test.ts | COVERED |
| CFP-08 | confirmation email | src/routes/public/submit.tsx:612 `mailer.send`, dev sink -> email_log (manual testability, dev-sink+log satisfies local check) | test/submit-mailer-failure.test.ts, test/dev-mailbox.test.ts | COVERED |
| CFP-09 | speaker edit round-trips to organizer view | src/routes/portal/edit.tsx:220 `POST /submissions/:id/edit`; src/domain/edit-lock.ts:10 `canEditSubmission` | test/portal-edit-track-validation.test.ts, test/edit-lock.test.ts | COVERED |
| CFP-10 | reviewer provisioning, reviewer-only dashboard | src/routes/api/users.ts:53 `POST /api/v1/users`; src/routes/review.ts:550 `GET /api/v1/review/plans` | test/users-api.test.ts, test/events-reviewer-access.test.ts | COVERED |
| CFP-11 | rating+comment recorded, visible to organizer, dashboard completion state | src/routes/review.ts:361 assignment; src/domain/evaluation.ts:27 `computeWeightedScore`, :74 `aggregateSubmission` | test/round-criteria.test.ts, test/evaluation.test.ts | COVERED |
| CFP-12 | accept/reject decisions, distinct list statuses | src/routes/api/submissions.ts:331 `POST .../submissions/status`; src/domain/status.ts:48 `changeStatus` | test/status-bulk-full-match.test.ts | COVERED |
| CFP-13 | decision propagates to speaker dashboard | src/routes/portal/index.tsx:225 reads submission.status; src/domain/status.ts:12 `SUBMISSION_STATUSES` | test/portal.test.ts | COVERED |
| CFP-14 | notify action, sent/queued confirmation | src/routes/comms.ts:324 `POST /compose/send` | test/compose.test.ts, test/compose-full-set.test.ts, test/comms-send-mailer-failure.test.ts | COVERED |
| CFP-15 | accepted submission -> session, no re-entry | src/domain/acceptance.ts:97 `planAcceptance`; src/server/repo/submissions/status.ts:129 | test/domain.test.ts, test/api-submissions.test.ts | COVERED |
| CFP-16 | editing locks after close date | src/domain/edit-lock.ts:10 `canEditSubmission` checked in src/routes/portal/edit.tsx | test/portal-edit-speaker-locked.test.ts, test/edit-lock.test.ts | COVERED |

## 02-abstract-management.yaml (ABS-01..14)

| id | pass_criteria gist | file:line | test | verdict |
|---|---|---|---|---|
| ABS-01 | multi-round review with an "advance round" control | src/routes/review.ts:244 `POST /events/:eventId/plans`, :355 `advance-round`; src/domain/evaluation.ts:304 `isPlanOpen` | test/review-rounds.test.ts, test/rounds.test.ts | COVERED |
| ABS-02 | reviewer pool scoped to a plan/round | src/routes/review.ts:361 `POST /plans/:id/reviewers` (plan-scoped) | test/round-criteria.test.ts | COVERED |
| ABS-03 | scorecard field-type variety (numeric/dropdown/free-text) | src/domain/evaluation.ts:242 `aggregateDropdownCriterion`, :27 `computeWeightedScore`; free-text alongside rating in src/routes/review.ts scorecard submit | app/src/pages/review/scorecardLogic.test.ts, test/round-criteria.test.ts | COVERED |
| ABS-04 | weighted aggregate score | src/domain/evaluation.ts:27 `computeWeightedScore` | test/evaluation.test.ts | COVERED |
| ABS-05 | reviewer queue = exactly the assigned set | src/domain/evaluation.ts:325 `buildReviewerQueue`; src/routes/review.ts:590 `GET /review/plans/:id/queue` | test/review-queue-shape.test.ts, test/review-idor.test.ts | COVERED |
| ABS-06 | "at least one of" per-reviewer cap / auto-distribute / track-filter | src/routes/review.ts:373 `trackId` on assignment (track-filtered bulk assignment satisfies the explicit "at least one of three" bar per pass_criteria) | test/round-criteria.test.ts | COVERED |
| ABS-07 | blind round hides identity from reviewer, visible to organizer | src/domain/evaluation.ts:418 `anonymizeForReviewer` | test/round-criteria.test.ts | COVERED |
| ABS-08 | progress dashboard assigned/complete counts | src/routes/review.ts:400 `GET /plans/:id/progress`; app/src/pages/review/ProgressPanel.tsx | app/src/pages/review/progress.test.ts | COVERED |
| ABS-09 | bulk reminder to lagging reviewers | src/routes/review.ts:502 `POST /plans/:id/remind` | test/review-remind-mailer-failure.test.ts | COVERED |
| ABS-10 | results table, sortable | src/routes/review.ts:469 `GET /plans/:id/results`; app/src/pages/review/resultsSort.ts | app/src/pages/review/resultsSort.test.ts | COVERED |
| ABS-11 | co-presenter/co-author attribution | src/routes/api/submissions.ts:255 `POST /submissions/:id/participants` | test/participant-attribution.test.ts | COVERED |
| ABS-12 | recusal control, exclusion from queue, organizer sees it | DEC-271: src/db/schema.ts:354 `reviewRecusal` table; src/server/repo/review.ts:737 `createRecusal`; src/routes/review.ts:785/815 POST+DELETE `/review/plans/:planId/recusals/:submissionId`, :739 409 gate on scoring, :638 `partitionRecused` queue exclusion, :417-435 progress `recused` count; app/src/pages/review/Scorecard.tsx:95 `handleRecuse`, ReviewerQueue.tsx recused section | test/review-recusal.test.ts | COVERED |
| ABS-13 | export scores/statuses | src/routes/review.ts results feed; app/src/pages/review/resultsCsv.ts `buildResultsCsvHref` | app/src/pages/review/resultsCsv.test.ts | COVERED |
| ABS-14 | AI-assisted triage (self-conditional on the clone claiming it) | WAIVED — DEC-272: "ABS-14 (AI-assisted triage) is formally WAIVED for stage 1 and may not be listed as an open item again" (src/decisions.ts:277) | n/a | WAIVED-DEC-272 |

## 03-speaker-management.yaml (SPK-01..16)

| id | pass_criteria gist | file:line | test | verdict |
|---|---|---|---|---|
| SPK-01 | roster grid, search/filter | src/routes/tasks.ts:96 `GET /events/:eventId/onboarding`; app/src/pages/speakers/rowFilters.ts:9 `filterOnboardingRows` | app/src/pages/speakers/rowFilters.test.ts | COVERED |
| SPK-02 | add/edit speaker record | src/routes/api/contacts.ts:110 `POST /contacts`, :155 `PATCH /contacts/:id`, :289 add-to-event | test/contacts.test.ts, test/contacts-profile-admin.test.ts | COVERED |
| SPK-03 | CSV import control, roster afterward contains the CSV speakers (dedupe acceptable) | org-level import src/routes/api/contacts.ts:311 `POST /contacts/import` (app/src/pages/contacts/ImportWizard.tsx) creates the new contact (Dana), then per-contact src/routes/api/contacts.ts:289 `POST /contacts/:id/add-to-event` lands them on the event roster. No single event-scoped/bulk "speaker roster CSV import" exists (no `eventId` param on `/contacts/import`; add-to-event is one-contact-at-a-time, no bulk variant) — a producer reaches the pass-criteria end state ("roster afterward contains the CSV speakers") in two manual steps rather than one import action | test/contacts-import.test.ts, test/contacts-add-to-event.test.ts | PARTIAL (pass-criteria end state reachable via a 2-step producer flow; missing control: a single event-scoped or bulk speaker-roster import) |
| SPK-04 | workflow status, changeable/persists/filterable | app/src/pages/speakers/rowFilters.ts:9 `filters.status` | app/src/pages/speakers/rowFilters.test.ts | COVERED |
| SPK-05 | create task w/ due date, assign to multiple speakers | src/routes/tasks.ts:109 `POST /events/:eventId/tasks`, :256 `POST /tasks/:id/assign`; assignToAllAccepted now gated through `isActiveParticipant` (src/server/repo/tasks.ts:280, DEC-283, landed post-S per RECHECK) | test/tasks-assign-org-scope.test.ts, test/task-assignment-kind-gates.test.ts | COVERED |
| SPK-06 | invitation/onboarding email | src/routes/portal/index.tsx:261 `POST /invitations/:participantId` | test/portal-signout.test.ts | COVERED |
| SPK-07 | scoped speaker portal | src/routes/portal/index.tsx:225 `GET /`, session-scoped to own contact | test/portal.test.ts | COVERED |
| SPK-08 | profile edit incl. headshot | src/routes/portal/profile.tsx:243 `POST /profile`, :280 `POST /profile/headshot` | test/profile.test.ts, test/headshot-gate.test.ts | COVERED |
| SPK-09 | portal task list + complete | src/routes/portal/tasks.tsx:339 `GET /tasks`, :396 `POST /tasks/:assignmentId/complete` | test/portal-tasks.test.ts | COVERED |
| SPK-10 | organizer file download | src/routes/files.ts:190 `GET /events/:eventId/files` | test/files.test.ts, test/files-library.test.ts | COVERED |
| SPK-11 | session assignments visible on speaker record | organizer detail src/routes/api/submissions.ts + src/routes/portal/index.tsx | test/api-participants.test.ts | COVERED |
| SPK-12 | onboarding progress at list level | app/src/pages/speakers/overdue.ts:24 `computeOnboardingCounts` | app/src/pages/speakers/overdue.test.ts | COVERED |
| SPK-13 | event-scoped bulk email | src/routes/api/contacts.ts:600 `POST /contacts/bulk-email` (`event` param) | test/contacts-bulk-email-mailer-failure.test.ts, test/contacts-bulk-email-preview-route.test.ts | COVERED |
| SPK-14 | merge-field rendering in templates | src/mail/render.ts:26 `renderTemplate`, :5 `MERGE_FIELDS` | test/mail.test.ts, test/compose.test.ts | COVERED |
| SPK-15 | travel/logistics field or generic custom field persists across save+reload in the UI | app/src/pages/contacts/ContactDrawer.tsx:28 `customFieldsText` state loads `c.customFields` on open (:54), edits, PATCHes on save (:85) via src/routes/api/contacts.ts:182 `patch.customFields`; this IS the speaker record (SPK-02: speakers are contacts) so the round-trip applies directly, satisfying the rubric's explicit "a generic custom field on the speaker record" bar | test/contacts-profile-admin.test.ts (server round-trip); app/src/pages/contacts/ContactsApp.tabs.render.test.tsx (drawer renders customFields) | COVERED |
| SPK-16 | automated reminder emails by due date | src/server/scheduled.ts:16 `runDueReminders` (wrangler cron); src/domain/reminders.ts:35 `isReminderDue`, :50 `planReminders` | test/tasks-due-reminders.test.ts, test/reminders.test.ts | COVERED |

## 04-content-management.yaml (CNT-01..14)

| id | pass_criteria gist | file:line | test | verdict |
|---|---|---|---|---|
| CNT-01 | file-request task w/ due date+instructions | src/routes/tasks.ts:109 `POST /events/:eventId/tasks` kind=file-request | test/acceptance-form-tasks.test.ts | COVERED |
| CNT-02 | speaker uploads against a task | src/routes/portal/tasks.tsx:339 `GET /tasks`, :461 `POST /tasks/:assignmentId/upload` | test/task-upload-content.test.ts, test/portal-tasks.test.ts | COVERED |
| CNT-03 | file access scoped to owner/organizer | `requireSpeaker`/session ownership checks in src/routes/portal/*.tsx; `requireOrganizer` on admin routes | test/reviewer-file-access.test.ts, test/task-file-access.test.ts | COVERED |
| CNT-04 | version chain, newest-first | app/src/pages/content/version-chain.ts:12 `orderVersionsNewestFirst`, :27 `orderVersionChains` via `previous_file_id` | app/src/pages/content/version-chain.test.ts | COVERED |
| CNT-05 | comments on files | src/routes/files.ts:258 `GET /files/:fileId/comments`, :265 `POST` | test/files.test.ts | COVERED |
| CNT-06 | accepted-types messaging on upload | app/src/pages/content/upload-validation.ts:29 `formatAcceptedTypesMessage` | app/src/pages/content/upload-validation.test.ts | COVERED |
| CNT-07 | per-speaker/task worklist | app/src/pages/content/worklist.ts | app/src/pages/content/worklist.test.ts | COVERED |
| CNT-08 | remind-now for outstanding file requests | src/routes/tasks.ts:339 `POST /events/:eventId/onboarding/remind` | test/tasks-remind-now-mailer-failure.test.ts | COVERED |
| CNT-09 | organizer edits submission metadata | src/routes/api/submissions.ts:142 `PATCH /submissions/:id` | test/api-submissions.test.ts | COVERED |
| CNT-10 | organizer edits speaker bio/headshot | src/routes/api/contacts.ts:155 `PATCH /contacts/:id`; :227 `POST /contacts/:id/headshot` | test/contacts-profile-admin.test.ts | COVERED |
| CNT-11 | revision history + restore | src/routes/api/submissions.ts:193 `GET .../revisions`, :209 `POST .../restore`; src/server/repo/revisions.ts `appendSubmissionRevision` | test/submission-revisions.test.ts | COVERED |
| CNT-12 | content-approval gate before public visibility | src/routes/files.ts:169 `POST /submissions/:id/content-status`; src/server/repo/public.ts:41 filter `contentStatus === 'approved'` | test/public.test.ts, test/files.test.ts | COVERED |
| CNT-13 | central files library across event | app/src/pages/content/FilesLibrary.tsx:16; src/routes/files.ts:190 | app/src/pages/content/FilesLibrary.render.test.tsx | COVERED |
| CNT-14 | bulk ZIP download | src/routes/files.ts:206 `POST /events/:eventId/files/archive`; src/lib/zip.ts:107 `buildZip` | test/zip.test.ts, test/files-archive-route.test.ts | COVERED |

## 05-ai-agenda.yaml (AIA-01..08)

| id | pass_criteria gist | file:line | test | verdict |
|---|---|---|---|---|
| AIA-01 | agenda builder, day nav | app/src/pages/Agenda.tsx, app/src/pages/agenda/DayGrid.tsx, agenda/state.ts | app/src/pages/agenda/Agenda.render.test.tsx, app/src/pages/agenda/state.test.ts | COVERED |
| AIA-02 | rooms/tracks config | src/routes/api/events.ts:284/:292 tracks, :364/:372 rooms | test/events-api.test.ts | COVERED |
| AIA-03 | slot placement persists | src/routes/agenda.ts:44 `PUT /submissions/:id/slot` | test/agenda-repo.test.ts | COVERED |
| AIA-04 | speaker double-booking detection | src/domain/schedule.ts:36 `findConflicts` | test/overlap-lanes.test.ts | COVERED |
| AIA-05 | room conflict detection | src/domain/schedule.ts:36 `findConflicts` (room dimension in `Conflict` type) | test/overlap-lanes.test.ts, test/agenda-room-ownership.test.ts | COVERED |
| AIA-06 | move + conflict indicator clears | src/routes/agenda.ts:44 slot PUT recomputes via `findConflicts`; app/src/pages/agenda/ConflictChip.tsx | test/agenda-repo.test.ts | COVERED |
| AIA-07 | publish agenda | src/routes/agenda.ts:100 `POST /events/:eventId/agenda/publish` | test/agenda-publish.test.ts | COVERED |
| AIA-08 | auto-schedule | src/routes/agenda.ts:123 `POST /events/:eventId/agenda/auto-schedule`; src/domain/schedule.ts:108 `autoSchedule` | test/agenda-repo.test.ts | COVERED |

## 06-public-widgets.yaml (EMB-01..16)

| id | pass_criteria gist | file:line | test | verdict |
|---|---|---|---|---|
| EMB-01 | session cards list widget | src/routes/public/cards.tsx:86 `SessionCard` rendered by src/routes/public/sessions.tsx | test/public.test.ts | COVERED |
| EMB-02 | keyword search over title+speaker | src/routes/public/sessions.tsx:25-32 (`q` param) | test/public.test.ts | COVERED |
| EMB-03 | filter panel, at minimum Track facet | src/routes/public/sessions.tsx:33-45 `nav aria-label="Track filters"`; Format/Location facets NOT found (`grep format\|location\|room` in src/routes/public/query.ts — no hits) | test/public.test.ts | PARTIAL (minimum Track bar met; Format/Location depth absent — not counted OPEN since the stated minimum passes) |
| EMB-04 | speaker directory, alpha by surname | src/routes/public/speakers.tsx; src/server/repo/public.ts:436 `.orderBy(asc(lastName), asc(firstName), ...)` | test/public.test.ts | COVERED |
| EMB-05 | speaker detail drill-in | src/routes/public/detail.tsx:58 `sessionTimeLabel`; src/server/repo/public.ts:414-415 name search | test/public.test.ts | COVERED |
| EMB-06 | agenda per-day grid | src/routes/public/agenda.tsx:13 `AgendaDayGrid` | test/public.test.ts | COVERED |
| EMB-07 | day navigation | src/routes/public/agenda.tsx via src/routes/public/dispatch.tsx | test/public.test.ts | COVERED |
| EMB-08 | session detail drill-in from list | src/routes/public/detail.tsx:58; back control src/routes/public/shell.tsx | test/public.test.ts | COVERED |
| EMB-09 | schedule/itinerary surface | src/routes/public/agenda.tsx :80-83 itinerary toggle | test/itinerary-roundtrip.test.ts | COVERED |
| EMB-10 | personal schedule build (add/remove) | src/routes/public/agenda.tsx:148 `itineraryStorageKey`, :154-186 client toggle | test/itinerary-roundtrip.test.ts | COVERED |
| EMB-11 | itinerary persists + exportable (.ics) | localStorage key + `?ids=` query .ics export | test/ics-download.test.ts, test/itinerary-roundtrip.test.ts | COVERED |
| EMB-12 | gallery widget | src/routes/public/dispatch.tsx:43-46 `case "gallery"` | test/public.test.ts | COVERED |
| EMB-13 | gallery card detail drill-in | same drill-in mechanism as EMB-05/EMB-08 | test/public.test.ts | COVERED |
| EMB-14 | all surfaces public, no auth required | no `requireOrganizer`/`requireSpeaker` in src/routes/public/*.tsx | test/public-invite-visibility.test.ts, test/public.test.ts | COVERED |
| EMB-15 | embed/share area, widget-type choices, generated snippet; full credit needs multiple output formats + branding/filter/field options | app/src/pages/Settings.tsx:14 `EMBED_SURFACES` (5 of 5 widget types: sessions/speakers/agenda/schedule/gallery), :22 `embedSnippet` generates a copyable `<iframe>` per surface — meets the stated minimum (widget-type choices + generated snippet). No output-format picker (styled HTML/basic HTML/JSON/XML/iCal), no branding/color, no content-filter/field-selection option found (grepped `format\|branding\|filter` near `embedSnippet` — no hits) | none found for the embed panel specifically | PARTIAL (minimum bar met — not counted OPEN; full-credit depth: alternate output formats and branding/filter/field configuration absent) |
| EMB-16 | cross-surface data consistency w/ organizer source | src/server/repo/public.ts is the single read path for all public surfaces, same submission/participant tables as organizer views; src/server/pubcache.ts is an HTTP cache layer, not a data copy | test/pubcache.test.ts | COVERED |

## 07-speaker-crm.yaml (CRM-01..12)

| id | pass_criteria gist | file:line | test | verdict |
|---|---|---|---|---|
| CRM-01 | org-wide contact directory | src/routes/api/contacts.ts:96 `GET /contacts` (org-scoped) | test/contacts-repo.test.ts, test/contacts.test.ts | COVERED |
| CRM-02 | AND-tokens x OR-columns filter rules | src/domain/contacts.ts pure filter fns (DEC-266); app/src/pages/contacts/FilterRulesPanel.tsx | test/contacts-rules-param.test.ts | COVERED |
| CRM-03 | contact profile w/ cross-event history | src/routes/api/contacts.ts:148 `GET /contacts/:id` | test/contact-profile-roundtrip.test.ts | COVERED |
| CRM-04 | custom fields + tags persist | src/routes/api/contacts.ts:182 `patch.customFields` | test/contacts-profile-admin.test.ts | COVERED |
| CRM-05 | CSV import at org level | src/routes/api/contacts.ts:311 `POST /contacts/import` | test/contacts-import.test.ts | COVERED |
| CRM-06 | duplicate detection + merge total over every FK table | src/routes/api/contacts.ts:136 `GET /contacts/duplicates`, :362 `POST /contacts/merge`; src/server/repo/contacts.ts `CONTACT_FK_TABLES` — at FROZEN SHA this listed only 6 of 7 tables (DEC-285 pre-registered gap, `pipeline_entry` omitted); at RECHECK SHA (post-S delta, DEC-282) the list is the full 7 (`user, participant, task_assignment, email_log, file, file_comment, pipeline_entry`) | test/contacts-duplicates-merge-route.test.ts | COVERED (was PARTIAL at FROZEN SHA per DEC-285; CLOSED at RECHECK SHA — merge is now total over every contact-referencing table) |
| CRM-07 | pipeline kanban, enroll+move stage | src/routes/api/pipeline.ts:69 `POST /pipeline`, :134 `PATCH /pipeline/:id` | test/pipeline-api.test.ts | COVERED |
| CRM-08 | pipeline detail + notes | src/routes/api/pipeline.ts:166 `POST /pipeline/:id/notes` | test/pipeline-api.test.ts | COVERED |
| CRM-09 | saved segments | src/routes/api/contacts.ts:471 `POST /segments` | app/src/pages/contacts/segments.test.ts | COVERED |
| CRM-10 | push contact to event roster | src/routes/api/contacts.ts:289 `POST /contacts/:id/add-to-event` | test/contacts-add-to-event.test.ts | COVERED |
| CRM-11 | bulk email w/ merge fields + preview | src/routes/api/contacts.ts:600 `POST /contacts/bulk-email`, preview :652 | test/contacts-bulk-email-preview-route.test.ts | COVERED |
| CRM-12 | org-wide stats | src/routes/api/contacts.ts:142 `GET /contacts/stats`; app/src/pages/contacts/StatsStrip.tsx | test/contacts-repo.test.ts | COVERED |

## Open items

Rows counted OPEN are those failing their own `pass_criteria` (NOT IMPLEMENTED, or PARTIAL
missing the stated minimum). PARTIAL rows that meet their own stated minimum bar
(EMB-03: "at minimum Track" met; EMB-15: "widget-type choices...and captures a generated
snippet" met) are recorded for depth but not counted OPEN, per the rubric's own two-tier
language and consistent with task-w4-e's treatment.

1. **SPK-03** — no single event-scoped or bulk speaker-roster CSV import exists; a producer
   reaches the pass-criteria end state only via two manual steps (org-level `/contacts/import`
   then a per-contact `/contacts/:id/add-to-event`, with no bulk add-to-event). Missing
   control: an event-scoped (or bulk) speaker-roster import action.

No other rows are OPEN. ABS-12 (DEC-271, now fully implemented server + app side) and
ABS-14 (DEC-272, formally WAIVED) are both resolved from their prior-wave OPEN status.
Both DEC-285 pre-registered in-flight defects (CRM-06 merge-table gap, SPK-05
assign-to-all-accepted filter) are CLOSED as of RECHECK SHA — not counted OPEN.

OPEN ITEMS: 1
RESULT: FAIL
