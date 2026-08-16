// DEC-582: GET / (the anonymous event hub) is styled from the public CSS
// family, not TOOLS_CSS -- revising DEC-382 for / only. Same shape/inlining
// convention as cfp.css.ts: tokens live only in THEME_CSS (src/views/
// theme.ts), this file only adds .chq-home-* layout on top of it. Plain .ts
// (no JSX), pure Web-safe CSS text: no node:/cloudflare import (DEC-002).
//
// DEC-374: value-free module constant, injected verbatim via
// dangerouslySetInnerHTML by root.tsx's hub renderer -- never interpolated
// with request/user data here.

import { DEC_373, DEC_374, DEC_582 } from "../../decisions";

void DEC_373;
void DEC_374;
void DEC_582;

// DEC-582 (wave-81 amendment): the hub's measure is read from the vendored
// Home frame (docs/design/Chautauqua Home.dc.html), not from the README's
// §Widths table, which does not list the hub. Header (:33) and footer (:101)
// are full-bleed chrome, `padding:15px|18px 44px` on the FULL frame width --
// no max-width, 44px gutters running edge to edge. The body (:38) is an 820
// CONTAINER, `max-width:820px; margin:0 auto; padding:36px 44px 40px`; its
// CONTENT box is therefore 820 - 2x44 = 732, centred, not the fleet's shared
// 34px-minimum expression (which has no source in the frame).
const HOME_CHROME_GUTTER = "padding-inline: 44px;";
// Gate-12 group1: width:100% is load-bearing — .chq-home-shell is a column
// flex parent, and without it the body shrink-wraps to its content (measured
// 646px/content 558) instead of filling to the 820 clamp (content 732 after
// the 44px pads, matching the frames' padded content box).
const HOME_BODY_MEASURE = "max-width: 820px; width: 100%; margin-inline: auto; padding-inline: 44px;";

export const HOME_CSS = `
  .chq-home-shell { display: flex; flex-direction: column; }
  .chq-home-header { border-bottom: 1px solid var(--chq-ink); padding-block: 15px; ${HOME_CHROME_GUTTER} display: flex; align-items: center; gap: 20px; }
  .chq-home-org { font-family: var(--chq-font-display); font-size: 20px; font-weight: 700; letter-spacing: -0.03em; }
  .chq-home-signin { margin-left: auto; font-size: 13px; font-weight: 700; text-decoration: none; }

  .chq-home-body { padding-block: 36px 40px; ${HOME_BODY_MEASURE} display: flex; flex-direction: column; gap: 34px; }
  .chq-home-hero { display: flex; flex-direction: column; gap: 10px; }
  .chq-home-hero h1 { margin: 0; font-family: var(--chq-font-display); font-size: 44px; font-weight: 700; letter-spacing: -0.042em; line-height: 1.2; }
  .chq-home-hero p { margin: 0; font-size: 16px; line-height: 1.65; color: var(--chq-ink-2); max-width: 54ch; }
  .chq-home-cap-note { font-size: 13px; color: var(--chq-muted); }

  .chq-home-section-head { border-bottom: 2px solid var(--chq-ink); padding-bottom: 8px; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .chq-home-section-label { font-family: var(--chq-font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .chq-home-section-caption { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--chq-muted); }

  .chq-home-row { display: grid; grid-template-columns: 158px 1fr auto; gap: 24px; align-items: center; padding: 20px 0; border-bottom: 1px solid var(--chq-hairline); }
  .chq-home-when { display: flex; flex-direction: column; gap: 3px; }
  .chq-home-dates { font-family: var(--chq-font-display); font-size: 15px; font-weight: 700; }
  .chq-home-venue { font-size: 12px; color: var(--chq-muted); line-height: 1.4; }
  .chq-home-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .chq-home-name { font-family: var(--chq-font-display); font-size: 24px; font-weight: 600; letter-spacing: -0.028em; line-height: 1.2; color: var(--chq-ink); text-decoration: none; }
  .chq-home-state { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .chq-home-meta { font-size: 13px; color: var(--chq-muted); }
  .chq-home-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  /* DEC-383 (wave-8 amendment, sha efb77e4a): B8 motion contract extended to
     the hub's action family -- same property-scoped transition as theme.ts's
     button/.chq-btn family (:357), same tokens, never \`transition: all\`. */
  .chq-home-action-primary,
  .chq-home-action-secondary,
  .chq-home-action-quiet {
    transition: background-color var(--chq-motion-color) var(--chq-ease-state),
      border-color var(--chq-motion-color) var(--chq-ease-state),
      color var(--chq-motion-color) var(--chq-ease-state);
  }
  .chq-home-action-primary { background: var(--chq-brand); color: var(--chq-on-brand); border-radius: var(--chq-r-ctl); min-height: 48px; display: flex; align-items: center; padding: 0 20px; font-size: 15px; font-weight: 700; white-space: nowrap; text-decoration: none; }
  /* DEC-383 (wave-66 amendment): anchor-qualified so it beats theme.ts's
     a:not(.chq-btn):hover (0,2,1 > 0,2,0) -- the hover darkens the FILL to
     --chq-brand-hover, the label stays --chq-on-brand, matching .chq-btn-primary's
     own hover tier without adopting its geometry. */
  a.chq-home-action-primary:hover { background: var(--chq-brand-hover); color: var(--chq-on-brand); }
  .chq-home-action-secondary { border: 1px solid var(--chq-border-strong); border-radius: var(--chq-r-ctl); background: var(--chq-surface-sunk); min-height: 46px; display: flex; align-items: center; padding: 0 18px; font-size: 14px; font-weight: 600; color: var(--chq-ink-strong); white-space: nowrap; text-decoration: none; }
  .chq-home-action-quiet { font-size: 13px; font-weight: 700; white-space: nowrap; display: flex; align-items: center; }

  /* DEC-383 (wave-8 amendment, sha efb77e4a): reduced-motion override lives
     in this SAME region so the transition and its 0ms override can never
     separate -- theme.ts rebinds --chq-motion-color globally, but HOME_CSS
     is a distinct stylesheet and must not rely on THEME_CSS's media query
     firing for it. */
  @media (prefers-reduced-motion: reduce) {
    .chq-home-action-primary,
    .chq-home-action-secondary,
    .chq-home-action-quiet {
      transition-duration: 0ms;
    }
  }

  /* DEC-582 (wave-11 amendment): the frame's "API docs ›" tertiary anchor
     next to the fresh-deploy Sign in (:284-287 desktop, :313-314 phone) --
     44px is the frame's OWN minimum across both breakpoints (46px desktop,
     44px phone), so this rule pins the floor rather than either sample.
     Kept OUT of the .chq-home-action-primary/-secondary/-quiet motion
     family above -- that trio's selector list is pinned exactly by
     test/public-home-motion.test.ts, and a bare colour hover here needs no
     transition contract of its own. */
  .chq-home-action-tertiary { font-size: 14px; font-weight: 700; padding: 0 8px; min-height: 44px; display: flex; align-items: center; white-space: nowrap; color: var(--chq-ink-strong); text-decoration: none; }
  a.chq-home-action-tertiary:hover { color: var(--chq-brand); }

  .chq-home-row-published { padding: 18px 0; }
  .chq-home-row-published .chq-home-name { font-size: 21px; letter-spacing: -0.025em; line-height: 1.25; }
  .chq-home-row-published .chq-home-info { gap: 5px; }

  .chq-home-archive-row { display: grid; grid-template-columns: 158px 1fr auto; gap: 24px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid var(--chq-hairline); }
  .chq-home-archive-dates { font-size: 13px; color: var(--chq-muted); }
  .chq-home-archive-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .chq-home-archive-name { font-family: var(--chq-font-display); font-size: 17px; font-weight: 600; letter-spacing: -0.02em; color: var(--chq-ink); text-decoration: none; }

  .chq-home-signin-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

  .chq-home-footer { border-top: 1px solid var(--chq-rule); background: var(--chq-surface-sunk); padding-block: 18px; ${HOME_CHROME_GUTTER} display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .chq-home-footer-text { font-size: 12px; color: var(--chq-muted); line-height: 1.5; }
  /* Inline flow, not inline-flex: a flex link takes its baseline from the
     SVG's bottom edge, floating the whole "mark + name" above the sentence's
     baseline. In inline flow the mark's vertical-align nudge works. */
  .chq-home-footer-link { font-weight: 700; color: var(--chq-brand); white-space: nowrap; text-decoration: none; }
  .chq-home-footer-link-end { margin-left: auto; font-size: 12px; }
  .chq-home-github-mark { vertical-align: -2px; margin-right: 5px; }

  @media (max-width: 700px) {
    .chq-home-header { padding-block: 14px; padding-inline: 16px; }
    .chq-home-body { padding-block: 20px; padding-inline: 16px; gap: 24px; }
    .chq-home-hero h1 { font-size: 30px; }
    .chq-home-footer { padding-block: 12px 16px; padding-inline: 16px; }

    .chq-home-row {
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 16px 0;
    }
    .chq-home-name { font-size: 20px; }
    .chq-home-actions { align-items: stretch; width: 100%; }
    .chq-home-action-primary,
    .chq-home-action-secondary {
      width: 100%;
      justify-content: center;
      margin-top: 2px;
    }

    .chq-home-archive-row {
      grid-template-columns: 1fr auto;
      gap: 4px 12px;
      padding: 14px 0;
      align-items: center;
    }
    .chq-home-archive-dates { grid-column: 1 / -1; order: -1; }
  }
`;
