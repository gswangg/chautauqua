// DEC-037 amendment (wave 27, B9): every outbound HTML body renders through
// THIS shell — a single 560px centred table (email clients need tables, not
// flex/grid), a text wordmark, a body produced by CALLING textToHtml (never
// re-implementing escaping — the escaping contract stays owned by
// src/lib/html-escape.ts), at most one CTA button, and a footer naming the
// event and the reason the recipient received the message.
//
// Colour literals are permitted and expected in THIS FILE ONLY: email
// clients do not resolve CSS custom properties (no `var(--...)` support in
// Gmail/Outlook/etc.), so the surface-CSS "no colour literal" scan does not
// (and must not) cover mail markup. Do not copy these literals elsewhere.

import { escapeHtml } from "../lib/html-escape";
import { textToHtml } from "./render";

const WORDMARK_COLOR = "#3f4a1f"; // olive, dark enough for AA contrast on white
const BUTTON_BG = "#5c6b2c"; // olive
const BUTTON_TEXT = "#ffffff";
const BUTTON_BORDER = "#3f4a1f";
const FOOTER_COLOR = "#6b6b6b";
const BODY_COLOR = "#1a1a1a";
const BORDER_COLOR = "#e2e2e2";

export interface EmailShellOptions {
  eventName: string | null;
  reason: string;
  cta?: { label: string; href: string } | null;
}

/** Wraps plain-text email content in a complete HTML document: a 560px
 * centred table, a wordmark, the escaped body, an optional single button,
 * and a footer naming the event + why the recipient received the mail. */
export function renderEmailHtml(text: string, opts: EmailShellOptions): string {
  const wordmark = opts.eventName && opts.eventName.trim() !== "" ? opts.eventName : "Chautauqua";
  const bodyHtml = textToHtml(text);
  const footerEventClause = opts.eventName && opts.eventName.trim() !== "" ? ` from ${escapeHtml(opts.eventName)}` : "";

  const buttonRow =
    opts.cta != null
      ? `<tr><td style="padding:24px 32px 0 32px;">` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td style="border:1px solid ${BUTTON_BORDER};border-radius:4px;background:${BUTTON_BG};">` +
        `<a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;padding:12px 24px;color:${BUTTON_TEXT};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;">${escapeHtml(opts.cta.label)}</a>` +
        `</td></tr></table>` +
        `</td></tr>`
      : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(wordmark)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid ${BORDER_COLOR};">
            <tr>
              <td style="padding:24px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:${WORDMARK_COLOR};">
                ${escapeHtml(wordmark)}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${BODY_COLOR};">
                ${bodyHtml}
              </td>
            </tr>
            ${buttonRow}
            <tr>
              <td style="padding:24px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${FOOTER_COLOR};border-top:1px solid ${BORDER_COLOR};margin-top:24px;">
                You received this email${footerEventClause} because ${escapeHtml(opts.reason)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
