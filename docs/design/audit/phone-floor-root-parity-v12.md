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
(floored unconditionally, app/src/styles.css`.chq-file {`) agree with
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

## Measured result (wave 56, this branch)

**0 offenders**, `PHONE_FLOOR_ROOT_PARITY_CEILING = 0` (CLOSED wave 56):

| family | floored in `app/src/styles.css` | floored in `src/views/theme.ts` |
| --- | --- | --- |
| `checkbox` | **yes** -- `.chq-check-hit { min-height: 44px; min-width: 44px; ... }` inside the terminal phone block (app/src/styles.css`.chq-check-hit {`) | **yes** -- a twin `.chq-check-hit { min-height: 44px; min-width: 44px; ... }` rule inside `src/views/theme.ts`'s own terminal phone block (src/views/theme.ts`min-width: 44px;`), wrapping the bare `input[type=checkbox]`/`input[type=radio]` (18x18, unchanged) `form-render.tsx` renders via `<span class="chq-check-hit">` |

**History (wave 53 through wave 55):** this ceiling was seeded at 1 --
`checkbox` floored on `app/src/styles.css` (via `.chq-check-hit`'s terminal
phone block) and unfloored on `src/views/theme.ts` (the bare
`input[type=checkbox], input[type=radio]` rule carried no phone floor, and
`src/views/form-render.tsx` rendered the input with no reaching wrapper).
The DEC-393 wave-53 amendment SSR repair -- landed by a concurrent branch,
not this lane -- added `src/views/theme.ts`'s own `.chq-check-hit` (base
rule layout-neutral at top level, floored inside the terminal
`@media (max-width: 700px)` block: `min-height: 44px; min-width: 44px;
padding: 13px; margin: -13px;`) and changed `src/views/form-render.tsx`'s
`FieldControl` "checkbox" case to wrap the bare input in
`<span class="chq-check-hit">`. The two roots now agree, and this lane
(**instrument only, no repair**: it does not edit `src/views/theme.ts`,
`app/src/styles.css` or `src/views/form-render.tsx`) pays the promotion the
wave-53 disposition promised -- `PHONE_FLOOR_ROOT_PARITY_CEILING` drops to
0 and the constant moves out of `OUT_OF_CAMPAIGN_SCOPE` into
`CAMPAIGN_CONSTANT_NAMES` + `TIER2_CEILING_NAMES` in the same commit (the
disposition `scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts`
carried named).

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

## Known instrument limitation (unchanged, documented not silently assumed)

`.chq-check-hit`'s selector text does not distinguish checkbox from radio
inputs (the wrapper is applied at the markup layer to either, per its own
app/src/styles.css`wraps a table-cell` comment). This scan's classifier
keys purely on selector TEXT, so `radio` and `checkbox` are graded as
separate families and the `radio` family reads "not floored on either
root" (consistent, not reported) rather than "floored on the SPA root via
markup-level `.chq-check-hit` reuse, unfloored on SSR" -- a real coverage
gap this instrument cannot see because CSS selector text alone cannot
express "the class this rule floors is also applied, at runtime, to a
`type=radio` element." This limitation still holds after the wave-56
promotion (it is a property of the classifier, not of the checkbox
population that closed) -- it is recorded here as a known blind spot, and
discharged by hand below, as the wave-53 note asked.

## Radio family hand-check (DEC-180 wave-56, discharging the blind spot above)

The classifier above cannot see radio through `.chq-check-hit`'s selector
text, so this checks, by hand, every radio input site in both roots'
rendered surfaces against the 44px floor requirement, the same way DEC-393
wave-26's `labelHasRealContent` disposition already excludes a
non-decorative, real-text label from the classless-roster ratchets.

**SSR (`src/routes/public/submit-views.tsx`, floored by
`src/routes/public/cfp.css.ts` / `src/routes/portal/portal.css.ts`'s shared
`.chq-cfp-option` vocabulary, DEC-696 parity):** all three SSR
`<input type="radio">` sites (`TrackChoices`, `FormatChoices`,
`AudienceChoices`) render as the sole child of `label.chq-cfp-option`
(src/routes/public/submit-views.tsx`<label class="chq-cfp-option">`).
`.chq-cfp-option` is floored to `min-height: 46px` unconditionally, at
every width, not gated by any media query
(src/routes/public/cfp.css.ts`min-height: 46px;`, twinned in
src/routes/portal/portal.css.ts`min-height: 46px;`), and each root's own
comment states no radio of this shape renders outside the wrapper. **Not a
defect** -- the floor is the label's, by construction, the same
composition-receipt idiom `.chq-check-hit` uses.

**SPA (`app/src/pages/speakers/TaskModal.tsx`, `app/src/pages/contacts/
MergePage.tsx`, `app/src/pages/contacts/ImportWizard.tsx`, `app/src/pages/
review/Scorecard.tsx`):** every SPA `<input type="radio">` site renders
inside a `<label>` carrying real, non-whitespace visible text beside the
input, not a decorative wrapper with an empty accessible name:
`TaskModal.tsx` -- `` `Everyone accepted (${acceptedCount})` `` /
`Only the people I choose`; `MergePage.tsx` -- `{c.firstName} {c.lastName}
— {c.email}`; `ImportWizard.tsx` -- `{opt.label}` (phone-target rows) and
`Import as new` / `` Merge into {dup.name} ({dup.email}) `` (dedupe-group
rows); `Scorecard.tsx` -- `{opt}`. DEC-393 wave-26's `labelHasRealContent`
disposition already excludes exactly this shape (a real-content label,
not a classless bare control) from the classless-roster ratchets that
would otherwise flag a bare `<input>`. **Not a defect** -- each site is
excluded under the same disposition the checkbox/text-input families
already rely on.

**Verdict: no genuinely unfloored bare radio found on either root.** The
radio family needs no repair; `PHONE_FLOOR_ROOT_PARITY_CEILING` stays at 0
for this family for the same reason the classifier never counted it as an
offender in the first place -- confirmed by hand, not merely assumed.
