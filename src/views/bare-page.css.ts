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
    padding: 48px 20px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .chq-bare-page .chq-auth-title { font-size: 36px; }
`;
