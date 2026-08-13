// Shared shapes for the Comms SPA (J5, DEC-019). Matches src/routes/comms.ts.
// DEC-660: the COMPOSE_MERGE_FIELDS vocabulary lives in ../../lib/merge-fields
// (the one module that crosses the app/ -> src/ boundary), not here.

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
  // DEC-883: present only on /compose/preview responses when feedback was
  // resolved for this recipient -- identifies the merged-feedback paragraph
  // inside `text` for preview chrome. Never sent by /compose/send.
  vars?: { feedback?: string };
}

// DEC-543: narrow list projection returned by GET .../email-log — mirrors
// src/server/repo/email.ts EmailLogListRow. No bodyText/bodyHtml/icsText/
// icsFilename: the API does not send them on the list endpoint, and
// DEC-846's "history owes the WORDS" half is served by the DEC-833
// per-row detail fetch (EmailLogDetail, below) rather than by widening
// this projection back out.
export interface EmailLogRow {
  id: string;
  eventName: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: number;
}

// DEC-833: full stored row for GET .../email-log/:emailId — the "Show what
// was sent" disclosure's response shape, mirrors src/server/repo/email.ts
// EmailLogRow (SELECTED_COLUMNS). Deliberately NOT part of the list
// projection above (DEC-543 stands): fetched one row at a time, on demand.
export interface EmailLogDetail {
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
