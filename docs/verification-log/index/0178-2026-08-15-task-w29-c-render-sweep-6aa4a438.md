## QUALIFYING (task-w29-c)

INSTRUMENT TRUTH: three of wave 27's five "genuinely open" render-sweep
items (docs/verification-log/task-w27-d-perf-rendersweep-ceda66f2.md) were
instrument defects, not product defects — full diagnosis, fix, and live
receipt in `docs/verification-log/task-w29-c-render-sweep-6aa4a438.md`.

1. `.chq-cfp-step-next` (cfp-primary-focus): `display: none` above 700px
   (src/routes/public/cfp.css.ts:181,202-203), phone-only CFP wizard button
   — the focus probe visited it at desktop. `InteractionStateEntry` now
   carries its own `viewport`; this row runs at 390x844.
2. `.chq-review-field-disabled .chq-review-checkbox-label`
   (review-anonymize-disabled): `/admin/review/plans/:id` is one path
   shared by two structurally different manifest rows (organizer ->
   PlanEditor, reviewer -> ReviewerQueue, app/src/pages/Review.tsx:47-56) —
   the probe matched by path alone and also fired against the reviewer
   visit, where the element cannot exist BY CONSTRUCTION.
   `InteractionStateEntry` now also carries `personaRole`; the check only
   runs for the manifest visit whose role matches.
3. `label.chq-review-checkbox-label` contrast FAIL (ratio 3.09, fg #7D7869
   / bg #DDD8C8): this is the `--chq-disabled`/`--chq-disabled-bg` token
   pair — an inactive component, exempt under WCAG 2.1 SC 1.4.3. The
   contrast probe now classifies disabled-token-pair offenders as
   `EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component)`, printed on
   every row that has one, never silently passed and never counted as a
   FAIL.

Live `gate:render-sweep` at this lane's tip (`6aa4a438`): interaction-state
2/4 -> 3/3 (all three rows genuinely PASS on their correct viewport/
persona); contrast 57/60 -> 58/60 (review-anonymize row now PASS +
EXEMPT-BY-RULE note). `.chq-participation-menu-caret`
(/admin/speakers, ratio 1.02) remains open — OWNED-BY-task-w29-d, no
`.css`/`.css.ts` file touched by this lane. Gate still exits non-zero
(CONTRAST_BLOCKING=true, driven entirely by that owned-elsewhere row) —
not a regression from this lane.

INVALIDATED BY: app/src/**/*.css, src/**/*.css.ts, src/views/theme.ts, scripts/render-sweep*
