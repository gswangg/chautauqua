// DEC-547 amendment (wave 43): the mailer selected when neither dev mode nor
// a full Resend configuration is present. Previously makeMailer THREW at
// construction time -- before any per-recipient try/catch could run -- so
// every send path 500'd with no email_log row written at all (see
// src/routes/comms.ts's per-recipient catch, which the old throw never
// reached). UnconfiguredMailer instead behaves like every other Mailer: it
// logs the attempt (provider 'none', status 'failed') exactly where
// ResendMailer logs, then throws, so callers' existing per-recipient catch
// blocks turn this into a `failed[]` entry instead of a 500.

import { MailNotConfiguredError } from "./types";
import type { EmailLogEntry, EmailLogWriter, Mailer, RenderedEmail } from "./types";

export class UnconfiguredMailer implements Mailer {
  constructor(
    private readonly log: EmailLogWriter,
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async send(m: RenderedEmail): Promise<void> {
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
      provider: "none",
      status: "failed",
      sentAt: this.clock.now().getTime(),
    };
    // Log first (same order as ResendMailer.send), then fail loudly.
    await this.log.write(row);
    throw new MailNotConfiguredError();
  }
}
