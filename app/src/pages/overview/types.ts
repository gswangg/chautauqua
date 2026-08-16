// DEC-370: Overview worklist payload v2 (client-side shape). This is the
// SPA's own contract, built independently against DEC-370's text — the
// client lane never imports server modules.

export interface OverviewDeadlines {
  formCloseDate: number | null;
  nextTaskDueDate: number | null;
  planCloseDate: number | null;
  // DEC-704: round of the plan owning `planCloseDate`, null when absent.
  planRound: number | null;
  eventStartDate: number | null;
}

export interface OverdueTaskRow {
  assignmentId: string;
  contactId: string;
  contactName: string;
  company: string | null;
  taskId: string;
  taskTitle: string;
  dueDate: number;
  daysLate: number;
}

export interface TriageRow {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
  trackName: string | null;
  format: string | null;
  submittedAt: number;
}

export interface ContentApprovalRow {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
  fileName: string;
  uploadedAt: number;
  reuploaded: boolean;
}

export interface AgendaConflictEntry {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
}

// DEC-652: the concrete "move it" resolution for a conflict's later entry —
// a real slot the server's nextFreeSlot found, never invented by the UI.
// roomName is always non-null here: scheduling.ts:101 falls back to
// `slot.roomId` when a room-name lookup misses, so this field never carries
// the server's `null` absence case. Do not re-widen without re-checking that.
export interface ConflictResolution {
  submissionId: string;
  ref: string;
  day: string;
  startMin: number;
  roomId: string;
  roomName: string;
  label: string;
}

// DEC-615 (wave 71 amendment): closed vocabulary mirroring
// src/domain/schedule.ts's ConflictKind — re-exported from the
// schedule-vocabulary crossing module so this type can never drift from
// the server union (this file had hand-written its own copy, which is
// exactly the drift DEC-615 exists to prevent).
import type { ConflictKind } from '../../lib/schedule-vocabulary';
export type { ConflictKind };

export interface AgendaConflict {
  day: string;
  startMin: number;
  endMin: number;
  // Nullable: mirrors src/server/repo/overview/types.ts's ConflictRow.roomName
  // (the server is the authority — scheduling.ts emits `null` when the
  // conflicting assignment carries no roomId).
  roomName: string | null;
  kind: ConflictKind;
  entries: AgendaConflictEntry[];
  resolution: ConflictResolution | null;
}

// DEC-652: the concrete "place it" suggestion for an unplaced row — a real
// slot the server's nextFreeSlot found, never invented by the UI.
// roomName is always non-null here: scheduling.ts:167 falls back to
// `slot.roomId` when a room-name lookup misses, so this field never carries
// the server's `null` absence case. Do not re-widen without re-checking that.
export interface PlacementSuggestion {
  day: string;
  startMin: number;
  roomId: string;
  roomName: string;
  label: string;
}

export interface UnplacedRow {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
  // DEC-895: the submission's own session-format answer, null when absent.
  format: string | null;
  // DEC-772/DEC-895: server-derived from `format` — null when the format is
  // absent or carries no parseable duration. The client never re-derives
  // this itself.
  durationMin: number | null;
  suggestion: PlacementSuggestion | null;
}

// v1 aggregate keys, RETAINED verbatim per DEC-370. `triage` collides with
// the v2 `triage` key above, so on the wire it lands as `triage-counts`.
export interface TriageCountsAggregate {
  pending: number;
  accept_queue: number;
  decline_queue: number;
}

export interface ReviewAggregate {
  plans: number;
  evaluationsSubmitted: number;
  evaluationsExpected: number;
}

export interface SpeakersAggregate {
  contactsOwing: number;
  overdueAssignments: number;
}

export interface ContentAggregate {
  awaitingApproval: number;
}

export interface AgendaAggregate {
  unplaced: number;
  conflicts: number;
}

export interface CommsAggregate {
  sentLast7Days: number;
  lastSentAt: number | null;
}

export interface OverviewPayload {
  deadlines: OverviewDeadlines;
  overdueTasks: { total: number; rows: OverdueTaskRow[] };
  triage: { total: number; oldestSubmittedAt: number | null; rows: TriageRow[] };
  contentApproval: { total: number; reuploadedCount: number; rows: ContentApprovalRow[] };
  agendaWork: {
    unplacedTotal: number;
    conflictTotal: number;
    conflicts: AgendaConflict[];
    unplaced: UnplacedRow[];
  };
  'triage-counts': TriageCountsAggregate;
  review: ReviewAggregate;
  speakers: SpeakersAggregate;
  content: ContentAggregate;
  agenda: AgendaAggregate;
  comms: CommsAggregate;
  // DEC-370 amendment (wave 5): server-composed count backing the "Public
  // pages" quiet row's summary clause — never a client-side literal.
  publishedSessionCount: number;
}
