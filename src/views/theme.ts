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
// hono/jsx escaping trap (see src/routes/public/shell.tsx:65-72): a
// hono/jsx <style>{THEME_CSS}</style> child gets THEME_CSS HTML-escaped
// like any other text node — a double-quoted attribute selector
// (input[type="search"]) round-trips as the literal, invalid-CSS text
// input[type=&quot;search&quot;]. Every attribute selector in this file is
// therefore written unquoted (input[type=search]).

import { jsx } from "hono/jsx";
import { DEC_367, DEC_371 } from "../decisions";

void DEC_367;
void DEC_371;

export const THEME_CSS = `
  :root {
    --chq-paper: #F4F1E8;
    --chq-surface: #FAF8F2;
    --chq-surface-sunk: #EFEBDF;
    --chq-ink: #1B1D17;
    --chq-ink-secondary: #3F4237;
    --chq-muted: #565A4B;
    --chq-disabled: #8E8A7A;
    --chq-hairline: #E1DDCE;
    --chq-rule: #D3CFC0;
    --chq-border: #BAB6A6;
    --chq-border-strong: #CFC7B7;
    --chq-brand: #4E5C31;
    --chq-brand-hover: #3C471F;
    --chq-on-brand: #F7F9F0;
    --chq-brandable-accent: #4E5C31;
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
  html, body { max-width: 100%; overflow-x: hidden; }
  body {
    margin: 0;
    font-family: 'Figtree', system-ui, sans-serif;
    color: var(--chq-ink-secondary);
    background: var(--chq-paper);
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    color: var(--chq-ink);
    margin: 0;
  }
  img { max-width: 100%; height: auto; }
  a { color: var(--chq-brand); }
  a:hover { color: var(--chq-brand-hover); }

  /* Every interactive element is >=44px tall on phone (min-height, not
     padding) -- DEC-367. Unquoted attribute selectors: see file header. */
  input[type=search], input[type=text], input[type=email], input[type=tel],
  input[type=url], input[type=password], select, textarea {
    max-width: 100%;
    box-sizing: border-box;
    min-height: 44px;
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
    min-height: 44px;
    font-size: 1rem;
    font-family: inherit;
    color: var(--chq-ink);
    background: var(--chq-surface);
    border: 1px solid var(--chq-border);
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
  }

  button, input[type=submit], .chq-btn {
    min-height: 44px;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    font-family: 'Figtree', system-ui, sans-serif;
    font-weight: 700;
    border-radius: 4px;
    cursor: pointer;
  }
  .chq-btn-primary, button[type=submit] {
    background: var(--chq-brand);
    color: var(--chq-on-brand);
    border: none;
  }
  .chq-btn-secondary {
    background: var(--chq-surface-sunk);
    color: #2E2A24;
    border: 1px solid var(--chq-border-strong);
    font-weight: 600;
  }
  .chq-btn-tertiary {
    background: transparent;
    color: var(--chq-brand);
    border: none;
    font-weight: 700;
    padding: 0.25rem 0;
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
    min-height: 40px;
    padding: 4px 0;
    color: var(--chq-ink-secondary);
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
  .chq-row {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding: 13px 0;
    border-bottom: 1px solid var(--chq-hairline);
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

  .chq-measure { max-width: 820px; margin: 0 auto; }

  main { padding: 26px 34px 34px; }
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
  return jsx("style", null, THEME_CSS);
}
