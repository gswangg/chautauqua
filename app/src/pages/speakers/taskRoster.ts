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

/** What an answered row's action cell offers, decided by the TASK's kind --
 * never offered uniformly. The v12 frame ("One task, every speaker",
 * docs/design/Chautauqua Speakers.dc.html:654 `{{ a.action }}`) only ever
 * seeds a form-kind task, so its hard-coded `Open` describes the form case
 * alone; the vocabulary for the other two kinds comes from the repo's own
 * rulings:
 *
 *  - form         -> 'response'. DEC-291: "the UI offers 'View response'
 *                    only on form-kind columns" -- GET
 *                    /task-assignments/:id/response is a FORM response
 *                    reader and 4xxs on anything else, so offering it on
 *                    every row shipped a dead modal.
 *  - file_request -> 'file', when a file actually landed. The row already
 *                    carries fileId/fileName, so the action is the frame's
 *                    own file idiom (:395 `Download`, the speaker detail's
 *                    Files list) pointed at /files/:fileId -- no per-row
 *                    fetch, no new endpoint.
 *  - general      -> null. There is nothing to open: an acknowledgement has
 *                    no artefact, and the row's answers cell + Answered date
 *                    already say everything that is known. The frame's
 *                    waiting table (:709) likewise carries no action column.
 *
 * A file_request row with no file is 'complete' with nothing to read, so it
 * gets no action either -- the same rule as general, reached by data rather
 * than by kind. */
export type TaskRowAction =
  | { readonly kind: 'response' }
  | { readonly kind: 'file'; readonly fileId: string; readonly fileName: string | null }
  | null;

export function rowAction(taskKind: TaskKind, row: TaskViewRow): TaskRowAction {
  if (taskKind === 'form') return { kind: 'response' };
  if (taskKind === 'file_request' && row.fileId !== null) {
    return { kind: 'file', fileId: row.fileId, fileName: row.fileName };
  }
  return null;
}
