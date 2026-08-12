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

// DEC-051: present only when the compose request set attachIcs: true and
// the server was able to resolve a scheduled slot for this recipient's
// submission. startUtc/endUtc reuse the same slot-conversion the public
// schedule.ics uses; room is omitted (or empty) for the initial invite
// before a room lands, and sequence bumps by 1 each subsequent send.
export interface RenderedRecipientIcs {
  startUtc: string;
  endUtc: string;
  room?: string | null;
  sequence: number;
  // DEC-494: the OWNING EVENT's IANA timezone, so the preview chip renders
  // the session's local time instead of the viewer's ambient machine zone.
  timeZone: string;
}

export interface RenderedRecipient {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
  subject: string;
  text: string;
  ics?: RenderedRecipientIcs;
}

// DEC-543: narrow list projection returned by GET .../email-log — mirrors
// src/server/repo/email.ts EmailLogListRow. No bodyText/bodyHtml/icsText/
// icsFilename: HistoryTab.tsx never renders them, and the API no longer
// sends them on the list endpoint.
export interface EmailLogRow {
  id: string;
  eventName: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: number;
}

// DEC-603: one row per batch (a fan-out send's shared batch_id, or a legacy/
// NULL-batch row's own id) — mirrors src/server/repo/email.ts EmailBatchRow.
// GET .../email-log?groupBy=batch returns these; ?batchId=<batchKey> drills
// into that batch's EmailLogRow recipients.
export interface EmailBatchRow {
  batchKey: string;
  subject: string;
  sentAt: number;
  recipientCount: number;
  statusCounts: Record<string, number>;
}
