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

import { DEC_367, DEC_373, DEC_374, DEC_944, DEC_945, DEC_124, DEC_385 } from "../decisions";
import { ERROR_STATES_CSS } from "../views/error-states.css";
import { BARE_PAGE_CSS } from "../views/bare-page.css";

void DEC_367;
void DEC_373;
void DEC_374;
void DEC_944;
void DEC_945;
void DEC_124;
// DEC-385: single-direction responsive -- the "Sign in · 390" and "Change
// password · 390" band geometry added at the tail of this file's existing
// max-width:700px block narrows the wide (desktop) rules above it; nothing
// here restates or overrides the shared 700px switch/band metrics theme.ts
// (src/views/theme.ts) already owns, and no phone-shell class name (the SPA
// vocabulary this SSR surface deliberately does not wear) is introduced.
void DEC_385;

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
  /* G13 fix (11-account frames 00/05-09): every credential card centres
     VERTICALLY in the viewport -- min-height gives the flex row a cross
     axis to centre against; bare reading pages keep the top-anchored
     flex-start default. */
  body { display: flex; justify-content: center; align-items: flex-start; padding: 40px 20px; min-height: 100dvh; box-sizing: border-box; }

  /* G13 fix (A23): /login stacks the card and the demo-accounts block as
     one centred unit -- the demo block sits below the card, outside it. */
  .chq-auth-stack {
    width: 100%;
    max-width: 460px;
    align-self: center;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .chq-auth-card {
    width: 100%;
    max-width: 460px;
    align-self: center;
    border: 1px solid var(--chq-rule);
    /* G13 fix (frame 11-account--00): the card paints one surface step
       LIGHTER than the page (#FAF8F2 on #F4F1E8), never the page colour. */
    background: var(--chq-surface);
    border-radius: 8px;
    padding: 36px 34px 32px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  /* Inside the /login stack the wrapper owns centring; the card fills it. */
  .chq-auth-stack .chq-auth-card { align-self: stretch; }
  .chq-auth-wordmark {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--chq-ink);
  }
  .chq-auth-title {
    font-family: 'Familjen Grotesk', system-ui, sans-serif;
    /* G13 fix (frames 11-account--05/07/08): the CARD's H1 draws ~24px;
       the bare reading page keeps 28px via .chq-bare-page's own override. */
    font-size: 24px;
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
     now only appears in the phone media block (max-width 700px) at the
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
    /* Frame 11-account--07 samples the inputs at #FFFFFF (one step above
       the card's #FAF8F2), but white is not in the README §Colour palette
       (the palette-closure scan bans off-palette literals) -- needs a
       palette ruling before the input fill can go lighter than
       --chq-surface. Card-vs-page contrast (the MAJOR half of the finding)
       is fixed above. */
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
     ERROR_STATES_CSS's shared .chq-error-summary is the CFP/Portal
     contract; G13 moved this band's sunk fill and card radius ONTO that
     shared vocabulary (frame 10--21 draws the same filled panel on the
     public submit surface), so they are no longer re-declared here. What
     is still auth-specific, drawn explicitly by the frame above: a 4px
     (not 3px) ink left edge, a tighter 14px/16px padding + 6px gap, and a
     plain (non-display-font) 14px/700 headline. Scoped to .chq-auth-card
     so ERROR_STATES_CSS's own rule, and every other surface composing it,
     is untouched. */
  .chq-auth-card .chq-error-summary {
    border-left-width: 4px;
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
     now only appears in the phone media block (max-width 700px) at the
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

  /* USER RULING (release night): original in-card presentation restored --
     rule-separated footer block, sentence-case label, one wrapping row of
     prefill buttons. (Reverts the A23 outside-the-card micro-label form.) */
  .chq-auth-demo {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--chq-rule);
    padding-top: 18px;
    margin-top: 18px;
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

${ERROR_STATES_CSS}
${BARE_PAGE_CSS}
  /* Wave w1-h (task w1-h, docs/design/audit/account-docs-v12.md): "Sign in
     · 390" and "Change password · 390" phone geometry. Appended AFTER the
     ERROR_STATES_CSS/BARE_PAGE_CSS composition on purpose -- several of
     these selectors (.chq-bare-page .chq-auth-title, .chq-bare-page
     input[type=password], .chq-bare-page:has(.chq-auth-fields)) tie in
     specificity with rules BARE_PAGE_CSS declares unconditionally, and a
     phone block placed earlier in this template literal is silently dead
     against text composed in after it -- the cascade trap this module's
     own header comment warns about. */
  @media (max-width: 700px) {
    /* DEC-385 wave-102 amendment: this sheet's earlier ≤700px block
       (task w2-e / wave-57, formerly a separate block above this one) is
       consolidated HERE, in ascending source order, ahead of the w1-h
       rules that followed it -- a non-terminal phone block can be
       silently shadowed by a later desktop rule (phone-terminal-block.
       scan.test.ts). No selector/declaration/value is reordered or
       reworded; where a selector recurs below with an overlapping
       property, the two rules are collapsed explicitly and the discarded
       declaration is named beside it. */
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

    /* -----------------------------------------------------------------
       w2-e: "Sign in · 390" (docs/design/Chautauqua Account.dc.html:121
       \`<div style="width:390px; height:844px;\`), scoped to
       .chq-auth-stack -- the wrapper only /login's LoginPage renders --
       so ClaimPage/ForgotPasswordPage/ResetPasswordPage, which share the
       same .chq-auth-card/.chq-auth-tertiary/.chq-auth-wordmark classes
       but have no ruling frame here, are untouched.
       ------------------------------------------------------------- */
    /* :124 \`font-size:26px; font-weight:700; letter-spacing:-0.04em;
       line-height:1">chautauqua\` -- phone wordmark is one size down from
       the desktop card's 28px. */
    .chq-auth-stack .chq-auth-wordmark { font-size: 26px; }
    /* :130 \`border-radius:6px; ... min-height:50px; ... font-size:16px\`
       (Email/Password fields). */
    .chq-auth-stack .chq-auth-card input[type=email],
    .chq-auth-stack .chq-auth-card input[type=password] {
      min-height: 50px;
      border-radius: 6px;
      font-size: 16px;
    }
    /* DEC-919 wave-101: this hide is NOT eligible for a phone-hidden
       receipt (none of the three legal shapes -- desktop twin of a
       phone-only sibling, drag handle, bare navigational glyph -- apply)
       and is deliberately left counted rather than receipted on
       assumption. The 390 frame draws no "Forgot your password?" link at
       all inside the Email/Password stack -- just Email, Password, a
       full-width Sign in -- and this scoped selector (.chq-auth-stack
       .chq-auth-tertiary) out-specifies the unscoped .chq-auth-tertiary
       re-lined rule below, so /login's Forgot link stays hidden while
       every OTHER auth page's tertiary link (Back to sign in, etc.) gets
       the re-lined treatment. Filed in
       docs/design/audit/tap-floor-v12.md (task w2-t). */
    .chq-auth-stack .chq-auth-tertiary { display: none; }
    /* :136 \`background:#4E5C31; ... border-radius:6px; min-height:50px;
       ... justify-content:center; font-size:15px; font-weight:700">Sign
       in\` -- full-width, centred, one size down from the desktop card's
       14px/46px/22px-padded intrinsic button. */
    .chq-auth-stack .chq-auth-card button[type=submit] {
      width: 100%;
      min-height: 50px;
      border-radius: 6px;
      font-size: 15px;
    }
    /* :138 \`border-top:1px solid #E1DDCE; padding-top:18px; display:flex;
       flex-direction:column; gap:10px\` wraps the label AND both links as
       one column (no wrapping row) -- unlike the desktop card's
       .chq-auth-footer-links row. Scoped to .chq-auth-footer so the
       expired-claim page and the /admin/* 404 card, which render
       .chq-auth-footer-links with no .chq-auth-footer wrapper, keep their
       own row layout. */
    .chq-auth-footer .chq-auth-footer-links {
      flex-direction: column;
      gap: 10px;
    }
    /* :141/:142 \`font-size:15px; font-weight:700\` -- one size up from the
       desktop card's 14px link. Deliberately NOT re-declared as a
       .chq-auth-footer-scoped descendant rule on .chq-auth-footer-links a:
       DEC-367's wave-57 amendment retired that scoped override, and
       test/auth-card-rhythm-w6.test.ts asserts it never returns. The 15px
       lands on the unscoped .chq-auth-footer-links a rule below instead,
       which reaches these same links. */

    /* -----------------------------------------------------------------
       w2-e: "Change password · 390" (docs/design/Chautauqua Account.dc.html:153
       \`<div style="width:390px; height:844px;\`) -- head/body/dock
       band geometry layered onto the wave-13 action-bar structure this
       file already owns. Scoped to
       .chq-bare-page:has(.chq-auth-fields), the account-password page's
       own anchor selector, so the expired-claim page and the /admin/*
       404 card -- both plain .chq-bare-page with a .chq-auth-titlerow
       but no .chq-auth-fields form -- are untouched. The three rules
       below (.chq-bare-page:has(.chq-auth-fields), .chq-auth-fieldstack,
       .chq-auth-actions) each had a byte-identical w1-h duplicate later
       in this block; those duplicates are collapsed away below rather
       than kept as redundant second rules, per DEC-385 wave-102. */
    /* :154 \`border-bottom:1px solid #1B1D17; padding:14px 16px;
       flex-shrink:0; display:flex; flex-direction:column; gap:7px\`. */
    .chq-bare-page:has(.chq-auth-fields) .chq-auth-titlerow {
      border-bottom: 1px solid var(--chq-ink);
      padding: 14px 16px;
      margin: 0;
      gap: 7px;
    }
    /* :156 \`font-size:25px; font-weight:700; letter-spacing:-0.04em;
       line-height:1.05">Change your password\` -- the drill-in H1
       register (back-linked, one size down from the 27px cluster-landing
       register), already tokenised in theme.ts. */
    .chq-bare-page:has(.chq-auth-fields) .chq-auth-title {
      font-size: var(--chq-type-page-title-phone-drill);
      margin-top: 8px;
    }

    /* Sign in · 390 (docs/design/Chautauqua Account.dc.html:121
       \`width:390px; height:844px;\`) -- phone-only overrides for the
       credential card; every desktop number above is untouched. */
    .chq-auth-wordmark {
      /* docs/design/Chautauqua Account.dc.html:124 \`font-size:26px;\` --
         26px on phone, not the desktop card's 28px. */
      font-size: 26px;
    }
    .chq-auth-subtitle {
      /* docs/design/Chautauqua Account.dc.html:123 \`gap:7px\`
         (wordmark/subtitle stack). */
      margin-top: 7px;
    }
    .chq-auth-card input[type=email],
    .chq-auth-card input[type=password] {
      /* docs/design/Chautauqua Account.dc.html:130 \`min-height:50px;\` --
         50px on phone, not the desktop card's 48px. */
      min-height: 50px;
    }
    /* The 390 frame draws the "Sign in" action alone, full width
       (DESIGN-RULINGS's "full-column buttons ... are phone anatomy"
       corollary) -- its submit row carries no "Forgot your password?"
       link at all. Dropping live navigation isn't licensed by a geometry
       frame alone, so the narrowest reading keeps the link and stacks it
       under the now-full-width primary action instead of deleting it --
       flagged as an open design gap in
       docs/design/audit/account-docs-v12.md. */
    .chq-auth-submitrow {
      flex-direction: column-reverse;
      align-items: stretch;
      gap: 10px;
    }
    .chq-auth-card button[type=submit] {
      /* docs/design/Chautauqua Account.dc.html:136 \`min-height:50px;
         display:flex; align-items:center; justify-content:center;
         font-size:15px; font-weight:700\` */
      width: 100%;
      min-height: 50px;
      font-size: 15px;
      padding: 0;
    }
    .chq-auth-tertiary {
      align-self: center;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .chq-auth-footer {
      /* docs/design/Chautauqua Account.dc.html:138 \`border-top:1px solid
         #E1DDCE; padding-top:18px;\` -- the hairline token, not the
         desktop card's --chq-rule. */
      border-top-color: var(--chq-hairline);
      padding-top: 18px;
    }
    .chq-auth-footer-links a {
      /* docs/design/Chautauqua Account.dc.html:140 \`font-size:15px;
         font-weight:700; min-height:44px;\` -- 15px on phone, not the
         desktop card's 14px (the 44px floor already lands via the
         earlier phone block). */
      font-size: 15px;
    }

    /* Change password · 390 (docs/design/Chautauqua Account.dc.html:153
       \`width:390px; height:844px;\`) -- edge-to-edge header/body/footer
       bands replace the bare-page shell's ambient reading-column inset
       for this one page only. :has(.chq-auth-fields) scopes every rule
       below to /account/password specifically -- the 404 notice and
       expired-claim pages share .chq-bare-page too but carry no such
       form, so they keep the plain reading-column padding untouched. */
    /* DEC-385 wave-102: collapsed with the byte-identical w2-e block's
       .chq-bare-page:has(.chq-auth-fields) { padding: 0; gap: 0; } rule
       (same selector, same two properties, same values) -- one instance
       kept, the earlier duplicate discarded. */
    .chq-bare-page:has(.chq-auth-fields) {
      padding: 0;
      gap: 0;
    }
    .chq-auth-fields { gap: 0; }
    .chq-auth-titlerow:has(.chq-auth-back) {
      /* docs/design/Chautauqua Account.dc.html:154 \`border-bottom:1px
         solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex;
         flex-direction:column; gap:7px\` */
      border-bottom: 1px solid var(--chq-ink);
      padding: 14px 16px;
      gap: 7px;
    }
    .chq-bare-page .chq-auth-title {
      /* docs/design/Chautauqua Account.dc.html:156 \`font-size:25px;\` --
         the drill register: 25px on phone, not the bare-page shell's
         28px desktop title (src/views/bare-page.css.ts). */
      font-size: 25px;
    }
    /* DEC-385 wave-102: collapsed with the byte-identical w2-e block's
       .chq-auth-fieldstack { padding: 16px; gap: 16px; } rule (same
       selector, same two properties, same values) -- one instance kept,
       the earlier duplicate discarded. */
    .chq-auth-fieldstack {
      /* docs/design/Chautauqua Account.dc.html:158 \`padding:16px;
         display:flex; flex-direction:column; gap:16px\` -- 16px on
         phone, not the shared 14px field-gap default. */
      padding: 16px;
      gap: 16px;
    }
    .chq-bare-page input[type=password] {
      /* docs/design/Chautauqua Account.dc.html:161 \`min-height:50px;\`
         -- 50px on phone, not the bare-page shell's 48px. */
      min-height: 50px;
    }
    /* DEC-385 wave-102: collapsed with the byte-identical w2-e block's
       .chq-auth-actions { border-top / background / padding / margin-top
       / gap } rule (same selector, same five properties, same values,
       written in a different order) -- one instance kept, the earlier
       duplicate discarded. */
    .chq-auth-actions {
      /* docs/design/Chautauqua Account.dc.html:172 \`border-top:1px
         solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px;
         display:flex; gap:8px\` -- a filled, edge-to-edge footer band on
         phone, not the desktop card's bare --chq-rule divider. */
      border-top: 1px solid var(--chq-ink);
      background: var(--chq-surface-sunk);
      padding: 12px 16px 16px;
      gap: 8px;
      margin-top: 0;
    }
    /* DEC-385 wave-102: merged with the w2-e block's
       .chq-auth-actions button[type=submit] rule -- flex:1/min-height:48px
       were declared identically in both and are collapsed to one
       declaration each; border-radius:6px (the w2-e block's only unique
       property here) is kept alongside the w1-h block's width/font-size/
       padding/align-self, none of which the w2-e rule declared. */
    .chq-auth-actions button[type=submit] {
      /* docs/design/Chautauqua Account.dc.html:173 \`min-height:48px;
         display:flex; align-items:center; justify-content:center;
         font-size:14px; font-weight:700\` -- flex:1 fills the row beside
         Cancel, per the same frame line's leading \`flex:1;\`. */
      flex: 1;
      width: auto;
      min-height: 48px;
      border-radius: 6px;
      font-size: 14px;
      padding: 0;
      align-self: auto;
    }
    /* DEC-385 wave-102: merged with the w2-e block's .chq-auth-cancel
       rule -- min-height:48px/font-size:13px were declared identically in
       both and are collapsed to one declaration each; border-radius:6px
       (the w2-e block's only unique property here) is kept alongside the
       w1-h block's padding/font-weight, neither of which the w2-e rule
       declared. */
    .chq-auth-cancel {
      /* docs/design/Chautauqua Account.dc.html:174 \`min-height:48px;
         display:flex; align-items:center; padding:0 16px; font-size:13px;
         font-weight:600\` */
      min-height: 48px;
      border-radius: 6px;
      padding: 0 16px;
      font-size: 13px;
      font-weight: 600;
    }
    /* task w7-e (SSR_UNFLOORED_TOKENS_CEILING): live-probed at 269.8x17 --
       the "all: unset" link-vocabulary demo-prefill button above declares
       no height at all, so it collapses to its 14px text's line box.
       Additive phone-only floor, no desktop value touched. */
    .chq-auth-demo-buttons .chq-auth-demo-btn {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 0 4px;
    }
  }`;
