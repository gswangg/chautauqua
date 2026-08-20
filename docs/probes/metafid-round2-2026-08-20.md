# Meta-fidelity ROUND 2 (74 screens @390, measured; evidence
# scratchpad/metafid-r2/). SUPERSEDES the two round-1 probe files' open
# rows — R1 findings not listed below are FIXED and verified.

## Verdicts: DONE at 390 (6): Docs, Overview, Speakers, Review, Home,
## Submissions. Remaining (7): Content (worst), Contacts, Comms, Settings,
## Public/Portal, Agenda-admin, Account. Both criticals CLOSED end-to-end.
## Zero horizontal overflow on all 74 screens.

## WAVE A — docks (ONE mechanism, ~6 screens + one DOM reorder)
- N1 HIGH: Content select-mode dock is INERT — .chq-bulkbar is sticky
  bottom:0 but DOM child 1 of 6 above a 3139px table; sticky-bottom never
  pins from there (probe: same element as LAST child pins at 788). DOM
  reorder, not CSS. Evidence content-sticky-chain.json.
- Missing docks, same mechanism as the 7 screens that already pin
  (chq-phone-dock band + suppression): Contacts Pipeline, Content Files,
  Content Session-deliverable, CFP wizard, portal profile, portal session.
  Tab-bar presence on these screens is a SYMPTOM of the missing dock.

## WAVE B — tokens + localized layouts
- Tap-floor tokens still under 44 (mechanical; sibling pattern at
  settings.css:2087): .chq-submissions-clone 14px · .chq-check 18px ·
  .chq-forms-strip-label 16px · .chq-forms-strip-datefield 28.4px (also
  clipped: sw108>cw93) · contacts name links 25.6px · content file links
  24px · .chq-color-swatch 22px · portal add-resource 34px ·
  .chq-review-queue-footer-showall 30px.
- N2 MED: /login password↔button 0px gap AND email focus-ring overlaps the
  PASSWORD label by 4px on load (R1's "not reproducible" REFUTED — live
  measured). Add the gap.
- N3 MED: all 7 Settings edit panels invert back/title order
  (DESIGN-RULINGS:247: back above H1). JSX reorder x7.
- N4 MED: Comms drills (?tab=) still render the parent page head above the
  drill head — apply Contacts' suppression.
- CFP column 290px vs 358 budget — root cause: main.chq-measure 34px
  padding-inline STACKS with .chq-cfp-body 16px (390-68-32=290).
- N5 LOW: More-tab badge dot below label shifts its baseline 6.5px.
- N6 LOW: Settings hint alignment differs read (right) vs edit (left);
  frame left-aligns.

## Probe's ledger cross-check (NOT defects): agenda head action row is
## RULED (DEC-380 w116); saved-embed host col, embed drill anatomy,
## Your-data edit view, portal "Later" are DEFERRED in DEVIATIONS.
