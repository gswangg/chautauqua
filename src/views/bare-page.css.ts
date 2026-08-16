// DEC-945 (wave 48 amendment): the bare reading-page shell for every
// non-credential SSR dead-end -- /account/password, the /admin/* not-found
// card and the expired-claim page (all formerly wearing
// .chq-auth-card-narrow, a 520px bordered card) plus the CFP-closed page
// (formerly its own ad hoc .chq-cfp-closed card). docs/design/README.md
// §Widths: reading measure is 820px centred, and chrome/cards are never a
// centred bordered box floating on a wide background -- that reads as a
// different design language from the one this product uses everywhere
// else. Hoisted here as its own value-free CSS-string module (same shape
// as src/views/error-states.css.ts), composed at the tail of both AUTH_CSS
// and CFP_CSS the way public.css.ts's PUBLIC_CSS composes its own layers.
// Plain .ts, pure Web-safe CSS text: no node:/cloudflare import (DEC-002),
// tokens only.
//
// DEC-374: value-free module constant -- never interpolated with
// request/user data.

import { DEC_374, DEC_945 } from "../decisions";

void DEC_374;
void DEC_945;

// DEC-945 (wave 48 amendment): .chq-bare-page is deliberately NOT a card --
// no border, no background fill, no border-radius. It only centres the
// reading column and supplies the vertical rhythm a dead-end page needs
// (eyebrow/title/body/links stacked with the shared section gap).
export const BARE_PAGE_CSS = `
  .chq-bare-page {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    /* G13 fix (frame 11-account--01): the frame's field bands run the full
       818px content measure centred on x=800 -- 20px side padding ate 40px
       of the measure at desktop. Side padding returns at phone widths. */
    padding: 48px 0;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  @media (max-width: 860px) {
    .chq-bare-page { padding: 48px 20px; }
  }
  .chq-bare-page .chq-auth-title { font-size: 28px; }
  /* Gate-9 fleet R-A: the input fill rule is scoped to .chq-auth-card, so
     when /account/password (and the expired-claim page) moved onto the
     bare page their fields collapsed to the browser's intrinsic ~188px
     size-attribute width against the frame's full-measure 818x47.5 bands.
     The bare page owns its own fill. Same for the submit control, which
     lost the card's footer-row sizing and painted as a 19px sliver. */
  .chq-bare-page input[type=email],
  .chq-bare-page input[type=password],
  .chq-bare-page input[type=text],
  .chq-bare-page .chq-input {
    display: block;
    width: 100%;
    min-height: 48px;
  }
  .chq-bare-page .chq-btn-primary,
  .chq-bare-page button[type=submit] {
    /* G13 fix (frame 11-account--01): the frame's submit band is 48px. */
    min-height: 48px;
    padding: 0 20px;
    width: auto;
    align-self: flex-start;
  }
`;
