# Chautauqua — Specification

An open-source speaker & event-content management platform (Sessionboard clone) built for
the **Kill My SaaS** competition. Deadline: **Wednesday Aug 12, 10 PM PT**.

> **Chautauqua** (shuh-TAW-kwa): the circuits of the 1870s–1920s that carried lecturers,
> performers, and whole programs to towns that could never afford the institutions —
> education under a tent, owned by the community. Same gesture here: the $40k program
> office, open-sourced. CFP in, program out.

## 0. Design priorities (in order)

1. **Rubric completeness** — pass every item in the `sbek` eval kit (all 7 areas, including
   the extra-credit Speaker CRM). The rubric is the floor; everything else waits.
2. **Performance** — "we do not want slow SaaS pls" is a scored bonus. Public pages render
   at the edge from cache; admin interactions stay under ~200 ms server time.
3. **Architectural simplicity** — one deployable unit, one database, no queues, no
   microservices, no framework magic we can't read.
4. **Security** — real authz on every route; the eval actively probes for leakage
   (`scoping` items: speaker reaching admin routes, hidden speakers leaking into embeds,
   evaluation results visible to non-admins).
5. **Ease of deployment** — `wrangler deploy` from a clean checkout, one seed command,
   documented in a README a stranger can follow.

Open source from day one, maintained in git.

### Non-goals (explicitly out, per swyx's Discord clarifications)

- Accelevents integration ("skip accelevents its fine")
- Attendee registration / ticketing
- Sponsors & exhibitors
- Agentic/chat admin interface ("admin ui is the priority")
- Deep calendar-API integration (".ics good enough")
- Pixel fidelity to Sessionboard (grading is implementation-agnostic)

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Cloudflare Workers** (single Worker) | CF-infra bonus points; edge performance; zero-ops deploy |
| Framework | **Hono** | Tiny, fast, first-class Workers support, JSX SSR built in |
| Database | **Cloudflare D1** (SQLite) + **Drizzle ORM** | One DB, migrations in git, typed queries, no connection pools |
| Files | **Cloudflare R2** | Headshots, slides, resources; presigned URLs; no egress fees |
| Email | **Resend** (HTTP API) | Real MVP-basis delivery (swyx's suggestion); logged in-app |
| Admin UI | **React + Vite SPA**, served as Worker static assets | Form builder + drag-drop agenda genuinely need client state |
| Public pages | **Hono JSX SSR**, edge-cached | Widgets/embeds must be fast, mobile-friendly, no-JS-required |
| Auth | Hand-rolled: PBKDF2 (Web Crypto) + HttpOnly session cookies | Auditable, no dependency surface, works on Workers |
| API | REST JSON at `/api/v1`, bearer-token auth | Bonus points; the SPA consumes the same API (dogfooding) |

**One deployable unit.** The Worker serves: SPA assets, `/api/v1`, SSR public pages,
`/portal` (speaker), `/submit` (public CFP), and `/embed/*` (widgets).

Local dev: `wrangler dev` (Miniflare gives local D1/R2). No Docker, no external services
except Resend (stub-to-log mode when `RESEND_API_KEY` is unset — emails still record to the
in-app history so local dev and CI never silently drop them).

### Engineering principles

- **Fail loudly.** Exceptions and asserts over silent fallbacks. Authz checks throw; missing
  invariants throw. No defensive "just in case" defaults that hide bugs from the eval agent.
- **No dead abstraction.** Build for the rubric that exists, not the platform we might want.
- Server is the source of truth; the SPA holds no state the API can't reconstruct.

---

## 2. Personas & auth model

Four roles, matching the eval's fixtures (organizer **Jordan Alvarez**, speakers **Priya
Raman** / **Marcus Okafor**, reviewer **Sam Whitfield**):

| Role | Access |
|---|---|
| `organizer` | Full admin over their events |
| `reviewer` | Only assigned evaluation plans; **no** admin settings, **no** results |
| `speaker` | Portal: only their own submissions, sessions, tasks, files |
| public | CFP form + published widgets; no login |

Decisions:

- **Password auth, not magic links.** The eval harness has no inbox; magic-link-only apps
  force graders through a manual pre-auth step. Password login makes every scenario
  self-serve. (Email verification is not required to log in.)
- Speaker accounts are created **through the flow**: submitting a proposal offers "create a
  password to track your submission"; the confirmation email carries the portal link
  (rubric CFP-05, cross-cutting §5.1). No upfront registration wall.
- **Seeded demo accounts** (all four personas, fixture emails + passwords) ship in the seed
  script and are printed in the README + `submissionNotes` for graders.
- Sessions: HttpOnly, Secure, SameSite=Lax cookies; 30-day TTL; CSRF token on mutating
  form posts (SPA uses same-origin JSON + custom header check).

**Authz enforcement (scoping items are the strongest rubric signal):**

- Every query is scoped `WHERE event_id = ?` from the session's grant, never from client
  input alone.
- Route guards by role: `/admin/*` and admin API routes reject speaker/reviewer sessions
  (302 to their own home + 403 on API). The eval explicitly navigates speakers to
  `/admin`, `/organizer`, `/dashboard` and screenshots the result.
- Reviewer sees only sessions matched by their plan's filters; anonymized plans strip
  speaker fields **server-side** (not CSS-hidden).
- Evaluation results endpoints: organizer only.
- Public/embed queries filter `status = accepted AND visible = true` at the query layer —
  hidden speakers/sessions can never leak (EMB items probe this).

---

## 3. Data model

Single D1 database. Org-level tables (CRM) vs event-level tables mirror the product's
"contact → speaker → public speaker" ladder.

```
org
 └─ user (role grants per org/event)
 └─ contact ──────────────── org-level people (CRM area 07)
 └─ event
     ├─ form (CFP)             form_field (ordered, typed, conditional rules)
     ├─ submission             = session record; 1 row through its whole lifecycle
     │    ├─ submission_answer (per form_field)
     │    ├─ participant       (contact↔session join; role, order, visibility, invite state)
     │    ├─ evaluation        (per plan+reviewer+submission: scores, comment)
     │    ├─ file              (typed Presentation/Poster/Handout; version chain)
     │    ├─ file_comment      (speaker↔admin thread on deliverables)
     │    └─ schedule_slot     (day, start, end, room_id, nullable = unscheduled)
     ├─ evaluation_plan        (filters, anonymized, scale, criteria weights, rounds)
     ├─ plan_reviewer          (user↔plan assignment)
     ├─ track / room
     ├─ task                   (general | file_request | form; due date, required)
     ├─ task_assignment        (per contact; status, completed_at, completed_by)
     ├─ portal_settings        (branding, welcome, visibility toggles)
     ├─ resource               (file | wiki page)
     ├─ email_template         (merge fields)
     └─ email_log              (per-recipient rows; status, opened via Resend webhook—optional)
```

Key invariants (assert, don't paper over):

- A submission's **status pipeline**: `pending → accept_queue | decline_queue → accepted |
  declined` (+ custom statuses). Status changes **never** send email (§5.4 of eval docs).
- A contact becomes a *speaker* only via a `participant` row; a speaker appears publicly
  only if `participant.visible` AND submission accepted. Two distinct gates.
- `form.close_date` past ⇒ new submissions rejected **and** speaker edits locked
  (server-side check, not hidden button — `rule` items test both sides).
- Stable IDs everywhere; record ID prefixes (e.g. `SES-014`) generated per event.
- Files: a new upload may reference `previous_file_id` → version chain; history lists all
  versions, all downloadable.

---

## 4. Feature scope by rubric area

Each area lists what we build and the acceptance bar. Weight-3 rubric IDs in parentheses
are the must-not-fail items; `rule`/`scoping`/`roundtrip`/`handoff` behaviors are called
out because that's where clones die.

### 4.1 Call for Papers (area weight 20)

- Form builder: add/reorder/remove fields — short text, long text, dropdown, checkbox,
  number, file — with label, help text, required flag (CFP-01). Title/Description and
  name/email are locked-in defaults.
- Conditional logic: show a field based on a dropdown/checkbox answer (e.g. format =
  Workshop ⇒ "equipment needs" appears). Basic is enough per swyx.
- Form settings: close date, submission limit per submitter, confirmation message.
- Public CFP page, no login: event branding, deadline, tracks (CFP-03). Multi-track
  select on submission (one form, one-or-more tracks — swyx).
- Draft save; speaker account creation in-flow; on submit: on-screen confirmation +
  **real confirmation email** with portal link (CFP-05).
- Organizer submissions table: status pills, form answers as columns, search/filter
  (CFP-06 roundtrip — every submitted value must appear verbatim).
- Accept/reject recording incl. bulk (CFP-12); notification is a separate explicit step.
- **Rules to enforce:** closed form blocks submission *and* editing; required fields gate
  page advance; per-submitter limit.

### 4.2 Abstract Management (area weight 20)

- Evaluation plans: name, instructions, open/close dates, **≥2 independent rounds**
  (ABS-01), anonymized toggle, session filters (track/format/status), rating scale,
  weighted criteria, max evaluations per submission.
- Scorecard: numeric rating + dropdown + free-text criteria all render reviewer-side
  (ABS-03).
- Reviewer assignment: specific submissions → specific reviewer; reviewer queue contains
  **exactly** the assigned set (ABS-05 — scoping + roundtrip in one item). Track-scoped
  assignment covers swyx's "reviewers review one or more tracks."
- Reviewer UX: queue sorted fewest-ratings-first; submit scores + comment; progress
  indicator.
- Results (organizer-only): aggregate score per submission, sortable (ABS-10), per-plan
  and cumulative CSV export.
- Disposition: status pill editing incl. bulk; then **Send Emails** — template picker,
  merge fields (`{speaker_name}`, `{talk_title}`), per-recipient preview, 100-recipient
  cap, email history log. Bonus per swyx: attach reviewer feedback to the decision email.
- Statuses `approve / maybe / deny` map to accepted / accept_queue / declined.

### 4.3 Speaker Management (area weight 15)

- Speaker roster: all speakers with identity info, search/filter (SPK-01); add/edit with
  persistence (SPK-02); drag display order; per-speaker public-visibility toggle.
- Contacts vs speakers: assigning a contact to a session's Participants makes them a
  speaker (the ladder — collapse it and we fail §5.3).
- **Speaker portal** (branded: logo, accent color, welcome message): scoped strictly to
  own content (SPK-07); My Submissions with status; edit submission until close date.
- Portal profile editing: bio, social links, headshot upload → **changes appear on the
  organizer's record** (SPK-08 roundtrip).
- Portal invitation email; session invitation accept/decline (Invited → Confirmed).
- Bulk email to filtered speaker group + templates with merge fields + automated
  task-reminder emails (cron trigger, due-date driven).
- Custom/logistics fields on the speaker record (travel preference — also feeds swyx's
  hotel/flight onboarding forms).

### 4.4 Content Management (area weight 15)

- File-request tasks with instructions + due date, assigned to speakers/bulk (CNT-01).
- Portal task list: deadlines, required markers, upload recorded against task+session
  (CNT-02); explicit **Mark as Complete** (closing ≠ completing); upload UI states
  accepted types/max size.
- **Versioning:** re-upload as new version; history lists v1, v2… all downloadable.
- Comment thread per session's content (admin note → speaker reply — roundtrip).
- **Deliverables dashboard:** per-speaker × per-task status grid, due dates, filters,
  reflects uploads live (CNT-07) — this is also the brief's "real-time onboarding
  dashboard."
- **Content approval status** per session; unapproved content excluded from public
  surfaces (CNT-12 — rule + handoff).
- Speaker scoping hard-tested here (CNT-03): Priya must never see Marcus's tasks, and
  admin routes must 403.
- Bulk reminder email to speakers with outstanding tasks.
- Seed default onboarding tasks per swyx: hotel stay requirement form, flight
  reimbursement form (form-type tasks), plus optional finalize-description / bio+photo.

### 4.5 Agenda Builder (area weight 10)

- Multi-day schedule view: time × rooms grid + list view (AIA-01); day/room + drag-drop
  + conflict detection is explicitly enough (swyx).
- Drag unscheduled accepted sessions into day/time/room slots; **persists across reload**
  (AIA-03).
- Conflict detection: room overlap + same-speaker-in-overlapping-sessions shows a
  **visible warning, never a blocking modal** (AIA-04) — warn-don't-block, partial
  states always save.
- Track color coding; unscheduled tray; "N unplaced · M conflicts" counter (cheap, high
  polish-per-line).
- "AI agenda" basics: an auto-schedule action that places accepted sessions into open
  slots avoiding conflicts (greedy solver; no LLM required — cover the basics per brief).

### 4.6 Public Widgets (area weight 20)

Five public surfaces, SSR, no login, mobile-friendly, edge-cached (EMB-14 requires all
five reachable):

1. **Sessions list** — card per session: title, truncated description + Show more,
   date/time/room, track, speakers (EMB-01)
2. **Speakers list** — directory ordered alphabetically by surname: headshot, name,
   title, company (EMB-04)
3. **Agenda** — per-day, time-organized grid/timeline with rooms (EMB-06)
4. **Schedule itinerary** — personal "my schedule" picker; persists across reload
   (localStorage); add-to-calendar **.ics export with stable UIDs**
5. **Speaker gallery** — photo grid

- **Consistency (EMB-16):** widgets read the same tables as admin — same title, time,
  room everywhere, by construction.
- Only `accepted AND visible AND content-approved` records render — enforced in the
  query, verified by the eval both directions.
- Embed generator: copyable `<iframe>` + styled-snippet per widget (works cross-origin —
  manual-checklist item).
- Filters (track/day) on sessions list and agenda.

### 4.7 Speaker CRM (extra credit, area weight 10)

- Org-level contact directory across events, searchable (CRM-01); custom fields; notes.
- CSV import with column mapping (`fixtures/speakers.csv` is the test vector).
- Contact history timeline (submissions, talks, emails across events).
- Duplicate detection (same name, different email) + merge.
- Bulk email from directory; segments as saved filters.
- CRM dashboard: total contacts, events, returning-speaker count + one analytics widget.

### 4.8 Cross-cutting (the eval's §5 — treat as its own feature)

- **Decisions never auto-notify**; notification is explicit, previewable, capped, logged.
- Transactional email surface: submission confirmation (with portal link), admin
  notification on new submission, form-close reminders, evaluator reminders, task
  reminders, password reset. All real sends via Resend; all rows in `email_log`.
- Deadlines change behavior (close dates, task due dates with timezone display).
- Event-scoped everything; event switcher for multi-event users.
- Filled-state fidelity: seed script populates a complete demo event so every screen the
  judge opens is *populated* (mixed status pills, colored agenda, version history with
  v1+v2, task checklist with states) using our own data mirroring the DevFlow fixtures.

---

## 5. Security checklist

- PBKDF2-SHA256 (≥600k iterations) password hashes; constant-time compares.
- HttpOnly/Secure/SameSite cookies; session rotation on login; logout invalidates.
- CSRF: custom-header requirement on JSON mutations; token on plain form posts.
- Authz middleware: role + event grant checked on **every** admin/API route; object-level
  checks on every fetch-by-id (no IDOR — the eval literally tries other users' URLs).
- Server-side visibility filtering for public/anonymized data (never client-side hiding).
- Uploads: extension+MIME allowlist, size caps, R2 keys are random (no path traversal),
  presigned GETs; never serve user uploads from our origin with HTML content types.
- Drizzle parameterized queries only; no string SQL.
- Rate limits on auth + public submission endpoints (Workers KV counter).
- Secrets via `wrangler secret`; none in the repo; `.dev.vars` gitignored.
- Public submission endpoint validates against the *server's* form schema (required,
  types, conditional visibility) — never trusts the client's rendering.

## 6. Performance checklist

- SSR public pages with `Cache-Control` + `stale-while-revalidate`; cache purge on
  publish-affecting writes (status/visibility/schedule changes).
- D1 indexes on every FK + (event_id, status) + (event_id, slug).
- Headshots resized/thumbnailed at upload (Workers image API or client-side canvas);
  serve from R2 with long-lived cache headers.
- Admin lists paginated + server-filtered; no N+1 (Drizzle `with` joins).
- SPA: code-split by route; bundle budget < 300 KB gz initial.
- Target: public widget TTFB < 100 ms cached / < 300 ms uncached; API p95 < 200 ms.

## 7. Deployment & operations

- `npm i && npm run db:migrate && npm run seed && npm run dev` → working local app with
  demo event + all four persona logins.
- `npm run deploy` = migrations + `wrangler deploy`. One command, idempotent.
- Cron trigger (Workers scheduled event) drives reminder emails.
- Seed script doubles as the **grader package**: creates DevFlow-Conf-shaped demo data +
  persona credentials; README section "For evaluators" lists URLs + logins verbatim for
  `evalconfig.json` `credentials`/`submissionNotes`.
- GitHub public repo (Forge later if registration reopens — "very teeny" bonus).
  MIT license. CI: typecheck + unit tests + `sbek` smoke on PRs.

## 8. Verification plan (grade ourselves before they do)

1. **Continuous:** unit tests for the rule/scoping invariants (close-date lock, speaker
   isolation, hidden-speaker exclusion, decision≠email) — these are cheap to test and
   worth the most rubric weight.
2. **Daily:** run the real harness against the deployed URL:
   `npm run eval -- --url <ours> --agent-model claude-sonnet-5 --judge-model claude-opus-5`
   (~$2–10/run; use `--areas` subsets + `--resume` while iterating).
3. Work the **manual checklist** each run (email delivery, .ics opens, cross-account
   checks) — coverage below 60% withholds the headline score.
4. Keep scenarios **reachable**: `rule`/`scoping` checks run last in each scenario, so
   nav must be obvious (the agent tries `/admin`, `/portal`, labeled nav links). Boring,
   guessable routes are a grading feature.
5. Send swyx the MVP URL for early human feedback (he's offering DMs) — the final judge
   is the non-technical AIE team, not the harness.

## 9. Nice-to-haves (only after the rubric is green)

In rough value order:

1. `.ics` invite **updates** (same UID, SEQUENCE bump) when a room is assigned later —
   swyx described exactly this flow.
2. Decision-meeting view: live slot countdown by track; per-reviewer "my top-ranked, not
   yet accepted" queue; accept-with-condition note.
3. Assisted chasing: reminder **drafts** for human review alongside the automated sends.
4. "Resubmit with guidance" status + carry near-miss list into the CRM as an invite lane.
5. Airtable one-way sync (contacts/sessions → Airtable base; new-row automation
   friendly) — bonus points, read-only is fine per swyx; sync worker, never primary DB.
6. Public REST API docs page (the API exists regardless; this is just the docs polish).
7. Show-flow export: one document per event (final titles, full speaker lists, intro
   text, deck locations).
8. Email open/delivery tracking via Resend webhooks into `email_log`.

## 10. Milestones (now → Wed Aug 12, 10 PM PT)

| When | Deliverable |
|---|---|
| **M1 — Sun night** | Skeleton deployed: Worker + D1 + auth + seeded personas + event settings + CFP builder + public submission (CFP area passing locally) |
| **M2 — Mon** | Abstract management (plans, reviewer flow, results, disposition + email compose) + speaker roster/portal shell + first full eval run |
| **M3 — Tue** | Content mgmt (tasks, uploads, versions, comments, dashboard) + agenda builder + all five widgets + second eval run; fix `rule`/`scoping` reds |
| **M4 — Wed AM** | Speaker CRM (extra credit) + polish pass from eval report + manual checklist + performance pass |
| **M5 — Wed PM** | Freeze; final eval run; README-for-evaluators; submit form + repo + deployed URL |

Watch items: swyx's follow-up walkthrough video + requirements freeze; the eval repo may
get commits (re-pull daily); Gene's unanswered "review ethos 1–10" thread.
