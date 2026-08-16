# Chautauqua

Chautauqua is an open-source speaker & event-content management platform — a
Sessionboard replacement. It handles the full producer/reviewer/speaker/public
lifecycle for a conference: launching a CFP, triaging and reviewing
submissions, deciding and notifying speakers, running onboarding, collecting
and approving session content, building the agenda, and publishing to public,
mobile-friendly event pages — all as **one deployable unit**: a single
Cloudflare Worker (Hono + D1/Drizzle + R2) serving the admin SPA, the
`/api/v1` REST API, server-rendered public pages, the speaker portal, and the
public CFP form. Licensed MIT — see [LICENSE](LICENSE).

## Live demo

**https://chautauqua.cc** — a deployed instance with a fully populated demo
event (*DevFlow Conf 2027*). Sign in at [/login](https://chautauqua.cc/login):

| Role | Email | Password | Lands on |
|---|---|---|---|
| Organizer | `sbek-organizer@example.com` | `SbekTest!2027-org` | `/admin` |
| Reviewer | `sbek-reviewer@example.com` | `SbekTest!2027-rev` | `/admin` (review queue) |
| Speaker | `sbek-speaker@example.com` | `SbekTest!2027-spk` | `/portal` |

No login needed for the public surfaces: [event hub](https://chautauqua.cc/) ·
[CFP form](https://chautauqua.cc/submit/devflow-conf-2027) ·
[sessions](https://chautauqua.cc/e/devflow-conf-2027/sessions) ·
[speakers](https://chautauqua.cc/e/devflow-conf-2027/speakers) ·
[agenda](https://chautauqua.cc/e/devflow-conf-2027/agenda) ·
[schedule + .ics](https://chautauqua.cc/e/devflow-conf-2027/schedule) ·
[gallery](https://chautauqua.cc/e/devflow-conf-2027/gallery) ·
[API docs](https://chautauqua.cc/docs/api)

The deployed instance sends **real email** from `hello@chautauqua.cc` via the
Cloudflare Email Service `send_email` Worker binding (DEC-996 amendment, wave
57; no API key, no secret), including `.ics` calendar invites as a raw MIME
part. `/dev/mailbox` (the local dev email sink) only mounts when
`DEV_MODE='1'` — it is deliberately unset on this deployed instance, so
`/dev/mailbox` is expected to 404 there (DEC-005/DEC-382 amendment); it is
not a broken link.

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

`npm run dev` builds the admin SPA bundle first via its `predev` hook (DEC-268),
so `/admin` works on a clean clone with no extra step.

While iterating on the admin SPA, run `npm run dev:app` in a second terminal —
it watch-rebuilds the Vite bundle that `wrangler dev` serves as static assets.

Run the test suite with `npm test`.

### Deploying

`npm run deploy` (`wrangler d1 migrations apply chautauqua --remote && wrangler
deploy`) applies any pending D1 migrations to the remote database before
deploying the Worker — one idempotent command, safe to re-run. It is
**operator-run only**: no CI job invokes it (see `.github/workflows/ci.yml`,
which never calls `wrangler deploy`), and it targets the real resources
declared in `wrangler.jsonc` (D1 database, KV namespace, `chautauqua-files`
R2 bucket, the `send_email` binding, the `chautauqua.cc` custom domain), so it
must never run from an untrusted context.

Test policy: workers run targeted tests (`npm run test:targeted -- <paths>`); the full suite is serialized through `scripts/with-test-lock.sh` (`npm test`).

**Deploy parity checklist** — variables `wrangler.jsonc`'s `vars` block must
carry for a deployed origin to behave like the local one, each with the
failure it causes if missing:

- `PUBLIC_BASE_URL` (**required**) — `resolveBaseUrl`/`resolveBaseUrlForCron`
  (`src/server/origin.ts`) fail loudly without it: emailed links
  (claim/portal/reset) can't be built, and bulk email sends 500 rather than
  silently emailing a broken/local host. This is load-bearing, not a
  footnote — `wrangler.jsonc` already sets it to `https://chautauqua.cc` for
  the live deploy target; any new deployed origin must set its own.
- `DEV_MODE` — must stay **unset** on a deployed origin. Its only effect is
  mounting `/dev/mailbox` (see "For evaluators" below); leaving it unset is
  what makes `/dev/mailbox` 404 in production, which is the designed
  behaviour, not breakage.
- `send_email` binding, `MAIL_FROM_EMAIL` — required for real outbound email;
  see "Stage-2 platform wiring" in `docs/AUDIT.md`.

`.dev.vars.example` (copied to your gitignored `.dev.vars` on first `predev`
run) ships `PUBLIC_BASE_URL=http://localhost:8787` so emailed links
(claim/portal) resolve on the default port even though `wrangler.jsonc`'s
`routes`/`custom_domain` entry would otherwise make them resolve to the
production host under local `wrangler dev` (DEC-296). If you need to run on a
non-default port (e.g. because 8787 is busy), run `npm run predev` yourself
first and pass `--var` on the `wrangler dev` invocation — do **not** invoke
`npx wrangler dev` directly, since that skips the `predev` hook that both
builds the admin SPA bundle (`/admin` 500s without it) and creates
`.dev.vars` from `.dev.vars.example` (`DEV_MODE` stays unset without it, so
`/dev/mailbox` 404s — DEC-005/DEC-183):

```sh
npm run predev
npx wrangler dev --port 8801 --var PUBLIC_BASE_URL:http://localhost:8801
```

(DEC-252/DEC-296; see `src/server/origin.ts`).

### Dev: migrations

Migrations under `migrations/*.sql` are hand-authored, not drizzle-kit
generated (DEC-164/DEC-263/DEC-308). `drizzle-kit` is **not installed** in
this repo — `migrations/meta/` only has snapshots for `0000`-`0004`, so
`drizzle-kit generate` would diff `src/db/schema.ts` against that stale
snapshot and emit a spurious migration re-creating tables and columns that
already exist. There is no `db:generate` script for this reason; when the
schema changes, hand-author the next-numbered `migrations/NNNN_*.sql` file
yourself. `test/migration-parity.test.ts` is the real guard: it parses every
`migrations/*.sql` file and asserts that every table/column exported from
`src/db/schema.ts` has a creating migration, so a fresh clone's `npm run
db:migrate` always produces the schema the code expects.

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
  forms, submit/save-draft/sign-out buttons) measures >= 44px tall (tap-target
  size)

It prints its own PASS/FAIL table + summary and fails the gate (non-zero
exit) on any mobile-route failure, independent of the desktop pass. Route
list: `MOBILE_ROUTE_MANIFEST` in `scripts/render-sweep.ts`; pass criteria +
unit tests: `scripts/render-sweep-lib.ts`'s `evaluateMobileRoute` and
`test/render-sweep-lib.test.ts`.

Finally, the gate runs a third **admin mobile pass** (DEC-387), **advisory**:
it re-visits every organizer + reviewer entry of `app/src/routeManifest.ts`
(`ROUTE_MANIFEST`) — the `/admin/*` catch-all excluded — at the same 390x844
viewport, logged in as the seeded organizer and reviewer personas. It reuses
the same `evaluateMobileRoute` pass criteria (zero horizontal overflow, every
primary control >= 44px tall) but with the redesign's own control selector
(`.chq-tabbar a`, `.chq-tabbar button`, `.chq-btn`, `.chq-input`,
`.chq-select`, `header nav a`, visible only). It prints its own PASS/FAIL
table + summary; whether this pass's failures flip the gate's exit code is
governed by `ADMIN_MOBILE_PASS_BLOCKING` (in `scripts/render-sweep-lib.ts`).
That constant lands `true` today — the flip rule (documented verbatim on the
constant) fired the wave after this pass first read all-PASS (DEC-431), so
the admin mobile pass now blocks the gate. Route list:
`ADMIN_MOBILE_ROUTE_MANIFEST` in `scripts/render-sweep.ts`; unit tests for
the manifest and the advisory constant live alongside the public mobile pass's
tests in `test/render-sweep-lib.test.ts`.

### Dev: perf smoke / scale gate — ordered recipe

`npm run perf:smoke` (and `gate:scale`, below) both log in as the seeded
**organizer** identity read from `docs/fixtures/sample-data.json`. That user
row is created by the demo seed (`npm run seed`/`scripts/seed.ts`), not by
`perf-seed.ts` — `perf:seed`/`perf:seed:aie` add perf-scale rows (2k+
submissions/contacts, a reviewer user of their own) on top of an
already-seeded org, they never create the organizer user themselves. Running
`perf:seed` against a fresh/unseeded DB skips straight to a login 401
(`POST /login failed: expected 302, got 401`) because that organizer login
doesn't exist yet. The ordered recipe, always:

```sh
npm run seed        # creates the organizer identity perf:smoke logs in as
npm run perf:seed   # or perf:seed:aie — adds the perf-scale rows
npm run dev          # in another terminal, migrated + running
npm run perf:smoke  # or perf:smoke:aie / gate:scale
```

### Dev: scale gate

`npm run gate:scale` turns docs/mandates/scale-mandate.md's "Functional
bars" section into an executable check against the `aie` perf profile
(2,500 submissions / 6,000 contacts / 280 accepted sessions — see
`PERF_PROFILES.aie` in `scripts/perf-seed-lib.ts`). It does NOT reseed
itself, and depends on the ordered recipe above (`npm run seed` before
`npm run perf:seed:aie`); run these two steps first:

```sh
npm run perf:seed:aie
npm run dev   # in another terminal, migrated + running
npm run gate:scale
```

It prints PASS/FAIL per bar (bulk status at 500+ selected, auto-schedule
reason coverage, reminders' `{sent, skipped, remaining}` honesty, Overview's
row cap, `contacts/duplicates` latency) and exits non-zero on the first
failing bar with the observed numbers. Evaluators are pure functions in
`scripts/stress-bars.ts`, unit-tested in `test/stress-bars.test.ts`; the
walkthrough in `scripts/walkthrough/stress.ts` only gathers observations via
real HTTP calls and reports them.

### Dev: docs screenshot shoot

`npm run shots:docs` is an OPERATOR command, run at freeze time against an
already-migrated, already-seeded `npm run dev` — it is never run in CI and
never part of `npm test`. It reads the declared manifest in
`scripts/docs-shots-lib.ts` (`DOCS_SHOTS`), logs in via the real `/login`
form as whichever seeded persona each route needs (resolved from
`app/src/routeManifest.ts`), and writes one full-frame PNG per row to
`public/docs/shots/<id>.png` at exactly 1600×900 —
docs/design/DESIGN-RULINGS.md:308-316's "Screenshot rules": from the real
app, seeded `DevFlow Conf 2027` data only, full frames never crops, no
drawn annotation, re-shot every release.

```sh
npm run seed
npm run dev   # in another terminal, migrated + running
npm run shots:docs
```

It aborts the whole run — no placeholder image, no catch-and-continue — on
a route that doesn't return 200, a missing seeded `DevFlow Conf 2027`
event, a route it can't resolve to exactly one persona, or a shot id
repeated within one run. Serialized through `scripts/with-test-lock.sh`
like the other heavy gates.

## For evaluators

**[docs/AUDIT.md](docs/AUDIT.md)** is a self-audit: what each SPEC.md area actually does
today, every degraded/capped behavior and its exact limit, what is deliberately not built,
and what is stage-2 platform wiring rather than a product gap. `test/audit-claims.test.ts`
mechanically enforces two things it names: every route path in backticks resolves against
the real route manifest (DEC-618), and every bullet in the "Deliberately not built" section
carries an HTML-comment absence marker (`file:`/`symbol:`/`route:`) that the test resolves
against the tree and fails on if the named artefact turns out to exist (DEC-642). Nothing
else in the document is machine-checked — read it, don't just trust the badge.

| Surface | Route |
|---|---|
| Admin SPA (organizer/reviewer console) | `/admin` |
| Login | `/login` |
| Speaker portal | `/portal` |
| Public event hub (instance landing page) | `/` |
| Public CFP submission form | `/submit/<event-slug>` |
| Public sessions list | `/e/<event-slug>/sessions` |
| Public speakers list | `/e/<event-slug>/speakers` |
| Public agenda (day grid) | `/e/<event-slug>/agenda` |
| Public schedule (personal itinerary + calendar export) | `/e/<event-slug>/schedule` |
| Calendar export (.ics) | `/e/<event-slug>/schedule.ics` |
| Whole-agenda calendar feed (.ics) | `/e/<event-slug>/agenda.ics` |
| Printable programme (print-first, all days) | `/e/<event-slug>/programme` |
| Public speaker gallery | `/e/<event-slug>/gallery` |
| Embeddable widget (any surface, chromeless) | `/embed/<event-slug>/<surface>` |
| Dev mailbox (dev-only email sink — every sent email, including CFP confirmation and onboarding-task reminder emails, is viewable here; requires `DEV_MODE='1'` — **404s by design on the deployed instance**, DEC-005/DEC-382 amendment) | `/dev/mailbox` |
| Public API docs (auth, envelopes, endpoint table) | `/docs/api` |

`/dev/mailbox` and `/docs/api` are operator chrome (DEC-382/DEC-582 amendment), not
part of the user-facing product surfaces above — the `/docs` site (when present) reaches
`/docs/api` only as a labelled, muted "leaves the docs" link, never as an article.

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

Stage-2 platform wiring has **landed** on `main`: `wrangler.jsonc` carries a
real D1 `database_id`, a real KV `id`, the `chautauqua-files` R2 bucket, the
`send_email` Email Service binding, `MAIL_FROM_EMAIL`/`PUBLIC_BASE_URL` vars,
the `chautauqua.cc` custom domain, a `*/15 * * * *` cron trigger, and
`placement: { mode: "smart" }`. `src/mail/email-binding.ts`
(`EmailBindingMailer`) sends real mail through that binding — no dev-sink
fallback in production — and the composition root
(`src/server/context.ts`) selects it whenever the `EMAIL` binding and
`MAIL_FROM_EMAIL` are present; `src/mail/dev-sink.ts`'s `DevSinkMailer` stays
the local/CI implementation (`/dev/mailbox`), and `src/mail/unconfigured.ts`'s
`UnconfiguredMailer` is the fail-loud fallback if neither is wired. Deploys
are **operator-run**, not CI-run: `npm run deploy` (see "Deploying" above)
applies migrations then deploys; no job in `.github/workflows/ci.yml` calls
`wrangler deploy`.

What is genuinely still unwired:

- **Airtable one-way sync** (`src/sync/airtable.ts`, `runAirtableSync`) —
  secret-gated and off by default. It requires `AIRTABLE_TOKEN` +
  `AIRTABLE_BASE_ID` (absence is a valid, non-error "off" state) and, once
  those are set, `AIRTABLE_ORG_ID` (one Airtable base serves exactly one org;
  a configured-but-unscoped sync throws rather than pushing one tenant's rows
  into another tenant's base). None of the three is present in
  `wrangler.jsonc` today, so the cron tick that would call it is a no-op.
- **Sessionboard-API importer** — see Roadmap below; it needs a Sessionboard
  API key Chautauqua does not have, so it isn't buildable yet, let alone
  wired.

## Roadmap

Sessionboard exposes a public API (sessionboard.mintlify.app). A
Sessionboard-API importer — pulling an org's existing events and contacts into
Chautauqua — is the difference between "a nice clone" and "we can actually
cancel the contract." It isn't buildable without a Sessionboard API key, so it
isn't in stage 1; it's the top of the post-competition roadmap.
