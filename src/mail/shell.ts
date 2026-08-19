// DEC-037 amendment (wave 27, B9; palette pinned wave 20): every outbound
// HTML body renders through THIS shell -- a single 560px centred table
// (email clients need tables, not flex/grid), a text wordmark, a body
// produced by CALLING textToHtml (never re-implementing escaping -- the
// escaping contract stays owned by src/lib/html-escape.ts), at most one
// CTA button, and a footer naming the event and the reason the recipient
// received the message.
//
// focus-treatment-exempt: an email body is not a surface of this product --
// it renders inside somebody else's mail client, which strips <style>
// blocks, resolves no custom properties (see below) and has no keyboard
// focus model of ours to join. THEME_CSS would be discarded on arrival.
//
// Colour literals are permitted and expected in THIS FILE ONLY: email
// clients do not resolve CSS custom properties (no `var(--...)` support in
// Gmail/Outlook/etc.), so the surface-CSS "no colour literal" scan does not
// (and must not) cover mail markup. This licenses LITERALS, not arbitrary
// colours -- every literal below is transcribed from the vendored frame
// (docs/design/Chautauqua Comms.dc.html:710-738
// `max-width:560px; background:#F4F1E8; border:1px solid #D3CFC0;
// border-radius:4px`, the 560px email card nested inside the frame's own
// wider preview chrome; corrected from a prior wave's 699-741, which cited
// the OUTER 620px preview-frame wrapper, not the email card itself) and
// DESIGN-RULINGS.md B9,
// and is enumerated in test/mail-shell-frame.test.ts's
// PERMITTED_MAIL_COLOURS scan so a future literal outside this set fails
// loudly. Do not copy these literals elsewhere.

import { escapeHtml } from "../lib/html-escape";
import { textToHtml } from "./render";

const PAGE_GROUND = "#E9E7E2"; // client/page ground behind the card
const CARD_BG = "#F4F1E8"; // 560px card background
const CARD_BORDER = "#D3CFC0"; // 560px card border
const MASTHEAD_INK = "#1B1D17"; // masthead wordmark text
const MASTHEAD_RULE = "#E1DDCE"; // masthead bottom rule + footer top rule
const BODY_COLOR = "#3F4237"; // body copy (token table's "Body copy")
const CTA_BG = "#4E5C31"; // CTA button background
const CTA_TEXT = "#F7F9F0"; // CTA button text
const MUTED_COLOR = "#565A4B"; // paste-URL line + footer lines

export interface EmailShellOptions {
  eventName: string | null;
  reason: string;
  cta?: { label: string; href: string } | null;
}

/** Wraps plain-text email content in a complete HTML document: a 560px
 * centred card, a masthead wordmark, the escaped body, an optional single
 * CTA button (with a paste-the-URL fallback line), and a two-line footer
 * naming the reason the recipient received the mail and the sending event. */
export function renderEmailHtml(text: string, opts: EmailShellOptions): string {
  const wordmark = opts.eventName && opts.eventName.trim() !== "" ? opts.eventName : "Chautauqua";
  const bodyHtml = textToHtml(text);

  const ctaBlock =
    opts.cta != null
      ? `<tr><td style="padding:22px 34px 0 34px;">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td style="border-radius:4px;background:${CTA_BG};">` +
        `<a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;padding:14px 22px;color:${CTA_TEXT};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;">${escapeHtml(opts.cta.label)}</a>` +
        `</td></tr></table>` +
        `</td></tr>` +
        `<tr><td style="padding:8px 34px 0 34px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${MUTED_COLOR};word-break:break-all;">` +
        `Or paste this into your browser: ${escapeHtml(opts.cta.href)}` +
        `</td></tr>`
      : "";

  const footerLine2 =
    opts.eventName && opts.eventName.trim() !== ""
      ? `${escapeHtml(opts.eventName)} &middot; sent with <span style="font-weight:700;">Chautauqua</span>`
      : `sent with <span style="font-weight:700;">Chautauqua</span>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(wordmark)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAGE_GROUND};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_GROUND};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:4px;">
            <tr>
              <td style="padding:32px 34px 0 34px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ${MASTHEAD_RULE};">
                  <tr>
                    <td style="padding-bottom:16px;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;color:${MASTHEAD_INK};">
                      ${escapeHtml(wordmark)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 34px 0 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${BODY_COLOR};">
                ${bodyHtml}
              </td>
            </tr>
            ${ctaBlock}
            <tr>
              <td style="padding:16px 34px 28px 34px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${MASTHEAD_RULE};">
                  <tr>
                    <td style="padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${MUTED_COLOR};">
                      You are receiving this because ${escapeHtml(opts.reason)}<br />
                      ${footerLine2}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
