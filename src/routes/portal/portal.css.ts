// DEC-373: one co-located CSS-string module per SSR surface family. This is
// the /portal/* family's module (.chq-portal-* classes) — PortalLayout
// (src/routes/portal/shared.tsx) renders ThemeStyles() followed by exactly
// one <style> carrying this string. The block below the marker is the
// verbatim starting point moved out of PortalLayout's old inline <style>;
// everything after it is new growth. Pure Web-safe CSS text: no node:/
// cloudflare import (DEC-002).
//
// DEC-374: this constant is injected via dangerouslySetInnerHTML at the
// call site, so it MUST stay value-free (module-level constant, never
// interpolated with request/user data — the per-event accent moved to a
// validated style attribute on <body> instead of a `:root` line here).
//
// Composes THEME_CSS's tokens/shared classes (.chq-flag, .chq-bar/
// .chq-bar-fill, .chq-kv, .chq-section/.chq-section-label, .chq-card,
// .chq-btn*) rather than redefining them — DEC-367: no semantic red
// anywhere, so task/completion state is carried by .chq-flag's type
// treatment (weight/letter-spacing/uppercase), never a red swatch.
//
// DEC-657 (wave 28 amendment): the shared no-red error vocabulary (this
// module used to redeclare its own, weaker .chq-field-error at :315-316) is
// hoisted to src/views/error-states.css.ts (ERROR_STATES_CSS), composed at
// the tail of this same template literal -- exactly the interpolation idiom
// public.css.ts's PUBLIC_CSS already uses to compose CHROME_CSS/CARDS_CSS/
// AGENDA_CSS/RAIL_CSS.

import { DEC_373, DEC_374, DEC_377, DEC_643, DEC_657, DEC_919, DEC_989, DEC_576, DEC_154 } from "../../decisions";
import { ERROR_STATES_CSS } from "../../views/error-states.css";
import { EMPTY_CSS } from "../public/css/empty.css";

void DEC_373;
void DEC_374;
void DEC_377; // captions below only ever restate fields the portal repo already returns
void DEC_643; // amendment (v12 mobile campaign w1): the 25px back-linked-drill-in H1 register, wired up here for TaskFormPage/EditPage (chq-portal-hero-drill)
void DEC_657; // wave 28 amendment: the portal's own error vocabulary is the hoisted shared one, never a private copy
void DEC_919; // amendment (wave 52): the portal's zero-states compose the same PublicEmptyState renderer/CSS as the public surfaces
void DEC_989; // ruling B6 (wave 25 amendment): portal content column clamps to --chq-portal-measure, not the shared reading measure
void DEC_576; // wave-110 amendment: the phone dock band's own children (.chq-portal-dock)
void DEC_154; // wave-110 amendment: the footer's duplicate Sign out is stood down at 390 only

export const PORTAL_CSS = `
  /* --- verbatim starting point (moved from PortalLayout's inline <style>) --- */
  main { padding: 0 1rem; }
  /* DEC-393: the bare "nav a" rule that duplicated the old sub-floor tap
     floor here is gone -- the portal nav markup (src/routes/portal/
     index.tsx) is nav.chq-nav > a, so THEME_CSS's more specific
     ".chq-nav a" rule (phone-scoped 44px tap floor) already covers it;
     duplicating it here at the old, now-stale floor would have been dead
     weight at best and a regression trap at worst. */
  table { border-collapse: collapse; }

  /* --- new growth: .chq-portal-* --- */
  /* DEC-367 amendment (wave 57): the >=44px tap floor is a PHONE rule
     (docs/design/README.md:92) -- moved to the phone media block at the
     tail of this module, no other property added. */
  .chq-portal-back {
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--chq-ink-2);
    text-decoration: none;
  }
  /* G13 (frames 10--04/24, MINOR): the portal H1 runs at the shared
     page-title register on desktop (--chq-type-page-title-size, 36px) --
     it was pinned to the phone token (25px) at every width. The phone
     media block at the tail restores the phone size. */
  .chq-portal-hero {
    font-size: var(--chq-type-page-title-size);
    font-weight: var(--chq-type-page-title-weight);
    letter-spacing: var(--chq-type-page-title-tracking);
    line-height: 1.2;
    margin: 6px 0 2px;
  }
  .chq-portal-sub {
    font-size: 13px;
    color: var(--chq-muted);
    line-height: 1.5;
  }

  /* G13 (frames 10--04/23/24, MAJOR): portal header anatomy -- wordmark +
     muted event name left, 'NAME · SIGN OUT' caps cluster right. The
     eventmark drops to a muted secondary beside the wordmark (frame 24);
     the identity cluster is the 11px caps micro register. The sign-out
     button strips its UA chrome so it reads as the frame's text control
     while keeping the POST semantics. */
  /* Design pack v12 ("nudge the OUTERMOST element that carries the
     wordmark's ink"): this run is align-items:baseline, so baseline
     alignment reconciles the wordmark with the event name beside it but
     never reconciles the PAIR with the centred header bar -- the run's box
     centres while the Familjen Grotesk ink sits ~3px low inside it. The
     -3px therefore rides the run; nudging the inner .chq-wordmark instead
     would break the shared baseline, since a top offset is post-layout and
     baseline alignment cannot absorb it. Hence the reset below. */
  .chq-portal-brandline {
    display: inline-flex;
    align-items: baseline;
    gap: 10px;
    position: relative;
    top: -3px;
  }
  .chq-portal-shell .chq-wordmark {
    position: static;
  }
  .chq-portal-shell .chq-eventmark {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--chq-muted);
  }
  .chq-portal-header-id {
    margin-left: auto;
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chq-ink-2);
  }
  .chq-portal-header-name {
    font-size: inherit;
    font-weight: inherit;
    color: inherit;
  }
  .chq-portal-header-sep { color: var(--chq-muted); }
  .chq-portal-header-signout { display: inline-flex; margin: 0; }
  .chq-portal-header-signout-btn {
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .chq-portal-header-signout-btn:hover,
  .chq-portal-header-signout-btn:active { color: var(--chq-ink); text-decoration: underline; }

  /* w15-b: "<name> · <company>" left, Profile link right, ahead of the
     (untouched) sign-out control inside .chq-portal-footer. */
  .chq-portal-footer-band {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-portal-footer-who {
    font-size: 13px;
    color: var(--chq-muted);
  }
  /* DEC-367 amendment (wave 57): both tap floors below moved to the
     phone media block at the tail of this module. */
  .chq-portal-footer-resources {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--chq-ink-2);
    text-decoration: none;
  }
  .chq-portal-footer-profile {
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--chq-ink);
    text-decoration: none;
  }

  /* w15-b: "Done" section row -- title left, uppercase completion date
     right (docs/design mock's {{ d.when }}). Composes .chq-portal-row's
     existing rhythm; only the head layout differs (baseline row, not a
     stacked column). */
  .chq-portal-done-row {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .chq-portal-done-when {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chq-brand);
    white-space: nowrap;
  }

  /* Task/session row: title + due date + a .chq-flag state marker, action
     controls below. Every control stays >=44px tall down to 390px
     (DEC-367 floor) — buttons in .chq-portal-actions never shrink under
     phone width, they wrap instead. */
  .chq-portal-row {
    padding: 15px 0;
    border-bottom: 1px solid var(--chq-hairline);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chq-portal-row-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .chq-portal-row-title {
    font-family: var(--chq-font-display);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: var(--chq-ink);
  }
  .chq-portal-due {
    font-size: 13px;
    color: var(--chq-muted);
  }
  .chq-portal-detail {
    font-size: 13px;
    color: var(--chq-muted);
    line-height: 1.5;
  }
  /* DEC-747 (findings wave 7 amendment): the read-only banner on
     /portal/preview. Reads as a standing notice, not a transient alert --
     a tinted rule-bordered strip above the previewed content, so an
     organizer can never mistake the preview for a speaker's own portal. */
  .chq-portal-preview-banner {
    margin: 0 0 16px;
    padding: 10px 12px;
    border: 1px solid var(--chq-border);
    border-left: 3px solid var(--chq-accent, var(--chq-ink));
    border-radius: 6px;
    background: var(--chq-surface-2, transparent);
    font-size: 13px;
    line-height: 1.5;
    color: var(--chq-muted);
  }
  /* CNT-01: a task's instructions is a real brief, not a muted footnote --
     plain body ink (var(--chq-ink), the surface's default text colour),
     never behind a disclosure. */
  .chq-portal-instructions {
    font-size: 13px;
    color: var(--chq-ink);
    line-height: 1.5;
  }
  /* Completion state text: composes the shared .chq-flag class (never
     red — DEC-367) rather than redefining it. This modifier only adds the
     olive "done" tint; a still-open row keeps .chq-flag's plain ink. */
  .chq-flag.chq-portal-flag-done { color: var(--chq-brand); }

  /* DEC-989 amendment (ruling B6): above phone width the task row action
     buttons stop spanning the row's full width (that's the phone-only
     .chq-btn { width: 100% } rule inside the max-width 700px block
     below) and right-flush instead, since the desktop column is now
     narrow enough (560px) that a left-flush row of buttons reads as
     stranded whitespace. Per DEC-385 the wide rendition is the base rule
     and the phone block below resets justify-content -- no min-width
     query anywhere in this codebase. */
  .chq-portal-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 2px;
    justify-content: flex-end;
  }
  /* DEC-367 amendment (wave 57): moved to the phone media block
     at the tail of this module -- phone-only tap floor. */

  /* G13 (frame 10--05): the tasks progress bar is retired -- the frame
     draws none -- so the .chq-portal-progress pair is deleted rather than
     left as dead rules (test/ssr-css-contract.scan.test.ts). */

  /* Profile facts: composes the shared .chq-kv definition list — grouped
     in a card, each fact stacked, with a headshot preview beside the
     upload control on the wide layout and stacked at phone width. */
  .chq-portal-profile-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--chq-hairline);
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .chq-portal-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
    background: var(--chq-surface-sunk);
    border: 1px solid var(--chq-rule);
  }
  .chq-portal-facts {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .chq-portal-facts .chq-kv {
    padding: 12px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }

  .chq-portal-field {
    padding: 15px 0;
    border-bottom: 1px solid var(--chq-hairline);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .chq-portal-field-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--chq-muted);
  }

  /* w2-g: sign-out demoted from the masthead to a quiet tertiary link in a
     page footer (DEC-590) — placement only, .chq-btn-tertiary is the
     existing frozen tertiary token (THEME_CSS), never a new button style. */
  .chq-portal-footer {
    max-width: var(--chq-portal-measure);
    margin: 24px auto 0;
    padding: 16px 1rem 40px;
    border-top: 1px solid var(--chq-hairline);
  }

  /* DEC-989 amendment (ruling B6): PortalLayout's <main> (src/routes/portal/
     shared.tsx) carries the shared .chq-measure class for its auto-margin
     centring behaviour, but the portal is a single-person task list, not a
     reading surface -- this override narrows just that instance to the
     portal's own token, centred in the page. Nothing else consuming
     .chq-measure elsewhere in the tree is touched. */
  .chq-portal-shell > .chq-measure {
    max-width: var(--chq-portal-measure);
  }
  /* DEC-367 amendment (wave 57): moved to the phone media block
     at the tail of this module -- phone-only tap floor. */

  /* form-render.tsx's shared FormField output renders un-wrapped on both
     portal surfaces that use it (the hotel-stay-style task form at
     /portal/tasks/:id/form and the submission edit "session" form) --
     unlike the CFP surface it has no .chq-cfp-fields container to hang
     layout off of. Without an explicit rule here .chq-field's single
     <label> lets its caption span and its control sit on one inline line
     and overlap (Tier 2 item 9). Fix: single-column flow, one explicit row
     gap, every label/control block-level with min-width:0 so a long value
     can't force the row wider than its column -- no float, no absolute
     positioning, no negative margin anywhere in this block. */
  .chq-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 15px 0;
    border-bottom: 1px solid var(--chq-hairline);
    min-width: 0;
  }
  .chq-field label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .chq-field-label {
    display: block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--chq-muted);
    min-width: 0;
  }
  .chq-field-optional {
    text-transform: none;
  }
  .chq-field .chq-input,
  .chq-field .chq-select,
  .chq-field .chq-textarea {
    display: block;
    width: 100%;
    min-width: 0;
  }
  .chq-field .help {
    font-size: 12px;
    color: var(--chq-muted);
    margin: 0;
  }
  /* DEC-657 (wave 28 amendment): .chq-field-error itself is styled by the
     hoisted ERROR_STATES_CSS composed below -- no per-surface redeclaration. */

  /* DEC-605: full version-chain history on a completed file_request task —
     one row per version, oldest to newest. Composes .chq-flag/.chq-portal-
     flag-done for the "Current" marker rather than a new state token. */
  .chq-portal-versions {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .chq-portal-version-row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 13px;
  }
  .chq-portal-version-num {
    font-weight: 700;
    color: var(--chq-muted);
    min-width: 28px;
  }

  /* DEC-729 (w1-c): "Your submissions" rows are <a> elements (whole row
     navigates to the detail page) styled to read exactly like the existing
     .chq-portal-row cards, not an underlined inline link. The status badge
     on the detail page composes .chq-flag (never a new color token, per
     DEC-367) plus an uppercase/letter-spacing treatment matching the mock's
     "Accepted · 14 Mar" line. */
  a.chq-portal-submission-row {
    color: inherit;
    text-decoration: none;
  }
  /* DEC-777: the status badge is its own block-level row, never an inline
     sibling sharing a line with the back link above it. */
  .chq-portal-status-row { margin-top: 8px; }
  /* DEC-970: the back-link wrapper row above it gets the matching gap,
     rather than relying solely on the status row's own margin-top. */
  .chq-portal-back-row { margin-bottom: 8px; }
  .chq-portal-status-badge {
    display: block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  /* DEC-696: chq-cfp-option vocabulary shared with src/routes/public/cfp.css.ts
     so /portal/edit's track fieldset and /submit/:slug's track fieldset use
     the identical option class + copy. Also styles renderMarkdown's output
     inside .chq-portal-detail (wiki resource bodies, DEC-696). */
  .chq-cfp-fieldset { border: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .chq-cfp-fieldset legend { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--chq-muted); padding: 0; }
  .chq-cfp-fieldset .help { font-size: 12px; color: var(--chq-muted); margin: 0; }
  .chq-cfp-option {
    display: flex;
    align-items: center;
    gap: 11px;
    border: 1px solid var(--chq-border);
    border-radius: 4px;
    background: var(--chq-surface);
    min-height: 46px;
    padding: 0 14px;
    font-size: 14px;
    font-weight: 500;
  }
  .chq-cfp-option input { flex-shrink: 0; }
  .chq-portal-detail h2, .chq-portal-detail h3 { color: var(--chq-ink); margin: 0 0 6px; }
  .chq-portal-detail p, .chq-portal-detail ul { margin: 0 0 10px; }
  .chq-portal-detail ul { padding-left: 20px; }

  /* DEC-604 (wave-56 amendment): the co-presenter add-form's submit is
     left-aligned at its natural width, never the Save-changes row's
     right-flush -- adding a co-presenter is an aside, not the page's
     primary action. */
  .chq-portal-copresenter-submit { padding-top: 2px; }
  /* DEC-367 amendment (wave 57): moved to the phone media block
     at the tail of this module -- phone-only tap floor. */

  /* DEC-604 (wave-56 amendment) B10 form spec: the edit view is the one
     portal page with a form, so first/last name go two-up and email pairs
     with the 190px role select once there is room -- test/breakpoint-
     conformance.test.ts's DEC-385 scan forbids any min-width media query
     anywhere in this tree (single-direction, max-width only), so the
     wide-only pairing is intrinsic (flex-wrap + a flex-basis floor) rather
     than a discrete breakpoint: below the fold-point each pair naturally
     wraps to a stacked column (mobile is untouched, unconditionally, by
     construction) and above it the two items sit side by side -- exactly
     the 1600-frame layout the ruling draws, reached without a new
     min-width query. */
  .chq-portal-copresenter-names,
  .chq-portal-copresenter-email-role {
    display: flex;
    flex-wrap: wrap;
    gap: 18px 16px;
  }
  .chq-portal-copresenter-names > div,
  .chq-portal-copresenter-email-role > div:first-child {
    flex: 1 1 220px;
    min-width: 0;
  }
  .chq-portal-copresenter-role {
    flex: 0 1 190px;
    min-width: 140px;
  }
  /* ===== G13 fix-forward (frames 10--05/06/09/22/23/26) ===== */

  /* Frames 10--06/23 (MAJOR): .chq-field-counter had NO stylesheet backing
     in the portal -- the rule lived only in CFP_CSS, so counters rendered
     16px, left-aligned, on their own line. Same register as the CFP sheet:
     label and counter share one baseline row, counter 12px muted
     right-flushed at the measure's edge. */
  .chq-field-label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .chq-field-counter { font-size: 12px; color: var(--chq-muted); white-space: nowrap; }

  /* Frame 10--05 (MAJOR): the comment textarea fell back to the browser's
     intrinsic cols width inside its column -- fields fill their column
     everywhere else in the system. */
  textarea.chq-textarea { width: 100%; }

  /* Frame 10--05 (MAJOR): the task detail's two sub-heads were bare 16px
     h4s with margin 0 -- they take the section-label register (11px caps
     over a 2px ink rule, matching .chq-section-label 30px higher on the
     same page) with breathing room above so the second one stops butting
     the version row. NOTE: comments here ship inside the page's <style>,
     so they must never quote on-page copy verbatim (index-scanning tests
     read the whole document). */
  .chq-portal-subsection-label {
    font-family: var(--chq-font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--chq-ink);
    border-bottom: 2px solid var(--chq-ink);
    padding-bottom: 6px;
    margin: 18px 0 8px;
  }

  /* Frames 10--09/22/23 (MAJOR): the participants section label carries
     the count right-flushed against the measure's edge. */
  .chq-portal-session-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .chq-portal-session-count { font-weight: 700; }

  /* Frames 10--09/22/23 (MAJOR): participant rows are ruled rows, never a
     bulleted UA list -- no disc, no 40px indent; name flush left, role as
     a right-side micro-label, 1px hairline per row. */
  .chq-portal-participants { list-style: none; margin: 0; padding: 0; }
  .chq-portal-participant-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-portal-participant-name { font-weight: 600; color: var(--chq-ink); }
  .chq-portal-participant-sub { flex-basis: 100%; }

  /* Frames 10--09/23 (MAJOR): the Save/Cancel row is the page's terminal
     element, preceded by a 1px rule and carrying the consequence line. */
  .chq-portal-actions-footer {
    border-top: 1px solid var(--chq-hairline);
    margin-top: 24px;
    padding-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chq-portal-actions-note { font-size: 13px; color: var(--chq-muted); line-height: 1.5; }

  /* Frame 10--23 (MINOR) + frame 14: desktop control heights -- the frames
     draw 46px inputs/selects and 46px footer buttons; the app rendered
     33.8/32.8/37. min-height (not padding) so multiline textareas are
     untouched. Phone keeps its own 44px floor rules. */
  .chq-input, .chq-select, select, input[type=text], input[type=email], input[type=date] { min-height: 46px; }
  .chq-portal-actions .chq-btn { min-height: 46px; }
  .chq-portal-copresenter-submit .chq-btn { min-height: 46px; }

  /* Frame 10--23 (MINOR), B8: inputs and selects darken the border on
     hover -- colour only, no size/shadow change. */
  .chq-input:hover, .chq-select:hover, .chq-textarea:hover, select:hover, textarea:hover,
  input[type=text]:hover, input[type=email]:hover, input[type=date]:hover {
    border-color: var(--chq-border-hover);
  }

  /* Frame 10--08 (MAJOR): the session title under the detail page's own
     H1 -- the largest thing after the H1 itself, in the display face. */
  .chq-portal-session-title {
    font-family: var(--chq-font-display);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 4px 0 2px;
  }

  /* Frame 10--24 (MAJOR): the preview page's H1 lede, and the read-only
     Download per DEVIATIONS §2's disabled link-shaped register -- muted
     text, no box, no underline, no hover response. */
  .chq-portal-lede { font-size: 16px; line-height: 1.6; color: var(--chq-ink-2); margin: 4px 0 10px; }
  .chq-portal-preview-download {
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--chq-disabled);
    cursor: default;
  }

  /* Frame 10--26 (MAJOR): a resource's own title (16px .chq-portal-row-title)
     was set smaller than the h2/h3 sub-heads of its own markdown body --
     the title must stay the largest element in its row. */
  .chq-portal-detail h2 { font-size: 15px; }
  .chq-portal-detail h3 { font-size: 13px; }

${EMPTY_CSS}
${ERROR_STATES_CSS}

/* DEC-747 (frame 10--24 amendment, wave 60): /portal/preview's "Not shown
   here" section — a plain chip list, no interaction, composing
   THEME_CSS's .chq-chipstrip visual language without importing app/src's
   client-only classes (this is an SSR surface). Tail growth per task
   w60-h; expect a tail overlap with w60-g's own portal.css.ts growth. */
.chq-portal-not-shown-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.chq-portal-not-shown-chip {
  border: 1px solid var(--chq-border);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  color: var(--chq-muted);
}

/* G13: EMPTY_CSS (composed above) raises the FRESH zero-state headline to
   the page-title register for full-page public empty states (frame 10--20).
   The portal's fresh blocks are INLINE section states ('No participants
   yet.', 'No comments yet.') -- re-pin them to the quiet register here,
   after the composed sheet, so they never inflate to 36px. */
.chq-portal-shell .chq-pub-empty-block-fresh .chq-pub-empty-what {
  font-family: inherit;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: normal;
  margin: 0 0 4px;
}
.chq-portal-shell .chq-pub-empty-block-fresh .chq-pub-empty-reason {
  font-size: 13px;
  line-height: 1.5;
}

.chq-portal-shell .chq-pub-empty-block-fresh { padding-top: 10px; }

/* v12m-w1-d (DEC-385 amendment wave 98): consolidated to ONE terminal phone
   block, per test/phone-terminal-block.scan.test.ts. This block now carries
   every phone (max-width:700px) rule for this sheet -- the w5-a block below
   used to sit earlier in the file (before the w8-h overflow-sweep rule); it
   is relocated here verbatim, in its original relative order, immediately
   ahead of w8-h so the two form one contiguous terminal block. No selector,
   declaration, or value changed -- pure relocation. */

/* v12m-w5-a: Portal's last two 390 frames -- Resources
   (docs/design/Chautauqua Public and Portal.dc.html:1561) \`width:390px; height:844px\` and the
   co-presenter-rejected state of the edit screen (:1304). Appended as one
   terminal, contiguous block per DEC-385 (narrow overrides wide via
   max-width only, and a phone block declared after the desktop rules is
   the only one that wins the cascade) -- the existing phone block near
   :444 is mid-rewrite on other branches and is never touched here. Every
   class this block styles is new growth with no base-rule counterpart
   above, so at desktop widths these elements render in plain unstyled
   flow; only <=700px carries the frame's geometry. */

/* w8-h (DEC-989 wave-90 amendment): 390-overflow sweep. .chq-portal-done-
   when (the "Done" row's uppercase completion date, declared above) is
   white-space:nowrap with no escape -- inside a baseline row that also
   carries the task title, a long localized date can push past the 358px
   phone budget (390 minus .chq-main's 16px gutter each side). Three-
   property escape, not removal, per DEC-919. .chq-field-counter (also
   declared above) gets no CSS change here: overflow-exempt, same
   rationale as src/routes/public/cfp.css.ts's own wave-90 note -- a
   counter truncated states a wrong count, and its printed total is sample
   data that does not bind (DEC-650 wave-82 amendment). See
   decisions/DEC-367.md's wave-90 amendment for the general rule. Appended
   at the true end of this module, after every top-level rule and after
   both existing phone blocks above (never edited/reordered), per DEC-385
   single-direction responsive. */
@media (max-width: 700px) {

    /* G13: the hero returns to the phone page-title token below 700px
       (mobile geometry parked; this preserves the pre-G13 phone size).
       w3-a (docs/design/Chautauqua Public and Portal.dc.html): the three
       390 frames this task owns -- "Speaker portal" (:414-467), "Portal ·
       Your tasks" (:476-496), "Portal · Your profile" (:531-554) -- all
       three draw the SAME 25px H1 register: :420 "Two things to do" reads
       'font-size:25px; font-weight:700; letter-spacing:-0.04em;
       line-height:1.05', :479 "Your tasks" and :534 "Your profile" are
       byte-identical. The portal has no cluster-landing/drill split the
       way Home does -- there is no nav to land on, every /portal/* page
       sits one level below the single magic-link entry point -- so the
       already-tokenised drill register (--chq-type-page-title-phone-drill,
       DEC-643 amendment) applies uniformly across the family rather than
       being conditioned on whether a back link precedes the H1. Flagged in
       docs/design/audit/portal-v12.md: the delegating task's own prose
       described the landing frame as the 27px register, which the frame's
       bytes contradict -- the frame is the authority. */
    .chq-portal-hero { font-size: var(--chq-type-page-title-phone-drill); }
    /* :415 'border-bottom:1px solid #1B1D17; padding:14px 16px;
       flex-shrink:0' -- head band padding, byte-identical across all three
       frames (:415 / :477 / :532). flex-shrink:0 is already the unmediated
       '.chq-portal-shell > .chq-header' rule a few lines below; only the
       padding is new here. */
    .chq-portal-shell > .chq-header { padding: 14px 16px; }
    /* :424 'flex:1; min-height:0; overflow-y:auto; padding:16px' on the
       landing frame's body vs :481 'flex:1; min-height:0; overflow-y:auto;
       padding:14px 16px 16px' on the drill frames' (:481 "Your tasks",
       :510 "Hotel stay form", :536 "Your profile" all agree) -- the drill
       frames give the body 2px less top padding than its sides/bottom,
       since the head above it already carries the back-link row. Scoped
       by the presence of .chq-portal-back (only a drill page renders
       PortalBackLink, per shared.tsx) rather than a second body class, so
       no markup change is needed on either page family. */
    /* v9-f (DEC-976 wave-91): 'form body is the phone shell's own scroll
       region' -- docs/design/Chautauqua Public and Portal.dc.html:510
       \`flex:1; min-height:0; overflow-y:auto; padding:14px 16px 16px\`
       for the drill body and :1561 draws the
       matching landing-body geometry; this single rule (DEC-253's
       min-width:0/width:100%/max-width:100% flex-item-overflow fix folded
       in below, since both used to target this same selector from two
       separate rules in this now-merged block) carries the frame's own
       padding together with the flex/min-height/overflow-y scroll-region
       properties so a single match() against this selector sees all of
       them at once. */
    .chq-portal-shell > .chq-measure {
      flex: 1;
      min-height: 0;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      padding: 16px;
      overflow-y: auto;
    }
    .chq-portal-shell:has(.chq-portal-back) > .chq-measure { padding: 14px 16px 16px; }
    /* DEC-367 amendment (wave 57): the >=44px tap floor is phone-only
       (docs/design/README.md:92) -- these six boxes used to be
       unconditional base rules above; moved here verbatim, no other
       property added. :478/:533's back link min-height:44px matches this
       rule exactly. */
    .chq-portal-back { min-height: 44px; }
    .chq-portal-footer-resources { min-height: 44px; }
    .chq-portal-footer-profile { min-height: 44px; }
    .chq-portal-actions .chq-btn { min-height: 44px; }
    .chq-portal-signout-btn { min-height: 44px; }
    .chq-portal-copresenter-submit .chq-btn { min-height: 44px; }
    .chq-portal-row-head { align-items: flex-start; }
    /* DEC-989 ruling B6's right-flush on .chq-portal-actions (base rule
       above) is a desktop-only affordance: at phone width the buttons go
       full-width in a column, so the flush is reset back to start here.
       DEC-385 keeps this codebase single-direction -- narrow overrides
       wide via max-width only -- so the desktop rendition lives in the
       base rule and this block is the only override. */
    .chq-portal-actions { flex-direction: column; justify-content: flex-start; }
    .chq-portal-actions .chq-btn { width: 100%; }

    /* w13-e: portal frame is the phone app shell -- header/main/footer
       become a fixed three-region column so .chq-measure is the only
       scroll surface (docs/design "Chautauqua Public and Portal.dc.html"
       lines 414-467 / 563-591). No top-level rule for .chq-portal-shell
       itself -- desktop stays exactly as it was. */
    .chq-portal-shell {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }
    .chq-portal-shell > .chq-header { flex-shrink: 0; }
    .chq-portal-shell > .chq-portal-footer {
      flex-shrink: 0;
      border-top: 1px solid var(--chq-ink);
      background: var(--chq-surface-sunk);
      padding: 12px 16px 16px;
    }
    /* Descendant containers that can otherwise impose an intrinsic width
       past the now-capped .chq-measure column -- rows/fields never need a
       min-content floor wider than the phone viewport, and a table or
       pre/code block gets its own scroll container instead of the page. */
    .chq-portal-row,
    .chq-portal-row-head,
    .chq-portal-field,
    .chq-field,
    table,
    pre,
    code {
      min-width: 0;
    }
    table {
      display: block;
      max-width: 100%;
      overflow-x: auto;
    }
    pre {
      max-width: 100%;
      overflow-x: auto;
    }

    .chq-portal-footer-band {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .chq-portal-footer-band > *:last-child { margin-left: auto; }

    /* v12 phone (w3-b): a back-linked portal DRILL H1 takes the 25px drill
       register, not the 27px cluster-landing size -- scoped to a dedicated
       modifier applied only on TaskFormPage/EditPage; /portal's own
       dashboard H1 keeps the 27px base rule. */
    .chq-portal-hero-drill { font-size: var(--chq-type-page-title-phone-drill); }

    /* v12 phone (w3-b): at 390 the desktop two-up co-presenter field pair
       reduces to plain single-column full-measure fields. The name pair
       already reaches this by construction (both flex:1); only the role
       select needs the explicit override, since its flex:0 1 190 /
       min-width:140 base rule keeps it narrow even once it wraps. */
    .chq-portal-copresenter-role {
      flex: 1 1 100%;
      min-width: 0;
    }

    /* v12 phone (w3-b): the edit-session footer's button row keeps a
       side-by-side row at 390 with the primary first. Scoped to the
       edit-session footer only (page-local combinator). DEC-385: this is a
       max-width-only VISUAL reorder (flex order) -- the DOM keeps the
       desktop-ruled Cancel-then-Save sequence, so desktop stays frozen.
       The footer note's own default order (0) already follows the button
       row's order:-1. */
    .chq-portal-actions-footer .chq-portal-actions {
      flex-direction: row;
      justify-content: flex-start;
      order: -1;
    }
    .chq-portal-actions-footer .chq-portal-actions .chq-btn {
      width: auto;
    }
    .chq-portal-actions-footer .chq-btn-primary {
      flex: 1;
      order: -1;
    }
  
  /* Resources (dc.html:1564): a back-linked drill page (DEC-643 amendment
     -- 25px --chq-type-page-title-phone-drill, not the 27px cluster-
     landing token the shared .chq-portal-hero phone rule near :447
     carries for every /portal/* H1 today). A page-specific modifier
     rather than editing that shared rule, which two other branches are
     mid-rewriting; the cascade already puts this block after it. */
  .chq-portal-resources-hero { font-size: var(--chq-type-page-title-phone-drill); }

  /* Resources (dc.html:1565): the subtitle line under the H1. */
  .chq-portal-resources-footer-note,
  .chq-portal-sub { font-size: 13px; color: var(--chq-muted); line-height: 1.5; }

  /* Resources (dc.html:1570/1575): each row goes horizontal -- title (+
     wiki detail, when present) on the left, the Open control right-hand
     and never shrinking under the 44px floor. */
  .chq-portal-resource-row {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 15px 0;
  }
  .chq-portal-resource-row .chq-portal-row-title { flex: 1; min-width: 0; }
  .chq-portal-resource-row .chq-portal-actions { padding-top: 0; flex-shrink: 0; }
  .chq-portal-resource-row .chq-portal-actions .chq-btn {
    min-height: 44px;
    width: auto;
    padding: 0 14px;
    background: var(--chq-surface-sunk);
    font-size: 13px;
    font-weight: 600;
  }

  /* Resources (dc.html:1580): the docked footer note, carried through
     PortalLayout's existing footerExtra slot -- .chq-portal-footer is
     already the docked border-top/background region (phone block near
     :444), this only styles the note's own type inside it. */
  .chq-portal-resources-footer-note { display: block; }

  /* Co-presenter rejected (dc.html:1312): the "Nobody was added" callout
     -- a modifier alongside the frozen desktop .chq-error-summary class,
     never redefining that shared class itself. */
  .chq-portal-copresenter-notice {
    border-left: 4px solid var(--chq-ink);
    border-radius: 5px;
    background: var(--chq-surface-sunk);
    padding: 14px 16px;
    gap: 5px;
  }
  .chq-portal-copresenter-notice h2 { font-size: 14px; font-weight: 700; margin: 0; }
  .chq-portal-copresenter-notice p { font-size: 13px; line-height: 1.55; color: var(--chq-ink-2); }

  /* Co-presenter rejected (dc.html:1348): the flagged email field carries
     its own left rule, on top of the shared .chq-input the field keeps at
     every width. */
  .chq-portal-copresenter-email-flagged { border-left: 3px solid var(--chq-ink); }

  /* Co-presenter rejected (dc.html:1335): first/last name go two-up on a
     grid at 390 -- the wide rendition keeps its own flex-wrap technique
     above, this is the phone-only override. */
  .chq-portal-copresenter-names {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .chq-portal-copresenter-names .chq-input,
  .chq-portal-copresenter-email-role .chq-input,
  .chq-portal-copresenter-role select {
    min-height: 48px;
  }
  .chq-portal-done-when {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  /* DEC-576/DEC-154 (wave-110 amendments): docs/design/Chautauqua Public
     and Portal.dc.html:492-495 \`display:flex; gap:8px\` ("Your tasks")
     and :586-589 ("Your
     session") -- the dock's own children only; the band's border-top/
     background/padding is already the .chq-portal-shell > .chq-portal-footer
     rule above (:789-794), unchanged. */
  .chq-portal-dock {
    display: flex;
    gap: 8px;
  }
  .chq-portal-dock .chq-btn-primary {
    flex: 1;
    min-height: 48px;
  }
  .chq-portal-dock .chq-btn-secondary {
    min-height: 48px;
  }
  /* DEC-154: the header identity cluster (:199 shared.tsx) already carries
     Sign out at 390 -- the footer's copy is the duplicate DEC-154 names,
     stood down here only; desktop (where the dock does not draw) keeps
     both exactly as before. */
  .chq-portal-shell > .chq-portal-footer .chq-portal-signout {
    display: none;
  }
}
`;
