// J6 onboarding tasks repo (DEC-023): ownership/authz lookups for task and
// task_assignment rows. Split out of repo/tasks.ts for contention
// decomposition (no behavior change) — see repo/tasks.ts's barrel header.

import { eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";

export async function getEventOrgId(db: Db, eventId: string): Promise<string | null> {
  const rows = await db
    .select({ orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

/** Returns the (eventId, orgId, kind) owning a task row, or null if it
 * doesn't exist. `kind` is included so callers (e.g. the PATCH deliverable
 * kind gate, DEC-240) don't need a second round-trip. */
export async function getTaskOwnership(
  db: Db,
  taskId: string,
): Promise<{ eventId: string; orgId: string; kind: string } | null> {
  const rows = await db
    .select({ eventId: schema.task.eventId, orgId: schema.event.orgId, kind: schema.task.kind })
    .from(schema.task)
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.task.id, taskId))
    .limit(1);
  return rows[0] ?? null;
}

/** Returns ownership info for a task_assignment row: event/org (for the
 * organizer authz path) plus the assignment's own contactId (for the
 * owning-speaker authz path — DEC-023 PATCH allows organizer OR the owning
 * speaker, compared against c.var.auth.contactId). Also carries the task's
 * kind and the assignment's own response_json/file_id so the PATCH handler
 * can enforce the DEC-214 speaker-side kind gates in the same round-trip. */
export async function getAssignmentOwnership(
  db: Db,
  assignmentId: string,
): Promise<{
  eventId: string;
  orgId: string;
  contactId: string;
  kind: string;
  responseJson: string | null;
  fileId: string | null;
} | null> {
  const rows = await db
    .select({
      eventId: schema.task.eventId,
      orgId: schema.event.orgId,
      contactId: schema.taskAssignment.contactId,
      kind: schema.task.kind,
      responseJson: schema.taskAssignment.responseJson,
      fileId: schema.taskAssignment.fileId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.taskAssignment.id, assignmentId))
    .limit(1);
  return rows[0] ?? null;
}
