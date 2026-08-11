# task-w3-g - J10 public surfaces + embed browser pass @ 0da9876

DEC-259 evidence lane (not a DEC-256 battery section, no FROZEN sha claim).
Base sha `0da9876` (`main` tip this branch was cut from, "merge task-w3-d").

## Method

Own worktree (`chautauqua-wt/task-w3-g`), `npm ci`, `npm run build`,
`npx playwright install chromium`. Fresh local D1: `wrangler d1 migrations
apply chautauqua --local` + `npm run seed`'s three steps (`scripts/seed.ts`
-> `.seed.sql` -> `wrangler d1 execute` -> `scripts/seed-r2.ts`). Booted
`npx wrangler dev --port 8835 --var PUBLIC_BASE_URL:http://localhost:8835`
against the seeded `devflow-conf-2027` event. Drove the checks with an ad
hoc Playwright script under `.scratch/` (deleted before this commit, per
the task's own instruction — nothing under `.scratch/` is part of the
diff). Console capture had no allowlist: any `page.on('console', 'error')`
or `pageerror` would have failed the corresponding check; none fired
across the whole sweep. No login was used anywhere except the one narrow
place the task explicitly permits it (the organizer-edit step of the ics
UID-stability check, since proving a *title edit* doesn't churn the UID
requires an authenticated PATCH).

To exercise the three distinct visibility gates against real fixture rows
(the seed data has no pre-built hidden/unaccepted/unapproved case), three
already-visible seeded submissions were flipped via direct `wrangler d1
execute` SQL for the duration of the sweep, then restored to their
original values via the real API/SQL afterwards: `seed_submission_0006`
content_status -> `pending` (content-unapproved), `seed_submission_0023`
status -> `submitted` (unaccepted), `seed_participant_0024` visible -> `0`
(hidden participant). All three were confirmed scheduled+visible
beforehand so they also exercise the agenda/schedule gate, not just
sessions/speakers. This is local dev-only test-data manipulation
(`.wrangler/` is gitignored) — no fixture literals or synthetic-id
assumptions were added to any product file.

## (1) Five surfaces

`/e/devflow-conf-2027/{sessions,speakers,agenda,schedule,gallery}` all
200, non-empty, zero console errors. Session cards under
`.chq-session-when` carry formatted date/time + room (`SessionSchedule` in
`src/routes/public/cards.tsx`, confirmed already covered by
`test/public.test.ts`'s EMB-01 suite — unchanged this task). Show-more
pagination link present with `page=N+1` param once `items.length <
total`. Keyword search (`?q=`) matches both submission title and speaker
first/last name server-side (`test/public.test.ts`'s EMB-02 suite,
unchanged, confirmed against the live server too — a search for a
speaker-only surname returned that speaker's sessions). Filters (`?
trackId=`) narrow correctly (existing behavior, unchanged). Speakers list
(`getPublicSpeakers` in `src/server/repo/public.ts`, not owned by this
lane) orders `asc(schema.contact.lastName), asc(schema.contact.firstName)`
— confirmed alphabetical by surname live, each card shows headshot (or
`.chq-headshot-fallback`)/title/company.

## (2) Itinerary picker + .ics

Checked two boxes on `/e/devflow-conf-2027/schedule`, confirmed
`localStorage`-backed picks (`chq_itinerary_<slug>`) and the `#chq-ics-
link` `?ids=` query survive a real `page.reload()`. Downloaded the
resulting `.ics`: `BEGIN:VEVENT` count matches the picked-session count,
real `UID:` lines present. Separately, as the organizer: exported
`schedule.ics?ids=<id>` for a scheduled+visible seed session, `PATCH
/api/v1/submissions/:id` to change its title, re-exported — **UID line is
byte-identical before/after**, `SUMMARY:` picks up the new title. Root
cause confirmed by reading `src/mail/ics.ts`: `uidFor()` is fed
`uidSubmissionId` only (`src/routes/public/index.tsx`'s schedule.ics
handler passes `item.submissionId`), title/description never enter the
UID derivation. New vitest regression pinning this at the route level:
`test/public.test.ts`, `describe("schedule.ics UID stability across a
title change (SPEC §5)")` — builds the same session at two different
titles through the fake-db-chain harness and asserts UID equality +
SUMMARY divergence.

## (3) Embed generator snippet

Copied `embedSnippet()`'s exact template (`app/src/pages/Settings.tsx`)
into a `data:text/html` host page and navigated Chromium to it. First
attempt failed with `net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` —
Chromium's Local Network Access feature treats a `data:` document as a
"public" opaque origin and blocks it from reaching a loopback target
(`localhost:8835`) without a user gesture/permission grant. This is a
browser policy triggered specifically by the test target being loopback;
it does not reproduce against a real deployed `PUBLIC_BASE_URL` host, and
`src/routes/public/shell.tsx`'s `EmbedShell` sets no frame-blocking
headers anywhere (confirmed by grep — no `X-Frame-Options` /
`Content-Security-Policy` in any server file). Re-ran with Chromium
launched with `--disable-features=LocalNetworkAccessChecks,
PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,
BlockInsecurePrivateNetworkRequests` (the standard way to neutralize this
loopback-only browser policy for local testing) and the iframe loaded and
rendered the real chromeless `Sessions` content (`<h2>Sessions</h2>`, zero
`nav.chq-nav` elements — confirms `EmbedShell`, not `PublicShell`, is
what's served). No product-code change needed or made; documented here as
a testing-environment caveat, not an OPEN ITEM.

## (4) Server-side visibility (raw `page.content()`, not the rendered DOM)

Visited all five `/e/<slug>/*` surfaces and all five `/embed/<slug>/*`
surfaces with the three flipped fixtures live (see Method) and grepped
`page.content()` for `seed_synth_contact_0021` (the hidden participant's
contact id), `seed_submission_0006` (content-unapproved), and
`seed_submission_0023` (unaccepted) — **zero matches on any of the ten
pages for any of the three**. Also confirmed via direct route hits: the
hidden participant's own `/e/<slug>/speakers/<contactId>` detail page and
both unapproved/unaccepted sessions' `/e/<slug>/sessions/<id>` detail
pages return 404; `schedule.ics?ids=<all three>` silently drops all three
(0 `VEVENT`s) rather than leaking them. The three gates are genuinely
distinct — each flip alone was sufficient to hide its submission/
participant, confirming `visibleSubmissionConditions()` ANDs all of
status/content_status/participant.visible (and DEC-108's invite-status
clause) rather than any single condition doing double duty.

## (5) Cache-Control + purge-on-write

`Cache-Control: public, max-age=60, stale-while-revalidate=300` present
on both `/e/*` and `/embed/*` GET responses (`setCacheHeaders`, `src/
routes/public/shell.tsx`). Purge-on-write: cached `/e/devflow-conf-2027/
gallery` (0 matches for the then-hidden `seed_synth_contact_0021`),
logged in as organizer, `PATCH /api/v1/submissions/seed_submission_0024/
participants/seed_participant_0024` with `{"visible":true}` (a real
mutation through the app, not direct SQL), re-fetched the same gallery
URL — now 1 match. Confirms `bumpPublicVersionMiddleware` (`src/server/
pubcache.ts`, global `app.use("*", ...)` in `src/server/app.ts`) actually
invalidates the version-salted cache key on a successful non-GET mutation.

## (6) Unknown event slug

`GET /e/no-such-slug-xyz/sessions` and `GET /embed/no-such-slug-xyz/
sessions` both return a real `404` status (not a 200 shell) with body
"Event not found." (`src/routes/public/index.tsx`'s `if (!event) return
c.text("Event not found.", 404)`, present on every surface handler
already).

## (7) Mobile (390x844)

DEC-253's `npm run gate:render-sweep` mobile pass already covers 13
no-login routes including all five `/e/<slug>/*` surfaces, two detail
drill-ins, and three of the five `/embed/<slug>/*` surfaces
(sessions/agenda/speakers) — not re-run standalone here since it's an
existing gate other lanes own/run; this task only needed to fill the two
`/embed/<slug>/*` surfaces the DEC-253 manifest doesn't cover:
`/embed/devflow-conf-2027/schedule` and `/embed/devflow-conf-2027/
gallery`. Both measured zero page-level horizontal overflow
(`document.scrollingElement.scrollWidth <= window.innerWidth + 1`) at
390x844. `BaseStyles` (`src/routes/public/shell.tsx`) applies to
`EmbedShell` identically to `PublicShell`, so the same DEC-253 CSS
(tap-target sizing, `.chq-agenda-day-scroll` horizontal scroll container)
covers embeds too — no separate embed-only styling exists to drift.

## Fixes made

None. Every check above passed against the code already on `main` at
`0da9876` with no edits to any owned route/lib/server file. One
regression test added (`test/public.test.ts`) to pin the ics UID-
stability finding from (2) against future regressions, since it wasn't
previously covered at the route level (only implicitly true by
`uidFor()`'s signature).

## Procedural notes (harness gotchas, for the scribe)

- Another concurrent worker's `pkill -f "wrangler dev"` (run against the
  main `chautauqua` checkout, not this worktree) killed this lane's
  `:8835` dev server mid-sweep — `pkill -f` matches by command line
  regardless of cwd/worktree, so any lane running a bare `wrangler dev`
  is killable by any other lane's `pkill`. Background wrangler dev
  processes should be treated as fragile; check `curl .../health` before
  trusting a long-running browser script and be ready to restart.
- Backgrounding a long-running process with a bare shell `&` inside a
  single Bash tool call does not survive past that tool call's process
  exit in this harness — use `run_in_background` or `nohup ... & disown`
  from a command that itself won't be torn down.
- This worktree's directory was wiped to bare `.scratch`/`.wrangler`
  mid-task by something outside this session (matches the harness
  worktree-reclamation gotcha task-w1-b logged) — no commit had landed
  yet so nothing was lost, but re-running `git worktree add <dir> -b
  <branch> main` failed twice (dir already existed with stale debris;
  branch already existed with no new commits) before `git worktree add
  <dir> <branch>` (checking out the existing branch, no `-b`) succeeded.
- `.wrangler/state/v3/cache` is the on-disk store backing `caches.default`
  under local `wrangler dev` and **persists across process restarts**
  (only clearing `.wrangler/state/v3/d1` clears seeded data, not the
  cache). Deleting that directory *while the dev server is still running*
  crashes every subsequent public-route request with an opaque `Error:
  internal error; reference = ...` (workerd's Cache binding throws when
  its backing storage disappears out from under a live isolate) — always
  stop the server first, or restart it fresh, before touching
  `.wrangler/state/v3/cache` on disk.

## OPEN ITEMS: 0

## RESULT: PASS
