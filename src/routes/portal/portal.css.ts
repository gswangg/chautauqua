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
  main { max-width: 960px; margin: 0 auto; padding: 0 1rem; }
  /* DEC-393: the bare "nav a" rule that duplicated the old sub-floor
     min-height here is gone -- the portal nav markup
     (src/routes/portal/index.tsx) is nav.chq-nav > a, so THEME_CSS's
     more specific ".chq-nav a" rule (min-height: 44px) already covers
     it; duplicating it here at the old, now-stale floor would have been
     dead weight at best and a regression trap at worst. */
  /* DEC-253: wide data tables (My Submissions/Tasks) scroll inside their
     own container on a phone viewport rather than blowing out page-level
     width. */
  .chq-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
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
    line-height: 1.05;
    margin: 8px 0 4px;
  }
  .chq-portal-sub {
    font-size: 13px;
    color: var(--chq-muted);
    line-height: 1.5;
  }

  /* Task/session row: title + due date + a .chq-flag state marker, action
     control(s) below. Every control stays >=44px tall down to 390px
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

  @media (max-width: 700px) {
    .chq-portal-row-head { align-items: flex-start; }
    .chq-portal-actions { flex-direction: column; }
    .chq-portal-actions .chq-btn { width: 100%; }
  }
`;
