# Twin-root native-control 44px floor parity audit (DEC-180 wave-53 amendment)

Owner of the rule: `test/phone-floor-root-parity.scan.test.ts` (task w53-f).

## Why this instrument exists

`src/views/theme.ts:309` asserts, in prose, of its checkbox/radio
`appearance:none` takeover:

> Twin of the same takeover in `app/src/styles.css`'s "Native control
> styling" section -- the two stylesheet roots DEC-409 names must agree.

Nothing checked that sentence before this task. Every pre-existing tap-floor
ratchet in the campaign (`SSR_TAP_FLOOR_OFFENDERS_CEILING`,
`SPA_CLASSLESS_CONTROL_CEILING`, `SSR_CLASSLESS_CONTROL_CEILING`, etc.)
grades exactly ONE stylesheet root's own selectors against the 44px floor.
None of them compares the two roots to each other, so a control family
floored on one root and silently absent on the other has always been
invisible to the campaign's own instruments -- exactly the shape that let
the checkbox/radio gap this task measures survive.

## Method

Two roots: `app/src/styles.css` (the admin SPA), and `src/views/theme.ts`'s
`THEME_CSS` export reached through `ssrCssSources()` (never a
`src/**/*.css.ts` glob -- see the scan file's own header for why that glob
specifically misses this file).

For each root, a rule is "floored" for a control family when it declares
`min-height`/`height` >=44px either inside the sheet's one terminal
`@media (max-width: 700px)` block, or unconditionally at the top level
(DEC-385 single-direction: an unconditional floor holds at every width,
including phone, and nothing narrower removes it -- this is what makes
`app/src/styles.css`'s `.chq-file`/`.chq-file::file-selector-button`
(floored unconditionally, styles.css:2065-2081) agree with
`src/views/theme.ts`'s phone-scoped `input[type=file]` floor rather than
read as a false offender).

Selectors are bucketed into a small, source-derived "control family"
vocabulary (checkbox, radio, text-input, date-input, file-input,
file-selector-button, select, textarea, button, nav-link) -- the same
vocabulary both roots' own prose names as taken-over native controls
(`app/src/styles.css:1917`'s "Native control styling (DEC-577) -- file /
date / select / check" section header; `src/views/theme.ts`'s own
DEC-367/DEC-585 base rules). A family is only compared across roots when it
is present (as a selector, floored or not) on BOTH roots -- see EXISTENCE
GUARD below.

## Measured result (this branch)

**1 offender**, `PHONE_FLOOR_ROOT_PARITY_CEILING = 1`:

| family | floored in `app/src/styles.css` | floored in `src/views/theme.ts` |
| --- | --- | --- |
| `checkbox` | **yes** -- `.chq-check-hit { min-height: 44px; min-width: 44px; ... }` inside the terminal phone block (`app/src/styles.css:2859-2864`) | **no** -- `input[type=checkbox], input[type=radio]` (`src/views/theme.ts:313-326`) is an explicit `width:18px; height:18px` box with no phone-floor rule anywhere in the sheet; the sheet's own comment at `:298-301` states the floor is "met by padding on the surrounding label, not by inflating the box itself (that lives in the page/surface markup, not this shared sheet)" |

This is the live checkbox/radio hole the field guide's wave-53 entry names
(the unauthenticated CFP renders `input[type=checkbox]` through
`src/views/theme.ts` and `src/views/form-render.tsx`, and gets none of the
label-wrapper floor rule the SPA table-cell checkbox gets from
`.chq-check-hit`). **Repair is out of this task's scope** (this lane may
not edit `src/views/theme.ts`, `app/src/styles.css` or
`src/views/form-render.tsx`) and belongs to whichever concurrent branch owns
the SSR checkbox/radio phone-floor fix. Once that lane lands and this scan
re-measures 0, `PHONE_FLOOR_ROOT_PARITY_CEILING` drops to 0 in the same
commit and the constant is promoted out of `OUT_OF_CAMPAIGN_SCOPE` into
`TIER2_CEILING_NAMES` (the disposition
`scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts`'s entry
for this constant names).

## EXISTENCE GUARD exclusions (not offenders -- naming-convention only)

The scan's population is every family present as a selector (floored or
not) on BOTH roots. One family this scan's classifier recognises is present
on only one root and is therefore excluded from comparison, not counted as
an offender:

- **`date-input`**: `src/views/theme.ts` declares a distinct
  `input[type=date] { ... }` rule (base and phone-floored). No standalone
  `input[type=date]` (or `input[type='date']`) selector exists anywhere in
  `app/src/styles.css` -- its own comment at `:2100` states dates reuse
  "the same border/radius/height/typography as `.chq-input` (already
  applied via that shared class)". Date inputs on the SPA side are floored
  through the `text-input` family (`.chq-input`, which IS floored on both
  roots and is not an offender), never through a `date-input`-classified
  selector. This is a naming-convention difference, not a geometry gap, and
  is excluded per the scan's own EXISTENCE GUARD rather than asserted away.

## Known instrument limitation (documented, not silently assumed)

`.chq-check-hit`'s selector text does not distinguish checkbox from radio
inputs (the wrapper is applied at the markup layer to either, per its own
`app/src/styles.css:2846-2858` comment: "wraps a table-cell `.chq-check`").
This scan's classifier keys purely on selector TEXT, so `radio` and
`checkbox` are graded as separate families and the `radio` family reads
"not floored on either root" (consistent, not reported) rather than
"floored on the SPA root via markup-level `.chq-check-hit` reuse, unfloored
on SSR" -- a real coverage gap this instrument cannot see because CSS
selector text alone cannot express "the class this rule floors is also
applied, at runtime, to a `type=radio` element." The `checkbox` offender
above already gives `PHONE_FLOOR_ROOT_PARITY_CEILING` a non-zero, live
seed, so this limitation does not make the scan vacuous; it is recorded
here as a known blind spot for whichever lane repairs the checkbox family
to re-check by hand whether the radio family needs the same fix.
