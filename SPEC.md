# Chautauqua — Specification

An open-source speaker & event-content management platform, built to replace Sessionboard
for the AI Engineer conference team (**Kill My SaaS** competition, deadline **Wednesday
Aug 12, 10 PM PT** — repo + deployed site + submission form).

> **Chautauqua** (shuh-TAW-kwa): the circuits of the 1870s–1920s that carried lecturers,
> performers, and whole programs to towns that could never afford the institutions —
> education under a tent, owned by the community. Same gesture here: the $40k program
> office, open-sourced. CFP in, program out.

## 0. What we're building, and what governs it

The **requirements** come from the customer, in fidelity order — all vendored into this
repo under `docs/` (see `docs/README.md` for the map):

1. swyx's Discord clarifications — `docs/clarifications.md` (the highest-signal
   statements of actual need)
2. The competition brief — `docs/brief.md` + the annotated UI screenshots in
   `docs/brief-images/`
3. Sessionboard's documented behavior — `docs/sessionboard-reference/` (per-area
   personas, journeys, filled-state expectations; start with
   `00-how-sessionboard-works.md`) — the workflows the AIE team already knows
4. The `sbek` eval rubrics — `docs/eval-rubric/*.yaml`, a **derived** artifact of #3.
   Regression harness and scoring floor, *not* the requirements document. swyx: the eval
   "is NOT … what the real final judge (the tools buyer human) will focus on." The
   bracketed rubric IDs throughout this spec (CFP-01, EMB-14, …) resolve there, and the
   seed data should mirror `docs/fixtures/sample-data.json`.

The **final judge** is the AIE team — non-technical event production professionals — using
the product on real workflows, with the tiebreaker going to "judgment calls for the
product that we would actually use/buy." So the spec is organized around users and jobs;
features exist because a job needs them; rubric IDs appear only as verification hooks.

Engineering priorities, in order: performance · feature completeness · architectural
simplicity · security · ease of deployment. Open source from day one, maintained in git.

### Build staging (stage 1 now; stage 2 is a separate later swarm)

External-platform configuration is deliberately deferred — the product gets built first.

**Stage 1 — the local-complete product (this build).** The entire feature surface J1–J12,
runnable with **zero external accounts or secrets**: `wrangler dev`'s local runtime
(Miniflare) emulates D1, R2, KV, and cron triggers offline. Hard rule: **stage-1 code must
run with no secrets present** — a fresh checkout plus `npm ci` plus one dev command is a
fully working app. Every external service sits behind a port with a local implementation:

- **Mailer port → dev sink.** Every "send" writes `email_log` rows and full rendered
  messages (including .ics attachments) viewable at a dev-only mailbox route. This keeps
  the whole communication surface buildable and testable now — templates, merge fields,
  per-recipient preview, the 100-cap, reminder cron, confirmation emails — with the real
  provider (Resend) as a stage-2 adapter swap.
- **File storage → the R2 binding** (Miniflare local in dev). Files are served through an
  authenticated Worker route in stage 1; presigned direct-from-R2 URLs are a stage-2
  optimization, not a dependency.
- **Self-grading runs against the local dev URL** — sbek takes any `--url`, including
  localhost.

**Stage 2 — platform wiring (second swarm, before submission).** Cloudflare provisioning
(D1/R2/KV, cron), `wrangler deploy`, Resend API key + real delivery (+ optional webhooks),
production edge-cache validation and perf measurement, Airtable one-way sync, domain/DNS,
CI deploy pipeline. If stage 1 keeps its ports clean, stage 2 is mostly configuration and
adapter swaps — which is exactly why the ports rule is a hard rule.

### Non-goals (explicit, per swyx)

Accelevents integration ("skip accelevents its fine") · attendee registration/ticketing ·
sponsors & exhibitors · agentic/chat admin ("admin ui is the priority") · calendar-API
integration (".ics good enough") · pixel fidelity to Sessionboard.

### Design assumptions (scale)

AI Engineer-class events. Targets, not guesses to hard-code: 500–5,000 submissions/event ·
up to ~25 tracks, ~15 rooms, 3–5 days · 200–800 speakers · 10–50 reviewers · 5–15 team
members working concurrently · multiple events per year sharing one speaker network.
Every list view, bulk action, and query must be designed for the top of these ranges.

---

## 1. Users and their jobs

| User | Who they are | Success looks like |
|---|---|---|
| **Producer** (organizer/admin) | Non-technical event production pro; lives here for months per event | No parallel spreadsheet exists; nothing falls through the cracks; every screen answers "what needs my attention?" |
| **Reviewer** | Time-poor community volunteer on the program committee | Opens a link, sees exactly their queue, rates fast, done |
| **Speaker** | Busy professional; interacts a handful of times | One obvious portal; always knows what's owed and when; never re-enters data |
| **Technical teammate** (swyx) | Wants the data to flow outward | Embeds on ai.engineer, exports, API, Airtable automations keep working |
| **Public** | Attendees & the internet | Fast, mobile-friendly program pages that are always current |

### The jobs, as workflow narratives

Each job is the unit of acceptance: we walk it start-to-finish as that persona before
calling it done. (Verification hooks: sbek scenario/rubric IDs in brackets.)

**J1 — Launch a CFP in an afternoon.** Producer creates an event (name, slug, dates,
location, timezone, branding), opens the default submission form, adds custom questions
(text/long-text/dropdown/checkbox/number/file, required flags, help text), sets one or
more tracks on the form, sets a close date, and shares a public link. A submitter needs no
account to start. Basic conditional logic (show field X when format = Workshop) — swyx:
"conditional fine for now." [CFP-01, CFP-03]

**J2 — Submit a talk without friction.** Speaker opens the public link, sees event
branding + deadline + tracks, fills the form (required fields gate progress), picks
track(s), saves a draft, submits, sees confirmation on screen, and gets a **real email**
with a portal link where they create a password. Editing stays open until the close date —
and per swyx, accepted speakers can continue to edit after acceptance. [CFP-05, CFP-06]

**J3 — Triage hundreds of submissions without drowning.** Submissions land as Pending in
a table built for volume: any form answer as a column, saved views, search, filters by
track/format/status, bulk select → bulk status change. Status pipeline: pending →
accept-queue / decline-queue → accepted / declined (swyx's minimum: "unreviewed →
approve/maybe/deny"). Manual session creation and cloning for invited talks. [CFP-12]

**J4 — Run committee review in waves.** Producer creates an evaluation plan: instructions,
open/close dates, session filters (track!), anonymization toggle, rating scale, weighted
criteria, optional multiple rounds, max-evaluations cap. Reviewers are assigned by track
("reviewers review one or more tracks" — swyx) or per-submission; each reviewer's queue is
exactly their assignment, sorted fewest-ratings-first so coverage closes. Scorecards mix
numeric ratings, dropdowns, free text. Producer watches progress, nudges laggards with one
bulk reminder, and reads a results table sorted by aggregate score, exportable to CSV.
Results are producer-only; anonymization is server-side. [ABS-01, ABS-03, ABS-05, ABS-10]

**J5 — Decide and notify, deliberately.** Deciding is a status change — bulk or single —
and **never sends email**. Notifying is its own act: select decided records → compose from
a template with merge fields (`{speaker_name}`, `{talk_title}`) → per-recipient preview →
send (100-recipient cap per batch) → every message logged per-recipient in history. Bonus
per swyx: attach reviewer feedback to the decision email. [CFP-¬auto-email rules]

**J6 — Onboarding runs itself; the producer watches a dashboard.** Acceptance
**auto-creates** the speaker record, the session, and the onboarding task set (swyx:
"yes"). Default tasks per swyx's must-haves: **hotel stay requirement form** and **flight
reimbursement form** (form-type tasks), plus finalize talk description, finalize
bio + headshot, announce participation. The producer's onboarding dashboard is a
per-speaker × per-task status grid — due dates, filters, live upload state — answering the
only question that matters: *who still owes me what?* Automated due-date reminders go out
via cron; a bulk "remind everyone outstanding" button exists for the impatient. [CNT-01,
CNT-07, SPK tasks]

**J7 — Speakers self-serve everything.** The branded portal (logo, accent color, welcome
message) shows: my submissions with status, my tasks with deadlines and required markers,
my sessions, resources. Speakers edit bio/social links/headshot and the changes appear on
the producer's record instantly (one record, two views). Session invitations can be
accepted/declined. Scoping is absolute: only their own content, ever. [SPK-07, SPK-08,
CNT-02, CNT-03]

**J8 — Collect, review, and approve content.** Per-session file uploads typed
Presentation/Poster/Handout; re-uploads chain as versions with full history; a comment
thread per deliverable carries producer feedback ("please use the event template") and
speaker replies. Sessions carry a content approval status; unapproved content never
reaches public surfaces. Upload UI states accepted types and size caps. [CNT-12, CNT
versioning/comments]

**J9 — Build the agenda under constant change.** Rooms and tracks defined once; agenda
views: list + day grid (time × rooms). Drag accepted sessions from an unscheduled tray
into slots; placement persists. Conflicts (room overlap, same speaker in overlapping
sessions) are **surfaced, never blocking** — a warning chip and a live "N unplaced ·
M conflicts" counter, because the schedule is the most fluid artifact of an event and a
tool that says "no" loses to a spreadsheet. Track colors throughout. An auto-schedule
action (greedy conflict-avoiding placement) covers the "AI agenda basics." [AIA-01,
AIA-03, AIA-04]

**J10 — Publish continuously to the website.** Five public, mobile-friendly, no-login
surfaces — sessions list (cards, show-more, filters), speakers list (alpha by surname,
headshot/title/company), agenda (per-day time grid), schedule itinerary (personal picker,
persists on reload, **.ics export with stable UIDs**), speaker gallery. Embed generator
produces copyable iframe/snippet per surface. Only accepted + visible + content-approved
records render, enforced in the query. Widgets read the same tables as admin — consistency
by construction. Edge-cached, purged on publish-affecting writes. [EMB-01, EMB-04,
EMB-06, EMB-14, EMB-16]

**J11 — Reuse the network next event.** Org-level contact directory across events: search,
custom fields, notes, CSV import with column mapping, per-contact history (submissions,
talks, emails, events), duplicate merge, segments, bulk email, a small dashboard
(returning-speaker count, top companies). Contacts attach to events; the
contact → speaker → publicly-visible ladder never collapses. [CRM-01, CRM area]

**J12 — The data stays theirs.** Exports everywhere CSV/JSON (submissions, speakers,
evaluations, agenda, email log); a REST API (`/api/v1`, bearer tokens) that the admin SPA
itself consumes; optional one-way Airtable sync (their automations fire on new rows —
read-only is fine per swyx). No lock-in is not a feature of this product; it is the
premise of the competition.

---

## 2. Product principles (how we make judgment calls)

The tiebreaker is judgment. When the docs are silent, decide by these, in order:

1. **Legible over configurable.** Sessionboard is "a maze of tabs and buttons with no
   clear order" (verbatim competitor-user complaint in the hackathon Discord). Fewer
   screens, obvious nav, guessable routes (`/admin`, `/portal`, `/submit/<event>`), one
   clear next action per screen. Settings get defaults, not wizards.
2. **Volume-first.** Every table assumes thousands of rows: server pagination, filters,
   saved views, bulk actions, keyboard-fast review. A feature that demos well with 10 rows
   and dies at 2,000 is not built.
3. **Nothing falls through the cracks.** Dashboards are worklists, not reports: fewest-
   ratings-first, who-owes-what, unplaced-and-conflicted. Every module answers "what needs
   my attention?" on its first screen.
4. **Communications are deliberate.** Status changes never auto-email. Sends are
   templated, previewed per-recipient, capped, and logged. Automated reminders are
   schedule-driven (due dates), never decision-driven.
5. **The website is the output.** Embeds are a first-class product surface — fast, always
   current, impossible to leak hidden/unapproved content into.
6. **Fail loudly.** Exceptions and asserts over silent fallbacks; authz checks throw;
   invariants assert. No defensive defaults that hide bugs. (House style throughout.)

---

## 3. Beyond parity — why they'd switch

Parity loses to the incumbent by default; these are the reasons to switch, and they're
mostly invisible to the eval harness — which is exactly why they matter to the human
judges:

- **Speed.** "we do not want slow SaaS pls" — sub-100 ms cached public pages, sub-200 ms
  admin interactions, at our scale targets.
- **Clarity.** Beat the maze: a producer should find any function in two clicks from an
  obvious top nav.
- **Own-your-data.** Exports + API + Airtable sync from day one.
- **Calendar invites done right** (nice-to-have tier): initial .ics without a room, then
  an *update* with the same UID and bumped SEQUENCE when the room is assigned — the exact
  flow swyx described.
- **Migration path** (roadmap, post-competition): Sessionboard has a public API
  (sessionboard.mintlify.app); an importer that pulls their existing events/contacts is
  the difference between "nice clone" and "we can actually cancel the contract." Not
  buildable without their API key — flag it in the README roadmap so the judges see we
  know killing a SaaS requires getting the data out.

---

## 4. Architecture & stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Cloudflare Workers** (single Worker) | CF-infra bonus; edge performance; zero-ops deploy |
| Framework | **Hono** | Tiny, fast, first-class Workers support, JSX SSR built in |
| Database | **Cloudflare D1** (SQLite) + **Drizzle ORM** | One DB, migrations in git, typed queries |
| Files | **Cloudflare R2** | Headshots/slides/resources; presigned URLs |
| Email | Mailer port: dev sink (stage 1) → **Resend** adapter (stage 2) | Full comms surface buildable with no key; real MVP-basis delivery (swyx's suggestion) is an adapter swap; everything logged in-app either way |
| Admin UI | **React + Vite SPA** served as Worker static assets | Form builder + drag-drop agenda need client state |
| Public pages | **Hono JSX SSR**, edge-cached | Fast, mobile-friendly, no-JS-required |
| Auth | Hand-rolled PBKDF2 (Web Crypto) + HttpOnly session cookies | Auditable, minimal dependency surface |
| API | REST JSON `/api/v1`, bearer tokens | The SPA consumes the same API (dogfooding) |

**One deployable unit.** The Worker serves SPA assets, `/api/v1`, SSR public pages,
`/portal`, `/submit/<event>`, `/embed/*`. Local dev: `wrangler dev` (Miniflare provides
local D1/R2). No Docker, no external services beyond Resend. Cron trigger (Workers
scheduled event) drives reminders.

### Auth model

Password auth, not magic links — real users get a simpler mental model and the eval agent
has no inbox. Speaker accounts are created **through the flow** (post-submission "create a
password"; confirmation email carries the portal link) — no upfront registration wall.
Roles: `organizer` (full event control), `reviewer` (assigned plans only — no admin
settings, no results), `speaker` (own content only), public (CFP + widgets, no login).
Seeded demo accounts for all four personas ship in the seed script and README.

---

## 5. Data model

Org-level tables (people, CRM) vs event-level tables mirror the product's
contact → speaker → public-speaker ladder.

```
org
 └─ user (role grants per org/event)
 └─ contact ──────────────── org-level people (J11)
 └─ event
     ├─ form (CFP)             form_field (ordered, typed, conditional rules)
     ├─ submission             = session record; one row through its whole lifecycle
     │    ├─ submission_answer (per form_field)
     │    ├─ participant       (contact↔session join; role, order, visibility, invite state)
     │    ├─ evaluation        (per plan+reviewer+submission: scores, comment)
     │    ├─ file              (typed Presentation/Poster/Handout; version chain)
     │    ├─ file_comment      (speaker↔producer thread)
     │    └─ schedule_slot     (day, start, end, room_id; nullable = unscheduled)
     ├─ evaluation_plan        (filters, anonymized, scale, criteria weights, rounds)
     ├─ plan_reviewer          (user↔plan assignment)
     ├─ track / room
     ├─ task                   (general | file_request | form; due date, required)
     ├─ task_assignment        (per contact; status, completed_at, completed_by)
     ├─ portal_settings        (branding, welcome, visibility toggles)
     ├─ resource               (file | wiki page)
     ├─ email_template         (merge fields)
     └─ email_log              (per-recipient rows; status)
```

Invariants (assert, don't paper over):

- Status pipeline: `pending → accept_queue | decline_queue → accepted | declined`
  (+ custom). **Status changes never send email.**
- A contact becomes a *speaker* only via a `participant` row; a speaker appears publicly
  only if `participant.visible` AND submission accepted AND content approved — distinct
  gates, never collapsed.
- `form.close_date` past ⇒ new submissions rejected **and** (unaccepted) speaker edits
  locked, server-side. Accepted speakers keep editing per swyx.
- Acceptance transition fires the J6 auto-creation (speaker + session + default tasks)
  exactly once, idempotently.
- Stable IDs everywhere; per-event record prefixes (`SES-014`); .ics UIDs never churn.
- Files: `previous_file_id` version chains; history complete and downloadable.

---

## 6. Security

- PBKDF2-SHA256 (≥600k iterations), constant-time compares; session rotation on login.
- HttpOnly/Secure/SameSite=Lax cookies; CSRF custom-header check on JSON mutations, token
  on plain form posts.
- Authz middleware on every admin/API route: role + event grant; object-level ownership
  checks on every fetch-by-id (no IDOR). Speakers hitting `/admin` → 403/redirect.
- Server-side filtering for all public and anonymized data — never CSS-hidden.
- Uploads: extension+MIME allowlist, size caps, random R2 keys; files served through an
  authenticated Worker route (stage 1; presigned GETs are a stage-2 optimization); no
  user-content served with HTML content types.
- Parameterized queries only (Drizzle). Rate limits on auth + public submission. Secrets
  via `wrangler secret`; `.dev.vars` gitignored.
- Public submission endpoint validates against the server's form schema (required, types,
  conditional visibility) — never trusts the client's rendering.

## 7. Performance

Two-layer budget: what the server does, and what the user feels. All numbers **measured at
scale-target row counts** (seed a 2,000-submission synthetic event for perf testing, not
the 30-row demo).

**Server budgets** (this stack has no excuse for more — warm isolates are ~0 ms and a
D1 query adjacent to the Worker is single-digit ms):

- Admin API reads p95 < 50 ms, writes p95 < 100 ms server time. A route exceeding this is
  a bug (waterfall, N+1, oversized payload), not a tuning opportunity.
- One round trip per view: each screen's data loads in a single joined query/endpoint —
  no client-side request waterfalls.
- Public pages: edge-cache hit TTFB < 50 ms; uncached SSR < 150 ms. `Cache-Control` +
  stale-while-revalidate; purge on publish-affecting writes.
- Smart Placement on, so multi-query routes execute next to D1 rather than paying
  cross-region latency per query.

**Perceived budgets** (the "we do not want slow SaaS" bar):

- High-frequency actions — drag-drop placement, status pills, task check-offs, ratings —
  render **optimistically at ~0 ms** and reconcile with the server; failures surface
  loudly and roll back (fail-loudly applies to optimistic UI too).
- Navigation to any admin screen: interactive < 300 ms; prefetch route data on hover/
  focus for the common paths.
- 100 ms is the "feels instantaneous" threshold — anything a producer does repeatedly
  must sit under it end-to-end.

**Mechanics:**

- D1 indexes on every FK + (event_id, status) + (event_id, slug); joined queries only.
- Server pagination + filtering on all admin lists; headshots thumbnailed at upload with
  long-lived cache headers.
- SPA code-split by route; initial bundle < 300 KB gz.
- CI perf smoke: hit the hot endpoints against the 2k-row seed and fail the build over
  budget — budgets that aren't enforced are decoration.

## 8. Deployment & operations

- `npm i && npm run db:migrate && npm run seed && npm run dev` → working local app with a
  populated demo event + all four persona logins.
- `npm run deploy` = migrations + `wrangler deploy`. One command, idempotent.
- Seed doubles as the **grader package**: a fully-populated DevFlow-Conf-shaped event
  (mixed statuses, colored agenda, version history, task states) so every screen a judge
  opens is filled; README "For evaluators" section lists URLs + credentials verbatim.
- GitHub public repo, MIT. CI: typecheck + unit tests. (Forge mirror only if registration
  reopens — "very teeny" bonus.)

## 9. Verification

Two layers, in order of authority:

1. **Persona walkthroughs (the real bar).** Before submission, walk J1→J12 end-to-end as
   each persona, on the deployed site, on a phone for the public surfaces. If a
   non-technical producer couldn't do J3/J5/J6 without guidance, it's not done — this is
   the actual final exam. Send swyx the MVP URL early for human feedback (he's offering).
2. **sbek eval as regression harness.** Run the real kit against the deployed URL
   (`--agent-model claude-sonnet-5 --judge-model claude-opus-5`, ~$2–10/full run; area
   subsets + `--resume` while iterating). Work the manual checklist (email delivery, .ics,
   cross-account checks) — <60% coverage withholds the score. Unit-test the cheap,
   high-weight invariants directly: close-date lock, speaker isolation, hidden-speaker
   exclusion, decision≠email. Keep nav guessable — the agent tries `/admin`, `/portal`,
   labeled links, and `rule`/`scoping` checks run last in each scenario.

Known eval blind spots we cover anyway because the *product* needs them: portal
resources/wiki pages, working .ics in speaker comms, performance at volume, mobile
rendering, exports/API, visual polish.

## 10. Nice-to-haves (only after J1–J12 are green)

1. .ics invite **updates** (same UID, SEQUENCE bump) when a room is assigned later.
2. Decision-meeting view: live slot countdown by track; per-reviewer "my top-ranked, not
   yet accepted" queue; accept-with-condition note.
3. Assisted chasing: reminder **drafts** for human review alongside automated sends.
4. "Resubmit with guidance" status; near-miss list carried into the CRM as an invite lane.
5. Airtable one-way sync (contacts/sessions → base; automation-friendly new rows).
6. Public API docs page.
7. Show-flow export (final titles, full speaker lists, intro text, deck locations).
8. Resend webhooks → delivery/open tracking in `email_log`.

## 11. Milestones (now → Wed Aug 12, 10 PM PT)

| When | Deliverable |
|---|---|
| **M1 — Sun night** | Stage-1 swarm running: Worker skeleton + local D1 + auth + seeded personas + event settings + CFP builder + public submission (J1, J2 walkable on `wrangler dev`) |
| **M2 — Mon** | Review + disposition (J3–J5), speaker roster/portal shell (J7 partial); first full eval run against the local dev URL |
| **M3 — Tue** | Onboarding + content (J6, J8), agenda (J9), all five public surfaces (J10); second eval run; fix rule/scoping reds |
| **M4 — Wed AM** | CRM (J11), exports/API (J12); **stage-2 swarm: platform wiring + deploy** (provision, Resend key, `wrangler deploy`); polish from eval report + persona walkthroughs; perf pass at 2k-row scale |
| **M5 — Wed PM** | Freeze; final eval run against the deployed URL + manual checklist; README-for-evaluators; submit form + repo + deployed URL |

Watch items: swyx's follow-up video + requirements freeze; eval-repo commits (re-pull
daily); Gene Kim's unanswered "review ethos 1–10" Discord thread.
