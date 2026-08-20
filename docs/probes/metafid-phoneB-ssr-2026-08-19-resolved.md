# Meta-fidelity probe: phone clusters B + SSR — RESOLVED since wave 120

(Split out of docs/probes/metafid-phoneB-ssr-2026-08-19.md by the
structure custodian, wave v12m-w16, to de-hotspot a file that had drawn
four merge conflicts. No content changed, only relocated; see that file's
short index header for the full split map.)

## RESOLVED since wave 120 (re-derived wave v12m-w15-i)
- 44px floor misses across public/portal: `.chq-review-queue-footer-showall`
  (app/src/pages/review/review.css`.chq-review-queue-footer-showall {`, the
  base rule, still declares no `min-height`/`height`) is now floored inside
  the file's terminal phone block: app/src/pages/review/review.css`min-height: 44px;`
  sits directly under a re-declared showall rule there, alongside a
  `display: flex; align-items: center; justify-content: center;` centring
  triple and `padding: 0 14px;` -- the full 44px-floor triple this row
  originally found missing. Fixed per
  the analogous link-button pattern this row cited at
  app/src/pages/settings/settings.css
  `.chq-settings-edit-row-actions .chq-link-button {`.
- Zero/negative control gaps, the two clauses not reproducible from a
  static read: /login's focus ring on the PASSWORD field on load (no
  `focus-visible` rule targets `.chq-auth-card input[type=password]` in
  src/routes/auth.css.ts at all, positive or negative, so nothing in the
  tree confirms or denies the frame divergence) and portal's session
  edit↔label 0px gap (no rule pairing a session-edit label directly to its
  control gap was found -- the nearest candidate,
  src/routes/portal/portal.css.ts `.chq-portal-session-label {`, styles
  a section label's own internal layout, not a label-to-control pairing).
  Left live rather than guessed closed — DEC-967 forbids receipting a fix
  that was not read.
