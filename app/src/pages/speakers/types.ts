// Shared shapes for the J6 onboarding grid (DEC-023 wire contract). Kept
// dependency-free so pure helpers (overdue computation, row filtering) stay
// unit-testable without a DOM.

// DEC-928: re-exported from the pure core (src/domain/files.ts) so the
// onboarding task deliverable-kind vocabulary can never desync from the
// upload vocabulary — same relative-import idiom as
// ../content/UploadZone.tsx.
import { FILE_KINDS, type FileKind } from '../../../../src/domain/files';

// Re-exported from the pure domain vocabulary (DEC-613 wave-70 amendment) —
// the ONE set shared with src/routes/tasks.ts, src/server/repo/portal/tasks.ts,
// and speakerDetail.ts, same relative-import idiom as FILE_KINDS above.
import type { TaskKind } from '../../../../src/domain/task-kinds';
export type { TaskKind };
export { TASK_KINDS } from '../../../../src/domain/task-kinds';

// DEC-023: assignment status literals are exactly 'pending'/'complete' — the
// admin-facing accept/decline queue states never apply here.
export type AssignmentStatus = 'pending' | 'complete';

export interface OnboardingTask {
  id: string;
  kind: TaskKind;
  title: string;
  dueDate: number | null;
  required: boolean;
  // CNT-01: the task's free-text brief -- editable in both create and edit
  // modes, unlike kind/formId/deliverableKind. Optional/undefined (as well
  // as null) means "none", so existing OnboardingTask fixtures/mocks that
  // predate this field keep compiling.
  instructions?: string | null;
}

// GET /api/v1/tasks/:id/delete-preview (DEC-933 amendment, wave 63): names
// what DELETE /api/v1/tasks/:id is about to destroy, event-wide -- never a
// count of the currently filtered/paginated grid page.
export interface TaskDeleteImpact {
  assigned: number;
  completed: number;
  responses: number;
  files: number;
}

export interface OnboardingCell {
  taskId: string;
  assignmentId: string;
  status: AssignmentStatus;
  completedAt: number | null;
  fileId: string | null;
  // DEC-920: the file's name/size, joined server-side (src/server/repo/tasks
  // /grid.ts) so the roster's file link can name the file rather than say
  // "File". Both null exactly when fileId is null.
  fileName: string | null;
  // DEC-851 wave-5 amendment: fileSizeBytes/lastRemindedAt were deleted
  // from the wire -- no roster cell names a file's size, and the per-cell
  // reminder dedupe window is computed server-side, never read here.
  // DEC-801: the moment this assignment was created -- fed through
  // effectiveAssignmentDueDate (../../../../src/domain/task-due.ts) so a
  // task cannot be judged late before it was actually assigned.
  assignedAt: number;
}

// DEC-789 wave-73 amendment: re-exported from the pure core
// (src/domain/invite-status.ts) so the invite-status vocabulary and its
// label map can never desync between the roster, the speaker detail page,
// and the submission detail page — same relative-import idiom as
// TASK_KINDS above. Closed set written by PATCH
// /api/v1/submissions/:id/participants/:participantId (task-w3-c, mocked
// here — this file never imports that route). ONE exported label
// vocabulary; every call site reads INVITE_STATUS_LABELS[status], never a
// literal string per site.
import type { InviteStatus } from '../../../../src/domain/invite-status';
export type { InviteStatus };
export { INVITE_STATUSES, INVITE_STATUS_LABELS } from '../../../../src/domain/invite-status';

// DEC-936: one participation this roster row covers -- a contact can carry
// more than one accepted participation in the same event (co-speaker on
// more than one session). Each names its own PATCH target
// (/submissions/:submissionId/participants/:participantId).
export interface OnboardingParticipation {
  participantId: string;
  submissionId: string;
  ref: string;
  title: string;
  inviteStatus: InviteStatus;
}

export interface OnboardingContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  hasAccount: boolean;
  // DEC-936: EVERY participation this contact covers on this roster row,
  // ordered by submission seq. Always non-empty.
  participations: OnboardingParticipation[];
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
  // DEC-801 (wave 58 amendment): the owning event's IANA timezone, so cells
  // can judge lateness via isAssignmentOverdue instead of a raw UTC compare.
  timezone: string;
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

// DEC-240/DEC-928: meaningful only when kind='file_request' — the
// content-pipeline file kind portal uploads for the task should land as.
// One vocabulary: DeliverableKind is FileKind, DELIVERABLE_KINDS is
// FILE_KINDS.
export type DeliverableKind = FileKind;

export const DELIVERABLE_KINDS: readonly DeliverableKind[] = FILE_KINDS;

// GET /api/v1/task-assignments/:id/response response (DEC-291).
export interface AssignmentResponseField {
  label: string;
  value: string;
  // Present when this field's def kind is 'file' and the answer still names
  // a surviving `file` row (DEC-248 amendment, wave 10).
  file?: { id: string; filename: string };
}

export interface AssignmentResponseDetail {
  assignmentId: string;
  taskTitle: string;
  // DEC-851 wave-5 amendment: taskKind was deleted -- DEC-291's own wire
  // shape never named it, and ResponseModal.tsx renders taskTitle only.
  contact: { id: string; name: string; email: string };
  status: AssignmentStatus;
  completedAt: number | null;
  fields: AssignmentResponseField[];
}

export interface NewTaskInput {
  kind: TaskKind;
  title: string;
  // DEC-933: null is an explicit "no due date" (create's default, and
  // edit's "clear the due date"), distinct from omitting the field
  // entirely -- always present so an edit PATCH can clear a due date
  // rather than silently leaving it unchanged.
  dueDate: number | null;
  required: boolean;
  formId?: string;
  deliverableKind?: DeliverableKind;
  // CNT-01: trimmed by the modal before it's sent; empty string is never
  // sent (omitted -- the server treats undefined and "" the same, but the
  // client's own trim keeps the two forms interchangeable at either side).
  instructions?: string;
  // DEC-746 (wave-59 amendment): CREATE-only. Absent means every accepted
  // speaker (unchanged default). Present is a non-empty subset of the
  // event roster, sent only when the modal's subset picker is chosen --
  // never sent from edit mode (PATCH never touches assignments).
  contactIds?: string[];
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
