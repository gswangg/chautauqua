# task-w8-e — render-sweep @ 38860f9

Full transcript detail supporting the `docs/verification-log.md` section
of the same name.

## S derivation

`git -C .../chautauqua log --first-parent --oneline -10`:

```
38860f9 merge task-w8-a
a8a4785 scribe wave 9
5d3acae scribe wave 8
466f45b scribe wave 7
77b76a9 merge task-w6-f
503f031 merge task-w6-b
53bbaf9 merge task-w6-e
ee71441 merge task-w6-c
a1a9fb1 merge task-w6-d
85f72b7 merge task-w6-a
```

`S = 38860f9` (current `main` tip, first-parent walk, no bookkeeping
commits after it). `git merge-base --is-ancestor 2dd2f33 38860f9` exits 0
(DEC-139 ancestry check satisfied). Worktree created directly at `main`
(== `38860f9` at creation time), confirmed via `git log -1 --oneline`
inside the fresh worktree.

## DEC-177 precondition grep evidence

```
src/domain/contacts.ts:165:  * DEC-167: primary wins are still fill-if-blank for phone/bio/headshotUrl,
src/mail/ics.ts:15:export const ICS_ORGANIZER_EMAIL = "noreply@chautauqua.local";
src/routes/api/forms.ts:113:        errors.tracks = `unknown track id: ${unknown}`;
src/server/repo/files.ts:153:  const candidatePlans = plans.filter((p) => assignedPlanIds.has(p.id) && p.anonymized === false);
app/src/pages/review/PlanEditor.tsx:107:          openAt: plan.openDate,
scripts/seed.ts:19:import { DEFAULT_ONBOARDING_TASKS, FORM_TASK_FIELD_SPECS } from "../src/domain/acceptance";

scripts/walkthrough/public.ts:440:    // DEC-173, "<strong><a href=...>First Last</a></strong>") inside the
scripts/walkthrough/speaker.ts:923:      // DEC-173: the name may be wrapped in an <a href=...> inside the
scripts/seed.ts:975:      // DEC-174: force contactIdx 0 / taskIdx 4 ("Announce participation",
scripts/walkthrough/speaker.ts:1156:  // DEC-175: object-level authz probes — speaker2 must be turned away from
scripts/walkthrough/producer.ts:773:// DEC-175: unauthenticated authz probes
scripts/walkthrough/review.ts:312:  // DEC-175: an out-of-scope submission for the track-scoped reviewer built
```

All six w6 anchors and all three closure anchors (DEC-173/174/175)
present — no precondition FAIL.

## Build

`npm run build` — PASS (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json
&& vite build --config app/vite.config.ts`; 131 modules transformed;
admin SPA bundle emitted to `public/admin/`).

## Gate output (npm run gate:render-sweep)

```
render-sweep: starting wrangler dev on port 50590...
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
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  PASS
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
/admin/*                                                                        organizer  PASS

31/31 routes passed
gate:render-sweep OK
```

Exit 0. Both previously-persistent failures
(`/admin/review/plans/seed_evaluation_plan_0001` and
`/portal/tasks/seed_task_assignment_0001/form`) are now PASS.

RESULT: PASS
