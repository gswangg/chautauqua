// Writes and reads the append-only audit log (src/domain/audit.ts). Nothing
// edits or deletes an audit_event row's record of what happened; a contact
// merge only repoints its contact ids onto the surviving contact
// (contacts/merge.ts), as it does for every other reference.

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { parseAuditDetailsJson, type AuditAction, type AuditDetails } from "../../domain/audit";

export interface AuditActor {
  userId: string | null;
  contactId: string | null;
  label: string;
}

export interface AuditInput {
  orgId: string;
  eventId: string | null;
  actor: AuditActor;
  action: AuditAction;
  targetType: string;
  targetId: string;
  subjectContactId?: string | null;
  details?: AuditDetails;
}

export async function writeAuditEvent(db: Db, input: AuditInput, now: Date): Promise<void> {
  await db.insert(schema.auditEvent).values({
    id: newId(),
    orgId: input.orgId,
    eventId: input.eventId,
    actorUserId: input.actor.userId,
    actorContactId: input.actor.contactId,
    actorLabel: input.actor.label,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    subjectContactId: input.subjectContactId ?? null,
    detailsJson: input.details ? JSON.stringify(input.details) : null,
    createdAt: now,
  });
}

export interface AuditEntry {
  id: string;
  action: string;
  actorLabel: string;
  details: AuditDetails;
  createdAt: number;
}

/** The history of one target, oldest first. */
export async function listAuditEventsForTarget(db: Db, targetType: string, targetId: string): Promise<AuditEntry[]> {
  const rows = await db
    .select({
      id: schema.auditEvent.id,
      action: schema.auditEvent.action,
      actorLabel: schema.auditEvent.actorLabel,
      detailsJson: schema.auditEvent.detailsJson,
      createdAt: schema.auditEvent.createdAt,
    })
    .from(schema.auditEvent)
    .where(and(eq(schema.auditEvent.targetType, targetType), eq(schema.auditEvent.targetId, targetId)))
    .orderBy(asc(schema.auditEvent.createdAt));
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorLabel: r.actorLabel,
    details: parseAuditDetailsJson(r.detailsJson),
    createdAt: r.createdAt.getTime(),
  }));
}
