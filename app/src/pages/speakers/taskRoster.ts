// Wire shapes for GET /api/v1/tasks/:id/roster and POST
// /api/v1/tasks/:id/unassign -- design pack v12's task view ("One task,
// every speaker" / "One task · still waiting"). Mirrors
// src/server/repo/tasks/task-view.ts's exported interfaces; kept in its own
// dependency-free module, exactly as speakerDetail.ts is for DEC-930, so
// pure helpers and tests can read the shapes without a DOM.

import type { AssignmentStatus, TaskKind } from './types';

export interface TaskViewTask {
  id: string;
  eventId: string;
  kind: TaskKind;
  title: string;
  dueDate: number | null;
  required: boolean;
  formId: string | null;
  instructions: string | null;
}

export interface TaskViewRow {
  contactId: string;
  name: string;
  company: string | null;
  assignmentId: string;
  status: AssignmentStatus;
  completedAt: number | null;
  assignedAt: number;
  // The per-(task, speaker) dedupe stamp task_assignment already carries.
  lastRemindedAt: number | null;
  // How many reminder emails have NAMED this task to this speaker, counted
  // server-side out of email_log (task_assignment has no send counter --
  // see src/server/repo/tasks/task-view.ts's countRemindSends).
  remindCount: number;
  fileId: string | null;
  fileName: string | null;
  // form-kind tasks only: the saved answers as one line, in form-field
  // order. null when the task is not a form, or nothing has been saved.
  answerSummary: string | null;
  // DEC-801: judged server-side in the EVENT's timezone; never re-derived
  // on the client.
  overdue: boolean;
}

export interface TaskViewCounts {
  assigned: number;
  complete: number;
  pending: number;
  // Rows with something to READ: saved answers, an uploaded file, or a
  // completion. The header's "6 answered of 9 who need it".
  answered: number;
}

export interface TaskViewResponse {
  task: TaskViewTask;
  timezone: string;
  rows: TaskViewRow[];
  counts: TaskViewCounts;
}

/** The ONE answered/waiting split, shared by the two tabs, the counts they
 * print and the CSV export -- a row is ANSWERED when it has something to
 * read. Written once here so the tab a row lands in and the column set it
 * gets can never disagree. */
export function isAnswered(row: TaskViewRow): boolean {
  return row.status === 'complete' || row.answerSummary !== null || row.fileId !== null;
}
