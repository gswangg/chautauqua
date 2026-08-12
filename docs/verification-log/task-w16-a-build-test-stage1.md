# task-w16-a build/test/gate evidence pass (STAGE1-CLOSE wave 16)

Audited sha (working tree at time of this run, pre-commit HEAD): `f86551304cb7a71c3b7cd39a8d38a777b20c38d5`
Branch: `task-w16-a`
Worktree: `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w16-a`

## Source fix (DEC-444)

Two declaration sites re-pointed from `var(--chq-disabled)` to
`var(--chq-muted)`, exactly as located by
`docs/verification-log/task-w14-d-contrast-flip-stage1.md:117-133`:

- `app/src/styles.css:1147-1149`
  ```css
  .chq-forms-field-locked {
    color: var(--chq-muted);
  }
  ```
- `app/src/pages/forms/forms.css:130-132`
  ```css
  .chq-forms-settings-title {
    color: var(--chq-muted);
  }
  ```

`--chq-disabled` itself is unchanged (`app/src/styles.css:30`, still
`#8E8A7A`) — it remains in use for genuinely disabled controls elsewhere and
stays WCAG-exempt per DEC-430/DEC-444. `scripts/render-sweep-contrast.ts`'s
thresholds, selectors, and measurement code were not touched (DEC-430:
remedies change pixels, never the instrument).

## Evidence pass

### 1. `npm run build`

```
> build
> tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build --config app/vite.config.ts
...
✓ 155 modules transformed.
...
../public/admin/assets/index-DyWSxcKX.js                  183.82 kB │ gzip: 59.96 kB
✓ built in 749ms
```

PASS — no type errors, build succeeds.

### 2. `npm test`

```
 Test Files  278 passed (278)
      Tests  2304 passed (2304)
   Duration  31.21s
```

PASS — all 2304 tests green (ran again after the flip edits with the same
result: 278 files / 2304 tests passed).

### 3. `npm run bundle:check`

```
Entry bundle: index-DyWSxcKX.js + index-BOb7RLKn.css = 62.07 kB gzip (budget 300.00 kB)
bundle:check PASSED
```

PASS.

### 4. `npm run gate:render-sweep`

Ran self-contained (own vite build, migrations, seed, seed-r2, own wrangler
dev instance on a free port). `.wrangler/state/v3/{d1,r2}` was cleared
before each invocation; `npm run seed` was never run manually. Ran twice:
once before the flip (to gather the all-PASS contrast reading needed to
justify the flip) and once after (to confirm CONTRAST_BLOCKING=true still
exits 0). Both runs read identically all-PASS; full table below is from the
post-flip run, exit code 0.

#### Desktop route sweep (405/405 endpoint hits across passes, headline counts)

```
42/42 routes passed
```

All 42 desktop routes (organizer/reviewer/speaker/public roles across
admin, portal, public event pages, embeds, docs, dev mailbox) returned
200/expected content with no console errors.

#### Mobile overflow/tap-target sweep (390x844, BLOCKING)

```
21/21 mobile routes passed
```

All public/portal/account mobile routes: `overflowPx=0`, `minControlPx>=44`
(48 on `/login` and `/account/password`).

#### Admin-mobile pass (390x844, advisory, DEC-393/DEC-431) — ADMIN_MOBILE_PASS_BLOCKING=true

```
20/20 mobile routes passed
```

All 20 `/admin/*` + `/account/password` (organizer/reviewer) mobile routes:
`overflowPx=0`, `minControlPx=44`.

#### Type-floor pass (10px minimum, advisory, DEC-421) — FONT_FLOOR_BLOCKING=true

```
83/83 font-floor checks passed
```

Every desktop and mobile route/role combination measured `minFontPx>=10`
(range 10-13 observed, e.g. `/embed/devflow-conf-2027/speakers` desktop
13px, `/admin/overview` organizer desktop 10px).

#### WCAG AA contrast pass (DEC-426) — CONTRAST_BLOCKING

```
path                                                                            role       minRatio  status
/admin/overview                                                                 organizer      6.28  PASS
/admin/submissions                                                              organizer      6.28  PASS
/admin/submissions/forms                                                        organizer      6.28  PASS
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
/admin/review/plans/seed_evaluation_plan_0001/progress                         organizer      6.28  PASS
/admin/review/plans/seed_evaluation_plan_0001/results                          organizer      6.28  PASS
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

42/42 contrast checks passed
```

**42/42 — all-PASS.** The previously-known third offender
(`/admin/submissions/forms` `td` at ratio 3.06, `--chq-disabled` on
`.chq-forms-field-locked` / `.chq-forms-settings-title`) is fixed: that
route's contrast now reads 6.28:1, well above the 4.5:1 AA minimum. No new
offender was unmasked by this fix (unlike w13-a, which unmasked this exact
offender when fixing the two DEC-430 items).

`gate:render-sweep OK`, exit code 0.

## THE FLIP (DEC-445 / DEC-436)

This lane's own render-sweep run reads 42/42 contrast all-PASS (and 42/42
desktop, 21/21 mobile, 20/20 admin-mobile, 83/83 font-floor also all-PASS).
Per DEC-436 ("flip only if your own run reads all-PASS") and DEC-445
(this lane owns the flip if it earns it):

- `scripts/render-sweep-contrast.ts:25` — `CONTRAST_BLOCKING` flipped from
  `false` to `true`.
- The flip-rule comment above the constant was rewritten to record that
  this lane's own run earned the flip, naming the offender it fixed
  (`--chq-disabled` on `.chq-forms-field-locked` /
  `.chq-forms-settings-title` on `/admin/submissions/forms`, ratio 3.06,
  now `--chq-muted` at 6.28:1) and the two prior non-flipping runs (w14-d,
  w15-e) that re-confirmed the same offender unfixed.
- `test/render-sweep-contrast.test.ts:97-99` updated: the "starts false"
  assertion (`expect(CONTRAST_BLOCKING).toBe(false)`) is replaced with an
  assertion that it is now `true` (DEC-436's corollary: the flipping lane
  owns the old-value test).
- Re-ran `npm run build`, `npm test` (2304/2304 passed), and
  `npm run gate:render-sweep` after the flip — gate still exits 0 with
  `CONTRAST_BLOCKING=true`, since the contrast pass is genuinely all-PASS.

No new offender was unmasked by the fix, so there was nothing further to
re-point.

## RESULT: PASS

The flip fired: `CONTRAST_BLOCKING` is now `true` in this branch, because
this lane's own render-sweep run read all-PASS (42/42 contrast checks, plus
all-PASS on desktop routes, mobile overflow/tap-target, admin-mobile, and
font-floor) after DEC-444's two-site re-point of
`.chq-forms-field-locked` / `.chq-forms-settings-title` from
`var(--chq-disabled)` to `var(--chq-muted)`.
