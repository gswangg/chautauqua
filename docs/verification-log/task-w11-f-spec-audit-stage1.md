# task-w11-f — STAGE-1 COMPLETION LEDGER (DEC-423)

Log-only lane. No source file changed by this task; only this file and an
appended section in `docs/verification-log.md` are written.

**Audited sha:** `a3dbba69137120da98862b2af1091546f67c94c3` ("scribe wave 11",
`main` at the moment this worktree was cut, 2026-08-12 03:15:19 -0400).

**Filename note (DEC-423):** `docs/verification-log/task-w9-f-spec-audit.md`
already exists from an earlier campaign (a `task-wN-a..S`-battery detail
file). This file uses the exact name given in this task's text —
`task-w11-f-spec-audit-stage1.md` — so it does not collide with or
overwrite that evidence.

Build/test status at S (see STEP 0 below): `npm run build` PASS, `npm test
--silent` PASS — **263 test files / 2186 tests**, 0 failures.

---

## (1) J1–J12 (SPEC.md:95–181)

| Job | Status | Citation |
|---|---|---|
| **J1** — Launch a CFP in an afternoon | VERIFIED | Event create + branding/timezone/slug: `src/db/schema.ts:106-134` (`event` table: `slug`, `closeDate` etc.), `src/routes/api/events.ts` (organizer event CRUD). Custom questions typed text/long_text/dropdown/checkbox/number/file: `src/domain/acceptance.ts:24` union type mirrors the field-kind vocabulary used by `src/routes/api/forms.ts` field CRUD (tested `test/forms-api.test.ts`, `test/forms.test.ts`). Conditional show/hide: `src/forms/visibility.ts:5` ("DEC-008: conditional fine for now"), rendered contract tested in `test/form-render-rules.test.ts` (data-required/rule-gated visibility, lines 73-99+). Tracks on a form + close date: `src/db/schema.ts:134,281`. Public link needs no account: `src/routes/public/submit.tsx` (GET `/submit/:eventSlug`, no auth middleware). |
| **J2** — Submit without friction | VERIFIED | Draft save: `src/routes/public/submit.tsx:465` (`POST /submit/:eventSlug/save-draft`); submit: `:510`; required-field gating via server-side form-schema validation (see §6 row below). Confirmation + portal-link email: `src/routes/public/submit.tsx` submit handler sends via mailer port (dev sink) — covered by `test/submit-core.test.ts`, `test/submit-mailer-failure.test.ts`. Edit stays open until close date, accepted speakers keep editing: `src/domain/edit-lock.ts:6-11` (`status === "accepted" \|\| !isFormClosed(...)`) — tested `test/edit-lock.test.ts`. |
| **J3** — Triage without drowning | VERIFIED | Submissions table w/ any-answer columns, filters, saved views: `src/routes/api/views.ts` + `src/routes/api/submissions.ts`, saved-view config validated `test/api-views.test.ts:6-37`. Bulk status change: `POST /events/:eventId/submissions/status` `src/routes/api/submissions.ts:348-361`, tested `test/status-bulk-full-match.test.ts`, `test/status-bulk-statement-count.test.ts` (set-based, DEC-353-adjacent volume design). Status pipeline pending→accept_queue/decline_queue→accepted/declined: `src/domain/status.ts` (DEC-003 literals), tested `test/api-submissions.test.ts:66` ("accepts exactly the five DEC-003 literals"). Manual session creation/cloning: `test/clone-participants.test.ts`. |
| **J4** — Committee review in waves | VERIFIED | Evaluation plan (instructions, open/close, track filters, anonymized, scale, weighted criteria, rounds, max-evals cap): `src/routes/review/plans.ts:74-114` (`parseRounds`, `parseRoundCriteria`, `filters.trackIds`, `anonymized`). Reviewer queue sorted fewest-ratings-first: `src/domain/evaluation.ts:322-329` (`buildReviewerQueue`, doc comment cites "SPEC J4"), wired at `src/routes/review/reviewer.ts:49-91`. Bulk reminder: `POST /api/v1/plans/:id/remind` `src/routes/review/plans.ts:334-381`. Results sorted by aggregate score, exportable: `src/domain/evaluation.ts:360-365` (results sort), `src/routes/api/exports.ts` evaluations CSV. Anonymization server-side: `src/server/repo/files.ts` anonymized-plan exclusion (`test/reviewer-file-access.test.ts`) + `test/review-results-ratingless.test.ts`. |
| **J5** — Decide and notify, deliberately | VERIFIED | Status change never sends email: `src/routes/api/submissions.ts` status route imports no mailer (module-comment `src/routes/api/submissions.ts:5` "status changes never send email"), directly asserted by `test/spec9-invariants.test.ts:58-69` (fake-db touched-tables check: `updateSubmissionStatuses` never touches `schema.emailLog`). Compose w/ merge fields, per-recipient preview, 100 cap, per-recipient log: `src/domain/compose.ts:9` (`MAX_COMPOSE_RECIPIENTS = 100`), preview route `src/routes/comms.ts:340-365` (DEC-397: preview never mints credentials), send route with atomic preflight `src/routes/comms.ts:398`, tested `test/compose.test.ts`, `test/compose-preview-no-token.test.ts`, `test/compose-full-set.test.ts`. Reviewer-feedback-attach bonus: not directly located in this pass — see OPEN ITEM below. |
| **J6** — Onboarding runs itself | VERIFIED | Acceptance auto-creates speaker+session+default tasks exactly once: `src/domain/acceptance.ts:120` (`planAcceptance`, idempotent by (contact,title) pair) fired from `src/server/repo/submissions/status.ts:254` ("On first transition into 'accepted' (accepted_at was null)"). Default hotel-stay + flight-reimbursement form tasks: `src/domain/acceptance.ts` `DEFAULT_ONBOARDING_TASKS` + `FORM_TASK_FIELD_SPECS` (`test/acceptance-form-tasks.test.ts:38` "matches the exact DEC-111 specs for the two must-have forms"). Onboarding dashboard (per-speaker×per-task grid, due dates, filters): `src/routes/tasks.ts` + `src/server/repo/tasks.ts` (`test/onboarding-grid-pagination.test.ts`, `test/onboarding-late-participant.test.ts`). Cron reminders schedule-driven (never decision-driven): `src/domain/reminders.ts:1-9`, tested `test/tasks-due-reminders.test.ts`. Bulk "remind everyone outstanding": `test/tasks-remind-now-mailer-failure.test.ts`. |
| **J7** — Speakers self-serve | VERIFIED | Branded portal (logo/accent/welcome): `src/routes/portal/index.tsx` + `portal_settings` in `src/db/schema.ts`. My submissions/tasks/sessions/resources: `src/routes/portal/tasks.tsx`, `src/routes/portal/index.tsx`. Edit bio/social/headshot reflected on producer record (one record, two views): `src/routes/portal/profile.tsx` `updateContactProfile` write path, tested `test/contact-profile-roundtrip.test.ts`, `test/portal-edit-profile-fields.test.ts`. Session invite accept/decline: `src/routes/portal/index.tsx:292` (own participant rows, invite_status='invited'), `test/portal-invite-scope.test.ts`. Absolute scoping (own content only): `test/task-file-access.test.ts` "403s for another speaker (IDOR)". |
| **J8** — Collect/review/approve content | VERIFIED | Typed uploads Presentation/Poster/Handout + version chains: `src/db/schema.ts:545-552` (`previousFileId`, indexed), `src/server/repo/files-versions.ts`, tested `test/files-repo.test.ts`, `test/files.test.ts`. Comment thread producer↔speaker: `src/server/repo/files-comments.ts`, `src/routes/portal/*`. Content approval status gates public surfaces: `src/db/schema.ts:190-191` (`contentStatus` enum pending/approved/changes_requested), enforced in the public query gate `src/server/repo/public/gates.ts:25-27` (`visibleSessionConditions()`: `status='accepted' AND content_status='approved'`). Upload UI states types/caps: `src/domain/files.ts:52-61` (`ALLOWED_UPLOAD_EXTENSIONS`, cap-summary helper). |
| **J9** — Build the agenda under change | VERIFIED | Rooms/tracks defined once: `src/db/schema.ts` `track`/`room` tables. List + day-grid views, drag-drop persisted placement: `src/routes/agenda.ts` (comment line 4: "succeed for accepted submissions and return refreshed {conflicts, summary}"). Conflicts surfaced-never-blocking + live counter: `src/domain/schedule.ts:31-79` (`findConflicts`, unplaced/conflicts counter). Auto-schedule greedy: `src/domain/schedule.ts:108` (`autoSchedule`), input-validated 400s tested `test/agenda-auto-schedule-params.test.ts:76-105`. |
| **J10** — Publish continuously | VERIFIED | Five public no-login surfaces (sessions, speakers, agenda, itinerary/.ics, gallery) all mounted under `src/routes/public/index.tsx:82-234` (`/e/:eventSlug/<surface>`, `/e/:eventSlug/schedule.ics`, `/e/:eventSlug/agenda.ics`). Embed generator: `app/src/pages/settings/EmbedsPanel.tsx` + `embedSnippet.ts` (tested `embedSnippet.test.ts`). Only accepted+visible+content-approved renders, enforced in the query (three-gate ladder, never CSS-hidden): `src/server/repo/public/gates.ts:18-56` (`visibleSessionConditions`/`visibleParticipantConditions`/`visibleSubmissionConditions`), consumed by `src/server/repo/public/agenda.ts:40,119`, `.../detail.ts:117,213`, `.../sessions.ts`, `.../speakers.ts`. Edge-cache + purge: `publicCacheMiddleware` at `src/routes/public/index.tsx:82-83`; purge-on-write tested `test/pubcache.test.ts`. |
| **J11** — Reuse the network next event | VERIFIED | Org-level contact directory, custom fields, notes: `src/server/repo/contacts.ts` + `src/routes/api/contacts.ts`. CSV import w/ column mapping: `src/lib/csv.ts` + `test/contacts-import.test.ts`, `test/contacts-roster-import.test.ts`. Per-contact history, duplicate merge: `test/contacts-duplicates-merge-route.test.ts`, `test/contacts-merge-integrity.test.ts` (DEC-167 full-profile merge). Segments, bulk email: `test/contacts-bulk-email-preview-route.test.ts`. Dashboard (returning-speaker count, top companies): CRM sourcing pipeline at `src/routes/api/pipeline.ts` + `src/server/repo/pipeline.ts`. Contact→speaker→public ladder never collapses: enforced by the same three-gate `src/server/repo/public/gates.ts` used in J10. |
| **J12** — The data stays theirs | VERIFIED | Exports CSV/JSON everywhere: `src/routes/api/exports.ts` (submissions/speakers/evaluations/agenda/email-log/showflow, e.g. `showflow.csv` route at line 44), tested `test/exports.test.ts`, `test/exports-cross-org.test.ts`. REST API `/api/v1` bearer tokens, SPA dogfoods same API: `src/routes/api/tokens.ts:1-23` (DEC-027, cookie-session-only token management; a bearer-authenticated request cannot mint/manage tokens itself). Optional one-way Airtable sync, off by default, read-only on their side: `src/sync/airtable.ts:5` ("...lands\" — read-only on their side. Feature is OFF unless both..."), tested `test/airtable-sync.test.ts`. |

No J-row is GAP or STAGE-2 in this pass. One sub-bullet inside J5 (the
"bonus per swyx: attach reviewer feedback to the decision email") was not
independently re-confirmed this pass — see OPEN ITEMS.

---

## (2) SPEC §5 invariants (SPEC.md:290–303)

| Invariant | Status | Citation |
|---|---|---|
| Status pipeline `pending → accept_queue\|decline_queue → accepted\|declined` (+custom) | VERIFIED | `src/domain/status.ts` DEC-003 literal set; `test/api-submissions.test.ts:66` "accepts exactly the five DEC-003 literals" |
| Status changes never send email | VERIFIED | `src/routes/api/submissions.ts:5` module comment; behavioral proof `test/spec9-invariants.test.ts:58-69` |
| Contact → participant → public three-gate ladder, distinct gates never collapsed | VERIFIED | `src/server/repo/public/gates.ts:18-56` — `visibleSessionConditions()` (status+content), `visibleParticipantConditions()` (participant.visible + inviteStatus), `visibleSubmissionConditions()` = AND of both, documented as deliberately-split (DEC-274) so a hidden-speaker session still shows with `speakers: []`; tested `test/headshot-gate.test.ts`, `test/public-invite-visibility.test.ts` |
| `close_date` past ⇒ new submissions rejected + (unaccepted) speaker edits locked; accepted speakers keep editing | VERIFIED | Public submit route checks `formWindowState` (`src/routes/public/submit.tsx:472-478,517-523`) → `ClosedPage`; edit-lock exemption `src/domain/edit-lock.ts:6-11`; tested `test/edit-lock.test.ts`, `test/submit-core.test.ts` |
| Acceptance auto-creation fires exactly once, idempotently | VERIFIED | `src/server/repo/submissions/status.ts:254` (first-transition guard on `accepted_at`); `planAcceptance` idempotency `src/domain/acceptance.ts:116-119`; tests `test/domain.test.ts:59` "fires acceptance exactly once on first entry into accepted", `:120` "is idempotent: replanning after applying results yields nothing"; `test/api-submissions.test.ts:81` "fires acceptance exactly once across repeated transitions into 'accepted'", `:99` "planAcceptance is idempotent when re-run..." |
| Stable IDs / per-event record prefixes (`SES-014`) / .ics UIDs never churn | VERIFIED | `src/domain/ids.ts:20-26` (`formatRef`); `src/db/schema.ts:112,181` (seq/record_prefix comments); COALESCE(MAX)+1 scoping tested `test/submission-seq.test.ts:14-23`; stable UID `src/mail/ics.ts:2,109` (`uidFor(e.uidSubmissionId)`, doc comment "stable UID from submission id, SEQUENCE bumped by caller"), tested `test/compose-ics.test.ts`, `test/ics-crlf-escaping.test.ts` |
| Files: `previous_file_id` version chains, full downloadable history | VERIFIED | `src/db/schema.ts:545,552` (`previousFileId` + FK index); `src/server/repo/files-versions.ts`; tested `test/files-repo.test.ts`, `test/files.test.ts`, `test/files-library.test.ts` |

---

## (3) SPEC §6 (SPEC.md:306–320)

| Item | Status | Citation |
|---|---|---|
| PBKDF2-SHA256 ≥600k iterations, constant-time compare, session rotation | **AMENDED, documented** | `src/auth/password.ts:1-7` — DEC-004's amendment (`decisions/DEC-004.md:5-12`, dated 2026-08-11) drops `ITERATIONS` from 600,000 to **100,000**, citing a hard Cloudflare Workers `PBKDF2` cap (`NotSupportedError` above 100k on deployed `workerd`) discovered during stage-2 deploy prep; the hash format self-describes iteration count so `verify()` is unaffected and old/new hashes interoperate. This is a **binding decision, not a gap** — SPEC.md:308's literal "≥600k" text is stale relative to the amendment; flagging so the next planner can decide whether to update SPEC.md's prose to match the binding decision. Session rotation on login: `test/auth.test.ts`, `test/cookie-flags.test.ts`. |
| CSRF: custom-header on JSON, token on plain-form posts | VERIFIED | `src/server/middleware.ts:243-256` (`csrfJson` header `x-chq-csrf: 1`; `csrfForm` double-submit cookie `chq_csrf`); DEC-004 decision doc line 3 |
| Authz middleware role+event grant, object-level ownership on every fetch-by-id (no IDOR) | VERIFIED | `src/server/middleware.ts` `requireOrganizer`/`requireReviewer`/`requireSpeaker`; IDOR tests across the suite e.g. `test/task-file-access.test.ts` "403s for another speaker (IDOR)", `test/review-idor.test.ts` |
| Server-side filtering for public/anonymized data, never CSS-hidden | VERIFIED | `src/server/repo/public/gates.ts` (SQL WHERE conditions, not a post-filter — DEC-318 doc comment explicitly: "Kept in the SQL WHERE per DEC-312, never a post-filter in the mapper") |
| Upload allowlist, size caps, no HTML content-type | VERIFIED | `src/domain/files.ts:15` ("extension -> forced served content type. Never an HTML..."), `:52` (`ALLOWED_UPLOAD_EXTENSIONS`), `:61` (25MB/8MB cap summary) |
| Parameterized queries only (Drizzle) | VERIFIED | Repo-wide Drizzle ORM usage (no raw SQL string concatenation found in `src/server/repo/`); `test/schema.test.ts` |
| Rate limits on auth AND public submission | **PARTIAL GAP** | Auth login: `src/routes/auth.tsx:177-207` (`peekScopedLimit`/`incrementScopedLimit`/`resetScopedLimit`, scopes `login-user`/`login-ip`); claim: `:253`. Public **submit**: `src/routes/public/submit.tsx:530-538` (`checkAndIncrementScopedLimit`, scope `submit`, 60/hr). **`POST /submit/:eventSlug/save-draft` (`src/routes/public/submit.tsx:465-508`) carries NO rate limit at all** — confirmed by direct read: no call to any rate-limit helper appears in that handler, only in the sibling `POST /submit/:eventSlug` handler starting at line 510. This is exactly the gap `decisions/DEC-422.md` names ("save-draft takes the same checkAndIncrementScopedLimit the real submit uses... so a draft flood cannot bypass the submit budget") — the decision is recorded but the fix is **not yet landed in code** at this sha. No test in `test/rate-limit*.test.ts` or `test/submit-*.test.ts` exercises a save-draft rate limit (grep for "save-draft" combined with "rate" across `test/` returns nothing). |
| Server-side form-schema validation (never trusts client rendering) | VERIFIED | `src/forms/validate.ts` (required/type/conditional-visibility validation used by the public submit route), tested `test/answer-length-caps.test.ts`, `test/field-length-limits.test.ts`, `test/submit-core.test.ts` |

**Additional GAP found (not itemized in the §6 SPEC bullets verbatim but named by DEC-422 as extending the same "unbounded free text" invariant this section covers):** `POST /portal/profile` (`src/routes/portal/profile.tsx:252-283`) writes `firstName`/`lastName`/`title`/`company`/`bio`/`socialLinks` (four social URLs) to `contact` with **no length check** — no import of `MAX_TEXT_LENGTH`/`MAX_LONG_TEXT_LENGTH` from `src/forms/validate.ts` appears in `src/routes/portal/profile.tsx` (confirmed by direct grep), matching exactly what `decisions/DEC-422.md` names as still-open ("writes... with no length check whatsoever... on a speaker-authenticated route DEC-417 will not touch"). DEC-422 prescribes the fix (reuse `MAX_TEXT_LENGTH`/`MAX_LONG_TEXT_LENGTH`, SSR 400 re-render naming the field) but it is not yet implemented at this sha.

---

## (4) SPEC §7/§8 (SPEC.md:322–368)

| Item | Measurable in stage 1? | Status | Citation |
|---|---|---|---|
| Admin API reads p95 <50ms / writes <100ms server time | Yes, locally | VERIFIED (mechanism) | `scripts/perf-smoke-lib.ts:19-21` (`PERF_CLASS_BUDGET_MS`: read 50, write 100, public 150), overhead-adjusted grading `:73-94`; `test/perf-smoke.test.ts`; enforced in CI (`perf-smoke` job, see below) |
| One round trip per view (joined query/endpoint) | Yes | VERIFIED | `src/routes/api/overview.ts` single-endpoint dashboard payload (`test/overview-payload-contract.test.ts`) |
| Public pages: edge-cache TTFB <50ms / uncached SSR <150ms, Cache-Control+SWR, purge on write | Cache-Control mechanics yes; **true edge-cache hit timing is stage-2-only** (no CF edge in local Miniflare) | PARTIAL / STAGE-2 for the edge-hit number | `publicCacheMiddleware` `src/routes/public/index.tsx:82-83`; purge `test/pubcache.test.ts`; the <50ms *edge*-cache-hit TTFB specifically requires a deployed CF edge (SPEC §0 defers "production edge-cache validation and perf measurement" to stage 2) |
| Smart Placement on | **STAGE-2 only** | STAGE-2 | SPEC.md:59-62 explicitly lists "production edge-cache validation and perf measurement" under stage-2 platform wiring; Smart Placement is a `wrangler deploy`-time Cloudflare setting, not testable pre-deploy. `wrangler.jsonc` was not searched for a placement flag in this pass — flagging as unverified either way pending stage-2. |
| High-frequency actions render optimistically at ~0ms, fail loudly + roll back | Partially (code-level), not measurable as UX latency in stage 1 without a browser perf harness | VERIFIED (mechanism), not independently re-measured this pass | optimistic-UI patterns exist in `app/src/pages/agenda/*` drag-drop and `app/src/pages/submissions/*` status pills (not re-audited line-by-line this pass — see OPEN ITEMS) |
| Nav interactive <300ms, prefetch on hover/focus | Not independently measured this pass | Not re-verified | — |
| D1 indexes on every FK + (event_id,status) + (event_id,slug) | Yes | VERIFIED | `src/db/schema.ts` — 64 `index(...)` declarations counted (`grep -c "index("` = 64); `event_slug_idx` unique index `src/db/schema.ts:120`; `test/schema-fk-indexes.test.ts`, `test/w10-verify-no-blanket-wildcard.test.ts` |
| Server pagination + filtering on all admin lists; thumbnailed headshots w/ cache headers | Yes | VERIFIED | `test/pagination.test.ts`, `test/onboarding-grid-pagination.test.ts`, `test/public-sessions-pagination.test.ts`, `test/public-speakers-pagination.test.ts`; headshot thumbnailing `src/domain/files.ts:186` (webp, 8MB cap) |
| SPA code-split by route, initial bundle <300KB gz | Yes | VERIFIED | `scripts/bundle-check-lib.ts:5` (`BUDGET_BYTES = 300*1024`); `test/bundle-check.test.ts`; this run's `npm run build` output shows main entry `index-OGWrPj8G.js` 183.82 kB / gzip 59.96 kB, comfortably under budget |
| CI perf smoke against 2k-row seed, fails build over budget | Yes | VERIFIED | `.github/workflows/ci.yml` `perf-smoke` job (top-level jobs confirmed: `build-and-test`, `perf-smoke`, `walkthrough`, `render-sweep`); `scripts/perf-seed-lib.ts`/`perf-seed.ts` (2k-row synthetic seed) |
| §8: `npm i && npm run db:migrate && npm run seed && npm run dev` = working local app | Yes | VERIFIED | `README.md:43-46` matches these four commands verbatim; `package.json` scripts `db:migrate`/`seed`/`dev` present (`"dev": "wrangler dev"`, `"db:migrate": "wrangler d1 migrations apply chautauqua --local"`, `"seed": "tsx scripts/seed.ts && ... && tsx scripts/seed-r2.ts"`) |
| §8: `npm run deploy` = migrations + `wrangler deploy`, one command, idempotent | **STAGE-2** | STAGE-2 | No `"deploy"` script exists in `package.json` at this sha (confirmed by direct grep — zero matches). SPEC.md §0 explicitly places `wrangler deploy` under stage-2 platform wiring (SPEC.md:59-63), so this absence is deliberate deferral, not a stage-1 gap. |
| §8: seed doubles as grader package, README "For evaluators" lists URLs+creds verbatim | Yes | VERIFIED | `README.md:135` `## For evaluators` section present; credential table cross-checked against `docs/fixtures/sample-data.json` by the prior `task-w9-f-spec-audit.md` STEP 4 (byte-for-byte match) — not re-diffed line-by-line this pass since neither file changed since that audit (see STEP 0 delta note below) |
| §8: GitHub public repo MIT, CI typecheck+unit tests | Yes | VERIFIED | `LICENSE` present at repo root; CI `build-and-test` job (`.github/workflows/ci.yml:13`) |

---

## (5) SPEC §9 four unit invariants (SPEC.md:381-383)

| Invariant | Test file |
|---|---|
| Close-date lock | `test/edit-lock.test.ts` (46 lines) + `test/submit-core.test.ts` (210 lines) |
| Speaker isolation (cross-account IDOR) | `test/task-file-access.test.ts` — "403s for another speaker (IDOR)" |
| Hidden-speaker exclusion | `test/headshot-gate.test.ts` — "404s unauthenticated when the speaker isn't publicly visible (pending/hidden)" |
| Decision (status change) ≠ email | `test/spec9-invariants.test.ts:57-70` — direct behavioral test added specifically for this invariant (fake-db touched-tables assertion that `updateSubmissionStatuses` never touches `schema.emailLog`) |

All four files exist and are non-trivial at S; each cited above by exact
behavior asserted, not merely by filename.

---

## (6) DEFERRED-TO-STAGE-2 list (deliberate, per SPEC §0)

- Cloudflare provisioning (D1/R2/KV, cron) for a live deployment.
- `wrangler deploy` / `npm run deploy` (script does not exist yet — correct per §0).
- Resend API key + real email delivery (+ optional webhooks); stage 1 uses
  the dev-sink mailer port + `/dev/mailbox` viewer (`src/routes/dev/mailbox.tsx`).
- Production edge-cache validation and perf measurement (true CDN-hit TTFB
  numbers; Smart Placement's effect can only be measured against a deployed
  Worker).
- Airtable one-way sync going live end-to-end against a real base (code path
  exists and is tested with a fake client per `test/airtable-sync.test.ts`;
  actual base credentials are a stage-2 concern).
- Domain/DNS, CI deploy pipeline.
- Sessionboard importer (SPEC §3: explicitly "not buildable without their
  API key," roadmap item, never claimed as stage-1 scope).
- Nice-to-haves list (SPEC §10, items 1-8): none of these were audited as
  stage-1-required since SPEC.md:390 gates them "only after J1–J12 are
  green" — J1-J12 are green per section (1) above, but this audit did not
  separately check nice-to-have completion since they are explicitly
  post-J1-J12, not stage-1-blocking.

---

## STEP 0 — build/test at S

- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
  vite build --config app/vite.config.ts`): **PASS**, 0 errors. Main SPA
  entry `index-OGWrPj8G.js` 183.82 kB / gzip 59.96 kB (under the 300KB gz
  budget in row 4 above).
- `npm test --silent`: **PASS. 263 test files / 2186 tests**, 0 failures,
  ~22s wall (collect+transform+test phases ~58s/28s/13s per vitest's own
  breakdown).

---

## OPEN ITEMS

1. **GAP** — `POST /submit/:eventSlug/save-draft` has no rate limit
   (`src/routes/public/submit.tsx:465-508`), unlike its sibling
   `POST /submit/:eventSlug` (line 530-538). SPEC §6 requires "Rate limits
   on auth + public submission" and a draft save is a public-submission
   write per `decisions/DEC-422.md`, which names this exact gap and
   prescribes the fix but the fix is not yet in the tree at this sha.
2. **GAP** — `POST /portal/profile` (`src/routes/portal/profile.tsx:252-283`)
   writes `firstName`/`lastName`/`title`/`company`/`bio` and four social
   links to `contact` with no length cap, unlike every admin JSON mutation
   route (DEC-417) and unlike the public submit path (DEC-417/DEC-422). A
   sufficiently long value risks a D1 `SQLITE_TOOBIG` 500 rather than a
   clean 400. `decisions/DEC-422.md` names this exact gap and prescribes
   the fix (reuse `MAX_TEXT_LENGTH`/`MAX_LONG_TEXT_LENGTH`, SSR 400
   re-render naming the field) but it is not yet in the tree at this sha.
3. **NOTE, not a gap** — SPEC.md:308's literal "PBKDF2-SHA256 (≥600k
   iterations)" text is stale relative to the binding `decisions/DEC-004.md`
   amendment (2026-08-11) that dropped iterations to 100,000 to match a
   hard Cloudflare Workers PBKDF2 ceiling. The code (`src/auth/password.ts`)
   correctly implements the amended decision; flagging only because SPEC.md
   itself was not updated to match, which could read as a discrepancy to a
   future auditor who trusts SPEC.md's literal number over `decisions/`.
4. **NOT INDEPENDENTLY RE-VERIFIED this pass** — J5's swyx bonus ("attach
   reviewer feedback to the decision email") and the perceived-performance
   sub-bullets of §7 (optimistic UI ~0ms rendering, nav <300ms, prefetch on
   hover/focus) were not traced to specific line citations in this pass;
   listed here so the next planner knows these are open questions, not
   confirmed gaps.

OPEN ITEMS: 4

RESULT: FAIL — two genuine SPEC §6 GAPs (items 1 and 2 above: save-draft
has no rate limit; portal/profile has no length caps) are unfixed at this
sha, both already named and prescribed by `decisions/DEC-422.md` but not
yet landed in code. Everything else audited (J1-J12, SPEC §5, the rest of
§6, §7/§8's stage-1-measurable rows, §9) is VERIFIED with citations, and
build+test are green (263 files / 2186 tests). Item 3 is a documentation
staleness note, not a functional gap. This is a narrow, precisely-scoped
FAIL: two known write paths need the caps DEC-422 already specifies wired
in, not a re-architecture.
