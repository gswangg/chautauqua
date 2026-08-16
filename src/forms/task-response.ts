// Pure core (DEC-002: no node:/cloudflare/drizzle imports) — the ONE
// validated parser/serializer for task_assignment.response_json (DEC-291
// amendment, wave 80). Modeled on src/forms/field-json.ts (DEC-008
// amendment, wave 79): before this module, three repo sites each ran an
// unvalidated `JSON.parse(...) as AnswerMap` and a FOURTH decided "has a
// saved response" by a different, disagreeing rule (`responseJson === null`,
// which treats a stored "{}" as answered). A stored array or scalar
// survived JSON.parse without error and every `answers[fieldId]` lookup
// silently yielded `undefined` — a required answer vanished from both the
// speaker's own view and the organizer's DEC-291 read with no error raised
// anywhere. This module is the ONE parser, ONE serializer, and ONE
// "answered" predicate; every reader/writer of response_json spends it.

import type { AnswerMap } from "./types";

/** Thrown by parseTaskResponse when the stored JSON does not match the
 * AnswerMap shape (a non-array object) its column is contracted to hold.
 * Names the offending assignment id so a bad row is loud, not a silently
 * empty form. */
export class TaskResponseError extends Error {
  constructor(assignmentId: string, detail: string) {
    super(`task_assignment ${assignmentId}.response_json: ${detail}`);
    this.name = "TaskResponseError";
  }
}

/** Parses task_assignment.response_json. Returns {} for null/undefined/empty
 * input (no response saved yet). Throws TaskResponseError if the JSON parses
 * but is not a non-array object. */
export function parseTaskResponse(json: string | null | undefined, assignmentId: string): AnswerMap {
  if (json === null || json === undefined || json === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new TaskResponseError(assignmentId, "not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TaskResponseError(assignmentId, "must be an object");
  }
  return parsed as AnswerMap;
}

/** The ONE serializer for task_assignment.response_json — every writer
 * (saveTaskFormResponse's caller) spends this instead of a bare
 * JSON.stringify, so the column always holds what parseTaskResponse can
 * read back. */
export function serializeTaskResponse(answers: AnswerMap): string {
  return JSON.stringify(answers);
}

/** The ONE rule for "has a saved response": the stored JSON parses AND is
 * non-empty. A stored "{}" (an object with zero keys) is NOT a saved
 * response — DEC-214's speaker-completion gate (src/routes/tasks.ts) spends
 * this instead of the prior `responseJson === null` check, which let a
 * stored "{}" count as answered there while every other reader treated it
 * as no answers. Malformed JSON (a stored array/scalar) is also "not
 * answered" here — the loud failure belongs to the readers that actually
 * need the parsed answers (parseTaskResponse), not to this membership
 * check. */
export function hasSavedTaskResponse(json: string | null | undefined): boolean {
  if (json === null || json === undefined || json === "") return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  return Object.keys(parsed as Record<string, unknown>).length > 0;
}
