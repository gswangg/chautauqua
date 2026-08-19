// DEC-371: SSR surfaces share one inlined THEME_CSS string. This is the
// server-rendered counterpart of app/src/styles.css (owned by the admin SPA
// shell lane, DEC-368) — same DEC-367 token vocabulary and self-hosted
// variable fonts, but as a plain string every SSR shell inlines via
// ThemeStyles(), not a stylesheet link (no static-asset request per page).
//
// Pure Web-safe CSS text: no node:/cloudflare import (DEC-002). This file
// is plain .ts (not .tsx) so ThemeStyles() below is built with hono/jsx's
// `jsx` factory directly rather than JSX syntax.
//
// DEC-374 escaping trap: a hono/jsx <style>{THEME_CSS}</style> *text
// child* gets THEME_CSS HTML-escaped like any other text node (& < > " '
// all round-trip as entities — &amp; &lt; &gt; &quot; &#39;). That silently
// breaks CSS containing any of those characters, including the self-hosted
// font stack: 'Familjen Grotesk' and url('/fonts/...') both round-tripped
// as &#39;-quoted strings, so the browser never recognized the font-family
// name or the font URL and the custom fonts never loaded. ThemeStyles()
// below instead renders `<style dangerouslySetInnerHTML={{ __html:
// THEME_CSS }} />`, which writes THEME_CSS to the DOM verbatim (no escaping)
// since THEME_CSS is a fixed, value-free module constant, never
// interpolated with request/user data.

import { jsx } from "hono/jsx";
import { DEC_367, DEC_371, DEC_383 } from "../decisions";

void DEC_367;
void DEC_371;
void DEC_383;

export const THEME_CSS = `
  :root {
    --chq-paper: #F4F1E8;
    --chq-surface: #FAF8F2;
    --chq-surface-sunk: #EFEBDF;
    --chq-ink: #1B1D17;
    --chq-ink-2: #3F4237;
    --chq-ink-strong: #2E2A24;
    --chq-muted: #565A4B;
    --chq-disabled: #7D7869;
    /* B8 disabled register (w25-g/DEC-745 amendment; w25-c/DEC-436 amendment
       darkened #8E8A7A -> #7D7869 to clear 3:1 against both --chq-disabled-bg
       below and the ordinary page grounds, per DEC-436's flip-to-blocking
       contrast pass): text on this #DDD8C8 fill, reserved for genuinely
       inert controls the reader must still be able to find and understand --
       never for placeholder text or mere de-emphasis. DEC-372 set equality
       keeps the name declared in both token files even though only the SPA
       consumes it today. */
    --chq-disabled-bg: #DDD8C8;
    --chq-hairline: #E1DDCE;
    --chq-rule: #D3CFC0;
    /* DEC-021 (wave-6 amendment): the agenda day grid's single lattice tone,
       the frame's #EDE9DD, which sits lighter than both --chq-hairline and
       --chq-rule. DEC-383 keeps colour literals in the two token files only,
       so the value lives here and agenda.css composes var(--chq-agenda-lattice);
       DEC-372 set equality keeps the name declared in both token files. */
    --chq-agenda-lattice: #EDE9DD;
    --chq-border: #BAB6A6;
    --chq-border-strong: #CFC7B7;
    --chq-brand: #4E5C31;
    --chq-brand-hover: #3C471F;
    --chq-on-brand: #F7F9F0;
    --chq-on-ink: #F4F1E8;
    --chq-on-ink-muted: #B5AFA2;
    --chq-on-ink-hairline: #3A3D32;
    --chq-brandable-accent: #4E5C31;
    --chq-r-ctl: 4px;
    --chq-r-ctl-phone: 6px;
    --chq-r-card: 5px;
    --chq-r-pill: 99px;
    --chq-font-display: 'Familjen Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    --chq-font-ui: 'Figtree', -apple-system, BlinkMacSystemFont, sans-serif;
    --chq-type-page-title-size: 36px;
    --chq-type-page-title-weight: 700;
    --chq-type-page-title-tracking: -0.04em;
    --chq-type-page-title-phone-size: 27px;
    --chq-type-page-title-phone-drill: 25px;
    --chq-type-overview-headline-size: 44px;
    --chq-type-overview-headline-weight: 700;
    --chq-type-overview-headline-tracking: -0.042em;
    --chq-type-overview-headline-line-height: 1.2;
    --chq-type-section-label-size: 11px;
    --chq-type-section-label-weight: 700;
    --chq-type-section-label-tracking: 0.12em;
    --chq-type-deadline-label-size: 10px;
    --chq-type-deadline-label-weight: 700;
    --chq-type-deadline-label-tracking: 0.12em;
    --chq-type-deadline-value-size: 30px;
    --chq-type-deadline-value-weight: 400;
    --chq-type-deadline-value-weight-nearest: 700;
    --chq-type-row-title-weight: 600;
    --chq-type-row-title-tracking: -0.015em;
    --chq-type-body-size: 15px;
    --chq-type-body-weight: 400;
    --chq-type-meta-size: 13px;
    --chq-type-micro-size: 10px;
    --chq-type-micro-weight: 800;
    --chq-type-micro-tracking: 0.11em;
    /* Layout (DEC-744/DEC-989, Amendment wave 37): the shared desktop
       page-content measures, kept at token parity (DEC-367/372) with the
       admin SPA's own stylesheet. Two widths reach the public/SSR
       surfaces: reading (820) and wide (1180, the sessions list + rail
       pair). Table (1440) is an admin-SPA-only class -- nothing
       server-rendered is table class, so --chq-measure-table lives only in
       the admin SPA copy (its own page-measure test owns that copy) and is
       NOT declared here; a token declared and consumed by nobody is a lie
       (FINDINGS w37). .chq-measure / .chq-measure-wide below consume
       these vars. */
    --chq-measure: 820px;
    --chq-measure-wide: 1180px;
    /* DEC-989 amendment (ruling B6, wave 25 task w25-i): the speaker
       portal is a task list for one person, not a reading surface --
       390 is a device width, 820 is too wide for a single-column task
       list. A fourth named measure keeps DEC-989's enumerating scan
       honest (every page still picks exactly one named token) rather
       than overriding --chq-measure locally. Consumed by
       src/routes/portal/portal.css.ts only. */
    --chq-portal-measure: var(--chq-measure);
    /* DEC-683 amendment (wave 1, task w1-a): the PUBLIC PAIR contract is
       820 (list) + 60 (gap) + 300 (rail) = 1180 of CONTENT at a 1440
       viewport. --chq-measure-wide alone only clamps a rule's max-width;
       when the clamped element is ALSO the padded ancestor (main.chq-pub-
       main, src/routes/public/css/chrome.css.ts), box-sizing:border-box
       eats that padding out of the 1180 instead of adding it, landing at
       1112 of content. --chq-pub-main-pad-x is the SAME left/right padding
       value main.chq-pub-main declares, named here so chrome.css.ts's
       wide-main override can cancel it back out via calc() -- never a
       vw/cqw guess. */
    --chq-pub-main-pad-x: 34px;
    /* DEC-534 amendment (wave 4, task w4-g): the ONE time/room gutter width
       for the two-line time-over-room stack, per docs/design's "Public and
       Portal" sheet (.dc.html:67 \`grid-template-columns:126px 1fr auto\`
       -- 126px). Cited that way, not by the
       doc's product-name-bearing filename: inlined CSS comments ship to the
       browser, and the sibling copy of this note in cards.css.ts lands
       inside GET /'s <style>, where test/root.test.ts forbids the name
       above .chq-home-footer. Kept in sync here. Consumed by BOTH
       .chq-pub-session-row (cards.css.ts) and .chq-pub-schedule-row
       (rail.css.ts) so the two renderings of one stack can't drift again.
       Mirrored in app/src/styles.css. */
    --chq-pub-when-gutter: 126px;
    /* Interaction-state + motion tokens (DEC-383 wave-58 amendment; V11 B8,
       docs/design/DESIGN-RULINGS.md:108-177). DEC-372 binds these two token
       files to the IDENTICAL --chq-* name set with identical values, so the
       SPA and SSR vocabularies cannot drift; the amendment's "and nowhere
       else" is about SURFACE stylesheets carrying literals, which these two
       token files are not. The B8 hover/active/disabled RULES live with
       their consumers in app/src/styles.css (SSR surfaces consume none of
       these yet); only the vocabulary is mirrored here.
       Mirrored in app/src/styles.css. */
    --chq-brand-active: #33401A;
    --chq-secondary-hover: #E4DFD2;
    --chq-secondary-hover-border: #BAB6A6;
    --chq-secondary-active: #DCD6C6;
    --chq-destructive: #565A4B;
    --chq-destructive-hover: #1B1D17;
    --chq-border-hover: #8E8A7A;
    /* wave-64: the three -exit twins (color-exit/appear-exit/geometry-exit)
       were deleted here and from the SPA's app/src/styles.css in the same
       commit -- a "leave at half" rule nothing ever called (React unmounts
       instantly; there is no leave transition to time in either sheet). */
    --chq-motion-color: 120ms;
    /* wave-64 ledger (DEC-851 in CSS, applied to this sheet's own gaps):
       --chq-motion-appear and --chq-motion-geometry (with --chq-ease-
       geometry) have no reader below this line -- kept for DEC-372 token
       parity with app/src/styles.css, where both are spent (modal/drawer
       entrances, the review disclosure band, error/result banners). The
       structural reason they stay unread here rather than being deleted
       like the -exit trio above: SSR-rendered surfaces (auth/portal/CFP)
       have no client-side mount/unmount to animate an entrance for --
       every element they emit is already in the initial HTML response, so
       there is no "appearing" or "opening" moment for either token to
       time. Should an SSR surface grow one (e.g. a client-hydrated
       disclosure), spend the token here instead of adding a new one. */
    --chq-motion-appear: 180ms;
    --chq-motion-geometry: 220ms;
    --chq-ease-state: ease-out;
    --chq-ease-geometry: cubic-bezier(0.2, 0, 0, 1);
  }

  @font-face {
    font-family: 'Familjen Grotesk';
    src: url('/fonts/FamiljenGrotesk-var.woff2') format('woff2-variations');
    font-weight: 400 700;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Figtree';
    src: url('/fonts/Figtree-var.woff2') format('woff2-variations');
    font-weight: 400 800;
    font-style: normal;
    font-display: swap;
  }

  *, *::before, *::after { box-sizing: border-box; }
  html, body { max-width: 100%; }
  body {
    margin: 0;
    font-family: 'Figtree', system-ui, sans-serif;
    color: var(--chq-ink-2);
    background: var(--chq-paper);
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    color: var(--chq-ink);
    margin: 0;
  }
  img { max-width: 100%; height: auto; }
  a { color: var(--chq-brand); }
  /* DEC-383 (wave-60 amendment): narrowed off .chq-btn -- the generic anchor
     hover used to repaint a button-classed anchor's LABEL to the hover brand
     on the unchanged brand fill (dark-on-dark on .chq-btn-primary). Button
     tiers below own their own hover/active rules. */
  a:not(.chq-btn):hover { color: var(--chq-brand-hover); }
  :focus-visible { outline: 2px solid var(--chq-brand); outline-offset: 2px; }

  /* Touch has no hover (B8): a tap must not leave a stuck tint behind after
     the 300ms hover-simulation delay some browsers apply on touch. */
  html {
    -webkit-tap-highlight-color: transparent;
  }

  /* Every interactive element is >=44px tall on phone (min-height, not
     padding) -- DEC-367. Attribute selectors stay unquoted here for
     consistency, though dangerouslySetInnerHTML (see file header) no
     longer requires it. */
  input[type=search], input[type=text], input[type=email], input[type=tel],
  input[type=url], input[type=password], select, textarea {
    max-width: 100%;
    box-sizing: border-box;
    font-size: 1rem;
    font-family: inherit;
    color: var(--chq-ink);
    background: var(--chq-surface);
    border: 1px solid var(--chq-border);
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
  }
  .chq-input, .chq-select, .chq-textarea {
    max-width: 100%;
    box-sizing: border-box;
    font-size: 1rem;
    font-family: inherit;
    color: var(--chq-ink);
    background: var(--chq-surface);
    border: 1px solid var(--chq-border);
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
  }

  /* DEC-585: every remaining browser-default control on an SSR surface --
     file pickers, date inputs, checkboxes/radios and native selects -- gets
     the same paper/olive/ink metrics as the text inputs above, plus an
     explicit :focus-visible so appearance:none never ships without one. */
  input[type=date] {
    max-width: 100%;
    box-sizing: border-box;
    font-size: 1rem;
    font-family: inherit;
    color: var(--chq-ink);
    background: var(--chq-surface);
    border: 1px solid var(--chq-border);
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
  }

  input[type=file] {
    max-width: 100%;
    box-sizing: border-box;
    font-size: 1rem;
    font-family: inherit;
    color: var(--chq-ink-2);
    background: transparent;
    border: none;
    padding: 0.4rem 0;
  }
  /* Both the standard ::file-selector-button and the -webkit- prefixed
     ::-webkit-file-upload-button are required -- Safari only recognizes the
     prefixed form, Chrome/Firefox the standard one. Styled as a secondary
     button on the frozen palette. */
  input[type=file]::file-selector-button,
  input[type=file]::-webkit-file-upload-button {
    margin-right: 0.75rem;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    font-family: 'Figtree', system-ui, sans-serif;
    font-weight: 600;
    color: var(--chq-ink-strong);
    background: var(--chq-surface-sunk);
    border: 1px solid var(--chq-border-strong);
    border-radius: 4px;
    cursor: pointer;
  }

  /* Explicit box size keeps the visual control small; the 44px phone tap
     floor is met by padding on the surrounding label, not by inflating the
     box itself (that lives in the page/surface markup, not this shared
     sheet).

     DEC-585 amendment (speakers-defect wave): appearance:none here for the
     same reason it is on the select below -- accent-color merely TINTS the
     platform's own widget, and a platform widget also draws the platform's
     own focus treatment inside the house ring declared above, which reads
     as a native (doubled) focus ring. The box is drawn here instead, so
     the :focus-visible rule at the top of this sheet is the ONLY focus
     mark a checkbox or radio ever wears. Twin of the same takeover in
     app/src/styles.css's "Native control styling" section -- the two
     stylesheet roots DEC-409 names must agree. The mark is CSS, never an
     asset. */
  input[type=checkbox], input[type=radio] {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    position: relative;
    width: 18px;
    height: 18px;
    margin: 0;
    flex-shrink: 0;
    background: var(--chq-surface);
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-ctl);
    cursor: pointer;
  }

  input[type=radio] { border-radius: 50%; }

  input[type=checkbox]:checked,
  input[type=checkbox]:indeterminate,
  input[type=radio]:checked {
    background: var(--chq-brand);
    border-color: var(--chq-brand);
  }

  input[type=checkbox]:checked::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: solid var(--chq-on-brand);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  input[type=checkbox]:indeterminate::after {
    content: '';
    position: absolute;
    left: 3px;
    top: 7px;
    width: 10px;
    height: 2px;
    background: var(--chq-on-brand);
  }

  input[type=radio]:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--chq-on-brand);
  }

  input[type=checkbox]:disabled, input[type=radio]:disabled {
    background: var(--chq-disabled-bg);
    border-color: var(--chq-border-strong);
    cursor: default;
  }

  /* w1-b: appearance:none strips the native OS caret from every select
     (public, portal and CFP alike -- this is the ONE shared rule), so a
     replacement affordance is mandatory or the control renders
     indistinguishable from a text input. DEC-374's escaping trap applies:
     THEME_CSS is injected raw, so this stays a fixed, value-free constant
     -- an inline data-URI SVG chevron (a literal, no interpolated value)
     rather than a per-event colour or asset URL. A hex "#" inside the SVG
     data URI is percent-encoded (%23) since a bare "#" would be read as a
     URL fragment delimiter, not the fill colour's hex marker. The
     padding-right (2.25rem) is sized to clear the caret's 12px box plus
     its 12px right inset. */
  select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    max-width: 100%;
    box-sizing: border-box;
    font-size: 1rem;
    font-family: inherit;
    color: var(--chq-ink);
    background-color: var(--chq-surface);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5L6 8l3.5-3.5' fill='none' stroke='%231B1D17' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 12px 12px;
    border: 1px solid var(--chq-border);
    border-radius: 4px;
    padding: 0.4rem 2.25rem 0.4rem 0.6rem;
  }

  input[type=date]:focus-visible,
  input[type=file]:focus-visible,
  input[type=checkbox]:focus-visible,
  input[type=radio]:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--chq-brand);
    outline-offset: 2px;
  }

  button, input[type=submit], .chq-btn {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    font-family: 'Figtree', system-ui, sans-serif;
    font-weight: 700;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    /* B8 (DEC-383, wave-60 amendment): each tier darkens on hover/press,
       nothing moves -- colour only, never \`all\` (that would also animate
       the focus ring). */
    transition: background-color var(--chq-motion-color) var(--chq-ease-state),
      border-color var(--chq-motion-color) var(--chq-ease-state),
      color var(--chq-motion-color) var(--chq-ease-state);
  }
  .chq-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .chq-btn-primary {
    background: var(--chq-brand);
    color: var(--chq-on-brand);
    border: none;
  }
  .chq-btn-primary:hover {
    background: var(--chq-brand-hover);
    color: var(--chq-on-brand);
  }
  .chq-btn-primary:active {
    background: var(--chq-brand-active);
    color: var(--chq-on-brand);
  }
  button[type=submit]:not([class*="chq-btn-"]) {
    background: var(--chq-brand);
    color: var(--chq-on-brand);
    border: none;
  }
  button[type=submit]:not([class*="chq-btn-"]):hover {
    background: var(--chq-brand-hover);
    color: var(--chq-on-brand);
  }
  button[type=submit]:not([class*="chq-btn-"]):active {
    background: var(--chq-brand-active);
    color: var(--chq-on-brand);
  }
  .chq-btn-secondary {
    background: var(--chq-surface-sunk);
    color: var(--chq-ink-strong);
    border: 1px solid var(--chq-border-strong);
    font-weight: 600;
    font-family: inherit;
  }
  .chq-btn-secondary:hover {
    background: var(--chq-secondary-hover);
    border-color: var(--chq-secondary-hover-border);
  }
  .chq-btn-secondary:active {
    background: var(--chq-secondary-active);
  }
  .chq-btn-tertiary {
    background: transparent;
    color: var(--chq-brand);
    border: none;
    font-weight: 700;
    padding: 0.25rem 0;
    font-family: inherit;
  }
  .chq-btn-tertiary:hover {
    color: var(--chq-brand-hover);
    text-decoration: underline;
  }
  .chq-btn-tertiary:active {
    color: var(--chq-brand-active);
    text-decoration: underline;
  }
  /* B8: a disabled control has no hover state at all -- rest colour, stays
     there, cursor:default. Scoped after the tiers so it beats each tier's
     own colour without needing !important. */
  button:disabled, .chq-btn:disabled,
  button[aria-disabled=true], .chq-btn[aria-disabled=true] {
    color: var(--chq-disabled);
    background: var(--chq-disabled-bg);
    border-color: var(--chq-disabled-bg);
    cursor: default;
  }
  button:disabled:hover, .chq-btn:disabled:hover,
  button[aria-disabled=true]:hover, .chq-btn[aria-disabled=true]:hover,
  button:disabled:active, .chq-btn:disabled:active,
  button[aria-disabled=true]:active, .chq-btn[aria-disabled=true]:active {
    color: var(--chq-disabled);
    background: var(--chq-disabled-bg);
    border-color: var(--chq-disabled-bg);
  }

  /* Header + horizontal nav (DEC-369: sidebar deleted, top header replaces
     it on every SSR-served surface too). */
  .chq-header {
    border-bottom: 1px solid var(--chq-ink);
    padding: 15px 34px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    background: var(--chq-paper);
  }
  .chq-wordmark {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
    text-transform: lowercase;
    color: var(--chq-ink);
    text-decoration: none;
    /* Design pack v12 ("The wordmark needs an optical nudge, and it depends
       on the alignment mode"): Familjen Grotesk's font box is asymmetric
       (ascent 23 / descent 5 at 22px), so the ink lands ~3px below the box
       center whatever the line box is -- the offset is line-height-
       invariant, which is why no line-height is set here (DEC-991 bans <= 1
       on the display face) and the nudge alone does the work. .chq-header
       is align-items:center, so the nudge rides the wordmark. The portal's
       header instead nests this span in an align-items:baseline run
       (.chq-portal-brandline), which takes the nudge on the RUN and resets
       this one -- see portal.css.ts. */
    position: relative;
    top: -3px;
  }
  /* DEC-884: the customer's event name is never lowercased -- .chq-wordmark's
     text-transform: lowercase is reserved for the literal product wordmark
     on operator surfaces (dev mailbox, docs, tools). Same face otherwise. */
  .chq-eventmark {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--chq-ink);
    text-decoration: none;
  }
  .chq-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 15px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
  }
  .chq-nav a {
    display: inline-flex;
    align-items: center;
    padding: 4px 0;
    color: var(--chq-ink-2);
    text-decoration: none;
  }
  .chq-nav a:hover { background: var(--chq-surface-sunk); }
  .chq-nav a[aria-current=page] {
    color: var(--chq-ink);
    box-shadow: inset 0 -2px 0 var(--chq-brand);
  }

  .chq-section {
    margin: 26px 0;
  }
  .chq-section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--chq-muted);
    border-bottom: 2px solid var(--chq-ink);
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .chq-meta {
    font-size: 12px;
    font-weight: 400;
    color: var(--chq-muted);
  }
  .chq-flag {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--chq-ink);
  }

  .chq-table { border-collapse: collapse; width: 100%; }
  .chq-table th, .chq-table td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--chq-rule);
    font-size: 13px;
  }
  .chq-table th {
    font-weight: 700;
    color: var(--chq-muted);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.08em;
  }

  .chq-card {
    background: var(--chq-surface);
    border: 1px solid var(--chq-rule);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
  }

  .chq-measure { max-width: var(--chq-measure); margin: 0 auto; }
  .chq-measure-wide { max-width: var(--chq-measure-wide); margin: 0 auto; }

  main { padding: 26px 34px 34px; }

  /* Shared component classes (DEC-368) -- SSR-needed subset only. The rest
     (.chq-steps/.chq-step, .chq-bulkbar, .chq-rail, .chq-panel,
     .chq-scrim) live only in app/src/styles.css, owned by the admin SPA
     shell lane; nothing under src/views/ needs them today. */
  .chq-kv {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .chq-kv dt {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--chq-muted);
    margin: 0;
  }
  .chq-kv dd {
    font-size: 15px;
    color: var(--chq-ink-2);
    margin: 0;
  }
  .chq-pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 15px 0 0;
  }

  @media (max-width: 700px) {
    body { overflow-wrap: anywhere; }
  }

  /* DEC-367 amendment (wave 48): the >=44px tap floor is a PHONE rule, not a
     desktop one -- README's Controls section: "Every interactive element is
     >=44px on phone (44px minimum height plus centred flex, not padding).
     Desktop rows use padding:8-10px 14-18px." Each selector group below
     mirrors one of the base rules above (minus their own min-height), so on
     phone every text input, .chq-input/.chq-select/.chq-textarea, date
     input, file input, its file-selector button, native select, submit
     button/.chq-btn and .chq-nav link still lands at the 44px floor; on
     desktop they fall back to the padding-only box the base rule already
     sets (~34px for fields, ~36px for buttons). */
  @media (max-width: 700px) {
    input[type=search], input[type=text], input[type=email], input[type=tel],
    input[type=url], input[type=password], select, textarea {
      min-height: 44px;
    }
    .chq-input, .chq-select, .chq-textarea {
      min-height: 44px;
    }
    input[type=date] {
      min-height: 44px;
    }
    input[type=file] {
      min-height: 44px;
    }
    input[type=file]::file-selector-button,
    input[type=file]::-webkit-file-upload-button {
      min-height: 44px;
    }
    select {
      min-height: 44px;
    }
    button, input[type=submit], .chq-btn {
      min-height: 44px;
    }
    .chq-nav a {
      min-height: 44px;
    }
  }

  /* DEC-383 (wave-60 amendment), B8 "Respect the system setting": under
     prefers-reduced-motion, colour transitions go to 0ms -- states still
     change, nothing travels. Re-bind the duration tokens themselves rather
     than adding a parallel rule set, so every consumer that already
     references var(--chq-motion-color) inherits the reduced value for
     free. Mirrors app/src/styles.css's block. */
  @media (prefers-reduced-motion: reduce) {
    :root {
      --chq-motion-color: 0ms;
      --chq-motion-appear: 0ms;
      --chq-motion-geometry: 0ms;
    }
  }
`;

/** Inlines THEME_CSS into a <style> element. Every SSR shell calls this
 * once in <head> instead of building its own token/reset CSS. Built with
 * the `jsx` factory rather than JSX syntax, since this file is plain .ts. */
// The `any` return type mirrors what TS infers for a JSX-syntax component
// (this file is plain .ts, so it calls the `jsx` factory directly instead
// of using JSX syntax -- see file header). hono/jsx's JSX namespace doesn't
// declare an `Element` member, so JSX expressions in .tsx files type-check
// as `any` here too; annotating the real `JSXNode` return type instead
// makes every `<ThemeStyles />` call site a JSX2786 error, since
// `JSXNode` doesn't structurally satisfy `FunctionComponentResult`.
export function ThemeStyles(): any {
  return jsx("style", { dangerouslySetInnerHTML: { __html: THEME_CSS } });
}
