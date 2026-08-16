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

import { DEC_367, DEC_373, DEC_374, DEC_944, DEC_945, DEC_124 } from "../decisions";
import { ERROR_STATES_CSS } from "../views/error-states.css";
import { BARE_PAGE_CSS } from "../views/bare-page.css";

void DEC_367;
void DEC_373;
void DEC_374;
void DEC_944;
void DEC_945;
void DEC_124;

// DEC-945 amendment (wave 25): the V8 intake redrew 11-account--00 ("a
// card, not a stretched phone") and SUPERSEDES the pair-6 box-math ruling
// that trued the box up to 820/888 (732/818 content + 2x padding). The
// card is small and content-hugging, not a reading column padded inward:
// .chq-auth-card is 460px max-width with a 1px --chq-rule border, paper
// fill and 8px radius. Its submit control is intrinsic-width (never
// width:100%) inside a footer row -- full-column buttons are phone
// anatomy, not a desktop card.
//
// DEC-945 (wave 48 amendment): .chq-auth-card-narrow (520px, same border/
// fill/radius) is DELETED. The three non-credential dead-ends that wore it
// (404 notice, /account/password, expired-claim) now use .chq-bare-page
// (src/views/bare-page.css.ts) -- an 820px reading column with no card
// chrome at all. Only /login, /forgot and /reset keep the small bordered
// .chq-auth-card (a credential prompt is deliberately a small card).
export const AUTH_CSS = `
  body { display: flex; justify-content: center; align-items: flex-start; padding: 40px 20px; }

  .chq-auth-card {
    width: 100%;
    max-width: 460px;
    border: 1px solid var(--chq-rule);
    background: var(--chq-paper);
    border-radius: 8px;
    padding: 36px 34px 32px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .chq-auth-wordmark {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.04em;
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
  .chq-auth-body { font-size: 15px; line-height: 1.63; color: var(--chq-ink-2); margin: 0; }

  /* Wave-1 (DEC-945 amendment): the 404 card is a tight title/body/links
     notice, not a form -- the card's uniform 26px gap (tuned for the login
     form's field stack) reads roughly 2x the frame's rhythm here, and the
     UA <p> margin this file never zeroed used to stack on top of it.
     .chq-auth-card-notice turns the card's own gap off and states the
     frame's own numbers explicitly: h1->body ~19px, body->links ~26px. */
  /* wave 48 amendment: the 404 notice card no longer wears .chq-auth-card
     (it now sits in .chq-bare-page, DEC-945's bare reading-page shell) --
     this selector follows it there. */
  .chq-bare-page.chq-auth-card-notice { gap: 0; }
  .chq-auth-card-notice .chq-auth-titlerow { margin-bottom: 19px; }
  .chq-auth-card-notice .chq-auth-body { margin-bottom: 26px; }

  .chq-auth-titlerow { display: flex; flex-direction: column; gap: 10px; }
  /* DEC-369 amendment (wave 22): the fitted -8.5px override chased a gate-4
     render measurement now superseded; the card's shared 26px gap governs. */
  /* DEC-367 amendment (wave 57): the >=44px tap floor is a PHONE rule
     (docs/design/README.md:92), not a desktop one -- the tap-floor box
     now only appears in the @media (max-width: 700px) block at the
     tail of this module. The wave-6 align-items:flex-start +
     margin-bottom:-13px compensation this rule used to carry (fighting the
     always-on box's own centering back off so the following h1 held its
     frame position) has nothing left to compensate for now that the box is
     phone-only, and is gone. */
  .chq-auth-back {
    font-size: 13px;
    font-weight: 700;
    display: inline-flex;
    align-self: flex-start;
    text-decoration: none;
  }
  .chq-auth-back:hover,
  .chq-auth-back:focus-visible { text-decoration: underline; }
  /* v6: ‹ Back and the h1 share one x -- no margin-left indent. */

  /* wave-6 (11-account gate-4): .chq-auth-fields is itself a <form>
     element on both /login and /account/password -- the UA default form
     margin stacked on top of the card's own 26px gap, measuring 42.0
     (Sign-in button bottom -> footer divider) against the frame's 26.5.
     Zeroing it here lands the gap on the card's own gap value, no second
     source of rhythm. */
  .chq-auth-fields { display: flex; flex-direction: column; gap: 14px; margin: 0; }
  .chq-auth-fieldstack { display: flex; flex-direction: column; gap: 14px; }
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
  /* wave 25 (DEC-945 V8 amendment): an intrinsic-width olive control, never
     a full-column bar -- that's phone anatomy on a card this narrow. It
     lives in a .chq-auth-submitrow footer row (below), never bare in
     .chq-auth-fields' own gap. */
  .chq-auth-card button[type=submit],
  .chq-auth-actions button[type=submit] {
    width: auto;
    min-height: 46px;
    padding: 0 22px;
    font-size: 14px;
    font-weight: 700;
  }

  /* wave 25 (DEC-945 V8 amendment / DEC-154 wave-25 amendment): the row the
     submit control sits in. space-between when a left-hand tertiary link
     (e.g. task-w25-b's "Forgot your password?") shares the row, flex-end
     when the button is alone -- :has() keeps the CSS the single owner of
     that rule instead of a markup-side conditional class. */
  .chq-auth-submitrow {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: flex-end;
  }
  .chq-auth-submitrow:has(.chq-auth-tertiary) {
    justify-content: space-between;
  }
  /* task-w25-b: same 13px/700 link vocabulary as .chq-auth-back (frame's
     '‹ Back to sign in' / 'Forgot your password?' links) -- a submitrow
     tertiary link, not a footer link, so it does not inherit
     .chq-auth-footer-links' 44px tap-target sizing. */
  .chq-auth-tertiary {
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
  }
  .chq-auth-tertiary:hover,
  .chq-auth-tertiary:focus-visible {
    text-decoration: underline;
  }

  /* wave 25 (DEC-154 amendment): a muted one-line status, never a banner or
     a coloured box -- the single owner of both the /logout and (task-w25-b)
     password-reset status text, keyed off loginStatusLine(). */
  .chq-auth-status {
    font-size: 14px;
    color: var(--chq-muted);
  }

  /* DEC-124 amendment (wave 6): the sign-in rejection band, checked against
     docs/design/Chautauqua Account.dc.html:302-305 \`border:1px solid
     #1B1D17; border-left:4px solid #1B1D17; border-radius:5px;
     background:#EFEBDF; padding:14px 16px; display:flex;
     flex-direction:column; gap:6px\` ("Sign in · rejected").
     ERROR_STATES_CSS's shared .chq-error-summary (1px ink border + 3px ink
     left edge, transparent fill, 16px/18px padding, 8px gap, a
     --chq-font-display h2) is the CFP/Portal contract; the auth card's own
     band differs on four properties the frame draws explicitly -- a 4px
     (not 3px) ink left edge, 5px radius, a sunk --chq-surface-sunk fill, a
     tighter 14px/16px padding + 6px gap, and a plain (non-display-font)
     14px/700 headline. Scoped to .chq-auth-card so ERROR_STATES_CSS's own
     rule, and every other surface composing it, is untouched. */
  .chq-auth-card .chq-error-summary {
    border-left-width: 4px;
    border-radius: 5px;
    background: var(--chq-surface-sunk);
    padding: 14px 16px;
    gap: 6px;
  }
  .chq-auth-card .chq-error-summary h2 {
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
  }

  .chq-auth-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    border-top: 1px solid var(--chq-rule);
    padding-top: 18px;
    /* DEC-369 amendment (wave 22): the fitted 6.5px chased a gate-4 render
       measurement now superseded; rounded to the nearest integer. */
    margin-top: 6px;
  }
  .chq-auth-hint { font-size: 13px; color: var(--chq-muted); }
  .chq-auth-cancel { display: none; }

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
  /* DEC-367 amendment (wave 57): the >=44px tap floor is a PHONE rule
     (docs/design/README.md:92), not a desktop one -- the tap-floor box
     now only appears in the @media (max-width: 700px) block at the
     tail of this module, shared unscoped by both this /login footer row
     and the 404 notice card (src/server/not-found.tsx renders the same
     .chq-auth-footer-links markup with no .chq-auth-footer wrapper). The
     wave-6 .chq-auth-footer-scoped align-items:flex-start override this
     rule used to need (fighting the always-on box's own centering back off
     so the divider->ink gap held the frame's number) has nothing left to
     compensate for now that the box is phone-only, and is gone. */
  .chq-auth-footer-links a {
    font-size: 14px;
    font-weight: 700;
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
  /* wave-6: takes the card's own link vocabulary (the same numbers as
     .chq-auth-footer-links a: 14px/700, brand olive ink, no underline at
     rest) instead of the smaller 13px underlined-at-rest treatment. */
  .chq-auth-demo-buttons .chq-auth-demo-btn {
    all: unset;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    /* DEC-383: brand olive ink through the token, never the literal --
       var(--chq-brand) IS the theme's #4E5C31 and is what the plain
       anchor rule these buttons imitate resolves to (theme.ts). */
    color: var(--chq-brand);
    text-decoration: none;
  }
  .chq-auth-demo-buttons .chq-auth-demo-btn:hover { text-decoration: underline; }
  /* DEC-366: the "all: unset" declaration above also unsets the UA's
     default outline, so without this the demo prefill buttons are the
     only controls on the auth surface with no focus ring at all. Restore
     the theme's ring without reintroducing the 44px .chq-btn box unset
     stripped away. */
  .chq-auth-demo-buttons .chq-auth-demo-btn:focus-visible {
    color: var(--chq-muted);
    outline: 2px solid var(--chq-brand);
    outline-offset: 2px;
  }

  @media (max-width: 700px) {
    /* DEC-367 amendment (wave 57): the >=44px tap floor is phone-only
       (docs/design/README.md:92) -- these two boxes used to be unconditional
       base rules above; moved here verbatim, no other property added. */
    .chq-auth-back { min-height: 44px; }
    .chq-auth-footer-links a { min-height: 44px; }
    body { padding: 0; }
    .chq-auth-card {
      max-width: none;
      border: none;
      border-radius: 0;
      padding: 28px 20px 20px;
    }
    /* wave 48 amendment: the full-height/scrollable-fieldstack phone
       treatment used to key off the deleted narrow card modifier -- only
       /account/password's form shape needs it (the notice and
       expired-claim bare pages hold no .chq-auth-fields form), so this
       re-scopes to a .chq-bare-page that actually contains one. */
    .chq-bare-page:has(.chq-auth-fields) {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }
    .chq-auth-titlerow { flex-shrink: 0; }
    .chq-auth-fields {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .chq-auth-fieldstack {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
    .chq-auth-cancel { display: inline-flex; }
    .chq-auth-hint { display: none; }
  }
${ERROR_STATES_CSS}
${BARE_PAGE_CSS}`;
