// Shared shapes for the J6 onboarding grid (DEC-023 wire contract). Kept
// dependency-free so pure helpers (overdue computation, row filtering) stay
// unit-testable without a DOM.

export type TaskKind = 'general' | 'file_request' | 'form';

export const TASK_KINDS: readonly TaskKind[] = ['general', 'file_request', 'form'];

// DEC-023: assignment status literals are exactly 'pending'/'complete' — the
// admin-facing accept/decline queue states never apply here.
export type AssignmentStatus = 'pending' | 'complete';

export interface OnboardingTask {
  id: string;
  kind: TaskKind;
  title: string;
  dueDate: number | null;
  required: boolean;
}

export interface OnboardingCell {
  taskId: string;
  assignmentId: string;
  status: AssignmentStatus;
  completedAt: number | null;
  fileId: string | null;
  lastRemindedAt: number | null;
}

// DEC-789: closed set written by PATCH /api/v1/submissions/:id/participants/
// :participantId (task-w3-c, mocked here — this file never imports that
// route). ONE exported label vocabulary; every call site reads
// INVITE_STATUS_LABELS[status], never a literal string per site.
export type InviteStatus = 'none' | 'invited' | 'accepted' | 'declined';

export const INVITE_STATUSES: readonly InviteStatus[] = ['none', 'invited', 'accepted', 'declined'];

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  none: 'Not invited',
  invited: 'Invited',
  accepted: 'Confirmed',
  declined: 'Declined',
};

export interface OnboardingContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  hasAccount: boolean;
  // DEC-789: names the PATCH target for this row's invite-status control.
  participantId: string;
  submissionId: string;
  inviteStatus: InviteStatus;
}

export interface OnboardingRow {
  contact: OnboardingContact;
  cells: OnboardingCell[];
}

export interface OnboardingGridCounts {
  speakers: number;
  outstandingRequired: number;
  overdue: number;
  outstandingContacts: number;
}

// GET /api/v1/events/:eventId/onboarding response (DEC-340: server-paginated/
// filtered/searchable roster, superseding the DEC-023 whole-event envelope).
export interface OnboardingGridResponse {
  tasks: OnboardingTask[];
  rows: OnboardingRow[];
  total: number;
  page: number;
  perPage: number;
  counts: OnboardingGridCounts;
}

export interface GridFilterState {
  q: string;
  taskId: string | null;
  status: AssignmentStatus | null;
  overdueOnly: boolean;
  // DEC-789: joins the existing filter pills, carried into the grid request
  // as the same `inviteStatus` query param the server applies as a
  // predicate on the roster row query (src/server/repo/tasks/grid.ts).
  inviteStatus: InviteStatus | null;
}

export const DEFAULT_GRID_FILTERS: GridFilterState = {
  q: '',
  taskId: null,
  status: null,
  overdueOnly: false,
  inviteStatus: null,
};

// DEC-240: meaningful only when kind='file_request' — the content-pipeline
// file kind portal uploads for the task should land as.
export type DeliverableKind = 'presentation' | 'poster' | 'handout';

export const DELIVERABLE_KINDS: readonly DeliverableKind[] = ['presentation', 'poster', 'handout'];

// GET /api/v1/task-assignments/:id/response response (DEC-291).
export interface AssignmentResponseField {
  label: string;
  value: string;
}

export interface AssignmentResponseDetail {
  assignmentId: string;
  taskTitle: string;
  taskKind: TaskKind;
  contact: { id: string; name: string; email: string };
  status: AssignmentStatus;
  completedAt: number | null;
  fields: AssignmentResponseField[];
}

export interface NewTaskInput {
  kind: TaskKind;
  title: string;
  dueDate?: number;
  required: boolean;
  formId?: string;
  deliverableKind?: DeliverableKind;
}

// DEC-398: one entry of the `forms` list additively returned by
// GET /api/v1/events/:eventId/forms — everything the form-task picker
// (TaskModal) needs to let a producer choose a form BY NAME, never by id.
export interface EventForm {
  id: string;
  title: string;
  isDefault: boolean;
}

// SPEC §10 #3 (DEC-441): one rendered draft returned by
// POST /api/v1/events/:eventId/onboarding/remind/preview — subject/text
// are byte-identical to what the real send would produce for that contact.
export interface ReminderDraft {
  contactId: string;
  email: string;
  name: string;
  subject: string;
  text: string;
}
