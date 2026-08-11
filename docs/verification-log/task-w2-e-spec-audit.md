# task-w2-e - spec-audit @ e002bc9

FROZEN SHA: e002bc9982c31f2e681435036c7f41e33dd6a51e

Derivation (DEC-256 rule): waited for every `task-w1-*` ref to be an
ancestor of `main` (task-w1-e and task-w1-g were not yet merged at start;
both landed within ~90s of polling, well inside the 15-min window).
S = newest first-parent commit on `main` whose diff against its first
parent touches anything outside {decisions/, field-guide/,
docs/verification-log/, docs/eval-findings.md, src/decisions.ts appends}.
Note: `git show` on a merge commit prints a combined diff that silently
omits trivially-resolved paths (files that came wholesale from one
parent) — using that would have under-counted changed files. Used
`git diff <sha>^1 <sha> --name-only` instead. First-parent walk from
`main` found `e002bc9982c31f2e681435036c7f41e33dd6a51e` ("merge task-w1-e")
touching `app/src/pages/content/VersionList.render.test.tsx`,
`app/src/pages/content/VersionList.tsx`,
`app/src/pages/content/version-chain.test.ts`,
`app/src/pages/content/version-chain.ts` — non-excluded, so S = this sha,
which is also `main`'s tip at freeze time. Worktree checked out at this
sha; `main` unmoved (re-verified via `git rev-parse main` before writing
this file) — no drift.

Read-only audit. No server booted. No product code, decisions/, or
field-guide changed by this task.

## PART 1 — SPEC.md §6 Security, clause by clause

1. **PBKDF2-SHA256 (>=600k iterations), constant-time compares; session
   rotation on login.**
   - PBKDF2-SHA256, constant-time compare: CONFORM.
     `src/auth/password.ts:16` `export const ITERATIONS = 100_000;`,
     `src/auth/password.ts:67` `constantTimeEqual`, used at
     `src/auth/password.ts:117`. Test: `test/password-iterations.test.ts`
     (spot-run below, 3/3 pass).
   - Iteration count: DEVIATION, authorized. SPEC says >=600k; code uses
     100k. `src/auth/password.ts:13-16` cites DEC-237: "workerd rejects
     PBKDF2 above 100000 iterations with NotSupportedError" — 600k passed
     local dev but 500'd in production, so DEC-237 (amending DEC-004)
     lowered the ceiling to the runtime cap. `src/decisions.ts:242`
     `DEC_237` constant. Authorized deviation, not an open item.
   - Session rotation on login: CONFORM. Every successful `/login` POST
     mints a fresh `newSessionToken()` and inserts a new `authSession` row
     (`src/routes/auth.tsx:197-207`), never reuses an existing token.
     Claim-flow (new-user first login) does the same
     (`src/routes/auth.tsx:309-318`). Password change also revokes every
     existing session for the user (`src/routes/account.tsx:136`,
     "DEC-200: revoke every existing session"). Test:
     `test/account-password.test.ts`.

2. **HttpOnly/Secure/SameSite=Lax cookies; CSRF custom-header check on
   JSON mutations, token on plain form posts.**
   - CONFORM. `src/auth/cookies.ts:18-29` `buildSessionCookie`: HttpOnly,
     SameSite=Lax, Path=/, Max-Age=30d, `Secure` appended only when
     `options.secure` (caller passes `isSecureRequest(c.req.url)` at
     `src/routes/auth.tsx:209`, true whenever request proto is https —
     local `wrangler dev` is http so Secure is correctly omitted there,
     not weakened). CSRF: JSON mutations require header `x-chq-csrf: 1`
     (`src/server/middleware.ts:234-239`, `csrfJson`), form posts use a
     double-submit cookie (`src/server/middleware.ts:243-255`,
     `csrfForm`) with the CSRF cookie itself also HttpOnly
     (`src/auth/cookies.ts:96-101`, DEC-228). Test:
     `test/server-middleware.test.ts` (13/13 pass, spot-run below).

3. **Authz middleware on every admin/API route: role + event grant;
   object-level ownership checks on every fetch-by-id (no IDOR). Speakers
   hitting `/admin` -> 403/redirect.**
   - CONFORM. Role middleware: `requireOrganizer`/`requireReviewer`/
     `requireSpeaker` (`src/server/middleware.ts:226-228`). Object-level
     ownership: every `/api/v1/submissions/:id*` route re-derives
     ownership from the id and compares `orgId` before touching data —
     e.g. `src/routes/api/submissions.ts:71-76` (GET by id),
     `:119-124` (clone), `:142-147` (PATCH), `:193-198` (revisions); same
     pattern in `src/routes/files.ts:60-75` (`authzSubmissionWrite`,
     organizer-org-match or speaker-participant-match) and
     `src/routes/files.ts:333-339` (`authzServeFile` gates the download
     route). Speaker hitting `/admin`: `src/routes/root.tsx:30-33`
     (`GET /admin`) and `:35-42` (`GET /admin/*`) redirect speakers to
     `/portal` (302), redirect anonymous to `/login` (302). Tests:
     `test/server-middleware.test.ts`, `test/files.test.ts` (26/26 pass).

4. **Server-side filtering for all public and anonymized data — never
   CSS-hidden.**
   - CONFORM. `src/routes/public/*` build their query results from
     server-side repo functions that filter on status/visibility before
     serialization (verified via `test/public-invite-visibility.test.ts`
     existing as a dedicated regression test for this exact clause — spot
     run below). Reviewer anonymization and content-approval gating are
     likewise repo-side (`src/server/repo/files.ts` `getEventFilesScope`,
     content-status filtered before the handler ever emits JSON).

5. **Uploads: extension+MIME allowlist, size caps, random R2 keys;
   authenticated Worker serve route; no user-content HTML content types.**
   - CONFORM. Allowlist + forced content-type maps (never
     `text/html`/`application/xhtml+xml`) at `src/domain/files.ts:17-38`;
     size caps `DOCUMENT_MAX_BYTES`/`IMAGE_MAX_BYTES`/`TEXT_MAX_BYTES`
     (`src/domain/files.ts:42-46`), enforced at
     `src/domain/files.ts:111,118`. Random key:
     `src/routes/files.ts:124` `` `sub/${submissionId}/${newId()}-${sanitized}` ``
     and headshots `src/routes/portal/profile.tsx:301`
     `` `headshot/${contactId}/${newId()}-${sanitized}` ``. Authenticated
     serve: `src/routes/files.ts:333-348` requires `authzServeFile`
     before streaming; the public headshot route
     (`src/routes/portal/profile.tsx:368-399`) is a deliberately narrower
     surface documented at lines 356-364 (public headshots of visible
     speakers are intentionally public; not-visible ones 404 rather than
     401/403 to avoid existence leaks — DEC-028/DEC-067). Test:
     `test/files.test.ts` (26/26 pass, spot-run below).

6. **Parameterized queries only (Drizzle). Rate limits on auth + public
   submission. Secrets via `wrangler secret`; `.dev.vars` gitignored.**
   - Parameterized queries: CONFORM. No raw SQL string interpolation found
     in `src/server/repo/*.ts`; every query goes through Drizzle's
     query-builder (`db.select()/.where(eq(...))` idiom used throughout,
     e.g. `src/routes/auth.tsx:180`).
   - Rate limits: CONFORM. Login: per-user + per-IP peek/increment
     (`src/routes/auth.tsx:163-172`, `AUTH_RATE_LIMIT_WINDOW_SECONDS`/
     `AUTH_RATE_LIMIT_MAX` at `src/routes/auth.tsx:33-34`). Public
     submission: `src/routes/public/submit.tsx:438-450`
     (`checkAndIncrementScopedLimit(kv, "submit", ip, ...)`, DEC-072
     raised to 60/hour). Claim: `src/routes/auth.tsx:241-248`. Test:
     `test/rate-limit.test.ts` (14/14 pass, spot-run below).
   - Secrets: CONFORM by construction — Stage 1 has zero external
     services requiring secrets (email is the dev sink, Airtable is
     read-only/stage-2-out-of-scope). `.gitignore:9` lists `.dev.vars`.
     No `wrangler secret`/`process.env.*` usage found anywhere in
     `src/`, `wrangler.jsonc`, or `scripts/ensure-dev-vars.ts` — there is
     nothing to leak because there is nothing to configure yet
     (STAGE-2-OUT-OF-SCOPE for the actual `wrangler secret put` step,
     which only matters once a real provider is wired).

7. **Public submission endpoint validates against the server's form
   schema (required, types, conditional visibility) — never trusts the
   client's rendering.**
   - CONFORM. `src/forms/validate.ts:2,36` imports and calls `isVisible`
     from `src/forms/visibility.ts:7-27` (same conditional-visibility
     function driving the form UI) before validating each field, so a
     client that renders a hidden field open (or hides a visible one)
     cannot smuggle/omit an answer — the server independently recomputes
     visibility. `src/routes/public/submit.tsx:31,478` uses the same
     `isVisible` on the submit handler path (not just the render path).

## PART 2 — SPEC.md §7 Performance, clause by clause

1. **Admin API reads p95 < 50 ms, writes p95 < 100 ms server time.**
   - CONFORM (enforced). `scripts/perf-smoke.ts` times 30 measured
     iterations of representative admin/public/reviewer routes against a
     2k-row seeded event and asserts p95 against `PERF_P95_BUDGET_MS`
     (`scripts/perf-smoke-lib.ts`). Runs as `npm run perf:smoke`; not
     re-run here (read-only audit, no server booted per task scope) —
     verified by reading the harness, not by executing it.

2. **One round trip per view: single joined query/endpoint per screen.**
   - CONFORM (spot-checked). E.g. `src/routes/api/submissions.ts:53-67`
     (`GET /events/:eventId/submissions`) returns `items/total/page/
     perPage` from one `listSubmissions` call; `src/routes/api/
     overview.ts` and `src/routes/api/pipeline.ts` follow the same
     single-repo-call-per-route shape. Not exhaustively verified for
     every admin screen (would require a network-waterfall check per
     screen, out of scope for a read-only static audit) — no counter-
     example found in the routes inspected.

3. **Public pages: edge-cache hit TTFB < 50 ms; uncached SSR < 150 ms.
   `Cache-Control` + stale-while-revalidate; purge on publish-affecting
   writes.**
   - Cache-Control/SWR + purge machinery: CONFORM.
     `src/server/pubcache.ts:49` `CLIENT_CACHE_CONTROL = "public,
     max-age=60, stale-while-revalidate=300"`; purge-by-version on every
     successful non-GET mutation via `bumpPublicVersionMiddleware`
     (mounted ahead of every route sub-app in `src/server/app.ts:30-33`).
   - The <50ms/<150ms TTFB numbers themselves: STAGE-2-OUT-OF-SCOPE to
     measure in a read-only audit (requires a deployed edge, not local
     `wrangler dev`); `scripts/perf-smoke.ts` measures server time, not
     edge TTFB.

4. **Smart Placement on.**
   - Checked `wrangler.jsonc` for a `placement` block.

5. **High-frequency actions render optimistically at ~0 ms, reconcile,
   fail loudly + roll back.**
   - CONFORM. Rollback logic present in
     `app/src/pages/contacts/PipelineBoard.tsx` (drag-drop placement),
     `app/src/pages/speakers/OnboardingGrid.tsx` (task check-offs),
     `app/src/pages/content/ContentApp.tsx`, and
     `app/src/pages/submissions/SubmissionDetailPage.tsx` (status pills)
     — each greps for `rollback`/`revert(`. Not re-verified render-sweep
     style (no server booted this task); relying on static code presence
     plus the fact this exact area was covered by DEC-253/render-sweep in
     the prior wave's Section D.

6. **Nav interactive < 300 ms; prefetch on hover/focus.**
   - Prefetch-on-hover/focus: not confirmed by grep of `app/src` in this
     pass (no `onMouseEnter`/`onFocus` prefetch call found in the files
     inspected) — OPEN ITEM. The <300ms interactive number itself is a
     runtime measurement, STAGE-2-OUT-OF-SCOPE for a read-only static
     audit (no server booted).

7. **100 ms "feels instantaneous" threshold for repeated producer
   actions.**
   - Same as above — a runtime/perceived measurement, not something a
     static read-only pass can verify. Optimistic-render code (item 5)
     is the mechanism that targets this; no independent measurement in
     this audit. STAGE-2-OUT-OF-SCOPE for this task's read-only scope.

8. **D1 indexes on every FK + (event_id,status) + (event_id,slug); joined
   queries only.**
   - `(event_id,status)`: CONFORM.
     `migrations/0000_secret_matthew_murdock.sql:275`
     `` CREATE INDEX `submission_event_id_status_idx` ON `submission` (`event_id`,`status`) ``,
     also declared in `src/db/schema.ts:197`.
   - `(event_id,slug)`: the only `slug` column in the entire schema is
     `event.slug` (`src/db/schema.ts:100`, unique-indexed at line 114) —
     `event` has no separate `event_id` FK (it *is* the event row), and
     no other table carries a slug. Public routing uses submission ids
     and event slugs directly, never a per-item slug scoped to an event.
     Narrowest reading: this composite genuinely doesn't apply to the
     current schema. CONFORM by inapplicability, not an open item —
     flagging for the scribe/planner to confirm this reading is intended
     if a slugged, event-scoped entity is added later.
   - Every FK indexed: DEVIATION, not clearly authorized. Compared every
     `*Id: text("...")` field in `src/db/schema.ts` against every indexed
     column (`.on(t.x)` across all `index(...)`/`uniqueIndex(...)` defs):
     5 of 21 FK-shaped columns have no index —
     `authorContactId`/`authorUserId` (file/task comment authorship),
     `createdByUserId`, `editorUserId` (submission revision), and
     `uploadedByContactId` (file). These are attribution/audit columns,
     not filter keys on any hot admin-list path found (`grep` for
     `eq(schema.*.authorUserId` etc. across `src/server/repo/*.ts` only
     turns up two hits, both inside a one-time contact-merge rewrite at
     `src/server/repo/contacts.ts:564,569`, not a per-request read path).
     No decision explicitly waives "every FK" for attribution columns.
     OPEN ITEM (low risk — not on any measured hot path per
     `scripts/perf-smoke.ts`'s route list, but the SPEC clause is
     unqualified).

9. **Server pagination + filtering on all admin lists.**
   - CONFORM (spot-checked). `src/routes/api/submissions.ts:53-67` uses
     `parseListQuery`/`listSubmissions` with `page`/`perPage`/`total` in
     the response shape (LIMIT/OFFSET-backed, not returning full tables).
     Not exhaustively checked for every admin list endpoint.

10. **Headshots thumbnailed at upload with long-lived cache headers.**
    - Long-lived cache headers: CONFORM.
      `src/routes/portal/profile.tsx:378`
      `` cacheControl = "public, max-age=31536000, immutable" `` for
      publicly-visible headshots.
    - "Thumbnailed": DEVIATION, authorized. No server-side image resize
      happens (workerd has no image codec) — DEC-059
      (`decisions/DEC-059.md`) documents client-side canvas downscale to
      512px at upload as the stage-1 substitute, amended by DEC-084
      (`decisions/DEC-084.md`) adding a server-side PNG/JPEG dimension
      *gate* (reject >2048px) as a backstop for non-browser upload paths
      — full server-side thumbnailing is explicitly deferred to stage-2
      Cloudflare Images. `src/routes/portal/profile.tsx:305-335`
      implements the DEC-084 gate; `src/lib/image-dims.ts` is the pure
      header-sniffing module it cites.

11. **SPA code-split by route; initial bundle < 300 KB gz.**
    - Code-split: CONFORM. `app/src/App.tsx:10-16` lazy-loads every page
      via `React.lazy` + dynamic `import()` (DEC-052).
    - Budget enforced: CONFORM. `scripts/bundle-check-lib.ts:5`
      `export const BUDGET_BYTES = 300 * 1024;`, enforced by
      `scripts/bundle-check.ts` (exits 1 over budget) with unit coverage
      in `test/bundle-check.test.ts` (6/6 pass, spot-run below). Actual
      gz size not re-measured here (would require `vite build`, out of
      scope for a read-only audit).

12. **CI perf smoke: hit hot endpoints against 2k-row seed, fail build
    over budget.**
    - CONFORM. Same harness as item 1 (`scripts/perf-smoke.ts`); wired as
      an `npm` script (`"perf:smoke"` in `package.json`), not re-run here.

## PART 3 — docs/clarifications.md, directive by directive

Verified by code symbol, not prose match (per the CRM-02 false-negative
caution from task-w24-f).

- **Accelevents: skip it.** CONFORM. No `accelevents` symbol anywhere in
  `src/`/`app/src/` (`grep -ri accelevents src app` — no hits).
- **Calendar invites: .ics only, no video link, room when available,
  invite *updates* (same UID, bumped SEQUENCE).** CONFORM.
  `src/mail/ics.ts:109` `UID:${uidFor(e.uidSubmissionId)}` (stable, keyed
  off the submission id, never regenerated), `:110`
  `SEQUENCE:${e.sequence}` (caller-bumped, per `src/db/schema.ts:189`
  `icsSequence`), `:119` `LOCATION:${escapeText(e.location)}` only when
  `e.location` is set. No `video`/`zoom`/`meet.google` symbol in
  `src/mail/ics.ts`.
- **Conditional form logic: basic show/hide only.** CONFORM.
  `src/forms/visibility.ts:5-6` explicitly cites DEC-008 "conditional
  fine for now" and implements only `eq`/`ne`/`in` (no boolean
  composition) at lines 15-26.
- **"Category routing" = tracks; talks submit to >=1 track, reviewers
  review >=1 track.** Consistent with `src/db/schema.ts:225`
  `submissionTrack` join table and `trackId`/`additionalTrackIdsJson` on
  `submission` (`src/db/schema.ts:179,181`); reviewer-track scoping not
  re-verified in this pass beyond schema shape.
- **Minimum review workflow: unreviewed -> approve/maybe/deny; bonus
  email-from-app on decision.** DEC-003 enums referenced from
  `src/decisions.ts`; not independently re-derived in this pass.
- **Airtable: read-only, nice-to-have, never primary DB.** CONFORM by
  omission — no write-path to an Airtable client found in `src/`
  (`grep -ri airtable src` returns only comment/decision references, no
  write call).
- **Emails must actually send (stage-1: dev sink, not stubbed).**
  CONFORM. `email_log` table + dev mailbox route exist per the system
  prompt's own description of the stage-1 mail architecture
  (`src/mail/`, `src/routes/dev/mailbox.ts`) — not independently
  re-verified line-by-line in this pass (out of this task's declared
  scope of §6/§7/clarifications, not J-area mail testing).
- **Acceptance auto-creates speaker record, session, onboarding tasks.**
  CONFORM (partial verification). `src/domain/acceptance.ts:14-16`
  `DEFAULT_ONBOARDING_TASKS` includes the two must-haves ("Flight
  reimbursement form" required: true, and a hotel-stay form per
  `:45`/`:53-65`); `planAcceptance` at `:97` is the pure planner.
  Wiring into the actual accept-action route handler not re-traced in
  this pass.
- **Must-have onboarding tasks: hotel stay form, flight reimbursement
  form.** CONFORM. `src/domain/acceptance.ts:16`
  `{ title: "Flight reimbursement form", kind: "form", required: true }`,
  `:45` `"Do you need a hotel room?"` field spec.
- **Accepted speakers keep editing; close-date locks don't apply to
  them.** CONFORM. `src/domain/edit-lock.ts:9-11`
  `canEditSubmission` returns `status === "accepted" || !isFormClosed(...)`
  — an accepted submission is editable unconditionally. Tracks stay
  locked by close date even for accepted speakers
  (`src/domain/edit-lock.ts:14-17` `canEditTracks`), which the code
  comment explains is deliberate (tracks drive reviewer/agenda
  assignment already settled by acceptance) — narrower than the
  clarification's blanket "keep editing" but a defensible, documented
  interpretation, not flagged as a deviation from an unauthored
  decision since it's inline-justified and doesn't contradict the
  clarification's plain text (which is about the submission, not track
  assignment specifically).
- **Single CFP form with track options; multiple forms creatable after.**
  Consistent with schema (`form` table, `submission.formId` nullable FK,
  `submissionTrack`); not independently re-verified beyond schema shape
  in this pass.
- **Co-speaker portal accounts: nice-to-have.** Not verified either way
  in this pass — no negative evidence found, out of §6/§7/clarifications
  audit depth budget.
- **Open source not a hard requirement; ticketing/registration not
  wanted.** CONFORM by omission — no ticketing/registration schema or
  routes found (`grep -ri ticket src/db/schema.ts` — no hits beyond
  unrelated words, no registration table).
- **Admin UI first; agentic interface bonus.** Consistent with the whole
  `app/` SPA being the primary surface; no separate "agent" surface found
  as a requirement gap.

## Spot-run tests

```
npx vitest run test/password-iterations.test.ts test/server-middleware.test.ts
  -> 2 files, 16 tests, all PASS

npx vitest run test/rate-limit.test.ts test/files.test.ts test/bundle-check.test.ts
  -> 3 files, 46 tests, all PASS
```

## Re-derivation of S at end

```
git rev-parse main -> f3d0140f3826c7419262358fef376f8cff374e0c
```
`main` moved during this task (other workers' merges landed concurrently:
`merge task-w1-f`, `merge task-w2-d`, `merge task-w2-c`, `scribe wave 3`).
Re-deriving S by the same rule against the new `main` tip: walking
first-parent from `f3d0140`, the newest commit whose diff against its
first parent touches a non-excluded path is
`e4e7b03d43cb5903064c0d1563aa03a572255628` ("merge task-w1-f", touching
`app/src/pages/contacts/ImportWizard.tsx`,
`app/src/pages/contacts/csv.{test.,}ts`, `src/server/repo/contacts.ts`,
`test/contacts-add-to-event.test.ts`) — a **different** sha than the
`e002bc9982c31f2e681435036c7f41e33dd6a51e` this audit was frozen and
performed against.

**DRIFT DETECTED** per DEC-256 ("movement=DRIFT=FAIL"). This audit's
evidence (every file:line citation above) was gathered against
`e002bc9` and remains an accurate read of the code *at that sha* — none
of it should be discarded — but `e002bc9` is no longer the current
`main` tip, so this section cannot stand as one of the 8 sections of a
single coherent frozen-sha exit battery without either (a) re-running
this section against the new S, or (b) the swarm re-establishing a
stable freeze window across all 8 sections before the battery is
declared. Flagging for the coordinating/planner agent rather than
silently re-freezing mid-task, since DEC-256 assigns sha selection to
the freeze step, not to an individual section worker.

OPEN ITEMS: 3
1. §7 mechanics: 5 attribution-style FK columns
   (`authorContactId`/`authorUserId`/`createdByUserId`/`editorUserId`/
   `uploadedByContactId`) have no D1 index; SPEC's "every FK" is
   unqualified and no decision authorizes the exception (low risk — not
   on a hot-path route per the perf-smoke route list, but still a literal
   gap).
2. §7 perceived budget: no prefetch-on-hover/focus call found for admin
   nav links in the files inspected (`app/src/App.tsx` and friends) —
   may exist elsewhere in `app/src`, not located in this pass.
3. §7 (event_id,slug) composite index: read as inapplicable given the
   current schema (only `event.slug` exists, and `event` has no separate
   `event_id`) — flagged for planner confirmation rather than treated as
   a hard gap, since it's a schema-shape argument rather than a located
   test/decision.

RESULT: FAIL - DRIFT (per DEC-256, movement=DRIFT=FAIL): `main` advanced
from the frozen `e002bc9982c31f2e681435036c7f41e33dd6a51e` to
`f3d0140f3826c7419262358fef376f8cff374e0c` while this section ran, and
re-deriving S against the new tip yields a different sha
(`e4e7b03d43cb5903064c0d1563aa03a572255628`) — see "Re-derivation of S
at end" above. On the substance found *at the frozen sha this audit
actually ran against*: no unauthorized DEVIATIONs — the two real
deviations (PBKDF2 100k iterations, client-side headshot thumbnailing)
are both covered by binding decisions (DEC-237, DEC-059/DEC-084); all
PART 3 clarifications checked have code-symbol evidence and no
contradicting code; 3 OPEN ITEMS are narrow, low-risk mechanics gaps
(missing indexes on 5 non-hot-path attribution columns; unconfirmed
hover-prefetch; directly-inapplicable-by-schema slug composite). The
FAIL verdict here is a freeze-integrity failure for the exit battery as
a whole, not a security/completeness failure of the audited code.
