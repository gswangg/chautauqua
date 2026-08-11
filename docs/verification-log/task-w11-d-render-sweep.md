# task-w11-d — render-sweep @ 7561cc1

Full transcript detail supporting the `docs/verification-log.md` section
of the same name. Homonym note: an earlier, first-campaign section
titled `task-w11-d — perf-smoke @ 3b7ed3d` already exists in this file
(a different task id/lane bound to a different, earlier sha under
DEC-129); it is inert and out of scope here.

## S' derivation (DEC-114 first-parent walk)

`git log --first-parent --oneline` from `main` in a fresh worktree cut
at the current tip (`bdc472b`, "scribe wave 11"):

```
bdc472b scribe wave 11
b57bdfd merge task-w9-g
7561cc1 merge task-w10-d
44487c1 merge task-w10-b
9c3546c merge task-w10-c
5651948 merge task-w10-e
b2fdcd0 merge task-w10-a
6b6e1ae merge task-w8-g
...
```

Per the field guide / DEC-186, `b57bdfd` ("merge task-w9-g") and
`bdc472b` ("scribe wave 11") are doc-only (verification-log appends
and scribe compaction only — confirmed by wave-11 sibling gates'
independent derivations) and are skipped in the first-parent walk.
That leaves **`7561cc1`** ("merge task-w10-d") as S', matching the
task's expected sha.

`git merge-base --is-ancestor 2dd2f33 7561cc1` exits 0 (DEC-139/DEC-144
ancestry check satisfied).

## Precondition greps (17/17 PASS)

All greps run directly against blob contents at `7561cc1` via
`git show 7561cc1:<path>` (not working-tree state), so results reflect
S' exactly.

Twelve DEC-177 anchors (six w6 fixes + six harness-closure DEC-173/174/175
markers):

```
src/domain/contacts.ts            DEC-167            PASS
src/mail/ics.ts                   ICS_ORGANIZER_EMAIL PASS
src/routes/api/forms.ts           unknown track id    PASS
src/server/repo/files.ts          anonymized === false PASS
app/src/pages/review/PlanEditor.tsx  openDate         PASS
scripts/seed.ts                   FORM_TASK_FIELD_SPECS PASS
scripts/seed.ts                   DEC-174             PASS
scripts/walkthrough/public.ts     DEC-173             PASS
scripts/walkthrough/speaker.ts    DEC-173             PASS
scripts/walkthrough/producer.ts   DEC-175             PASS
scripts/walkthrough/speaker.ts    DEC-175             PASS
scripts/walkthrough/review.ts     DEC-175             PASS
```

Five wave-10 fix anchors:

```
src/lib/csv.ts             DEC-179  PASS
src/lib/rate-limit.ts      DEC-180  PASS
src/server/middleware.ts   DEC-181  PASS
src/server/http.ts         DEC-182  PASS
wrangler.jsonc              DEC-183  PASS
```

17/17 PASS. No precondition FAIL.

## Fresh worktree run at S'

`git worktree add --detach .../task-w11-d-sha 7561cc1` (separate,
scratch worktree used only for the code-execution steps below; removed
after the run — the log-only `task-w11-d` worktree itself never ran
`npm ci`/build against a mutated tree).

- `npm ci --prefer-offline --no-audit --no-fund --silent`: clean.
- `npm run build`: PASS — `tsc --noEmit && tsc --noEmit -p
  app/tsconfig.json && vite build --config app/vite.config.ts`; 131
  modules transformed, admin SPA bundle emitted to `public/admin/`.
- `npm run db:migrate`: PASS — all 13 migrations applied
  (`0000_secret_matthew_murdock.sql` .. `0013_submission_revision.sql`).
- `npm run seed`: PASS — seed script + `.seed.sql` D1 load + 8 R2
  objects (files/headshots) loaded via `seed-r2`.

Procedural note (harness gotcha, not a code defect): `npm run
gate:render-sweep` (`scripts/render-sweep.ts`) self-boots its own
migrated + reseeded `wrangler dev` instance internally. Running `npm
run db:migrate && npm run seed` by hand first, then invoking
`gate:render-sweep` against the *same* local D1 state, causes the
gate's internal reseed to collide with the just-inserted rows (`UNIQUE
constraint failed: pipeline_entry.org_id, pipeline_entry.contact_id`)
because `scripts/seed.ts` is not idempotent against pre-existing rows.
This is a double-seed artifact of running the two steps back-to-back
against shared local state, not a regression in the code under test —
all prior render-sweep gates (task-w8-e, task-w9-e) invoke
`gate:render-sweep` directly, without a preceding manual seed. Cleared
`.wrangler/state` (fresh local D1/KV/R2) and re-ran `npm run
gate:render-sweep` on its own, which reproduces the manual
migrate+seed internally before booting `wrangler dev`; this run is the
one reported below. Also: the first invocation using a 300s `timeout`
wrapper produced spurious `ERR_CONNECTION_REFUSED` failures on 30 of 31
routes because the wrapper killed the `wrangler dev` child mid-sweep
before Playwright finished — not a route regression either. Re-run
with a 580s wrapper completed cleanly with no timeout artifact.

## Gate output (npm run gate:render-sweep, clean local state)

```
render-sweep: starting wrangler dev on port 53537...
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

31/31 routes PASS, matching the count last confirmed at `38860f9`
(task-w8-e/task-w9-e). Zero console pageerrors on any route, including
`/admin/contacts` (DEC-179 CSV export links live on this page) and
`/portal` (DEC-181 sign-out form lives on this page) — both render
clean with non-empty content.

## Supplementary: full test suite

`npm test --silent` in the same S' worktree: **152 test files / 1364
tests**, 0 failures (both counts are up from wave-9's `151/1332`,
consistent with the wave-10 DEC-179..183 fix lane adding coverage).

## Cleanup

The scratch S' worktree (`.../task-w11-d-sha`) was removed
(`git worktree remove --force`) after the run; it never held any
committed work and this log-only branch's own worktree touched no
files besides `docs/verification-log.md` and this detail file.

RESULT: PASS
