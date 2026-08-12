// DEC-370: Overview worklist payload v2 (client-side shape). This is the
// SPA's own contract, built independently against DEC-370's text — the
// client lane never imports server modules.

export interface OverviewDeadlines {
  formCloseDate: number | null;
  nextTaskDueDate: number | null;
  planCloseDate: number | null;
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
  format: string;
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

export interface AgendaConflict {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string;
  kind: string;
  entries: AgendaConflictEntry[];
}

export interface UnplacedRow {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
  durationMin: number;
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
}
