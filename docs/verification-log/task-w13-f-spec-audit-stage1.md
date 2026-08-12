# task-w13-f — STAGE-1 COMPLETION LEDGER (DEC-423)

Log-only lane. No source file changed by this task; only this file and an
appended section in `docs/verification-log.md` are written. Every citation
below was re-checked directly against **this** worktree's tree (branch
`task-w13-f`, cut from `main` at commit `d0b8937`, 2026-08-12) — nothing is
inherited from `task-w11-f-spec-audit-stage1.md`'s `RESULT: FAIL` without
re-reading the named files myself.

**Re-check of the two `task-w11-f` GAPs, per explicit task instruction:**

1. `POST /submit/:eventSlug/save-draft` rate limit. `src/routes/public/submit.tsx:481-492`:
   ```
   // DEC-422: save-draft is an otherwise-unmetered KV write path — mirror the
   // final-submit handler's per-IP scoped limiter (DEC-072/DEC-057/DEC-038)
   // before touching KV.
   const kv = c.env.KV as unknown as DraftKVStore;
   const ip = requestIpFromHeaders((name) => c.req.header(name));
   const rate = await checkAndIncrementScopedLimit(kv, "draft", ip, Date.now(), {
     windowSeconds: 3600,
     max: 60,
   });
   if (!rate.ok) {
     throw new ApiError("invalid", "Too many submissions from this address. Try again later.");
   }
   ```
   This now runs before any KV write in the handler. Behaviorally proven by
   `test/submit-draft-limits.test.ts:169-193` ("limits the 61st draft save
   from the same IP within the window" — asserts 400 + "Too many..." message
   after 60 prior draft saves are seeded into KV). **GAP CLOSED.**
2. `POST /portal/profile` length caps. `src/routes/portal/profile.tsx:279-302`:
   caps `firstName`/`lastName`/`title`/`company`/`twitter`/`linkedin`/`github`/
   `website` at `MAX_TEXT_LENGTH` and `bio` at `MAX_LONG_TEXT_LENGTH` (both
   imported from `../../forms/validate` at line 15), rejecting with a 400
   SSR re-render naming the field (`${field} is too long.`) before
   `updateContactProfile` is ever called (line 304). Behaviorally proven by
   `test/portal-profile-limits.test.ts:85-121` ("rejects an over-cap bio with
   400, names the field, and never calls updateContactProfile"; "rejects an
   over-cap social link (twitter)..."; "saves successfully when bio and
   social links are exactly at their caps"). **GAP CLOSED.**

Both DEC-422 gaps that failed `task-w11-f` are fixed in this tree, each with
a dedicated behavioral test. Neither is re-raised below.

---

## (1) J1–J12 (SPEC.md:95–181)

| Job | Status | Citation |
|---|---|---|
| **J1** — Launch a CFP in an afternoon | VERIFIED | Event slug/close-date columns: `src/db/schema.ts:106` (`slug`), `:120` (`event_slug_idx` unique index). Custom question kinds + conditional rules: `src/forms/visibility.ts` (module comment cites "DEC-008: conditional fine for now"), field-kind CRUD `src/routes/api/forms.ts`, tested `test/forms-api.test.ts`, `test/form-render-rules.test.ts`. Public link needs no account: `src/routes/public/submit.tsx:410` `GET /submit/:eventSlug`, no auth middleware on the sub-app. |
| **J2** — Submit without friction | VERIFIED | Draft save `src/routes/public/submit.tsx:466` `POST /submit/:eventSlug/save-draft`; submit `:554` `POST /submit/:eventSlug`; required-field gating via `validateAnswers` (`src/forms/validate.ts`) called at `:624`. Edit stays open until close date, accepted speakers keep editing: `src/domain/edit-lock.ts:11` (`status === "accepted" \|\| !isFormClosed(closeDate, now)`), tested `test/edit-lock.test.ts`. Confirmation email via mailer port: `src/routes/public/submit.tsx:751-783`. |
| **J3** — Triage without drowning | VERIFIED | Saved views: `src/routes/api/views.ts`, tested `test/api-views.test.ts`. Bulk status change: `src/routes/api/submissions.ts:347` `POST /api/v1/events/:eventId/submissions/status`. Status pipeline literal set: `src/domain/status.ts`, tested `test/api-submissions.test.ts:66` "accepts exactly the five DEC-003 literals". Clone: `test/clone-participants.test.ts`. |
| **J4** — Committee review in waves | VERIFIED | Plan filters/anonymized/scale/criteria/rounds: `src/routes/review/plans.ts`. Fewest-ratings-first queue: `src/domain/evaluation.ts:334` `buildReviewerQueue`. Bulk reminder: `src/routes/review/plans.ts` `POST .../remind`. Anonymization server-side: `src/server/repo/files.ts`, tested `test/reviewer-file-access.test.ts`, `test/review-results-ratingless.test.ts`. |
| **J5** — Decide and notify, deliberately | VERIFIED (incl. bonus) | Status change never emails: proven behaviorally by `test/spec9-invariants.test.ts:58-69` (fake-db touched-tables assertion — `updateSubmissionStatuses` never touches `schema.emailLog`). Compose 100-cap + atomic preflight: `src/domain/compose.ts:9` (`MAX_COMPOSE_RECIPIENTS = 100`), `:140-181` (`preflightRender`, all-or-nothing). Per-recipient preview never mints creds: `src/routes/comms.ts:280-296` (`resolvePortalLink`, `mintClaimTokens` false on preview). **Bonus — attach reviewer feedback to the decision email**: `src/domain/compose.ts:12,79-83,97-105` (`NO_FEEDBACK_TEXT`, `formatFeedback`, `buildMergeVars` puts `feedback` into the merge-var map), wired end-to-end at `src/routes/comms.ts:149,208,320` (`includeFeedback` request flag → `repo.listFeedbackComments(...)` → `buildMergeVars({ ..., feedbackComments })`), consumed by both preview (`:366`) and send (`:409`). |
| **J6** — Onboarding runs itself | VERIFIED | Fires exactly once on first accepted transition: `src/server/repo/submissions/status.ts:254` ("On first transition into 'accepted' (accepted_at was null)"). Default hotel-stay + flight-reimbursement form tasks: `src/domain/acceptance.ts:14` `DEFAULT_ONBOARDING_TASKS`, tested `test/acceptance-form-tasks.test.ts`. Cron reminders schedule-driven: `src/domain/reminders.ts`, tested `test/tasks-due-reminders.test.ts`. |
| **J7** — Speakers self-serve | VERIFIED | Branded portal: `src/routes/portal/index.tsx` + `portal_settings` table. Bio/social/headshot edits reflect on the producer's record (one row, two views): `src/routes/portal/profile.tsx:304` `updateContactProfile(...)`, tested `test/contact-profile-roundtrip.test.ts`. Absolute scoping: `test/task-file-access.test.ts` "403s for another speaker (IDOR)". |
| **J8** — Collect/review/approve content | VERIFIED | Version chains: `src/db/schema.ts:545` `previousFileId` + `:552` FK index. Content approval gates public surfaces server-side: `src/server/repo/public/gates.ts:25` `visibleSessionConditions()` (status='accepted' AND content approved), consumed by every public list/detail query. Upload allowlist/caps: `src/domain/files.ts:55` `ALLOWED_UPLOAD_EXTENSIONS`, `:64` cap-summary text. |
| **J9** — Build the agenda under change | VERIFIED | Conflicts surfaced-never-blocking + live counter: `src/domain/schedule.ts:36` `findConflicts`, `:79` `unplaced`/`conflicts` counter fields. Auto-schedule: `src/domain/schedule.ts:108` `autoSchedule`, param-validated 400s tested `test/agenda-auto-schedule-params.test.ts`. Drag-drop optimistic placement + loud rollback (client): `app/src/pages/Agenda.tsx:46-63` `handlePlace` (`setAgenda(previous)` + `setError(...)` in the `catch`). |
| **J10** — Publish continuously | VERIFIED | Five public no-login surfaces mounted under `src/routes/public/index.tsx:105` (`/e/:eventSlug/<surface>`), `.ics` at `:197` (`/e/:eventSlug/schedule.ics`). Only accepted+visible+content-approved renders, enforced in the SQL, never CSS-hidden: `src/server/repo/public/gates.ts:25-56`. Embed generator: `app/src/pages/settings/EmbedsPanel.tsx`, tested `embedSnippet.test.ts`. Edge-cache middleware + purge on write: `test/pubcache.test.ts`. |
| **J11** — Reuse the network next event | VERIFIED | Contact directory + custom fields: `src/server/repo/contacts.ts`. CSV import w/ column mapping: `src/lib/csv.ts:4` (module comment: "Used by contact import (J11...)"), tested `test/contacts-import.test.ts`. Duplicate merge: `test/contacts-merge-integrity.test.ts`. Bulk email: `test/contacts-bulk-email-preview-route.test.ts`. Contact→speaker→public ladder: same three-gate `src/server/repo/public/gates.ts` used in J10. |
| **J12** — The data stays theirs | VERIFIED | Exports CSV: `src/routes/api/exports.ts:44` `showflow.csv` route (one of several export routes in that file), tested `test/exports.test.ts`. Bearer-token `/api/v1` self-consumption: `src/routes/api/tokens.ts`. Airtable one-way sync, off by default: `src/sync/airtable.ts:4` (module comment: "...happen on airtable once a new row lands\" — read-only on their side"), tested `test/airtable-sync.test.ts`. |

No J-row is GAP or STAGE-2 in this pass, including J5's bonus sub-bullet
(now independently traced end-to-end, not merely asserted).

---

## (2) SPEC §5 invariants (SPEC.md:290–302)

| Invariant | Status | Citation |
|---|---|---|
| Status pipeline literal set | VERIFIED | `src/domain/status.ts`; `test/api-submissions.test.ts:66` |
| Status changes never send email | VERIFIED | Behavioral: `test/spec9-invariants.test.ts:58-69` |
| Contact → participant → public three-gate ladder never collapsed | VERIFIED | `src/server/repo/public/gates.ts:25` (`visibleSessionConditions`), separate `visibleParticipantConditions`/`visibleSubmissionConditions` in the same file — distinct predicates, ANDed only at the point of use, never merged into one flag |
| `close_date` past ⇒ new submissions rejected + unaccepted-speaker edits locked; accepted keep editing | VERIFIED | `src/routes/public/submit.tsx:417-423,473-479,561-567` (`formWindowState` gate on GET/save-draft/POST); `src/domain/edit-lock.ts:11` |
| Acceptance auto-creation fires exactly once, idempotently | VERIFIED | `src/server/repo/submissions/status.ts:254` (first-transition guard); `src/domain/acceptance.ts:120` `planAcceptance` |
| Stable IDs / record prefixes / .ics UIDs never churn | VERIFIED | `src/domain/ids.ts` `formatRef`; `src/mail/ics.ts` `uidFor(...)`, tested `test/compose-ics.test.ts` |
| Files: `previous_file_id` version chains, full downloadable history | VERIFIED | `src/db/schema.ts:545,552`; `src/server/repo/files-versions.ts` |

---

## (3) SPEC §6 (SPEC.md:306–320)

Per DEC-428, SPEC.md:308 now reads "100,000 iterations, the workerd
production ceiling; DEC-004/DEC-237" — this row is closed, not reopened.

| Item | Status | Citation |
|---|---|---|
| PBKDF2-SHA256, 100,000 iterations (DEC-004/DEC-237 amendment, DEC-428 SPEC sync), constant-time compare, session rotation | VERIFIED | `src/auth/password.ts:1-8` (module comment states the 100k ceiling and the self-describing hash format); session rotation `test/auth.test.ts` |
| CSRF: custom-header on JSON, token on plain-form posts | VERIFIED | `src/server/middleware.ts:247` `csrfJson`, `:256` `csrfForm` |
| Authz middleware role+event grant, object-level ownership on every fetch-by-id | VERIFIED | `src/server/middleware.ts` `requireOrganizer`/`requireReviewer`/`requireSpeaker`; IDOR: `test/task-file-access.test.ts` "403s for another speaker (IDOR)" |
| Server-side filtering for public/anonymized data, never CSS-hidden | VERIFIED | `src/server/repo/public/gates.ts` — SQL WHERE conditions |
| Upload allowlist, size caps, no HTML content-type | VERIFIED | `src/domain/files.ts:18` ("Never an HTML..."), `:55` allowlist |
| Parameterized queries only (Drizzle) | VERIFIED | Repo-wide Drizzle usage, no raw SQL concat in `src/server/repo/` |
| Rate limits on auth AND public submission (incl. save-draft) | VERIFIED | Auth: `src/routes/auth.tsx` scoped limiter; submit: `src/routes/public/submit.tsx:576-582`; **save-draft: `src/routes/public/submit.tsx:484-492`** (see re-check section above — this is the closed GAP), tested `test/submit-draft-limits.test.ts:169-193` |
| Server-side form-schema validation (never trusts client rendering) | VERIFIED | `src/forms/validate.ts`, tested `test/submit-core.test.ts` |
| Portal-profile free-text length caps | VERIFIED | `src/routes/portal/profile.tsx:279-302` (see re-check section above — this is the closed GAP), tested `test/portal-profile-limits.test.ts:85-121` |

---

## (4) SPEC §7/§8 (SPEC.md:322–368)

| Item | Measurable in stage 1? | Status | Citation |
|---|---|---|---|
| Admin API reads p95 <50ms / writes <100ms server time | Yes, locally | VERIFIED (mechanism, CI-enforced) | `scripts/perf-smoke-lib.ts:18` `PERF_CLASS_BUDGET_MS`; `test/perf-smoke.test.ts`; CI `perf-smoke` job |
| One round trip per view | Yes | VERIFIED | `src/routes/api/overview.ts` single joined payload |
| Public pages: Cache-Control+SWR, purge on write | Cache mechanics yes; true edge-hit TTFB is stage-2 | VERIFIED (mechanics) / STAGE-2 (edge-hit number) | `publicCacheMiddleware` in `src/routes/public/index.tsx`; purge `test/pubcache.test.ts`; edge TTFB requires a deployed CF edge, per SPEC.md:59-63 |
| Smart Placement on | STAGE-2 only | STAGE-2 | SPEC.md:59-63 lists production edge-cache validation under stage-2; Smart Placement is a `wrangler deploy`-time setting |
| High-frequency actions optimistic + loud rollback | Code-level yes; UX-latency measurement is not | VERIFIED (mechanism) | `app/src/pages/Agenda.tsx:46-63` `handlePlace`/`handleUnschedule` — set state optimistically, `catch` reverts to `previous` and calls `setError(...)` |
| Nav interactive <300ms | Structural mechanism yes; live timing not unit-testable | VERIFIED (mechanism), not independently timed | Every route is `React.lazy`-loaded (`app/src/App.tsx:11-38` `pageLoaders`); this build's per-route chunks are 0.35–40 kB gz (see STEP 0 build output below), well under any budget that would threaten a 300ms interactive target on a warm connection — the actual wall-clock number requires a browser perf harness (§9's "persona walkthroughs" layer), out of scope for a unit-test ledger |
| Prefetch route data on hover/focus | Yes | VERIFIED | `app/src/App.tsx:117-133` `NavLinks` — `onMouseEnter`/`onFocus` both call `prefetch(section.path)`, which resolves the same `pageLoaders` thunk map (`:73-75`) used for the lazy import, so hovering/focusing a nav link warms that route's chunk before click |
| D1 indexes on every FK + (event_id,status) + (event_id,slug) | Yes | VERIFIED | `src/db/schema.ts` — `event_slug_idx` (`:120`), `file_previous_file_id_idx` (`:552`), and the broader index set; tested `test/schema-fk-indexes.test.ts` |
| Server pagination + filtering; thumbnailed headshots w/ cache headers | Yes | VERIFIED | `test/pagination.test.ts`, `test/public-speakers-pagination.test.ts`; headshot serve `Cache-Control` at `src/routes/portal/profile.tsx:411-425` (`headshotServeRoutes`, immutable for public, private for gated) |
| SPA code-split by route, initial bundle <300KB gz | Yes | VERIFIED | `scripts/bundle-check-lib.ts:5` `BUDGET_BYTES = 300*1024`; this run's main entry `index-Cw320nsK.js` 183.82 kB / gzip 59.96 kB |
| CI perf smoke against 2k-row seed | Yes | VERIFIED | `.github/workflows/ci.yml` `perf-smoke` job; `scripts/perf-seed.ts` |
| §8: `npm i && npm run db:migrate && npm run seed && npm run dev` | Yes | VERIFIED | `package.json:7-11` scripts present verbatim; `README.md` quickstart matches |
| §8: `npm run deploy` | STAGE-2 | STAGE-2 | No `"deploy"` script exists (`grep '"deploy"' package.json` = 0 matches); SPEC.md:59-63 explicitly defers this |
| §8: seed doubles as grader package, README lists creds | Yes | VERIFIED | `README.md:135` `## For evaluators` section present |
| §8: GitHub public repo MIT, CI typecheck+unit tests | Yes | VERIFIED | `LICENSE` present; CI `build-and-test` job runs `npm run build` then `npm test` |

---

## (5) SPEC §9 four unit invariants (SPEC.md:381–383)

| Invariant | Test file | What it asserts |
|---|---|---|
| Close-date lock | `test/edit-lock.test.ts` | Pending+closed not editable; accepted+closed remains editable; null close date never closes |
| Speaker isolation (cross-account IDOR) | `test/task-file-access.test.ts` | "403s for another speaker (IDOR)" — a same-role, different-contact speaker is denied a task file via the real route handler |
| Hidden-speaker exclusion | `test/headshot-gate.test.ts` | "404s unauthenticated when the speaker isn't publicly visible (pending/hidden)" against the same `visibleSubmissionConditions()`-family gate every public query uses |
| Decision (status change) ≠ email | `test/spec9-invariants.test.ts:58-69` | Fake-db touched-tables assertion: `updateSubmissionStatuses` never touches `schema.emailLog`, only `schema.submission`, on a plain (non-accepting) status change |

All four exist and are behavioral, not filename-only, in this tree.

---

## (6) DEFERRED-TO-STAGE-2 list (deliberate, per SPEC §0, SPEC.md:59-63)

- Cloudflare provisioning (D1/R2/KV, cron) for a live deployment.
- `wrangler deploy` / `npm run deploy` (script does not exist — correct).
- Resend API key + real email delivery; stage 1 uses the dev-sink mailer
  port + `/dev/mailbox` viewer.
- Production edge-cache validation and perf measurement (true CDN-hit TTFB;
  Smart Placement's effect).
- Airtable one-way sync going live against a real base (code path exists
  and is tested against a fake client, `test/airtable-sync.test.ts`).
- Domain/DNS, CI deploy pipeline.
- Sessionboard importer (SPEC §3: explicitly not buildable without their
  API key, roadmap item only).

---

## STEP 0 — build/test at this sha

- `npm run build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
  vite build --config app/vite.config.ts`): **PASS**, 0 errors. Main SPA
  entry `index-Cw320nsK.js` 183.82 kB / gzip 59.96 kB (well under the
  300KB gz budget).
- `npm test --silent`: **PASS — 268 test files / 2235 tests**, 0 failures.

---

## OPEN ITEMS

None. The two `task-w11-f` GAPs (save-draft rate limit, portal/profile
length caps) are both fixed in this tree with dedicated behavioral tests
(`test/submit-draft-limits.test.ts`, `test/portal-profile-limits.test.ts`).
J5's reviewer-feedback bonus, optimistic-UI-with-rollback, nav prefetch on
hover/focus, and the nav-interactive-<300ms mechanism (code-splitting) are
all traced to specific citations above, not left as "not independently
re-verified" the way the prior ledger left them.

OPEN ITEMS: 0

RESULT: PASS
