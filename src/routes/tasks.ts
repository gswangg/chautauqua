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
import { ApiError, parseBoundedIdArray } from "../server/http";
import { MAX_NAME_LENGTH, MAX_LONG_TEXT_LENGTH } from "../forms/validate"; // DEC-417
import { isEpochMs } from "./api/validators"; // DEC-517/DEC-527
import { DEC_120, DEC_214, DEC_240, DEC_291, DEC_398 } from "../decisions";
import { findFormById } from "../server/repo/forms";
import {
  assignTask,
  createTask,
  deleteTask,
  getAssignmentOwnership,
  getAssignmentResponseDetail,
  getEventOrgId,
  getOnboardingGrid,
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
import { clampPage, clampPerPage, DEFAULT_PER_PAGE } from "../lib/pagination";
import { resolveBaseUrl, resolveBaseUrlForCron } from "../server/origin";
import type { KVStore } from "../auth/claim";

// DEC-120: task-assign contact org-scoping is referenced below so this
// dependency is compile-checked (see decisions.ts).
void DEC_120;
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

export const taskRoutes = new Hono<AppEnv>();

const TASK_KINDS = new Set(["general", "file_request", "form"]);
const ASSIGNMENT_STATUSES = new Set<TaskAssignmentStatus>(["pending", "complete"]);
const DELIVERABLE_KINDS = new Set(["presentation", "poster", "handout"]);

/** DEC-240: deliverableKind is only meaningful (and only accepted) when the
 * task's kind is 'file_request'; every other kind must leave it null. */
function parseDeliverableKind(
  body: Record<string, unknown>,
  fields: Record<string, string>,
  effectiveKind: string,
): string | null | undefined {
  if (body.deliverableKind === undefined) return null;
  if (body.deliverableKind === null) return null;
  if (typeof body.deliverableKind !== "string" || !DELIVERABLE_KINDS.has(body.deliverableKind)) {
    fields.deliverableKind = "Must be one of 'presentation', 'poster', 'handout'";
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
  if (eventOrgId !== orgId) throw new ApiError("forbidden", "Event belongs to a different org");
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
 * clampPage/clampPerPage in src/lib/pagination.ts -- no local copy. */
function parseOnboardingGridQuery(raw: Record<string, string | undefined>, now: number) {
  const page = clampPage(raw.page);
  const perPage = clampPerPage(raw.perPage);

  const q = raw.q && raw.q.trim().length > 0 ? raw.q.trim() : null;
  const taskId = raw.taskId && raw.taskId.trim().length > 0 ? raw.taskId.trim() : null;
  const status: "pending" | "complete" | null =
    raw.status === "pending" || raw.status === "complete" ? raw.status : null;
  const overdueOnly = raw.overdueOnly === "1" || raw.overdueOnly === "true";

  return { page, perPage, q, taskId, status, overdueOnly, now };
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

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

// POST /api/v1/events/:eventId/tasks
taskRoutes.post("/events/:eventId/tasks", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = asRecord(await c.req.json().catch(() => ({})));
  const fields: Record<string, string> = {};

  const kind = typeof body.kind === "string" ? body.kind : undefined;
  if (!kind || !TASK_KINDS.has(kind)) {
    fields.kind = "Must be one of 'general', 'file_request', 'form'";
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) fields.title = "Required";
  else if (title.length > MAX_NAME_LENGTH) fields.title = `Max ${MAX_NAME_LENGTH}`; // DEC-417

  const description = body.description === undefined || body.description === null
    ? null
    : typeof body.description === "string"
      ? body.description
      : undefined;
  if (description === undefined) fields.description = "Must be a string";
  else if (description !== null && description.length > MAX_LONG_TEXT_LENGTH) {
    fields.description = `Max ${MAX_LONG_TEXT_LENGTH}`; // DEC-417
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

  const assignToAllAccepted = body.assignToAllAccepted === undefined
    ? undefined
    : typeof body.assignToAllAccepted === "boolean"
      ? body.assignToAllAccepted
      : undefined;
  if (body.assignToAllAccepted !== undefined && assignToAllAccepted === undefined) {
    fields.assignToAllAccepted = "Must be a boolean";
  }

  const deliverableKind = parseDeliverableKind(body, fields, kind ?? "");

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
    deliverableKind: deliverableKind as CreateTaskInput["deliverableKind"],
    assignToAllAccepted,
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
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Task belongs to a different org");

  const body = asRecord(await c.req.json().catch(() => ({})));
  const fields: Record<string, string> = {};

  const input: UpdateTaskInput = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      fields.title = "Must be a non-empty string";
    } else if (body.title.trim().length > MAX_NAME_LENGTH) {
      fields.title = `Max ${MAX_NAME_LENGTH}`; // DEC-417
    } else {
      input.title = body.title.trim();
    }
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      fields.description = "Must be a string or null";
    } else if (body.description !== null && body.description.length > MAX_LONG_TEXT_LENGTH) {
      fields.description = `Max ${MAX_LONG_TEXT_LENGTH}`; // DEC-417
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

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid task", fields);
  }

  const updated = await updateTask(c.var.db, taskId, input);
  return c.json(updated);
});

// DELETE /api/v1/tasks/:id
taskRoutes.delete("/tasks/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const taskId = c.req.param("id");
  const ownership = await getTaskOwnership(c.var.db, taskId);
  if (!ownership) throw new ApiError("not_found", "Task not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Task belongs to a different org");

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
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Task belongs to a different org");

  const body = asRecord(await c.req.json().catch(() => ({})));
  const contactIds = parseBoundedIdArray(body.contactIds, "contactIds"); // DEC-182

  // DEC-120: reject cross-org contact ids before any assignment write —
  // atomic, no partial assignment (DEC-019).
  const dedupedContactIds = Array.from(new Set(contactIds));
  const orgContacts = await findContactsForOrg(c.var.db, dedupedContactIds, auth.orgId);
  const foundIds = new Set(orgContacts.map((r) => r.id));
  const missing = dedupedContactIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ApiError("invalid", "One or more contacts do not belong to this org", {
      contactIds: `unknown ids: ${missing.join(", ")}`,
    });
  }

  await assignTask(c.var.db, taskId, dedupedContactIds);
  const grid = await getOnboardingGrid(c.var.db, ownership.eventId, {
    page: 1,
    perPage: DEFAULT_PER_PAGE,
    q: null,
    taskId: null,
    status: null,
    overdueOnly: false,
    now: Date.now(),
  });
  return c.json(grid);
});

// ---------------------------------------------------------------------------
// Assignment status
// ---------------------------------------------------------------------------

// PATCH /api/v1/task-assignments/:id
taskRoutes.patch("/task-assignments/:id", csrfJson, async (c) => {
  const auth = requireAuth(c);
  const assignmentId = c.req.param("id");
  const ownership = await getAssignmentOwnership(c.var.db, assignmentId);
  if (!ownership) throw new ApiError("not_found", "Task assignment not found");

  const isOwningOrganizer = auth.role === "organizer" && auth.orgId === ownership.orgId;
  const isOwningSpeaker = auth.role === "speaker" && auth.contactId === ownership.contactId;
  if (!isOwningOrganizer && !isOwningSpeaker) {
    throw new ApiError("forbidden", "Not authorized to update this task assignment");
  }

  const body = asRecord(await c.req.json().catch(() => ({})));
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

  const body = asRecord(await c.req.json().catch(() => ({})));
  // DEC-182: taskIds is optional (undefined => remind for all outstanding
  // tasks on the event); when present it must be a bounded array of ids.
  const taskIds = body.taskIds === undefined ? undefined : parseBoundedIdArray(body.taskIds, "taskIds");
  // DEC-694: contactIds is optional (undefined => today's behaviour, every
  // outstanding contact); when present it scopes the send to exactly those
  // contacts, identically to the preview endpoint below.
  const contactIds = body.contactIds === undefined ? undefined : parseBoundedIdArray(body.contactIds, "contactIds");

  const mailer = makeMailer(c.var.db, c.env);
  const kv = c.env.KV as unknown as KVStore;
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

  const body = asRecord(await c.req.json().catch(() => ({})));
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
  const mailer = makeMailer(db, env);
  const now = new Date();
  const kv = env.KV as unknown as KVStore;
  const origin = resolveBaseUrlForCron(env);
  const eventIds = await listEventIdsWithOutstandingAssignments(db);
  for (const eventId of eventIds) {
    // DEC-238 class 1 (cron): one event's failure (bad row, mailer outage,
    // etc.) must not abort the tick for every other event.
    try {
      await sendDueRemindersForEvent(db, mailer, eventId, now, kv, origin);
    } catch (err) {
      console.error("due-reminder pass failed for event", eventId, err);
    }
  }
}
