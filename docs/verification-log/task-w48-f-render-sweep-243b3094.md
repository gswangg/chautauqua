# task-w48-f render-sweep detail @ 243b3094

Advisory gate (DEC-069 w48, `render-sweep` classifies to null under
`classifyScope`, not one of the five DEC-069 slots). Frozen wave: nothing
under `src/**`, `app/src/**`, `migrations/**` or `package.json` was
touched in this worktree. Full command:
`sh scripts/with-test-lock.sh sh -c 'npm run db:migrate && npm run predev
&& npm run seed && npm run gate:render-sweep'`, run inside one
`with-test-lock.sh` acquisition. `wrangler dev` self-booted on port
49512 (`findFreePort()`). Exit code 0 (`gate:render-sweep OK`).

Zero FAIL rows anywhere in the full sweep output (`grep -n FAIL` over the
raw log matched nothing).

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

render-sweep: mobile pass (390x844)...

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

render-sweep: admin mobile pass (390x844, advisory)...

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

render-sweep: type-floor pass (10px minimum, advisory)...

path                                                                            role       viewport  minFontPx  status
/admin/overview                                                                 organizer  desktop         10  PASS
/admin/submissions                                                              organizer  desktop         10  PASS
/admin/submissions/forms                                                        organizer  desktop         10  PASS
/admin/submissions/delete                                                       organizer  desktop         11  PASS
/admin/submissions/seed_submission_0001                                         organizer  desktop         10  PASS
/admin/speakers                                                                 organizer  desktop         10  PASS
/admin/speakers/seed_contact_0001                                               organizer  desktop         11  PASS
/admin/content                                                                  organizer  desktop         10  PASS
/admin/content/seed_submission_0001                                             organizer  desktop         10  PASS
/admin/agenda                                                                   organizer  desktop         10  PASS
/admin/comms                                                                    organizer  desktop         10  PASS
/admin/contacts                                                                 organizer  desktop         11  PASS
/admin/contacts/merge                                                           organizer  desktop         11  PASS
/admin/settings                                                                 organizer  desktop         11  PASS
/admin/review                                                                   organizer  desktop         10  PASS
/admin/review/plans/new                                                         organizer  desktop         11  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  desktop         11  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  desktop         10  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  desktop         10  PASS
/admin/review                                                                   reviewer   desktop         10  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   desktop         11  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   desktop         11  PASS
/portal                                                                         speaker    desktop         10  PASS
/portal/preview                                                                 organizer  desktop         11  PASS
/portal/submissions                                                             speaker    desktop         10  PASS
/portal/submissions/seed_submission_0001                                        speaker    desktop         11  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    desktop         10  PASS
/portal/profile                                                                 speaker    desktop         11  PASS
/portal/tasks                                                                   speaker    desktop         10  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    desktop         11  PASS
/e/devflow-conf-2027/sessions                                                   public     desktop         11  PASS
/e/devflow-conf-2027/speakers                                                   public     desktop         11  PASS
/e/devflow-conf-2027/gallery                                                    public     desktop         11  PASS
/e/devflow-conf-2027/agenda                                                     public     desktop         11  PASS
/e/devflow-conf-2027/schedule                                                   public     desktop         11  PASS
/e/devflow-conf-2027/programme                                                  public     desktop       14.4  PASS
/submit/devflow-conf-2027                                                       public     desktop         11  PASS
/account/password                                                               organizer  desktop         11  PASS
/account/password                                                               reviewer   desktop         11  PASS
/account/password                                                               speaker    desktop         11  PASS
/logout                                                                         organizer  desktop         11  PASS
/logout                                                                         speaker    desktop         11  PASS
/admin/*                                                                        organizer  desktop         11  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     desktop         11  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     desktop         11  PASS
/embed/devflow-conf-2027/sessions                                               public     desktop         11  PASS
/embed/devflow-conf-2027/agenda                                                 public     desktop         11  PASS
/embed/devflow-conf-2027/speakers                                               public     desktop         13  PASS
/embed/devflow-conf-2027/schedule                                               public     desktop         11  PASS
/embed/devflow-conf-2027/gallery                                                public     desktop         11  PASS
/embed/devflow-conf-2027/sessions/seed_submission_0001                          public     desktop       12.8  PASS
/embed/devflow-conf-2027/speakers/seed_contact_0001                             public     desktop         16  PASS
/login                                                                          public     desktop         11  PASS
/forgot                                                                         public     desktop         11  PASS
/docs/api                                                                       public     desktop         11  PASS
/dev/mailbox                                                                    organizer  desktop         11  PASS
/                                                                               public     desktop         11  PASS
/portal/resources                                                               speaker    desktop         11  PASS
/dev/mailbox/seed_email_log_0001                                                organizer  desktop         11  PASS
/embed/e/seed_embed_0001                                                        public     desktop         11  PASS
/                                                                               public     mobile          11  PASS
/submit/devflow-conf-2027                                                       public     mobile          11  PASS
/e/devflow-conf-2027/sessions                                                   public     mobile          11  PASS
/e/devflow-conf-2027/speakers                                                   public     mobile          11  PASS
/e/devflow-conf-2027/agenda                                                     public     mobile          11  PASS
/e/devflow-conf-2027/schedule                                                   public     mobile          11  PASS
/e/devflow-conf-2027/gallery                                                    public     mobile          11  PASS
/e/devflow-conf-2027/programme                                                  public     mobile        14.4  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     mobile          11  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     mobile          11  PASS
/embed/devflow-conf-2027/sessions                                               public     mobile          11  PASS
/embed/devflow-conf-2027/agenda                                                 public     mobile          12  PASS
/embed/devflow-conf-2027/speakers                                               public     mobile          13  PASS
/embed/devflow-conf-2027/schedule                                               public     mobile          11  PASS
/embed/devflow-conf-2027/gallery                                                public     mobile          11  PASS
/login                                                                          public     mobile          11  PASS
/forgot                                                                         public     mobile          11  PASS
/docs/api                                                                       public     mobile          11  PASS
/embed/e/seed_embed_0001                                                        public     mobile          11  PASS
/portal                                                                         speaker    mobile          10  PASS
/portal/submissions/seed_submission_0001                                        speaker    mobile          11  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker    mobile          10  PASS
/portal/profile                                                                 speaker    mobile          11  PASS
/portal/tasks                                                                   speaker    mobile          10  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker    mobile          11  PASS
/account/password                                                               speaker    mobile          11  PASS
/admin/overview                                                                 organizer  mobile          10  PASS
/admin/submissions                                                              organizer  mobile          10  PASS
/admin/submissions/forms                                                        organizer  mobile          10  PASS
/admin/submissions/delete                                                       organizer  mobile          11  PASS
/admin/submissions/seed_submission_0001                                         organizer  mobile          11  PASS
/admin/speakers                                                                 organizer  mobile          11  PASS
/admin/speakers/seed_contact_0001                                               organizer  mobile          11  PASS
/admin/content                                                                  organizer  mobile          10  PASS
/admin/content/seed_submission_0001                                             organizer  mobile          10  PASS
/admin/agenda                                                                   organizer  mobile          11  PASS
/admin/comms                                                                    organizer  mobile          11  PASS
/admin/contacts                                                                 organizer  mobile          11  PASS
/admin/contacts/merge                                                           organizer  mobile          11  PASS
/admin/settings                                                                 organizer  mobile          11  PASS
/admin/review                                                                   organizer  mobile          10  PASS
/admin/review/plans/new                                                         organizer  mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer  mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer  mobile          10  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer  mobile          10  PASS
/admin/review                                                                   reviewer   mobile          10  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer   mobile          11  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer   mobile          11  PASS
/portal/preview                                                                 organizer  mobile          11  PASS
/account/password                                                               organizer  mobile          11  PASS
/account/password                                                               reviewer   mobile          11  PASS
/logout                                                                         organizer  mobile          11  PASS
/dev/mailbox                                                                    organizer  mobile          11  PASS
/dev/mailbox/seed_email_log_0001                                                organizer  mobile          11  PASS

114/114 font-floor checks passed

render-sweep: type-role pass (/admin/overview desktop, advisory)...

selector                                                          role                    status
.chq-overview-headline                                            overview-headline       PASS
.chq-overview-section-label                                       section-label           PASS
.chq-overview-deadline-label                                      deadline-label          PASS
.chq-overview-deadline-value:not(.chq-overview-deadline-nearest)  deadline-value          PASS
.chq-overview-deadline-value.chq-overview-deadline-nearest        deadline-value-nearest  PASS
.chq-overview-row-title                                           row-title               PASS
.chq-overview-deadline-value (group)                              deadline-strip-nearest  PASS

7/7 type-role checks passed

render-sweep: contrast pass (WCAG AA, advisory)...

path                                                                            role       minRatio  status
/admin/overview                                                                 organizer      6.28  PASS
/admin/submissions                                                              organizer      6.28  PASS
/admin/submissions/forms                                                        organizer      6.28  PASS
/admin/submissions/delete                                                       organizer      6.28  PASS
/admin/submissions/seed_submission_0001                                         organizer      6.28  PASS
/admin/speakers                                                                 organizer      6.28  PASS  [NAMED-PAIR .chq-participation-menu-caret: span.chq-participation-menu-caret ratio=6.82 fg=rgb(247,249,240) bg=rgb(78,92,49) PASS]
/admin/speakers/seed_contact_0001                                               organizer      6.28  PASS  [NAMED-PAIR .chq-participation-menu-caret: span.chq-participation-menu-caret ratio=6.82 fg=rgb(247,249,240) bg=rgb(78,92,49) PASS]
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

render-sweep: interaction-state pass (B8 focus/hover/disabled, advisory)...

selector                                               role                       kind      status
.chq-content-row                                       content-row-hover          hover     PASS
.chq-review-field-disabled .chq-review-checkbox-label  review-anonymize-disabled  disabled  PASS
.chq-cfp-step-next                                     cfp-primary-focus          focus     PASS

3/3 interaction-state checks passed
