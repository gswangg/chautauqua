// DEC-382: the three operator surfaces -- GET / (landing), GET /docs/api,
// and the dev mailbox (list + detail) -- are chrome, not designed screens.
// They share one TOOLS_CSS module and the same shell pattern (a 1px-ink
// .chq-header with the lowercase .chq-wordmark, <main class="chq-measure">,
// a .chq-section-label over its 2px rule per section, .chq-table for
// tabular data, .chq-kv for key/value blocks, .chq-pager for prev/next,
// .chq-btn tiers for actions) rather than each page inventing its own
// layout. This file only adds the handful of `.chq-tool-*` classes that
// pattern needs and THEME_CSS doesn't already define (.chq-header,
// .chq-wordmark, .chq-measure, .chq-section, .chq-section-label,
// .chq-table, .chq-kv, .chq-pager, .chq-btn/-primary/-secondary/-tertiary
// all live in src/views/theme.ts already -- DEC-373 forbids redefining
// them here). Tokens live only in THEME_CSS (DEC-367/373) -- this file
// composes var(--chq-*) references, never restates a hex value.
//
// Pure Web-safe CSS text: no node:/cloudflare import (DEC-002).
//
// DEC-374 escaping trap: this string is injected via <style
// dangerouslySetInnerHTML={{ __html: TOOLS_CSS }} />, exactly like
// ThemeStyles() below (see src/views/theme.ts) -- never as a hono/jsx text
// child, which HTML-escapes & < > " ' and would corrupt quoted values.
// TOOLS_CSS must stay a fixed, value-free module constant, never
// interpolated with request/user data.

import { jsx } from "hono/jsx";
import { DEC_367, DEC_373, DEC_374, DEC_382 } from "../decisions";

void DEC_367;
void DEC_373;
void DEC_374;
void DEC_382;

export const TOOLS_CSS = `
  .chq-tool-links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .chq-tool-meta {
    font-size: 13px;
    color: var(--chq-muted);
  }

  .chq-tool-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .chq-tool-pre {
    background: var(--chq-surface-sunk);
    border: 1px solid var(--chq-rule);
    border-radius: 4px;
    padding: 0.75rem;
    overflow-x: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 13px;
  }

  .chq-tool-code {
    background: var(--chq-surface-sunk);
    border-radius: 3px;
    padding: 0.1rem 0.35rem;
    font-size: 0.92em;
    overflow-wrap: anywhere;
  }

  .chq-tool-iframe {
    display: block;
    width: 100%;
    min-height: 420px;
    border: 1px solid var(--chq-rule);
    border-radius: 4px;
    background: var(--chq-surface);
  }
`;

/** Inlines TOOLS_CSS into a <style> element, the same way ThemeStyles()
 * inlines THEME_CSS (src/views/theme.ts) -- see that file's header for why
 * dangerouslySetInnerHTML is required here instead of a JSX text child. */
// `any` return type mirrors ThemeStyles(): see src/views/theme.ts for why.
export function ToolsStyles(): any {
  return jsx("style", { dangerouslySetInnerHTML: { __html: TOOLS_CSS } });
}
