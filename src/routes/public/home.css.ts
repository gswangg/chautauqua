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
  /* Design pack v12 (the wordmark optical nudge) -- docs/design/Chautauqua
     Home.dc.html:34 \`font-family:'Familjen Grotesk', sans-serif;
     font-size:20px; font-weight:700; letter-spacing:-0.03em\` carries the
     org name in the wordmark's slot and the
     header is align-items:center, so the nudge rides this span. -2.5px is
     the ruling's value at 20px (-3px at 22px, -2px at 17px). Familjen
     Grotesk's asymmetric box drops the ink below the flex box's centre;
     the offset is line-height-invariant, so no line-height is set here. */
  .chq-home-org { font-family: var(--chq-font-display); font-size: 20px; font-weight: 700; letter-spacing: -0.03em; position: relative; top: -2.5px; }
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
     next to the fresh-deploy Sign in (:284-287 desktop, :313-314 phone).
     Kept OUT of the .chq-home-action-primary/-secondary/-quiet motion
     family above -- that trio's selector list is pinned exactly by
     test/public-home-motion.test.ts, and a bare colour hover here needs no
     transition contract of its own.
     The 44px tap floor is NOT declared here: DEC-367 (wave-57 amendment) puts
     it inside the 700px phone media block in every SSR CSS module -- desktop
     sizes from padding, like its bare-text sibling .chq-home-action-quiet.
     The phone floor is re-asserted in this module's phone block below.
     (That block's opening literal is deliberately NOT repeated in this
     comment: test/tier0-falsifiability-w46.test.ts locates the phone block
     with indexOf on it, so an earlier copy would redirect the scan.) */
  .chq-home-action-tertiary { font-size: 14px; font-weight: 700; padding: 0 8px; display: flex; align-items: center; white-space: nowrap; color: var(--chq-ink-strong); text-decoration: none; }
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
    /* Header band -- docs/design/Chautauqua Home.dc.html:117
       \`padding:14px 16px; flex-shrink:0; display:flex; align-items:center;
       gap:12px\`. border-bottom is already var(--chq-ink) at base scope
       (matches); gap narrows from the desktop 20px to the frame's 12px. */
    .chq-home-header { padding-block: 14px; padding-inline: 16px; gap: 12px; }
    /* :118 \`font-size:17px; font-weight:700; letter-spacing:-0.03em;
       line-height:1; position:relative; top:-2px\` -- weight/letter-spacing
       already match the base rule; only the size and the wordmark
       optical-nudge value (-2.5px at 20px desktop, -2px at 17px phone, per
       the ruling above) move. */
    .chq-home-org { font-size: 17px; top: -2px; }
    /* :119 \`margin-left:auto; font-size:13px; font-weight:700;
       min-height:44px; display:flex; align-items:center\` --
       margin-left:auto/font-size/font-weight already inherited from the base
       rule; the phone-only 44px floor needs centred flex PLUS horizontal
       padding (DESIGN-RULINGS "The 44px floor, and how it gets evaded" --
       the frame's own literal omits padding, but padding is still required
       so the hit box is not just as wide as the text). */
    .chq-home-signin { min-height: 44px; display: flex; align-items: center; padding: 0 4px; }

    /* Body -- :122 \`padding:20px 16px 20px; display:flex;
       flex-direction:column; gap:24px\`. */
    .chq-home-body { padding-block: 20px; padding-inline: 16px; gap: 24px; }
    /* :124 \`font-size:30px; font-weight:700; letter-spacing:-0.042em;
       line-height:1.05\` -- letter-spacing already matches the base rule;
       size and line-height (1.2 at desktop) both narrow here. */
    .chq-home-hero h1 { font-size: 30px; line-height: 1.05; }
    /* :125 \`margin:0; font-size:14px; line-height:1.6; color:#3F4237\` --
       desktop is 16px/1.65. */
    .chq-home-hero p { font-size: 14px; line-height: 1.6; }

    /* :130 \`font-size:11px; font-weight:700; letter-spacing:0.1em;
       text-transform:uppercase\` -- the section label's letter-spacing
       narrows from the desktop 0.12em to the frame's 0.1em;
       size/weight/uppercase already match the base rule. */
    .chq-home-section-label { letter-spacing: 0.1em; }

    .chq-home-row {
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 16px 0;
    }
    /* :135 \`font-size:13px; color:#565A4B; line-height:1.5\` -- both
       {{ e.dates }} and {{ e.venue }} share this one muted 13px treatment on
       phone. Desktop bolds the dates in the display face (:58 15px/700) and
       mutes the venue separately at 12px (:59); both narrow to the frame's
       shared 13px muted line here. They stay two stacked lines (not joined
       text) rather than growing an SSR-injected "·" separator, mirroring the
       archive-row phone pattern below. */
    .chq-home-when { gap: 2px; }
    .chq-home-dates { font-family: inherit; font-size: 13px; font-weight: 400; color: var(--chq-muted); }
    .chq-home-venue { font-size: 13px; }
    /* :134 \`font-size:20px; font-weight:600; letter-spacing:-0.025em;
       line-height:1.2\` -- the open-cfp row's name. */
    .chq-home-name { font-size: 20px; }
    /* The base-scope \`.chq-home-row-published .chq-home-name\` override
       (21px, line 114 above) outranks the bare .chq-home-name rule just
       above on specificity alone, so the published row's own name needs its
       own phone-scoped override to reach :148's
       \`font-size:18px; font-weight:600; letter-spacing:-0.022em;
       line-height:1.25\`. */
    .chq-home-row-published .chq-home-name { font-size: 18px; letter-spacing: -0.022em; line-height: 1.25; }
    .chq-home-actions { align-items: stretch; width: 100%; }
    .chq-home-action-primary,
    .chq-home-action-secondary {
      width: 100%;
      justify-content: center;
      margin-top: 2px;
    }
    /* :137 \`min-height:48px; display:flex; align-items:center;
       justify-content:center\` ("Submit a talk") -- 48px already matches
       the base rule; only the phone-only full-width treatment above is new.
       :150 \`border:1px solid #CFC7B7; border-radius:6px;
       background:#EFEBDF; min-height:44px\` ("Browse sessions") -- desktop
       is 46px; the phone frame's bordered action narrows to the 44px floor
       exactly. */
    .chq-home-action-secondary { min-height: 44px; }
    /* DEC-367 (wave-57 amendment): the tertiary anchor's tap floor is
       phone-only -- centred flex, not padding. DEC-582's "API docs ›". */
    .chq-home-action-tertiary { min-height: 44px; }
    /* :165 \`font-size:13px; font-weight:700; min-height:44px; display:flex;
       align-items:center; white-space:nowrap\` ("Sessions ›") --
       .chq-home-action-quiet is a bare desktop text link (no min-height,
       pinned by test/public-home-full-bleed.test.ts's base-scope
       assertion); the phone-only floor plus horizontal padding is added
       here, scoped to this block by DEC-367's own convention. */
    .chq-home-action-quiet { min-height: 44px; padding: 0 8px; flex-shrink: 0; }

    .chq-home-archive-row {
      grid-template-columns: 1fr auto;
      gap: 4px 12px;
      padding: 14px 0;
      align-items: center;
    }
    .chq-home-archive-dates { grid-column: 1 / -1; order: -1; }
    /* :162 \`font-size:16px; font-weight:600; letter-spacing:-0.02em\` --
       desktop is 17px. */
    .chq-home-archive-name { font-size: 16px; }
    /* :163 \`font-size:12px; color:#565A4B\` -- the shared .chq-home-meta
       class is 13px at base scope (used by every row family); the archive
       row's own meta line narrows to the frame's 12px here. */
    .chq-home-archive-row .chq-home-meta { font-size: 12px; }

    /* Footer band -- :171 \`border-top:1px solid #1B1D17; background:#EFEBDF;
       padding:12px 16px 16px; display:flex; align-items:center; gap:14px\`.
       #1B1D17 is --chq-ink; the base rule is var(--chq-rule) (#D3CFC0),
       matching the DESKTOP frame's own #D3CFC0 border-top (:101 \`border-top:
       1px solid #D3CFC0; background:#EFEBDF; padding:18px 44px\`) -- the two
       frames use different border tokens for this same element, so the
       stronger ink border is phone-only. */
    .chq-home-footer { border-top-color: var(--chq-ink); padding-block: 12px 16px; padding-inline: 16px; }
    /* :173 \`margin-left:auto; font-size:12px; font-weight:700;
       min-height:44px; display:flex; align-items:center\` ("API docs") --
       margin-left:auto (via .chq-home-footer-link-end) and font-size/weight
       already inherited; the 44px floor plus horizontal padding is new. */
    .chq-home-footer-link-end { min-height: 44px; display: flex; align-items: center; padding: 0 4px; }
  }
`;
