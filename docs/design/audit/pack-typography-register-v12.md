# Pack typography-register audit (DEC-937 wave-43)

Full roster for `test/pack-typography-register.scan.test.ts`, measured by
forcing each ceiling to `-1` and reading the printed roster back
(DEC-808 two-sided seeding protocol). Coordinates are bare-path +
backtick-quote, never `path:line` (DEC-967 wave-115 drift-proof shape).

## Pack vocabulary (derived from the 13 `docs/design/*.dc.html` files)

- `letter-spacing`: 1124 declarations, 19 distinct `em` values:
  `0.1em` ×476, `0.06em` ×152, `0.12em` ×130, `-0.04em` ×119,
  `-0.03em` ×71, `0.09em` ×44, `-0.035em` ×38, `-0.015em` ×38,
  `-0.02em` ×33, `0.08em` ×31, `0.04em` ×31, `-0.01em` ×9,
  `-0.042em` ×8, `-0.025em` ×7, `0.14em` ×6, `-0.022em` ×4,
  `0.11em` ×2, `0.02em` ×2, `-0.028em` ×1.
- `text-transform`: 709 declarations, exactly one value: `uppercase`.

## Product population

- `letter-spacing`: 272 declarations across `app/src/**/*.css` and every
  SSR `*.css.ts`/`theme.ts` CSS module, 30 distinct values (literal em
  values plus the 7 `var(--chq-type-*-tracking)` sites).
- `text-transform`: 172 declarations across the same corpus.

## Letter-spacing offenders — `PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING = 0`

Two real offenders measured, both repaired to the pack's nearest drawn
value in this wave's commit — the ceiling is seeded at the DRAINED count,
0, not the measured-before-repair count, 2:

| Site | Was | Pack draws (nearest) | Repaired to |
| --- | --- | --- | --- |
| `app/src/pages/agenda/agenda.css`\`.chq-day-grid-cell-hover-label\` | `0.03em` | `0.02em`, `0.04em`, `-0.03em` (never `+0.03em`) | `0.04em` |
| `src/routes/docs-site.css.ts`\`.chq-docs-search-submit\` | `0.01em` | `-0.01em`, `0.02em` (never `+0.01em`) | `0.02em` |

Neither site is pinned by a frame-verdict test or a `*-tier2-*` test (both
grepped clean before repair); neither site sits inside a phone
`@media (max-width: …)` block, so DESKTOP IS FROZEN did not block either
repair — both rules are pack-authority typography with no competing
DEC-937 gap-arithmetic ruling (unlike the `gap` sites
`pack-unit-grammar-v12.md` records as LEFT).

## Letter-spacing unresolved — `PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING = 0`

The seven `var(--chq-type-*-tracking)` sites all resolve to in-vocabulary
literals via `app/src/styles.css` / `src/views/theme.ts`:

| Token | Resolves to | In pack vocabulary |
| --- | --- | --- |
| `--chq-type-page-title-tracking` | `-0.04em` | yes |
| `--chq-type-overview-headline-tracking` | `-0.042em` | yes |
| `--chq-type-section-label-tracking` | `0.12em` | yes |
| `--chq-type-deadline-label-tracking` | `0.12em` | yes |
| `--chq-type-row-title-tracking` | `-0.015em` | yes |
| `--chq-type-micro-tracking` | `0.11em` | yes |

Zero unresolved rows: none of the corpus's `var(--chq-...)` letter-spacing
sites names a token missing from both token files.

## Text-transform offenders — `PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING = 1`

| Site | Value | Disposition |
| --- | --- | --- |
| `src/views/theme.ts`\`.chq-wordmark\` | `lowercase` | **LEFT** — settled DEC-884 exclusion |

DEC-884 rules the portal header prints the event's own name verbatim and
that `"chautauqua"` is deliberately the *only* lowercase wordmark, reserved
for the literal product wordmark on operator surfaces (dev mailbox, docs,
tools) — the DEC-937 wave-13m/DEC-884 lineage comment beside the rule
states this in prose. At least eleven test files pin `.chq-wordmark`
byte-for-byte: `App.header390.render.test.tsx`,
`Comms.frame390.render.test.tsx`, `Settings.hub390.render.test.tsx`,
`agenda-phone-wordmark-390.test.ts`,
`admin-390-offender-roster.scan.test.ts`,
`phone-leak-guard-restore.scan.test.ts`, `tools-surfaces.test.ts`,
`public-390-offender-roster.scan.test.ts`, `portal-eventmark.test.ts`,
`portal-dashboard-session-390-frame-verdicts.test.ts`,
`wordmark-optical-nudge.scan.test.ts`. This site is adjudicated LEFT, not
repaired — the pack draws no `lowercase` register at all, and DEC-884
already settled that this one site is intentionally outside it.

## Text-transform unresolved — `PACK_TYPOGRAPHY_TEXT_TRANSFORM_UNRESOLVED_CEILING = 0`

No `var(--chq-...)` site feeds `text-transform` in the product corpus;
zero unresolved rows.

## Ratchet disposition (wave 43)

All four ceilings are two-sided (measured by forcing each to `-1` and
reading the printed roster back — matches this doc's tables exactly) and
registered in `scripts/exit-predicate/campaign-scope.ts`'s
`OUT_OF_CAMPAIGN_SCOPE`, not the campaign's gating lists: this is a
freshly measured, previously-uncounted population (the same disposition
`PACK_UNIT_GRAMMAR_OFFENDERS_CEILING` already carries) that must not move
the campaign's convergence goalposts mid-stream. `PACK_UNIT_GRAMMAR_
OFFENDERS_CEILING`/`PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING`
(`test/pack-unit-grammar.scan.test.ts`) are unchanged and untouched by
this lane — this is a new, standalone instrument, not an extension.
