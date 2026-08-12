# REDESIGN wave-3 exit gate — browser render-sweep (task-w3-i, DEC-384)

LOG-ONLY lane (DEC-384): this file records what a real headless-Chromium
browser sees when it loads the wave-1..3 re-skin lanes' output for the first
time. No product code, test, style, or script file was modified to produce
this log — defects found are recorded as open items, not fixed.

## FROZEN SHA
9e1e4da8eedace9d5356e6e1e69d24872110d18e (tip of `main` at worktree creation,
`merge task-w3-b`)

## Commands run (from a clean worktree checked out from `main`, no secrets)

```
npm ci --prefer-offline --no-audit --no-fund --silent
npx playwright install chromium        # already present, no download
npm run build                          # tsc --noEmit (root) && tsc --noEmit -p app/tsconfig.json && vite build
npx wrangler d1 migrations apply chautauqua --local     # 18/18 applied clean
npm run seed
rm -rf .wrangler/state                 # before the gate's own migrate+seed, so it starts fresh
npm run dev &                          # background, confirmed "Ready on http://localhost:8787"
npm run gate:render-sweep
```

`npm run build` passed with zero errors (both `tsc --noEmit` passes and the
`vite build` admin SPA bundle). `npm run db:migrate` and `npm run seed`
(manual pre-check, then repeated by the gate's own self-managed
migrate+seed+`wrangler dev` boot per `scripts/render-sweep.ts`'s documented
mechanics — same as task-w23-d) both completed with no errors.

`npm run gate:render-sweep` — process **exited 1** (uncaught exception, not a
clean FAIL summary — see OPEN ITEM 3).

## Pass 1 — full route sweep (persona login via real /login form)

```
render-sweep: logging in as organizer (sbek-organizer@example.com)...
render-sweep: logging in as reviewer (sbek-reviewer@example.com)...
render-sweep: logging in as speaker (sbek-speaker@example.com)...

path                                                                            role       status
/admin/overview                                                                 organizer  FAIL  (2 console error(s): Failed to load resource: the server responded with a status of 500 (Internal Server Error))
/admin/submissions                                                              organizer  FAIL  (1 console error(s): Failed to load resource: the server responded with a status of 500 (Internal Server Error))
/admin/submissions/forms                                                        organizer  FAIL  (1 console error(s): Failed to load resource: the server responded with a status of 500 (Internal Server Error))
/admin/submissions/seed_submission_0001                                        organizer  FAIL  (1 console error(s): Failed to load resource: the server responded with a status of 500 (Internal Server Error))
/admin/speakers                                                                 organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/content                                                                  organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/agenda                                                                   organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/comms                                                                    organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/contacts                                                                 organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/settings                                                                 organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/review                                                                   organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/review/plans/new                                                        organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/review/plans/seed_evaluation_plan_0001                                  organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/review                                                                   reviewer   FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/review/plans/seed_evaluation_plan_0001                                  reviewer   FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 reviewer   FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/portal                                                                         speaker    FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/portal/submissions/seed_submission_0001                                       speaker    FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/portal/submissions/seed_submission_0001/edit                                  speaker    FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/portal/profile                                                                 speaker    FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/portal/tasks                                                                   speaker    FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/portal/tasks/seed_task_assignment_0001/form                                   speaker    FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/e/devflow-conf-2027/sessions                                                   public     FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/e/devflow-conf-2027/speakers                                                   public     FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/e/devflow-conf-2027/gallery                                                    public     FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/e/devflow-conf-2027/agenda                                                     public     FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/e/devflow-conf-2027/schedule                                                   public     FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/submit/devflow-conf-2027                                                       public     FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/account/password                                                               organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/account/password                                                               reviewer   FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/account/password                                                               speaker    FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)
/admin/*                                                                        organizer  FAIL  (status 0 !== 200; empty rendered text; net::ERR_CONNECTION_REFUSED)

0/34 routes passed
```

(`app/src/routeManifest.ts` declares 34 route-manifest entries — confirmed by
counting `path:` occurrences, which is 35 including the file's own
`RouteManifestEntry` type-array literal header line, i.e. 34 data rows,
matching the printed `0/34`.)

## Root cause of the desktop-pass mass-failure (OPEN ITEM 1)

The wrangler dev log (captured by the gate on failure) shows the very first
route, `/admin/overview`, triggers an **unconditional 500** on
`GET /api/v1/events/{eventId}/overview`:

```
[wrangler:info] GET /api/v1/events/seed_event_0001/overview 500 Internal Server Error (42ms)
✘ [ERROR] unhandled error DrizzleQueryError: Failed query: select ... from "task_assignment" inner join "task" ... where (... and "task"."due_date" < ?)
  params: [ 'seed_event_0001', 'pending', 2026-08-12T04:30:28.105Z, 5 ]
  cause: Error: D1_TYPE_ERROR: Type 'object' not supported for value 'Wed Aug 12 2026 04:30:28 GMT+0000 (Coordinated Universal Time)'
```

`src/server/repo/overview.ts:324` (DEC-370 §01 overdue-task-rows query)
builds the overdue-cutoff comparison with a raw `sql` template that
interpolates a JS `Date` object directly:

```ts
sql`${schema.task.dueDate} is not null and ${schema.task.dueDate} < ${new Date(now)}`,
```

D1's bind layer rejects `object`-typed bind values outright
(`D1_TYPE_ERROR: Type 'object' not supported`), so this query throws on
every call — the `/admin/overview` route's `overview` API endpoint 500s
unconditionally for any event with at least one task (the seed fixture
always has pending task assignments), which is why the very first sweep
route already fails.

## Root cause of the connection-refused cascade (OPEN ITEM 2)

After a small number of repeated `unhandled error DrizzleQueryError`
rejections from OPEN ITEM 1 (observed 3 times in the captured log before the
next navigation), the `wrangler dev` child process the gate itself spawned
(`scripts/render-sweep.ts`) stops accepting connections —
`net::ERR_CONNECTION_REFUSED` starting at the 5th manifest entry
(`/admin/speakers`) and for every route after it, including the entire
mobile pass. This was not a `--port` collision (the gate picks a fresh free
port via `findFreePort()`) — the dev server process itself became
unreachable mid-run. This is downstream of OPEN ITEM 1 (repeated unhandled
promise rejections destabilizing the local Miniflare/workerd isolate), not
an independent defect, but it means the render-sweep gate cannot currently
complete a run while OPEN ITEM 1 is present: 30/34 desktop routes and all
15 mobile routes were never actually measured (recorded as FAIL by the
sweep's own status column, but the true state is "unmeasured", not "checked
and broken").

## Pass 2 — DEC-253 mobile sweep (390x844)

Did not run to completion. The gate's own login step for the mobile pass
immediately hit the same dead `wrangler dev` process from OPEN ITEM 2:

```
render-sweep: mobile pass (390x844)...
page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:53884/login
    at loginContext (scripts/render-sweep.ts:177:29)
    at async main (scripts/render-sweep.ts:331:40)
```

This threw uncaught out of `main()` — no mobile PASS/FAIL table, no
`overflowPx`/`minControlPx` measurements were produced for any of the 15
`MOBILE_ROUTE_MANIFEST` entries. `npm run gate:render-sweep` exited with
code **1** via this uncaught exception rather than printing a formatted
failure summary (OPEN ITEM 3).

## Exit code
`gate:render-sweep` process exit code **1** (uncaught exception during the
mobile-pass login, not a clean FAIL table).

## OPEN ITEMS: 3

1. **`src/server/repo/overview.ts:324`** — the DEC-370 §01 overdue-task-rows
   query interpolates a JS `Date` object directly into a raw `sql` template
   (`` sql`...${schema.task.dueDate} < ${new Date(now)}` ``); D1 rejects
   `object`-typed bind values (`D1_TYPE_ERROR: Type 'object' not
   supported`), so `GET /api/v1/events/{eventId}/overview` 500s
   unconditionally whenever the event has any task rows (true for the seed
   fixture), breaking `/admin/overview` for every organizer. This is the
   root cause blocking the rest of this gate run.
2. **`scripts/render-sweep.ts`'s spawned `wrangler dev` child process** (the
   dev server the gate itself boots) stops accepting connections
   (`net::ERR_CONNECTION_REFUSED`) partway through the desktop pass
   (starting at `/admin/speakers`, the 5th manifest entry) after repeated
   unhandled `DrizzleQueryError` rejections from item 1 — downstream of item
   1, but it means the render-sweep gate cannot currently produce a
   complete measurement (30/34 desktop routes and all 15 mobile routes are
   unmeasured, not verified-broken) until item 1 is fixed.
3. **`scripts/render-sweep.ts`'s `loginContext`** (around line 177) lets a
   `page.goto` failure (`net::ERR_CONNECTION_REFUSED`) throw uncaught out of
   `main()` instead of being caught and reported as a clean FAIL summary —
   the gate process exits 1 via an unhandled exception + stack trace rather
   than printing `0/15 mobile routes passed` the way it does for the
   desktop pass. Secondary to items 1/2 (only surfaces once the dev server
   is already down) but worth fixing for gate robustness independent of the
   underlying app bug.

None of the three items above are settled/out-of-scope per DEC-366 (they
are not pubcache purge DEC-201/333/348/358, not ABS-14 AI triage DEC-272,
and not stage-2 provisioning/deploy/Resend/Airtable/DNS/CI). None are
missing-fonts/unstyled-residual-class/modal-backdrop findings already owned
by this wave's task-w3-a/task-w3-c lanes — item 1 is a server-side D1 bind
bug in the DEC-370 Overview endpoint, unrelated to CSS/redesign lanes.

## RESULT: FAIL

0/34 desktop routes passed, 0/15 mobile routes measured (gate crashed before
producing a mobile result), gate process exit code 1. This is the first time
any of wave-1..3's re-skin lane output has been loaded in a real browser,
and the very first navigated route (`/admin/overview`) already surfaces a
server-side 500 that then destabilizes the dev server for the remainder of
the run — see OPEN ITEMS 1-3.

## RECHECK SHA
9e1e4da8eedace9d5356e6e1e69d24872110d18e (unchanged — this is a LOG-ONLY
lane per DEC-384; no product code, schema, `src/decisions.ts`, or other
`docs/verification-log/` files were created or modified — only this file).

## POST-S DELTA
None. `git status` in the worktree shows a single new file at
`docs/verification-log/task-w3-i-render-sweep-redesign.md`; the
`public/admin/*` bundle artifacts and `.wrangler/state`/`.seed.sql`/
`.seed-assets/` produced by the build/migrate/seed/gate steps are untracked
build/dev output, not committed.
