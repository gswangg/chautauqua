# Cascade-order sweep, widened to the equal-specificity exposure (DEC-385 wave-27 amendment)

Task w27-f. Measurement only; no product CSS byte changed by this task.

## What this widens

`test/phone-cascade-order.scan.test.ts`'s existing detector (`SHADOWED_CEILING`,
seeded 0) flags a max-width declaration only when the SAME selector is
re-declared at top level, for the SAME property, later in the same
stylesheet. `docs/mobile-campaign.md`'s cascade rule is broader than that:
"a stylesheet whose desktop rules are declared AFTER its max-width block
silently kills EQUAL-SPECIFICITY phone overrides" — a *different* top-level
selector, targeting the same component and carrying equal-or-higher
specificity, wins the cascade just as completely as an identical-selector
re-declaration, and the identical-selector detector cannot see it.

## Detector

For every declaration inside a `@media (max-width: …px)` block (excluding
`min-width` combination queries, matching the existing detector's scope):

1. Extract every `chq-` class token in the narrow (phone) selector. If none,
   skip — there is no shared-component signal to test against.
2. For every top-level declaration, in the same sheet, for the same
   property, at an offset strictly after the max-width block's closing
   brace, whose selector is **not identical** to the narrow selector (the
   identical case is already `SHADOWED_CEILING`'s job):
   - Check it mentions at least one of the narrow selector's `chq-` tokens
     on a real class boundary, via `selectorMentionsToken` imported from
     `app/src/phone-tap-target-scan/core.ts` (DEC-613 — no second copy of
     that check).
   - Compute a (id, class-ish, element-ish) specificity tuple for both
     selectors (summed across the whole selector chain, over
     class/id/attribute/pseudo-class/element/pseudo-element tokens only —
     "simple class/element/pseudo selectors" per the ruling, not a full CSS
     selector-grammar implementation) and require the later selector's
     tuple to be lexicographically >= the narrow selector's.
3. Both conditions holding names an offending pair.

## Population

Identical to the existing detector's, unchanged: 43 sheets (27 `app/src/**/*.css`
files enumerated via `readdirSync`, plus every SSR `*_CSS` module discovered
by `test/helpers/ssr-css-sources.ts`).

## Measurement

Ceiling was seeded at `-1`, the scan run, the printed offender roster read,
and the real count written back — never invented (per DEC-069/DEC-808's
"a ceiling is measured, not declared" discipline).

**Measured count: 0.**

The offender roster is empty. No stylesheet in the current tree carries a
max-width declaration that is beaten by a *different*, equal-or-higher-
specificity, same-component top-level selector declared later in source
order. `EQUAL_SPECIFICITY_SHADOWED_CEILING` is registered at `0` in
`test/phone-cascade-order.scan.test.ts`, two-sided (an "exceeds" `it` and a
"falls below without a ceiling bump" `it`, mirroring `SHADOWED_CEILING`'s
existing shape), and in `scripts/exit-predicate.ts`'s `OUT_OF_CAMPAIGN_SCOPE`
map (inserted immediately after `COMMENT_BLIND_CSS_ASSERTION_CEILING`, per
the task brief, so this hunk does not collide with sibling lanes appending
elsewhere in the same object).

A future non-zero measurement here means: a max-width block set a property
for a component-scoped selector, and a *different* selector for the same
component — same or higher specificity — was declared afterward at top
level for the same property. Read the printed offender list (file, narrow
selector, wide selector, property) from a forced `-1` re-run before
adjusting the ceiling; never hand-edit the number from inside a worker
lane that is not the one doing the fix (merge-train act only, matching
`SHADOWED_CEILING`'s existing discipline).
