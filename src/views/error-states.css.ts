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
     red) -- weight + a leading marker distinguish an error from ordinary
     help text without a colour channel. */
  .chq-field-error { font-size: 13px; font-weight: 600; margin: 0; color: var(--chq-ink); }
  .chq-field-error::before { content: "! "; }

  /* DEC-124: the no-red error vocabulary, defined ONCE here and reused by
     class name everywhere a control or a page needs to flag a validation
     problem -- never re-invented per field. An invalid control gets a 1px
     ink border plus a 3px ink LEFT edge, which replaces (not adds to) 3px
     of the control's own left padding so nothing shifts on error. Applies
     equally to a text input, textarea, select or fieldset. */
  .chq-field-invalid { border: 1px solid var(--chq-ink); border-left: 3px solid var(--chq-ink); padding-left: calc(0.6rem - 3px); }
  fieldset.chq-field-invalid { padding-left: 0; }

  /* DEC-124: the top-of-form error summary -- one block, one anchor per
     problem, each anchor pointing at the offending field's own id. The
     field itself keeps its own .chq-field-error message too (the summary
     orients, the field repairs). */
  .chq-error-summary { border: 1px solid var(--chq-ink); border-left: 3px solid var(--chq-ink); padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
  .chq-error-summary h2 { font-family: var(--chq-font-display); font-size: 15px; font-weight: 800; letter-spacing: -0.01em; margin: 0; color: var(--chq-ink); }
  .chq-error-summary p { margin: 0; font-size: 13px; color: var(--chq-ink-2); line-height: 1.5; }
  .chq-error-summary ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; }
  .chq-error-summary-link { font-size: 13px; font-weight: 700; color: var(--chq-ink); }
`;
