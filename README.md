# Chautauqua

Chautauqua is an open-source speaker & event-content management platform — a
Sessionboard replacement. It handles the full producer/reviewer/speaker/public
lifecycle for a conference: launching a CFP, triaging and reviewing
submissions, deciding and notifying speakers, running onboarding, collecting
and approving session content, building the agenda, and publishing to public,
mobile-friendly event pages — all as **one deployable unit**: a single
Cloudflare Worker (Hono + D1/Drizzle + R2) serving the admin SPA, the
`/api/v1` REST API, server-rendered public pages, the speaker portal, and the
public CFP form. Licensed MIT.

## Quickstart

Stage 1 requires zero secrets — everything runs against local Miniflare-backed
D1/R2, with email delivered to a dev sink instead of a real provider.

```sh
npm i
npm run db:migrate
npm run seed
npm run dev
```

This installs dependencies, applies migrations to a local D1 database, seeds a
fully-populated demo event (see "For evaluators" below), and starts
`wrangler dev`.

While iterating on the admin SPA, run `npm run dev:app` in a second terminal —
it watch-rebuilds the Vite bundle that `wrangler dev` serves as static assets.

Run the test suite with `npm test`.

If you run `wrangler dev` on a non-default port (e.g. `npx wrangler dev --port
8801`), also pass `--var PUBLIC_BASE_URL:http://localhost:8801` so emailed
links (claim/portal) point at that port instead of being inferred from
request headers (DEC-252; see `src/server/origin.ts`).

### Dev: render-sweep gate

`npm run gate:render-sweep` boots its own migrated + seeded `wrangler dev` on
a free local port, then uses Playwright chromium to visit every route in
`app/src/routeManifest.ts` (organizer/reviewer/speaker/public) and asserts a
200 status, non-empty rendered content, and zero console/page errors. It
prints a PASS/FAIL table and exits non-zero on any failure. One-time setup:

```sh
npx playwright install chromium
```

Not part of `npm test` (it needs to boot a server itself); run it explicitly.

After the desktop pass, the gate runs a second **mobile pass** (DEC-253): the
same booted server is re-visited at a 390x844 (phone-sized) Playwright
viewport across every no-login surface — `/submit/<slug>`, the five public
`/e/<slug>/*` surfaces plus one session and one speaker detail drill-in, the
three `/embed/<slug>/*` surfaces, `/login`, and `/portal` (logged in as the
seeded speaker). For each route it asserts:

- zero page-level horizontal overflow
  (`document.scrollingElement.scrollWidth <= window.innerWidth + 1px`)
- every primary nav/filter/submit control (surface nav, search/track-filter
  forms, submit/save-draft/sign-out buttons) measures >= 40px tall (tap-target
  size)

It prints its own PASS/FAIL table + summary and fails the gate (non-zero
exit) on any mobile-route failure, independent of the desktop pass. Route
list: `MOBILE_ROUTE_MANIFEST` in `scripts/render-sweep.ts`; pass criteria +
unit tests: `scripts/render-sweep-lib.ts`'s `evaluateMobileRoute` and
`test/render-sweep-lib.test.ts`.

## For evaluators

| Surface | Route |
|---|---|
| Admin SPA (organizer/reviewer console) | `/admin` |
| Login | `/login` |
| Speaker portal | `/portal` |
| Public CFP submission form | `/submit/<event-slug>` |
| Public sessions list | `/e/<event-slug>/sessions` |
| Public speakers list | `/e/<event-slug>/speakers` |
| Public agenda (day grid) | `/e/<event-slug>/agenda` |
| Public schedule (personal itinerary + calendar export) | `/e/<event-slug>/schedule` |
| Calendar export (.ics) | `/e/<event-slug>/schedule.ics` |
| Public speaker gallery | `/e/<event-slug>/gallery` |
| Embeddable widget (any surface, chromeless) | `/embed/<event-slug>/<surface>` |
| Dev mailbox (dev-only email sink — every sent email, including CFP confirmation and onboarding-task reminder emails, is viewable here) | `/dev/mailbox` |
| Public API docs (auth, envelopes, endpoint table) | `/docs/api` |

Seeded demo event slug: `devflow-conf-2027`

Seeded persona credentials (verbatim from `docs/fixtures/sample-data.json`, as
loaded by `scripts/seed.ts`):

| Persona | Email | Password |
|---|---|---|
| Organizer (producer/admin) | `sbek-organizer@example.com` | `SbekTest!2027-org` |
| Speaker | `sbek-speaker@example.com` | `SbekTest!2027-spk` |
| Speaker (second) | `sbek-speaker2@example.com` | `SbekTest!2027-spk2` |
| Reviewer | `sbek-reviewer@example.com` | `SbekTest!2027-rev` |

### Verification

With `npm run dev` up (after `db:migrate` + `seed`), `npm run walkthrough`
walks J1->J12 end to end as the producer, reviewer, speaker, public, and data
personas in sequence against the seeded `devflow-conf-2027` event. It's
enforced in CI (`.github/workflows/ci.yml`, `walkthrough` job) on every push.

## The twelve jobs

Each job (SPEC.md §1) is a persona workflow, walked start-to-finish; the
screen(s) below are where it lives.

| Job | Summary | Screen(s) |
|---|---|---|
| J1 | Launch a CFP: create event, configure the default form, custom questions, tracks, close date, share the link | Admin → Overview / Settings / Submissions → Forms |
| J2 | Submit a talk without an account, get a confirmation email with a portal-claim link | `/submit/<event-slug>`, `/claim/:token`, dev mailbox |
| J3 | Triage submissions at volume: table, saved views, filters, bulk status change | Admin → Submissions |
| J4 | Run committee review in waves: evaluation plans, per-track reviewer assignment, scorecards, results | Admin → Review; reviewer queue |
| J5 | Decide (status change, never auto-email) then notify deliberately via templated, previewed, logged sends | Admin → Submissions (decide); Admin → Comms (notify) |
| J6 | Acceptance auto-creates onboarding tasks; producer watches a per-speaker × per-task dashboard; cron-driven reminders | Admin → Speakers (onboarding grid) |
| J7 | Speakers self-serve: submissions, tasks, sessions, resources, profile edits, invitation accept/decline | `/portal` |
| J8 | Collect, review, and approve session content: typed uploads, versioning, comment threads, approval status | Admin → Content; `/portal` uploads |
| J9 | Build the agenda: unscheduled tray, drag-to-slot, surfaced (non-blocking) conflicts, auto-schedule | Admin → Agenda |
| J10 | Publish continuously: five public no-login surfaces plus copyable embeds, visibility-filtered at the query | `/e/<event-slug>/*`, `/embed/<event-slug>/<surface>` |
| J11 | Org-level contact directory: search, custom fields, CSV import, merge, segments, bulk email | Admin → Contacts |
| J12 | Own your data: CSV/JSON exports everywhere, the `/api/v1` REST API, optional Airtable sync | Admin → Settings (API tokens/exports); `/api/v1/*` |

## Stage 2 (deferred platform wiring)

Everything below sits behind a port today and runs with local, zero-secret
implementations in stage 1; stage 2 is swapping in the real adapters and
provisioning a live deployment:

- Cloudflare account provisioning (real D1/R2 resources) and `wrangler deploy`
  to a live Worker.
- Resend adapter for the mailer port, replacing the dev-sink email
  implementation (`/dev/mailbox`).
- Airtable one-way sync (contacts/sessions → base).
- Custom domains and CI-driven deploys.

## Roadmap

Sessionboard exposes a public API (sessionboard.mintlify.app). A
Sessionboard-API importer — pulling an org's existing events and contacts into
Chautauqua — is the difference between "a nice clone" and "we can actually
cancel the contract." It isn't buildable without a Sessionboard API key, so it
isn't in stage 1; it's the top of the post-competition roadmap.
