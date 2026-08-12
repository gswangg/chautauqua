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

## J3 — Triage submissions (`/admin/submissions`, `/admin/submissions/forms`, `/admin/submissions/:id`)

List, filter, bulk status change, saved views. Built. List queries and bulk ops are
capped like every other list in this app — see "Pagination and list caps" below.

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

## J6 — Onboarding dashboard (`/admin/overview`, `/admin/speakers`, tasks)

Task assignments (forms, uploads, acknowledgements), reminder cron, and the producer's
onboarding-progress dashboard are built. `/admin/speakers` is the accepted-speaker roster
(onboarding/task status per speaker, contact/profile drill-in). See the reminder cap and
Overview row cap below.

## J7 — Speaker self-serve portal (`/portal`, `/portal/profile`, `/portal/submissions/:id`, `/portal/submissions/:id/edit`, `/portal/tasks`, `/portal/tasks/:assignmentId/form`)

Branded portal (logo/accent from event settings), submission edit within the organizer's
open-edit window, profile, and per-task forms/uploads. Built. `MAX_PARTICIPANTS_PER_SUBMISSION`=6
(`src/server/repo/portal-edit.ts`) caps co-speakers a speaker can add to their own
submission from the portal.

## J8 — Collect/review/approve content (`/admin/content`)

Per-session file uploads (typed: slides, headshot, bio, etc.), organizer approve/reject,
version history. Built. Files are served through an authenticated Worker route
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

## J10 — Publish to the public site (`/e/:eventSlug/sessions`, `/e/:eventSlug/sessions/:sessionId`, `/e/:eventSlug/speakers`, `/e/:eventSlug/speakers/:speakerId`, `/e/:eventSlug/gallery`, `/e/:eventSlug/agenda`, `/e/:eventSlug/schedule`, `/embed/:eventSlug/sessions`, `/embed/:eventSlug/speakers`, `/embed/:eventSlug/gallery`, `/embed/:eventSlug/agenda`, `/embed/:eventSlug/schedule`, `/embed/:eventSlug/sessions/:sessionId`, `/embed/:eventSlug/speakers/:speakerId`)

Five public, mobile-friendly, no-login surfaces plus their embed twins (iframe
snippets from `/admin/settings`'s embeds panel). All public queries filter to
accepted+visible+content-approved server-side (never trust a client-side filter for what
is public). `/e/:eventSlug/schedule` also serves `.ics`. Built.

**Capped:** every public list is bounded by `MAX_PUBLIC_PAGE`=100 and `PUBLIC_PER_PAGE`
(`src/server/repo/public/bounds.ts`) — `MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE * PUBLIC_PER_PAGE`
is the deepest row reachable via pagination or `?limit=`; deeper pages are not offered
(`hasMore` false past the ceiling), not silently truncated with no signal.

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

CSV/JSON exports for submissions, speakers, sessions, show-flow (final titles, speaker
lists, intro text, deck locations — SPEC §10 #7, built) all live under the bearer-token
REST API (mounted at `api/v1`); `/docs/api` is the public docs page for it (SPEC §10 #6,
built).
Cross-org access returns 404, never 403, so an attacker can't distinguish "not yours" from
"doesn't exist" (`test/exports-cross-org.test.ts`). Bearer tokens cannot mint further
tokens (DEC-027).

## Admin shell / auth (`/login`, `/account/password`, `/admin/*`)

Session login, self-service password change (any authenticated role), and the SPA
catch-all (`/admin/*`) that every unmatched admin path resolves through (DEC-154) rather than a
blank screen. Built.

## Dev-only (`/dev/mailbox`)

The mailer port's local sink: every "send" (status-change notification, reminder,
compose, .ics invite) writes an `email_log` row and is viewable, full rendered message
included, at `/dev/mailbox` — deliberately **not mounted in production** (see README).
Real delivery (Resend) is stage-2 wiring, listed below.

## Pagination and list caps

Every list endpoint shares one pagination shape (`page?: { limit, offset }`, `count*`,
`id asc` tiebreak). The general default/ceiling is `DEFAULT_PER_PAGE`=50,
`MAX_PER_PAGE`=200 (`src/lib/pagination.ts`). Public surfaces use their own, smaller
ceiling — see J10 above. `/admin/comms` recipient composition additionally caps at
`MAX_PER_PAGE`=200 selected submissions *before* the true cap runs on the expanded
recipient list (a submission can carry more than one active-invite co-speaker).

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
  `src/routes/*mailbox*`); Resend is the stage-2 adapter behind it. Local dev writes to
  `email_log` + `/dev/mailbox` instead, and that route is deliberately unmounted in
  production.
- **Airtable one-way sync** — the push adapter is written (`src/sync/airtable.ts`, cron-
  invoked from `src/server/scheduled.ts`) and is a no-op unless both `AIRTABLE_TOKEN` and
  `AIRTABLE_BASE_ID` are configured; absence is a valid state, not an error. No account is
  wired up in this repo, by design (stage 1 has no secrets).
- **Resend delivery-tracking webhooks → `email_log`** (SPEC §10 #8). Depends on the same
  external Resend account as production email above; not built.

## Honesty rules this document itself is held to (and where they bite elsewhere)

- **No total that was not counted.** Every cap named above (`ROW_CAP`, `MAX_REMINDER_BATCH`,
  `MAX_AUTO_SCHEDULE_PLACEMENTS`, `MAX_PUBLIC_PAGE`/`MAX_PUBLIC_ROWS`,
  `MAX_CONTACT_DIRECTORY_SCAN`, `MAX_IMPORT_ROWS`, `MAX_PER_PAGE`) is read live from its
  source constant, not restated from memory — if the constant changes, this document is
  wrong until edited, which is exactly why `test/audit-claims.test.ts` exists: to catch
  drift in the things it *can* check mechanically — route paths (DEC-618) and the
  "Deliberately not built" section's absence markers (DEC-642) — forcing a human to
  re-read the rest at review time.
- **No slug that was not read.** Route paths above are patterns copied from
  `app/src/routeManifest.ts`, not typed from memory — the test enforces this for every
  path in backticks.
- **Status changes never auto-email.** Stated once above (J5) and true everywhere: no
  route that changes a submission's or task's status also sends mail as a side effect;
  sending is always a distinct, explicit action the producer takes.
