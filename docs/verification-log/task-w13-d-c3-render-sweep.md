# task-w13-d - render-sweep @ f6983e6

FROZEN SHA: f6983e66a51d23e88931ce45dac6d0374a3d5463
WAVE-12 GATE: PASS (no poll needed, S = worktree HEAD = main HEAD f6983e6)
DRIZZLE-ORM AT S: drizzle-orm@0.45.2
OPEN ITEMS: 0
RESULT: PASS
RECHECK SHA: f6983e66a51d23e88931ce45dac6d0374a3d5463

## WAVE-12 CONTENT GATE (DEC-314) — W1..W7

S = worktree HEAD at branch creation = `f6983e66a51d23e88931ce45dac6d0374a3d5463` (`git -C
.../chautauqua worktree add .../task-w13-d -b task-w13-d main` landed exactly on main's tip;
no poll required).

- W4 anchor — `src/routes/dev/mailbox.tsx` contains `<meta name="viewport"`:
  CONFIRMED, two occurrences (lines 44, 92):
  `<meta name="viewport" content="width=device-width, initial-scale=1" />`
- W5 anchor (part 1) — `src/routes/docs.tsx` contains the horizontal-scroll wrapper rule:
  CONFIRMED, line 242 embedded `<style>` block includes
  `.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }`
- W5 anchor (part 2) — `scripts/render-sweep.ts` `MOBILE_ROUTE_MANIFEST` contains both
  entries: CONFIRMED, lines 80-81:
  `{ path: "/docs/api", role: "public" },`
  `{ path: "/dev/mailbox", role: "public" },`

All W1..W7 gate content present at S. No PARTIAL, no poll cycles needed.

## SETUP

```
npm ci --prefer-offline --no-audit --no-fund --silent   (node_modules already present, skipped)
npm run build                                             -> tsc --noEmit x2 + vite build: clean, 0 errors
rm -rf .wrangler/state
npm run db:migrate                                        -> 17/17 migrations applied clean
npm run seed                                               -> seed + R2 asset upload (8 objects) clean
```

Note for future lanes: `npm run gate:render-sweep` performs its OWN migrate+seed cycle
against `.wrangler/state` internally (see script comment block, scripts/render-sweep.ts:1-26).
Running the manual `db:migrate`/`seed` SETUP step and then immediately invoking
`gate:render-sweep` without clearing state a second time causes the script's internal
reseed to collide (`UNIQUE constraint failed: pipeline_entry.org_id, pipeline_entry.contact_id`)
because the seed data is not idempotent against an already-seeded DB. First attempt (state
left populated from the manual SETUP seed) failed this way at exit 1, before any route was
visited — not a route/render defect, an environment-sequencing issue on this lane's part.
Fix: `rm -rf .wrangler/state` again immediately before invoking `npm run gate:render-sweep`,
letting the script's internal migrate+seed run against a clean DB (its normal, documented
mode of operation). Second attempt succeeded cleanly (see full log below). This is not a
product defect — no OPEN ITEM recorded for it — but is flagged here for the field guide since
the task's literal SETUP sequence (migrate+seed, then gate:render-sweep) is redundant for
this specific gate script and will reproduce the collision if repeated verbatim without the
extra `rm -rf .wrangler/state`.

## npm run gate:render-sweep — desktop route table (verbatim)

```
render-sweep: starting wrangler dev on port 50560...
render-sweep: wrangler dev is up
render-sweep: logging in as organizer (sbek-organizer@example.com)...
render-sweep: logging in as reviewer (sbek-reviewer@example.com)...
render-sweep: logging in as speaker (sbek-speaker@example.com)...

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
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  PASS
/admin/review                                                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   PASS
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
```

Zero console-error / pageerror events reported (script asserts zero collected `error` +
`pageerror` console events per route with no allowlist and no non-200 nav responses; none
were printed as failures, and the "34/34 routes passed" summary line confirms all assertions
held — the script would have printed a FAIL row and non-zero exit had any route emitted a
console error, returned non-200, or rendered a blank `#root`/`body`).

## npm run gate:render-sweep — mobile 390x844 table (verbatim), with wave-11 comparison

```
render-sweep: mobile pass (390x844)...

path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             40  PASS
/e/devflow-conf-2027/sessions                                0             40  PASS
/e/devflow-conf-2027/speakers                                0             40  PASS
/e/devflow-conf-2027/agenda                                  0             40  PASS
/e/devflow-conf-2027/schedule                                0             40  PASS
/e/devflow-conf-2027/gallery                                 0             40  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             40  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001              0             40  PASS
/embed/devflow-conf-2027/sessions                            0             40  PASS
/embed/devflow-conf-2027/agenda                              0             40  PASS
/embed/devflow-conf-2027/speakers                            0             40  PASS
/login                                                       0             40  PASS
/portal                                                      0             40  PASS
/docs/api                                                    0              -  PASS
/dev/mailbox                                                 0              -  PASS

15/15 mobile routes passed
```

### Wave-11 vs wave-13 adjudication (the two open items this section exists to resolve)

| path         | overflowPx @ wave 11 | overflowPx @ wave 13 (this run) | minControlPx | verdict |
|--------------|-----------------------|----------------------------------|--------------|---------|
| /docs/api    | 371px (OPEN ITEM)     | **0**                             | `-` (null, expected — DEC-311, no primary nav/filter/submit controls on this page, so `minControlHeight === null` is a pass, not a defect) | RESOLVED — was 371px overflow, now 0 |
| /dev/mailbox | 96px (OPEN ITEM)      | **0**                             | `-` (null, same DEC-311 rationale)   | RESOLVED — was 96px overflow, now 0 |

Both wave-11 mobile-overflow OPEN ITEMS are CLOSED as of this run: `/docs/api` and
`/dev/mailbox` both report `overflowPx = 0` at 390x844, matching every other row in the
mobile manifest. `minControlPx` reads `-` (script's null-control marker) for both routes,
which is the expected/passing state per DEC-311 (a page with zero primary nav/filter/submit
controls has `minControlHeight === null`, which `evaluateMobileRoute` treats as a pass, not
a failure) — no decorative `<nav>` or other page change was made or needed to reach this
result; W4/W5 gate content (viewport meta on mailbox, `.table-scroll` wrapper on docs) was
already present at S and is sufficient.

## Exit code

```
gate:render-sweep OK
EXIT_CODE=0
```

No FAIL rows, no console-error/blank-screen findings, no non-zero mobile overflow anywhere
in either table.

## POST-S DELTA

```
git -C /Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua log --oneline f6983e66a51d23e88931ce45dac6d0374a3d5463..refs/heads/main -- src app migrations scripts test
```

(empty — no output; S was already main's tip when this lane's worktree was created, so
there is no post-S delta to report. Per DEC-280 this is informational only, never a STOP.)
