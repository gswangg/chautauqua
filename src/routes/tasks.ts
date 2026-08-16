// J6 onboarding tasks API (DEC-023). Route file exports a named Hono
// sub-app; only src/index.ts mounts it (DEC-012). Handlers stay thin:
// parse/authz -> repo function -> response.
//
// Reminders are due-date-driven only (DEC-009): nothing in this module
// sends on a status change — the cron (runDueReminders) and the explicit
// 'remind now' endpoint are the only send paths, both schedule/organizer
// triggered, never wired to submission or assignment status writes.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo, Bindings } from "../server/env";
import type { Db } from "../server/context";
import { makeDb, makeMailer } from "../server/context";
import { requireOrganizer, csrfJson } from "../server/middleware";
import { ApiError, parseBoundedIdArray, readOptionalJsonBody } from "../server/http";
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH } from "../forms/validate"; // DEC-417
import { isEpochMs } from "./api/validators"; // DEC-517/DEC-527
import { DEC_120, DEC_124, DEC_214, DEC_240, DEC_291, DEC_398, DEC_754 } from "../decisions";
import { FILE_KINDS, isValidFileKind, type FileKind } from "../domain/files";
import { TASK_KINDS, MAX_TASK_ASSIGNEES } from "../domain/task-kinds"; // DEC-613 wave-70 amendment; DEC-422 wave-77 amendment
import { INVITE_STATUSES, isInviteStatus, type InviteStatus } from "../domain/invite-status"; // DEC-789 wave-73 amendment
import { MAX_TASK_INSTRUCTIONS_LENGTH } from "../domain/task-copy";
import { findFormById } from "../server/repo/forms";
import {
  assignTask,
  countTaskDeleteImpact,
  createTask,
  deleteTask,
  filterRosterContactIds,
  getAssignmentOwnership,
  getAssignmentResponseDetail,
  getEventOrgId,
  getOnboardingGrid,
  getSpeakerDetail,
  getTaskOwnership,
  listEventIdsWithOutstandingAssignments,
  previewRemindNow,
  remindNow,
  sendDueRemindersForEvent,
  updateAssignmentStatus,
  updateTask,
  type CreateTaskInput,
  type TaskAssignmentStatus,
  type UpdateTaskInput,
} from "../server/repo/tasks";
import { findContactsForOrg } from "../server/repo/contacts";
import { clampPage, clampPerPage } from "../lib/pagination";
import { resolveBaseUrl, resolveBaseUrlForCron } from "../server/origin";
import type { KVStore } from "../auth/claim";
import { countOf } from "../domain/count-copy";
import { describeUnresolvedSelection } from "../lib/refusal-copy"; // DEC-856
import { overCapFieldMessage } from "../domain/cap-copy";

// DEC-120: task-assign contact org-scoping is referenced below so this
// dependency is compile-checked (see decisions.ts).
void DEC_120;
// DEC-754 (wave 38 amendment): task assign must range over the event
// roster (filterRosterContactIds below), not just org membership.
void DEC_754;
// DEC-214: speaker-side kind gates on PATCH /api/v1/task-assignments/:id,
// referenced below so this dependency is compile-checked (see decisions.ts).
void DEC_214;
// DEC-240: task.deliverable_kind is validated below so this dependency is
// compile-checked (see decisions.ts).
void DEC_240;
// DEC-291: organizer-readable form-task response viewer, referenced below so
// this dependency is compile-checked (see decisions.ts).
void DEC_291;
// DEC-398: a form task's formId must resolve to a form on the task's own
// event -- validated below on both create and patch.
void DEC_398;
// DEC-124: instructions is capped server-side at MAX_TASK_INSTRUCTIONS_LENGTH with
// the same field-level "Too long (max N characters)" grammar
// validateAnswers uses for form text answers, referenced below so this
// dependency is compile-checked (see decisions.ts).
void DEC_124;

export const taskRoutes = new Hono<AppEnv>();

const ASSIGNMENT_STATUSES = new Set<TaskAssignmentStatus>(["pending", "complete"]);

/** Trims `body.instructions`, treats an empty (post-trim) string as null,
 * and caps it at MAX_TASK_INSTRUCTIONS_LENGTH with the DEC-124 field-level
 * error grammar -- a loud 400, never a silent truncation. Returns undefined
 * (with `fields.instructions` set) on a validation failure; the caller must
 * check `fields` before trusting the return value. */
function parseInstructions(
  body: Record<string, unknown>,
  fields: Record<string, string>,
): string | null | undefined {
  if (body.instructions === undefined) return null;
  if (body.instructions === null) return null;
  if (typeof body.instructions !== "string") {
    fields.instructions = "Must be a string";
    return undefined;
  }
  const trimmed = body.instructions.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_TASK_INSTRUCTIONS_LENGTH) {
    fields.instructions = overCapFieldMessage(trimmed.length, MAX_TASK_INSTRUCTIONS_LENGTH);
    return undefined;
  }
  return trimmed;
}

/** DEC-240: deliverableKind is only meaningful (and only accepted) when the
 * task's kind is 'file_request'; every other kind must leave it null.
 * Validated via isValidFileKind (src/domain/files.ts, the single source of
 * truth) so the task deliverableKind vocabulary can never desync from the
 * upload vocabulary, and so the return type narrows to FileKind without a
 * cast at the call site. */
function parseDeliverableKind(
  body: Record<string, unknown>,
  fields: Record<string, string>,
  effectiveKind: string,
): FileKind | null | undefined {
  if (body.deliverableKind === undefined) return null;
  if (body.deliverableKind === null) return null;
  if (!isValidFileKind(body.deliverableKind)) {
    fields.deliverableKind = `Must be one of ${FILE_KINDS.map((k) => `'${k}'`).join(", ")}`;
    return undefined;
  }
  if (effectiveKind !== "file_request") {
    fields.deliverableKind = "Only valid when kind is 'file_request'";
    return undefined;
  }
  return body.deliverableKind;
}

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

async function assertEventOwnership(db: Db, eventId: string, orgId: string): Promise<void> {
  const eventOrgId = await getEventOrgId(db, eventId);
  if (!eventOrgId) throw new ApiError("not_found", "Event not found");
  if (eventOrgId !== orgId) throw new ApiError("not_found", "Event not found");
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("invalid", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

/** DEC-340: parses the onboarding grid's page/perPage/q/taskId/status/
 * overdueOnly query params, mirroring parseListQuery's page/perPage
 * defaults (DEC-013). Clamp rule per DEC-480 delegated to
 * clampPage/clampPerPage in src/lib/pagination.ts -- no local copy.
 *
 * DEC-340 amendment (wave 18): absent/empty stays null/false (no filter,
 * unchanged); a PRESENT-but-unrecognised token now fails loudly with a 400
 * instead of silently degrading to "no filter" -- matching the sibling
 * refusal shapes in files.ts (Unknown kind) and the submissions list
 * (DEC-843). Every offending param is accumulated into one fields map
 * (the accumulate-then-throw shape src/routes/api/breaks.ts uses) so a
 * request with two bad tokens names both in a single error. */
export function parseOnboardingGridQuery(raw: Record<string, string | undefined>, now: number) {
  const page = clampPage(raw.page);
  const perPage = clampPerPage(raw.perPage);

  const fields: Record<string, string> = {};

  const q = raw.q && raw.q.trim().length > 0 ? raw.q.trim() : null;
  const taskId = raw.taskId && raw.taskId.trim().length > 0 ? raw.taskId.trim() : null;

  let status: "pending" | "complete" | null = null;
  if (raw.status !== undefined && raw.status !== "") {
    if (raw.status === "pending" || raw.status === "complete") {
      status = raw.status;
    } else {
      fields.status = "Must be one of 'pending', 'complete'";
    }
  }

  let overdueOnly = false;
  if (raw.overdueOnly !== undefined && raw.overdueOnly !== "") {
    if (raw.overdueOnly === "1" || raw.overdueOnly === "true") {
      overdueOnly = true;
    } else if (raw.overdueOnly === "0" || raw.overdueOnly === "false") {
      overdueOnly = false;
    } else {
      fields.overdueOnly = "Must be one of '1', 'true', '0', 'false'";
    }
  }

  // DEC-789 wave-73 amendment: closed set, mirroring the participant.invite_status
  // column, validated against the one shared vocabulary rather than a hand-typed list.
  let inviteStatus: InviteStatus | null = null;
  if (raw.inviteStatus !== undefined && raw.inviteStatus !== "") {
    if (typeof raw.inviteStatus === "string" && isInviteStatus(raw.inviteStatus)) {
      inviteStatus = raw.inviteStatus;
    } else {
      fields.inviteStatus = `Must be one of ${INVITE_STATUSES.map((s) => `'${s}'`).join(", ")}`;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid onboarding grid filter", fields);
  }

  return { page, perPage, q, taskId, status, overdueOnly, inviteStatus, now };
}

// GET /api/v1/events/:eventId/onboarding
taskRoutes.get("/events/:eventId/onboarding", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);
  const params = parseOnboardingGridQuery(c.req.query(), Date.now());
  const grid = await getOnboardingGrid(c.var.db, eventId, params);
  return c.json(grid);
});

// GET /api/v1/events/:eventId/speakers/:contactId
// DEC-930: the ONE event-scoped per-speaker detail read -- 404s (rather than
// exposing whether the contact exists at all) when the contact is not on
// this event's roster, existence-hiding like every other nested read.
taskRoutes.get("/events/:eventId/speakers/:contactId", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const contactId = c.req.param("contactId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);
  const detail = await getSpeakerDetail(c.var.db, eventId, contactId);
  if (!detail) throw new ApiError("not_found", "Speaker not found in this event");
  return c.json(detail);
});

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

// POST /api/v1/events/:eventId/tasks
taskRoutes.post("/events/:eventId/tasks", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = asRecord(await readOptionalJsonBody(c));
  const fields: Record<string, string> = {};

  const kind = typeof body.kind === "string" ? body.kind : undefined;
  if (!kind || !(TASK_KINDS as readonly string[]).includes(kind)) {
    fields.kind = "Must be one of 'general', 'file_request', 'form'";
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) fields.title = "Required";
  else if (title.length > MAX_NAME_LENGTH) fields.title = overCapFieldMessage(title.length, MAX_NAME_LENGTH); // DEC-417

  const description = body.description === undefined || body.description === null
    ? null
    : typeof body.description === "string"
      ? body.description
      : undefined;
  if (description === undefined) fields.description = "Must be a string";
  else if (description !== null && description.length > MAX_LONG_TEXT_LENGTH) {
    fields.description = overCapFieldMessage(description.length, MAX_LONG_TEXT_LENGTH); // DEC-417
  }

  let dueDate: number | null | undefined = null;
  if (body.dueDate !== undefined && body.dueDate !== null) {
    dueDate = isEpochMs(body.dueDate) ? body.dueDate : undefined;
    if (dueDate === undefined) fields.dueDate = "Must be a ms-epoch integer";
  }

  const required = typeof body.required === "boolean" ? body.required : undefined;
  if (required === undefined) fields.required = "Must be a boolean";

  let formId: string | null | undefined = body.formId === undefined || body.formId === null
    ? null
    : typeof body.formId === "string"
      ? body.formId
      : undefined;
  if (formId === undefined) fields.formId = "Must be a string";

  const deliverableKind = parseDeliverableKind(body, fields, kind ?? "");
  const instructions = parseInstructions(body, fields);

  // DEC-398: a 'form' task requires a formId that resolves to a form on
  // this event; any other kind must not carry one. Same message either way
  // (unknown id vs. cross-event id) -- no existence leak.
  if (fields.formId === undefined) {
    if (kind === "form") {
      if (!formId) {
        fields.formId = "Required";
      } else {
        const form = await findFormById(c.var.db, formId);
        if (!form || form.eventId !== eventId) {
          fields.formId = "Must be a form on this event";
        }
      }
    } else if (formId !== null && formId !== undefined) {
      fields.formId = "Only valid when kind is 'form'";
    }
  }

  // DEC-746 (wave 59 amendment): contactIds is OPTIONAL -- absent means
  // every accepted speaker (today's behavior, unchanged); present must be a
  // non-empty array of ids that all belong to this event's roster. Parsed
  // and resolved BEFORE createTask so a refused request writes nothing.
  let resolvedContactIds: string[] | undefined;
  if (fields.contactIds === undefined && body.contactIds !== undefined) {
    if (Array.isArray(body.contactIds) && body.contactIds.length === 0) {
      fields.contactIds = "A task must be for at least one person";
    } else {
      let parsedContactIds: string[];
      try {
        parsedContactIds = parseBoundedIdArray(body.contactIds, "contactIds", { maxCount: MAX_TASK_ASSIGNEES }); // DEC-182, DEC-422
      } catch (err) {
        if (err instanceof ApiError) {
          fields.contactIds = err.fields?.contactIds ?? err.message;
          parsedContactIds = [];
        } else {
          throw err;
        }
      }
      if (fields.contactIds === undefined) {
        const rosterIds = await filterRosterContactIds(c.var.db, eventId, parsedContactIds);
        const notOnRoster = parsedContactIds.filter((id) => !rosterIds.has(id));
        if (notOnRoster.length > 0) {
          fields.contactIds = `${notOnRoster.length} of ${parsedContactIds.length} contacts are not on this event's roster -- they must be participants on an accepted submission of this event`;
        } else {
          resolvedContactIds = parsedContactIds;
        }
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid task", fields);
  }

  const input: CreateTaskInput = {
    kind: kind as CreateTaskInput["kind"],
    title,
    description,
    dueDate,
    required: required as boolean,
    formId,
    deliverableKind,
    instructions,
    contactIds: resolvedContactIds,
  };
  const created = await createTask(c.var.db, eventId, input);
  return c.json(created, 201);
});

// PATCH /api/v1/tasks/:id
taskRoutes.patch("/tasks/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const taskId = c.req.param("id");
  const ownership = await getTaskOwnership(c.var.db, taskId);
  if (!ownership) throw new ApiError("not_found", "Task not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Task not found");

  const body = asRecord(await readOptionalJsonBody(c));
  const fields: Record<string, string> = {};

  const input: UpdateTaskInput = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      fields.title = "Must be a non-empty string";
    } else if (body.title.trim().length > MAX_NAME_LENGTH) {
      fields.title = overCapFieldMessage(body.title.trim().length, MAX_NAME_LENGTH); // DEC-417
    } else {
      input.title = body.title.trim();
    }
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      fields.description = "Must be a string or null";
    } else if (body.description !== null && body.description.length > MAX_LONG_TEXT_LENGTH) {
      fields.description = overCapFieldMessage(body.description.length, MAX_LONG_TEXT_LENGTH); // DEC-417
    } else {
      input.description = body.description;
    }
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate !== null && !isEpochMs(body.dueDate)) {
      fields.dueDate = "Must be a ms-epoch integer";
    } else {
      input.dueDate = body.dueDate;
    }
  }
  if (body.required !== undefined) {
    if (typeof body.required !== "boolean") {
      fields.required = "Must be a boolean";
    } else {
      input.required = body.required;
    }
  }
  // DEC-398: a string formId must resolve to a form on the task's own
  // event; a form-kind task may not have its formId nulled out; a
  // non-form task may not gain one.
  if (body.formId !== undefined) {
    if (body.formId !== null && typeof body.formId !== "string") {
      fields.formId = "Must be a string or null";
    } else if (body.formId === null) {
      if (ownership.kind === "form") {
        fields.formId = "A form task must have a form";
      } else {
        input.formId = null;
      }
    } else if (ownership.kind !== "form") {
      fields.formId = "Only valid when kind is 'form'";
    } else {
      const form = await findFormById(c.var.db, body.formId);
      if (!form || form.eventId !== ownership.eventId) {
        fields.formId = "Must be a form on this event";
      } else {
        input.formId = body.formId;
      }
    }
  }
  if (body.deliverableKind !== undefined) {
    const deliverableKind = parseDeliverableKind(body, fields, ownership.kind);
    if (deliverableKind !== undefined) {
      input.deliverableKind = deliverableKind as UpdateTaskInput["deliverableKind"];
    }
  }
  // CNT-01: instructions is editable in edit mode too (unlike kind/formId/
  // deliverableKind, it orphans nothing, so no DEC-933 freeze applies here).
  if (body.instructions !== undefined) {
    const instructions = parseInstructions(body, fields);
    if (fields.instructions === undefined) {
      input.instructions = instructions;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid task", fields);
  }

  const updated = await updateTask(c.var.db, taskId, input);
  return c.json(updated);
});

// DEC-933 amendment (wave 63): names what deletion destroys before the
// organizer confirms -- read-only, event-wide preview of deleteTask's exact
// tally, guarded by the same requireOrganizer/getTaskOwnership check as the
// DELETE below.
// GET /api/v1/tasks/:id/delete-preview
taskRoutes.get("/tasks/:id/delete-preview", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const taskId = c.req.param("id");
  const ownership = await getTaskOwnership(c.var.db, taskId);
  if (!ownership) throw new ApiError("not_found", "Task not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Task not found");

  const counts = await countTaskDeleteImpact(c.var.db, taskId);
  return c.json({ taskId, title: ownership.title, counts });
});

// DELETE /api/v1/tasks/:id
taskRoutes.delete("/tasks/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const taskId = c.req.param("id");
  const ownership = await getTaskOwnership(c.var.db, taskId);
  if (!ownership) throw new ApiError("not_found", "Task not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Task not found");

  await deleteTask(c.var.db, taskId);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Assign
// ---------------------------------------------------------------------------

// POST /api/v1/tasks/:id/assign
taskRoutes.post("/tasks/:id/assign", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const taskId = c.req.param("id");
  const ownership = await getTaskOwnership(c.var.db, taskId);
  if (!ownership) throw new ApiError("not_found", "Task not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Task not found");

  const body = asRecord(await readOptionalJsonBody(c));
  const contactIds = parseBoundedIdArray(body.contactIds, "contactIds", { maxCount: MAX_TASK_ASSIGNEES }); // DEC-182, DEC-422

  // DEC-120: reject cross-org contact ids before any assignment write —
  // atomic, no partial assignment (DEC-019).
  // DEC-370: findContactsForOrg and filterRosterContactIds range over
  // independent tables (org contact directory vs. this event's roster) and
  // neither depends on the other's result -- issued as one Promise.all, but
  // both refusals below are still evaluated in SOURCE order (the DEC-120 org
  // refusal first, the DEC-754/DEC-829 roster refusal second) so the error a
  // caller sees for a given bad payload never changes.
  const dedupedContactIds = Array.from(new Set(contactIds));
  const [orgContacts, rosterIds] = await Promise.all([
    findContactsForOrg(c.var.db, dedupedContactIds, auth.orgId),
    filterRosterContactIds(c.var.db, ownership.eventId, dedupedContactIds),
  ]);
  const foundIds = new Set(orgContacts.map((r) => r.id));
  const missing = dedupedContactIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const resolvedNames = orgContacts.map((r) => `${r.firstName} ${r.lastName}`.trim());
    throw new ApiError("invalid", "One or more contacts do not belong to this org", {
      contactIds: describeUnresolvedSelection(resolvedNames, missing.length, "refresh the page and reselect"),
    });
  }

  // DEC-754 amendment (wave 38): assignment ranges over the event ROSTER,
  // not just org membership -- a contact must be a participant on an
  // accepted submission of THIS event, matching the grid's base row
  // predicate (rosterParticipantExistsForContact) and both reminder paths
  // (chaseableContactExists), so a successful assign never mints a
  // task_assignment row the grid can't show and no reminder path can chase.
  const notOnRoster = dedupedContactIds.filter((id) => !rosterIds.has(id));
  if (notOnRoster.length > 0) {
    const resolvedNames = orgContacts
      .filter((r) => rosterIds.has(r.id))
      .map((r) => `${r.firstName} ${r.lastName}`.trim());
    throw new ApiError(
      "invalid",
      "One or more contacts are not on this event's roster",
      {
        contactIds: describeUnresolvedSelection(
          resolvedNames,
          notOnRoster.length,
          "the contact must be a participant on an accepted submission of this event -- accept their submission, or add them as a participant first",
        ),
      },
    );
  }

  await assignTask(c.var.db, taskId, dedupedContactIds);
  // DEC-340 (wave 46 amendment): echo the CALLER's grid query back, not a
  // hand-written literal -- see GET .../onboarding above for the same parse.
  const params = parseOnboardingGridQuery(c.req.query(), Date.now());
  const grid = await getOnboardingGrid(c.var.db, ownership.eventId, params);
  return c.json(grid);
});

// ---------------------------------------------------------------------------
// Assignment status
// ---------------------------------------------------------------------------

// PATCH /api/v1/task-assignments/:id
taskRoutes.patch("/task-assignments/:id", csrfJson, async (c) => {
  const auth = requireAuth(c);
  // w32-d (role-refusal probe): a reviewer can never own a task assignment
  // (only organizer/speaker branches below ever grant access) -- refuse
  // outright before the ownership lookup rather than reading a row this
  // role can never legitimately act on.
  if (auth.role !== "organizer" && auth.role !== "speaker") {
    throw new ApiError("forbidden", "Not authorized to update this task assignment");
  }
  const assignmentId = c.req.param("id");
  const ownership = await getAssignmentOwnership(c.var.db, assignmentId);
  if (!ownership) throw new ApiError("not_found", "Task assignment not found");

  const isOwningOrganizer = auth.role === "organizer" && auth.orgId === ownership.orgId;
  const isOwningSpeaker = auth.role === "speaker" && auth.contactId === ownership.contactId;
  if (!isOwningOrganizer && !isOwningSpeaker) {
    throw new ApiError("forbidden", "Not authorized to update this task assignment");
  }

  const body = asRecord(await readOptionalJsonBody(c));
  const status = typeof body.status === "string" ? body.status : undefined;
  if (!status || !ASSIGNMENT_STATUSES.has(status as TaskAssignmentStatus)) {
    throw new ApiError("invalid", "status must be 'pending' or 'complete'", { status: "Invalid status" });
  }

  // DEC-214: the owning speaker (never the organizer, whose completion is a
  // deliberate manual J6 grid override) may only mark a 'form' task complete
  // once a response has been saved, and a 'file_request' task complete once
  // a file has been uploaded — both gated through the portal, not this raw
  // JSON API. 'general' tasks and any 'pending' transition are ungated.
  if (isOwningSpeaker && status === "complete") {
    if (ownership.kind === "form" && ownership.responseJson === null) {
      throw new ApiError("invalid", "Complete this task through the portal form/upload flow", {
        status: "Save a response in the portal before marking this task complete",
      });
    }
    if (ownership.kind === "file_request" && ownership.fileId === null) {
      throw new ApiError("invalid", "Complete this task through the portal form/upload flow", {
        status: "Upload a file in the portal before marking this task complete",
      });
    }
  }

  const updated = await updateAssignmentStatus(
    c.var.db,
    assignmentId,
    status as TaskAssignmentStatus,
    auth.userId,
    new Date(),
  );
  return c.json(updated);
});

// ---------------------------------------------------------------------------
// Response detail (DEC-291)
// ---------------------------------------------------------------------------

// GET /api/v1/task-assignments/:id/response
taskRoutes.get("/task-assignments/:id/response", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const assignmentId = c.req.param("id");
  const ownership = await getAssignmentOwnership(c.var.db, assignmentId);
  // Existence-hiding (review-IDOR house rule): an assignment in another org
  // 404s exactly like one that doesn't exist at all.
  if (!ownership || ownership.orgId !== auth.orgId) {
    throw new ApiError("not_found", "Task assignment not found");
  }
  if (ownership.kind !== "form") {
    throw new ApiError("invalid", "This task is not a form task");
  }

  const detail = await getAssignmentResponseDetail(c.var.db, assignmentId);
  if (!detail) throw new ApiError("not_found", "Task assignment not found");
  return c.json(detail);
});

// ---------------------------------------------------------------------------
// Bulk remind
// ---------------------------------------------------------------------------

// POST /api/v1/events/:eventId/onboarding/remind
taskRoutes.post("/events/:eventId/onboarding/remind", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = asRecord(await readOptionalJsonBody(c));
  // DEC-182: taskIds is optional (undefined => remind for all outstanding
  // tasks on the event); when present it must be a bounded array of ids.
  const taskIds = body.taskIds === undefined ? undefined : parseBoundedIdArray(body.taskIds, "taskIds");
  // DEC-694: contactIds is optional (undefined => today's behaviour, every
  // outstanding contact); when present it scopes the send to exactly those
  // contacts, identically to the preview endpoint below.
  const contactIds = body.contactIds === undefined ? undefined : parseBoundedIdArray(body.contactIds, "contactIds");

  const kv = c.env.KV as unknown as KVStore;
  // DEC-547 (wave 18 amendment): makeMailer NEVER throws — a misconfigured
  // environment yields an UnconfiguredMailer whose .send fails per recipient
  // inside remindNow's own boundary, landing in the returned {failed: [...]}
  // envelope. No catch belongs here: a thrown error out of makeMailer or
  // remindNow is a genuine bug and must surface as a 500, not a fabricated
  // 200 with a "*" sentinel recipient.
  const mailer = makeMailer(c.var.db, c.env);
  const result = await remindNow(
    c.var.db,
    mailer,
    eventId,
    taskIds,
    new Date(),
    kv,
    resolveBaseUrl(c),
    contactIds,
  );
  return c.json(result);
});

// POST /api/v1/events/:eventId/onboarding/remind/preview
// SPEC §10 #3 (DEC-441): assisted chasing — a read-only preview of exactly
// what "remind now" would send, rendered from the same buildReminderMessage
// builder as the real send. Never calls the mailer, never writes a row.
taskRoutes.post("/events/:eventId/onboarding/remind/preview", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = asRecord(await readOptionalJsonBody(c));
  const taskIds = body.taskIds === undefined ? undefined : parseBoundedIdArray(body.taskIds, "taskIds");
  // DEC-694: same optional contactIds scope as the send endpoint, so a
  // preview and the send it previewed always address the same recipients.
  const contactIds = body.contactIds === undefined ? undefined : parseBoundedIdArray(body.contactIds, "contactIds");

  const kv = c.env.KV as unknown as KVStore;
  const result = await previewRemindNow(
    c.var.db,
    eventId,
    taskIds,
    new Date(),
    kv,
    resolveBaseUrl(c),
    contactIds,
  );
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Cron entrypoint (DEC-023): due-date-driven only, called from
// src/index.ts's scheduled() handler. Never reachable from a status-change
// path (DEC-009).
// ---------------------------------------------------------------------------

export async function runDueReminders(env: Bindings): Promise<void> {
  const db = makeDb(env);
  const now = new Date();
  const kv = env.KV as unknown as KVStore;
  const origin = resolveBaseUrlForCron(env);
  const eventIds = await listEventIdsWithOutstandingAssignments(db, now);
  // DEC-946: per-event isolation stays (DEC-238 class 1) — one bad event
  // must not cost the others their sends — but a swallowed failure here
  // made src/server/scheduled.ts's aggregate-rethrow dead code, since this
  // function could never reject. Collect the failing eventIds and rethrow
  // ONE aggregate error after the loop so a mailer outage is reported.
  const failedEventIds: string[] = [];
  for (const eventId of eventIds) {
    try {
      // DEC-547 (wave 18 amendment): construct the mailer inside this
      // per-event guarded region, not once above the loop — makeMailer never
      // throws (an unconfigured environment fails per recipient from inside
      // sendDueRemindersForEvent's own send call), but any other bug in the
      // per-event pipeline needs to land in failedEventIds (and the
      // aggregate rethrow below) rather than aborting the whole cron pass
      // before a single event is attempted.
      const mailer = makeMailer(db, env);
      await sendDueRemindersForEvent(db, mailer, eventId, now, kv, origin);
    } catch (err) {
      console.error("due-reminder pass failed for event", eventId, err);
      failedEventIds.push(eventId);
    }
  }
  if (failedEventIds.length > 0) {
    throw new Error(
      `runDueReminders: ${countOf(failedEventIds.length, "event")} failed: ${failedEventIds.join(", ")}`,
    );
  }
}
