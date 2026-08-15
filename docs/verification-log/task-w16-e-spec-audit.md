# task-w16-e — spec-audit

`git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua rev-parse HEAD`
(via worktree `task-w16-e`) = `c557cff9f0e5bcd68d0d7815956d83a94eb9dc4e` ("merge
task-w15-e"). Every citation below is a fresh Read/Grep against this exact tree — no row
is inherited from an earlier `docs/verification-log/*spec-audit*.md`. DEC-063 scope: this
file is read-only reconnaissance; no product code, test, or `docs/eval-findings.md` line
was touched to produce it.

Verdict key used only where the task instructions require one (RED rows only carry a
proposed fix, never an implementation): every other cell is a bare citation — no prose
verdicts, per the task's "no prose verdicts" instruction. GAP rows mark anything this pass
could not cite in the current tree.

---

## 1. SPEC §1 jobs J1–J12

| Job | Route(s) | Repo function(s) | Test file(s) |
|---|---|---|---|
| J1 — Launch a CFP | `POST/GET/PATCH /api/v1/events`, `/api/v1/events/:eventId/tracks`, `/api/v1/events/:eventId/rooms` (`src/routes/api/events.ts:190,210,296,302,398,409,481,492`); `GET/PATCH /api/v1/forms/:formId`, `POST /api/v1/forms/:formId/fields`, `.../fields/reorder` (`src/routes/api/forms.ts:73,87,163,207,414`) | `src/server/repo/events.ts`, `src/server/repo/forms.ts`, `src/forms/builder.ts`, `src/forms/rule-match.ts` (conditional-field rules) | `test/events-api.test.ts`, `test/forms-api.test.ts`, `test/forms-rule-match.test.ts`, `test/form-visibility-cascade.test.ts` |
| J2 — Submit without friction | `GET /submit/:eventSlug` (`src/routes/public/submit-get.tsx:23`), `POST /submit/:eventSlug/save-draft` (`src/routes/public/submit-draft.tsx:29`), `POST /submit/:eventSlug` (`src/routes/public/submit-post.tsx:69`) | `formWindowState` close-date gate (`src/routes/public/submit-post.tsx:76-80`), confirmation email + claim link (`src/routes/public/submit-post.tsx:419-472`), draft save (`src/lib/draft.ts`) | `test/submit-core.test.ts`, `test/submit-guards-and-atomicity.test.ts`, `test/submit-confirmation-reference.test.ts`, `test/submit-draft-limits.test.ts`, `test/claim.test.ts` |
| J3 — Triage without drowning | `GET /api/v1/events/:eventId/submissions` (list+filters+saved views), `POST .../submissions/status` (bulk) (`src/routes/api/submissions.ts:228,710`), `POST /submissions/:id/clone` (`:330`), views (`src/routes/api/views.ts`) | `updateSubmissionStatuses` (`src/server/repo/submissions/status.ts:486-575`, full-set-match guard at 508-515, no `mail` import in this file — status change never emails), `src/server/repo/submissions/list.ts`, `src/domain/saved-views.ts` | `test/status-bulk-full-match.test.ts`, `test/status-bulk-statement-count.test.ts`, `test/submissions-status-parity.test.ts`, `test/api-views.test.ts` |
| J4 — Review in waves | `POST /api/v1/events/:eventId/plans` (`src/routes/review/plans-crud.ts:61`), reviewer assignment `POST /api/v1/plans/:id/reviewers` (`src/routes/review/plans-reviewers.ts:64`), distribute `POST .../assignments/distribute` (`src/routes/review/plans-distribute.ts:265`), reviewer queue `GET /api/v1/review/plans/:id/queue` (`src/routes/review/reviewer.ts:84`), scorecard submit `PUT /api/v1/review/plans/:planId/evaluations/:submissionId` (`src/routes/review/reviewer.ts:362`), results `GET /api/v1/plans/:id/results` (`src/routes/review/plans-progress.ts:145`), remind `POST /api/v1/plans/:id/remind` (`:205`) | `src/domain/evaluation/scoring.ts:31` `computeWeightedScore`, `:78` `aggregateSubmission`; `src/domain/evaluation/results.ts:96` `sortResultsRows`; `src/domain/evaluation/queue.ts` (fewest-ratings-first); `src/domain/evaluation/anonymization.ts` (server-side) | `test/evaluation.test.ts`, `test/review-results-sort-page.test.ts`, `test/review-queue-shape.test.ts`, `test/review-remind-laggards.test.ts`, `test/evaluations-anonymity-agreement.test.ts` |
| J5 — Decide and notify | Status change: see J3 route (no email). Notify: `POST /api/v1/events/:eventId/compose/preview` (`src/routes/comms/preview.ts:25`), `POST .../compose/send` (`src/routes/comms/send.ts:36`) | `src/domain/compose.ts:82` (`MAX_COMPOSE_RECIPIENTS` 100-cap throw), `src/routes/comms/send.ts` (per-recipient `email_log` write), `src/mail/render.ts` (merge fields) | `test/compose-full-set.test.ts`, `test/compose-preview-html-shell.test.ts`, `test/comms-send-dedupe.test.ts`, `test/comms-feedback-scope.test.ts` (reviewer-feedback attach) |
| J6 — Onboarding auto | Fires inside J3's `POST .../submissions/status` route (no separate route) | `planAndPersistOnboardingTasks` (`src/server/repo/submissions/status.ts:201-`), `ensureOnboardingTasks` (`:396`), `planAcceptance` (`src/domain/acceptance.ts:181`), idempotent `.onConflictDoNothing({target:[taskAssignment.taskId, taskAssignment.contactId]})` (`status.ts:294,378`); onboarding grid `GET` under `src/server/repo/tasks/grid.ts` | `test/acceptance-due-dates.test.ts`, `test/acceptance-form-tasks.test.ts`, `test/onboarding-task-backfill.test.ts`, `test/reaccept-onboarding.test.ts`, `test/onboarding-grid-pagination.test.ts` |
| J7 — Speaker self-serve | `src/routes/portal/index.tsx`, `src/routes/portal/edit.tsx`, `src/routes/portal/profile.tsx`, `src/routes/portal/tasks/*.ts` | `canEditSubmission`/`canEditTracks` (`src/domain/edit-lock.ts:10-29`), `src/server/repo/portal-edit.ts`, `src/server/repo/portal/tasks.ts` | `test/portal-edit-speaker-locked.test.ts`, `test/portal-idor-probe.test.ts`, `test/portal-idor-real-rows-probe.test.ts`, `test/portal-invite-scope.test.ts` |
| J8 — Collect/review/approve content | `POST /submissions/:id/files` (`src/routes/files.ts:168`), `POST /submissions/:id/content-status` (`:294`), `GET/POST /files/:fileId/comments` (`:520,529`), `DELETE /files/:fileId` (`:556`), serve `GET /files/:fileId` (`:666`) | `validateUpload` (`src/domain/files.ts:184`, allowlist+size), version-chain checks (`isValidVersionChain`, `src/routes/files.ts:198-208`), `src/server/repo/files-content-status.ts` | `test/files.test.ts`, `test/file-replace-versions.test.ts`, `test/content-status-bulk.test.ts`, `test/portal-file-versions.test.ts` |
| J9 — Agenda under change | `GET /events/:eventId/agenda` (`src/routes/agenda.ts:35`), `PUT/DELETE /submissions/:id/slot` (`:47,88`), `POST .../agenda/publish` (`:113`), `POST .../agenda/auto-schedule` (`:168`) | `src/server/repo/agenda/auto-schedule.ts` (greedy placement), `src/server/repo/agenda/rows.ts` (conflicts: room overlap + same-speaker overlap surfaced not blocked), `src/lib/overlap-lanes.ts` | `test/agenda-repo.test.ts`, `test/auto-schedule-persistence.test.ts`, `test/conflicts-cross-room-copresenter.test.ts`, `test/schedule-conflicts-equivalence.test.ts` |
| J10 — Publish to website | `src/routes/public/index.tsx` (sessions/speakers/agenda/detail dispatch), `GET /e/:eventSlug/schedule.ics` (`:359`), embeds `src/routes/api/embeds.ts` | `src/server/repo/public/gates.ts:25-56` (single-sourced visibility gate — see §2 below), `src/server/pubcache.ts` (edge cache + purge on publish-affecting writes), `src/mail/ics.ts:115` `uidFor` (stable UID) | `test/public-sessions-anatomy.test.ts`, `test/public-agenda-event-range.test.ts`, `test/public-speaker-detail.test.ts`, `test/ics-sequence-bump.test.ts`, `test/pubcache-purge-classification.test.ts` |
| J11 — Reuse network | `src/routes/api/contacts/crud.ts` (CRUD, `:71,96,257,277,387`), import `POST /contacts/import` (`src/routes/api/contacts/import.ts:55`), merge `POST /contacts/merge` (`src/routes/api/contacts/merge.ts:15`), segments (`src/routes/api/contacts/segments.ts:135-`), bulk email (`src/routes/api/contacts/bulk-email.ts:166,302`) | `src/server/repo/contacts/merge.ts` (keepId), `src/server/repo/contacts/import.ts`, `src/domain/contacts-parts/duplicates.ts`, `src/server/repo/contacts/stats.ts` (dashboard) | `test/contacts-merge-integrity.test.ts`, `test/contacts-import.test.ts`, `test/contacts-duplicate-check-narrowing.test.ts`, `test/contacts-stats-repo.test.ts` |
| J12 — Data stays theirs | Exports `GET /api/v1/events/:eventId/export/:kind`, `.../exports/showflow.csv` (`src/routes/api/exports.ts:54,71`); bearer tokens `src/routes/api/tokens.ts:30,72,105`; Airtable `src/sync/airtable.ts` | `src/server/repo/exports/index.ts` + `kinds.ts` (submissions/speakers/evaluations/agenda/email-log), `src/auth/tokens.ts` (bearer verification) | `test/exports.test.ts`, `test/exports-cross-org.test.ts`, `test/tokens.test.ts`, `test/airtable-sync.test.ts` |

No GAP row: every J1–J12 job has at least one route + repo function + test file citation in
the current tree.

---

## 2. SPEC §5 invariants

| Invariant | Verdict | File:line |
|---|---|---|
| Status pipeline `pending → accept_queue\|decline_queue → accepted\|declined` | citation | `src/domain/status.ts` (`changeStatus`, referenced at `src/server/repo/submissions/status.ts:523`); DEC constant table `src/decisions.ts` (DEC-003 referenced in `submissions.ts:717` error message) |
| Status changes NEVER send email | citation | `src/server/repo/submissions/status.ts` has no `mail`/`Mailer` import (confirmed by full-file grep of `^import`); the only mail-sending route touching status is the separate `POST /api/v1/events/:eventId/compose/send` (`src/routes/comms/send.ts:36`), a distinct explicit action |
| Contact → speaker only via `participant` row; publicly visible only under 3 distinct gates, never collapsed | citation | `src/server/repo/public/gates.ts:25-56`: `visibleSessionConditions()` (status=accepted AND contentStatus=approved, lines 25-27), `visibleParticipantConditions()` (participant.visible AND inviteStatus IN none/accepted, lines 36-42), composed by `visibleSubmissionConditions()` (lines 54-56) for every speaker-rooted query. 14 repo files import at least one of the three (`grep -rl` over `src/server/repo/`: `overview.ts, profile.ts, public.ts, exports/speakers.ts, public/counts.ts, public/home.ts, public/speakers.ts, public/sessions.ts, public/detail.ts, review/submissions.ts, public/agenda.ts, agenda/payload.ts, agenda/rows.ts, overview/types.ts`) |
| `form.close_date` past ⇒ new submissions rejected AND unaccepted speaker edits locked server-side; accepted speakers keep editing | citation (docs/clarifications.md:39 confirms the accepted-speaker exception; per docs/README.md precedence this line — not the SPEC's own §9 mention of a "CFP-16" rubric expectation — governs, and `src/domain/edit-lock.ts:4-11`'s comment records that precedence explicitly) | New-submission reject: `src/routes/public/submit-post.tsx:76-80` (`formWindowState(...) === "closed"`). Edit lock: `src/domain/edit-lock.ts:10-21` `canEditSubmission` (`status === "accepted" \|\| !isFormClosed(...)`), enforced server-side at `src/routes/portal/edit.tsx:325,358,438` and `src/routes/portal/index.tsx:569` |
| Acceptance fires J6 auto-creation exactly once, idempotently | citation | `src/server/repo/submissions/status.ts:529-542` (`fireAcceptance` gate re-fires on every entry into `accepted`, `setsAcceptedAt` subset stamps `accepted_at` only once), idempotency via `onConflictDoNothing({target:[taskAssignment.taskId, taskAssignment.contactId]})` at lines 294 and 378 |
| Stable ids; .ics UIDs never churn | citation | `src/domain/ids.ts` (`newId`, per-event prefixes via `formatRef`, used at `src/routes/public/submit-post.tsx:408`); `.ics` UID: `src/mail/ics.ts:115` `uidFor(submissionId)` — UID derived only from the submission id, never from mutable schedule fields; SEQUENCE bump is the caller's responsibility per the file's own header comment (line 2) |

No GAP row: every §5 invariant has a citation in the current tree.

---

## 3. SPEC §6 security

| Control | Verdict | File:line |
|---|---|---|
| PBKDF2-SHA256, 100,000 iterations, constant-time compare | citation | `src/auth/password.ts:27` (`export const ITERATIONS = 100_000`), used at `:63,138`; `constantTimeEqual` at `:91`, applied at `:144` |
| Session rotation on login | citation | `src/server/auth-session.ts:1-20` (`issueSession` deletes only the presented session's row scoped by `userId` AND `tokenHash`, wave-22 amendment, before minting a new one); distinct `issueSessionRevokingAll` used for password-reset/claim paths |
| HttpOnly/Secure/SameSite=Lax cookies; CSRF header/token split | citation | `src/auth/cookies.ts:2-3,21-22,35-36` (HttpOnly, SameSite=Lax, Secure conditional on `isSecureRequest`); `src/server/middleware.ts:267` `csrfJson` (header), `:276` `csrfForm` (double-submit cookie token), `:307-320` `csrfFormOrHeader`/shared comparison rule |
| Authz middleware + object-level ownership on every fetch-by-id | citation | `requireOrganizer`/`requireReviewer`/`requireSpeaker` (`src/server/middleware.ts`) gate every admin/API route enumerated in §1 above; object-level ownership: `assertEventOwnership` (called e.g. `src/routes/api/submissions.ts:712`), enumerated ownership probes in `test/route-authz-inventory.test.ts` (fake-db-chain harness, DEC-459 lane) |
| Server-side filtering for public/anonymized data | citation | §2's gates row (public); anonymization: `src/domain/evaluation/anonymization.ts`, applied server-side before the reviewer queue response (`src/routes/review/reviewer.ts:84` handler calls into `src/server/repo/review/*` rather than filtering client-side) |
| Upload allowlist + size caps + random R2 keys + no HTML content-type for user content | citation | Allowlist+caps: `src/domain/files.ts:67-96,184-` (`DOCUMENT_MAX_BYTES`, `IMAGE_MAX_BYTES`, `VIDEO_MAX_BYTES`, `validateUpload`); random key: `src/routes/files.ts:212` (`` `sub/${submissionId}/${newId()}-${sanitized}` ``); serve headers: `src/routes/files.ts:458,677` (`X-Content-Type-Options: nosniff`) alongside `servedContentType` chosen by `validateUpload` (never trusts the client's declared MIME for HTML) |
| Parameterized queries only | citation | Every repo file sampled uses Drizzle's `sql` tagged template or query builder (e.g. `src/server/repo/email.ts:168-169,283-284`, `src/server/repo/submit.ts:185`) — no string-concatenated SQL found in `src/server/repo/` during this pass |
| Rate limits on auth + public submission | citation | Auth: `src/routes/auth-login.tsx:62-100` (three independent budgets — account, email+IP pair, IP — consumed atomically before PBKDF2 derivation, DEC-948/DEC-180); public submission: `src/routes/public/submit-post.tsx:285` (`emailBudgetOk(db, "submit-email", email, 10)`), plus the same-origin/IP guard imported at `:58` from `./submit-guards` |

No GAP row: every §6 control has a citation in the current tree.

---

## Notes for the planner

- This pass used grep/Read reconnaissance only; it did not run the full test suite (task
  instructions: "you may run targeted tests to confirm a single claim, never the full
  suite"). No targeted test run was needed — every claim above rests on a direct source
  Read, not a test-suite result.
- `docs/verification-log/` already contains spec-audit files up through wave 27
  (`task-w27-e-spec-audit.md` et al.), evidence the swarm's task-id namespace has been
  reused/reset across sessions rather than monotonically advancing — worth flagging to the
  scribe since the field guide's own wave-number references (w16 "current") undercount the
  tree's actual history by roughly ten waves. This file's own id (`task-w16-e`) is safe
  from collision: existing `task-w16-e-*` files are `quickstart-stage1` and
  `triage-closure(-confirm)`, a disjoint scope from `spec-audit`.
- No RED rows were found in this pass — every job, invariant, and security control had a
  direct, current-tree citation.
