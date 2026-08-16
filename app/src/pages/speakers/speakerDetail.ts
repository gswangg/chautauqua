// GET /api/v1/events/:eventId/speakers/:contactId response shapes (DEC-930).
// Kept in a dedicated file (not speakers/types.ts, which another task owns)
// so this task's wire contract can land without touching that file.

import type { InviteStatus } from './types';

export interface SpeakerDetailContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  hasAccount: boolean;
  phone: string | null;
  notes: string | null;
  headshotFileId: string | null;
}

// DEC-930 amendment (wave 26): cross-event history is a bounded list
// (never an unbounded query on a detail page).
export interface SpeakerDetailOtherEvent {
  eventId: string;
  name: string;
}

export interface SpeakerDetailParticipation {
  participantId: string;
  submissionId: string;
  inviteStatus: InviteStatus;
}

// DEC-936: the person-level rollup -- the single shared status when every
// participation on this contact agrees, else the literal 'mixed' plus one
// row per submission so the header can never assert a status the roster
// beneath it contradicts.
export interface SpeakerDetailParticipationRollupRow {
  participantId: string;
  submissionId: string;
  ref: string;
  inviteStatus: InviteStatus;
}

export interface SpeakerDetailParticipationRollup {
  status: InviteStatus | 'mixed';
  bySubmission: SpeakerDetailParticipationRollupRow[];
}

// DEC-930: SubmissionStatus/ContentStatus are re-declared here as plain
// string unions (not imported from submissions/types.ts or content/types.ts)
// so this file stays a leaf the render test can import without pulling in
// those pages' whole type graphs; the label lookups the page renders
// through (STATUS_LABELS/CONTENT_STATUS_LABELS) are still the SAME shared
// vocabularies those pages already export -- imported, never re-listed.
export type SpeakerDetailSessionStatus =
  | 'pending'
  | 'accept_queue'
  | 'decline_queue'
  | 'accepted'
  | 'declined'
  | 'waitlisted';

export type SpeakerDetailContentStatus = 'pending' | 'approved' | 'changes_requested';

export interface SpeakerDetailScheduled {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
}

export interface SpeakerDetailSession {
  submissionId: string;
  ref: string;
  title: string;
  status: SpeakerDetailSessionStatus;
  contentStatus: SpeakerDetailContentStatus;
  role: string;
  scheduled: SpeakerDetailScheduled | null;
}

export type SpeakerDetailTaskKind = 'general' | 'file_request' | 'form';

export type SpeakerDetailTaskStatus = 'pending' | 'complete';

export interface SpeakerDetailFile {
  id: string;
  filename: string;
  sizeBytes: number;
  versionNo: number;
}

export interface SpeakerDetailTask {
  assignmentId: string;
  taskId: string;
  title: string;
  kind: SpeakerDetailTaskKind;
  required: boolean;
  dueDate: number | null;
  status: SpeakerDetailTaskStatus;
  completedAt: number | null;
  file: SpeakerDetailFile | null;
}

export interface SpeakerDetailCounts {
  outstandingRequired: number;
  overdue: number;
}

export interface SpeakerDetailResponse {
  contact: SpeakerDetailContact;
  participation: SpeakerDetailParticipation;
  participationRollup: SpeakerDetailParticipationRollup;
  sessions: SpeakerDetailSession[];
  tasks: SpeakerDetailTask[];
  counts: SpeakerDetailCounts;
  otherEvents: SpeakerDetailOtherEvent[];
  otherEventsCount: number;
}
