// Production mailer (stage 2): sends through the Cloudflare Email Service
// `send_email` Worker binding — no API keys; the from-domain (chautauqua.cc)
// is onboarded to Email Sending with SPF/DKIM/DMARC provisioned in the zone.
// Pure-core per DEC-002: structural interface only, no cloudflare imports.
// .ics attachments ride as raw-string content with type text/calendar (the
// binding treats string content as raw, not base64).

import type { EmailLogEntry, EmailLogWriter, Mailer, RenderedEmail } from "./types";

/** Structural shape of the Email Service binding (env.EMAIL). Matches the
 * workerd runtime binding; kept structural so pure-core code and tests need
 * no cloudflare types. */
export interface EmailSender {
  send(msg: {
    to: { email: string; name?: string };
    from: { email: string; name?: string };
    subject: string;
    html: string;
    text: string;
    attachments?: Array<{
      content: string;
      filename: string;
      type: string;
      disposition: "attachment" | "inline";
    }>;
  }): Promise<unknown>;
}

export class EmailBindingMailer implements Mailer {
  constructor(
    private readonly email: EmailSender,
    private readonly log: EmailLogWriter,
    private readonly from: { email: string; name: string },
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async send(m: RenderedEmail): Promise<void> {
    let status = "sent";
    let sendError: unknown = null;
    try {
      await this.email.send({
        to: { email: m.to.email, name: m.to.name },
        from: this.from,
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.ics
          ? {
              attachments: [
                {
                  content: m.ics.content,
                  filename: m.ics.filename,
                  type: "text/calendar",
                  disposition: "attachment" as const,
                },
              ],
            }
          : {}),
      });
    } catch (err) {
      status = "error";
      sendError = err;
    }
    const row: EmailLogEntry = {
      eventId: m.eventId,
      contactId: m.contactId,
      templateId: m.templateId,
      toEmail: m.to.email,
      toName: m.to.name,
      subject: m.subject,
      bodyText: m.text,
      bodyHtml: m.html,
      icsText: m.ics?.content,
      icsFilename: m.ics?.filename,
      provider: "cloudflare-email",
      status,
      sentAt: this.clock.now().getTime(),
    };
    // Log first so the email history reflects the failed attempt, then fail
    // loudly (house rule: no silent fallbacks).
    await this.log.write(row);
    if (sendError !== null) throw sendError;
  }
}
