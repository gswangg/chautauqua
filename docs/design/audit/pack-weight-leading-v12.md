# pack font-weight / line-height vocabulary audit (DEC-991 wave-29 amendment, task w29-f)

`test/pack-declaration-vocabulary.scan.test.ts` (DEC-937, wave-20) graded
exactly two CSS properties -- `font-style` and `border-radius` -- against a
vocabulary derived from `docs/design/*.dc.html` at test time. This wave
widens the same ratchet to `font-weight` and `line-height`, following the
scan's own population walk, comment-stripping rule, and discriminator-vs-
exclusion doctrine (DEC-180).

## Population, as measured on this branch

- **font-weight**: pack vocabulary `{400, 500, 600, 700, 800}` (2,556 bare
  `<digits>` declarations across the 13 `.dc.html` files, 0 out-of-grammar).
  Product: 576 bare `<digits>` declarations, 15 out-of-grammar
  (`font-weight: var(--chq-type-*-weight)` design-token references, 2 bare
  `inherit`). **0 offenders** after the disposition below.
- **line-height**: pack vocabulary `{1, 1.04, 1.05, 1.06, 1.07, 1.08, 1.1,
  1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7}` (658
  bare declarations, 0 out-of-grammar). Product: 173 bare declarations, 2
  out-of-grammar (1 `var(--chq-type-overview-headline-line-height)`, 1
  `inherit`). **0 offenders** after the disposition below (1 settled value
  excluded, see table).

`PACK_VOCABULARY_OFFENDERS_CEILING` stays at `0` (re-measured, forced to
`-1` first and the printed list read back empty for both new properties).

## Offender-candidate dispositions

Every candidate offender's subject was grepped across `src/decisions-data/`
and `decisions/` before being treated as a number, per the wave-28 lesson
("a new measurement is not a ceiling until every row has been checked
against the standing rulings").

### `font-weight: 900` -- `app/src/pages/contacts/contacts-panels.css`, `` `.chq-contacts-pipeline-card-age-stale` ``

- **Declared (before this wave):** `font-weight: 900`.
- **Pack's nearest drawn value:** `docs/design/Chautauqua Contacts.dc.html`
  draws this exact chip via its own `AGE_STALE` constant --
  `` `const AGE_STALE = 'font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#1B1D17';` `` --
  i.e. **800**, inside the pack's vocabulary.
- **Grep result:** no `src/decisions-data/` or `decisions/` row settles a
  900 vs. 800 dispute for this chip. `DEC-898`'s amendment (referenced in
  the site's own preceding comment) rules that staleness is signalled by
  WEIGHT and WORDING only, but never pins the specific numeral.
  Disposition is therefore a product change, not a recorded offender.
- **Disposition: PRODUCT CHANGE.** `font-weight` changed from `900` to
  `800` in the same commit as this ratchet widening. This is legal to
  change (desktop-affecting; the rule is a top-level rule, not inside a
  phone block) **only because the pack's own vocabulary is the frame's own
  demand for this exact element** -- not a general licence to retune
  desktop weights. The site's preceding comment (which restates "900" as
  the STALE signal) was updated to "800" in the same edit so it does not
  become a stale citation of its own.

### `line-height: 1.63` -- `app/src/pages/not-found.css`, `src/routes/auth.css.ts`

- **Declared:** `line-height: 1.63` (both sites).
- **Pack's nearest drawn value:** the pack's coarse `.05`-step grid has no
  `1.63` member (nearest neighbours `1.6`/`1.65`).
- **Grep result:** `decisions/DEC-945.md` -- "One 404 card, three
  renderers" -- rules **all three not-found renderers draw the SAME card at
  the same numbers**, quoting verbatim: `` `28px title, 15px/1.63 body,
  links in one flex row` ``. This is a BLESSED, deliberately-shared value
  across all three not-found renderers (`src/server/not-found.tsx` via
  `AUTH_CSS`, `src/routes/public/not-found.tsx` via `AUTH_CSS`,
  `app/src/pages/NotFound.tsx` via its co-located `not-found.css`), not an
  ad hoc off-grid choice.
- **Disposition: SETTLED EXCLUSION.** Recorded in the scan's
  `SETTLED_EXCLUSIONS` table, scoped to exactly these two sites
  (`app/src/pages/not-found.css`, `src/routes/auth.css.ts`) so a
  coincidentally-identical `1.63` appearing at any OTHER site is still a
  live offender candidate, not silently swept in under this ruling's name.
  The scan's resolution guard re-reads `decisions/DEC-945.md` at test time
  and throws loudly if this quote stops resolving verbatim.

## Discriminators applied (population-preserving, DEC-180)

1. `@font-face { ... font-weight: 400 700; ... }` / `400 800` ranges
   (`app/src/styles.css`, `src/views/theme.ts`) are ASSET declarations (a
   variable font's own covered-weight range), not screen typography --
   stripped by the same `stripFontFace` used for `font-style`.
2. A `font-weight`/`line-height` value that is not a bare numeric token
   (`var(...)`, `inherit`) sits outside the grammar entirely; counted into
   an asserted out-of-grammar total, never silently dropped.
3. **Custom-property/shorthand hazard:** a raw `${property}:` substring
   search also fires inside a CSS custom property whose OWN NAME happens to
   end with the graded property's name --
   `--chq-type-overview-headline-line-height: 1.2;`
   (`app/src/pages/overview/overview.css`) ends in the literal substring
   `line-height:`. Closed with a `(?<![\w-])` lookbehind requiring a
   non-word/non-hyphen character immediately before the property name,
   applied uniformly to all four graded properties (verified to change
   nothing for `font-style`/`border-radius`, since no custom property in
   this tree ends in either of those literals).

## Files touched

- `test/pack-declaration-vocabulary.scan.test.ts` -- widened to grade
  `font-weight` and `line-height`, plus the lookbehind guard, the
  `SETTLED_EXCLUSIONS` table with resolution guard, and extended
  synthetic-fixture non-vacuity coverage for both new properties and the
  custom-property collision.
- `app/src/pages/contacts/contacts-panels.css` -- `.chq-contacts-pipeline-
  card-age-stale`'s `font-weight` corrected from `900` to `800` to match
  the frame's own drawn value for this chip.
- `src/decisions-data/DEC-991.md` -- wave-29 amendment recording this
  ruling (see file).
