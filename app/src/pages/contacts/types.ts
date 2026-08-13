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
  eventCount: number;
  returningSpeakers: number;
  topCompanies: { company: string; count: number }[];
  // DEC-710/DEC-711: figures the title summary and rail render.
  speakerCount: number;
  duplicateCount: number;
}

export interface ContactSubmissionHistory {
  id: string;
  ref: string;
  title: string;
  eventName: string;
  status: string;
}

export interface ContactEmailHistory {
  id: string;
  subject: string;
  toEmail: string;
  sentAt: number;
}

export interface ContactSocialLinks {
  twitter?: string | null;
  linkedin?: string | null;
  github?: string | null;
  website?: string | null;
}

export interface ContactDetail extends ContactListItem {
  phone?: string | null;
  notes?: string | null;
  bio?: string | null;
  headshotUrl?: string | null;
  socialLinks?: ContactSocialLinks | null;
  customFields?: Record<string, string>;
  history: {
    submissions: ContactSubmissionHistory[];
    emails: ContactEmailHistory[];
    events: string[];
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
export interface DuplicateGroup {
  contactIds: string[];
  contacts: { id: string; firstName: string; lastName: string; email: string; company?: string | null }[];
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
}

export interface PipelineActivity {
  kind: 'move' | 'note';
  body: string | null;
  fromStage: PipelineStage | null;
  toStage: PipelineStage | null;
  authorName: string;
  createdAt: number;
}

export interface PipelineEntryDetail {
  entry: { id: string; contactId: string; stage: PipelineStage; createdAt: number; updatedAt: number };
  contact: { id: string; firstName: string; lastName: string; company?: string | null; email: string };
  activity: PipelineActivity[];
}
