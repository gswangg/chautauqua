// Overview worklist payload types (DEC-030, DEC-370, DEC-400). Split out of
// overview.ts (which grew past 800 lines and became a merge-conflict
// hotspot) so type-only edits don't collide with query/aggregation edits.
// No behavior lives here — pure interface/type declarations only.
//
// DEC-400 (wire keys): the v1 aggregate {pending, accept_queue,
// decline_queue} ships under the key `triage-counts` (the nav badge and
// app/src/pages/overview/cards.ts read `payload['triage-counts'].pending`),
// and the v2 "submissions awaiting triage" rows section ships under the
// plain key `triage` (per DEC-370's prose). This resolves the DEC-370
// collision between the two sections that both wanted the name `triage`;
// app/src/pages/overview/types.ts is the client-side contract of record for
// these wire keys and is pinned against these types by
// test/overview-payload-contract.test.ts.

import type { Conflict } from "../../../domain/schedule";

export interface OverviewPayload {
  "triage-counts": { pending: number; accept_queue: number; decline_queue: number };
  review: { plans: number; evaluationsSubmitted: number; evaluationsExpected: number };
  speakers: { contactsOwing: number; overdueAssignments: number };
  content: { awaitingApproval: number };
  agenda: { unplaced: number; conflicts: number };
  comms: { sentLast7Days: number; lastSentAt: number | null };
}

export interface OverviewDeadlines {
  formCloseDate: number | null;
  nextTaskDueDate: number | null;
  planCloseDate: number | null;
  // DEC-704: the round of the plan that owns `planCloseDate` (the soonest
  // non-null close date), so the "Review wave" cell can name it. Null when
  // there's no plan with a close date to attribute a round to.
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

export interface TriageQueueRow {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
  trackName: string | null;
  // No schema field backs a per-submission "format" (Talk/Workshop/...);
  // DEC-370 names the key but nothing stores the value (SPEC.md's only
  // mention of "format" is a hypothetical CFP form field, not a fixed
  // column). Always null — flagged as an open gap, never fabricated.
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

/** DEC-652: the concrete "move it" suggestion for a conflict's later entry
 * — a real slot nextFreeSlot found, never invented prose. Null whenever
 * nextFreeSlot couldn't find one (e.g. no other room to move into). */
export interface ConflictResolution {
  submissionId: string;
  ref: string;
  day: string;
  startMin: number;
  roomId: string;
  roomName: string;
  label: string;
}

export interface ConflictRow {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
  kind: Conflict["kind"];
  entries: { submissionId: string; ref: string; title: string; speakerName: string }[];
  resolution: ConflictResolution | null;
}

/** DEC-652: the concrete "place it" suggestion for an unplaced row — a real
 * slot nextFreeSlot found, never invented prose. Null whenever nextFreeSlot
 * couldn't find one (e.g. no rooms in use yet). */
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
  // No stored per-submission session length (autoSchedule takes an
  // organizer-supplied defaultDurationMin at call time, never persisted) —
  // always null, flagged as an open gap rather than fabricated.
  durationMin: number | null;
  suggestion: PlacementSuggestion | null;
}

export interface OverviewPayloadV2 extends OverviewPayload {
  deadlines: OverviewDeadlines;
  overdueTasks: { total: number; rows: OverdueTaskRow[] };
  triage: { total: number; oldestSubmittedAt: number | null; rows: TriageQueueRow[] };
  contentApproval: { total: number; reuploadedCount: number; rows: ContentApprovalRow[] };
  agendaWork: {
    unplacedTotal: number;
    conflictTotal: number;
    conflicts: ConflictRow[];
    unplaced: UnplacedRow[];
  };
}

export interface ConflictSessionInfo {
  day: string;
  startMin: number;
  endMin: number;
  roomId: string | null;
  ref: string;
  title: string;
  speakerName: string;
}

export interface NextFreeSlotParams {
  dayStartMin: number;
  dayEndMin: number;
  gridMin: number;
  defaultDurationMin: number;
}

export interface FileRowForPick {
  id: string;
  submissionId: string;
  filename: string;
  previousFileId: string | null;
  createdAt: number;
}

export interface LeadSpeakerRow {
  submissionId: string;
  order: number;
  contactId: string;
  name: string;
}
