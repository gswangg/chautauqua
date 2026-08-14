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

function base64Encode(raw: string): string {
  // btoa is available in both workerd and Node's test runtime; TextEncoder
  // handles non-Latin1 ICS content correctly.
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// RFC 5322 header value safety (DEC-996 wave-62 amendment): strip every
// CR/LF/C0-control byte plus DEL — the same class src/mail/ics.ts sanitizeCn
// strips and for the same reason (a bare CR/LF here would inject a new
// header line, e.g. `Bcc:`, into an outbound message built from
// unauthenticated CFP text). If any non-ASCII byte survives, wrap the
// stripped value as an RFC 2047 base64 encoded-word rather than emit a raw
// byte a header has no business carrying.
function headerValue(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\x00-\x1f\x7f]/g, "");
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7f]/.test(stripped)) {
    const b64 = base64Encode(stripped);
    return `=?UTF-8?B?${b64}?=`;
  }
  return stripped;
}

function sanitizeMimeFilename(filename: string): string {
  return headerValue(filename).replace(/"/g, "");
}

function addressHeader(email: string, name: string | undefined): string {
  const safeName = name ? headerValue(name) : "";
  return safeName.length > 0 ? `"${safeName}" <${email}>` : email;
}

function formatImfDate(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${days[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`
  );
}

function newBoundary(): string {
  return `chq_${crypto.randomUUID()}`;
}

function buildRawMime(from: { email: string; name: string }, m: RenderedEmail, now: Date): string {
  const altBoundary = newBoundary();
  const alt: string[] = [
    `--${altBoundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    base64Encode(m.text),
    "",
    `--${altBoundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    base64Encode(m.html),
    "",
    `--${altBoundary}--`,
  ];

  const domain = from.email.split("@")[1] ?? from.email;
  const headers: string[] = [
    `From: ${addressHeader(from.email, from.name)}`,
    `To: ${addressHeader(m.to.email, m.to.name)}`,
    `Subject: ${headerValue(m.subject)}`,
    `Date: ${formatImfDate(now)}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    `MIME-Version: 1.0`,
  ];

  if (!m.ics) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      ...alt,
    ].join("\r\n");
  }

  const mixedBoundary = newBoundary();
  const safeFilename = sanitizeMimeFilename(m.ics.filename);
  const lines = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    ...alt,
    "",
    `--${mixedBoundary}`,
    `Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="${safeFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    "",
    base64Encode(m.ics.content),
    "",
    `--${mixedBoundary}--`,
  ];
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
    const now = this.clock.now();
    try {
      const raw = buildRawMime(this.from, m, now);
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
      sentAt: now.getTime(),
    };
    // Log first so the email history reflects the failed attempt, then fail
    // loudly (house rule: no silent fallbacks; DEC-923 single-writer
    // discipline — the mailer is the sole author of its own log row).
    await this.log.write(row);
    if (sendError !== null) throw sendError;
  }
}
