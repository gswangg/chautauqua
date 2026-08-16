// Shared shapes for the Comms SPA (J5, DEC-019). Matches src/routes/comms.ts.
// DEC-660: the COMPOSE_MERGE_FIELDS vocabulary lives in ../../lib/merge-fields
// (the one module that crosses the app/ -> src/ boundary), not here.
import type { SendResult } from '../../lib/sendResult';

// DEC-238 amendment (wave 3): compose/send's per-recipient dedupe skip list.
// The shared SendResult's `skipped` is a bare count (task/plan-remind
// surfaces) -- compose/send instead names each skipped recipient
// individually, since B1 requires the step-4 report to disclose WHO was
// skipped and WHEN they become eligible again, never a fabricated field.
// Defaults to [] on the client so a server that hasn't landed this field
// yet renders zero skipped lines and zero fabricated copy.
export interface ComposeSkippedRecipient {
  email: string;
  name: string;
  submissionId: string;
  // DEC-238 wave-15 amendment: 'duplicate_in_batch' is the intra-batch stage
  // (mirrors bulk-email.ts) — two renders of the same message inside ONE
  // call. It has no retryAtIso: there is no window to wait out, the second
  // occurrence is simply not resent.
  reason: 'already_sent_recently' | 'duplicate_in_batch';
  retryAtIso?: string;
}

export type ComposeSendResult = Omit<SendResult, 'skipped'> & {
  skipped?: ComposeSkippedRecipient[];
};

// wave-60 amendment (DEC-238, P1 cluster 4): /compose/preview's dedupe plan
// summary — the same arithmetic /compose/send is about to run against the
// same input. `willSend` is the number the wizard's primary Send button
// must display; ComposeSendResult.sent + .failed + .skipped is the number
// the SAME denominator uses after send actually runs.
export interface ComposePreviewPlan {
  willSend: number;
  skipped: ComposeSkippedRecipient[];
}

export interface EmailTemplate {
  id: string;
  eventId: string;
  name: string;
  subject: string;
  bodyText: string;
  // DEC-890: derived from email_log (MAX(sent_at) for this template), never
  // a stored column. Null when no logged send has ever named this template.
  lastUsedAt?: number | null;
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

// wave-60 amendment (DEC-238, P1 cluster 4): per-item send disposition,
// computed by the same src/domain/comms-dedupe.ts planComposeSends planner
// /compose/send runs — so the preview step can name, per recipient, whether
// THIS render will send or be skipped (and why), never just a raw count.
export interface RenderedRecipient {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
  // Present on every /compose/preview item (absent on /compose/send, which
  // never returns `items` at all per DEC-949). true when this recipient is
  // not currently held back by either dedupe stage.
  willSend?: boolean;
  skipReason?: 'already_sent_recently' | 'duplicate_in_batch';
  retryAtIso?: string;
  // DEC-912: the talk's human ref (e.g. 'DFC-014') and whether it has a
  // schedule slot, populated unconditionally on every rendered recipient —
  // never gated on attachIcs. `ics` (below) stays gated: it's the
  // attachment payload, not the fact of scheduling.
  ref: string;
  scheduled: boolean;
  subject: string;
  text: string;
  // DEC-037 amendment: the fully rendered HTML the /compose/send call would
  // wrap this recipient's body in (same shared shell helper). Preview-only —
  // /compose/send never returns rendered bodies (DEC-949).
  html?: string;
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
  // w41-g (DEC-751 amendment): the template that produced this batch, or
  // null for a hand-written send with no template. Paired with the
  // component's templatesById map to name the template, or an em dash.
  templateId: string | null;
}
