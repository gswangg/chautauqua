// Mail port (DEC-006): pure interfaces, no node:/cloudflare imports (DEC-002).

export interface RenderedEmail {
  to: { email: string; name: string };
  subject: string;
  text: string;
  html: string;
  ics?: { filename: string; content: string };
  templateId?: string;
  eventId: string;
  contactId: string;
}

export interface Mailer {
  send(m: RenderedEmail): Promise<void>;
}

// Columns per DEC-006: subject, body_text, body_html, ics_text, provider,
// status, sent_at (plus identifying/routing fields carried on RenderedEmail).
export interface EmailLogEntry {
  eventId: string;
  contactId: string;
  templateId?: string;
  toEmail: string;
  toName: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  icsText?: string;
  // Stored so the dev mailbox download link (DEC-005/§6) can serve the
  // original filename rather than a synthesized one. Additive column;
  // DEC-006's column list predates this need (see migrations/0002).
  icsFilename?: string;
  provider: string;
  status: string;
  sentAt: number;
}

export interface EmailLogWriter {
  write(row: EmailLogEntry): Promise<void>;
}
