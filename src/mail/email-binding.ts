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

import { ADDRESS_FORBIDDEN_RE } from "../domain/email";
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

// RFC 2045 §6.8: base64 body content must be folded at 76 characters per
// line. Unlike src/mail/ics.ts's foldLine (which folds UTF-8 TEXT content
// and must never split a multi-byte character across a boundary), base64
// output is pure ASCII — every character is one octet — so this is a plain
// fixed-width chunk split with no byte-boundary handling needed.
function foldBase64(b64: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += 76) {
    chunks.push(b64.slice(i, i + 76));
  }
  return chunks.join("\r\n");
}

// RFC 2047 §2: an encoded-word (`=?charset?encoding?text?=`) is capped at 75
// characters, and RFC 5322 §2.1.1 caps a header line at 998 octets. The
// wrapper `=?UTF-8?B?` + `?=` costs 12 of those 75 chars, leaving 63 for
// base64 — rounded down to the nearest multiple of 4 (60) so no chunk needs
// mid-word padding, that's 60/4*3 = 45 SOURCE bytes per encoded-word. Split
// on UTF-8 byte boundaries (mirroring src/mail/ics.ts's foldLine) so a
// multi-byte character is never divided across two words, and join
// consecutive words with CRLF + one space per RFC 2047 §5's folding rule —
// this keeps every physical line short while emitting exactly ONE logical
// `Subject:`/`To:` header (continuation lines carry no field name).
const ENCODED_WORD_MAX_SRC_BYTES = 45;

function encodedWordChunks(stripped: string): string[] {
  const bytes = new TextEncoder().encode(stripped);
  const chunks: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + ENCODED_WORD_MAX_SRC_BYTES, bytes.length);
    // Back off if we'd split a multi-byte UTF-8 sequence (continuation
    // bytes have the high bit pattern 10xxxxxx, i.e. 0x80-0xBF).
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
      end -= 1;
    }
    let binary = "";
    for (const b of bytes.slice(start, end)) binary += String.fromCharCode(b);
    chunks.push(`=?UTF-8?B?${btoa(binary)}?=`);
    start = end;
  }
  return chunks;
}

// RFC 5322 header value safety (DEC-996 wave-62 amendment): strip every
// CR/LF/C0-control byte plus DEL — the same class src/mail/ics.ts sanitizeCn
// strips and for the same reason (a bare CR/LF here would inject a new
// header line, e.g. `Bcc:`, into an outbound message built from
// unauthenticated CFP text). If any non-ASCII byte survives, wrap the
// stripped value as one or more folded RFC 2047 base64 encoded-words rather
// than emit a raw byte a header has no business carrying.
function headerValue(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\x00-\x1f\x7f]/g, "");
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7f]/.test(stripped)) {
    return encodedWordChunks(stripped).join("\r\n ");
  }
  return stripped;
}

// RFC 5322 §3.2.4 quoted-string: qtext excludes DQUOTE and backslash — both
// are the quoted-string's own escape/delimiter characters, so leaving them
// in an interpolated `"${name}"` either terminates the quoted-string early
// (unbalanced quote, or worse, closes it and lets the remainder of the
// string be parsed as additional address-list members — the DEC-996
// wave-23 amendment injection) or requires backslash-escaping to survive.
// This file picks ONE answer, strip, and applies it everywhere a value rides
// inside a double-quoted header parameter: the address-header display name
// AND the Content-Disposition filename (sanitizeMimeFilename below), which
// previously only stripped DQUOTE and left backslash untouched — two
// answers in one file for the same class of value.
function stripQuoteChars(s: string): string {
  return s.replace(/["\\]/g, "");
}

function sanitizeMimeFilename(filename: string): string {
  return stripQuoteChars(headerValue(filename));
}

// RFC 5322 §3.4.1 addr-spec: no CR/LF/control bytes, angle brackets, comma,
// semicolon, DQUOTE or whitespace belong in an address interpolated raw
// into `<${email}>` (or `mailto:${email}` in src/mail/ics.ts, which imports
// this). src/domain/email.ts's EMAIL_PATTERN admits `<`, `>`, `,`, `;` in
// the local part, so a stored-valid address like `a,b@c.com` would
// otherwise render as two comma-separated To addresses — this must be
// enforced here, at the serializer boundary, not just at intake.
export function addressValue(email: string): string {
  // ADDRESS_FORBIDDEN_RE has no /g flag (a stateful global regex's .test()
  // in src/domain/email.ts must not carry lastIndex between calls); build a
  // fresh global copy here so every forbidden character is stripped, not
  // just the first.
  return email.replace(new RegExp(ADDRESS_FORBIDDEN_RE.source, "g"), "");
}

function addressHeader(email: string, name: string | undefined): string {
  const safeName = name ? stripQuoteChars(headerValue(name)) : "";
  const safeEmail = addressValue(email);
  return safeName.length > 0 ? `"${safeName}" <${safeEmail}>` : safeEmail;
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

/**
 * wave-82 amendment (DEC-023/DEC-168): the calendar MIME part's `method=`
 * parameter must be derived from the `METHOD:` line inside the ics bytes it
 * is labelling, never hard-coded — a hard-coded REQUEST was only correct
 * while a single caller existed. Fail loudly if the ics content carries no
 * METHOD line at all, rather than silently mislabelling a CANCEL/PUBLISH
 * calendar as a REQUEST.
 */
function icsMethodFromContent(icsContent: string): string {
  const match = /^METHOD:(.+)$/m.exec(icsContent);
  if (!match) {
    throw new Error("icsMethodFromContent: ics content carries no METHOD: line");
  }
  return match[1]!.trim();
}

function buildRawMime(from: { email: string; name: string }, m: RenderedEmail, now: Date): string {
  const altBoundary = newBoundary();
  const alt: string[] = [
    `--${altBoundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    foldBase64(base64Encode(m.text)),
    "",
    `--${altBoundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    foldBase64(base64Encode(m.html)),
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
  const icsMethod = icsMethodFromContent(m.ics.content);
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
    `Content-Type: text/calendar; charset="UTF-8"; method=${icsMethod}; name="${safeFilename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    "",
    foldBase64(base64Encode(m.ics.content)),
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
      // DEC-996-adjacent hygiene: the envelope from/to passed to the binding's
      // message factory is a second address position that must not skip the
      // same sanitizer the From/To HEADERS above (addressHeader) apply — a
      // stored-valid address admitting ADDRESS_FORBIDDEN_RE chars (see
      // src/domain/email.ts's EMAIL_PATTERN comment) must not reach the
      // envelope unstripped while the header above it is clean.
      const message = await this.messageFactory(
        addressValue(this.from.email),
        addressValue(m.to.email),
        raw,
      );
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
