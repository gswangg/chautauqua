// Multi-portal decision 73: the Speakers grid's per-portal view. A portal
// is read as its stored memberships (who it covers, kept current by
// src/server/repo/portals/reconcile.ts) and its task items (what it brings),
// so the grid narrows in SQL and never re-runs the rule matcher per read.
// The grid is the speaker roster, so only session memberships count: a
// sponsor contact or event role the portal also covers has no row, and
// must not reach its counts or its reminders either.

import { and, eq, sql, type AnyColumn } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { sessionParticipationKey } from "../../../domain/portals/participations";
import { findPortal, type PortalRecord } from "../portals/store";

/** The portal, only when it belongs to this event. */
export async function findEventPortal(db: Db, eventId: string, portalId: string): Promise<PortalRecord | null> {
  const portal = await findPortal(db, portalId);
  return portal && portal.eventId === eventId ? portal : null;
}

/** A participant row (joined as `participant`) whose session the portal
 * covers. */
export function participantInPortal(portalId: string) {
  return sql`exists (select 1 from ${schema.portalMembership} where ${schema.portalMembership.portalId} = ${portalId} and ${schema.portalMembership.participationKey} = ${sessionParticipationKey("")} || ${schema.participant.id})`;
}

const SESSION_KEY_PREFIX = sessionParticipationKey("");

/** A membership through a session, not a company or an event role. */
function isSessionMembership() {
  return sql`substr(${schema.portalMembership.participationKey}, 1, ${SESSION_KEY_PREFIX.length}) = ${SESSION_KEY_PREFIX}`;
}

/** A contact the portal covers through one of their sessions. */
export function contactInPortal(portalId: string, contactId: AnyColumn) {
  return sql`exists (select 1 from ${schema.portalMembership} where ${schema.portalMembership.portalId} = ${portalId} and ${schema.portalMembership.contactId} = ${contactId} and ${isSessionMembership()})`;
}

/** A task (joined as `task`) one of the portal's items brings. */
export function taskInPortal(portalId: string) {
  return sql`${schema.task.id} in (select ${schema.portalItem.taskId} from ${schema.portalItem} where ${schema.portalItem.portalId} = ${portalId} and ${schema.portalItem.taskId} is not null)`;
}

/** Who and what a portal's reminders reach: the people on its sessions and
 * its task items, each narrowed by the ids the caller already named. Either list
 * can come back empty, which callers must treat as "nobody", never as
 * the reminder code's "no filter". */
export async function portalReminderScope(
  db: Db,
  eventId: string,
  portal: PortalRecord,
  taskIds: string[] | undefined,
  contactIds: string[] | undefined,
): Promise<{ taskIds: string[]; contactIds: string[] }> {
  const portalTaskIds = [...new Set(portal.items.map((i) => i.taskId).filter((id): id is string => id !== null))];
  const members = await db
    .selectDistinct({ contactId: schema.portalMembership.contactId })
    .from(schema.portalMembership)
    .where(
      and(
        eq(schema.portalMembership.portalId, portal.id),
        eq(schema.portalMembership.eventId, eventId),
        isSessionMembership(),
      ),
    );
  const memberIds = members.map((m) => m.contactId);
  return {
    taskIds: taskIds ? portalTaskIds.filter((id) => taskIds.includes(id)) : portalTaskIds,
    contactIds: contactIds ? memberIds.filter((id) => contactIds.includes(id)) : memberIds,
  };
}

// ---------------------------------------------------------------------------
// Decision 75: the "Assigned directly" view -- the people an organizer
// picked by name for a task, and those tasks. A direct assignment is an
// attached task_assignment row with source = 'direct'.
// ---------------------------------------------------------------------------

/** A task (joined as `task`) someone holds by a direct assignment. */
export function taskAssignedDirectly() {
  return sql`exists (select 1 from ${schema.taskAssignment} where ${schema.taskAssignment.taskId} = ${schema.task.id} and ${schema.taskAssignment.source} = 'direct' and ${schema.taskAssignment.detachedAt} is null)`;
}

/** A contact (joined as `contact`) who holds a direct assignment for one of
 * this event's tasks. */
export function contactAssignedDirectly(eventId: string) {
  return sql`exists (select 1 from ${schema.taskAssignment} inner join ${schema.task} on ${schema.task.id} = ${schema.taskAssignment.taskId} where ${schema.taskAssignment.contactId} = ${schema.contact.id} and ${schema.task.eventId} = ${eventId} and ${schema.taskAssignment.source} = 'direct' and ${schema.taskAssignment.detachedAt} is null)`;
}

/** Who and what the direct view's reminders reach: the tasks and people of
 * the event's attached direct assignments, narrowed by any ids named. */
export async function directReminderScope(
  db: Db,
  eventId: string,
  taskIds: string[] | undefined,
  contactIds: string[] | undefined,
): Promise<{ taskIds: string[]; contactIds: string[] }> {
  const rows = await db
    .selectDistinct({ taskId: schema.taskAssignment.taskId, contactId: schema.taskAssignment.contactId })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .where(and(eq(schema.task.eventId, eventId), eq(schema.taskAssignment.source, "direct"), sql`${schema.taskAssignment.detachedAt} is null`));
  const directTasks = [...new Set(rows.map((r) => r.taskId))];
  const directPeople = [...new Set(rows.map((r) => r.contactId))];
  return {
    taskIds: taskIds ? directTasks.filter((id) => taskIds.includes(id)) : directTasks,
    contactIds: contactIds ? directPeople.filter((id) => contactIds.includes(id)) : directPeople,
  };
}
