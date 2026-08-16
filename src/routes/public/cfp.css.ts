// DEC-373: one co-located CSS-string module for the public CFP surface
// family (form + confirmation + closed/not-yet-open states) — tokens live
// only in src/views/theme.ts's THEME_CSS; this file only adds .chq-cfp-*
// layout/behavior on top of it. Plain .ts (no JSX), pure Web-safe CSS text:
// no node:/cloudflare import (DEC-002).
//
// DEC-374: value-free module constant, injected verbatim via
// dangerouslySetInnerHTML by the surface's PageShell — never interpolated
// with request/user data here.
//
// DEC-657 (wave 28 amendment): the shared no-red error vocabulary (used to
// be defined here at :108-119) is hoisted to src/views/error-states.css.ts
// (ERROR_STATES_CSS), composed at the tail of this same template literal --
// exactly the interpolation idiom public.css.ts's PUBLIC_CSS already uses to
// compose CHROME_CSS/CARDS_CSS/AGENDA_CSS/RAIL_CSS.

import { DEC_373, DEC_374, DEC_657, DEC_945 } from "../../decisions";
import { ERROR_STATES_CSS } from "../../views/error-states.css";
import { BARE_PAGE_CSS } from "../../views/bare-page.css";

void DEC_373;
void DEC_374;
void DEC_657;
void DEC_945;

export const CFP_CSS = `
  /* DEC-986 (wave 40 amendment): chrome is never constrained -- the header
     below is a sibling of PageShell's <main class="chq-measure">, so it
     spans the true viewport width with its own padding rather than the
     reading column's measure. DEC-371: --chq-brandable-accent is the only
     per-event recolour hook -- it never repoints --chq-brand/--chq-ink or
     button colours, so a thin top rule on the header is the only place the
     CFP page recolours with the event's accent (DEC-374: the value itself
     lives on <body>, validated by the caller, not interpolated into this
     file). */
  .chq-cfp-header { border-top: 3px solid var(--chq-brandable-accent); border-bottom: 1px solid var(--chq-ink); padding: 26px 44px 20px; display: flex; flex-direction: column; gap: 7px; }
  .chq-cfp-meta { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--chq-muted); }
  .chq-cfp-title { font-family: var(--chq-font-display); font-size: 32px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.2; margin: 0; display: flex; align-items: center; gap: 10px; }
  .chq-cfp-sub { font-size: 15px; color: var(--chq-ink-2); }
  /* DEC-371 (wave 5 amendment): the CFP form's content column is 732px --
     centred inside the 820px reading measure (PageShell's <main
     class="chq-measure">) that already wraps this element -- not the
     intrinsic/820 width the page previously rendered at (gate-4 measured
     663). Distinct from the 820 page measure that contains it, and from
     the admin CFP builder's own (separate) container. */
  .chq-cfp-body { max-width: 732px; margin: 0 auto; padding: 28px 44px 40px; display: flex; flex-direction: column; gap: 30px; }
  .chq-cfp-intro { display: flex; flex-direction: column; gap: 11px; max-width: 62ch; }
  /* w5-c: the "Create an account" affordance line under the lede -- same
     small/muted note treatment as the identity note it complements. */
  .chq-cfp-intro-cta { margin: 0; font-size: 13px; color: var(--chq-muted); line-height: 1.5; }
  /* w5-c (frame 10--14): the YOU section sits ~54px below Your talk --
     document flow between the form's two top-level <section>s carried no
     explicit rule before (a bare ~15px fell out of surrounding margins). */
  .chq-cfp-body form section + section { margin-top: 54px; }
  /* task-w49-h (DEC-990 amendment): font-size/weight/letter-spacing moved
     to the shared .chq-pub-surface-title register (README's page-title
     row, 36px/700/-0.04em) -- this selector keeps only its own layout. */
  .chq-cfp-intro h1 { font-family: var(--chq-font-display); line-height: 1.08; margin: 0; }
  .chq-cfp-intro p { margin: 0; font-size: 16px; line-height: 1.7; color: var(--chq-ink-2); }
  .chq-cfp-section-label { font-family: var(--chq-font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 2px solid var(--chq-ink); padding-bottom: 8px; }
  .chq-cfp-fields { padding: 18px 0 0; display: flex; flex-direction: column; gap: 20px; max-width: 760px; min-width: 0; }

  /* DEC-986 (wave 40 amendment): Track and Format sit side by side right
     under the abstract. A field offered alone (no tracks, or no format
     field on this form) still occupies its own grid cell -- the grid never
     collapses to one column, matching every other 2-up row on this
     surface. */
  .chq-cfp-track-format-row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }

  /* DEC-986 (wave 45 amendment): the YOU section pairs Name|Email, then
     Company|Job title, then Bio full-width -- one grid cell per field now
     that Name is a single control (closes the wave-40 amendment's deferred
     name-collapse). */
  .chq-cfp-you-grid.chq-cfp-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .chq-cfp-you-bio { grid-column: 1 / -1; }

  /* DEC-986 (wave 40 amendment): the Audience-level three-pill segment --
     reuses .chq-cfp-option's border/label chrome (below) but lays the
     options out in a row instead of TrackChoices'/FormatChoices' column,
     each pill sized to its own content rather than stretching full width. */
  .chq-cfp-segment { display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px; }
  .chq-cfp-option.chq-cfp-pill { width: auto; border-radius: 99px; }

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
  .chq-field-optional { font-weight: 800; text-transform: none; }
  .chq-field-counter { font-size: 12px; color: var(--chq-muted); white-space: nowrap; }
  .chq-cfp-fields .help { font-size: 12px; color: var(--chq-muted); margin: 0; }

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
  /* task-w49-h (DEC-990 amendment): see .chq-cfp-intro h1 above. */
  .chq-cfp-confirm h1 { font-family: var(--chq-font-display); line-height: 1.08; margin: 0; }
  .chq-cfp-confirm-card { border: 1px solid var(--chq-rule); border-radius: 8px; background: var(--chq-surface); padding: 15px; display: flex; flex-direction: column; gap: 5px; }
  .chq-cfp-confirm-card-meta { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--chq-muted); }
  .chq-cfp-confirm-body { font-size: 15px; line-height: 1.65; color: var(--chq-ink-2); }
  .chq-cfp-confirm-actions { border-top: 1px solid var(--chq-hairline); padding-top: 16px; display: flex; flex-direction: column; gap: 11px; }

  /* DEC-945 (wave 48 amendment): .chq-cfp-closed no longer draws its own
     card frame -- it inherits .chq-bare-page's 820px reading-column shell
     (no border, no fill, no radius) and keeps only its own type rules. */
  /* task-w49-h (DEC-990 amendment): see .chq-cfp-intro h1 above. */
  .chq-cfp-closed h1 { font-family: var(--chq-font-display); line-height: 1.08; margin: 0; }
  .chq-cfp-closed-body { font-size: 15px; line-height: 1.65; color: var(--chq-ink-2); }

  /* task-w49-h (DEC-990 amendment): the shared public page-title register
     -- docs/design/README.md's typography table states exactly two
     customer-facing h1 registers (page title 36px/700/-0.04em desktop;
     overview headline 44px, untouched -- see home.css.ts). Applied here
     (rather than inherited from src/routes/public/css/rail.css.ts, which
     this stylesheet does not compose) to every CFP-family h1 above that
     now carries this class in its markup. */
  .chq-pub-surface-title { font-family: var(--chq-font-display); font-size: 36px; font-weight: 700; letter-spacing: -0.04em; }

  .chq-cfp-links { display: flex; flex-direction: row; flex-wrap: wrap; gap: 18px; font-size: 13px; font-weight: 700; }
  /* G13 (frames 10--16/17/19/25, MAJOR): dead-end/confirmation links are
     the B8 tertiary register -- olive, no rest-state underline (underline
     is the hover state). */
  .chq-cfp-links a, .chq-cfp-confirm-actions a { color: var(--chq-brand); text-decoration: none; }
  .chq-cfp-links a:hover, .chq-cfp-confirm-actions a:hover { text-decoration: underline; }

  /* w14-f (DEC-986): phone-only two-step CFP wizard chrome. Every class
     below is inert on desktop (display: none, no other declaration) --
     phone-block-visibility.test.ts's invariant for a phone-only block --
     and is switched back on only inside the 700px media query below. The
     two step <section>s (.chq-cfp-step-talk / .chq-cfp-step-you) carry no
     rule of their own here: they already render as ordinary sections on
     every width, and only get hidden per-step via the compound
     [data-chq-cfp-step="N"] selectors inside the media block. */
  /* DEC-970 (SSR class contract): the base step marker itself needs no
     layout rule of its own -- it renders identically at every width, only
     the two compound [data-chq-cfp-step="N"] selectors above ever hide the
     section it's attached to. */
  .chq-cfp-step { display: block; }
  .chq-cfp-steps { display: none; }
  .chq-cfp-steps-label { display: none; }
  .chq-cfp-steps-bar { display: none; }
  .chq-cfp-steps-bar-fill { display: none; }
  .chq-cfp-step-next { display: none; }
  .chq-cfp-step-back { display: none; }

  @media (max-width: 700px) {
    .chq-cfp-header, .chq-cfp-body { padding-left: 16px; padding-right: 16px; }
    .chq-cfp-track-format-row,
    .chq-cfp-you-grid.chq-cfp-fields { grid-template-columns: 1fr; }
    /* DEC-367 (wave 50 amendment): the phone tap floor -- the Audience-level
       pill sizes to padding on desktop, per docs/design/README.md
       §Controls. */
    .chq-cfp-option.chq-cfp-pill { min-height: 44px; }

    /* CfpStepsScript is the only thing that ever changes
       data-chq-cfp-step away from its markup default of "all" (server-
       rendered forms carrying a validation error never get a script-set
       step, so they stay "all" and every rule below simply never matches).
       DEC-383: no colour literal, tokens only. */
    .chq-cfp-steps { display: flex; flex-direction: column; gap: 8px; margin-bottom: 6px; }
    .chq-cfp-steps-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--chq-muted); }
    .chq-cfp-steps-bar { display: block; height: 4px; border-radius: 2px; background: var(--chq-rule); overflow: hidden; }
    .chq-cfp-steps-bar-fill { display: block; height: 100%; width: 50%; background: var(--chq-brandable-accent); }
    .chq-cfp-step-next,
    .chq-cfp-step-back { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; }

    [data-chq-cfp-step="1"] .chq-cfp-step-you { display: none; }
    [data-chq-cfp-step="2"] .chq-cfp-step-talk { display: none; }
    [data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"] { display: none; }
    [data-chq-cfp-step="2"] .chq-cfp-step-next { display: none; }
  }
${ERROR_STATES_CSS}${BARE_PAGE_CSS}`;
