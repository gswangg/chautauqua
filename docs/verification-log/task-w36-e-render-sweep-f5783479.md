# task-w36-e render-sweep @ f5783479

CLOSES the task-w35-b instrument gap
(`docs/verification-log/index/0188-2026-08-15-task-w35-b-render-sweep-a0b8501b.md:29-39`):
the `.chq-participation-menu-caret` contrast pair, credited a PASS by
task-w29-d but never enumerated by `scripts/render-sweep-contrast.ts`
(task-w35-b's grep found zero selector references), is now explicitly
enumerated at runtime and published as a `NAMED-PAIR` note in the contrast
table.

HEAD at start of task (wave-36 frozen boundary): `f5783479c7a1b8c96ef1506c3cfff1661fd6e338`
(short `f5783479`). This lane is the only wave-36 lane permitted to touch
`scripts/` (DEC-069's wave-28 amendment allow-lists instrument repair as
non-code-bearing); `src/` and `app/src/` remain untouched by this task.

## DEC-644 wave-36 three-sha boundary block

- HEAD (this lane, post-commit): the tip of branch `task-w36-e` (this
  commit) — inherently unknowable before `git commit` produces it; not
  self-referenced by literal sha here, verifiable via `git -C
  <worktree> log -1 --format=%H task-w36-e`.
- Newest product-bearing first-parent sha on `main` (touches `src/`,
  `app/`, `migrations/`, or `package.json`): `3a041507` (`merge task-w35-c`)
  — confirmed via `git log --oneline --first-parent 0db68e36..main -- src
  app migrations package.json` returning exactly that one commit, and no
  first-parent commit after it up to `main`'s current tip touches those
  paths.
- `merge-base --is-ancestor f5783479 <sibling>` per live wave-36 sibling
  ref, all confirmed ANCESTOR (shared freeze boundary):
  - `task-w36-a`: ancestor
  - `task-w36-c`: ancestor
  - `task-w36-d`: ancestor
  - `task-w36-f`: ancestor

## Determination: renders, and reachable by the sampler

Runtime evidence (not a source-reading claim) that the pair exists and is
reachable:

- `app/src/pages/speakers/ParticipationMenu.tsx:99` renders
  `<span className="chq-participation-menu-caret" aria-hidden="true">▾</span>`
  — a direct, non-empty text node (`▾`), which is exactly what
  `scripts/render-sweep.ts`'s `hasNonEmptyDirectText` (around :765-880)
  requires to consider an element for contrast measurement. `aria-hidden`
  is not checked by that predicate, so it does not exclude the element.
- `ParticipationMenu` is used on `/admin/speakers` (via
  `OnboardingGrid.tsx:878,980`) and `/admin/speakers/seed_contact_0001`
  (via `SpeakerDetailPage.tsx:291`) — both named routes in the task.
- `app/src/pages/speakers/speakers.css:405` (`.chq-participation-menu-caret
  { color: inherit; ... }`, DEC-830 wave-29 amendment) is the fix
  task-w29-d credited; it is present and unchanged by this task.

Extended `scripts/render-sweep.ts`'s in-page `measureContrast` callback to
additionally `document.querySelector(NAMED_CONTRAST_SELECTOR)`
(`NAMED_CONTRAST_SELECTOR = ".chq-participation-menu-caret"`, new export in
`scripts/render-sweep-contrast.ts`) on every route, independent of whether
that element happens to be the route's global-minimum-ratio offender, and
compute its own fg/bg/ratio/PASS-FAIL against the applicable WCAG AA
threshold. `evaluateContrast` now folds a `namedPairNote` into every
`ContrastResult` (published even on `ok: true` rows) and, if the named pair
itself falls under threshold, adds it to `reasons` so the route FAILs (same
mechanism as `offenders`, never bypassing `CONTRAST_BLOCKING`).

## Re-run: `npm run gate:render-sweep` (with the extended instrument)

Sequence: `[ -d node_modules ] || npm ci` (already present) -> `npx tsx
scripts/ensure-dev-vars.ts` (no output, dev vars already present) -> `npm
run build` (green, `vite build --config app/vite.config.ts` via the root
build script) -> `npm run db:migrate` (43 migrations, all clean) -> `npm
run seed` (D1 + R2 seed, clean) -> `npm run gate:render-sweep` (own
`wrangler dev` on an OS-assigned free port via `findFreePort()`, per the
task-w35-b-documented gap between the task wording's literal-port request
and the tool's actual interface — unchanged by this task).

Exit code: **0** (`gate:render-sweep OK` printed, confirmed separately via
`echo "exit=$?"` after a bare re-run: `exit=0`).

### Score lines (verbatim from log, all seven passes)

- desktop: `60/60 routes passed`
- public-mobile (mobile pass, 390x844): `26/26 mobile routes passed`
- admin-mobile (advisory): `28/28 mobile routes passed`
- font-floor (10px minimum, advisory): `114/114 font-floor checks passed`
- type-role (/admin/overview desktop, advisory): `7/7 type-role checks passed`
- contrast (WCAG AA, advisory): `60/60 contrast checks passed`
- interaction-state (B8 focus/hover/disabled, advisory): `3/3 interaction-state checks passed`

Zero FAIL rows anywhere across all seven passes.

### Contrast pass, full 60-row table (now carrying the NAMED-PAIR rows)

```
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
```

Both `/admin/speakers` and `/admin/speakers/seed_contact_0001` now carry an
explicit `NAMED-PAIR .chq-participation-menu-caret` note:
`span.chq-participation-menu-caret ratio=6.82 fg=rgb(247,249,240)
bg=rgb(78,92,49) PASS`. 6.82:1 clears the WCAG AA normal-text minimum
(4.5:1) with margin. The seeded contact in these two routes carries a
`complete` participation status (`.chq-speakers-status-complete`, olive
fill `var(--chq-brand)` = `rgb(78,92,49)`), the exact case the DEC-830
wave-29 `color: inherit` fix targeted — confirming the fix holds at
runtime, not merely by source inspection.

## Instrument change (allow-listed, `scripts/` only)

- `scripts/render-sweep-contrast.ts`: new `NAMED_CONTRAST_SELECTOR`
  export, `ContrastObservation.namedPair` / `ContrastResult.namedPairNote`
  fields, `evaluateContrast` folds a FAILing named pair into `reasons`
  (blocking, same as `offenders` — `CONTRAST_BLOCKING` untouched),
  `formatContrastTable` prints the note.
- `scripts/render-sweep.ts`: `measureContrast`'s in-page callback (inline,
  DEC-411) now also queries `NAMED_CONTRAST_SELECTOR` and computes its own
  ratio, independent of the page's global minimum; call site threads
  `namedPair` through to `evaluateContrast`.
- No sampler narrowing, no new exemption, no `CONTRAST_BLOCKING` flip —
  the extension only ADDS a check that always publishes (PASS or FAIL),
  never removes or exempts anything.
- Targeted tests added: `test/render-sweep-contrast.test.ts` (4 new cases —
  PASS/FAIL/absent-selector/table-formatting for `namedPair`). Ran
  `npx vitest run test/render-sweep-contrast.test.ts` (18/18 passed) and
  `npx vitest related scripts/render-sweep-contrast.ts` (136/136 passed
  across 5 related files). Full suite NOT run (task-w36-a owns that, per
  the task's own instruction).

## RESULT

PASS — exit code 0, all seven passes 100% clean, one expected
EXEMPT-BY-RULE row (unchanged, `/admin/review/plans/seed_evaluation_plan_0001`).
The task-w35-b instrument gap is CLOSED: the `.chq-participation-menu-caret`
pair is now enumerated by name on both `/admin/speakers` and
`/admin/speakers/seed_contact_0001`, measured at runtime (not asserted from
source), and reads `ratio=6.82 PASS` on both — the DEC-830 wave-29 fix is
confirmed live, not merely present in the CSS source. No CSS defect to
file; gate stays green.

OPEN ITEMS: 0
