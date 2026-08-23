# Pack colour vocabulary (DEC-383 wave-43, task w43-d)

Measured on main at `114f17a15` (branch point). See
`test/pack-colour-vocabulary.scan.test.ts` for the instrument and
`src/decisions-data/DEC-383.md`'s wave-43 amendment for the ruling this doc
implements.

## Why the population is complete

`test/palette-conformance.test.ts` proves palette CLOSURE: every page and
surface stylesheet composes `var(--chq-*)` only, with colour literals
confined to exactly two token files (`app/src/styles.css`,
`src/views/theme.ts`) plus the single DEC-376 merge-screen allowlist hex
(`#a8a392` in `app/src/pages/contacts/contacts-panels.css`). That closure
argument makes the two token files the COMPLETE population for colour
fidelity. Nothing before this wave compared their VALUES to what the pack
actually draws — `color` (2144 pack-adjacent declarations) and `background`
(966) are the two largest pack properties with no vocabulary instrument at
all.

## Population

- **Token files**, derived (never hand-listed): every file inside the
  colour-legal scope (`app/src/**/*.css`, `src/views/theme.ts`,
  `src/routes/**/*.css.ts` — `palette-conformance.test.ts`'s own widest
  scope) that declares at least one hex literal. That derivation resolves
  to exactly three files: `app/src/styles.css`, `src/views/theme.ts`, and
  `app/src/pages/contacts/contacts-panels.css`. The third is excluded from
  TOKEN_FILES by PRINCIPLE — its entire hex population is the single
  DEC-376 allowlisted value — never by naming its path, so a future file
  that gains a real literal is still caught.
- **Pack**: all 13 `docs/design/*.dc.html` files, comment-stripped
  (shared `test/helpers/strip-css-comments.ts`, plus a `//`-line-comment
  pass for the `.ts`/`.css.ts` product sources so a stray quote inside a
  JS prose comment can never desynchronise the string-aware stripper).

## Measured counts (this branch, reproduce via the scan's own assertions)

- Pack: 13 `.dc.html` sources; distinct hex vocabulary and distinct
  colour-function (rgb/rgba family, by channel triple) vocabulary both
  non-empty (asserted, not hand-recorded, so a later pack edit is caught
  automatically rather than silently trusted against a stale number here).
- Token files (`app/src/styles.css` + `src/views/theme.ts`, the
  allowlist file excluded): 23 distinct hex values declared (56 total
  declarations across both files), of which 21 distinct values are in the
  pack's drawn vocabulary and 2 are not.
- Token-file colour functions: exactly 1, `rgba(27, 29, 23, 0.5)`
  (`app/src/styles.css`), whose channel triple `27,29,23` matches the
  pack's own drawn `rgba(27,29,23,0.13)` family — 0 function offenders.

## The two hex offenders, adjudicated

Both are LEFT, not repaired. Neither is an unowned count.

### `--chq-disabled: #7d7869`

Declared in both token files: app/src/styles.css`--chq-disabled: #7d7869;`
and, separately, src/views/theme.ts`--chq-disabled: #7D7869;`.

DEC-436's wave-25 amendment (`decisions/DEC-436.md`) darkened this token
FROM the pack's nearest drawn neighbour, `#8e8a7a`, because `#8e8a7a`
measured 2.43:1 against `--chq-disabled-bg` (`#ddd8c8`) and WCAG's 3:1
legibility floor demanded darker — "2.43:1 is genuinely unreadable and our
buyer is a non-technical event producer who must be able to read WHAT is
frozen." `#8e8a7a` is still in the tree today as a live token,
`--chq-border-hover` (`app/src/palette.scan.test.ts:117` names it as the
B8 input-hover-border value, explicitly reusing the value the disabled
token was darkened away from). "Repairing" `--chq-disabled` back to
`#8e8a7a` would silently reintroduce the exact contrast defect DEC-436
fixed, and collide two distinct tokens onto one value. The pack's other
drawn neighbour, `#6b665b`, has no v12 frame demanding it and DESKTOP IS
FROZEN — this token is drawn at both densities.

**Disposition: stated-principle deviation.** The disabled register is a
WCAG-driven departure the pack's own drawings never had to solve for — the
mocks carry no contrast obligation the way the shipped product does.

### `--chq-on-ink-muted: #b5afa2`

Declared in both token files: app/src/styles.css`--chq-on-ink-muted: #b5afa2;`
and, separately, src/views/theme.ts`--chq-on-ink-muted: #B5AFA2;`.

DEC-367's original handoff (`decisions/DEC-367.md`) pins this exact value
as the on-ink muted floor, verified at 7:1
(`docs/design/README.md:51` — "On dark surfaces (`#1B1D17`): text
`#F4F1E8`, muted `#B5AFA2` (7:1)"; `:530` — "The muted floor is ... `#B5AFA2`
on ink — anything lighter failed and was raised during review").
`test/design-system.test.ts:120` pins the byte as a cross-file parity fact
(`--chq-on-ink-muted` must read `#b5afa2` in both `app/src/styles.css` and
`THEME_CSS`). The pack's nearest drawn neighbours, `#b6b3a6` and `#bab6a6`,
are both LIGHTER on-ink than the pinned floor — moving to either risks
reproducing the exact contrast regression the original review raised
against, with no v12 frame demanding the move.

**Disposition: stated-principle deviation.** Same shape as
`--chq-disabled` above: a WCAG floor the pack's drawings were never graded
against.

## Registration

`PACK_COLOUR_VOCABULARY_HEX_OFFENDERS_CEILING = 4` (4 declarations: 2
distinct offending values x 2 token files) and
`PACK_COLOUR_VOCABULARY_FUNCTION_OFFENDERS_CEILING = 0`, both two-sided
(fail above AND below the measured count) and both registered in
`scripts/exit-predicate/campaign-scope.ts`'s `OUT_OF_CAMPAIGN_SCOPE` — a
freshly measured population must not move the campaign's convergence
goalposts mid-stream, the same disposition `PACK_UNIT_GRAMMAR_OFFENDERS_
CEILING` and `PACK_VOCABULARY_OFFENDERS_CEILING` already carry.
