// Production mailer (DEC-996 amendment, wave 57): sends through the
// Cloudflare Email Service `send_email` Worker binding — no API keys, no
// vendor account. Pure-core per DEC-002: no `cloudflare:email` import here;
// the binding and the message factory that turns a raw MIME string into
// whatever object `binding.send` expects are both injected, so this file
// compiles and tests without a worker runtime. The composition root
// (src/server/context.ts) is the only place that imports `cloudflare:email`
// (lazily) to build the real factory.
//
// `send` builds a raw RFC 5322 message itself (multipart/alternative
// text+html, plus an additional base64 text/calendar part when `m.ics` is
// set) since the binding's contract is `send(new EmailMessage(from, to,
// raw))` — a MIME string, not a structured {html, text, attachments} object.

import type { EmailLogEntry, EmailLogWriter, Mailer, RenderedEmail } from "./types";

/** Structural shape of the Email Service binding (env.EMAIL). */
export interface EmailBinding {
  send(message: unknown): Promise<unknown>;
}

/** Turns a raw MIME string into whatever object `binding.send` expects
 * (production: `new EmailMessage(from, to, raw)`; tests: an inspectable
 * plain object). May return a Promise — EmailBindingMailer awaits it. */
export type EmailMessageFactory = (from: string, to: string, raw: string) => unknown;

const BOUNDARY = "chq_mime_boundary";

function base64Encode(raw: string): string {
  // btoa is available in both workerd and Node's test runtime; TextEncoder
  // handles non-Latin1 ICS content correctly.
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function buildRawMime(fromHeader: string, toEmail: string, m: RenderedEmail): string {
  const lines: string[] = [
    `From: ${fromHeader}`,
    `To: ${toEmail}`,
    `Subject: ${m.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${BOUNDARY}"`,
    "",
    `--${BOUNDARY}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    m.text,
    "",
    `--${BOUNDARY}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    m.html,
    "",
  ];
  if (m.ics) {
    lines.push(
      `--${BOUNDARY}`,
      `Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="${m.ics.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${m.ics.filename}"`,
      "",
      base64Encode(m.ics.content),
      "",
    );
  }
  lines.push(`--${BOUNDARY}--`);
  return lines.join("\r\n");
}

export class EmailBindingMailer implements Mailer {
  constructor(
    private readonly binding: EmailBinding,
    private readonly log: EmailLogWriter,
    private readonly from: { email: string; name: string },
    private readonly messageFactory: EmailMessageFactory,
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async send(m: RenderedEmail): Promise<void> {
    let status = "sent";
    let sendError: unknown = null;
    const fromHeader = `${this.from.name} <${this.from.email}>`;
    try {
      const raw = buildRawMime(fromHeader, m.to.email, m);
      const message = await this.messageFactory(this.from.email, m.to.email, raw);
      await this.binding.send(message);
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
      provider: "cloudflare",
      status,
      sentAt: this.clock.now().getTime(),
    };
    // Log first so the email history reflects the failed attempt, then fail
    // loudly (house rule: no silent fallbacks; DEC-923 single-writer
    // discipline — the mailer is the sole author of its own log row).
    await this.log.write(row);
    if (sendError !== null) throw sendError;
  }
}
