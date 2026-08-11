# task-w11-d - render-sweep @ 84e2c04

FROZEN SHA: 84e2c04de087310f39877140cb6e239fab018e6c
WAVE-10 GATE: PASS
OPEN ITEMS: 2
RESULT: FAIL
RECHECK SHA: n/a

## Gate

`S=$(git rev-parse refs/heads/main)` = `84e2c04de087310f39877140cb6e239fab018e6c`, confirmed an ancestor of `refs/heads/main` via `git merge-base --is-ancestor`. Worked inside
`/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w11-d` (branch `task-w11-d`, checked out at `main`, which equalled `S` at worktree-creation time).

Seven-item WAVE-10 CONTENT GATE, each grepped at `S` with `git show "$S:<path>" | grep -c <pattern>`:

| id | check | count |
|----|-------|-------|
| G1 | `src/routes/root.tsx` contains `res.status !== 304` | 1 |
| G2a | `.dev.vars.example` contains `PUBLIC_BASE_URL=http://localhost:8787` | 1 |
| G2b | `src/server/origin.ts` contains `firstLoopbackCandidate` | 3 |
| G3 | `src/routes/public/index.tsx` sets `Cache-Control: no-store` on non-200 | 2 |
| G4a | `src/routes/agenda.ts` contains `parseBoundedInt` | 5 |
| G4b | `src/routes/agenda.ts` contains `gridMin: { min: 1, max: 480 }` | 1 |
| G5 | `src/server/repo/attribution.ts` contains `isNull(schema.participant.titleAtTime)` | 1 |
| G6a | `src/routes/api/forms.ts` contains `cascade` (409/`cascade=1` field delete) | 4 |
| G6b | `src/server/repo/forms.ts` contains `cascade` | 1 |
| G7 | `src/routes/api/events.ts` contains `name: "General"` at event create | 1 |

All seven items present at `S` on the first read (no polling needed). `WAVE-10 GATE: PASS`.

## npm run gate:render-sweep (scripts/render-sweep.ts) verdict, verbatim (trimmed to the pass/fail tables)

```
path                                                                            role       status
/admin/overview                                                                 organizer  PASS
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                        organizer  PASS
/admin/submissions/seed_submission_0001                                         organizer  PASS
/admin/speakers                                                                 organizer  PASS
/admin/content                                                                  organizer  PASS
/admin/agenda                                                                   organizer  PASS
/admin/comms                                                                    organizer  PASS
/admin/contacts                                                                 organizer  PASS
/admin/settings                                                                 organizer  PASS
/admin/review                                                                   organizer  PASS
/admin/review/plans/new                                                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  PASS
/admin/review                                                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 reviewer   PASS
/portal                                                                         speaker    PASS
/portal/submissions/seed_submission_0001                                        speaker    PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    PASS
/portal/profile                                                                 speaker    PASS
/portal/tasks                                                                   speaker    PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    PASS
/e/devflow-conf-2027/sessions                                                   public     PASS
/e/devflow-conf-2027/speakers                                                   public     PASS
/e/devflow-conf-2027/gallery                                                    public     PASS
/e/devflow-conf-2027/agenda                                                     public     PASS
/e/devflow-conf-2027/schedule                                                   public     PASS
/submit/devflow-conf-2027                                                       public     PASS
/account/password                                                               organizer  PASS
/account/password                                                               reviewer   PASS
/account/password                                                               speaker    PASS
/admin/*                                                                        organizer  PASS

34/34 routes passed

render-sweep: mobile pass (390x844)...

path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             40  PASS
/e/devflow-conf-2027/sessions                                 0             40  PASS
/e/devflow-conf-2027/speakers                                 0             40  PASS
/e/devflow-conf-2027/agenda                                   0             40  PASS
/e/devflow-conf-2027/schedule                                 0             40  PASS
/e/devflow-conf-2027/gallery                                  0             40  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001            0             40  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001               0             40  PASS
/embed/devflow-conf-2027/sessions                             0             40  PASS
/embed/devflow-conf-2027/agenda                               0             40  PASS
/embed/devflow-conf-2027/speakers                             0             40  PASS
/login                                                        0             40  PASS
/portal                                                       0             40  PASS

13/13 mobile routes passed
gate:render-sweep OK
```

`npm run gate:render-sweep` exits 0. All 34 desktop routes and 13 mobile-manifest routes (app/src/routeManifest.ts + scripts/render-sweep.ts's MOBILE_ROUTE_MANIFEST) are green: 200 status, non-empty rendered content, zero console errors, and (mobile pass) zero horizontal overflow / all primary controls >= 40px tall.

## Live browser sweep beyond the gate script's manifest

Ran `wrangler dev --port 8793` against the same migrated + `npm run seed`-loaded local D1/R2, then drove a headless Playwright chromium against surfaces the gate script does not enumerate: `/docs/api`, `/dev/mailbox` (+ message detail), the five `/embed/:slug/:surface` desktop renders, a public 404 (bad submission id and bad event slug), and cross-role permission-denied navigation (unauthenticated + wrong-role authenticated hits on `/admin/*` and `/portal`). Desktop viewport 1280x800, mobile 390x844 (DEC-253). Overflow computed the same way scripts/render-sweep.ts does: `document.scrollingElement ? document.scrollingElement.scrollWidth : document.body.scrollWidth` minus `window.innerWidth`.

One row per route x viewport, uncaught console errors, and a real visible-content string:

| route | viewport | status | console errors | content seen |
|---|---|---|---|---|
| `/docs/api` | desktop 1280x800 | 200 | 0 | "Chautauqua API — All endpoints below are namespaced under /api/v1. This page is public and requires no login." |
| `/docs/api` | mobile 390x844 | 200 | 0 | same text; page renders, no console error |
| `/dev/mailbox` | desktop 1280x800 | 200 | 0 | "Dev mailbox — 3 message(s) — page 1 — Recipient/Subject/Status/Sent/Event — bailey.kowalski@example-speakers.test — Your talk has been a..." |
| `/dev/mailbox` | mobile 390x844 | 200 | 0 | same table content renders |
| `/embed/devflow-conf-2027/sessions` | desktop | 200 (Cache-Control: `public, max-age=60, stale-while-revalidate=300`) | 0 | "Sessions — Search — All · AI Engineering · Platform & Infra · Developer Experience — 9 of 9 session(s)..." |
| `/embed/devflow-conf-2027/speakers` | desktop | 200 | 0 | "Speakers — Search by name — Toni Brightwell — Software Engineer, Junction Point..." |
| `/embed/devflow-conf-2027/agenda` | desktop | 200 | 0 | "Agenda — Wed, May 12 · Thu, May 13 · Fri, May 14 — 2027-05-12 — Main Stage — 9:00 AM-9:45 AM..." |
| `/embed/devflow-conf-2027/schedule` | desktop | 200 | 0 | "My schedule — Check sessions to build a personal itinerary. Your picks are saved in this browser..." |
| `/embed/devflow-conf-2027/gallery` | desktop | 200 | 0 | "Speaker gallery — Search by name — Toni Brightwell, Xan Chen, Alex Delgado..." |
| `/e/devflow-conf-2027/sessions/does-not-exist-xyz` (public 404, bad submission id) | desktop | **404**, `Cache-Control: no-store` (verified via Playwright response header, DEC-297) | 0 (only the expected "Failed to load resource: 404" network log, not an app-level console.error) | "Session not found." |
| `/e/no-such-event-slug-xyz/sessions` (public 404, bad event slug) | desktop | **404**, `Cache-Control: no-store` | 0 (same expected 404 network log) | "Event not found." |
| `/admin/overview` unauthenticated | desktop | server issues **302** `Location: /login` (confirmed via `curl -sD -`), Playwright follows to 200 | 0 | "Log in — Email — Password — Log in" |
| `/portal` unauthenticated | desktop | server issues **302** `Location: /login` | 0 | "Log in — Email — Password — Log in" |
| `/admin/overview` authenticated as **speaker** (wrong role) | desktop | redirected to `/portal` (200) | 0 | "DevFlow Conf 2027 — Welcome to the speaker portal! ... — Sign out — Dashboard \| Profile \| Tasks \| Resources — My Submissions" |
| `/admin/settings` authenticated as **reviewer** (wrong role) | desktop | redirected to `/admin/review` (200) | 0 | "Chautauqua — DevFlow Conf 2027 — New event... — Review — Sign out — Your evaluation plans — Program Committee Review..." |

Permission-denied behavior: unauthenticated hits on `/admin/*` and `/portal` get a server-side 302 to `/login` (not a client-rendered 403); authenticated-but-wrong-role hits (speaker -> `/admin/overview`, reviewer -> `/admin/settings`) land on that persona's own home surface rather than the requested admin page or an error — no console errors either way, no blank/skeleton screen.

### OPEN ITEMS (2)

1. **`/docs/api` at 390x844**: page-level horizontal overflow of **371px** (`document.scrollingElement.scrollWidth - window.innerWidth = 371`). Not in DEC-253's named surface list (`/submit/:slug`, the five `/e/:slug` surfaces, session/speaker detail, `/embed/:slug/:surface`, `/portal`, `/login`), but the task's render-sweep scope explicitly names `/docs` for the desktop+mobile sweep and the general bar ("a horizontal scrollbar or clipped control at 390px is an OPEN ITEM with the route named") applies. Route: `src/routes/docs.tsx` (`docsRoutes.get("/docs/api", ...)`), around the code-sample/endpoint-table markup — likely a wide `<pre>`/table without `overflow-x: auto` or `max-width: 100%` at narrow widths.
2. **`/dev/mailbox` at 390x844**: page-level horizontal overflow of **96px**. Not in DEC-253's named surface list either, same reasoning as above (task scope names `/dev/mailbox` explicitly). Route: `src/routes/dev/mailbox.tsx` (`devMailboxRoutes.get("/dev/mailbox", ...)`) — the message table (Recipient/Subject/Status/Sent/Event columns) is the likely culprit at 390px, same shape of problem DEC-253 already fixed for the public agenda grid.

No other overflow, no uncaught console errors, and no blank/skeleton-only screens found across the gate script's 34+13 routes or this sweep's 15 additional route x viewport checks.

## POST-S DELTA

```
$ git log --oneline 84e2c04de087310f39877140cb6e239fab018e6c..refs/heads/main -- src app migrations scripts test
(empty)
```

No product-path commits landed between `S` and the wave-12 read of `refs/heads/main` (`refs/heads/main` had already advanced past `S` by the time this delta was taken, since wave-11 lanes write verification logs concurrently, but none of those touch `src/`, `app/`, `migrations/`, `scripts/`, or `test/`).
