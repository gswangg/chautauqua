// DEC-766: a failed send is still auditable. A mailer.send() rejection must
// leave an email_log row behind — a batch that's entirely rejected should
// read as N failed attempts in comms history, not as an absent/'0 total'
// batch (an attempt that leaves no row is exactly the failure the audit
// needs to catch). DevSinkMailer/EmailBindingMailer only write on their own
// success path (or, for EmailBindingMailer, log-then-rethrow on failure);
// this helper is the route-level counterpart for a rejection the mailer
// itself never got to log, so the fan-out's catch block can still produce a
// row sharing the attempted message's batchId/eventId/contactId/etc.

import type { EmailLogEntry, EmailLogWriter, RenderedEmail } from "./types";

export async function logFailedSend(
  writer: EmailLogWriter,
  rendered: RenderedEmail,
  provider: string,
  reason: unknown,
  clock: { now(): Date } = { now: () => new Date() },
): Promise<void> {
  console.error("mailer.send rejected for", rendered.to.email, reason);
  const row: EmailLogEntry = {
    eventId: rendered.eventId,
    contactId: rendered.contactId,
    templateId: rendered.templateId,
    batchId: rendered.batchId ?? null,
    toEmail: rendered.to.email,
    toName: rendered.to.name,
    subject: rendered.subject,
    bodyText: rendered.text,
    bodyHtml: rendered.html,
    icsText: rendered.ics?.content,
    icsFilename: rendered.ics?.filename,
    provider,
    status: "failed",
    sentAt: clock.now().getTime(),
  };
  await writer.write(row);
}
