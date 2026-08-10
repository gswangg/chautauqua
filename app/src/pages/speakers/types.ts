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

export interface OnboardingContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  hasAccount: boolean;
}

export interface OnboardingRow {
  contact: OnboardingContact;
  cells: OnboardingCell[];
}

// GET /api/v1/events/:eventId/onboarding response (DEC-023).
export interface OnboardingGridResponse {
  tasks: OnboardingTask[];
  rows: OnboardingRow[];
}

export interface GridFilterState {
  taskId: string | null;
  status: AssignmentStatus | null;
  overdueOnly: boolean;
}

export const DEFAULT_GRID_FILTERS: GridFilterState = {
  taskId: null,
  status: null,
  overdueOnly: false,
};

export interface NewTaskInput {
  kind: TaskKind;
  title: string;
  description?: string;
  dueDate?: number;
  required: boolean;
  formId?: string;
  assignToAllAccepted?: boolean;
}
