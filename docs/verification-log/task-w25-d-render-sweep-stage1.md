# task-w25-d: render-sweep + mobile phone evidence re-cut (DEC-497/DEC-498)

Re-cuts the render + phone evidence at a sha that contains the DEC-489/490
embed-knob rework (task-w24-b, task-w24-c) — the most recent 390x844 pass in
this planning round (`docs/verification-log/task-w21-d-walkthrough-stage1.md`
STEP 4, sha `bf56ba7`) predates both decisions.

## Sha and log

Base sha (branched from `main`, before this task's own commit):

```
$ git rev-parse HEAD
f4421b1ba71d9557d3a7f688982e35b36b89fd3c

$ git log --oneline -10
f4421b1 scribe wave 25
03c03b9 merge task-w24-e
5ff2527 DEC-492: atomic set-based ics_sequence bump + bounded auto-schedule writes
745b785 merge task-w24-b
443df31 DEC-489: parity for embed knobs between HTML and .json twins
0f361ad merge task-w24-d
7a14e3d merge task-w24-c
5fa528d merge task-w24-a
574fc3c DEC-491: measure and bound the CSV import's per-row write burst
fea27f5 merge task-w23-f
```

DEC-489 (443df31) and DEC-490 (76b059b, merged via task-w24-c at 7a14e3d) are
both ancestors of `f4421b1` — confirmed by `git log --oneline --all | grep
489\|490` showing both commits on the `main` line reachable from HEAD. This
sha satisfies the task's requirement.

## Coverage check against app/src/routeManifest.ts (before running the gate)

`src/routes/public/shell.tsx`'s `SURFACES` constant is the authority for the
five public surfaces: `sessions, speakers, agenda, schedule, gallery`. The
generic `/embed/:eventSlug/:surface` route in `src/routes/public/index.tsx`
(and its `.json` twin) already accepts all five, and the producer-side embed
generator (`app/src/pages/settings/EmbedsPanel.tsx`) offers all five per
DEC-490. But `app/src/routeManifest.ts` (the desktop sweep's manifest, which
DEC-403 also folds into mobile coverage) only listed three of the five embed
twins — `/embed/:slug/{sessions,agenda,speakers}` — missing
`/embed/:slug/schedule` and `/embed/:slug/gallery`.

**Fix applied this task**: added the two missing entries to
`app/src/routeManifest.ts` (the only file this task is permitted to edit
outside `docs/verification-log/`):

```
{ path: `/embed/${EVENT_SLUG}/schedule`, role: "public", params: { eventSlug: EVENT_SLUG } },
{ path: `/embed/${EVENT_SLUG}/gallery`, role: "public", params: { eventSlug: EVENT_SLUG } },
```

**Known remaining gap (not fixed this task, out of scope)**:
`scripts/render-sweep.ts`'s `MOBILE_ROUTE_MANIFEST` (the 390x844 phone pass)
independently lists only three embed twins (`sessions`, `agenda`,
`speakers` — lines 98-100), also missing `schedule` and `gallery`. Per this
task's instructions, `app/src/routeManifest.ts` is the only file this task
may touch besides files under `docs/verification-log/`, so
`scripts/render-sweep.ts` was left unmodified. **The 390x844 mobile pass
below therefore still does not exercise `/embed/:slug/schedule` or
`/embed/:slug/gallery`** — flagging this as an open item for a future task
to add those two entries to `MOBILE_ROUTE_MANIFEST`.

Other required surfaces confirmed present in the manifest (desktop, which
DEC-403 unions into mobile coverage): all five `/e/:slug/*` public surfaces
(lines 130-134), `/submit/:slug` (line 137), `/portal` + its sub-routes
(lines 110-127), and `/admin/settings` (line 75, which carries the embed
generator panel).

## Command run

```
$ npx playwright install chromium   # no-op, already installed
$ npm run gate:render-sweep
```

scripts/render-sweep.ts boots its own migrated+seeded `wrangler dev` server
on a free port (54026 this run); no manually-assigned port was used, and no
`pkill -f` was issued (DEC-498) — the script manages its own server process.

## Desktop pass (44 routes) — per-route status/console-error table

All entries below are `status: PASS` (no console errors, no non-2xx/3xx
response) except where noted. Full raw output captured during this run;
table reproduced verbatim:

```
path                                                                            role       status
/admin/overview                                                                 organizer  PASS
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                        organizer  PASS
/admin/submissions/seed_submission_0001                                        organizer  PASS
/admin/speakers                                                                 organizer  PASS
/admin/content                                                                  organizer  PASS
/admin/agenda                                                                   organizer  PASS
/admin/comms                                                                    organizer  PASS
/admin/contacts                                                                 organizer  PASS
/admin/settings                                                                 organizer  PASS
/admin/review                                                                   organizer  PASS
/admin/review/plans/new                                                        organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001                                  organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer  PASS
/admin/review                                                                   reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001                                  reviewer   PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002 reviewer   PASS
/portal                                                                         speaker    PASS
/portal/submissions/seed_submission_0001                                       speaker    PASS
/portal/submissions/seed_submission_0001/edit                                  speaker    PASS
/portal/profile                                                                 speaker    PASS
/portal/tasks                                                                   speaker    PASS
/portal/tasks/seed_task_assignment_0001/form                                   speaker    PASS
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
/e/devflow-conf-2027/sessions/seed_submission_0001                             public     PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                public     PASS
/embed/devflow-conf-2027/sessions                                              public     PASS
/embed/devflow-conf-2027/agenda                                                public     PASS
/embed/devflow-conf-2027/speakers                                              public     PASS
/embed/devflow-conf-2027/schedule                                              public     PASS  <- newly covered (this task)
/embed/devflow-conf-2027/gallery                                               public     PASS  <- newly covered (this task)
/login                                                                          public     PASS
/docs/api                                                                       public     PASS
/dev/mailbox                                                                    public     PASS

44/44 routes passed
```

**Section result: PASS (44/44)**

## Mobile pass (390x844) — MOBILE_ROUTE_MANIFEST overflow + tap-target table

```
path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             44  PASS
/e/devflow-conf-2027/sessions                                 0             44  PASS
/e/devflow-conf-2027/speakers                                 0             44  PASS
/e/devflow-conf-2027/agenda                                   0             44  PASS
/e/devflow-conf-2027/schedule                                 0             44  PASS
/e/devflow-conf-2027/gallery                                  0             44  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001            0             44  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001               0             44  PASS
/embed/devflow-conf-2027/sessions                             0             44  PASS
/embed/devflow-conf-2027/agenda                                0             44  PASS
/embed/devflow-conf-2027/speakers                              0             44  PASS
/login                                                        0             48  PASS
/portal                                                       0             44  PASS
/portal/submissions/seed_submission_0001                      0             44  PASS
/portal/submissions/seed_submission_0001/edit                 0             44  PASS
/portal/profile                                               0             44  PASS
/portal/tasks                                                 0             44  PASS
/portal/tasks/seed_task_assignment_0001/form                  0             44  PASS
/account/password                                              0             48  PASS
/docs/api                                                     0              -  PASS
/dev/mailbox                                                  0              -  PASS

21/21 mobile routes passed
```

**Note**: as flagged above, `/embed/devflow-conf-2027/schedule` and
`/embed/devflow-conf-2027/gallery` are NOT in this table —
`MOBILE_ROUTE_MANIFEST` (scripts/render-sweep.ts) was out of scope for this
task's file-touch restriction and was left unmodified. The desktop pass
above does cover both at 1280px.

**Section result: PASS for all 21 entries currently in the manifest; open
item that 2 of the 5 embed twins are absent from the phone-specific
manifest (see Coverage check above).**

## Admin mobile pass (390x844, advisory) — 20/20 PASS

All organizer + reviewer routes (ADMIN_MOBILE_ROUTE_MANIFEST, derived from
`app/src/routeManifest.ts`) render with 0 overflow and >=44px tap targets.

**Section result: PASS (20/20, advisory)**

## Font-floor pass (10px minimum, advisory) — 85/85 PASS

All entries (desktop + mobile viewports, every role) report `minFontPx >=
10`. Both new embed entries are represented here at desktop and mobile
viewport:

```
/embed/devflow-conf-2027/schedule    public  desktop  12.8  PASS
/embed/devflow-conf-2027/gallery     public  desktop  12    PASS
```

(These two do not appear in the mobile-viewport rows of this pass either,
for the same MOBILE_ROUTE_MANIFEST-scope reason as above — the type-floor
pass's mobile viewport rows are driven from `MOBILE_ROUTE_MANIFEST`.)

**Section result: PASS (85/85, advisory)**

## WCAG-contrast pass (advisory) — 44/44 PASS

All entries report `minRatio >= 4.5` (well above, most at ~6.28 or higher).
Both new embed entries pass:

```
/embed/devflow-conf-2027/schedule    public  6.82  PASS
/embed/devflow-conf-2027/gallery     public  6.28  PASS
```

**Section result: PASS (44/44, advisory)**

## Summary

| Section                          | Result            |
|-----------------------------------|-------------------|
| Desktop pass (44 routes)          | PASS (44/44)      |
| Mobile pass (390x844, 21 routes)  | PASS (21/21) — but manifest coverage gap noted (see below) |
| Admin mobile pass (advisory)      | PASS (20/20)      |
| Font-floor pass (advisory)        | PASS (85/85)      |
| WCAG-contrast pass (advisory)     | PASS (44/44)      |

**OPEN ITEMS: 1**

1. `scripts/render-sweep.ts`'s `MOBILE_ROUTE_MANIFEST` (390x844 phone-only
   pass) still lists only 3 of the 5 embed twins
   (`sessions`/`agenda`/`speakers`), missing `/embed/:slug/schedule` and
   `/embed/:slug/gallery`. Out of scope for this task (file-touch
   restriction limited this task to `app/src/routeManifest.ts` plus files
   under `docs/verification-log/`). A future task should add the two
   missing entries to `MOBILE_ROUTE_MANIFEST` in
   `scripts/render-sweep.ts` and re-run the gate to get true phone-viewport
   coverage of all five embed surfaces.

**RESULT: PASS** — all render-sweep gate sections pass at sha
`f4421b1ba71d9557d3a7f688982e35b36b89fd3c` (this task's branch point) with
the `app/src/routeManifest.ts` desktop-manifest coverage gap for
DEC-489/490 fixed, 1 open item remaining (phone-manifest-only gap, out of
this task's scope).
