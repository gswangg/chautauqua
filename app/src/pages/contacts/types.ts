// Shared shapes for the Contacts/CRM SPA (J11), matching the DEC-026 wire
// contract for src/routes (w4-c, in flight in parallel — this file is the
// SPA's own mirror, not a cross-package import).

export interface ContactListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string | null;
  title?: string | null;
  submissionCount?: number;
  // DEC-738/DEC-726: the contact's customFields, formatted server-side as
  // "`key` `value`" strings (src/domain/contact-labels.ts's contactLabels;
  // supersedes DEC-712's derived participation-role labels).
  labels: string[];
}

export interface ContactStats {
  total: number;
  topCompanies: { company: string; count: number }[];
  // DEC-710/DEC-711: figures the title summary renders.
  // duplicateCount is NOT here (wave 41 amendment): callers source it from
  // the /contacts/duplicates envelope's `total` instead of a second scan.
  speakerCount: number;
  // DEC-432/DEC-809: a contact holding an active 'speaker' role on more than
  // one of this org's events, and the number of distinct such events — the
  // headline's returning/reach clauses render only when each is "worth
  // saying" (>0 and >1 respectively).
  returningSpeakers: number;
  eventCount: number;
}

export interface ContactSubmissionHistory {
  id: string;
  ref: string;
  title: string;
  // DEC-795: a name is not an identity -- carried alongside eventName so a
  // consumer can test "is this THE selected event" without string-matching.
  eventId: string;
  eventName: string;
  status: string;
}

export interface ContactEmailHistory {
  id: string;
  subject: string;
  toEmail: string;
  sentAt: number;
}

// DEC-152 (wave-76 amendment): the server always emits all four keys as
// strings (parseSocialLinks never returns null/undefined members) -- this
// type describes what the wire actually produces, not a defensive superset.
export interface ContactSocialLinks {
  twitter: string;
  linkedin: string;
  github: string;
  website: string;
}

export interface ContactDetail extends ContactListItem {
  phone?: string | null;
  notes?: string | null;
  bio?: string | null;
  headshotUrl?: string | null;
  // DEC-894: filename + upload date of the stored headshot file, printed
  // beside the image in the Contacts drawer. null when there is no headshot.
  headshotFile?: { filename: string; uploadedAt: number } | null;
  socialLinks: ContactSocialLinks;
  // DEC-738 (wave-77 amendment): the server always emits an object here
  // (src/server/repo/contacts/crud.ts's parseContactCustomFields never
  // returns null/undefined) -- this type describes what the wire actually
  // produces, not a defensive superset.
  customFields: Record<string, string>;
  history: {
    submissions: ContactSubmissionHistory[];
    // w56-c: total submission count across ALL events, distinct from
    // submissions.length once the list is capped (DEC-026 amendment) — the
    // drawer names the shortfall rather than presenting a truncated list as
    // complete.
    submissionsTotal: number;
    emails: ContactEmailHistory[];
    // w52-f: total email-log count across ALL events, distinct from
    // emails.length once the list is capped -- mirrors submissionsTotal.
    emailsTotal: number;
    events: string[];
    // w47-f: total distinct-event count across the full join, distinct from
    // events.length once the list is capped -- mirrors emailsTotal.
    eventsTotal: number;
  };
}

export interface SegmentRule {
  field: string;
  op: 'eq' | 'ne' | 'contains';
  value: string;
}

export interface Segment {
  id: string;
  name: string;
  rules: SegmentRule[];
  // DEC-710: computed with the SAME segment-rule where clause the
  // directory list uses (GET /segments), never a second definition.
  count: number;
}

// Matches the server's DuplicateGroup shape verbatim (src/server/repo/
// contacts.ts) — {contactIds, contacts}, not {ids, contacts}. A client/server
// drift here (w1-c P1, DEC-239) let a TypeError escape outside the merge
// try/catch and hang the merge dialog with no visible error.
// DEC-800: why the pair/group was surfaced -- an exact email match, a
// same-name-same-company match (DEC-143), or a same-name-different-company
// match (a person who changed employers).
export type DuplicateReason = 'email' | 'name_and_company' | 'name';

export interface DuplicateGroup {
  contactIds: string[];
  reason: DuplicateReason;
  contacts: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company?: string | null;
    // DEC-734: carried so the merge page's identity columns stop rendering
    // '—' for a field the directory already shows -- never a second by-ids
    // fetch.
    title?: string | null;
    // DEC-992: the merge compare table's "added <date>" column-head vintage.
    createdAt: number;
  }[];
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: { line: number; reason: string }[];
  // DEC-290: present when the import request carried an `eventId` (roster
  // import from the Speakers page) -- the imported/matched contact ids and
  // how many of them were newly pushed onto that event's roster.
  contactIds?: string[];
  addedToEvent?: number;
}

// DEC-663: a CSV import is PLANNED before it is applied. A dry-run POST
// (dryRun: true) returns an ImportPlan naming, per row, what the commit
// WOULD do -- created/updated/skipped here are INTENT counts, not the
// post-commit truth (that stays ImportResult, counted after commit, above).
export interface ImportOverwrite {
  field: string;
  from: string;
  to: string;
}

export interface ImportPossibleDuplicate {
  contactId: string;
  name: string;
  email: string;
  company?: string | null;
}

export interface ImportPlanRow {
  line: number;
  email: string;
  action: 'create' | 'update' | 'skip';
  reason?: string;
  contactId?: string;
  overwrites?: ImportOverwrite[];
  possibleDuplicates?: ImportPossibleDuplicate[];
  // DEC-663 (wave-64 amendment): possibleDuplicates is capped server-side;
  // this names how many additional candidates were found but not sent, so
  // the Review step can say so honestly rather than presenting the capped
  // list as complete.
  possibleDuplicatesMore?: number;
}

export interface ImportPlan {
  rows: ImportPlanRow[];
  created: number;
  updated: number;
  skipped: number;
}

// DEC-660: the BULK_EMAIL_MERGE_FIELDS vocabulary and the recipient cap
// (mirroring src/domain/compose.ts's MAX_COMPOSE_RECIPIENTS) live in
// ../../lib/merge-fields (the one module that crosses the app/ -> src/
// boundary), not here.

// CRM sourcing pipeline (CRM-07/08, DEC-157): fixed five-stage kanban.
export const PIPELINE_STAGES = ['identified', 'contacted', 'interested', 'confirmed', 'declined'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  interested: 'Interested',
  confirmed: 'Confirmed',
  declined: 'Declined',
};

export interface PipelineEntry {
  id: string;
  contactId: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  email: string;
  stage: PipelineStage;
  updatedAt: number;
  // DEC-803: the moment this entry entered its current stage (only a move
  // writes updatedAt, so it IS that moment) and, for a 'declined' entry, the
  // reason recorded when it was declined -- null for every other stage.
  stageSince: number;
  declineReason: string | null;
  // DEC-821: fit score (1-5) and a one-line rationale, both nullable --
  // absence is a visible 'Unrated' state, never an implied zero. Fit ranks
  // cards WITHIN a stage column only; it never crosses stages.
  fitScore: number | null;
  rationale: string | null;
}

export interface PipelineActivity {
  kind: 'move' | 'note';
  body: string | null;
  fromStage: PipelineStage | null;
  toStage: PipelineStage | null;
  authorName: string;
  createdAt: number;
}

// DEC-013 house list envelope (w56-e): the entry detail's activity feed is
// paged server-side (src/routes/api/pipeline.ts's GET /pipeline/:id), never
// the whole unbounded history in one response.
export interface PipelineActivityEnvelope {
  items: PipelineActivity[];
  total: number;
  page: number;
  perPage: number;
}

export interface PipelineEntryDetail {
  entry: { id: string; contactId: string; stage: PipelineStage; createdAt: number; updatedAt: number };
  contact: { id: string; firstName: string; lastName: string; company?: string | null; email: string };
  activity: PipelineActivityEnvelope;
}
