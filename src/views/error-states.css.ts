// DEC-124 (wave 26 amendment) + DEC-657 (wave 28 amendment): the no-red
// error vocabulary used to be defined exactly once on the server, buried in
// src/routes/public/cfp.css.ts:108-119 — so the one surface a non-employee
// actually uses (the speaker portal) had no stylesheet backing its own
// refusals. Hoisted here as its own value-free CSS-string module, composed
// into both CFP_CSS and PORTAL_CSS the way public.css.ts's PUBLIC_CSS
// composes CHROME_CSS/CARDS_CSS/AGENDA_CSS/RAIL_CSS. Plain .ts, pure
// Web-safe CSS text: no node:/cloudflare import (DEC-002), tokens only.
//
// DEC-374: value-free module constant — never interpolated with
// request/user data.

import { DEC_124, DEC_657 } from "../decisions";

void DEC_124;
void DEC_657;

export const ERROR_STATES_CSS = `
  /* Errors are typographic, never colour (DEC-367/DEC-124: no semantic
     red) -- weight alone distinguishes an error from ordinary help text
     without a colour channel. The vendored ERROR & VALIDATION STATES
     STANDARD names exactly three properties for an invalid field (1px ink
     border, 3px ink left edge, 13px/600 ink message) and no glyph -- the
     non-colour signal is the 3px edge on .chq-field-invalid plus the
     role="alert"/aria-describedby wiring, not a leading "!" (wave-50
     amendment, DEC-124: dropped the ::before marker the frames never
     drew). */
  .chq-field-error { font-size: 13px; font-weight: 600; margin: 0; color: var(--chq-ink); }

  /* DEC-124: the no-red error vocabulary, defined ONCE here and reused by
     class name everywhere a control or a page needs to flag a validation
     problem -- never re-invented per field. An invalid control gets a 1px
     ink border plus a 3px ink LEFT edge, which replaces (not adds to) 3px
     of the control's own left padding so nothing shifts on error. Applies
     equally to a text input, textarea, select or fieldset. */
  /* DEC-124 (wave-14 amendment): src/views/theme.ts's base
     input[type=...], select, textarea { border: ...; padding: ... }
     group is (0,1,1) per arm (an attribute selector counts as a class
     for specificity), which beats a bare .chq-field-invalid at
     (0,1,0) REGARDLESS of source order, because specificity is compared
     before order ever matters. Doubling the class to
     .chq-field-invalid.chq-field-invalid raises this rule to (0,2,0),
     which outranks theme.ts's group on every surface, order-independent
     -- no !important (DEC-409: these stylesheets argue by specificity,
     not by !important). */
  /* tap-floor-exempt: modifier that composes onto a real form control
     (input/select/textarea/fieldset), which already carries its own
     height/floor -- a per-token text scan can't follow that composition
     (phone-tap-target.scan.test.ts SSR_UNFLOORED_TOKENS_CEILING, task
     w7-e). */
  .chq-field-invalid.chq-field-invalid { border: 1px solid var(--chq-ink); border-left: 3px solid var(--chq-ink); padding-left: calc(0.6rem - 3px); }
  fieldset.chq-field-invalid { padding-left: 0; }

  /* DEC-124: the top-of-form error summary -- one block, one anchor per
     problem, each anchor pointing at the offending field's own id. The
     field itself keeps its own .chq-field-error message too (the summary
     orients, the field repairs). */
  /* G13 (frame 10--21, measured on the real ErrorSummary render): the
     summary is a FILLED panel -- --chq-surface-sunk fill, --chq-r-card
     radius, no bullet markers, olive anchors with no underline -- keeping
     the 1px ink border and 3px ink left edge the ERROR & VALIDATION STATES
     STANDARD names. The same fill was already measured correct on the auth
     band (11-account--09) and the settings banner (09--17), which each
     carried it as a scoped override; it belongs on the shared vocabulary,
     so both scopes stop re-declaring it. Applied on BOTH declaration sites
     together -- app/src/components/error-states.css is property-parity
     locked to this block (test/error-vocabulary-parity.scan.test.ts). */
  .chq-error-summary { border: 1px solid var(--chq-ink); border-left: 3px solid var(--chq-ink); border-radius: var(--chq-r-card); background: var(--chq-surface-sunk); padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
  .chq-error-summary h2 { font-family: var(--chq-font-display); font-size: 15px; font-weight: 800; letter-spacing: -0.01em; margin: 0; color: var(--chq-ink); }
  .chq-error-summary p { margin: 0; font-size: 13px; color: var(--chq-ink-2); line-height: 1.5; }
  .chq-error-summary ul { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }
  .chq-error-summary-link { font-size: 13px; font-weight: 700; color: var(--chq-brand); text-decoration: none; }
`;
