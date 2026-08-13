// Production mailer (DEC-996): a plain HTTP call to the Resend API
// (https://api.resend.com/emails). Pure-core per DEC-002: no node:/cloudflare
// imports — fetch is injected so this file compiles and tests without a
// worker runtime or a real API key.
// .ics attachments ride as base64 `content` with their own `filename`, per
// Resend's attachments shape.

import type { EmailLogEntry, EmailLogWriter, Mailer, RenderedEmail } from "./types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function base64Encode(raw: string): string {
  // btoa is available in both workerd and Node's test runtime; TextEncoder
  // handles non-Latin1 ICS content correctly.
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export class ResendMailer implements Mailer {
  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly apiKey: string,
    private readonly log: EmailLogWriter,
    private readonly from: { email: string; name: string },
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async send(m: RenderedEmail): Promise<void> {
    let status = "sent";
    let sendError: unknown = null;
    try {
      const res = await this.fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${this.from.name} <${this.from.email}>`,
          to: [m.to.email],
          subject: m.subject,
          html: m.html,
          text: m.text,
          ...(m.ics
            ? {
                attachments: [
                  {
                    filename: m.ics.filename,
                    content: base64Encode(m.ics.content),
                  },
                ],
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Resend send failed (${res.status}): ${body}`);
      }
    } catch (err) {
      status = "failed";
      sendError = err;
    }
    const row: EmailLogEntry = {
      eventId: m.eventId,
      contactId: m.contactId,
      templateId: m.templateId,
      batchId: m.batchId ?? null,
      toEmail: m.to.email,
      toName: m.to.name,
      subject: m.subject,
      bodyText: m.text,
      bodyHtml: m.html,
      icsText: m.ics?.content,
      icsFilename: m.ics?.filename,
      provider: "resend",
      status,
      sentAt: this.clock.now().getTime(),
    };
    // Log first so the email history reflects the failed attempt, then fail
    // loudly (house rule: no silent fallbacks).
    await this.log.write(row);
    if (sendError !== null) throw sendError;
  }
}
