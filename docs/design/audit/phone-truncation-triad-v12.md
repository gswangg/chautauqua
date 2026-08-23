# `text-overflow: ellipsis` three-declaration contract (DEC-808 wave-43)

Instrument: `app/src/phone-truncation-triad.scan.test.ts`. Ceiling:
`TRUNCATION_TRIAD_OFFENDERS_CEILING = 5` (two-sided).

## Ruling

`docs/design/DESIGN-RULINGS.md`'s speaker detail — due-date and schedule
columns right-align before status ink ruling states it in prose for one
surface: "`text-align: right` alone measured wrong live, and needed two
more declarations" — `min-width: 0`, `overflow: hidden`,
`text-overflow: ellipsis`. This is that ruling generalised: a rule
declaring `text-overflow: ellipsis` truncates only if a non-`normal`
`white-space` and an `overflow`/`overflow-x` of `hidden`/`clip` are BOTH
effective at the 390 frame for the same `chq-` class token — not
necessarily in the rule's own body, but anywhere a rule sharing that token
supplies it (a top-level companion rule, or a phone-scoped override that
applies at 390 per DEC-991's `appliesAt390`).

## Population

Enumerated over every `app/src/**/*.css` file plus every `src/**/*.ts(x)`
module whose source exports a `*_CSS` template-literal constant (the
`app/src/control-font.scan.test.ts` idiom, recursive `readdirSync`, never a
`.css.ts` filename glob — that glob drops `src/views/theme.ts`).

- **71** top-level/phone-scoped rules declare `text-overflow: ellipsis`
  somewhere in their own body (the RE-MEASURED-THIS-WAVE crude per-rule
  count the task description names as 74 was taken before comment-brace
  sanitisation was applied to the CSS text; sanitising two comments in
  `app/src/pages/contacts/contacts.css` that quote literal `{`/`}`-bearing
  prose changes rule-boundary parsing but not the ellipsis count materially
  — 71 is this scan's own measured total, asserted as a non-vacuity floor,
  never hand-copied from the task prose).
- Of those 71, the SAME-CLASS-TOKEN cascade join (reusing
  `app/src/phone-overflow-scan/{rules,cascade}.ts`'s `mediaSpans` /
  `extractRules` / `effectiveBodyFor`, generalised from "same selector" to
  "same class token" per this ruling's own wording) resolves 66 through an
  effective white-space + overflow-escape companion — most of the raw
  per-rule "no white-space in the same rule" misses the task prose measured
  at 39 are exactly this: a shared row/cell base rule (or this rule's own
  top-level declarations plus a phone override) supplies the missing half.
- **5 rules remain OFFENDERS** after the join. All five are adjudicated
  below; none is a bucketed "remainder" left for a future wave.
- **12** of the 71 rules depend on an ancestor supplying `min-width: 0` (no
  `min-width: 0` in the rule's own body) — recorded on every row via
  `dependsOnParentMinWidth`, never dropped from the population, so this
  count cannot silently shrink around a row this predicate cannot verify
  end-to-end (a parent's `min-width: 0` is a fact about markup nesting this
  CSS-text scan cannot see).

## Offender roster and disposition (5 of 5, all adjudicated)

| # | File | Selector | Missing (own+cascade) | Disposition |
|---|------|----------|------------------------|--------------|
| 1 | `app/src/pages/comms/comms.css` | `.chq-comms-recipient-to` | white-space AND overflow-escape | **Not a defect — wrapping is the drawn phone intent.** The top-level rule (`:894`) declares all three (`min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) — truncates correctly on desktop. Its own terminal `@media (max-width: 700px)` block (`:1565`) explicitly overrides `white-space: normal; overflow: visible; text-overflow: clip;`, reverting to wrap for the phone stacked-recipient-row layout. The scan's own predicate — "effective at 390" — correctly reports this rule's declared `text-overflow: ellipsis` never truncates at 390: it is authored not to. No repair; this is the phone rule doing exactly what it says. |
| 2 | `app/src/pages/contacts/contacts-panels.css` | `.chq-contacts-duplicate-names` | white-space | **Not a defect — wrapping is the drawn phone intent.** Same shape: top-level (`:517`) declares `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` (desktop truncates). Its terminal phone block (`:1781`) explicitly restates `white-space: normal;` — a comment two lines above it (`:1403`) documents this as the wave-102-consolidated repair that intentionally beats the desktop declaration on phone. No repair. |
| 3 | `app/src/pages/submissions/submissions.css` | `.chq-submissions-col-speakers` | white-space | **Out of 390 scope — desktop-only element, invisible at the phone frame.** This class is applied only to a `<th>` (`SubmissionsTable.tsx:559`); the sheet's terminal phone block sets `.chq-submissions-table thead { display: none; }` (`:649`), so this rule's ellipsis declaration never renders at 390 at all — there is no phone element for it to truncate or fail to truncate. DESKTOP IS FROZEN (DEC-385): the top-level rule is the only place `white-space:nowrap` could be added, and doing so is a desktop-affecting edit this lane may not make. Recorded, not repaired. |
| 4 | `app/src/pages/submissions/submissions.css` | `.chq-submissions-col-track` | white-space | Same as #3 — same `<th>`, same hidden `thead`. Recorded, not repaired. |
| 5 | `app/src/pages/submissions/submissions.css` | `.chq-submissions-col-custom` | white-space | Same as #3 — same `<th>`, same hidden `thead`. Recorded, not repaired. |

No offender in this roster is a genuine, unrepaired 390 truncation defect:
two are deliberate phone-authored wrap overrides, three are desktop-only
markup the phone frame never draws. `TRUNCATION_TRIAD_OFFENDERS_CEILING` is
seeded at the measured truth, 5, and registered in
`OUT_OF_CAMPAIGN_SCOPE` (not a live campaign gate) because every row's
disposition is either a DEC-385 frozen-desktop fact or a correctly-drawn
phone override, never an unadjudicated candidate defect.

## Falsifiability

The scan's positive/negative controls (`NON_NORMAL_WHITE_SPACE`,
`HIDDEN_OR_CLIP`) are exercised directly in the test file's own
`describe('falsifiability controls ...')` block, run through the scan's
own predicate functions rather than a re-implementation (DEC-989 clause c).
