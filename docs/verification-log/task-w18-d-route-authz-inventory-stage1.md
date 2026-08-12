# task-w18-d: route authorization inventory (DEC-459 enumeration lane)

sha (HEAD at time of this audit): `d034a9e0610b35b908503084525f1f04d93cb8df`

All file:line citations below are re-read at this sha. This is an
ENUMERATION, not a sample: every `<subApp>Routes.(get|post|put|patch|delete)(`
registration under `src/routes/` was found by

```
grep -rn -E '[a-zA-Z0-9_]+Routes\.(get|post|put|patch|delete|all)\(' src/routes --include='*.ts' --include='*.tsx'
```

(re-run at this sha: **157** matches across 35 route files, including the
two multi-line registrations in `src/routes/api/submissions.ts` that a
same-line grep would miss — `submissionsRoutes.post(` at line 211 and
`submissionsRoutes.patch(` at line 314). `src/routes/api/contacts/*.ts`
routes are registered indirectly through `register*Routes(contactsRoutes)`
helpers called from `src/routes/api/contacts/index.ts`; those registrations
are included in the 157 and in the table below under their defining file.
Files with zero registrations (pure helpers, not sub-apps) are: `auth.css.ts`,
`api/contacts/shared.ts`, `api/validators.ts`, `portal/portal.css.ts`,
`portal/shared.tsx`, `public/agenda.tsx`, `public/cards.tsx`, `public/cfp.css.ts`,
`public/detail.tsx`, `public/dispatch.tsx`, `public/feeds.ts`, `public/public.css.ts`,
`public/query.ts`, `public/sessions.tsx`, `public/shell.tsx`, `public/speakers.tsx`,
`review/index.ts`, `review/shared.ts`, `tools.css.ts` — every public/index.tsx
route registration composes these, so their logic is covered under
`public/index.tsx`'s rows.

Mounting: `src/index.ts` is the only place `app.route()` is called (DEC-012).
`sessionLoader` (`src/server/middleware.ts:199`) runs on `app.use("*", ...)`
in `src/server/app.ts` ahead of every sub-app mount, so `c.var.auth` is
populated (or left undefined) before any route handler runs, regardless of
mount prefix.

## Table

Legend: G = GUARDED (role check + object-level ownership check present),
PBD = PUBLIC-BY-DESIGN (deliberately no auth, cited to its decision/comment),
GAP = missing guard found by this audit.

### src/routes/account.tsx — mounted `app.route("/", accountRoutes)`

| Method/Path | Reg. line | Middleware chain | Ownership check | Verdict |
|---|---|---|---|---|
| GET /account/password | 110 | sessionLoader only | inline `if (!c.var.auth) redirect /login` (line 111) | G — self only, no `:id` |
| POST /account/password | 127 | `requireAuthOr302` (120), `csrfForm` | `auth.userId` used for the row update (line 135); passwordHash re-verified against `auth.userId`'s own row | G |

### src/routes/agenda.ts — mounted `app.route("/api/v1", agendaRoutes)`

| Method/Path | Reg. line | Middleware | Ownership check | Verdict |
|---|---|---|---|---|
| GET /events/:eventId/agenda | 33 | requireOrganizer | `event.orgId !== auth.orgId` (38) | G |
| PUT /submissions/:id/slot | 45 | requireOrganizer, csrfJson | `getSubmissionOwnership` + `ownership.orgId !== auth.orgId` (50) | G |
| DELETE /submissions/:id/slot | 82 | requireOrganizer, csrfJson | same pattern (87) | G |
| POST /events/:eventId/agenda/publish | 107 | requireOrganizer, csrfJson | `event.orgId !== auth.orgId` (112) | G |
| POST /events/:eventId/agenda/auto-schedule | 156 | requireOrganizer, csrfJson | `event.orgId !== auth.orgId` (161) | G |

### src/routes/api/contacts/{crud,import,merge,segments,bulk-email}.ts — mounted `app.route("/api/v1", contactsRoutes)` (all registered via `register*Routes` helpers called from `api/contacts/index.ts:31-35`)

Mount-level guard (`api/contacts/index.ts:24-27`): `contactsRoutes.use("/contacts", requireOrganizer)`, `.use("/contacts/*", requireOrganizer)`, `.use("/segments", requireOrganizer)`, `.use("/segments/*", requireOrganizer)` — every path below is covered by one of these four patterns (verified: every `/contacts...` and `/segments...` path registered matches one of the four `.use()` prefixes).

| Method/Path | File:line | Ownership check | Verdict |
|---|---|---|---|
| GET /contacts | crud.ts:34 | `currentOrgId(c)` scopes `listContactsForOrg` | G |
| POST /contacts | crud.ts:48 | org-scoped create; optional `eventId` re-checked via `getEventForOrg(db, body.eventId, orgId)` (80) | G |
| GET /contacts/duplicates | crud.ts:107 | `currentOrgId(c)` scopes query | G |
| GET /contacts/stats | crud.ts:113 | `currentOrgId(c)` scopes query | G |
| GET /contacts/:id | crud.ts:119 | `requireOwnedContact(db, id, orgId)` (shared.ts:61) | G |
| PATCH /contacts/:id | crud.ts:126 | `requireOwnedContact` (128) | G |
| POST /contacts/:id/headshot | crud.ts:218 | `requireOwnedContact` (220) | G |
| POST /contacts/:id/add-to-event | crud.ts:276 | `requireOwnedContact` (278) + `getEventForOrg` (286) | G |
| POST /contacts/import | import.ts:27 | `currentOrgId`; optional `eventId` via `getEventForOrg` (55) | G |
| POST /contacts/merge | merge.ts:13 | `requireOwnedContact` on both `keepId` and `mergeId` (26-27) | G |
| GET /segments | segments.ts:94 | `currentOrgId` | G |
| POST /segments | segments.ts:100 | `currentOrgId` | G |
| PATCH /segments/:id | segments.ts:116 | `requireOwnedSegment(db, id, orgId)` (shared.ts:67) | G |
| DELETE /segments/:id | segments.ts:139 | `requireOwnedSegment` | G |
| POST /contacts/bulk-email | bulk-email.ts:118 | `validateBulkEmailRequest` → `getEventForOrg` + `findContactsForOrg(db, contactIds, orgId)` with a strict length-match IDOR guard (bulk-email.ts:71-78) | G |
| POST /contacts/bulk-email/preview | bulk-email.ts:169 | same `validateBulkEmailRequest` | G |

Note (not an authz gap, out of my no-touch scope): `bulk-email.ts:34` and
`src/routes/comms.ts:291` both still call `repo.findUserIdByEmail` — the
field guide's DEC-456 (`findUserIdByEmail`/`findUserByEmail` DELETED, replaced
by `findAccountUserId(contactId OR email)`) had not landed in either
`src/routes/api/contacts/bulk-email.ts` or `src/routes/comms.ts` as of this
sha. This is a data-correctness/account-linkage question (which portal link a
merge-field renders), not an object-level ownership/authz bypass, and both
files are on this wave's no-touch list — flagged for wave 19, not fixed here.

### src/routes/api/email-log.ts — mounted `app.route("/", emailLogRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /api/v1/events/:eventId/email-log | 17 | requireOrganizer; inline event row fetch + `eventRow.orgId !== auth.orgId` (29) | G |

### src/routes/api/events.ts — mounted `app.route("/api/v1", eventsRoutes)`

Mount-level guard (54-58): `requireOrganizer` on `/events/:eventId`, `/events/:eventId/tracks`, `/events/:eventId/rooms`, `/tracks/*`, `/rooms/*`. `GET /events` (bare) is the intentional DEC-141 exception with its own inline role check.

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /events | 175 | inline: organizer → `listEventsForOrg`, reviewer → `listEventsForReviewer`, else 403 (178-184) | G |
| POST /events | 188 | requireOrganizer (mount-independent, explicit on this line too) | G |
| GET /events/:eventId | 254 | `requireEvent(db, orgId, eventId)` → `getEventForOrg` (142-150) | G |
| PATCH /events/:eventId | 260 | `requireEvent` (263) | G |
| GET /events/:eventId/tracks | 318 | `requireEvent` (321) | G |
| POST /events/:eventId/tracks | 326 | `requireEvent` (329) | G |
| PATCH /tracks/:trackId | 352 | `trackEventId` + `requireEvent` (357-359) | G |
| DELETE /tracks/:trackId | 381 | same pattern (386-388) | G |
| GET /events/:eventId/rooms | 398 | `requireEvent` (401) | G |
| POST /events/:eventId/rooms | 406 | `requireEvent` (409) | G |
| PATCH /rooms/:roomId | 432 | `roomEventId` + `requireEvent` (437-439) | G |
| DELETE /rooms/:roomId | 461 | same pattern (466-468) | G |

### src/routes/api/exports.ts — mounted `app.route("/", exportsRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /api/v1/events/:eventId/exports/showflow.csv | 44 | requireOrganizer + `requireOwnedEvent` (28-40, 46) | G |
| GET /api/v1/events/:eventId/export/:kind | 55 | requireOrganizer + `requireOwnedEvent` (63) | G |

### src/routes/api/forms.ts — mounted `app.route("/", formsRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /api/v1/events/:eventId/forms | 68 | requireOrganizer + `findEventForOrg(db, eventId, auth.orgId)` (72) | G |
| PATCH /api/v1/forms/:formId | 82 | `requireOwnedForm` (50-56, called 84) | G |
| POST /api/v1/forms/:formId/fields | 145 | `requireOwnedForm` (147) | G |
| PATCH /api/v1/fields/:fieldId | 184 | `requireOwnedField` (58-64, called 186) | G |
| DELETE /api/v1/fields/:fieldId | 218 | `requireOwnedField` (220) | G |
| POST /api/v1/forms/:formId/fields/reorder | 242 | `requireOwnedForm` (244) | G |

### src/routes/api/overview.ts — mounted `app.route("/api/v1", overviewRoutes)`

| GET /events/:eventId/overview | 21 | requireOrganizer + `getEventOrgId` + `eventOrgId !== auth.orgId` (25-27) | G |

### src/routes/api/pipeline.ts — mounted `app.route("/api/v1", pipelineRoutes)`

Mount-level guard (17-18): `requireOrganizer` on `/pipeline` and `/pipeline/*`.

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /pipeline | 63 | `currentOrgId` scopes `listPipelineForOrg` | G |
| POST /pipeline | 69 | `findContactForOrg` (84) | G |
| GET /pipeline/:id | 108 | `requireOwnedEntry` (57-61, called 110) | G |
| PATCH /pipeline/:id | 134 | `requireOwnedEntry` (137) | G |
| POST /pipeline/:id/notes | 166 | `requireOwnedEntry` (169) | G |

### src/routes/api/portal-config.ts — mounted `app.route("/api/v1", portalConfigRoutes)`

Mount-level guard (35-36): `requireOrganizer` on `/events/*`, `/resources/*`.

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /events/:eventId/portal-settings | 66 | `requireEvent` (51-60, called 69) | G |
| PUT /events/:eventId/portal-settings | 85 | `requireEvent` (88) | G |
| GET /events/:eventId/resources | 137 | `requireEvent` (140) | G |
| POST /events/:eventId/resources | 217 | `requireEvent` (220) | G |
| PATCH /resources/:resourceId | 259 | `resourceEventId` + `requireEvent` (264-266) | G |
| DELETE /resources/:resourceId | 300 | same pattern (305-307) | G |

### src/routes/api/submissions.ts — mounted `app.route("/api/v1", submissionsRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /events/:eventId/submissions | 57 | requireOrganizer + `assertEventOwnership` (50-54, called 60) | G |
| GET /submissions/:id | 75 | `getSubmissionOwnership` + `ownership.orgId !== auth.orgId` (79-80) | G |
| POST /events/:eventId/submissions | 94 | `assertEventOwnership` (97) | G |
| POST /submissions/:id/clone | 122 | `getSubmissionOwnership` check (126-127) | G |
| PATCH /submissions/:id | 145 | `getSubmissionOwnership` check (149-150) | G |
| GET /submissions/:id/revisions | 196 | `getSubmissionOwnership` check (200-201) | G |
| POST /submissions/:id/revisions/:revisionId/restore | 211-215 (multi-line reg.) | `getSubmissionOwnership` check (220-221) | G |
| POST /submissions/:id/participants | 258 | `getSubmissionOwnership` check (262-263) + `findContactForOrg` (272) | G |
| PATCH /submissions/:id/participants/:participantId | 314-318 (multi-line reg.) | `getSubmissionOwnership` (323-324) AND `getParticipantOwnership` with `scope.submissionId !== id` cross-check (326-329) | G |
| POST /events/:eventId/submissions/status | 348 | `assertEventOwnership` (351) | G |

Reminder for future greps in this codebase: `grep -n 'Routes\.(post\|patch)\('`
alone under-counts by exactly these two rows — the path string is on the
following source line, not the same line as the method call.

### src/routes/api/tokens.ts — mounted `app.route("/", tokensRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /api/v1/tokens | 28 | requireOrganizer + `assertCookieSession` (21-26) + query filtered by `auth.orgId` (41) | G |
| POST /api/v1/tokens | 57 | requireOrganizer + `assertCookieSession`; row written with `orgId: auth.orgId` (76) | G |
| DELETE /api/v1/tokens/:id | 90 | requireOrganizer + `assertCookieSession`; row fetch checks `row.orgId !== auth.orgId` (101) before delete (105, itself also `and(id, orgId)`-scoped) | G |

### src/routes/api/users.ts — mounted `app.route("/", usersRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /api/v1/users | 44 | requireOrganizer; `listOrgUsers(db, auth.orgId, role)` (50) | G |
| POST /api/v1/users | 54 | requireOrganizer; created with `orgId: auth.orgId` (71) | G |
| POST /api/v1/users/:id/reset-password | 113 | `getOrgUserById(db, userId, auth.orgId)` (116) | G |

### src/routes/api/views.ts — mounted `app.route("/api/v1", viewsRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /events/:eventId/views | 35 | `assertEventOwnership` (28-32, called 38) | G |
| POST /events/:eventId/views | 50 | `assertEventOwnership` (53) | G |
| DELETE /views/:id | 68 | `getSavedViewOwnership` + `ownership.orgId !== auth.orgId` (72-73) | G |

### src/routes/auth.tsx — mounted `app.route("/", authRoutes)`

| Method/Path | Reg. line | Verdict / rationale |
|---|---|---|
| GET /login | 152 | PBD — renders the login form itself; must be reachable with no session |
| POST /login | 158 | PBD — the auth-establishing endpoint; guarded instead by per-email+per-IP rate limiting (DEC-072/DEC-180, lines 175-207), never by session |
| POST /logout | 226 | PBD — a no-op for an anonymous caller (deletes the session row matching the presented cookie only, if any); CSRF-protected via `csrfFormOrHeader` |
| GET /claim/:token | 237 | PBD — the "auth" here is possession of an unguessable KV claim token (`readClaimToken`), not a session; this is the account-creation entry point by design |
| POST /claim/:token | 249 | PBD — same token-possession model, plus per-IP rate limiting (253-256) |

### src/routes/comms.ts — mounted `app.route("/", commsRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /api/v1/events/:eventId/templates | 63 | requireOrganizer + `requireOwnedEvent` (47-53, called 65) | G |
| POST /api/v1/events/:eventId/templates | 70 | `requireOwnedEvent` (72) | G |
| PATCH /api/v1/templates/:templateId | 95 | `findTemplateForOrg(db, templateId, auth.orgId)` (99) | G |
| DELETE /api/v1/templates/:templateId | 129 | `findTemplateForOrg` (133) | G |
| POST /api/v1/events/:eventId/compose/preview | 340 | `requireOwnedEvent` (342); `templateId` (if used) re-checked via `findTemplateForOrg` + `template.eventId !== eventId` (179-180) | G |
| POST /api/v1/events/:eventId/compose/send | 380 | same pattern (382, 389) | G |

### src/routes/dev/mailbox.tsx — mounted `app.route("/", devMailboxRoutes)`, guarded by `guardDevMailbox(app)` in `src/server/app.ts:53-60`

| Method/Path | Reg. line | Verdict / rationale |
|---|---|---|
| GET /dev/mailbox | 164 | PBD — DEC-005: routes literally don't exist (404 via `c.notFound()`) unless `DEV_MODE==='1'`; this is single-tenant local dev tooling over the whole (dev-seeded) `email_log`, by design — no secrets present in Stage 1 |
| GET /dev/mailbox/:emailId/ics | 171 | PBD — same DEV_MODE gate |
| GET /dev/mailbox/:emailId | 180 | PBD — same DEV_MODE gate |

### src/routes/docs.tsx — mounted `app.route("/", docsRoutes)`

| GET /docs/api | 332 | PBD — DEC-056: "public, no-login API docs page... it documents no secrets so it's safe to be public" (docs.tsx:1-3); hand-maintained table diffed against real routes by `test/docs-route-coverage.test.ts` so it can't silently drift into leaking an undocumented route's existence |

### src/routes/files.ts — mounted `app.route("/api/v1", fileApiRoutes)` and `app.route("/", fileServeRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| POST /submissions/:id/files | 84 | `authzSubmissionWrite` (64-79, called 86): organizer org-scoped OR speaker must be a listed participant | G |
| GET /submissions/:id/files | 149 | `authzSubmissionWrite` (151) | G |
| POST /submissions/:id/content-status | 172 | requireOrganizer + inline `scope.orgId !== auth.orgId` (177) | G |
| GET /events/:eventId/files | 205 | requireOrganizer + `getEventFilesScope` + org check (208-210) | G |
| POST /events/:eventId/files/archive | 231 | requireOrganizer + org check (234-236) | G |
| GET /files/:fileId/comments | 305 | `authzFileRead` → `getFileScope` + `canAccessFile(auth, scope)` (297-303) | G |
| POST /files/:fileId/comments | 312 | `authzFileRead` (314) | G |
| GET /files/:fileId | 385 | `authzServeFile` (352-383): three disjoint populations (submission file via `canAccessFile` + reviewer-scope check, resource file via `canAccessResourceFile`, task file via `canAccessTaskFile`), each org/participant/reviewer scoped | G |

### src/routes/me.ts — mounted `app.route("/", meRoutes)`

| GET /api/v1/me | 13 | any authenticated role; self-scoped by `auth.userId` (17-21) | G |

### src/routes/portal/edit.tsx — mounted `app.route("/portal", portalEditRoutes)`, mount-level `portalEditRoutes.use("*", speakerGate)` (edit.tsx:44)

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /submissions/:id/edit | 195 | `assertSpeakerContactId` + `loadEditableSubmission(db, contactId, submissionId)` (196-199, itself contact-scoped — returns null/404 for a foreign submission) | G |
| POST /submissions/:id/edit | 222 | same `loadEditableSubmission` scoping (226) | G |

### src/routes/portal/index.tsx — mounted `app.route("/portal", portalRoutes)`, mount-level `portalRoutes.use("*", speakerGate)` (index.tsx:43)

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET / (→ /portal) | 258 | `assertSpeakerContactId`; every query below contact-scoped | G |
| GET /submissions/:id | 271 | `getPortalSubmissionDetail(db, id, contactId, auth.orgId)` (275, contact+org scoped) | G |
| POST /invitations/:participantId | 294 | `getParticipantScope` + `scope.orgId !== auth.orgId` (300) AND `scope.contactId !== contactId` (301) | G |

### src/routes/portal/profile.tsx — mounted `app.route("/portal", portalProfileRoutes)` and `app.route("/", headshotServeRoutes)`; mount-level `portalProfileRoutes.use("/profile", speakerGate)` / `.use("/profile/*", speakerGate)` (profile.tsx:42-43)

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /profile | 236 | `assertSpeakerContactId` via `loadProfile(c)` | G |
| POST /profile | 253 | `assertSpeakerContactId` (255); writes scoped to own `contactId` | G |
| POST /profile/headshot | 318 | `assertSpeakerContactId` (320); writes scoped to own `contactId` | G |
| GET /headshots/:fileId | 406 | `getHeadshotServeScope`; if not publicly visible, `(organizer same org) OR (speaker same contactId)` else 404 (not 401/403 — no existence leak), lines 406-425 | G |

### src/routes/portal/tasks.tsx — mounted `app.route("/portal", portalTasksRoutes)`, mount-level `portalTasksRoutes.use("*", speakerGate)` (tasks.tsx:81)

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /tasks | 373 | `auth.contactId` scopes `loadTasksPageData` | G |
| GET /tasks/:assignmentId/form | 394 | `getAssignmentScope` + `scope.orgId !== auth.orgId` + `assertOwnAssignmentOr403` (400-402) | G |
| POST /tasks/:assignmentId/complete | 430 | same 3-part check (436-438) | G |
| POST /tasks/:assignmentId/form | 445 | same check (451-453) | G |
| POST /tasks/:assignmentId/upload | 495 | same check (501-503) | G |
| POST /tasks/:assignmentId/comments | 583 | same check (589-591) | G |
| GET /tasks/:assignmentId/file | 621 | same check (627-629) | G |
| GET /resources | 650 | `auth.contactId` scopes `getMyResources` | G |
| GET /resources/:resourceId/download | 664 | `getResourceDownloadScope(db, resourceId, contactId, auth.orgId)` (670, contact+org scoped, returns null/404 otherwise) | G |

### src/routes/public/index.tsx — mounted `app.route("/", publicRoutes)`

All rows below are PBD per DEC-022/DEC-289 ("J10: the five public surfaces + embeds... SSR..., no login/session dependence anywhere in this module", index.tsx:1-3). Server-side visibility gating (accepted+visible+content-approved) lives once in `src/server/repo/public.ts`'s `getPublic*` functions, not per-route — every handler below calls one of those.

| Method/Path | Reg. line | Verdict |
|---|---|---|
| GET /e/:eventSlug/:surface (one per `SURFACES` entry, loop) | 104-123 | PBD |
| GET /e/:eventSlug/speakers/:contactId | 125 | PBD |
| GET /e/:eventSlug/sessions/:sessionId | 139 | PBD |
| GET /embed/:eventSlug/:surface{[a-z]+\.json} | 160 | PBD |
| GET /embed/:eventSlug/:surface | 174 | PBD |
| GET /e/:eventSlug/schedule.ics | 197 | PBD |
| GET /e/:eventSlug/agenda.ics | 234 | PBD |

### src/routes/public/submit.tsx — mounted `app.route("/", publicSubmitRoutes)` (no-touch file this wave; read-only review)

| Method/Path | Reg. line | Verdict |
|---|---|---|
| GET /submit/:eventSlug | 410 | PBD — public CFP form |
| POST /submit/:eventSlug/save-draft | 466 | PBD — rate-limited (486-489, DEC-072/422), no session model |
| POST /submit/:eventSlug | 554 | PBD — rate-limited, no session model |

### src/routes/review/plans.ts — mounted `app.route("/", reviewRoutes)` (review/index.ts composes plans+recusals+reviewer)

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /api/v1/events/:eventId/plans | 52 | requireOrganizer + `getEventForOrg` (54) | G |
| POST /api/v1/events/:eventId/plans | 60 | `getEventForOrg` (62) | G |
| GET /api/v1/plans/:id | 94 | `requireOwnedPlan` (shared.ts:210-216, called 95) | G |
| PATCH /api/v1/plans/:id | 99 | `requireOwnedPlan` (100) | G |
| DELETE /api/v1/plans/:id | 173 | `requireOwnedPlan` (174) | G |
| POST /api/v1/plans/:id/advance-round | 181 | `requireOwnedPlan` (182) | G |
| POST /api/v1/plans/:id/reviewers | 187 | `requireOwnedPlan` (188) + `requireOrgUser` (193) + trackId/submissionId cross-event checks (198-211) | G |
| GET /api/v1/plans/:id/reviewers | 221 | `requireOwnedPlan` (222) | G |
| DELETE /api/v1/plans/:id/reviewers/:reviewerId | 236 | `requireOwnedPlan` (237) + `row.planId !== plan.id` cross-check (240) | G |
| GET /api/v1/plans/:id/progress | 245 | `requireOwnedPlan` (246) | G |
| GET /api/v1/plans/:id/results | 290 | `requireOwnedPlan` (291) | G |
| POST /api/v1/plans/:id/remind | 334 | `requireOwnedPlan` (335) | G |

### src/routes/review/recusals.ts — mounted `app.route("/", reviewRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| POST /api/v1/review/plans/:planId/recusals/:submissionId | 17 | `requireReviewerOrOrganizer` + `requireAssignedPlan` (shared.ts:221-237) + `getSubmissionSummaryInEvent` existence-hiding (25-26) + reviewer-scope check (28-30) | G |
| DELETE .../recusals/:submissionId | 47 | same 3-part pattern (50-58) | G |

### src/routes/review/reviewer.ts — mounted `app.route("/", reviewRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /api/v1/review/plans | 31 | `requireReviewerOrOrganizer`; organizer branch org-scoped via `getEventForOrg`, reviewer branch via `listPlanIdsForReviewer(auth.userId)` (32-46) | G |
| GET /api/v1/review/plans/:id/queue | 50 | `requireAssignedPlan` (53) | G |
| GET /api/v1/review/submissions/:id | 115 | `requireAssignedPlan` (121) + reviewer in-scope check (123-126) | G |
| PUT /api/v1/review/plans/:planId/evaluations/:submissionId | 152 | `requireAssignedPlan` (155) + `getSubmissionSummaryInEvent` existence-hiding (160-161) + reviewer in-scope check (167-170) + recusal 409 (174-177) | G |

### src/routes/root.tsx — mounted `app.route("/", rootRoutes)`

| Method/Path | Reg. line | Verdict / rationale |
|---|---|---|
| GET /admin | 59 | PBD-with-redirect — `if (!auth) redirect /login`; `if (role==='speaker') redirect /portal`; otherwise proxies the SPA shell, which itself calls org-scoped `/api/v1/*` endpoints for any data (DEC-049) |
| GET /admin/* | 66 | same redirect pattern (71-73); `/admin/assets/*` bypasses to the ASSETS binding (static JS/CSS, no data) |
| GET / | 130 | PBD — public landing page |

### src/routes/tasks.ts — mounted `app.route("/api/v1", taskRoutes)`

| Method/Path | Reg. line | Ownership check | Verdict |
|---|---|---|---|
| GET /events/:eventId/onboarding | 129 | requireOrganizer + `assertEventOwnership` (88-92, called 132) | G |
| POST /events/:eventId/tasks | 143 | `assertEventOwnership` (146) | G |
| PATCH /tasks/:id | 234 | `getTaskOwnership` + `ownership.orgId !== auth.orgId` (238-239) | G |
| DELETE /tasks/:id | 316 | same pattern (320-321) | G |
| POST /tasks/:id/assign | 332 | same pattern (336-337) + `findContactsForOrg` cross-org id rejection (DEC-120, 344-352) | G |
| PATCH /task-assignments/:id | 372 | **no `requireOrganizer` on this line** — `getAssignmentOwnership` (375) then explicit dual check: `isOwningOrganizer = auth.role==='organizer' && auth.orgId===ownership.orgId` OR `isOwningSpeaker = auth.role==='speaker' && auth.contactId===ownership.contactId` (378-382), 403 otherwise | G — deliberately dual-role, not missing a guard (matches DEC-214 comment) |
| GET /task-assignments/:id/response | 423 | requireOrganizer + `ownership.orgId !== auth.orgId` (429) | G |
| POST /events/:eventId/onboarding/remind | 446 | `assertEventOwnership` (449) | G |
| POST /events/:eventId/onboarding/remind/preview | 465 | `assertEventOwnership` (468) | G |

## Counts

Routes enumerated: **157** (registered handlers, source-registration count).
Note: `public/index.tsx`'s `for (const surface of SURFACES)` loop (line 104)
registers one concrete route per `SURFACES` entry at runtime from that single
source line -- counted once here (one row), all PBD under the same
visibility gate cited above.

PUBLIC-BY-DESIGN tally by file: auth.tsx 5 (GET+POST /login, POST /logout,
GET+POST /claim/:token) + dev/mailbox.tsx 3 + docs.tsx 1 + root.tsx 3
(GET /admin, GET /admin/*, GET /) + public/index.tsx 7 (the surface-loop row
+ 6 explicit rows) + public/submit.tsx 3 = **22**.

- Routes enumerated: **157**
- GUARDED: **135** (157 - 22 PBD - 0 GAP)
- PUBLIC-BY-DESIGN: **22**
- GAP: **0**

## RESULT

**PASS.** Every one of the 157 registered route handlers under `src/routes/`
was individually re-read at sha `d034a9e0610b35b908503084525f1f04d93cb8df` and
classified GUARDED or PUBLIC-BY-DESIGN (with an explicit decision/comment
citation for every PUBLIC-BY-DESIGN row). Zero GAPs found. This supersedes
the w16 sample-based "Authz + object-level ownership | VERIFIED" row
(`docs/verification-log/task-w16-f-spec-audit-stage1.md:81`) with a full
enumeration per DEC-459; no new guard code was needed in this file (no edits
landed in any route file this lane).

One non-authz correctness note is on record above (`bulk-email.ts`/`comms.ts`
still calling the pre-DEC-456 `findUserIdByEmail` instead of
`findAccountUserId`) — flagged for wave 19 since both files are out of this
lane's edit scope.
