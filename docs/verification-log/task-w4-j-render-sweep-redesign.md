# task-w4-j — render-sweep gate (DEC-384/385/387), LOG-ONLY

Gate lane. Owns exactly this one file (DEC-384) — no product code, tests, or
scripts touched.

## SHA measured

`git rev-parse main` = **`be847ccf53997b322e6c74a6573a2d7220950527`**
("merge task-custodian-w4-1").

Note on how this SHA was reached: the worktree was first cut from
`main` at `86cad3d147562787c343dc401be96d6f5dce9ff8` ("merge task-w4-c") and
every step below (`npm ci`, build, test, `gate:render-sweep`, the throwaway
admin-mobile-pass script) was run once successfully against that commit.
Partway through write-up, a concurrent custodian task
(`task-custodian-w4-1`) pruned the original `task-w4-j` worktree and branch
out from under this run (a swarm-concurrency hazard worth flagging for the
field guide — worktrees can be reclaimed mid-task by other agents' cleanup
jobs). The worktree was recreated fresh off `main`'s new tip, `be847cc`, and
every command (`npm ci`, build, test, `gate:render-sweep`, the throwaway
mobile-pass script) was re-run in full against `be847cc` to produce the
numbers recorded below — nothing here is carried over unverified from the
first pass. `git diff --stat 86cad3d be847cc` showed real code changes
between the two (not just docs), most notably `scripts/render-sweep.ts` /
`scripts/render-sweep-lib.ts` gaining the DEC-387 in-repo admin mobile pass
itself (landed by `task-w4-i` in the interim) — so re-running against
`be847cc` was the right call, not just hygiene.

## Commands run, in order

1. `npm ci --prefer-offline --no-audit --no-fund` — installed 366 packages,
   exit 0.
2. `npm run build` — `tsc --noEmit && tsc --noEmit -p app/tsconfig.json &&
   vite build --config app/vite.config.ts`. 154 modules transformed, admin
   SPA bundle emitted to `public/admin/`. **PASS**, exit 0.
3. `npm test` (vitest run) — **243 test files / 2056 tests, all PASS**, exit
   0. (2051 tests on the first pass at `86cad3d`; 2056 at `be847cc` — the
   intervening waves added tests, no regressions.)
4. `npx playwright install chromium` — chromium/chromium-headless-shell
   already present in the local Playwright cache (`--dry-run` confirmed
   nothing missing); no download needed.
5. `npm run gate:render-sweep` (`tsx scripts/render-sweep.ts`) — self-boots
   its own migrated+seeded `wrangler dev` on a free port, logs in as
   organizer/reviewer/speaker via the real `/login` form, then runs three
   passes: the full desktop `ROUTE_MANIFEST` sweep, the DEC-253 public/
   portal 390px mobile pass, and (new since `task-w4-i` landed DEC-387) an
   advisory 390px admin mobile pass over the organizer/reviewer entries.
   **Exit 1** (desktop sweep failures make the overall gate exit non-zero;
   the admin mobile pass itself is advisory per DEC-387 and does not gate
   the exit code — `ADMIN_MOBILE_PASS_BLOCKING` is `false`).

## Desktop sweep — PASS/FAIL table (from `gate:render-sweep`, `be847cc`)

```
path                                                                            role       status
/admin/overview                                                                 organizer  FAIL  (500 Internal Server Error x2)
/admin/submissions                                                              organizer  FAIL  (500 Internal Server Error)
/admin/submissions/forms                                                        organizer  FAIL  (500 Internal Server Error)
/admin/submissions/seed_submission_0001                                        organizer  FAIL  (500 Internal Server Error)
/admin/speakers                                                                 organizer  FAIL  (500 Internal Server Error)
/admin/content                                                                  organizer  FAIL  (500 Internal Server Error)
/admin/agenda                                                                   organizer  FAIL  (500 Internal Server Error)
/admin/comms                                                                    organizer  FAIL  (500 Internal Server Error)
/admin/contacts                                                                 organizer  FAIL  (500 Internal Server Error)
/admin/settings                                                                 organizer  FAIL  (500 Internal Server Error)
/admin/review                                                                   organizer  FAIL  (500 Internal Server Error)
/admin/review/plans/new                                                        organizer  FAIL  (500 Internal Server Error)
/admin/review/plans/seed_evaluation_plan_0001                                  organizer  FAIL  (500 Internal Server Error)
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer  FAIL  (500 Internal Server Error)
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  FAIL  (500 Internal Server Error)
/admin/review                                                                   reviewer   FAIL  (403 Forbidden)
/admin/review/plans/seed_evaluation_plan_0001                                  reviewer   FAIL  (403 Forbidden)
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 reviewer   FAIL  (403 Forbidden)
/portal                                                                         speaker    PASS
/portal/submissions/seed_submission_0001                                       speaker    PASS
/portal/submissions/seed_submission_0001/edit                                  speaker    PASS
/portal/profile                                                                speaker    PASS
/portal/tasks                                                                  speaker    PASS
/portal/tasks/seed_task_assignment_0001/form                                   speaker    PASS
/e/devflow-conf-2027/sessions                                                  public     PASS
/e/devflow-conf-2027/speakers                                                  public     PASS
/e/devflow-conf-2027/gallery                                                   public     PASS
/e/devflow-conf-2027/agenda                                                    public     PASS
/e/devflow-conf-2027/schedule                                                  public     PASS
/submit/devflow-conf-2027                                                      public     PASS
/account/password                                                              organizer  PASS
/account/password                                                              reviewer   PASS
/account/password                                                              speaker    PASS
/admin/*                                                                       organizer  FAIL  (500 Internal Server Error)

15/34 routes passed
```

## 390px mobile pass — PASS/FAIL table (DEC-253, public/portal, `gate:render-sweep`)

```
path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             44  PASS
/e/devflow-conf-2027/sessions                                0             40  PASS
/e/devflow-conf-2027/speakers                                0             40  PASS
/e/devflow-conf-2027/agenda                                  0             40  PASS
/e/devflow-conf-2027/schedule                                0             40  PASS
/e/devflow-conf-2027/gallery                                 0             40  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001            0             40  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                0             40  PASS
/embed/devflow-conf-2027/sessions                              0             44  PASS
/embed/devflow-conf-2027/agenda                                0             44  PASS
/embed/devflow-conf-2027/speakers                              0             44  PASS
/login                                                         0             48  PASS
/portal                                                        0             40  PASS
/docs/api                                                      0              -  PASS
/dev/mailbox                                                   0              -  PASS

15/15 mobile routes passed
```

## 390px admin mobile pass — advisory (DEC-387), two independent measurements

### A. `gate:render-sweep`'s own built-in pass (landed by `task-w4-i`, in-repo, `scripts/render-sweep.ts` `ADMIN_MOBILE_ROUTE_MANIFEST` / `evaluateMobileRoute`)

Control selector per DEC-387: `.chq-tabbar a`, `.chq-tabbar button`,
`.chq-btn`, `.chq-input`, `.chq-select`, `header nav a` (visible only).

```
path                                                                                     overflowPx  minControlPx  status
/admin/overview                                                                                  11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/submissions                                                                                40             21  FAIL  (overflow 40px; control height 21px < 40px)
/admin/submissions/forms                                                                         304             21  FAIL  (overflow 304px; control height 21px < 40px)
/admin/submissions/seed_submission_0001                                                           11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/speakers                                                                                   11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/content                                                                                     11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/agenda                                                                                      11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/comms                                                                                      131             21  FAIL  (overflow 131px; control height 21px < 40px)
/admin/contacts                                                                                    11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/settings                                                                                    11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/review                                                                                      11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/review/plans/new                                                                            11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001                                                      11             21  FAIL  (overflow 11px; control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001/progress                                             31             21  FAIL  (overflow 31px; control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001/results                                             242             21  FAIL  (overflow 242px; control height 21px < 40px)
/admin/review (reviewer)                                                                            1             21  FAIL  (control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001 (reviewer)                                            1             21  FAIL  (control height 21px < 40px)
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 (reviewer)           1             21  FAIL  (control height 21px < 40px)
/account/password (organizer)                                                                       0             44  PASS
/account/password (reviewer)                                                                        0             44  PASS

2/20 mobile routes passed  (advisory only — ADMIN_MOBILE_PASS_BLOCKING=false, does not gate exit code)
```

### B. This task's own throwaway Playwright script (session scratchpad, not committed — `admin-mobile-pass.mjs`), run independently against the same booted dev server, using the exact control selector list given in this task's instructions (`.chq-tabbar a`, `.chq-tabbar button`, `.chq-btn`, `.chq-input`, `.chq-select` — a subset of DEC-387's list, missing `header nav a`)

Ran twice (once per worktree incarnation, `86cad3d` then `be847cc`); numbers
were byte-identical both times, confirming no drift on these routes between
the two SHAs.

```
role       path                                                                             status  overflowPx  minControlPx  consoleErrors  pageErrors
organizer  /admin/overview                                                                   200     11          44             2              0
organizer  /admin/submissions                                                                200     40          44             1              0
organizer  /admin/submissions/forms                                                          200     304         44             1              0
organizer  /admin/submissions/seed_submission_0001                                           200     11          44             1              0
organizer  /admin/speakers                                                                   200     11          44             1              0
organizer  /admin/content                                                                    200     11          44             1              0
organizer  /admin/agenda                                                                     200     11          44             1              0
organizer  /admin/comms                                                                      200     131         44             1              0
organizer  /admin/contacts                                                                   200     11          44             1              0
organizer  /admin/settings                                                                   200     11          44             1              0
organizer  /admin/review                                                                     200     11          44             1              0
organizer  /admin/review/plans/new                                                           200     11          44             1              0
organizer  /admin/review/plans/seed_evaluation_plan_0001                                     200     11          44             1              0
organizer  /admin/review/plans/seed_evaluation_plan_0001/progress                            200     31          44             1              0
organizer  /admin/review/plans/seed_evaluation_plan_0001/results                             200     242         44             1              0
reviewer   /admin/review                                                                     200     1           44             1              0
reviewer   /admin/review/plans/seed_evaluation_plan_0001                                     200     1           44             1              0
reviewer   /admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002    200     1           44             1              0
```

All 18 routes returned HTTP 200 and zero `pageerror` events; overflow and
min-control-height numbers match table A on every row. The one visible
divergence between A and B is `minControlPx` (21 vs. 44): DEC-387's own
control selector includes `header nav a`, which on the admin shell resolves
to a short top-nav link (~21px tall) that this task's narrower selector list
doesn't pick up, so B under-reports the tap-target violation. **Table A
(the in-repo DEC-387 selector) is the more complete/authoritative measurement
for the tap-target floor** — B corroborates the overflow numbers and the
zero-console-error-beyond-known-500/403 finding, nothing more.

## RESULT: FAIL

The sweep ran to completion (server booted, migrations+seed applied,
chromium launched, every route resolved HTTP 200/302 as expected) — this is
not a "sweep couldn't run" case. It is a substantive FAIL: 15/34 desktop
routes fail on real server errors, and the admin mobile pass (advisory,
does not gate exit) is 2/20.

## OPEN ITEMS: 3

1. `src/server/repo/overview.ts:324` — the overdue-task-rows query passes a
   raw JS `Date` object (`new Date(now)`) into a tagged-template `sql`
   fragment used as a D1 bind parameter (`${schema.task.dueDate} < ${new
   Date(now)}`). D1 rejects object-typed bind values
   (`D1_TYPE_ERROR: Type 'object' not supported`), so every request to `GET
   /api/v1/events/:eventId/overview` from an organizer 500s. Sibling queries
   in the same file/`src/server/repo/tasks.ts` (e.g. `tasks.ts:238`,
   `tasks.ts:380`) correctly compare against the raw numeric `now` — this one
   query didn't get that treatment. Symptom is visible on **every** `/admin/*`
   organizer route (e.g. `/admin/overview`, `/admin/submissions`,
   `/admin/speakers`) because `app/src/lib/useNavExceptions.ts` polls this
   same endpoint from the shared top-nav shell on every admin page-load, not
   just the Overview page itself.
2. `app/src/lib/useNavExceptions.ts:35` — the shared nav-badge hook fetches
   `GET /events/:eventId/overview` unconditionally on every `/admin/*` page
   for every authenticated admin-shell role, but that endpoint is mounted
   behind `requireOrganizer` (`src/routes/api/overview.ts:21`) — reviewers
   correctly get a 403. The hook's own `.catch()` handles this gracefully at
   the React level (falls back to "no exception badge"), but the browser
   still logs a `Failed to load resource: ... 403` console error on the
   network layer, which is enough to fail every `/admin/review*` reviewer
   route in the render-sweep's zero-console-error criterion. Visible on
   `/admin/review` (reviewer role) and its two children.
3. DEC-387's admin mobile pass is advisory (`ADMIN_MOBILE_PASS_BLOCKING =
   false` in `scripts/render-sweep-lib.ts`, per its own flip rule) and
   currently reads 2/20 — mostly control-height failures (21px vs. the 40px
   floor) from `header nav a` links and 5 real horizontal-overflow rows (`/
   admin/submissions/forms` at 304px over, `/admin/review/.../results` at
   242px over, `/admin/comms` at 131px over). None of that is this
   LOG-ONLY lane's to fix, but it's the concrete gap DEC-387 exists to
   surface before the blocking flip; visible on
   `/admin/submissions/forms` (organizer) for the worst overflow case.
