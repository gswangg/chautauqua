// GET /api/v1/events/:eventId/speakers/:contactId response shapes (DEC-930).
// Kept in a dedicated file (not speakers/types.ts, which another task owns)
// so this task's wire contract can land without touching that file.

import type { InviteStatus } from './types';
// Alias of the shared vocabulary (DEC-613 wave-70 amendment) —
// src/domain/task-kinds.ts is the ONE declaration.
import type { TaskKind } from '../../../../src/domain/task-kinds';

export interface SpeakerDetailContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  hasAccount: boolean;
  phone: string | null;
  notes: string | null;
  // DEC-738 amendment (wave 71): the person's org-wide logistics facts --
  // same customFields record the CRM Contacts drawer edits, not an
  // event-scoped copy.
  customFields: Record<string, string>;
  headshotFileId: string | null;
  // DEC-738 amendment (wave 75): the bio and social links the speaker wrote
  // through their portal profile -- same org-wide contact facts the public
  // speaker page shows, projected here read-only (the CRM drawer stays the
  // one place they're edited).
  bio: string | null;
  socialLinks: { label: string; url: string }[];
}

// DEC-930 amendment (wave 26): cross-event history is a bounded list
// (never an unbounded query on a detail page).
export interface SpeakerDetailOtherEvent {
  eventId: string;
  name: string;
  // DEC-829 wave-110 amendment: the rail's second line ("Spoke · <title>",
  // "Submitted, declined"); absent when the submission has no decided
  // state to speak of.
  participation: string | null;
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

// DEC-930 (see SpeakerDetailSessionStatus above): same leaf-module reasoning
// applies to the content-status half of this file's re-declared pair.
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

export type SpeakerDetailTaskKind = TaskKind;

export type SpeakerDetailTaskStatus = 'pending' | 'complete';

export interface SpeakerDetailFile {
  id: string;
  filename: string;
  sizeBytes: number;
  versionNo: number;
  // DEC-930 (amendment, wave 115): every Files row states who put the file
  // there and when. uploaderName is null when the file row records no
  // uploader -- rendered as a dash, never guessed at.
  uploadedAt: number;
  uploaderName: string | null;
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
  // Design pack v12: the reminder-history qualifier the row's Remind link
  // reads. null means never reminded.
  lastRemindedAt: number | null;
  // Design pack v12 (wave 118 amendment): the frame's ordinal ("Remind ·
  // never sent" / "sent once" / "Nth time") -- how many reminder emails
  // fell inside THIS assignment's active window, derived server-side from
  // email_log (repo/tasks/speaker-detail.ts, sharing task-view.ts's
  // countRemindSends windowing rule). Never fabricated: a reminder email
  // names every outstanding task it was sent for.
  remindCount: number;
  file: SpeakerDetailFile | null;
  // User-filed (speaker detail, Elliot Ekström): lateness per ROW, not only
  // as a header count. Server-derived from the same DEC-801 predicate result
  // the count is (repo/tasks/speaker-detail.ts) -- the client cannot judge it
  // here, since neither the assignment's creation instant nor the event's
  // timezone crosses this wire.
  overdue: boolean;
}

export interface SpeakerDetailCounts {
  outstandingRequired: number;
  overdue: number;
  // Design pack v12 (wave 118 amendment): the header's "Reminded N× · last
  // <date>" caption's N -- every reminder email this contact received on
  // this event across every task, counted once each (not a sum of the
  // per-task remindCount above, which would double-count a single send that
  // named several tasks).
  remindCount: number;
}

export interface SpeakerDetailResponse {
  contact: SpeakerDetailContact;
  // DEC-930 (amendment, wave 115): the contact's CURRENT headshot as a file
  // object, so the Files section can list it like any other row instead of
  // reducing it to an avatar and a bare Download. Null when there is none.
  // Headshots have no version chain (setContactHeadshot never sets
  // previousFileId), so this is one row and never a history.
  headshotFile: SpeakerDetailFile | null;
  participation: SpeakerDetailParticipation;
  participationRollup: SpeakerDetailParticipationRollup;
  sessions: SpeakerDetailSession[];
  tasks: SpeakerDetailTask[];
  counts: SpeakerDetailCounts;
  otherEvents: SpeakerDetailOtherEvent[];
  otherEventsCount: number;
}
