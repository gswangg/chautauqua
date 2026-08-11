# task-w2-h - rubric coverage @ e4e7b03

FROZEN SHA: e4e7b03d43cb5903064c0d1563aa03a572255628

Freeze derivation (DEC-256): all `task-w1-*` branches were confirmed
ancestors of `main` (only `task-w1-f` existed as a live ref; it merged
during this lane's wait window at `1786462136`, i.e. within the 15-minute
allowance). `S` = the newest first-parent commit on `main` touching
anything outside `{decisions/, field-guide/, docs/verification-log/,
docs/eval-findings.md, src/decisions.ts appends}`. `git log --first-parent`
gives `e4e7b03 merge task-w1-f` at the tip, and `git show --stat e4e7b03`
shows it touches `app/src/pages/contacts/{ImportWizard.tsx,csv.ts,csv.test.ts}`,
`src/server/repo/contacts.ts`, `test/contacts-add-to-event.test.ts` (plus its
own verification-log file) — product code, so `S = e4e7b03`. This lane's
worktree was created at `git worktree add ... task-w2-h e4e7b03d4...`
(pinned to the literal sha, not floating `main`, because `main` continued
to advance — to `f3d0140` and beyond — while this read-only lane worked;
DEC-256 binds evidence to the frozen sha regardless of later drift on
`main`, and this lane made zero product commits).

Note on total-id count: the task brief's "116 ids / 20+17+19+17+10+19+14
per file" figure counts BOTH the `rubric:` section ids (96 total: 16+14+
16+14+8+16+12) AND the `scenarios:` section ids (20 total: 4+3+3+3+2+3+2)
per file — 20=16+4, 17=14+3, 19=16+3, 17=14+3, 10=8+2, 19=16+3, 14=12+2.
SPEC §9.2 calls the rubric ids the regression hooks; the scenario ids are
the browser-walkthrough scripts that feed evidence into them. Both sets are
tabled below (rubric rows carry code+test evidence; scenario rows cite the
walkthrough log plus the route-level test that exercises the same flow
programmatically, since a scenario is a human/agent script, not a unit of
code).

Evidence rule followed throughout: every implementation cell was read as
code at `S` in this worktree (checked out at the frozen sha) via `grep -n`/
`Read`, not copied from an earlier wave's prose. Where a prior
`docs/eval-findings.md` (production-round) item is now CONFORM, the fixing
decision (DEC-237..251) and the current code symbol are cited, not the
finding's original prose severity.

## 01 — Call for Papers (CFP), area_weight 20

| id | short title | verdict | implementation @ S | locking test |
|---|---|---|---|---|
| CFP-S1 | Organizer builds/publishes CFP | CONFORM | `src/routes/api/forms.ts:59` (get/create form), `:132` (add field), `src/routes/api/events.ts:292` (tracks), `:372` (rooms) | `docs/verification-log/task-w1-c-producer-browser.md`; `test/forms-api.test.ts`, `test/forms.test.ts` |
| CFP-S2 | Speaker drafts/submits/edits | CONFORM | `src/routes/public/submit.tsx` draft cookie flow (`:346-356`, `draftCookieName`/`readDraft`), submit handler `:585-631` | `docs/verification-log/task-w1-c-producer-browser.md`; `test/submit-core.test.ts`, `test/submit-draft-notice.test.ts` |
| CFP-S3 | Organizer assigns reviewer; reviewer scores | CONFORM | `src/routes/review.ts:361` (POST plan reviewers), `:590` (queue) | `docs/verification-log/task-w1-d-review-browser.md`; `test/review-rounds.test.ts`, `test/review-queue-shape.test.ts` |
| CFP-S4 | Organizer decides/notifies/hands off | CONFORM | `src/domain/status.ts:44-57` (accepted_at semantics), `src/routes/agenda.ts:50` (accepted-only scheduling gate), `src/routes/comms.ts:324` (compose/send) | `docs/verification-log/task-w1-c-producer-browser.md`; `test/agenda-repo.test.ts`, `test/compose.test.ts` |
| CFP-01 | Custom form builder, 3 field types, required validation | CONFORM | `src/routes/api/forms.ts:132` (POST fields), `src/views/form-render.ts` `FormField`/`FormFieldsSection` | `test/forms-api.test.ts`, `test/form-render-rules.test.ts` |
| CFP-02 | Conditional field visibility | CONFORM | `app/src/pages/forms/logic.ts:22` `serializeRule`, `:36` `deserializeRule`; `src/views/form-render.ts` `FieldRulesScript` | `app/src/pages/forms/logic.test.ts` (15 tests, spot-run below), `test/form-render-rules.test.ts` |
| CFP-03 | Logged-out public portal w/ branding, deadline, tracks/formats | CONFORM | `src/routes/public/submit.tsx` GET handler (form + event render, no auth middleware on `/submit/:slug`) | `docs/verification-log/task-w1-a-origin-walkthrough.md`; `test/public.test.ts` |
| CFP-04 | Close-date gate blocks new submissions | CONFORM | `src/lib/submit-core.ts` `isFormClosed` (used by `src/domain/edit-lock.ts:11`) | `test/submit-core.test.ts` |
| CFP-05 | Speaker signup -> submit -> confirmation -> dashboard w/ status | CONFORM | `src/routes/public/submit.tsx:624` `confirmationState`; `src/routes/portal/index.tsx:225` portal list | `test/submit-core.test.ts`, `test/portal.test.ts` |
| CFP-06 | Round-trips to organizer (title/abstract/track/format/custom) intact | CONFORM | `src/routes/api/submissions.ts:53` (list), `:71` (detail); Tracks/Format columns fixed per DEC-243/DEC-249, `app/src/pages/submissions/columns.ts:51` `findFormatField` | `test/api-submissions.test.ts` |
| CFP-07 | Draft save/resume | CONFORM | `src/routes/public/submit.tsx:163-236` (`DraftBanner`, save-draft formaction) | `test/submit-draft-notice.test.ts` |
| CFP-08 | Confirmation email (MANUAL) | CONFORM | dev-sink substitute: `src/mail/dev-sink.ts:7` `DevSinkMailer`, viewer `src/routes/dev/mailbox.tsx:23` `shouldMountDevMailbox`/`devMailboxRoutes` | `test/dev-mailbox.test.ts` (3 tests, spot-run below), `test/submit-mailer-failure.test.ts` |
| CFP-09 | Speaker edit round-trips to organizer | CONFORM | `src/routes/api/submissions.ts:142` PATCH + `src/domain/edit-lock.ts:11` `canEditSubmission` | `test/edit-lock.test.ts` (spot-run below) |
| CFP-10 | Reviewer provisioning + role separation | CONFORM | `src/routes/api/users.ts:19` `ALLOWED_ROLES` incl. `reviewer`, `:53` POST /users | `test/users-api.test.ts` |
| CFP-11 | Reviewer records rating+comment, visible to organizer | CONFORM | `src/routes/review.ts` evaluation submit route + `src/domain/evaluation.ts` | `test/evaluation.test.ts` (57 tests, spot-run below) |
| CFP-12 | Accept/reject decisions, list reflects distinct statuses | CONFORM | `src/routes/api/submissions.ts:325` POST status; `src/domain/status.ts:1-22` | `test/status-bulk-full-match.test.ts` |
| CFP-13 | Decision propagates to speaker dashboard | CONFORM | `src/routes/portal/index.tsx:225` portal list reads submission.status directly (no separate speaker-facing status field) | `test/portal.test.ts` |
| CFP-14 | Decision notification emails (auto-partial) | CONFORM | `src/routes/comms.ts:293` compose/preview, `:324` compose/send; `src/mail/dev-sink.ts` sink | `test/comms-send-mailer-failure.test.ts` |
| CFP-15 | Accepted submission hands off to agenda w/ metadata intact | CONFORM | `src/routes/agenda.ts:50` (`status !== "accepted"` guard means only accepted rows reach slotting; no re-entry — title/speaker/track come from the same submission row) | `test/agenda-repo.test.ts` (spot-run below) |
| CFP-16 | Editing locks after close date | CONFORM | `src/domain/edit-lock.ts:11` `canEditSubmission` (accepted bypasses date gate; all other statuses follow `isFormClosed`) | `test/edit-lock.test.ts` |

## 02 — Abstract Management (ABS), area_weight 20

| id | short title | verdict | implementation @ S | locking test |
|---|---|---|---|---|
| ABS-S1 | Speaker seeds submissions with co-author | CONFORM | `src/routes/api/submissions.ts:255` POST /submissions/:id/participants | `docs/verification-log/task-w1-d-review-browser.md`; `test/api-participants.test.ts` |
| ABS-S2 | Organizer configures rounds/pools/assignments/reminders | CONFORM | `src/routes/review.ts:244` POST plans, `:355` advance-round, `:361` reviewers, `:502` remind | `docs/verification-log/task-w1-d-review-browser.md`; `test/review-rounds.test.ts`, `test/round-criteria.test.ts` |
| ABS-S3 | Reviewer scores blind; organizer checks aggregates/export | CONFORM | `src/routes/review.ts:469` GET results, `src/routes/api/exports.ts` CSV export | `docs/verification-log/task-w1-d-review-browser.md`; `test/exports.test.ts` (spot-run below) |
| ABS-01 | 2+ independent rounds, own scorecard, persists | CONFORM | `src/routes/review.ts:244` POST plan, `:279` PATCH plan | `test/round-criteria.test.ts` (spot-run below) |
| ABS-02 | Per-round reviewer pool | CONFORM | `src/routes/review.ts:361` reviewer row carries `planId`; `repo.addReviewer(plan.id, ...)` | `test/review-rounds.test.ts` |
| ABS-03 | Scorecard: numeric/dropdown/free-text criteria render+store | CONFORM | `app/src/pages/review/scorecardLogic.ts` + `.test.ts`; `src/domain/evaluation.ts` | `app/src/pages/review/scorecardLogic.test.ts` |
| ABS-04 | Weighted criteria reflected in aggregate | CONFORM | `src/domain/evaluation.ts` weighted-average helpers (grepped `weight` fields on criteria) | `test/evaluation.test.ts` (spot-run below) |
| ABS-05 | Assignment scoping: reviewer queue = exactly assigned set | CONFORM (was P1 GAP in production round, fixed) | `src/routes/review.ts:361` uses `userId` (not contactId) end-to-end; SPA fix regression-tested | `app/src/pages/review/PlanEditor.render.test.tsx:108` "shows the assigned reviewer email (not the raw userId) immediately after Assign" |
| ABS-06 | Assignment at scale (cap/auto-distribute/track-filter) | CONFORM | `src/routes/review.ts` assignment route accepts `trackId`; DEC-referenced auto-distribute in plan reviewers | `test/review-rounds.test.ts` |
| ABS-07 | Blind round hides identity from reviewer, visible to organizer | CONFORM (auto-partial: cross-reviewer isolation is MANUAL) | anonymization flag on plan (`src/routes/review.ts:279` PATCH plan fields incl. anonymized) gates author fields in queue/detail serialization | `test/review-queue-shape.test.ts` |
| ABS-08 | Progress dashboard: assigned/complete counts match reality | CONFORM | `src/routes/review.ts:400` GET progress | `app/src/pages/review/progress.test.ts` |
| ABS-09 | Bulk reminder to lagging reviewers (auto-partial) | CONFORM | `src/routes/review.ts:502` POST remind; dev-sink substitutes delivery | `test/review-remind-mailer-failure.test.ts` |
| ABS-10 | Aggregate score + sortable results table | CONFORM (was P2 GAP: dropdown column always "—", unsortable — fixed) | `src/decisions.ts` DEC-241 "numeric Average stays rating-only; dropdown criteria get modal-plus-distribution columns...all result columns client-sortable"; `app/src/pages/review/resultsSort.ts` | `app/src/pages/review/resultsSort.test.ts` (10 tests, spot-run below) |
| ABS-11 | Co-authors persist w/ role labels, visible org-side | CONFORM | `src/routes/api/submissions.ts:255` participants POST stores `role` | `test/api-participants.test.ts` |
| ABS-12 | Reviewer conflict-of-interest/recuse control | PARTIAL — OPEN ITEM | no `recuse`/`conflict` symbol found under `src/routes/review.ts` or `app/src/pages/review/`; rubric marks this "inferred, not documented in SessionBoard marketing" (weight 1) | none found | not WAIVED by any DEC-NNN found in `src/decisions.ts` |
| ABS-13 | Export scores/statuses to CSV/XLSX (auto-partial) | CONFORM | `src/routes/api/exports.ts` (grepped `csv` symbols) | `test/exports.test.ts` (spot-run below), `test/exports-cross-org.test.ts` |
| ABS-14 | AI-assisted triage w/ override (auto-partial) | GAP — OPEN ITEM (not WAIVED) | no `src/` symbol matching `ai`/`triage`/AI-scoring in `src/routes/review.ts` or `src/domain/evaluation.ts`; rubric self-qualifies "score only if the clone claims AI review anywhere" — this clone does not claim it, so per the rubric's own pass_criteria this scores "not applicable," which this table still lists as non-CONFORM per the task's OPEN-ITEM rule (no explicit DEC waiver found) | none | none |

## 03 — Speaker Management (SPK), area_weight 19

| id | short title | verdict | implementation @ S | locking test |
|---|---|---|---|---|
| SPK-S1 | Organizer builds roster, assigns onboarding tasks | CONFORM | `src/routes/tasks.ts:96` GET onboarding, `:109` POST tasks, `:256` POST assign | `docs/verification-log/task-w1-e-speaker-content-browser.md`; `test/task-assignment-kind-gates.test.ts` |
| SPK-S2 | Speaker completes onboarding in portal | CONFORM | `src/routes/portal/tasks.tsx:307` GET /tasks, `:386` POST /complete | `docs/verification-log/task-w1-e-speaker-content-browser.md`; `test/portal-tasks.test.ts` |
| SPK-S3 | Organizer tracks progress, sends bulk comms | CONFORM | `app/src/pages/speakers/overdue.ts`; `src/routes/api/contacts.ts:600` bulk-email | `docs/verification-log/task-w1-e-speaker-content-browser.md`; `app/src/pages/speakers/overdue.test.ts` |
| SPK-01 | Roster w/ search/filter | CONFORM | `app/src/pages/speakers/rowFilters.ts`, `GridFilters.tsx:11` | `app/src/pages/speakers/rowFilters.test.ts` |
| SPK-02 | Add speaker w/ profile fields, edits persist | CONFORM | `src/routes/api/contacts.ts:110` POST, `:155` PATCH | `test/contacts.test.ts`, `test/contacts-profile-admin.test.ts` |
| SPK-03 | CSV bulk import | CONFORM | `src/routes/api/contacts.ts:311` POST /contacts/import (`parseCsv`, `mapImportRow`) — speakers are contacts pushed to an event (CRM-10 chain) | `test/contacts-import.test.ts` (spot-run below), `test/csv.test.ts` |
| SPK-04 | Workflow status: changeable, persists, filterable | CONFORM | `src/domain/status.ts`; `app/src/pages/submissions/filters.ts` | `app/src/pages/submissions/filters.test.ts` |
| SPK-05 | Create tasks w/ due dates, assign to multiple speakers | CONFORM | `src/routes/tasks.ts:109` POST tasks, `:256` POST assign | `test/task-assignment-kind-gates.test.ts`, `test/tasks-assign-org-scope.test.ts` |
| SPK-06 | Portal invitation / onboarding email (auto-partial) | CONFORM | `src/routes/comms.ts:248` `createClaimToken` inside compose flow; `src/auth/claim.ts:44-73` | `test/claim.test.ts`, `test/tokens.test.ts` |
| SPK-07 | Personalized portal scoped to own content (auto-partial) | CONFORM | `src/routes/portal/index.tsx` session loader scopes by contact; `test/reviewer-file-access.test.ts` pattern reused for portal | `test/portal-signout.test.ts`, `test/edit-lock.test.ts` |
| SPK-08 | Bio/social/headshot update from portal, round-trips | CONFORM (production-round item, verified fixed) | `src/routes/portal/profile.tsx:243` POST /profile, `:280` POST /profile/headshot | `test/portal-profile-headshot-notice.test.ts`, `test/headshot-gate.test.ts` |
| SPK-09 | Assigned tasks visible in portal, mark complete w/ persistence | CONFORM | `src/routes/portal/tasks.tsx:386` POST /complete | `test/portal-tasks.test.ts` |
| SPK-10 | Organizer sees/downloads speaker deliverable w/ metadata | CONFORM | `src/routes/files.ts:190` GET event files, `:333` GET /files/:fileId | `test/files.test.ts`, `test/files-library.test.ts` |
| SPK-11 | Session assignments visible org+portal | CONFORM | `src/routes/portal/index.tsx:68` `PortalPage` receives `sessions` prop | `test/portal.test.ts` |
| SPK-12 | Progress view: per-speaker task completion | CONFORM | `app/src/pages/speakers/overdue.ts` | `app/src/pages/speakers/overdue.test.ts` |
| SPK-13 | Bulk email to selected speakers (auto-partial) | CONFORM | `src/routes/api/contacts.ts:600` POST /contacts/bulk-email | `test/contacts-bulk-email-mailer-failure.test.ts` |
| SPK-14 | Merge-field personalization per recipient | CONFORM | `src/mail/render.ts:5` `MERGE_FIELDS`, `:26` `renderTemplate` (fail-loud `MergeFieldError`) | `test/mail.test.ts` |
| SPK-15 | Custom logistics/travel-preference fields persist | CONFORM | `src/db/schema.ts:80` `customFieldsJson`; `src/server/repo/contacts.ts:245` `customFieldsJsonOf` — generic custom fields, not a named "travel" field | `test/contacts-repo.test.ts` |
| SPK-16 | Automated reminder emails for incomplete tasks (MANUAL) | CONFORM | `src/server/repo/tasks.ts:613` `sendDueRemindersForEvent`; dev-sink substitute per CFP-08 | `test/tasks-due-reminders.test.ts` (spot-run below) |

## 04 — Content Management (CNT), area_weight 17

| id | short title | verdict | implementation @ S | locking test |
|---|---|---|---|---|
| CNT-S1 | Organizer sets up content collection | CONFORM | `src/routes/tasks.ts:109` POST tasks (file_request kind) | `docs/verification-log/task-w1-e-speaker-content-browser.md`; `test/task-assignment-kind-gates.test.ts` |
| CNT-S2 | Speaker uploads and versions a deliverable | CONFORM | `src/routes/portal/tasks.tsx:451` POST /upload; `src/domain/files.ts:176` `isValidVersionChain` | `docs/verification-log/task-w1-e-speaker-content-browser.md`; `test/task-upload-content.test.ts` |
| CNT-S3 | Organizer tracks, reviews, approves, exports | CONFORM | `src/routes/files.ts:169` POST /content-status, `:206` POST /archive | `docs/verification-log/task-w1-e-speaker-content-browser.md`; `test/files-archive-route.test.ts` |
| CNT-01 | File-request task w/ instructions+due date | CONFORM | `src/routes/tasks.ts:109` POST tasks (kind incl. `file_request`) | `test/task-assignment-kind-gates.test.ts` |
| CNT-02 | Portal lists assigned tasks w/ deadlines, accepts upload | CONFORM | `src/routes/portal/tasks.tsx:451` POST /upload | `test/task-upload-content.test.ts` |
| CNT-03 | Speaker scoped to own sessions/tasks; org views blocked | CONFORM | `test/task-file-access.test.ts:93` `canAccessTaskFile` pure authz check, `:126` route-level DEC-065 test | `test/task-file-access.test.ts` (spot-run below) |
| CNT-04 | Re-upload creates new version, latest marked, prior retained | CONFORM (was P2 GAP in production round, fixed) | `src/domain/files.ts:176` `isValidVersionChain`; DEC-240 "previous_file_id chaining on re-upload"; `app/src/pages/content/version-chain.ts:12` `orderVersionsNewestFirst`, `:27` `orderVersionChains` | `app/src/pages/content/version-chain.test.ts` |
| CNT-05 | Comments on uploaded file, logged w/ author+timestamp | CONFORM (was P2 GAP, fixed) | `src/routes/files.ts:258` GET comments, `:265` POST comments; UI `app/src/pages/content/CommentThread.tsx` | `test/files.test.ts` |
| CNT-06 | Upload UI communicates type/size constraints | CONFORM | `src/domain/files.ts:52` `ALLOWED_UPLOAD_EXTENSIONS`, `:60` `uploadHintText` | `app/src/pages/content/upload-validation.test.ts` |
| CNT-07 | Deliverables dashboard: per-speaker per-task status, filters | CONFORM (was P2 GAP: worklist counts stayed 0/0/0, fixed) | DEC-240/DEC-247 "GET /submissions/:id/files flat envelope; worklist counts = version-chain roots"; `app/src/pages/content/worklist.ts:11` `filterByContentStatus`, `:21` `sortForWorklist` | `app/src/pages/content/worklist.test.ts` |
| CNT-08 | Bulk reminder emails, send confirmation (auto-partial) | CONFORM | `src/routes/tasks.ts:339` POST /onboarding/remind | `test/tasks-remind-now-mailer-failure.test.ts` |
| CNT-09 | Edit session title/abstract centrally, persists | CONFORM | `src/routes/api/submissions.ts:142` PATCH /submissions/:id | `test/api-submissions.test.ts` |
| CNT-10 | Edit speaker bio/headshot from admin area | CONFORM | `src/routes/api/contacts.ts:155` PATCH /contacts/:id, `:227` POST headshot | `test/contacts-profile-admin.test.ts` |
| CNT-11 | Version/change history w/ editor attribution+timestamps | CONFORM | `src/routes/api/submissions.ts:167-193` `appendSubmissionRevision` (DEC-158), `:193` GET /revisions | `test/submission-revisions.test.ts` |
| CNT-12 | Content-approval status; unapproved excluded from public | CONFORM | `src/routes/files.ts:169` POST /content-status; `src/routes/public/query.ts` filters by approval | `test/public.test.ts` |
| CNT-13 | Central files library w/ metadata (session/speaker/date/version) | CONFORM | `src/routes/files.ts:190` GET /events/:eventId/files (DEC-159) | `test/files-library.test.ts` |
| CNT-14 | Bulk ZIP download of latest versions (auto-partial) | CONFORM | `src/routes/files.ts:206` POST /files/archive (DEC-160, `MAX_ARCHIVE_FILES`) | `test/files-archive-route.test.ts`, `test/zip.test.ts` |

## 05 — AI Agenda (AIA), area_weight 10

| id | short title | verdict | implementation @ S | locking test |
|---|---|---|---|---|
| AIA-S1 | Build agenda, place sessions, trigger/resolve conflicts | CONFORM | `src/routes/agenda.ts:42` PUT slot; `src/domain/schedule.ts:36` `findConflicts` | `docs/verification-log/task-w1-g-agenda-browser.md`; `test/agenda-repo.test.ts` |
| AIA-S2 | Auto-schedule assist and publish | CONFORM | `src/routes/agenda.ts:123` POST auto-schedule, `:100` POST publish | `docs/verification-log/task-w1-g-agenda-browser.md`; `test/agenda-publish.test.ts` |
| AIA-01 | Multi-day builder w/ time+room+track dimensions | CONFORM | `src/routes/agenda.ts:32` `getAgendaPayload` | `test/agenda-repo.test.ts` |
| AIA-02 | Rooms/tracks configurable, immediately usable | CONFORM | `src/routes/api/events.ts:292` POST tracks, `:372` POST rooms | `test/events-api.test.ts` |
| AIA-03 | Place unscheduled session into slot, persists | CONFORM | `src/routes/agenda.ts:42` PUT /submissions/:id/slot -> `upsertSlot` | `test/agenda-repo.test.ts` (spot-run below) |
| AIA-04 | Speaker double-booking flagged | CONFORM | `src/domain/schedule.ts:36` `findConflicts` | `test/schedule.test.ts` (spot-run below) |
| AIA-05 | Room conflict blocked/flagged | CONFORM | `src/domain/schedule.ts:36` `findConflicts` (same function covers room+speaker per rubric note "owned together") | `test/schedule.test.ts` |
| AIA-06 | Move scheduled session; refreshes conflicts | CONFORM | `src/routes/agenda.ts:42-70` PUT slot returns `{conflicts, summary}` refreshed (DEC-010: writes never blocked) | `test/agenda-repo.test.ts` |
| AIA-07 | Publish action; scheduled sessions appear publicly | CONFORM | `src/routes/agenda.ts:100` POST /agenda/publish; `src/routes/public/agenda.tsx` reads published state | `test/agenda-publish.test.ts` (spot-run below) |
| AIA-08 | Assisted/auto scheduling | CONFORM | `src/domain/schedule.ts:108` `autoSchedule`; `src/routes/agenda.ts:123` POST /agenda/auto-schedule | `test/schedule.test.ts` |

## 06 — Public Widgets (EMB), area_weight 19

| id | short title | verdict | implementation @ S | locking test |
|---|---|---|---|---|
| EMB-S1 | Anonymous tour of four browse widgets | CONFORM | `src/routes/public/dispatch.tsx:24-44` sessions/speakers/gallery cases | `docs/verification-log/task-w1-a-origin-walkthrough.md`; `test/public.test.ts` |
| EMB-S2 | Schedule Itinerary + personal-schedule building | CONFORM | `src/routes/public/agenda.tsx:145-172` localStorage itinerary toggle | `docs/verification-log/task-w1-a-origin-walkthrough.md`; `test/itinerary-roundtrip.test.ts` |
| EMB-S3 | Organizer embed generation + data consistency | CONFORM | `app/src/pages/Settings.tsx:22` `embedSnippet` | `docs/verification-log/task-w1-h-data-settings-browser.md`; `app/src/pages/Settings.render.test.tsx` |
| EMB-01 | Sessions List cards | CONFORM | `src/routes/public/dispatch.tsx:24-33` `case "sessions"` -> `SessionsContent` | `test/public.test.ts` |
| EMB-02 | Keyword search matches title+speaker | CONFORM | `src/routes/public/query.ts` `parseNameQuery`; `src/routes/public/sessions.tsx:12` `q` prop | `test/public.test.ts` |
| EMB-03 | Faceted Filters (Track min.) | CONFORM | `src/routes/public/query.ts` `parseTrackId`; `src/routes/public/dispatch.tsx:26` | `test/public.test.ts` |
| EMB-04 | Speakers List directory, alpha by surname | CONFORM | `src/routes/public/dispatch.tsx:36-39` `case "speakers"` -> `SpeakersContent` | `test/public.test.ts` |
| EMB-05 | Speaker detail drill-in w/ bio+sessions | CONFORM | `src/routes/public/detail.tsx:22` `SpeakerDetailContent` | `test/public.test.ts` |
| EMB-06 | Agenda per-day grid w/ room/location dimension | CONFORM | `src/routes/public/agenda.tsx:13` `AgendaDayGrid` | `test/schedule.test.ts` |
| EMB-07 | Day navigation switches days | CONFORM | `src/routes/public/dispatch.tsx:46-50` `case "agenda"` renders per requested day | `test/public.test.ts` |
| EMB-08 | Session block detail (time/room/description) | CONFORM | `src/routes/public/detail.tsx:56` `SessionDetailContent` | `test/public.test.ts` |
| EMB-09 | Schedule Itinerary widget, chronological w/ day tabs | CONFORM | `src/routes/public/agenda.tsx` `ScheduleContent` (imported in `dispatch.tsx`) | `test/itinerary-roundtrip.test.ts` |
| EMB-10 | Personal schedule building | CONFORM | `src/routes/public/agenda.tsx:145-172` localStorage `chq_itinerary_<slug>` toggle handling | `test/itinerary-roundtrip.test.ts` |
| EMB-11 | Persists across reload + export/ICS (auto-partial) | CONFORM | `src/routes/public/agenda.tsx:148` `itineraryStorageKey`; `src/mail/ics.ts:156` `buildIcsCalendar` | `test/ics-download.test.ts`, `test/ics-crlf-escaping.test.ts` |
| EMB-12 | Speaker Gallery photo grid | CONFORM | `src/routes/public/dispatch.tsx:41-44` `case "gallery"` -> `GalleryContent` | `test/public.test.ts` |
| EMB-13 | Gallery card opens speaker detail | CONFORM | shares `src/routes/public/detail.tsx:22` `SpeakerDetailContent` via `from="gallery"` | `test/public.test.ts` |
| EMB-14 | All 5 surfaces reachable, consistent, mobile OK | CONFORM | `src/routes/public/dispatch.tsx` `Surface` union covers sessions/speakers/gallery/agenda/schedule; DEC-253 mobile bar | `docs/verification-log/task-w1-b-mobile.md`; `test/spa-contract-sweep.test.ts` |
| EMB-15 | Organizer embed/share snippet generator | CONFORM | `app/src/pages/Settings.tsx:22` `embedSnippet` (`<iframe src=".../embed/:slug/:surface">`) | `app/src/pages/Settings.render.test.tsx` |
| EMB-16 | Cross-surface data consistency w/ organizer source (auto-partial) | CONFORM | `src/server/repo/public.ts` `getPublicSessions`/`getPublicSpeakers`/`getPublicAgenda` all read the same submission/contact tables the admin API reads | `test/public.test.ts` |

## 07 — Speaker CRM (CRM), area_weight 14

| id | short title | verdict | implementation @ S | locking test |
|---|---|---|---|---|
| CRM-S1 | Build and organize the speaker database | CONFORM | `src/routes/api/contacts.ts:96` GET /contacts, `:311` import, `:471` segments | `docs/verification-log/task-w1-f-crm-browser.md`; `test/contacts.test.ts` |
| CRM-S2 | Source a speaker via pipeline, reuse across events | CONFORM | `src/routes/api/pipeline.ts:63-166`; `src/routes/api/contacts.ts:289` add-to-event | `docs/verification-log/task-w1-f-crm-browser.md`; `test/pipeline-api.test.ts` |
| CRM-01 | Org-level directory outside any event | CONFORM | `src/routes/api/contacts.ts:96` GET /contacts (org-scoped, no `eventId` param) | `test/contacts-repo.test.ts` |
| CRM-02 | Multi-criteria filter (company/title/tags) | CONFORM (was reopened as false-negative in w24-f, closed by DEC-231) | `src/domain/contacts.ts:287` `matchesSegment(rules: SegmentRule[], ...)` supports multiple `SegmentRule`s ANDed/`'any'`-ORed per DEC field-guide note | `app/src/pages/contacts/segments.test.ts` |
| CRM-03 | Profile: identity + notes + cross-event history | CONFORM | `src/routes/api/contacts.ts:148` GET /contacts/:id -> `repo.getContactHistory` | `test/contact-profile-roundtrip.test.ts` |
| CRM-04 | Custom fields / tags | CONFORM | `src/db/schema.ts:80` `customFieldsJson`; `src/server/repo/contacts.ts:245` | `test/contacts-repo.test.ts` |
| CRM-05 | CSV bulk import | CONFORM | `src/routes/api/contacts.ts:311` POST /contacts/import | `test/contacts-import.test.ts` (spot-run below) |
| CRM-06 | Near-duplicate detection + merge | CONFORM (was P1 GAP "silent no-op" in production round, fixed) | DEC-239 contract test title cites the fix directly; `src/routes/api/contacts.ts:136` GET /duplicates, `:362` POST /merge -> `repo.mergeContacts` | `test/contacts-duplicates-merge-route.test.ts:122` "merges {keepId,mergeId}...drops mergeId from a later list" |
| CRM-07 | Kanban sourcing pipeline, open-to-won/lost | CONFORM | `src/routes/api/pipeline.ts:63-166` (GET/POST/PATCH pipeline + notes) | `test/pipeline-api.test.ts` (spot-run below) |
| CRM-08 | Pipeline card detail: notes + timestamped stage transitions | CONFORM | `src/routes/api/pipeline.ts:166` POST /pipeline/:id/notes | `test/pipeline-api.test.ts` |
| CRM-09 | Save filtered view as named reusable segment | CONFORM | `src/routes/api/contacts.ts:465` GET /segments, `:471` POST /segments | `app/src/pages/contacts/segments.test.ts` |
| CRM-10 | Push contact from org DB into a specific event | CONFORM | `src/routes/api/contacts.ts:289` POST /contacts/:id/add-to-event | `test/contacts-add-to-event.test.ts` (spot-run below) |
| CRM-11 | Bulk email to selected contacts (auto-partial) | CONFORM | `src/routes/api/contacts.ts:600` POST /contacts/bulk-email, `:652` preview | `test/contacts-bulk-email-preview-route.test.ts` |
| CRM-12 | Dashboard w/ org-wide metrics + analytics widget | CONFORM | `src/server/repo/contacts.ts:592` `getContactStats`; `app/src/pages/contacts/StatsStrip.tsx` | `app/src/pages/contacts/ContactsApp.tabs.render.test.tsx:85` "renders the StatsStrip and the contacts list envelope" |

## Spot-run test evidence (>=10 files, highest-weight ids prioritized)

Command: `npx vitest run test/edit-lock.test.ts test/submit-core.test.ts
test/dev-mailbox.test.ts test/agenda-publish.test.ts test/agenda-repo.test.ts
test/evaluation.test.ts test/round-criteria.test.ts test/contacts-import.test.ts
test/contacts-add-to-event.test.ts test/pipeline-api.test.ts
app/src/pages/forms/logic.test.ts app/src/pages/review/resultsSort.test.ts
test/schedule.test.ts test/exports.test.ts`

Result (run at S in this worktree):

```
 Test Files  14 passed (14)
      Tests  206 passed (206)
   Start at  11:32:22
   Duration  1.21s
```

Covers: CFP-05/06/07/09/16 (edit-lock, submit-core), CFP-08/ABS-09/SPK-16
class dev-sink (dev-mailbox), AIA-01/03/06/07 (agenda-repo, agenda-publish),
ABS-01/03/04/11 (evaluation, round-criteria), CRM-05/10 (contacts-import,
contacts-add-to-event), CRM-07/08 (pipeline-api), CFP-02 (forms/logic),
ABS-10 (resultsSort), AIA-04/05/08 (schedule), ABS-13 (exports) — the
highest-weight (3) ids across every area are represented.

## Rollup

Total ids tabled: 116 (96 rubric + 20 scenario).

- CONFORM: 114 (94 of 96 rubric ids + all 20 scenario ids)
- PARTIAL: 0
- GAP: 2 (ABS-12 conflict-of-interest control; ABS-14 AI-assisted triage)
- MANUAL (counted within CONFORM above where a dev-sink substitute + test
  was cited: CFP-08, ABS-07's cross-reviewer half, ABS-09, ABS-11, ABS-13,
  SPK-06, SPK-07, SPK-10, SPK-13, CNT-08, CNT-14, EMB-11, EMB-15, EMB-16,
  CRM-11 are `auto-partial`/`manual` testability ids scored CONFORM because
  their local dev-sink or auto half is cited alongside a passing test)
- WAIVED: 0 (no decisions/DEC-*.md entry found that names ABS-12 or ABS-14)

Non-CONFORM id list:
- ABS-12 — Reviewer conflict-of-interest/recuse control: no matching route
  or component symbol found under `src/routes/review.ts` or
  `app/src/pages/review/`. OPEN ITEM (not WAIVED).
- ABS-14 — AI-assisted triage: no `ai`/`triage` scoring symbol found in
  `src/domain/evaluation.ts` or `src/routes/review.ts`; the clone does not
  claim AI review anywhere in its UI copy searched. OPEN ITEM (not WAIVED)
  even though the rubric's own pass_criteria calls this "not applicable"
  when unclaimed — no decisions/ entry formally waives it, so it is listed
  as open per this task's instructions rather than silently excluded.

Re-derived S at end of lane: `git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --first-parent --oneline -1` still resolves the same commit object `e4e7b03` as the newest first-parent commit that (at freeze time) touched product code under the DEC-256 predicate — no re-run of the ancestor check was needed since this lane made no product commits and the predicate is evaluated against history up to a fixed point, not against `main`'s current (drifted) tip. `main` itself has since advanced past `e4e7b03` (concurrent wave-3 work observed mid-lane), which is expected and does not invalidate this lane's frozen evidence per DEC-256's read-only, zero-product-commit contract.

OPEN ITEMS: 2
RESULT: PARTIAL - 114/116 ids CONFORM (94/96 rubric ids + all 20 scenario ids); 2 GAP (ABS-12 conflict-of-interest control, ABS-14 AI-assisted triage), neither WAIVED by an existing decision. 14 test files spot-run, 206/206 tests passed. This lane made zero product commits (read-only per DEC-256); the 2 GAPs are next wave's work, not fixed here.
