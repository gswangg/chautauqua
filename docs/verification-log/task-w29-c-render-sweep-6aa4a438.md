# task-w29-c — render-sweep instrument repair @ 6aa4a438

Tip sha = `6aa4a438c1195c70abb24cf4db6dc9a602368b33` (this lane's own commit,
worktree `/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua-wt/task-w29-c`,
branched from main `0f854f0a` "scribe wave 29").

Sole owner of `scripts/render-sweep.ts` this wave. Scope: three of wave 27's
five "genuinely open" render-sweep items, diagnosed for this lane as
instrument defects (not product defects) per DEC-409 and DEC-426's wave-29
amendments. Files touched: `scripts/render-sweep.ts`,
`scripts/render-sweep-lib.ts`, `scripts/render-sweep-contrast.ts`,
`test/render-sweep-interaction-states.test.ts`,
`test/render-sweep-contrast.test.ts`. No `.css`/`.css.ts` file and no
`src/views/theme.ts` touched, per the task's explicit prohibition.

## Diagnoses re-confirmed before editing

1. `.chq-cfp-step-next` — `src/routes/public/cfp.css.ts:181` sets
   `display: none`; `:202-203` flips it to `inline-flex` only inside
   `@media (max-width: 700px)`. `src/routes/public/submit-views.tsx:648-653`
   confirms it is the phone wizard's step-1 "Continue" button. Quoted lines
   re-read and confirmed live in this worktree before any edit.
2. `.chq-review-field-disabled .chq-review-checkbox-label` — confirmed via
   `app/src/pages/Review.tsx:47-65`: `me.role === 'reviewer'` mounts
   `<ReviewerQueue />` at `plans/:planId`; the organizer branch mounts
   `<PlanEditor />` at the identical path. `app/src/routeManifest.ts:114`
   (role `organizer`) and `:132` (role `reviewer`) are two manifest rows
   sharing one path string. The prior instrument matched
   `INTERACTION_STATE_ENTRIES` by path only, so it also ran against the
   reviewer visit, where the selector cannot resolve BY CONSTRUCTION —
   confirmed against docs/verification-log/task-w28-d-render-sweep-
   c6dbdb7c.md's own finding ("a real per-role DOM fact"), which stopped one
   step short of scoping the check to the persona where the element can
   exist.
3. `label.chq-review-checkbox-label` contrast ratio 3.09, fg `#7D7869` /
   bg `#DDD8C8` — re-confirmed these are exactly `--chq-disabled` /
   `--chq-disabled-bg` (DEC-436's wave-25 amendment darkened the ink token
   to `#7D7869`; fill unchanged). This is the same pair every prior wave
   (w28, w27, ...) reported as a genuine open FAIL without checking whether
   the *disabled* register is contrast-exempt.

## Fixes landed

- `InteractionStateEntry` (render-sweep-lib.ts) gained two required fields:
  `viewport: { width, height }` and `personaRole: RouteManifestEntry["role"]`.
  All three `INTERACTION_STATE_ENTRIES` rows now declare them explicitly
  (focus -> 390x844/public, hover -> 1280x720/organizer, disabled ->
  1280x720/organizer).
- `measureInteractionStatesForRoute` now matches on `path` AND
  `personaRole` (not path alone), and opens a fresh page in the SAME
  already-authenticated `BrowserContext` (no re-login) at the entry's own
  viewport when it differs from the primary page's, closing it after the
  measurement.
- `interactionStateErrorResult` now embeds
  `(viewport WxH, persona ROLE)` in every instrument-blocked reason string.
- `render-sweep-contrast.ts`'s `ContrastObservation`/`ContrastResult`
  gained an `exempted`/`exemptNote` pair. `measureContrast`'s in-page probe
  (render-sweep.ts) now classifies any under-threshold pair matching the
  `--chq-disabled`/`--chq-disabled-bg` RGB pair (tolerance ±2 per channel)
  as exempt rather than an offender; `evaluateContrast` records
  `EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component): <descriptor>`
  without ever failing OR silently passing it. `formatContrastTable`
  prints the note on the row regardless of PASS/FAIL.

## Targeted tests (TARGETED ONLY, never the full suite)

```
npx vitest related scripts/render-sweep.ts --run           # 108 passed
npx vitest run test/render-sweep-interaction-states.test.ts \
  test/render-sweep-contrast.test.ts test/render-sweep-lib.test.ts \
  test/render-sweep-manifest-parity.test.ts                # 134 passed
```
`npm run build` (tsc + app tsc + vite) — clean.

## Live gate:render-sweep, run at this lane's tip (6aa4a438)

Self-selected port `52056`, self-terminating. Full log:
6284 lines, captured in this worktree's run (not committed — ephemeral).

Seven pass-group counts, BEFORE (wave-27 `ceda66f2` receipt,
`docs/verification-log/task-w27-d-perf-rendersweep-ceda66f2.md`) vs AFTER
(this run):

| pass group | before (ceda66f2) | after (6aa4a438) |
|---|---|---|
| desktop | 59/60 | 60/60 |
| public-mobile | 26/26 | 26/26 |
| admin-mobile | 27/28 | 28/28 |
| font-floor | 114/114 | 114/114 |
| type-role (advisory) | 7/7 | 7/7 |
| contrast (advisory) | 57/60 | 58/60 |
| interaction-state (advisory) | 2/4 | **3/3** |

(desktop 59->60 and admin-mobile 27->28 are task-w27-a's pre-existing clip
fix, already merged into main ahead of this lane — not this lane's work,
noted for completeness since the same manifest rows are re-swept here.)

### Interaction-state row, this run (verbatim)

```
selector                                               role                       kind      status
.chq-content-row                                       content-row-hover          hover     PASS
.chq-review-field-disabled .chq-review-checkbox-label  review-anonymize-disabled  disabled  PASS
.chq-cfp-step-next                                     cfp-primary-focus          focus     PASS

3/3 interaction-state checks passed
```
Three rows, not four — the reviewer-role duplicate visit of the disabled
check no longer fires (personaRole scoping), and both other two-way splits
collapsed onto their one real component tree per entry.

### Contrast row for the review-anonymize selector, this run (verbatim)

```
/admin/review/plans/seed_evaluation_plan_0001    organizer    3.09  PASS  [EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component): label.chq-review-checkbox-label ratio=3.09 fg=rgb(125,120,105) bg=rgb(221,216,200)]
```

### Remaining open item — NOT this lane's

```
/admin/speakers                    organizer  1.02  FAIL  (contrast below WCAG AA threshold — worst: span.chq-participation-menu-caret ratio=1.02 fg=rgb(86,90,75) bg=rgb(78,92,49))
/admin/speakers/seed_contact_0001  organizer  1.02  FAIL  (same selector/colors)
```
`.chq-participation-menu-caret` — this is the one genuine CSS defect the
task instructions named as **OWNED-BY-task-w29-d**. No `.css`/`.css.ts`
file was touched by this lane; reconfirmed still present, unowned by this
change.

### Overall gate exit

`RESULT: exit code 1` — `CONTRAST_BLOCKING = true` and the
`.chq-participation-menu-caret` rows remain FAIL (2 routes). This is the
same pre-existing, out-of-scope reason prior waves' runs also exited
non-zero; not a regression introduced by this lane, and not fixed by this
lane per its explicit scope boundary (OWNED-BY-task-w29-d).

## Scope discipline

- Did not touch `app/src/pages/review/PlanEditor.tsx`, `src/views/theme.ts`,
  `src/routes/public/cfp.css.ts`, or any other `.css`/`.css.ts` file.
- Did not re-derive the three diagnoses; only re-confirmed the quoted lines
  against this worktree's tip before editing, per instructions.
- Did not touch `.chq-participation-menu-caret` / any contrast token value
  — left for task-w29-d.
