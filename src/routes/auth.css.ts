// DEC-373: one co-located CSS-string module for the auth surface family
// (login, claim, change-password, admin not-found are all SSR-rendered
// from src/routes/auth.tsx and src/routes/account.tsx). Tokens live only
// in THEME_CSS (src/views/theme.ts) -- this file adds the paper-card
// layout from docs/design/Chautauqua Account.dc.html ("One door, three
// roles" + the 390 mobile frame) that no other SSR surface needs.
//
// Pure Web-safe CSS text: no node:/cloudflare import (DEC-002).
//
// DEC-374 escaping trap: this string is injected via <style
// dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />, never as a hono/jsx
// text child -- a text child HTML-escapes & < > " ', which would corrupt
// any quoted font-family name or url(). AUTH_CSS must stay a fixed,
// value-free module constant, never interpolated with request/user data.

import { DEC_367, DEC_373, DEC_374 } from "../decisions";

void DEC_367;
void DEC_373;
void DEC_374;

export const AUTH_CSS = `
  body { display: flex; justify-content: center; padding: 40px 20px; }

  .chq-auth-card {
    width: 100%;
    max-width: 660px;
    background: var(--chq-paper);
    border: 1px solid var(--chq-rule);
    border-radius: 6px;
    padding: 44px 44px 40px;
    display: flex;
    flex-direction: column;
    gap: 26px;
  }
  .chq-auth-card.chq-auth-card-narrow { max-width: 520px; }

  .chq-auth-wordmark {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--chq-ink);
  }
  .chq-auth-title {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    font-size: 36px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.05;
    color: var(--chq-ink);
  }
  .chq-auth-subtitle { font-size: 14px; color: var(--chq-muted); margin-top: 6px; }
  .chq-auth-back { font-size: 13px; font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; text-decoration: underline; }

  .chq-auth-fields { display: flex; flex-direction: column; gap: 14px; }
  .chq-auth-label {
    display: block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--chq-muted);
    margin-bottom: 6px;
  }
  .chq-auth-card input[type=email],
  .chq-auth-card input[type=password] {
    display: block;
    width: 100%;
    min-height: 44px;
  }
  .chq-auth-card button[type=submit] { width: 100%; min-height: 48px; }

  .chq-auth-error {
    font-size: 14px;
    font-weight: 700;
    color: var(--chq-ink);
  }

  .chq-auth-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    border-top: 1px solid var(--chq-rule);
    padding-top: 18px;
  }
  .chq-auth-actions button[type=submit] { width: auto; padding: 0 20px; }
  .chq-auth-hint { font-size: 13px; color: var(--chq-muted); }

  .chq-auth-footer {
    border-top: 1px solid var(--chq-rule);
    padding-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chq-auth-footer-links { display: flex; gap: 16px; flex-wrap: wrap; }
  .chq-auth-footer-links a { font-size: 14px; font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; }

  .chq-auth-demo {
    border-top: 1px solid var(--chq-rule);
    padding-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chq-auth-demo-label { font-size: 13px; color: var(--chq-muted); }
  .chq-auth-demo-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
  .chq-auth-demo-buttons .chq-auth-demo-btn { width: auto; min-height: 44px; padding: 0 16px; }

  @media (max-width: 700px) {
    body { padding: 0; }
    .chq-auth-card {
      max-width: none;
      border: none;
      border-radius: 0;
      padding: 28px 20px 20px;
    }
  }
`;
