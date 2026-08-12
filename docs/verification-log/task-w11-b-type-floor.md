# task-w11-b — type-floor instrument (DEC-421)

Builds the mandate's missing 10px type-floor invariant into the render-sweep
gate (docs/eval-findings.md:70-74, docs/design/README.md:74 and :207;
DEC-421). Instrument-only: no CSS or product code touched. This file is the
first reading of the new advisory pass.

## What landed

`scripts/render-sweep-lib.ts`:
- `MIN_FONT_PX = 10`
- `FONT_FLOOR_BLOCKING = false` (DEC-387 flip-rule comment style, reused
  verbatim per DEC-421: "it becomes true in the wave after the pass first
  reads all-PASS")
- `FontFloorObservation`, `FontFloorRouteEntry`, `FontFloorResult`
- `evaluateFontFloor`, `fontFloorErrorResult`, `formatFontFloorTable`,
  `formatFontFloorSummary`, `allFontFloorPassed`

`scripts/render-sweep.ts`:
- `measureFontFloor(page)` — one `page.evaluate` that walks
  `document.querySelectorAll('*')`, keeps elements with a non-empty direct
  text node and a non-zero rendered box, reads
  `getComputedStyle(el).fontSize`, and returns the page minimum plus up to 3
  structural offenders (tag + class list + px, never text content).
- Called from both `visitRoute` (desktop `ROUTE_MANIFEST` pass) and
  `visitMobileRoute` (mobile `MOBILE_ROUTE_MANIFEST` pass, reused again for
  the admin-mobile `ADMIN_MOBILE_ROUTE_MANIFEST` pass) — no new route list,
  no extra page visits. Both call sites run after the existing
  `page.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM })` (DEC-411);
  a `page.evaluate` failure there is caught and recorded via
  `fontFloorErrorResult` (`instrument-blocked: ...`) rather than a false 0.
- `main()` collects every reading into one flat `FontFloorResult[]`, prints a
  third table + summary, and only flips `failed` when
  `FONT_FLOOR_BLOCKING` is true (it is not, on this first reading).

`test/render-sweep-lib.test.ts`: added unit coverage for `evaluateFontFloor`
(below/at/above the floor, and the null-minFontPx vacuous-pass case),
`fontFloorErrorResult`, `formatFontFloorTable`/`formatFontFloorSummary`, and
the `FONT_FLOOR_BLOCKING` constant/flip-rule/never-blocks-the-gate
invariants. Also updated the existing DEC-411 "no page.evaluate call site
escapes visitRoute/visitMobileRoute" structural test to account for the new
`measureFontFloor` call site shared by both functions (arithmetic check:
total `page.evaluate(` occurrences in the file == occurrences inside
`visitRouteBody` + `visitMobileRouteBody` + `measureFontFloorBody`).

## Commands run

```
npm run build   # tsc --noEmit (root + app) && vite build — PASS
npm test        # 263 files / 2197 tests — PASS
npm run gate:render-sweep   # full boot + sweep — PASS, exit 0
```

sha measured: `a3dbba69137120da98862b2af1091546f67c94c3` (task-w11-b branch
HEAD immediately prior to this task's commit — the working tree in which
the gate below was run, before this file and the code changes above were
committed).

## Type-floor table (verbatim, first reading)

```
render-sweep: type-floor pass (10px minimum, advisory)...

path                                                                            role       viewport  minFontPx  status
/admin/overview                                                                 organizer  desktop         10  PASS
/admin/submissions                                                              organizer  desktop         10  PASS
/admin/submissions/forms                                                        organizer  desktop         10  PASS
/admin/submissions/seed_submission_0001                                         organizer  desktop         10  PASS
/admin/speakers                                                                 organizer  desktop         10  PASS
/admin/content                                                                  organizer  desktop         10  PASS
/admin/agenda                                                                   organizer  desktop         10  PASS
/admin/comms                                                                    organizer  desktop         10  PASS
/admin/contacts                                                                 organizer  desktop         10  PASS
/admin/settings                                                                 organizer  desktop         10  PASS
/admin/review                                                                   organizer  desktop         10  PASS
/admin/review/plans/new                                                         organizer  desktop         10  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  desktop         10  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  desktop         10  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  desktop         10  PASS
/admin/review                                                                   reviewer   desktop         12  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   desktop         11  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   desktop         11  PASS
/portal                                                                         speaker    desktop         10  PASS
/portal/submissions/seed_submission_0001                                        speaker    desktop         10  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    desktop         11  PASS
/portal/profile                                                                 speaker    desktop         11  PASS
/portal/tasks                                                                   speaker    desktop         10  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    desktop         12  PASS
/e/devflow-conf-2027/sessions                                                   public     desktop         11  PASS
/e/devflow-conf-2027/speakers                                                   public     desktop         11  PASS
/e/devflow-conf-2027/gallery                                                    public     desktop         11  PASS
/e/devflow-conf-2027/agenda                                                     public     desktop         11  PASS
/e/devflow-conf-2027/schedule                                                   public     desktop         11  PASS
/submit/devflow-conf-2027                                                       public     desktop         11  PASS
/account/password                                                               organizer  desktop         11  PASS
/account/password                                                               reviewer   desktop         11  PASS
/account/password                                                               speaker    desktop         11  PASS
/admin/*                                                                        organizer  desktop         10  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     desktop         11  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     desktop         11  PASS
/embed/devflow-conf-2027/sessions                                               public     desktop         12  PASS
/embed/devflow-conf-2027/agenda                                                 public     desktop       12.8  PASS
/embed/devflow-conf-2027/speakers                                               public     desktop         13  PASS
/login                                                                          public     desktop         11  PASS
/docs/api                                                                       public     desktop         11  PASS
/dev/mailbox                                                                    public     desktop         11  PASS
/submit/devflow-conf-2027                                                       public     mobile          11  PASS
/e/devflow-conf-2027/sessions                                                   public     mobile          11  PASS
/e/devflow-conf-2027/speakers                                                   public     mobile          11  PASS
/e/devflow-conf-2027/agenda                                                     public     mobile          11  PASS
/e/devflow-conf-2027/schedule                                                   public     mobile          11  PASS
/e/devflow-conf-2027/gallery                                                    public     mobile          11  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     mobile          11  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     mobile          11  PASS
/embed/devflow-conf-2027/sessions                                               public     mobile          12  PASS
/embed/devflow-conf-2027/agenda                                                 public     mobile        12.8  PASS
/embed/devflow-conf-2027/speakers                                               public     mobile          13  PASS
/login                                                                          public     mobile          11  PASS
/portal                                                                         speaker    mobile          10  PASS
/portal/submissions/seed_submission_0001                                        speaker    mobile          10  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    mobile          11  PASS
/portal/profile                                                                 speaker    mobile          11  PASS
/portal/tasks                                                                   speaker    mobile          10  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    mobile          12  PASS
/account/password                                                               speaker    mobile          11  PASS
/docs/api                                                                       public     mobile          11  PASS
/dev/mailbox                                                                    public     mobile          11  PASS
/admin/overview                                                                 organizer  mobile          10  PASS
/admin/submissions                                                              organizer  mobile          10  PASS
/admin/submissions/forms                                                        organizer  mobile          10  PASS
/admin/submissions/seed_submission_0001                                         organizer  mobile          11  PASS
/admin/speakers                                                                 organizer  mobile          11  PASS
/admin/content                                                                  organizer  mobile          11  PASS
/admin/agenda                                                                   organizer  mobile          10  PASS
/admin/comms                                                                    organizer  mobile          11  PASS
/admin/contacts                                                                 organizer  mobile          11  PASS
/admin/settings                                                                 organizer  mobile          11  PASS
/admin/review                                                                   organizer  mobile          10  PASS
/admin/review/plans/new                                                         organizer  mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  mobile          10  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  mobile          11  PASS
/admin/review                                                                   reviewer   mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   mobile          11  PASS
/account/password                                                               organizer  mobile          11  PASS
/account/password                                                               reviewer   mobile          11  PASS

83/83 font-floor checks passed
gate:render-sweep OK
```

## Reading

83/83 PASS — every measured route+viewport combination renders its smallest
text-bearing element at >= 10px on this first reading. Per the DEC-387 flip
rule (reused verbatim for DEC-421), `FONT_FLOOR_BLOCKING` stays `false` on
landing regardless of this all-PASS reading — flipping it is a decision for
a later wave, not this task, and this task's scope is the instrument plus
its first reading, not the flip. The desktop admin routes cluster tightly at
the floor (many read exactly `10`), which is worth a future wave's attention
even though nothing failed: a single further shrink (e.g. a sub-pixel
rounding difference across engines/fonts) could flip several rows FAIL.

Note: the existing (unrelated, pre-existing, non-advisory) DEC-401 mobile
overflow pass over `ADMIN_MOBILE_ROUTE_MANIFEST` read 14/20 in this same run
(6 pre-existing overflow offenders on /admin/overview, /admin/submissions,
/admin/submissions/forms, /admin/content, /admin/agenda, and
/admin/review/.../results) — untouched by this task, out of scope for
task-w11-b, and already advisory (`ADMIN_MOBILE_PASS_BLOCKING = false`), but
noted here since it appeared in the same terminal transcript.
