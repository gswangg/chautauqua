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

import { DEC_373, DEC_374, DEC_377 } from "../../decisions";

void DEC_373;
void DEC_374;
void DEC_377; // captions below only ever restate fields the portal repo already returns

export const PORTAL_CSS = `
  /* --- verbatim starting point (moved from PortalLayout's inline <style>) --- */
  main { padding: 0 1rem; }
  /* DEC-393: the bare "nav a" rule that duplicated the old sub-floor
     min-height here is gone -- the portal nav markup
     (src/routes/portal/index.tsx) is nav.chq-nav > a, so THEME_CSS's
     more specific ".chq-nav a" rule (min-height: 44px) already covers
     it; duplicating it here at the old, now-stale floor would have been
     dead weight at best and a regression trap at worst. */
  table { border-collapse: collapse; }

  /* --- new growth: .chq-portal-* --- */
  .chq-portal-back {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: 13px;
    font-weight: 700;
    color: var(--chq-ink-2);
    text-decoration: none;
  }
  .chq-portal-hero {
    font-size: 25px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.2;
    margin: 6px 0 2px;
  }
  .chq-portal-sub {
    font-size: 13px;
    color: var(--chq-muted);
    line-height: 1.5;
  }

  /* w15-b: signed-in speaker's name, right-aligned in the header row
     (docs/design "Speaker portal" mock) -- margin-left:auto pins it to the
     right within .chq-header's flex row without disturbing the wordmark. */
  .chq-portal-header-name {
    margin-left: auto;
    font-size: 12px;
    font-weight: 600;
    color: var(--chq-muted);
  }

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
  .chq-portal-footer-resources {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: 13px;
    font-weight: 600;
    color: var(--chq-ink-2);
    text-decoration: none;
  }
  .chq-portal-footer-profile {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
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

  .chq-portal-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 2px;
  }
  .chq-portal-actions .chq-btn { min-height: 44px; }

  /* Completion progress: composes the shared .chq-bar/.chq-bar-fill pair
     (THEME_CSS) under a small caption — never redefines them. */
  .chq-portal-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 10px 0 18px;
  }
  .chq-portal-progress-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--chq-muted);
  }

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
    max-width: var(--chq-measure);
    margin: 24px auto 0;
    padding: 16px 1rem 40px;
    border-top: 1px solid var(--chq-hairline);
  }
  .chq-portal-signout-btn { min-height: 44px; }

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
  .chq-field-error { font-size: 12px; font-weight: 800; margin: 0; }
  .chq-field-error::before { content: "! "; }

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

  @media (max-width: 700px) {
    .chq-portal-row-head { align-items: flex-start; }
    .chq-portal-actions { flex-direction: column; }
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
    .chq-portal-shell > .chq-measure {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
    .chq-portal-shell > .chq-portal-footer {
      flex-shrink: 0;
      border-top: 1px solid var(--chq-ink);
      background: var(--chq-surface-sunk);
      padding: 12px 16px 16px;
    }

    .chq-portal-footer-band {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .chq-portal-footer-band > *:last-child { margin-left: auto; }
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
`;
