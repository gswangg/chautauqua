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
}

export interface ContactStats {
  total: number;
  eventCount: number;
  returningSpeakers: number;
  topCompanies: { company: string; count: number }[];
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
}

export interface DuplicateGroup {
  ids: string[];
  contacts: ContactListItem[];
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: { line: number; reason: string }[];
}

export const BULK_EMAIL_MERGE_FIELDS = ['speaker_name', 'event_name', 'portal_link'] as const;

export const BULK_EMAIL_RECIPIENT_CAP = 100;

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
