# task-w35-b render-sweep @ a0b8501b

DESIGN-FIDELITY MEASUREMENT LANE, LOG-ONLY (DEC-453). Nothing under
`src/`, `app/src/`, `scripts/`, `test/`, `migrations/`, `package.json` was
touched by this task. Superseding stale reading `task-w28-d @ c6dbdb7c`
(docs/verification-log.md:4127-4182, seven waves and many product merges
stale).

HEAD at start of task: `a0b8501b2e3cc6e57d6525d41ba1554c5943c483` (short
`a0b8501b`).

## Sequence run

`npx tsx scripts/ensure-dev-vars.ts` -> `npx vite build --config
app/vite.config.ts` -> `npm run db:migrate` -> `npm run seed` -> `npm run
gate:render-sweep`. The build/migrate/seed steps were run standalone first
(all green); `npm run gate:render-sweep` then re-ran its own internal
build+migrate+seed sequence (scripts/render-sweep.ts:1143-1157, DEC-268)
before booting `wrangler dev`.

Port: the task instruction asked for wrangler dev bound to port 8952.
`scripts/render-sweep.ts`'s `main()` always calls `findFreePort()`
(line 1145) with no env var, flag, or other override to pin a literal
port — this is not something a caller of `npm run gate:render-sweep` can
configure. The gate booted its own wrangler dev on OS-assigned port
`61627` (log line 5841: `render-sweep: starting wrangler dev on port
61627...`), which by construction (`findFreePort` binds an ephemeral OS
port) cannot collide with any sibling worktree's server. Flagging this as
a gap between the task wording and the tool's actual interface rather than
silently treating 8952 as satisfied.

Exit code: **0**. `scripts/render-sweep.ts` only prints `gate:render-sweep
OK` when `failed === false` (lines 1418-1420), and only sets
`process.exitCode = 1` when `failed` (line 1435). The log's last line is
`gate:render-sweep OK` with no preceding `failed = true` trigger (no
blocking-gate FAIL was hit), so exit code is 0.

## Score lines (verbatim from log)

- desktop: `60/60 routes passed`
- public-mobile (mobile pass, 390x844): `26/26 mobile routes passed`
- admin-mobile (advisory): `28/28 mobile routes passed`
- font-floor (10px minimum, advisory): `114/114 font-floor checks passed`
- type-role (/admin/overview desktop, advisory): `7/7 type-role checks passed`
- contrast (WCAG AA, advisory): `60/60 contrast checks passed`
- interaction-state (B8 focus/hover/disabled, advisory): `3/3 interaction-state checks passed`

## FAIL rows

None. Every row across all seven passes reported `PASS`. Zero FAIL rows
anywhere in the run.

## EXEMPT-BY-RULE rows

Exactly one, from the contrast pass:

```
/admin/review/plans/seed_evaluation_plan_0001                                   organizer      3.09  PASS  [EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component): label.chq-review-checkbox-label ratio=3.09 fg=rgb(125,120,105) bg=rgb(221,216,200)]
```

## Full per-row tables

### Desktop pass (60/60 routes passed)

```
path                                                                            role       status
/admin/overview                                                                 organizer  PASS
/admin/submissions                                                              organizer  PASS
/admin/submissions/forms                                                        organizer  PASS
/admin/submissions/delete                                                       organizer  PASS
/admin/submissions/seed_submission_0001                                         organizer  PASS
/admin/speakers                                                                 organizer  PASS
/admin/speakers/seed_contact_0001                                               organizer  PASS
/admin/content                                                                  organizer  PASS
/admin/content/seed_submission_0001                                             organizer  PASS
/admin/agenda                                                                   organizer  PASS
/admin/comms                                                                    organizer  PASS
/admin/contacts                                                                 organizer  PASS
/admin/contacts/merge                                                           organizer  PASS
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
/portal/preview                                                                 organizer  PASS
/portal/submissions                                                             speaker    PASS
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
/e/devflow-conf-2027/programme                                                  public     PASS
/submit/devflow-conf-2027                                                       public     PASS
/account/password                                                               organizer  PASS
/account/password                                                               reviewer   PASS
/account/password                                                               speaker    PASS
/logout                                                                         organizer  PASS
/logout                                                                         speaker    PASS
/admin/*                                                                        organizer  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     PASS
/embed/devflow-conf-2027/sessions                                               public     PASS
/embed/devflow-conf-2027/agenda                                                 public     PASS
/embed/devflow-conf-2027/speakers                                               public     PASS
/embed/devflow-conf-2027/schedule                                               public     PASS
/embed/devflow-conf-2027/gallery                                                public     PASS
/embed/devflow-conf-2027/sessions/seed_submission_0001                          public     PASS
/embed/devflow-conf-2027/speakers/seed_contact_0001                             public     PASS
/login                                                                          public     PASS
/forgot                                                                         public     PASS
/docs/api                                                                       public     PASS
/dev/mailbox                                                                    organizer  PASS
/                                                                               public     PASS
/portal/resources                                                               speaker    PASS
/dev/mailbox/seed_email_log_0001                                                organizer  PASS
/embed/e/seed_embed_0001                                                        public     PASS

60/60 routes passed
```

### Public-mobile pass (390x844) (26/26 mobile routes passed)

```
path                                                overflowPx  minControlPx  status
/                                                            0              -  PASS
/submit/devflow-conf-2027                                    0              -  PASS
/e/devflow-conf-2027/sessions                                0             44  PASS
/e/devflow-conf-2027/speakers                                0             44  PASS
/e/devflow-conf-2027/agenda                                  0             44  PASS
/e/devflow-conf-2027/schedule                                0             44  PASS
/e/devflow-conf-2027/gallery                                 0             44  PASS
/e/devflow-conf-2027/programme                               0              -  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             44  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001              0             44  PASS
/embed/devflow-conf-2027/sessions                            0             44  PASS
/embed/devflow-conf-2027/agenda                              0             44  PASS
/embed/devflow-conf-2027/speakers                            0             44  PASS
/embed/devflow-conf-2027/schedule                            0              -  PASS
/embed/devflow-conf-2027/gallery                             0             44  PASS
/login                                                       0             46  PASS
/forgot                                                      0             46  PASS
/docs/api                                                    0              -  PASS
/embed/e/seed_embed_0001                                     0             44  PASS
/portal                                                      0             44  PASS
/portal/submissions/seed_submission_0001                     0             44  PASS
/portal/submissions/seed_submission_0001/edit                0             44  PASS
/portal/profile                                              0             44  PASS
/portal/tasks                                                0             44  PASS
/portal/tasks/seed_task_assignment_0001/form                 0             44  PASS
/account/password                                            0             46  PASS

26/26 mobile routes passed
```

### Admin-mobile pass (390x844, advisory) (28/28 mobile routes passed)

```
path                                                                            overflowPx  minControlPx  status
/admin/overview                                                                          0             44  PASS
/admin/submissions                                                                       0             44  PASS
/admin/submissions/forms                                                                 0             44  PASS
/admin/submissions/delete                                                                0             44  PASS
/admin/submissions/seed_submission_0001                                                  0             44  PASS
/admin/speakers                                                                          0             44  PASS
/admin/speakers/seed_contact_0001                                                        0             44  PASS
/admin/content                                                                           0             44  PASS
/admin/content/seed_submission_0001                                                      0             44  PASS
/admin/agenda                                                                            0             44  PASS
/admin/comms                                                                             0             44  PASS
/admin/contacts                                                                          0             44  PASS
/admin/contacts/merge                                                                    0             44  PASS
/admin/settings                                                                          0             44  PASS
/admin/review                                                                            0             44  PASS
/admin/review/plans/new                                                                  0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                                   0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                                    0             44  PASS
/admin/review                                                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002           0             44  PASS
/portal/preview                                                                          0              -  PASS
/account/password                                                                        0             44  PASS
/account/password                                                                        0             44  PASS
/logout                                                                                  0             46  PASS
/dev/mailbox                                                                             0              -  PASS
/dev/mailbox/seed_email_log_0001                                                         0             44  PASS

28/28 mobile routes passed
```

### font-floor pass (10px minimum, advisory) (114/114 font-floor checks passed)

Every row across desktop (60 rows) + public/portal/admin mobile (54 rows)
reported `PASS`, minFontPx values ranging 10-16 (all >= 10px floor). Full
114-row table quoted in `/tmp`-derived working log at the time of this
task's run; representative rows:

```
path                                                                            role       viewport  minFontPx  status
/admin/overview                                                                 organizer  desktop         10  PASS
/admin/submissions/delete                                                       organizer  desktop         11  PASS
/e/devflow-conf-2027/programme                                                  public     desktop       14.4  PASS
/embed/devflow-conf-2027/speakers/seed_contact_0001                             public     desktop         16  PASS
/portal                                                                         speaker    mobile          10  PASS
/dev/mailbox/seed_email_log_0001                                                organizer  mobile          11  PASS

114/114 font-floor checks passed
```

### type-role pass (/admin/overview desktop, advisory) (7/7 type-role checks passed)

```
selector                                                          role                    status
.chq-overview-headline                                            overview-headline       PASS
.chq-overview-section-label                                       section-label           PASS
.chq-overview-deadline-label                                      deadline-label          PASS
.chq-overview-deadline-value:not(.chq-overview-deadline-nearest)  deadline-value          PASS
.chq-overview-deadline-value.chq-overview-deadline-nearest        deadline-value-nearest  PASS
.chq-overview-row-title                                           row-title               PASS
.chq-overview-deadline-value (group)                              deadline-strip-nearest  PASS

7/7 type-role checks passed
```

### contrast pass (WCAG AA, advisory) (60/60 contrast checks passed)

```
path                                                                            role       minRatio  status
/admin/overview                                                                 organizer      6.28  PASS
/admin/submissions                                                              organizer      6.28  PASS
/admin/submissions/forms                                                        organizer      6.28  PASS
/admin/submissions/delete                                                       organizer      6.28  PASS
/admin/submissions/seed_submission_0001                                         organizer      6.28  PASS
/admin/speakers                                                                 organizer      6.28  PASS
/admin/speakers/seed_contact_0001                                               organizer      6.28  PASS
/admin/content                                                                  organizer      5.95  PASS
/admin/content/seed_submission_0001                                             organizer      5.95  PASS
/admin/agenda                                                                   organizer      5.95  PASS
/admin/comms                                                                    organizer      5.95  PASS
/admin/contacts                                                                 organizer      6.28  PASS
/admin/contacts/merge                                                           organizer      6.28  PASS
/admin/settings                                                                 organizer      6.28  PASS
/admin/review                                                                   organizer      5.95  PASS
/admin/review/plans/new                                                         organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer      3.09  PASS  [EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component): label.chq-review-checkbox-label ratio=3.09 fg=rgb(125,120,105) bg=rgb(221,216,200)]
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer      6.28  PASS
/admin/review                                                                   reviewer       6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer       6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer       6.28  PASS
/portal                                                                         speaker        6.28  PASS
/portal/preview                                                                 organizer      6.28  PASS
/portal/submissions                                                             speaker        6.28  PASS
/portal/submissions/seed_submission_0001                                        speaker        6.28  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker        6.28  PASS
/portal/profile                                                                 speaker        6.28  PASS
/portal/tasks                                                                   speaker        6.28  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker        6.28  PASS
/e/devflow-conf-2027/sessions                                                   public         6.28  PASS
/e/devflow-conf-2027/speakers                                                   public         5.95  PASS
/e/devflow-conf-2027/gallery                                                    public         6.28  PASS
/e/devflow-conf-2027/agenda                                                     public         5.95  PASS
/e/devflow-conf-2027/schedule                                                   public         6.28  PASS
/e/devflow-conf-2027/programme                                                  public         6.28  PASS
/submit/devflow-conf-2027                                                       public         6.28  PASS
/account/password                                                               organizer      6.28  PASS
/account/password                                                               reviewer       6.28  PASS
/account/password                                                               speaker        6.28  PASS
/logout                                                                         organizer      6.28  PASS
/logout                                                                         speaker        6.28  PASS
/admin/*                                                                        organizer      6.28  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public         6.28  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public         6.28  PASS
/embed/devflow-conf-2027/sessions                                               public         6.28  PASS
/embed/devflow-conf-2027/agenda                                                 public         5.95  PASS
/embed/devflow-conf-2027/speakers                                               public         5.95  PASS
/embed/devflow-conf-2027/schedule                                               public         8.61  PASS
/embed/devflow-conf-2027/gallery                                                public         6.28  PASS
/embed/devflow-conf-2027/sessions/seed_submission_0001                          public         6.41  PASS
/embed/devflow-conf-2027/speakers/seed_contact_0001                             public         6.41  PASS
/login                                                                          public         6.28  PASS
/forgot                                                                         public         6.28  PASS
/docs/api                                                                       public         6.28  PASS
/dev/mailbox                                                                    organizer      6.28  PASS
/                                                                               public         5.95  PASS
/portal/resources                                                               speaker        6.28  PASS
/dev/mailbox/seed_email_log_0001                                                organizer      6.28  PASS
/embed/e/seed_embed_0001                                                        public         6.28  PASS

60/60 contrast checks passed
```

Note: no `.chq-participation-menu-caret` selector, row, or path appears
anywhere in this contrast table (or anywhere in the run's full log —
`grep -n "caret" <log>` returned zero hits). See "Three prior claims"
below, claim (ii).

### interaction-state pass (B8 focus/hover/disabled, advisory) (3/3 interaction-state checks passed)

```
selector                                               role                       kind      status
.chq-content-row                                       content-row-hover          hover     PASS
.chq-review-field-disabled .chq-review-checkbox-label  review-anonymize-disabled  disabled  PASS
.chq-cfp-step-next                                     cfp-primary-focus          focus     PASS

3/3 interaction-state checks passed
```

## Three prior claims, checked against THIS run (DEC-644 wave-35 amendment)

**(i) `.chq-cfp-step-next` / role `cfp-primary-focus` / `focus` PASS,
credited to task-w29-c — CONFIRMED.** Quoted row above in the
interaction-state table: `.chq-cfp-step-next  cfp-primary-focus  focus
PASS`. This is the first time this exact row has been observed together
with the other two claims below in one run.

**(ii) both `.chq-participation-menu-caret` contrast rows PASS, credited
to task-w29-d via `app/src/pages/speakers/speakers.css:384-403` —
FALSIFIED (not observable in this run, at all).** The CSS fix itself is
present: `app/src/pages/speakers/speakers.css:405` defines
`.chq-participation-menu-caret { color: inherit; ... }` with the DEC-830
wave-29-amendment comment block at lines 384-403 explaining the fix.
`app/src/pages/speakers/ParticipationMenu.tsx:99` renders the element
(`<span className="chq-participation-menu-caret" aria-hidden="true">`).
But `scripts/render-sweep.ts`'s contrast-pass route/selector set never
enumerates `.chq-participation-menu-caret` anywhere — `grep -n
"participation" scripts/*.ts` finds zero matches outside seed-data task
titles unrelated to this selector, and the 60-row contrast table above
(every row this run's contrast pass produced) contains no
`/admin/speakers` or `/admin/speakers/*` row with a caret-selector
offender/exempt annotation, nor any row naming
`.chq-participation-menu-caret` at all. There is no contrast check for
this selector in the gate as currently written, so "both contrast rows
PASS" cannot be quoted from this or any run of `gate:render-sweep` as it
stands — the claim describes a check that does not exist in the
instrumented gate.

**(iii) the `.chq-review-field-disabled .chq-review-checkbox-label` pair
reports as an `EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component)` row
and NOT as a contrast FAIL — CONFIRMED.** Quoted row above in the contrast
table: `/admin/review/plans/seed_evaluation_plan_0001  organizer  3.09
PASS  [EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component):
label.chq-review-checkbox-label ratio=3.09 fg=rgb(125,120,105)
bg=rgb(221,216,200)]`. The exemption path
(`scripts/render-sweep-contrast.ts:77-84,112-115`) matches the description:
lines 77-84 document the `exempted` field on `ContrastObservation` (DEC-426
wave-29 amendment, disabled-token pair `#7D7869`/`#DDD8C8` exempt under
WCAG 2.1 SC 1.4.3), and lines 112-115 in `evaluateContrast` build the
`exemptNote` string (`EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive
component): ...`) exactly as printed. `reasons` (which drives `ok`/FAIL)
never includes exempted pairs, so this row can never surface as a FAIL
through this path — confirmed both by the source and by this run's actual
printed row.

## `KNOWN_CLIP_EXCEPTIONS` (scripts/render-sweep.ts:219-225)

Still holds exactly one entry:

```ts
export const KNOWN_CLIP_EXCEPTIONS: Readonly<Record<string, string>> = {
  "/admin/agenda::div.chq-session-card-title": "intentional 3-line -webkit-line-clamp truncation",
};
```

No additions, no removals since task-w28-d's reading.

## RESULT

PASS — exit code 0, all seven passes 100% clean (no FAIL rows anywhere),
one EXEMPT-BY-RULE row (expected/by-design). Of the three DEC-644
wave-35-amendment claims: (i) and (iii) CONFIRMED in this single run; (ii)
FALSIFIED — the gate has no contrast check for
`.chq-participation-menu-caret` at all, so the credited "PASS" rows were
never, and currently cannot be, observed by `gate:render-sweep`.

OPEN ITEMS: 1 — claim (ii)'s underlying gap: `scripts/render-sweep.ts`'s
CONTRAST_ROUTE_MANIFEST (or equivalent selector set) does not cover
`/admin/speakers` (or any route rendering `ParticipationMenu.tsx`) for a
`.chq-participation-menu-caret`-specific contrast reading, despite a
landed DEC-830 wave-29-amendment fix targeting exactly that selector. This
is a gate-coverage gap, not a product-code defect (product code is out of
this log-only task's scope).
