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

import { DEC_367, DEC_373, DEC_374, DEC_944, DEC_945 } from "../decisions";

void DEC_367;
void DEC_373;
void DEC_374;
void DEC_944;
void DEC_945;

// DEC-945 amendment (task-w40-c): v6 measures. body align-items switches
// to flex-start so a card hugs its content instead of stretching to full
// viewport height. No card draws a border on any 11-account frame, so the
// border/border-radius are dropped from .chq-auth-card. Class NAMES stay
// as-is (a rename would touch five call sites two lanes are editing):
// .chq-auth-card is the plain login/form card at 732px; the
// .chq-auth-card-narrow modifier is now the WIDER plain-card frame at
// the full reading measure (password / not-found) despite its name -- it
// is no longer narrower than .chq-auth-card. The 450px control-column cap
// under -narrow is gone.
//
// That full measure is DEC-945's "the full 820", and 820 is exactly the
// --chq-measure reading column theme.ts already declares -- so it is spelt
// var(--chq-measure), not a hand-copied 820px. DEC-989's wave-37 amendment
// forbids hand-copied page clamps of 800px+ on the SSR side and names
// .chq-home-shell as its ONE exception; .chq-portal-footer took the same
// var(--chq-measure) treatment there rather than keeping its own number.
// Every AUTH_CSS consumer (routes/auth.tsx, routes/account.tsx,
// server/not-found.tsx, routes/public/not-found.tsx via shell.tsx's
// BaseStyles) emits ThemeStyles/THEME_CSS first, so the token is always
// defined here. The 732 stays a literal: it is the 820 column inset by the
// card's own 44px padding, not the measure itself.
export const AUTH_CSS = `
  body { display: flex; justify-content: center; align-items: flex-start; padding: 40px 20px; }

  .chq-auth-card {
    width: 100%;
    max-width: 732px;
    background: var(--chq-paper);
    padding: 44px 44px 40px;
    display: flex;
    flex-direction: column;
    gap: 26px;
  }
  .chq-auth-card.chq-auth-card-narrow {
    max-width: var(--chq-measure);
    padding: 35px;
  }

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
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.2;
    color: var(--chq-ink);
  }
  .chq-auth-subtitle { font-size: 14px; color: var(--chq-muted); margin-top: 6px; }
  .chq-auth-body { font-size: 15px; line-height: 1.63; color: var(--chq-ink-2); }

  .chq-auth-titlerow { display: flex; flex-direction: column; gap: 10px; }
  .chq-auth-back {
    font-size: 13px;
    font-weight: 700;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    text-decoration: none;
  }
  .chq-auth-back:hover,
  .chq-auth-back:focus-visible { text-decoration: underline; }
  /* v6: ‹ Back and the h1 share one x -- no margin-left indent. */

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
    min-height: 48px;
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
  .chq-auth-footer-links {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .chq-auth-footer-links a {
    font-size: 14px;
    font-weight: 700;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }
  .chq-auth-footer-links a:hover,
  .chq-auth-footer-links a:focus-visible { text-decoration: underline; }

  .chq-auth-demo {
    border-top: 1px solid var(--chq-rule);
    padding-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chq-auth-demo-label { font-size: 13px; color: var(--chq-muted); }
  .chq-auth-demo-buttons { display: flex; flex-wrap: wrap; gap: 16px; }
  /* Small links in card vocabulary, not the 44px .chq-btn-secondary box --
     still a <button type="button"> (DEMO_PREFILL_SCRIPT delegates on the
     .chq-auth-demo-btn class + click event), just restyled to read as
     tertiary link text. */
  .chq-auth-demo-buttons .chq-auth-demo-btn {
    all: unset;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    color: var(--chq-ink);
    text-decoration: underline;
  }
  .chq-auth-demo-buttons .chq-auth-demo-btn:hover,
  .chq-auth-demo-buttons .chq-auth-demo-btn:focus-visible { color: var(--chq-muted); }

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
