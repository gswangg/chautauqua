// DEC-373: one co-located CSS-string module for the public CFP surface
// family (form + confirmation + closed/not-yet-open states) — tokens live
// only in src/views/theme.ts's THEME_CSS; this file only adds .chq-cfp-*
// layout/behavior on top of it. Plain .ts (no JSX), pure Web-safe CSS text:
// no node:/cloudflare import (DEC-002).
//
// DEC-374: value-free module constant, injected verbatim via
// dangerouslySetInnerHTML by the surface's PageShell — never interpolated
// with request/user data here.

import { DEC_373, DEC_374 } from "../../decisions";

void DEC_373;
void DEC_374;

export const CFP_CSS = `
  /* 660-760px measure for the form body (DEC-367/design frames: 660px
     inner column on the 900px desktop frame). */
  .chq-cfp-shell { margin: 0 auto; background: var(--chq-surface); border: 1px solid var(--chq-rule); }
  /* DEC-371: --chq-brandable-accent is the only per-event recolour hook --
     it never repoints --chq-brand/--chq-ink or button colours, so a
     thin top rule on the header is the only place the CFP page recolours
     with the event's accent (DEC-374: the value itself lives on <body>,
     validated by the caller, not interpolated into this file). */
  .chq-cfp-header { border-top: 3px solid var(--chq-brandable-accent); border-bottom: 1px solid var(--chq-ink); padding: 26px 44px 20px; display: flex; flex-direction: column; gap: 7px; }
  .chq-cfp-meta { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--chq-muted); }
  .chq-cfp-title { font-family: var(--chq-font-display); font-size: 32px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.2; margin: 0; }
  .chq-cfp-sub { font-size: 15px; color: var(--chq-ink-2); }
  .chq-cfp-body { padding: 28px 44px 40px; display: flex; flex-direction: column; gap: 30px; }
  .chq-cfp-intro { display: flex; flex-direction: column; gap: 11px; max-width: 62ch; }
  .chq-cfp-intro h1 { font-family: var(--chq-font-display); font-size: 34px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.08; margin: 0; }
  .chq-cfp-intro p { margin: 0; font-size: 16px; line-height: 1.7; color: var(--chq-ink-2); }
  .chq-cfp-section-label { font-family: var(--chq-font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 2px solid var(--chq-ink); padding-bottom: 8px; }
  .chq-cfp-fields { padding: 18px 0 0; display: flex; flex-direction: column; gap: 20px; max-width: 760px; min-width: 0; }

  /* form-render.tsx's shared FormField output (used by both this CFP page
     and the portal edit forms): .chq-field wraps each labeled control,
     .chq-field-label is the uppercase caption above it, and .chq-field-error
     is the per-field validation message. Styled here (this surface's only
     owned sheet) since the CFP page is the only place these render today
     with a stylesheet attached; a future portal.css.ts may add its own
     rules for the same shared class names without conflict. */
  .chq-cfp-fields .chq-field,
  .chq-cfp-fieldset .chq-field { display: flex; flex-direction: column; gap: 6px; }
  /* Text fields stack label-above-input; .chq-cfp-option checkbox rows must
     stay horizontal (this selector outranks .chq-cfp-option, so exclude it —
     the column layout once centered checkboxes above their track names). */
  .chq-cfp-fields label:not(.chq-cfp-option),
  .chq-cfp-fieldset label:not(.chq-cfp-option) { display: flex; flex-direction: column; gap: 6px; }
  /* DEC-909: label row is a flex row -- label (and its optional marker) on
     the left, the live long-text counter (when present) on the right,
     baseline-aligned per the design frame ('Abstract' / '412 / 1,200'). */
  .chq-field-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .chq-field-label { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--chq-muted); }
  /* Required fields carry no marker; optional fields append this span --
     same weight/case as the label it trails, not a separate legend. */
  .chq-field-optional { font-weight: 800; }
  .chq-field-counter { font-size: 12px; color: var(--chq-muted); white-space: nowrap; }
  .chq-cfp-fields .help { font-size: 12px; color: var(--chq-muted); margin: 0; }

  /* Errors are typographic, never colour (DEC-367: no semantic red) --
     bold weight + a leading marker distinguish an error from ordinary
     help text without a colour channel. */
  .chq-field-error { font-size: 12px; font-weight: 800; margin: 0; }
  .chq-field-error::before { content: "! "; }

  .chq-cfp-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; border-top: 1px solid var(--chq-rule); padding-top: 22px; }
  .chq-cfp-actions-note { font-size: 13px; color: var(--chq-muted); line-height: 1.5; }
  /* DEC-970: the "already have an account?" note in the form intro was
     rendering with no declared style -- same small/muted note treatment
     as .chq-cfp-actions-note above. */
  .chq-cfp-identity-note { font-size: 13px; color: var(--chq-muted); line-height: 1.5; }

  /* DEC-951: a one-column list at the form's measure -- the fieldset never
     wraps its rows into a grid, and each option row stretches to the
     fieldset's own width (which already inherits .chq-cfp-fields'
     760px measure) rather than sizing to its content. */
  .chq-cfp-fieldset { border: none; margin: 0; padding: 0; max-width: 760px; display: flex; flex-direction: column; gap: 8px; }
  .chq-cfp-fieldset legend { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--chq-muted); padding: 0; }
  .chq-cfp-option {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    border: 1px solid var(--chq-border);
    border-radius: 4px;
    background: var(--chq-surface);
    min-height: 46px;
    padding: 0 14px;
    font-size: 14px;
    font-weight: 500;
  }
  .chq-cfp-option input { flex-shrink: 0; }

  .chq-cfp-confirm { max-width: 660px; margin: 0 auto; padding: 26px 20px; display: flex; flex-direction: column; gap: 16px; }
  .chq-cfp-confirm-flag { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--chq-brand); }
  .chq-cfp-confirm h1 { font-family: var(--chq-font-display); font-size: 27px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.08; margin: 0; }
  .chq-cfp-confirm-card { border: 1px solid var(--chq-rule); border-radius: 8px; background: var(--chq-surface); padding: 15px; display: flex; flex-direction: column; gap: 5px; }
  .chq-cfp-confirm-body { font-size: 15px; line-height: 1.65; color: var(--chq-ink-2); }
  .chq-cfp-confirm-actions { border-top: 1px solid var(--chq-hairline); padding-top: 16px; display: flex; flex-direction: column; gap: 11px; }

  .chq-cfp-closed { max-width: 520px; margin: 0 auto; background: var(--chq-surface); border: 1px solid var(--chq-rule); border-radius: 6px; padding: 34px 34px 30px; display: flex; flex-direction: column; gap: 14px; }
  .chq-cfp-closed h1 { font-family: var(--chq-font-display); font-size: 29px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.08; margin: 0; }
  .chq-cfp-closed-body { font-size: 15px; line-height: 1.65; color: var(--chq-ink-2); }

  .chq-cfp-links { display: flex; flex-direction: row; flex-wrap: wrap; gap: 18px; font-size: 13px; font-weight: 700; }

  @media (max-width: 700px) {
    .chq-cfp-header, .chq-cfp-body { padding-left: 16px; padding-right: 16px; }
  }
`;
