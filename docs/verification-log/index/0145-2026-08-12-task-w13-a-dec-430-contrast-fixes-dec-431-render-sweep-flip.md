## 2026-08-12 task-w13-a — DEC-430 contrast fixes + DEC-431 render-sweep flip

Full transcripts in
`docs/verification-log/task-w13-a-render-sweep-stage1.md` (DEC-423
suffix — the unsuffixed `task-w13-a-*` names belong to an earlier
campaign).

DEC-430: `.chq-forms-field-drag`'s glyph colour moved from
`var(--chq-border)` (1.80:1) to `var(--chq-muted)`
(`app/src/pages/forms/forms.css`). `TrackChips`
(`src/routes/public/cards.tsx`) stopped rendering the organizer-supplied
track colour as a text background — it now emits only
`--chq-track-color:<hex>` (strict `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`
guard, DEC-374 pattern; non-matching values emit no style attribute at
all), and `.chq-pub-track-chip` (`src/routes/public/public.css.ts`) is
ink-on-surface with a bordered `::before` swatch dot fed by that custom
property. New `test/public-track-chip.test.ts`. `npm run build` and
`npm test --silent` green (269 files, 2241 tests).

DEC-431 flip: `npm run gate:render-sweep` re-run (own tree, `.wrangler/state`
reset between runs — one run was instrument-blocked by concurrent worker
agents' `wrangler dev` processes contending on the same machine, discarded;
the clean re-run is what's transcribed). Admin-mobile 20/20 and type-floor
83/83 both read all-PASS →`ADMIN_MOBILE_PASS_BLOCKING` and
`FONT_FLOOR_BLOCKING` flipped `true` in `scripts/render-sweep-lib.ts`
(with `test/render-sweep-lib.test.ts` updated to match). Contrast pass:
both DEC-430-named offenders are gone (6 previously-failing track-chip
routes now 6.28-6.82; the drag-glyph route no longer fails on the glyph),
but fixing the glyph unmasked a third, previously-unreported
`--chq-disabled`-on-paper offender (3.06:1) on the same
`/admin/submissions/forms` route that DEC-430 didn't name — 41/42, not
all-PASS. `CONTRAST_BLOCKING` stays `false`, flagged for the next
contrast-remediation wave.

RESULT: PASS (with a scope note) — both named contrast offenders fixed;
two DEC-387 flip-rule passes fired; contrast pass stays advisory pending a
newly-surfaced third offender outside this task's named scope.

