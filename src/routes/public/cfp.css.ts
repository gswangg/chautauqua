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

import { DEC_373, DEC_374, DEC_657, DEC_945, DEC_683, DEC_154 } from "../../decisions";
import { ERROR_STATES_CSS, ERROR_STATES_PHONE_CSS } from "../../views/error-states.css";
import { BARE_PAGE_CSS } from "../../views/bare-page.css";

void DEC_373;
void DEC_374;
void DEC_657;
void DEC_945; void DEC_683; void DEC_154;

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
  /* tap-floor-exempt: inline-in-prose -- v12m-w18-e (DEC-393 wave-142
     idiom): submit-views.tsx renders "New speaker? <a>Create an
     account</a> by submitting your talk below -- we'll ..." as one running
     sentence inside this note; the classless <a> is a phrase, not a
     standalone control. */
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
  .chq-field-counter { font-size: 12px; color: var(--chq-muted); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chq-cfp-fields .help { font-size: 12px; color: var(--chq-muted); margin: 0; }

  .chq-cfp-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; border-top: 1px solid var(--chq-rule); padding-top: 22px; }
  .chq-cfp-actions-note { font-size: 13px; color: var(--chq-muted); line-height: 1.5; }
  /* DEC-970: the "already have an account?" note in the form intro was
     rendering with no declared style -- same small/muted note treatment
     as .chq-cfp-actions-note above. */
  /* tap-floor-exempt: inline-in-prose -- v12m-w18-e (DEC-393 wave-142
     idiom): submit-views.tsx renders "Already have an account? <a>Sign in
     to the speaker portal</a> ›" as one running sentence inside this note;
     the classless <a> is a phrase, not a standalone control. */
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
  /* DEC-380 (wave 137 amendment): the check-spam note sits directly under
     the confirmation body at Public and Portal.dc.html:1084, smaller and
     more muted than .chq-cfp-confirm-body -- a sibling class, not a reuse
     of it. Comment deliberately avoids the caption's own verbatim text --
     this stylesheet is inlined into the page's <style> block, so a quoted
     copy here would leak into the couldn't-send branch's HTML too and trip
     the SSR test's not.toContain assertion. */
  .chq-cfp-confirm-note { font-size: 13px; line-height: 1.55; color: var(--chq-muted); }
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
     is the hover state).
     SCOPED OFF .chq-btn (mirrors theme.ts's own a:not(.chq-btn) idiom at
     src/views/theme.ts:215): .chq-cfp-confirm-actions ALSO holds the
     confirmation page's filled primary CTA -- the anchor each branch of
     submit-views.tsx's ConfirmationState switch renders with
     class="chq-btn chq-btn-primary". (No UI copy is quoted in this file:
     CFP_CSS ships inside every CFP page's <style>, so a quoted label here
     would read as page text to any copy assertion.) Unscoped, this rule's
     0,1,1 selector outranks .chq-btn-primary's 0,1,0
     (src/views/theme.ts:433-437) and repainted that button's label
     --chq-brand ON the --chq-brand fill -- brand-on-brand, 1:1 contrast,
     an invisible primary CTA on the live public page. */
  .chq-cfp-links a, .chq-cfp-confirm-actions a:not(.chq-btn) { color: var(--chq-brand); text-decoration: none; }
  .chq-cfp-links a:hover, .chq-cfp-confirm-actions a:not(.chq-btn):hover { text-decoration: underline; }

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
${ERROR_STATES_CSS}${BARE_PAGE_CSS}
  /* DEC-385 (v12 mobile campaign wave 85 amendment): the phone override
     block moved to the END of the template literal -- ERROR_STATES_CSS and
     BARE_PAGE_CSS are composed ABOVE this point, so their own (non-media)
     rules can never win a same-specificity fight against the phone rules
     below by sheer source order. Single-direction responsive: every rule
     in this block is a max-width override of a desktop rule declared
     earlier in this same file; nothing here is read outside <=700px.
     Geometry cited against docs/design/Chautauqua Public and Portal.dc.html
     frames :1017-1070 (Submit a talk) / :1074-1100 (Submitted) /
     :1124-1143 (Submitted, email already known) / :1147-1166 (Submitted,
     has an account) -- the three Submitted frames differ only in the
     .chq-cfp-confirm-actions branch already rendered by submit-views.tsx's
     ConfirmationState switch (DEC-098), so this stylesheet needs no
     per-state selector of its own. */
  @media (max-width: 700px) {
    /* :1018 -- head padding compacts from the desktop 26px 44px 20px band
       to the phone frame's own 14px 16px, gap 6px. .chq-cfp-header is
       rendered as PageShell's "header" prop -- a SIBLING of
       main.chq-measure (src/routes/public/submit-views.tsx:78), genuinely
       full-bleed -- so its own 16px left/right here is the ONLY gutter it
       ever gets. */
    .chq-cfp-header { padding-left: 16px; padding-right: 16px; padding-top: 14px; padding-bottom: 14px; gap: 6px; }
    /* task-w13-k (round-2 probe, DEC-385): .chq-cfp-body is the OTHER
       PageShell caller -- it is "children", rendered INSIDE
       main.chq-measure, which already carries src/views/theme.ts:642's
       main padding (26px 34px 34px) at EVERY width (that rule has no
       phone override). Adding another 16px here on top of main's 34px
       double-gutters the content column to 390-68-32=290px against the
       358px budget app/src/phone-horizontal-overflow.scan.test.ts derives
       from .chq-main's own phone gutter. Fixed by cancelling the INNER
       (this file's own) gutter, never the outer one in theme.ts -- that
       SSR main rule is shared by every page under the shell and shrinking
       it there would move every other page's measure, not just this
       one's. */
    /* Thunderdome megabatch (wave 125): SUPERSEDED IN PART. w13-k cancelled
       the INNER gutter (this rule, padding-left/right: 0) to clear the
       double-gutter; w14-h's DEC-683 wave-125 amendment instead cancels the
       OUTER one (main.chq-measure:has(.chq-cfp-body), below) and requires
       the body to KEEP its own 16px so the header (a full-bleed sibling of
       <main>, DEC-986) and the reading column share one gutter owner. Both
       fixes in one tree would zero BOTH gutters and full-bleed the column to
       390px. w14-h is the later ruling and the one that hits the DEC-989
       budget exactly (390 - 0 - 32 = 358), so the body's 16px is restored
       here and the cancel lives on <main> alone. */
    .chq-cfp-body { padding-left: 16px; padding-right: 16px; }
    /* :1019 -- the date/venue eyebrow drops from 11px to the frame's 10px;
       weight/letter-spacing/case/colour are unchanged (.chq-cfp-meta,
       above) so only size moves. */
    .chq-cfp-meta { font-size: 10px; }
    /* :1020 -- "Submit a talk" is the drill-in register (25px), distinct
       from :1077's confirmation-page landing register (27px, below) --
       DEC-643 amendment's two phone h1 registers, both inside the shared
       25-27px band docs/design/README.md's typography table names. */
    .chq-cfp-intro h1 { font-size: 25px; line-height: 1.05; }
    /* :1084's Submitted h1 shares the SAME 27px/700/-0.04em/1.08 register
       across all three Submitted frames (:1077/:1127/:1150 are byte-
       identical) -- one rule, not three. */
    .chq-cfp-confirm h1 { font-size: 27px; line-height: 1.08; }
    /* DEC-380 (wave-134 amendment): :1085-1088's password offer is a named,
       bordered block -- a display heading and a body line above the
       existing primary -- not a bare button. No desktop frame draws this
       screen at all (only the three :1077/:1127/:1150 390 frames exist for
       "Submitted"), so per DEC-385 single-direction responsive the new
       geometry lives here in the phone register only; outside this block
       the wrapper and its text sit unstyled, leaving desktop pins green. */
    .chq-cfp-confirm-password { display: flex; flex-direction: column; gap: 9px; }
    .chq-cfp-confirm-password-heading { font-family: var(--chq-font-display); font-size: 17px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.3; }
    .chq-cfp-confirm-password-body { font-size: 14px; line-height: 1.6; color: var(--chq-ink-2); }
    .chq-cfp-track-format-row,
    .chq-cfp-you-grid.chq-cfp-fields { grid-template-columns: 1fr; }
    /* DEC-367 (wave 50 amendment): the phone tap floor -- the Audience-level
       pill sizes to padding on desktop, per docs/design/README.md
       §Controls. */
    .chq-cfp-option.chq-cfp-pill { min-height: 44px; }
    /* :1092/:1135 -- the confirmation page's PLAIN-ANCHOR forward paths
       (the .chq-cfp-links row, plus the tertiary log-in link beside the
       primary CTA) carry no .chq-btn class, so they miss theme.ts's
       shared button/.chq-nav-a phone floor (its max-width:700px block, the
       "button, input[type=submit], .chq-btn" min-height:44px rule) -- own
       floor here: min-height + centred flex + horizontal padding, never a
       bare min-height.
       Scoped off .chq-btn for the same reason the colour rule above is:
       .chq-cfp-confirm-actions ALSO holds the filled primary CTA, which
       DOES carry .chq-btn and so already has theme.ts's 44px floor. Left
       unscoped, this rule's padding:0 2px would also outrank the shared
       button/.chq-btn padding:0.5rem 1rem (src/views/theme.ts:413) and
       squash that button on phone. */
    .chq-cfp-links a,
    .chq-cfp-confirm-actions a:not(.chq-btn) { min-height: 44px; display: inline-flex; align-items: center; padding: 0 2px; }

    /* CfpStepsScript is the only thing that ever changes
       data-chq-cfp-step away from its markup default of "all" (server-
       rendered forms carrying a validation error never get a script-set
       step, so they stay "all" and every rule below simply never matches).
       DEC-383: no colour literal, tokens only. */
    /* :1020-1024 -- the step label and progress bar sit in a ROW (not the
       stacked column this used to draw), baseline-centred, 8px gap. */
    .chq-cfp-steps { display: flex; flex-direction: row; align-items: center; gap: 8px; margin-bottom: 6px; }
    /* :1021 -- weight 800 / letter-spacing 0.09em, not the body copy's
       700/0.1em. */
    .chq-cfp-steps-label { display: block; font-size: 11px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; color: var(--chq-muted); }
    /* :1022 -- 5px pill-radius track, not a 4px/2px one. */
    .chq-cfp-steps-bar { display: block; flex: 1; height: 5px; border-radius: 99px; background: var(--chq-rule); overflow: hidden; }
    .chq-cfp-steps-bar-fill { display: block; height: 100%; width: 50%; background: var(--chq-brandable-accent); }
    .chq-cfp-step-next,
    .chq-cfp-step-back { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; }

    [data-chq-cfp-step="1"] .chq-cfp-step-you { display: none; }
    [data-chq-cfp-step="2"] .chq-cfp-step-talk { display: none; }
    /* phone-hidden: RE-LINED, not removed -- the step-1 primary submit is
       reachable one tap away on the same phone surface via
       .chq-cfp-step-next (cfp.css.ts:268/:294-297), which advances to
       data-chq-cfp-step="2" where this selector no longer matches; the
       markup default data-chq-cfp-step="all" (server-rendered / JS-off /
       error-re-render, cfp.css.ts:308-310) never carries this rule either,
       so the submit control is never hidden without a same-surface path to
       reach it (DEC-919). */
    [data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]:not(.chq-cfp-save-draft) { display: none; }
    /* :1063 -- the step-1 dock's secondary "Draft" control, next to the
       primary Next at flex:1 (.chq-cfp-step-next, above). Geometry only:
       the accessible name stays "Save draft" per DEC-613 wave-96 amendment
       (one control, one name at every width -- the frame's "Draft" is a
       drawing abbreviation, not a label to ship). */
    .chq-cfp-save-draft {
      min-height: 48px;
      display: inline-flex;
      align-items: center;
      padding: 0 16px;
      border: 1px solid var(--chq-border);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }
    /* Back has nothing to return to on step 1 -- the frame's step-1 dock
       never draws it. test/cfp-phone-steps.test.ts pins the two selectors
       above byte-for-byte; this one is additive, not a replacement. */
    /* phone-hidden: navigation control with nothing to reach -- step 1 is
       the first step, there is no previous step to go back to (DEC-919). */
    [data-chq-cfp-step="1"] .chq-cfp-step-back { display: none; }
    /* phone-hidden: navigation control with nothing to reach -- step 2 is
       the last step of the wizard, there is no next step (DEC-919). */
    [data-chq-cfp-step="2"] .chq-cfp-step-next { display: none; }

    /* w6-c (DEC-986 wave-117): cfp-steps-script.tsx:21-22 returns before
       wiring any handler when the re-rendered form carries
       .chq-field-error or [role=alert], leaving data-chq-cfp-step at its
       markup default "all" -- every field is already shown on that
       render, so the two-step wizard chrome has no steps left to move
       between. */
    /* phone-hidden: navigation control with nothing to reach -- with
       data-chq-cfp-step="all" every field renders at once, so there is no
       step to advance to or return from (DEC-919). */
    [data-chq-cfp-step="all"] .chq-cfp-steps,
    [data-chq-cfp-step="all"] .chq-cfp-step-next,
    [data-chq-cfp-step="all"] .chq-cfp-step-back { display: none; }

    /* task-w13-k (DEC-576 wave-110 amendment, "the SSR phone dock is ONE
       band"): :1063 draws .chq-cfp-actions as the filled, edge-to-edge
       footer band every SSR phone dock shares (src/routes/auth.css.ts's
       .chq-auth-actions is the model implementation) -- flex-shrink 0,
       ink-coloured border-top, a filled surface-sunk background, padding
       12px 16px 16px, display flex, gap 8px -- not the desktop card's bare
       --chq-rule divider this rule inherited unchanged until now. There is
       no .chq-tabbar on SSR routes (that's an app/src SPA shell class), so
       there is nothing to suppress underneath it; the dock IS the sticky
       band, no data-chq-phone-dock declaration needed. Every control
       inside (.chq-cfp-step-next/.chq-cfp-step-back/.chq-cfp-save-draft,
       all above) is one this flow already owns -- DEC-576 wave-120's "adopt
       the band when the frame's membership is satisfiable from controls
       the surface already owns" -- so this rule only re-skins the existing
       container, it adds no new control. */

    /* DEC-683 (wave 125 amendment): a phone content column has exactly ONE
       gutter owner. .chq-cfp-body (above) keeps its own 16px left/right --
       it is the frame's full-bleed header band that pins the edge, and the
       header already carries its OWN explicit 16px in this same block,
       independent of <main>'s padding (DEC-986: the header is a SIBLING of
       <main class="chq-measure">, submit-views.tsx:78, never a descendant
       of it). So cancelling <main>'s padding here only ever touches this
       page's reading column, never the header. Scoped with :has() from
       this page's own sheet rather than a shell edit (src/views/theme.ts
       is reserved for the shell lane) -- a bare 'main { padding-inline: 0
       }' would re-gutter every other SSR surface, so the selector below
       only ever matches a <main> that contains .chq-cfp-body. Result:
       390 - 0 (main) - 32 (body's own 16px x2) = 358, the DEC-989 budget. */
    main.chq-measure:has(.chq-cfp-body) { padding-inline: 0; }

    /* DEC-154 (wave 125 amendment) / frame :1061-1064 (Submit a talk ·
       390): the step-1 dock is .chq-cfp-actions itself -- no second
       geometry, no duplicate control. flex-shrink/border-top/background/
       padding/gap match the frame's SSR band verbatim (the same wave-110
       band DEC-154's amendment names), pinned to the viewport bottom and
       full-bleed against the single gutter cancelled above. The primary
       (.chq-btn-primary -- Submit on step 2, .chq-cfp-step-next "Next:
       about you" on step 1, DEC-919 makes only one visible per step) takes
       the frame's flex:1/48px; Draft (.chq-cfp-save-draft, already 48px/
       bordered above, :287-296) needs no change -- it already matches
       :1063 byte-for-byte. The note (:1005 has no counterpart in the 390
       dock) stands down; it is decorative confirmation copy repeated
       nowhere else needed, not a control losing its only path (DEC-919
       governs controls, not this text). .chq-cfp-body gains matching
       bottom padding so the fixed band never covers the form's own last
       field. */
    .chq-cfp-body { padding-bottom: 96px; }
    .chq-cfp-actions {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 3;
      flex-wrap: nowrap;
      flex-shrink: 0;
      border-top: 1px solid var(--chq-ink);
      background: var(--chq-surface-sunk);
      padding: 12px 16px 16px;
      gap: 8px;
    }
    /* :1063 leading flex:1 on the Next control -- the existing
       comment above .chq-cfp-save-draft already claimed this geometry;
       it was never actually declared. Draft/Back stay sized to their own
       content, matching the frame's bordered secondary beside the filled
       flex:1 primary. */
    .chq-cfp-step-next { flex: 1; }
    .chq-cfp-actions-note { display: none; }
    .chq-cfp-actions .chq-btn-primary { flex: 1; min-height: 48px; }

    /* task w18-e (SSR_CLASSLESS_ANCHOR_CEILING drain): "Browse the
       sessions ›" / "Submit another talk ›" / "Browse the programme ›"
       (.chq-cfp-links) are each the sole content of their own row inside
       .chq-cfp-links -- a standalone forward path, same disposition as
       portal.css.ts's .chq-portal-standalone-link (real floor, not
       inline-in-prose). The shared rule above (cfp.css.ts:295-296) already
       carries min-height:44px and non-zero horizontal padding, but
       declares display:inline-flex --
       phone-tap-target-ssr-classless-anchor.scan.test.ts's flex-centred
       lens looks for the literal \`display: flex\` DESIGN-RULINGS.md:189
       names, and inline-flex doesn't match it (a recurring literal-vs-
       inline-flex miss this campaign has caught before, e.g.
       .chq-auth-tertiary). Restated here, scoped to .chq-cfp-links a only
       -- .chq-cfp-confirm-actions a:not(.chq-btn) is deliberately left off
       this selector: its own classless anchor ("Already have a password?
       Log in ›") is a phrase inside one running sentence, not a standalone
       row, and takes the inline-in-prose exemption below instead (DEC-385
       append-only -- the shared rule above is left unedited for both
       selectors; this is an additive override of \`display\` alone). */
    .chq-cfp-links a { display: flex; }

    /* tap-floor-exempt: inline-in-prose -- v12m-w18-e (DEC-393 wave-142
       idiom, matches the JSX comment already sitting over both call sites
       in submit-views.tsx's ConfirmationPage): "Already have a password?
       Log in ›" is a phrase inside one running sentence, not a standalone
       control. .chq-cfp-confirm-actions ALSO holds the confirmation page's
       filled primary CTA (class="chq-btn chq-btn-primary"), which already
       carries theme.ts's shared .chq-btn floor and is untouched by this
       exemption -- it is scoped by TOKEN, the classless-anchor scan's own
       grammar, and only ever reaches a classless (unclassed) anchor. */
    .chq-cfp-confirm-actions a:not(.chq-btn) { color: var(--chq-brand); }
  }

  /* w7-f (DEC-989 wave-111 amendment): the wave-90 note above this line
     used to argue .chq-field-counter should stay exempt from the
     overflow-offenders scan (ellipsis mid-digit would misstate the
     count). That comment never actually sat directly above the rule it
     described, so it exempted nothing and the rule stayed a live
     offender under the ratchet. Fixed instead per the scan's own repair
     shape: overflow:hidden;text-overflow:ellipsis added to the rule
     itself (declared above) alongside the pre-existing white-space:
     nowrap, so the counter still never wraps mid-phrase and only
     visually truncates in the rare case this class already didn't
     expect to hit. Appended at the true end of this module, after every
     top-level rule and after the existing phone block above (never
     edited/reordered), per DEC-385 single-direction responsive. */
${ERROR_STATES_PHONE_CSS}`;
