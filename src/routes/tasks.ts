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
import { ApiError } from "../server/http";
import {
  assignTask,
  createTask,
  deleteTask,
  getAssignmentOwnership,
  getEventOrgId,
  getOnboardingGrid,
  getTaskOwnership,
  listEventIdsWithOutstandingAssignments,
  remindNow,
  sendDueRemindersForEvent,
  updateAssignmentStatus,
  updateTask,
  type CreateTaskInput,
  type TaskAssignmentStatus,
  type UpdateTaskInput,
} from "../server/repo/tasks";

export const taskRoutes = new Hono<AppEnv>();

const TASK_KINDS = new Set(["general", "file_request", "form"]);
const ASSIGNMENT_STATUSES = new Set<TaskAssignmentStatus>(["pending", "complete"]);

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

// GET /api/v1/events/:eventId/onboarding
taskRoutes.get("/events/:eventId/onboarding", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);
  const grid = await getOnboardingGrid(c.var.db, eventId);
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

  const description = body.description === undefined || body.description === null
    ? null
    : typeof body.description === "string"
      ? body.description
      : undefined;
  if (description === undefined) fields.description = "Must be a string";

  let dueDate: number | null | undefined = null;
  if (body.dueDate !== undefined && body.dueDate !== null) {
    dueDate = typeof body.dueDate === "number" ? body.dueDate : undefined;
    if (dueDate === undefined) fields.dueDate = "Must be a ms-epoch number";
  }

  const required = typeof body.required === "boolean" ? body.required : undefined;
  if (required === undefined) fields.required = "Must be a boolean";

  const formId = body.formId === undefined || body.formId === null
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
    } else {
      input.title = body.title.trim();
    }
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") {
      fields.description = "Must be a string or null";
    } else {
      input.description = body.description;
    }
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate !== null && typeof body.dueDate !== "number") {
      fields.dueDate = "Must be a ms-epoch number or null";
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
  if (body.formId !== undefined) {
    if (body.formId !== null && typeof body.formId !== "string") {
      fields.formId = "Must be a string or null";
    } else {
      input.formId = body.formId;
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
  const contactIds = Array.isArray(body.contactIds)
    ? body.contactIds.filter((x): x is string => typeof x === "string")
    : [];
  if (contactIds.length === 0) {
    throw new ApiError("invalid", "contactIds must be a non-empty array", { contactIds: "Required" });
  }

  await assignTask(c.var.db, taskId, contactIds);
  const grid = await getOnboardingGrid(c.var.db, ownership.eventId);
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
// Bulk remind
// ---------------------------------------------------------------------------

// POST /api/v1/events/:eventId/onboarding/remind
taskRoutes.post("/events/:eventId/onboarding/remind", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = asRecord(await c.req.json().catch(() => ({})));
  const taskIds = Array.isArray(body.taskIds)
    ? body.taskIds.filter((x): x is string => typeof x === "string")
    : undefined;

  const mailer = makeMailer(c.var.db);
  const result = await remindNow(c.var.db, mailer, eventId, taskIds, new Date());
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Cron entrypoint (DEC-023): due-date-driven only, called from
// src/index.ts's scheduled() handler. Never reachable from a status-change
// path (DEC-009).
// ---------------------------------------------------------------------------

export async function runDueReminders(env: Bindings): Promise<void> {
  const db = makeDb(env);
  const mailer = makeMailer(db);
  const now = new Date();
  const eventIds = await listEventIdsWithOutstandingAssignments(db);
  for (const eventId of eventIds) {
    await sendDueRemindersForEvent(db, mailer, eventId, now);
  }
}
