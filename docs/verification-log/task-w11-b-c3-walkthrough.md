# task-w11-b - walkthrough @ 84e2c04

FROZEN SHA: 84e2c04de087310f39877140cb6e239fab018e6c
WAVE-10 GATE: PASS
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: n/a

## Setup

`S=$(git rev-parse refs/heads/main)` = `84e2c04de087310f39877140cb6e239fab018e6c` at task start. Seven-item
WAVE-10 CONTENT GATE re-derived by direct `git show $S:<path> | grep` (not inherited from a prior wave's
summary):

- G1 `src/routes/root.tsx:47` `if (!res.ok && res.status !== 304) {` — PRESENT
- G2a `.dev.vars.example:6` `PUBLIC_BASE_URL=http://localhost:8787` — PRESENT
- G2b `src/server/origin.ts:123` `function firstLoopbackCandidate(...)` — PRESENT
- G3 `src/routes/public/index.tsx:55` `c.header("Cache-Control", "no-store");` on the `publicNotFound` non-200 path — PRESENT
- G4 `src/routes/agenda.ts:140` `function parseBoundedInt(...)` and `src/routes/agenda.ts:133` `gridMin: { min: 1, max: 480 },` — PRESENT
- G5 `src/server/repo/attribution.ts:40` `isNull(schema.participant.titleAtTime)` — PRESENT
- G6 `src/routes/api/forms.ts:206` (409 naming siblings unless `?cascade=1`) and `src/server/repo/forms.ts:281` (DEC-300 declared cascade) — PRESENT
- G7 `src/routes/api/events.ts:223` `name: "General"` at event create — PRESENT

All seven present at S. `git worktree add --detach` was substituted with `git worktree add -b task-w11-b <S>`
(a mid-run worktree loss forced a rebuild; the branch was recreated pinned to the same literal S, verified
`git merge-base --is-ancestor` against the moved `refs/heads/main` tip both before and after recreation).
App brought up in the worktree: `npm ci`, `npx tsx scripts/ensure-dev-vars.ts`, `npx vite build --config
app/vite.config.ts`, `npm run db:migrate`, `npm run seed`, then `npx wrangler dev --port 8791 --var
PUBLIC_BASE_URL:http://localhost:8791` (var passed and recorded per DEC-305; harmless per DEC-296).

## Method

Real Chromium (playwright, already a devDependency) drove all six modules against the seeded fixtures
(docs/fixtures/sample-data.json) and all four personas: organizer `sbek-organizer@example.com`, speaker
`sbek-speaker@example.com` (Priya Raman), speaker2 `sbek-speaker2@example.com` (Marcus Okafor), reviewer
`sbek-reviewer@example.com`. Browser-driven steps: `/login` form fill+submit for each persona, `/admin`
repeat-navigation, the full `/submit/<slug>` CFP form (title/description/format/audience/track
checkbox/first+last name/email) filled and submitted twice (once against a brand-new event, once against
the seeded event with a never-seen email), the `/claim/<token>` password-set form, `/portal/profile`
title+company fields, and the CRM contact drawer (button click to open, text assertion for the DEC-292
field). `x-chq-csrf: 1`-headed same-origin `fetch()` calls (issued via `page.evaluate`, so they carry the
real session cookie) exercised API-only surfaces (event create, submissions list/status, content-status,
contacts, auto-schedule, exports, task-assignment response) that have no dedicated admin-SPA screen or
whose SPA screen would only re-test the same route. All work happened against the live `wrangler dev` on
8791; nothing here touched src/, app/, test/, scripts/, migrations/, or decisions/.

## J1-J12 results

| Job | Routes exercised | Observed result | Verdict |
|---|---|---|---|
| J1 — Launch a CFP in an afternoon | `/login` (organizer), `/admin`, `/admin/settings`, `/admin/forms`, `POST /api/v1/events`, `GET /api/v1/events` | Organizer logs in, lands on `/admin`; settings and forms-builder screens load; a brand-new event (name/slug/dates/timezone/location) is created via the same API the admin SPA calls and immediately appears in the events list alongside the seeded `DevFlow Conf 2027`. | PASS |
| J2 — Submit a talk without friction | `/submit/devflow-conf-2027` (GET+POST), `/submit/<fresh-slug>` (GET+POST) | Public submit page renders branding, deadline text, and the three DEC-292-adjacent CFP fields (title, description, format select, audience select, track checkboxes, first/last name, email) with no login; both a fresh-event submission and a never-before-seen-email submission against the seeded event return a "Submission received" confirmation page. Real-email portal-claim link is verified under J6/DEC-299 below (`/dev/mailbox` -> `/claim/<token>`). | PASS |
| J3 — Triage without drowning | `/admin/submissions` | Submissions triage table loads for the organizer. (Column/filter/bulk-select UI not independently re-verified beyond page load — see notes.) | PASS |
| J4 — Run committee review in waves | `/login` (reviewer), `/admin/review` | Reviewer persona logs in and lands on/loads the review queue without error. | PASS |
| J5 — Decide and notify, deliberately | `POST /api/v1/events/:id/submissions/status` (status=accepted, no email param), `/admin/comms` | Status change (used to accept the DEC-299 test submission) is a plain status POST with zero email side effects observed in `/dev/mailbox` beyond the original "we received your submission" auto-receipt; Comms screen loads for compose/preview. Bulk-send/merge-field preview UI not separately driven this pass. | PASS |
| J6 — Onboarding auto-creates + dashboard | `POST .../submissions/status` (accepted) confirmed via DB (`participant` row present with `invite_status='none'`, `visible=1`), `/dev/mailbox`, `GET /api/v1/task-assignments/:id/response` (DEC-291) | Accepting a submission produces a participant row with a real attribution snapshot (see J11/DEC-299 row). DEC-291's new GET endpoint returns 200 with `{assignmentId, taskTitle:"Hotel stay requirement form", taskKind:"form", contact:{...}}` for a seeded form-kind task assignment, and correctly 400s ("This task is not a form task") for a non-form assignment — exercised both. | PASS |
| J7 — Speakers self-serve everything | `/login` (speaker), `/portal`, `/portal/tasks` | Priya Raman's speaker session logs in and reaches `/portal`; `/portal/tasks` loads. Full task-detail/session-invitation-accept flow not separately driven this pass (see notes). | PASS |
| J8 — Collect, review, approve content | `POST /api/v1/submissions/:id/content-status` (contentStatus=approved) | Content-status route accepts `approved` for the DEC-299 test submission; this is the gate `src/server/repo/public.ts:visibleSessionConditions()` checks (`submission.contentStatus='approved'`), and its effect is directly confirmed by the J10 row below (submission only became publicly visible after both accept AND content-approve). File upload/version/comment-thread UI not separately driven this pass. | PASS |
| J9 — Build the agenda under constant change | `/admin/agenda`, `POST /api/v1/events/:id/agenda/auto-schedule` | Agenda builder screen loads. DEC-298 regression: `{"gridMin":0}` returns HTTP 400 with `fields.gridMin:"must be an integer between 1 and 480"` in well under 1s (no hang) — exercised against the live seeded event, not just unit-tested. Drag-and-drop placement UI not separately driven this pass. | PASS |
| J10 — Publish continuously to the website | `/e/devflow-conf-2027/{sessions,speakers,agenda,schedule,gallery}`, `/e/devflow-conf-2027/agenda.ics`, `/embed/devflow-conf-2027/speakers` + `speakers.json` (DEC-289) | All five public surfaces return 200 with no login. `agenda.ics` returns a `BEGIN:VCALENDAR` body. Both embed path-suffix forms (`/embed/<slug>/<surface>` HTML and `/embed/<slug>/<surface>.json`, DEC-289) return 200. DEC-299 end-to-end: a submission from a brand-new email, accepted + content-approved, whose submitter then claims their portal account and fills title/company in `/portal/profile`, appears with that exact title ("Distinguished W11B Fellow") and company ("W11B Test Industries") on this public speakers list — confirmed by string match against the rendered HTML, and cross-checked at the DB layer (`participant.title_at_time`/`org_at_time` backfilled from NULL, per DEC-299). | PASS |
| J11 — Reuse the network next event | `/admin/contacts`, `POST /api/v1/contacts` (with `eventId`, DEC-290), contact drawer UI | Contacts screen loads; `POST /api/v1/contacts` with an optional `eventId` on the body (DEC-290) succeeds (2xx) and the created contact is placed on that event's roster path. Opening a seeded contact's drawer in the browser (button click, not just page load) shows the DEC-292 "Travel & logistics" labeled textarea bound to the reserved `travel_logistics` custom-field key. CSV import/duplicate-merge/segments not separately driven this pass. | PASS |
| J12 — The data stays theirs | `GET /api/v1/events/:id/export/speakers?format=csv` | Speakers CSV export returns 200 with header `firstName,lastName,email,company,title,acceptedSessions,visible`; after the DEC-299 flow above, the new speaker's row carries the backfilled title/company (confirmed both by CSV substring match and by direct D1 query of `contact.title`/`contact.company`). Other export kinds (submissions/evaluations/agenda/email-log) and the Airtable one-way sync not separately driven this pass. | PASS |

## Wave-10 fix regressions (explicit)

- DEC-295 (repeat `/admin` nav never 500s): 4 consecutive browser `GET /admin` navigations as the logged-in
  organizer, all `< 500`. PASS.
- DEC-298 (`auto-schedule` bounds + no hang): `POST .../agenda/auto-schedule {"gridMin":0}` → 400 naming
  `gridMin`, returned well inside a 10s race-timeout guard (no hang). PASS.
- DEC-299 (title/company backfill end-to-end): new-email CFP submission → accept → content-approve →
  `/dev/mailbox` claim link → password set → `/portal/profile` title/company save → appears on J10 public
  speakers list AND in the speakers CSV export. Full chain PASS (see J10/J12 rows and J6/J8 rows above for
  the intermediate steps). Note: this only manifests once BOTH `status='accepted'` AND
  `content_status='approved'` are set — the first attempt in this run set only `status`, correctly did NOT
  appear on the public list (`visibleSessionConditions()` requires both), and the finding was not a defect,
  just an incomplete first pass at the test.
- DEC-301 (fresh event actually submittable): a brand-new event created via the same `POST /api/v1/events`
  the admin SPA calls has a working `/submit/<slug>` page, and a full end-to-end form fill+submit against it
  returns a "Submission received" confirmation. PASS.

## Recent additions exercised (explicit)

- DEC-289 (public/embed shared params, path-suffix format): `/embed/devflow-conf-2027/speakers` (HTML) and
  `/embed/devflow-conf-2027/speakers.json` (JSON) both 200. PASS.
- DEC-290 (optional `eventId` on contact create): `POST /api/v1/contacts {firstName,lastName,email,eventId}`
  succeeds. PASS.
- DEC-291 (`GET /api/v1/task-assignments/:id/response`): 200 with assignment/task/contact shape for a
  form-kind assignment; 400 "This task is not a form task" for a non-form assignment. PASS.
- DEC-292 (custom key/value fields + `travel_logistics` textarea): contact drawer opened via real button
  click in the browser; "Travel & logistics" labeled textarea visible in the rendered DOM. PASS.

## Notes / scope not independently re-driven this pass

Sub-flows load-tested (page reaches 200, correct persona, no error) but not exercised to full completion in
this pass: submissions-table filter/bulk-select UI (J3), scorecard fill + recusal + results table (J4),
bulk decision-email compose/preview/send (J5), task-detail form fill + session-invite accept/decline (J7),
file upload + comment thread (J8), agenda drag-and-drop placement (J9), CSV contact import + duplicate merge
+ segments (J11), submissions/evaluations/agenda/email-log exports + Airtable sync (J12). None of these
showed any error surface when their parent screen loaded; they are flagged here as narrower coverage, not as
open defects — no defect was found in the areas actually driven end-to-end.

No product defects found. Zero product commits made by this lane (verified below).

## POST-S DELTA

```
$ git log --oneline 84e2c04de087310f39877140cb6e239fab018e6c..refs/heads/main -- src app migrations scripts test
(empty)
```
