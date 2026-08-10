// Shared shapes for the Comms SPA (J5, DEC-019). Matches src/routes/comms.ts.

// The subset of the DEC-006 merge-field whitelist that compose can actually
// resolve (due_date/task_list belong to the DEC-023 reminders pipeline, not
// compose — showing them here would invite an unrenderable template).
export const COMPOSE_MERGE_FIELDS = ['speaker_name', 'talk_title', 'event_name', 'portal_link', 'feedback'] as const;

export interface EmailTemplate {
  id: string;
  eventId: string;
  name: string;
  subject: string;
  bodyText: string;
}

export interface RenderedRecipient {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
  subject: string;
  text: string;
}

export interface EmailLogRow {
  id: string;
  eventId: string;
  eventName: string;
  templateId: string | null;
  contactId: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  icsText: string | null;
  icsFilename: string | null;
  provider: string;
  status: string;
  sentAt: number;
}
