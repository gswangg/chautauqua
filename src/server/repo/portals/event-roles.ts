// Event-level roles (Press, Volunteer): participations with no session or
// sponsor company, so a portal like Volunteers has someone to cover.

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { ApiError } from "../../http";
import { EVENT_ROLE_OPTIONS, eventRoleLabel, isEventRole } from "../../../domain/portals/participations";

export interface EventRoleRow {
  id: string;
  contactId: string;
  role: string;
  roleLabel: string;
  name: string;
  email: string;
}

export async function listEventRoles(db: Db, eventId: string, contactId?: string): Promise<EventRoleRow[]> {
  const rows = await db
    .select({
      id: schema.eventRole.id,
      contactId: schema.eventRole.contactId,
      role: schema.eventRole.role,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
    })
    .from(schema.eventRole)
    .innerJoin(schema.contact, eq(schema.contact.id, schema.eventRole.contactId))
    .where(contactId ? and(eq(schema.eventRole.eventId, eventId), eq(schema.eventRole.contactId, contactId)) : eq(schema.eventRole.eventId, eventId))
    .orderBy(asc(schema.eventRole.role), asc(schema.contact.lastName), asc(schema.eventRole.id));
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    role: r.role,
    roleLabel: eventRoleLabel(r.role),
    name: `${r.firstName} ${r.lastName}`.trim() || r.email,
    email: r.email,
  }));
}

/** Gives a contact an event role. Idempotent: adding the same role twice is
 * one participation. */
export async function addEventRole(
  db: Db,
  input: { orgId: string; eventId: string; contactId: unknown; role: unknown },
  now: Date,
): Promise<{ id: string; created: boolean }> {
  if (typeof input.role !== "string" || !isEventRole(input.role)) {
    throw new ApiError("invalid", `Role must be one of ${EVENT_ROLE_OPTIONS.map((o) => o.value).join(", ")}.`, { role: "Invalid value" });
  }
  if (typeof input.contactId !== "string" || input.contactId === "") {
    throw new ApiError("invalid", "contactId is required", { contactId: "Required" });
  }
  const contact = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(and(eq(schema.contact.id, input.contactId), eq(schema.contact.orgId, input.orgId)))
    .limit(1);
  if (!contact[0]) throw new ApiError("not_found", "Contact not found");
  const id = newId();
  const inserted = await db
    .insert(schema.eventRole)
    .values({ id, eventId: input.eventId, contactId: input.contactId, role: input.role, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: [schema.eventRole.eventId, schema.eventRole.contactId, schema.eventRole.role] })
    .returning({ id: schema.eventRole.id });
  if (inserted.length > 0) return { id, created: true };
  const existing = await db
    .select({ id: schema.eventRole.id })
    .from(schema.eventRole)
    .where(and(eq(schema.eventRole.eventId, input.eventId), eq(schema.eventRole.contactId, input.contactId), eq(schema.eventRole.role, input.role)))
    .orderBy(asc(schema.eventRole.id)).limit(1);
  return { id: existing[0]!.id, created: false };
}

export async function removeEventRole(db: Db, eventId: string, eventRoleId: string): Promise<void> {
  const deleted = await db
    .delete(schema.eventRole)
    .where(and(eq(schema.eventRole.id, eventRoleId), eq(schema.eventRole.eventId, eventId)))
    .returning({ id: schema.eventRole.id });
  if (deleted.length === 0) throw new ApiError("not_found", "Role not found");
}
