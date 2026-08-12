# task-w13-a: DEC-430/DEC-431 contrast remedies + render-sweep flip

DEC-423: this filename carries the `-stage1` suffix because the unsuffixed
`task-w13-a-*` names are already taken by an earlier campaign (see
`docs/verification-log/task-w13-a-build-test.md`,
`task-w13-a-c3-build-test.md`).

## Scope

DEC-430: fix the two named WCAG-AA contrast offenders identified in
`docs/verification-log/task-w12-c-contrast-pass.md` (drag glyph, public
track chip) by changing pixels, never the `render-sweep-contrast.ts`
instrument. DEC-431: after confirming the admin-mobile pass and the
type-floor pass read all-PASS on this tree, flip
`ADMIN_MOBILE_PASS_BLOCKING` and `FONT_FLOOR_BLOCKING` to `true`.
`CONTRAST_BLOCKING` stays `false` this wave regardless (see "Contrast
pass" below — it did not read all-PASS on this tree).

## Fix 1 — forms drag glyph

`app/src/pages/forms/forms.css:99` changed `.chq-forms-field-drag`'s
`color` from `var(--chq-border)` (#BAB6A6, measured 1.80:1 on paper) to
`var(--chq-muted)` (#565A4B). One-line pixel change, no instrument touched.

## Fix 2 — public track chip

`src/routes/public/cards.tsx`'s `TrackChips` no longer emits
`style="background:${t.color}"`. It now emits
`style="--chq-track-color:<hex>"` only when `t.color` passes a strict
`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$` guard (DEC-374 pattern) — any other
value (CSS injection, `var(...)`, keywords, malformed hex) emits no style
attribute at all.

`src/routes/public/public.css.ts`'s `.chq-pub-track-chip` rule no longer
sets `color: var(--chq-on-brand)` on an arbitrary-colour background. It now
renders `color: var(--chq-ink)` on `background: var(--chq-surface)` with a
`1px solid var(--chq-hairline)` border, and carries the track colour only
as a bounded `::before` swatch dot fed by
`var(--chq-track-color, var(--chq-hairline))`. Class name
`chq-pub-track-chip` is unchanged (DEC-402/406 conformance guards depend on
it), and the chip still renders on every surface it did before (sessions,
agenda, schedule, detail, embeds).

New test: `test/public-track-chip.test.ts` — asserts a non-hex value
(`red;}`, `javascript:alert(1)`, `var(--x)`, `rgb(0,0,0)`, malformed hex)
never reaches the rendered `style` attribute; a valid 3- or 6-digit hex
value does; the chip never emits a `background:` declaration; and
`public.css.ts`'s `.chq-pub-track-chip` rule body no longer references
`--chq-on-brand`.

No existing test asserted `background:` on the chip (checked
`test/public-embed-config.test.ts`, the only other file referencing
`chq-pub-track-chip`) — nothing to update there.

## Build + unit tests

`npm run build`: clean (tsc --noEmit x2, vite build, 154 modules).

`npm test --silent`: 269 test files, 2241 tests, all passed (includes the
new `test/public-track-chip.test.ts` and the two updated
`test/render-sweep-lib.test.ts` assertions below).

## Render sweep

Local D1/R2 state was reset (`rm -rf .wrangler/state`) before the run per
`docs/verification-log/task-w12-a-render-sweep-overflow.md:246-249` (a
stale local D1 rejects re-seeding on a unique-constraint conflict — not
itself an instrument failure). The first sweep attempt after reset hit a
different instrument failure mid-run: `wrangler dev` stopped answering
requests around route 20/42 (`net::ERR_CONNECTION_REFUSED`) while five
other worker agents' `wrangler dev`/`d1 execute` processes were running
concurrently on the same machine (`task-w13-d`, `task-w8-i` visible in
`ps aux` at the time) — resource contention, not a product regression. A
second `rm -rf .wrangler/state` + re-seed + re-run completed cleanly with
no interference and is the reading transcribed below.

### Desktop pass — 42/42 routes passed

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
/e/devflow-conf-2027/sessions/seed_submission_0001                              public     PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public     PASS
/embed/devflow-conf-2027/sessions                                               public     PASS
/embed/devflow-conf-2027/agenda                                                 public     PASS
/embed/devflow-conf-2027/speakers                                               public     PASS
/login                                                                          public     PASS
/docs/api                                                                       public     PASS
/dev/mailbox                                                                    public     PASS

42/42 routes passed
```

### Public/portal mobile pass (390x844, blocking) — 21/21 routes passed

```
path                                                overflowPx  minControlPx  status
/submit/devflow-conf-2027                                    0             44  PASS
/e/devflow-conf-2027/sessions                                0             44  PASS
/e/devflow-conf-2027/speakers                                0             44  PASS
/e/devflow-conf-2027/agenda                                  0             44  PASS
/e/devflow-conf-2027/schedule                                0             44  PASS
/e/devflow-conf-2027/gallery                                 0             44  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001           0             44  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001              0             44  PASS
/embed/devflow-conf-2027/sessions                            0             44  PASS
/embed/devflow-conf-2027/agenda                              0             44  PASS
/embed/devflow-conf-2027/speakers                            0             44  PASS
/login                                                       0             48  PASS
/portal                                                      0             44  PASS
/portal/submissions/seed_submission_0001                     0             44  PASS
/portal/submissions/seed_submission_0001/edit                0             44  PASS
/portal/profile                                              0             44  PASS
/portal/tasks                                                0             44  PASS
/portal/tasks/seed_task_assignment_0001/form                 0             44  PASS
/account/password                                            0             48  PASS
/docs/api                                                    0              -  PASS
/dev/mailbox                                                 0              -  PASS

21/21 mobile routes passed
```

### Admin mobile pass (390x844, DEC-387/DEC-431: now blocking) — 20/20 routes passed

```
path                                                                            overflowPx  minControlPx  status
/admin/overview                                                                          0             44  PASS
/admin/submissions                                                                       0             44  PASS
/admin/submissions/forms                                                                 0             44  PASS
/admin/submissions/seed_submission_0001                                                  0             44  PASS
/admin/speakers                                                                          0             44  PASS
/admin/content                                                                           0             44  PASS
/admin/agenda                                                                            0             44  PASS
/admin/comms                                                                             0             44  PASS
/admin/contacts                                                                          0             44  PASS
/admin/settings                                                                          0             44  PASS
/admin/review                                                                            0             44  PASS
/admin/review/plans/new                                                                  0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                                   0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                                    0             44  PASS
/admin/review                                                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001                                            0             44  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002           0             44  PASS
/account/password                                                                        0             44  PASS
/account/password                                                                        0             44  PASS

20/20 mobile routes passed
```

**Flip applied**: `scripts/render-sweep-lib.ts`'s `ADMIN_MOBILE_PASS_BLOCKING`
set to `true` (was `false`). This is the pass's own confirming run on this
tree, per DEC-431 ("re-confirmed in the flipping lane's OWN run — never
flip on a prior wave's transcript").

### Type-floor pass (10px minimum, DEC-421/DEC-431: now blocking) — 83/83 checks passed

```
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
```

**Flip applied**: `scripts/render-sweep-lib.ts`'s `FONT_FLOOR_BLOCKING` set
to `true` (was `false`). Own confirming run on this tree, per DEC-431.

### Contrast pass (WCAG AA, still advisory — DEC-431 leaves `CONTRAST_BLOCKING = false`) — 41/42 checks passed

```
path                                                                            role       minRatio  status
/admin/overview                                                                 organizer      6.28  PASS
/admin/submissions                                                              organizer      6.28  PASS
/admin/submissions/forms                                                        organizer      3.06  FAIL  (contrast below WCAG AA threshold — worst: td ratio=3.06 fg=rgb(142,138,122) bg=rgb(244,241,232) | td ratio=3.06 fg=rgb(142,138,122) bg=rgb(244,241,232) | td ratio=3.06 fg=rgb(142,138,122) bg=rgb(244,241,232))
/admin/submissions/seed_submission_0001                                         organizer      6.28  PASS
/admin/speakers                                                                 organizer      6.28  PASS
/admin/content                                                                  organizer      6.28  PASS
/admin/agenda                                                                   organizer      6.28  PASS
/admin/comms                                                                    organizer      5.95  PASS
/admin/contacts                                                                 organizer      6.28  PASS
/admin/settings                                                                 organizer      5.95  PASS
/admin/review                                                                   organizer      6.28  PASS
/admin/review/plans/new                                                         organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/progress                          organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                           organizer      6.28  PASS
/admin/review                                                                   reviewer       6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001                                   reviewer       6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/submissions/seed_submission_0002  reviewer       6.28  PASS
/portal                                                                         speaker        6.28  PASS
/portal/submissions/seed_submission_0001                                        speaker        6.28  PASS
/portal/submissions/seed_submission_0001/edit                                   speaker        6.28  PASS
/portal/profile                                                                 speaker        6.28  PASS
/portal/tasks                                                                   speaker        6.28  PASS
/portal/tasks/seed_task_assignment_0001/form                                    speaker        6.28  PASS
/e/devflow-conf-2027/sessions                                                   public         6.28  PASS
/e/devflow-conf-2027/speakers                                                   public         6.28  PASS
/e/devflow-conf-2027/gallery                                                    public         6.28  PASS
/e/devflow-conf-2027/agenda                                                     public         6.28  PASS
/e/devflow-conf-2027/schedule                                                   public         6.28  PASS
/submit/devflow-conf-2027                                                       public         6.68  PASS
/account/password                                                               organizer      6.28  PASS
/account/password                                                               reviewer       6.28  PASS
/account/password                                                               speaker        6.28  PASS
/admin/*                                                                        organizer      6.28  PASS
/e/devflow-conf-2027/sessions/seed_submission_0001                              public         6.28  PASS
/e/devflow-conf-2027/speakers/seed_contact_0001                                 public         6.28  PASS
/embed/devflow-conf-2027/sessions                                               public         6.28  PASS
/embed/devflow-conf-2027/agenda                                                 public         6.82  PASS
/embed/devflow-conf-2027/speakers                                               public         6.28  PASS
/login                                                                          public         6.28  PASS
/docs/api                                                                       public         6.28  PASS
/dev/mailbox                                                                    public         6.28  PASS

41/42 contrast checks passed
```

**Not flipped, and not this task's scope to fix**: both DEC-430-named
offenders are gone from the table — the six previously-failing
`chq-pub-track-chip` routes now read 6.28-6.82, and
`/admin/submissions/forms` no longer fails on the drag glyph (which was
1.80:1, the "worst" element on that route). But fixing the drag glyph
unmasked a *third*, previously-unreported offender on that same route: a
`td` element styled with `--chq-disabled` (#8E8A7A, ratio 3.06 against
paper) that was always below AA threshold but never surfaced because the
drag glyph's worse ratio (1.80) was reported as "worst" instead. This
offender is not named by DEC-430 and is out of this task's stated scope
(fix only the two named offenders). `CONTRAST_BLOCKING` therefore stays
`false` — this run is not an all-PASS reading, contrary to the task
prompt's expectation that it would be. Flagging for the next wave that
picks up contrast remediation: search for `--chq-disabled` text-on-paper
usage, likely in a submissions/forms table cell (drag-handle sibling
column or similar), same file area as the fixed drag glyph.

Gate exit: `gate:render-sweep OK` (desktop + public/portal mobile both
blocking and clean; admin-mobile + font-floor newly blocking and clean;
contrast stays advisory and non-zero-exit despite its 1 FAIL, per
DEC-419/DEC-426).
