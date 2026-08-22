# Pack size-unit grammar (DEC-937 wave-29, task w29-g)

Measured on main at `b2157a6e2` (branch point). MEASURE AND RECORD ONLY —
this lane moves no product byte. See `test/pack-unit-grammar.scan.test.ts`
for the instrument and `src/decisions-data/DEC-937.md`'s wave-29 amendment
for the ruling this doc implements.

## Ruling, restated

A size declaration is conformant when its COMPUTED px value at the 16px
root is a value the pack draws for that property. `rem` is not banned —
`1rem` computes to 16px, which IS in the pack's `font-size` vocabulary.
`0.85rem` (13.6px) is off-grid and IS the offender: the offender is the
off-grid SIZE, never the unit. An `em` literal is UNRESOLVED with the
reason `em-inherits-unresolvable` — it cannot be graded on/off grid because
its computed value depends on an inherited size this static scan cannot
resolve; it is never silently ok and never counted as an offender.

## Population

- Every `*.css` file under `app/src/**`, plus every SSR CSS module under
  `src/**` (via `test/helpers/ssr-css-sources`'s `ssrCssSources()` —
  `.css.ts` files AND plain `.ts` modules like `src/views/theme.ts`).
- Every `font-size:` and `gap:` declaration in that corpus, comments
  stripped with the shared `test/helpers/strip-css-comments.ts`,
  `@font-face { ... }` bodies stripped (asset declarations, not screen
  typography).
- `font-size`: 1017 px declarations, 14 rem, 3 em, 26 other
  (`var(...)`/keyword/`inherit`).
- `gap`: 870 px declarations, 1 rem, 3 em, 34 other
  (`var(...)`/multi-value shorthand/`0`).
- Combined OTHER total (asserted, never graded, never silently dropped):
  60.

## Pack vocabulary (derived from the 13 `docs/design/*.dc.html` frames)

- `font-size` px vocabulary: 27 distinct values (10–44px).
- `gap` px vocabulary: 27 distinct values (2–44px, plus 60px).
- No `rem`/`em` anywhere in the pack for either property — the whole pack
  grammar is bare px.

## Offenders — off-grid computed size (13, `PACK_UNIT_GRAMMAR_OFFENDERS_CEILING`)

`font-size` (7):

| coordinate | literal | computed px | pack's nearest drawn value |
| --- | --- | --- | --- |
| `src/routes/public/css/agenda.css.ts` `0.85rem` | `0.85rem` | 13.6px | 14px (or 13px) |
| `src/routes/public/css/agenda.css.ts` `0.8rem` | `0.8rem` | 12.8px | 13px |
| `src/routes/public/css/cards.css.ts` `0.8rem` | `0.8rem` | 12.8px | 13px |
| `src/routes/public/css/cards.css.ts` `1.3rem` | `1.3rem` | 20.8px | 20px (or 21px) |
| `src/routes/public/programme.css.ts` `0.85rem` | `0.85rem` | 13.6px | 14px (or 13px) |
| `src/routes/public/programme.css.ts` `1.1rem` | `1.1rem` | 17.6px | 18px (or 17px) |
| `src/routes/public/programme.css.ts` `0.9rem` | `0.9rem` | 14.4px | 14px |

`gap` (6):

| coordinate | literal | computed px | pack's nearest drawn value |
| --- | --- | --- | --- |
| `app/src/pages/comms/comms.css` `29px` | `29px` | 29px | 28px (or 30px) |
| `app/src/pages/speakers/speakers.css` `29px` (×3 sites) | `29px` | 29px | 28px (or 30px) |
| `app/src/pages/speakers/task-view.css` `29px` | `29px` | 29px | 28px (or 30px) |
| `app/src/pages/submissions/detail.css` `92px` | `92px` | 92px | 60px (pack's largest gap) |

Not an offender, named for traceability: `src/views/theme.ts`'s 7×
`font-size: 1rem` (computes to 16px, on-grid — the ruling's own worked
example) and `src/views/theme.ts`'s `gap: 0.75rem` inside a multi-value
`0.75rem 15px` shorthand (12px, on-grid, but counted in OTHER because it's
a multi-value declaration, per discriminator (3) — not reclassified as a
single-value offender or non-offender).

## Unresolved — `em` (6, `PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING`)

`font-size` (3):

| coordinate | literal |
| --- | --- |
| `app/src/pages/contacts/contacts-panels.css` `0.85em` |
| `src/routes/docs-site.css.ts` `0.9em` |
| `src/routes/tools.css.ts` `0.92em` |

`gap` (3):

| coordinate | literal |
| --- | --- |
| `app/src/pages/contacts/contacts-panels.css` `0.4em` |
| `app/src/pages/contacts/contacts-panels.css` `0.5em` |
| `src/routes/public/css/cards.css.ts` `0.35em` |

Reason for every row: `em-inherits-unresolvable` — the computed px depends
on an inherited font-size no static scan can resolve without evaluating
the live cascade. This is never a claim that the site is fine, and never a
claim that it is an offender.

## Settled exclusions check (DEC-967: check before seeding)

Grepped every offender's subject (`agenda.css.ts`, `cards.css.ts`,
`programme.css.ts`, `comms.css`, `speakers.css`, `task-view.css`,
`detail.css`) and every literal value (`0.85rem`, `0.8rem`, `1.3rem`,
`1.1rem`, `0.9rem`, `29px`, `92px`) across `src/decisions-data/` and
`decisions/`. One near-miss, resolved as NOT applicable: `decisions/DEC-990.md`
rules `.chq-prog-title`'s old `1.6rem` down to a flat `36px`/`26px`
register — that site is already drained (`programme.css.ts`'s own
`task-w49-h (DEC-990 amendment)` comment cites it and the class now
declares `font-size: 36px`), and `1.6rem` is not among this ratchet's
offenders. No standing ruling names any of the 13 offender or 6 unresolved
sites above; none is excluded.

## Letter-spacing (measured, deliberately not graded this wave)

`letter-spacing` was in scope to add "if it fits the budget" (task
w29-g). Measured: 238 declarations across the product corpus, 100% `em`
(no `px`/`rem` anywhere), against a pack `letter-spacing` vocabulary that
draws 0 px values (the pack's own letter-spacing grammar is `em`-only, not
the bare-px grammar this ratchet's classifier is built for). Grading it
properly needs a second px/rem/em join keyed on the pack's OWN em
vocabulary rather than this ratchet's px-grid classifier, and a
238-row population is out of this wave's budget. Left ungraded and
unregistered; a later lane should treat this as a NEW ratchet with its own
vocabulary-derivation shape, not an extension of this one.

## Ratchet disposition

Both ceilings (`PACK_UNIT_GRAMMAR_OFFENDERS_CEILING = 13`,
`PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING = 6`) are two-sided (measured by
forcing to `-1` and reading the printed roster back — matches this doc's
tables exactly) and registered in `scripts/exit-predicate.ts`'s
`OUT_OF_CAMPAIGN_SCOPE`, not the campaign's gating lists: this is a freshly
measured, previously-uncounted population (the same disposition already
given to `DESKTOP_FLOOR_DIVERGENCE_CEILING` and
`FRAME_EYEBROW_DIVERGENCE_CEILING`), promoted to a gating ceiling once a
later, separately-ruled lane drains the offenders.
