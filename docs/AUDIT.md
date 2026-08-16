# Self-audit

Per `docs/mandates/steal-mandate.md` §4 / `decisions/DEC-618.md`: an honest, current
account of what each SPEC.md area actually does in this tree today, what is capped or
degraded (and by how much), what is deliberately not built, and what is stage-2 platform
wiring the operator owns rather than the product. `test/audit-claims.test.ts` enumerates
every route path named below against `app/src/routeManifest.ts` (the same manifest
`scripts/render-sweep.ts` walks) so this document cannot silently drift from the routes
that actually exist — a route mentioned here that stops resolving, or a route added to the
app that nobody documents here, fails that test.

Route paths below are written as patterns (`:id`, `:eventSlug`, etc.) rather than the
literal seeded ids the manifest resolves them to for the render sweep.

## J1 — Launch a CFP (`/admin/settings`, `/admin/overview`)

Event creation, dates/timezone, tracks, rooms, branding (logo/accent color), and the
public CFP form builder live under `/admin/settings`. `/admin/overview` is the producer's
landing dashboard. Both fully built, no caps beyond the general list caps below.

## J2 — Submit without friction (`/submit/:eventSlug`)

Public CFP form, built from the organizer's form schema (`src/forms/`), with per-field
validation (`MAX_TEXT_LENGTH`=2000, `MAX_LONG_TEXT_LENGTH`=20000, `MAX_NAME_LENGTH`=200,
`MAX_RICH_TEXT_LENGTH`=100000 in `src/forms/validate.ts`) and up to `MAX_FORM_FIELDS`=200
fields per form (`src/server/repo/forms.ts`). Built.

## J3 — Triage submissions (`/admin/submissions`, `/admin/submissions/forms`, `/admin/submissions/delete`, `/admin/submissions/:id`)

List, filter, bulk status change, saved views. Built. List queries and bulk ops are
capped like every other list in this app — see "Pagination and list caps" below.

Session delete (DEC-886) is a guarded cascade behind a confirmation page at
`/admin/submissions/delete` (`app/src/pages/submissions/DeleteSubmissionsPage.tsx`,
mirroring `/admin/contacts/merge`'s "irreversible action gets a page" convention) — the
selected ids travel in the query string. `POST /api/v1/events/:eventId/submissions/delete`
(`src/server/repo/submission-delete.ts`) refuses any submission carrying at least one
SUBMITTED evaluation, and refuses (never 500s) an id belonging to another event; every
other id's submission_answer, submission_track, participant, file-request task
assignments, files (and their R2 objects), file_comment, review_recusal, revision,
evaluation, and plan_reviewer rows are removed, then the submission row itself.
`email_log` rows are historical fact and are never touched.

## J4 — Committee review (`/admin/review`, `/admin/review/plans/new`, `/admin/review/plans/:planId`, `/admin/review/plans/:planId/progress`, `/admin/review/plans/:planId/results`, `/admin/review/plans/:planId/submissions/:submissionId`)

Evaluation plans, scoring, anonymized reviewer queue (`src/domain/evaluation.ts`
`anonymizeForReviewer`), progress/results rollups. Built for both the organizer plan tree
and the reviewer's own queue/scorecard tree (same paths, role-gated).

**Not the steal-mandate's literal ask, by deliberate design (DEC-624):** the mandate's
item 2 asks for an assignment-time snapshot of the anonymize flag; this tree instead reads
`evaluation.anonymized` live off the plan (`src/db/schema.ts:307`) and enforces a monotone
ratchet — an organizer may always turn anonymization ON, but turning it OFF is refused with
a 409 (naming the count) once any evaluation has been submitted under that plan. This
delivers the same integrity property the snapshot would (a reviewer who wrote under a
promise of anonymity can never be retroactively unmasked) without an additive migration or
a second source of truth for a flag DEC-596 already gives the plan. Not a gap; see DEC-624.

## J5 — Decide and notify (`/admin/submissions/:id`, comms compose)

Status changes are bulk or single, and are a distinct action from sending mail — no status
transition ever auto-sends email (this is a house invariant enforced across every status
route, not just this one). Comms composition, per-recipient preview, and template merge
fields are built (`/admin/comms`, `src/domain/compose.ts`). See the 100-recipient compose
cap below.

## J6 — Onboarding dashboard (`/admin/overview`, `/admin/speakers`, `/admin/speakers/:contactId`, tasks)

Task assignments (forms, uploads, acknowledgements), reminder cron, and the producer's
onboarding-progress dashboard are built. `/admin/speakers` is the accepted-speaker roster
(onboarding/task status per speaker, contact/profile drill-in). `/admin/speakers/:contactId`
(DEC-930) is the per-speaker detail page the roster's name cell links into: one bounded GET
carrying that speaker's sessions and task assignments, each row linking to its own submission
or deliverable. See the reminder cap and Overview row cap below.

## J7 — Speaker self-serve portal (`/portal`, `/portal/profile`, `/portal/submissions`, `/portal/submissions/:id`, `/portal/submissions/:id/edit`, `/portal/tasks`, `/portal/tasks/:assignmentId/form`, `/portal/resources`, `/portal/preview`)

Branded portal (logo/accent from event settings), submission edit within the organizer's
open-edit window, profile, and per-task forms/uploads. Built. `/portal/submissions` lists
every submission the speaker owns — pending and declined included, newest first, each with
its DEC-016 public status label — so a speaker can track a submission that was never
accepted (DEC-729). `MAX_PARTICIPANTS_PER_SUBMISSION`=6
(`src/server/repo/portal-edit.ts`) caps co-speakers a speaker can add to their own
submission from the portal. `/portal/resources` (DEC-029, `src/routes/portal/tasks/resources.tsx`,
`src/server/repo/portal/resources.ts`) lists wiki notes and files, grouped by every event the
signed-in speaker participates in — scoped by contact id, never a query param, so a speaker
never sees another event's or another speaker's resources. `/portal/preview` (DEC-747
findings-wave-7 amendment, `src/routes/portal/preview.tsx`) is the one route in this section
that is NOT a speaker's page: it is the organizer-only, read-only preview behind the Speaker
portal settings section's "Open as a speaker" row, showing that event's own portal branding,
welcome message and resources and nothing scoped to a person (no submissions, tasks or
files). It does not use `speakerGate` — its guard is the inverse (organizer only), and every
other session (anonymous, reviewer, speaker) gets a 404, never a redirect, so the route is
invisible to the roles it is not for. Without an `?eventId=` belonging to the caller's org it
renders that same 404.

## J8 — Collect/review/approve content (`/admin/content`, `/admin/content/:submissionId`)

Per-session file uploads (typed: slides, headshot, bio, etc.), organizer approve/reject,
version history. Built. A single session's deliverables live at their own URL,
`/admin/content/:submissionId` (DEC-935) — linkable and back-button-correct, rather than
behind a query param on the worklist route. Files are served through an authenticated Worker route
(`src/routes/files.ts`), walked to the owning submission/event on every fetch — never
trusted from the URL alone (`src/server/repo/files-authz.ts`).

## J9 — Build the agenda (`/admin/agenda`)

Drag-and-drop scheduling, conflict detection (`src/domain/schedule.ts`'s typed
`conflicts[]`), and auto-schedule. Built, with the warn-never-block rule from
`decisions/steal-mandate.md` item 1 (also SPEC J9): the schedule always saves, conflicts
are reported, nothing is refused.

**Capped:** `runAutoSchedule` (`src/server/repo/agenda.ts`) persists at most
`MAX_AUTO_SCHEDULE_PLACEMENTS`=2000 new placements per run; beyond that the remaining
sessions simply stay unplaced (already surfaced via the agenda payload's unplaced count,
never thrown as an error).

**Steal-mandate item 1 (per-session unplaced reasons) is built:** `autoSchedulePlan`
returns `unplaced: UnplacedSession[]` (`src/domain/schedule.ts:400`), each item a typed
`UnplacedReason` (`src/domain/schedule.ts:66`) — `no_rooms_configured`,
`duration_exceeds_day`, `speaker_double_booked`, `no_free_slot` — rendered to prose by the
one renderer `describeUnplaced` (`src/domain/schedule.ts:89`). Not a bare count.

## Anonymous event hub (`/`)

`GET /` (`src/routes/root.tsx`) is the instance's anonymous landing page (DEC-582): a
signed-in organizer/reviewer visiting `/` is redirected to the admin shell, a signed-in
speaker to `/portal` — the same rule the admin shell already enforces in reverse. An
anonymous visitor sees
the org's own name and its events grouped by what a stranger may do (submit / browse / look
back), built entirely from the pure `src/lib/home-hub.ts`. No organizer-only metric (review
progress, submission counts) reaches any row here (DEC-581) — every field is one a
competitor could read without leaking anything.

## J10 — Publish to the public site (`/e/:eventSlug/sessions`, `/e/:eventSlug/sessions/:sessionId`, `/e/:eventSlug/speakers`, `/e/:eventSlug/speakers/:speakerId`, `/e/:eventSlug/gallery`, `/e/:eventSlug/agenda`, `/e/:eventSlug/schedule`, `/e/:eventSlug/programme`, `/embed/:eventSlug/sessions`, `/embed/:eventSlug/speakers`, `/embed/:eventSlug/gallery`, `/embed/:eventSlug/agenda`, `/embed/:eventSlug/schedule`, `/embed/:eventSlug/sessions/:sessionId`, `/embed/:eventSlug/speakers/:speakerId`)

Five public, mobile-friendly, no-login surfaces plus their embed twins (iframe
snippets from `/admin/settings`'s embeds panel). All public queries filter to
accepted+visible+content-approved server-side (never trust a client-side filter for what
is public). `/e/:eventSlug/schedule` also serves `.ics`. Built.

**Printable programme (`/e/:eventSlug/programme`, DEC-683 amendment):** a public,
no-login, print-first one-page rendering of the whole published programme (every day,
one sequence, sessions and breaks interleaved) with its own minimal shell — no nav, no
rail, no itinerary controls. A projection of the same visibility-gated reads every other
public surface uses (`getPublicAgenda` + `getPublicBreaksByDay`), never a new query.

**Capped:** every public list is bounded by `MAX_PUBLIC_PAGE`=100 and `PUBLIC_PER_PAGE`
(`src/server/repo/public/bounds.ts`) — `MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE * PUBLIC_PER_PAGE`
is the deepest row reachable via pagination or `?limit=`; deeper pages are not offered
(`hasMore` false past the ceiling), not silently truncated with no signal.

**Public edge cache (DEC-083, wave-70/wave-72 amendments):** every /e/* and
/embed/* GET is served through `caches.default`, keyed by URL plus a version token
read from Workers KV (`PUBVER_KEY = "chq:pubver"`). Publishing a change (accepting a
submission, moving an agenda slot, approving content, disabling an embed — anything
non-GET/HEAD/OPTIONS that isn't on the `never-public` allowlist) rewrites that token to
a fresh random value, which is a version swap, not a delete: the old cache key is
simply never looked up again, so purge is O(1) with no URL enumeration to run. Two
bounds an operator should know before treating "purge on publish" as instant or as
scoped:

- **~60s staleness window.** The version token itself is read from KV, and a Workers
  KV `get` cannot be edge-cached below 60 seconds. A colo that already cached the old
  token can keep computing the old (now-purged-in-spirit) cache key for up to that
  window after a publish, so a stale copy can still be served to anonymous visitors for
  up to ~60 seconds after the bump — this is a property of the KV read path, not of the
  stored copy's TTL (that TTL is a long 86400s and is safe precisely because the key
  itself changes on every version bump).
- **Instance-wide purge blast radius.** `PUBVER_KEY` is ONE key for the whole instance,
  not per-event and not per-org. A publish on event A's agenda rewrites the same key a
  publish on event B would rewrite, so it cold-caches every public and embed page of
  every OTHER event and org on the instance too, not just event A's. This is deliberate
  at stage 1, not an oversight: scoping the key per event would require resolving a
  slug (and, for embeds, an embed id) to its owning event on the anonymous read path
  this cache exists to protect — adding the very D1 lookup the cache is there to avoid
  — or threading a new context-variable protocol through roughly 40 mutating routes.
  The public surfaces already meet budget cold (15-98ms measured against a 150ms
  budget at 2,030 submissions), so the cost of over-purging is lost cache warmth, not a
  budget miss.

The person who would actually notice either bound — the organizer or speaker who just
made the change — never does: any request carrying a `chq_session` cookie skips the
cache read and write entirely and always renders fresh from origin, so both the
staleness window and the instance-wide blast radius are invisible to a signed-in
viewer and only ever observable in anonymous traffic. The one request shape that is
never cached at all, regardless of version or cookie, is /e/:eventSlug/schedule.ics
carrying an `ids=` query string (even an empty one) — per-recipient/unbounded
cardinality means it is excluded from `caches.default` outright rather than joining the
version-salted key space; a bare `schedule.ics` with no `ids` does cache normally.

**Saved embeds (`/embed/e/:embedId`, DEC-785/DEC-822/DEC-839):** the embeds panel under
`/admin/settings` can save a surface + option recipe as a short embeddable id
(`src/routes/public/saved-embed.tsx`); `/embed/e/:embedId` resolves it. An unknown id
returns the same designed 404 every other unknown public route uses. A **disabled** embed
returns an empty 200 body, not a 404 (DEC-822's deliberate override of DEC-785) — a page the
organizer switched off must render as an intentional blank inside a customer's iframe, not
shout "not found" on someone else's site. An enabled embed resolves in its saved format:
`iframe`/`element`/`link` render inline through the same `renderSurfaceContent` +
`EmbedShell` pipeline the generic per-surface embed routes use; `json`/`xml` 302-redirect to
the per-surface feed twin carrying the saved options as query params; `ics` 302-redirects to
the fixed whole-agenda schedule feed (DEC-289) — a redirect in every case, not a second copy
of any envelope's rendering.

**Steal-mandate item 3 (hardened `embed.js` custom element) is built:** `public/embed.js`
ships a custom element with an origin-validated `src`, a sandboxed iframe, and
`postMessage`-based height resize with origin/source/instance-id validation, covered by
`test/embed-element.test.ts`. The plain `<iframe>` snippet remains available as the
unhardened fallback, not the only option.

## J11 — Reuse the network (`/admin/contacts`)

Org-level contact directory, search, segments/rules, merge, CSV import/export across
events. Built.

**Merge is a page, not a modal (DEC-684):** the KEEP/DISCARD comparison for an
irreversible merge lives at `/admin/contacts/merge` (`app/src/pages/contacts/MergePage.tsx`),
reached from the Duplicates tab, with the target set carried in the query string
(DEC-629's `{keepId, mergeIds}`). A destructive review step that can be linked,
reloaded, and returned to after an interruption is a correctness property, not a
nicety — which a modal over the list cannot provide.

**Capped:** `MAX_CONTACT_DIRECTORY_SCAN`=20000 (`src/server/repo/contacts/rows.ts`) —
segment/rules filters and duplicate-detection scans that would need to walk more than
20,000 contacts fail loudly (400, "narrow the scope") rather than silently truncate.
`MAX_IMPORT_ROWS`=2000 (`src/server/repo/contacts/import.ts`) is the one CSV import row
cap the whole app shares — a second constant with a different value would make the 400
message a lie (DEC-478), so this is the only place it is defined.

## J12 — Exports (`/docs/api`)

CSV/JSON exports cover every kind in `EXPORT_KINDS` (`src/server/repo/exports/kinds.ts`):
`submissions`, `speakers`, `evaluations`, `agenda`, `email-log`, `contacts` — all live
under the bearer-token REST API (mounted at `api/v1`); `/docs/api` is the public docs page
for it (SPEC §10 #6, built). Show-flow (final titles, speaker lists, intro text, deck
locations — SPEC §10 #7, built) is a separate route, not one of the `EXPORT_KINDS`.
Cross-org access returns 404, never 403, so an attacker can't distinguish "not yours" from
"doesn't exist" (`test/exports-cross-org.test.ts`). Bearer tokens cannot mint further
tokens (DEC-027).

## Admin shell / auth (`/login`, `/logout`, `/forgot`, `/account/password`, `/admin/*`)

Session login, self-service password change (any authenticated role), and the SPA
catch-all (`/admin/*`) that every unmatched admin path resolves through (DEC-154) rather than a
blank screen. Built.

`/logout` (`src/routes/auth-login.tsx`, DEC-154 wave-25 amendment) has no confirmation
screen: `GET /logout` mutates nothing and redirects straight to `/login` — a bookmarked or
typed sign-out URL, or a stray `<img src="/logout">`, can never end a session, closing the
CSRF hole a bare-GET side effect would open. `POST /logout` keeps its CSRF guard
(`csrfFormOrHeader`, DEC-181), deletes the session, and redirects to `/login` with a
`signed-out=1` query flag, where `loginStatusLine` (`src/routes/auth-helpers.ts`) renders
the single muted status line on the sign-in card. Built.

`/forgot` (`src/routes/auth.tsx`, DEC-014 amendment wave 25) is the password-reset request
form, and its `POST /reset/:token` sibling completes the change. The grant is a hashed,
single-use, 1-hour KV record, newest-only: a fresh request hard-deletes the previous one
(unlike a claim token, which supersedes with a grace window, because a reset is asked for by
the account holder themselves and can trivially be asked for again). Enumeration is closed
the DEC-004 way — the same "Check your email" card renders whether or not an account exists,
and the response never branches, which is also why a failed send cannot be surfaced to the
caller. Completing a reset enforces the minimum password length and revokes every other
session. Only `/forgot` is in the render manifest; the token route is single-use and so is
excluded from the idempotent render sweep. Built.

## Dev-only (`/dev/mailbox`, `/dev/mailbox/:emailId`)

The mailer port's local sink: every "send" (status-change notification, reminder,
compose, .ics invite) writes an `email_log` row and is viewable, full rendered message
included, at `/dev/mailbox` — deliberately **not mounted in production** (see README).
Production delivery, via the Cloudflare `send_email` binding adapter, is listed below.

`/dev/mailbox/:emailId` (`src/server/repo/email.ts`, guarded by `guardDevMailbox` in
`src/server/app.ts`) is the single logged message's own rendered view — same guard as the
list. What makes it unreachable in production: `guardDevMailbox` checks `DEV_MODE === '1'`
(DEC-005) ahead of the route match and answers `c.notFound()`, not a 403, when it isn't —
with `DEV_MODE` unset the route is indistinguishable from never having existed, not merely
access-denied. Once `DEV_MODE='1'` is established, the guard is also organizer-only and
org-scoped (DEC-546). The recipient-controlled HTML body renders inside a sandboxed
`<iframe srcdoc>`, never injected into the mailbox page's own DOM (SPEC §6).

## Pagination and list caps

Every list endpoint shares one pagination shape (`page?: { limit, offset }`, `count*`,
`id asc` tiebreak). The general default/ceiling is `DEFAULT_PER_PAGE`=50,
`MAX_PER_PAGE`=200 (`src/lib/pagination.ts`). Public surfaces use their own, smaller
ceiling — see J10 above. `/admin/comms` recipient composition additionally caps the
selected `submissionIds` array itself at `MAX_COMPOSE_RECIPIENTS`=100
(`src/domain/compose.ts`, enforced via `parseBoundedIdArray` in
`src/routes/comms/compose-core.ts`) *before* the same 100-recipient cap
(`expandRecipients`, `src/domain/compose.ts`) runs again on the expanded recipient
list — a submission can carry more than one active-invite co-speaker, so the first
check narrows submissions, not the eventual recipient count, and the second check is
what actually enforces the 100-recipient ceiling.

## The 100-contact reminder cap

`MAX_REMINDER_BATCH`=100 (`src/domain/reminders.ts`) — a single reminder run touches at
most 100 contacts, in deterministic `contactId` order, with a 1-hour manual dedupe window,
and reports the remainder rather than silently dropping it or hard-rejecting the whole
batch (DEC-319). A producer with more than 100 contacts due for a reminder needs more than
one pass; the UI must say so, not pretend the first 100 were everyone.

## The Overview row cap

`ROW_CAP`=5 (`src/server/repo/overview.ts`) bounds every "top N" list rendered on
`/admin/overview` (pending review, unplaced sessions, schedule conflicts, etc.) to 5 rows.
This is a dashboard preview, not a report — the full lists live on their own admin pages
(`/admin/submissions`, `/admin/agenda`, ...); Overview never claims to be exhaustive.

## Deliberately not built (stage 1 scope, per SPEC §10 and `decisions/DEC-446.md`)

Each bullet below carries an HTML-comment absence marker naming the artefact that would
have to exist for the claim to be false. `test/audit-claims.test.ts` (DEC-642) parses
every marker and fails, naming the bullet, if the artefact it names is actually present in
the tree — the same mechanism that keeps route claims honest (above), extended to this
list.

<!-- absent: file:app/src/pages/DecisionMeeting.tsx -->
- **Decision-meeting view** (SPEC §10 #2) — live slot countdown by track, per-reviewer
  "my top-ranked, not yet accepted" queue, accept-with-condition note. Explicitly closed
  as out-of-stage-1-scope (`DEC_446`).
<!-- absent: symbol:RESUBMIT_WITH_GUIDANCE@src/domain/evaluation.ts -->
- **"Resubmit with guidance" status** and the near-miss-as-CRM-invite-lane flow (SPEC §10
  #4). Same decision, same reason.
<!-- absent: route:GET /api/v1/integrations/sessionboard/status -->
- **Steal-mandate item 5, layer 2** (Sessionboard REST API adapter). Closed as a
  documented stage-1 non-goal per DEC-641: with no Sessionboard account in this project,
  not one byte of a live adapter could be executed or verified, and a token field wired to
  unverifiable paging code behind a real-looking UI is exactly the "simulator behind a
  full UI" the mandate warns against — the honest artefact is this sentence, not a
  half-working adapter. Layer 1 (the export importer) is built; see the "Sessionboard
  import" section below.
<!-- absent: file:src/domain/ticketing.ts -->
- **Non-goals, explicit per SPEC §0**: attendee registration/ticketing (marker names the
  nearest domain module a ticketing feature would need), sponsors & exhibitors,
  agentic/chat admin, calendar-API integration beyond `.ics`, pixel fidelity to
  Sessionboard, Accelevents integration.

Every item above is a real gap, not a euphemism — each bullet's absence marker is asserted
by `test/audit-claims.test.ts`, not just claimed in prose.

## Sessionboard import (steal-mandate item 5)

**Layer 1 (export importer) is built:** `POST /api/v1/events/:eventId/import/sessionboard`
(`src/routes/api/import.ts`), organiser-only, org-scoped (an `eventId` from another org is
404, never 403). Supports a dry run (`dryRun: boolean` in the request body) and idempotent
`external_ref` upsert via the pure planning core in `src/domain/sessionboard.ts`. The
importable entity set is not hand-listed here — it drifts as entities are added — the
source of truth is `SB_TARGET_FIELDS` in `src/domain/sessionboard.ts`. The admin panel
(`app/src/pages/settings/SessionboardImportPanel.tsx`, under `/admin/settings`) drives
column mapping, dry-run preview, and the real run.

<!-- absent: route:GET /api/v1/integrations/sessionboard/status -->
**Layer 2 (REST API adapter) is a deliberate stage-1 non-goal (DEC-641):** this project has
no Sessionboard account, so no code path against their live REST API could be executed or
verified — an unverifiable adapter behind a real-looking token field would be precisely the
"simulator behind a full UI" the steal-mandate warns against. Recorded as a non-goal, never
as "coming soon".

## Stage-2 platform wiring (the operator owns this, not the product — SPEC §0 "Build staging")

Stage 1 runs with **zero external accounts or secrets**; the following are configuration
and adapter swaps that a deploying operator does, not code gaps:

- **`wrangler deploy` / Cloudflare provisioning** — D1/R2/KV bindings, cron triggers,
  `custom_domain`/DNS. Local dev already emulates all of it via Miniflare.
- **Production email delivery** — the mailer is a port (`src/server/repo/email.ts` /
  `src/routes/*mailbox*`); the adapter behind it (`src/mail/email-binding.ts`, DEC-996) is
  already written, against the Cloudflare Workers `send_email` binding, not Resend. What's
  left is the operator's own account/domain provisioning (the binding + a verified sending
  domain), not a code gap. Local dev writes to `email_log` + `/dev/mailbox` instead, and
  that route stays deliberately unmounted in production.
- **Airtable one-way sync** — the push adapter is written (`src/sync/airtable.ts`, cron-
  invoked from `src/server/scheduled.ts`) and is a no-op unless both `AIRTABLE_TOKEN` and
  `AIRTABLE_BASE_ID` are configured; absence is a valid state, not an error. Once those two
  are set, a missing `AIRTABLE_ORG_ID` throws rather than syncing unscoped — one Airtable
  base serves exactly one org, so a configured-but-unscoped sync would push one tenant's
  rows into another tenant's base. No account is wired up in this repo, by design (stage 1
  has no secrets).
- **Resend delivery-tracking webhooks → `email_log`** (SPEC §10 #8). Depends on the same
  external Resend account as production email above; not built.

## Honesty rules this document itself is held to (and where they bite elsewhere)

- **No total that was not counted.** Every cap named above (`ROW_CAP`, `MAX_REMINDER_BATCH`,
  `MAX_AUTO_SCHEDULE_PLACEMENTS`, `MAX_PUBLIC_PAGE`/`MAX_PUBLIC_ROWS`,
  `MAX_CONTACT_DIRECTORY_SCAN`, `MAX_IMPORT_ROWS`, `MAX_PER_PAGE`, `DEFAULT_PER_PAGE`,
  `MAX_COMPOSE_RECIPIENTS`) is read live from its source constant, not restated from
  memory — if the constant changes, this document is wrong until edited, which is
  exactly why `test/audit-claims.test.ts` exists: to catch drift in the things it *can*
  check mechanically — route paths (DEC-618), every `` `NAME`=<number> `` cap claim
  against its live constant, and the "Deliberately not built" section's absence markers
  (DEC-642) — forcing a human to re-read the rest at review time.
- **No slug that was not read.** Route paths above are patterns copied from
  `app/src/routeManifest.ts`, not typed from memory — the test enforces this for every
  path in backticks.
- **Status changes never auto-email, with one sanctioned exception.** Stated once above
  (J5): sending is always a distinct, explicit action the producer takes, not an
  automatic side effect of a status write. The one exception is by design, not drift —
  `POST /api/v1/submissions/:id/content-note` (`src/routes/content-notes.ts`) is the single route that
  both moves `content_status` to `changes_requested` and mails the submission's
  participants in the same request, because the note *is* the change-request notice
  (DEC-720/DEC-741). This is true regardless of whether that route's mail send is
  atomic with or best-effort alongside the status write — the exception is the route
  existing at all, not how its send outcome is reported.
