// Stage-1 mailer implementation (DEC-006): writes rendered content to an
// injected EmailLogWriter instead of sending real mail. Viewable at
// /dev/mailbox in the app layer.

import type { EmailLogEntry, EmailLogWriter, Mailer, RenderedEmail } from "./types";

export class DevSinkMailer implements Mailer {
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
      provider: "dev",
      status: "sent",
      sentAt: this.clock.now().getTime(),
    };
    await this.log.write(row);
  }
}

// Test double: an in-memory EmailLogWriter for exercising DevSinkMailer and
// route handlers without a D1 binding.
export class InMemoryEmailLog implements EmailLogWriter {
  readonly rows: EmailLogEntry[] = [];

  async write(row: EmailLogEntry): Promise<void> {
    this.rows.push(row);
  }
}
