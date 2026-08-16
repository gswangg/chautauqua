// DEC-382 (wave-3 amendment): /docs is a NEW designed public surface with
// its own chrome — never TOOLS_CSS (that stays reserved for /docs/api and
// /dev/mailbox chrome per the base DEC-382 decision) and never the admin
// SPA sheet. Same idiom as src/routes/public/home.css.ts: tokens live only
// in THEME_CSS (src/views/theme.ts, DEC-373), this module only adds
// .chq-docs-* layout on top of it, and it is rendered as a component
// (DocsSiteStyles(), mirroring tools.css.ts's ToolsStyles()) so callers
// write <ThemeStyles /><DocsSiteStyles /> the same way the operator shells
// write <ThemeStyles /><ToolsStyles />.
//
// Plain .ts (no JSX at the module level — the exported component below
// builds its <style> node via hono/jsx's jsx() the same way ToolsStyles()
// does), pure Web-safe CSS text: no node:/cloudflare import (DEC-002).
//
// DEC-374 escaping trap: DOCS_SITE_CSS is injected via <style
// dangerouslySetInnerHTML={{ __html: DOCS_SITE_CSS }} />, never as a
// hono/jsx text child (which HTML-escapes & < > " '). It must stay a
// fixed, value-free module constant, never interpolated with
// request/user data.
//
// Measures (DESIGN-RULINGS.md:298-316 / "Chautauqua Docs.dc.html"): prose
// stays at the readable 680px column; a figure is the ONE sanctioned
// measure break in the whole bundle and runs to 900px. On phone
// (<=700px) figures go edge-to-edge (no side gutter) with the caption
// inset back to the page's own padding, so the screenshot reads full-bleed
// while its caption stays legible prose.

import { jsx } from "hono/jsx";
import { DEC_373, DEC_374, DEC_382 } from "../decisions";

void DEC_373;
void DEC_374;
void DEC_382;

export const DOCS_SITE_CSS = `
  .chq-docs-shell { display: flex; flex-direction: column; }

  .chq-docs-header { border-bottom: 1px solid var(--chq-ink); padding-block: 15px; padding-inline: 34px; display: flex; align-items: center; gap: 14px; }
  .chq-docs-brandrow { display: flex; align-items: baseline; gap: 10px; }
  .chq-docs-wordmark { font-family: var(--chq-font-display); font-size: 22px; font-weight: 700; letter-spacing: -0.03em; text-decoration: none; color: var(--chq-ink); }
  .chq-docs-suffix { font-size: 13px; font-weight: 600; color: var(--chq-muted); }
  .chq-docs-leaving {
    margin-left: auto;
    font-size: 13px;
    font-weight: 700;
    color: var(--chq-muted);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .chq-docs-leaving-mark { color: var(--chq-muted); }

  .chq-docs-body { max-width: 1000px; margin-inline: auto; padding: 40px 34px 56px; display: flex; flex-direction: column; gap: 32px; }

  .chq-docs-intro { max-width: 640px; display: flex; flex-direction: column; gap: 11px; }
  .chq-docs-intro h1 { margin: 0; font-family: var(--chq-font-display); font-size: 40px; font-weight: 700; letter-spacing: -0.042em; line-height: 1.05; }
  .chq-docs-intro p { margin: 0; font-size: 17px; line-height: 1.65; color: var(--chq-ink-2); }

  .chq-docs-group-head { border-bottom: 2px solid var(--chq-ink); padding-bottom: 8px; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .chq-docs-group-label { font-family: var(--chq-font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .chq-docs-group-blurb { font-size: 13px; color: var(--chq-muted); }

  .chq-docs-article-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 34px; }
  .chq-docs-article-row { display: flex; flex-direction: column; gap: 3px; padding: 14px 0; border-bottom: 1px solid var(--chq-hairline); }
  .chq-docs-article-title { font-family: var(--chq-font-display); font-size: 17px; font-weight: 600; letter-spacing: -0.015em; color: var(--chq-ink); text-decoration: none; }
  .chq-docs-article-blurb { font-size: 14px; line-height: 1.55; color: var(--chq-muted); }

  /* Article page */
  .chq-docs-article-body { max-width: 1000px; margin-inline: auto; padding: 34px 34px 48px; display: flex; flex-direction: column; gap: 26px; }
  .chq-docs-article-head { max-width: 680px; display: flex; flex-direction: column; gap: 10px; }
  .chq-docs-article-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--chq-muted); }
  .chq-docs-article-head h1 { margin: 0; font-family: var(--chq-font-display); font-size: 38px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.08; }
  .chq-docs-article-head p { margin: 0; font-size: 17px; line-height: 1.65; color: var(--chq-ink-2); }

  .chq-docs-prose { max-width: 680px; font-size: 16px; line-height: 1.7; color: var(--chq-ink-2); }
  .chq-docs-h2 { max-width: 680px; margin: 0; font-family: var(--chq-font-display); font-size: 24px; font-weight: 700; letter-spacing: -0.03em; padding-top: 6px; }
  .chq-docs-list { max-width: 680px; margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 9px; font-size: 16px; line-height: 1.65; color: var(--chq-ink-2); }

  .chq-docs-figure { margin: 0; width: 900px; max-width: 900px; display: flex; flex-direction: column; gap: 10px; }
  .chq-docs-figure-frame {
    border: 1px solid var(--chq-rule);
    border-radius: 6px;
    background: var(--chq-surface-sunk);
    aspect-ratio: 16 / 9;
    display: grid;
    place-items: center;
  }
  .chq-docs-figure-placeholder { font-family: ui-monospace, monospace; font-size: 12px; color: var(--chq-muted); padding: 0 16px; text-align: center; }
  .chq-docs-figure-caption { font-size: 13px; color: var(--chq-muted); line-height: 1.55; }

  .chq-docs-empty { max-width: 680px; }

  @media (max-width: 700px) {
    .chq-docs-header { padding-inline: 16px; }
    .chq-docs-body { padding: 24px 16px 40px; gap: 24px; }
    .chq-docs-intro h1 { font-size: 30px; }
    .chq-docs-article-grid { grid-template-columns: 1fr; }
    .chq-docs-article-body { padding: 24px 16px 40px; }
    .chq-docs-article-head h1 { font-size: 28px; }

    /* The one sanctioned measure break itself breaks further on phone:
       edge to edge (no side gutter) with the caption inset back to the
       page's own 16px padding. */
    .chq-docs-figure {
      width: 100vw;
      max-width: 100vw;
      margin-inline: -16px;
    }
    .chq-docs-figure-frame { border-left: none; border-right: none; border-radius: 0; }
    .chq-docs-figure-caption { padding-inline: 16px; }
  }
`;

/** Inlines DOCS_SITE_CSS into a <style> element, the same way ToolsStyles()
 * inlines TOOLS_CSS (src/routes/tools.css.ts) -- see that file's header for
 * why dangerouslySetInnerHTML is required here instead of a JSX text child. */
// `any` return type mirrors ToolsStyles()/ThemeStyles(): see src/views/theme.ts.
export function DocsSiteStyles(): any {
  return jsx("style", { dangerouslySetInnerHTML: { __html: DOCS_SITE_CSS } });
}
