// Invitations (DEC-029): participant rows with invite_status='invited' for
// the speaker's own contact, across every event they're invited to.

import { and, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";

export type InviteAction = "accept" | "decline";
export type InviteStatus = "none" | "invited" | "accepted" | "declined";

/** Pure transition rule: only a participant row currently 'invited' may be
 * responded to — accepted/declined/none rows are terminal or not-yet-invited
 * and reject the transition (no re-answering, no answering an invite that
 * doesn't exist yet). */
export function canTransitionInvite(currentStatus: string): boolean {
  return currentStatus === "invited";
}

export function nextInviteStatus(action: InviteAction): "accepted" | "declined" {
  return action === "accept" ? "accepted" : "declined";
}

export interface PortalInvitation {
  participantId: string;
  submissionId: string;
  ref: string;
  title: string;
  eventName: string;
}

export async function getMyInvitations(db: Db, contactId: string, orgId: string): Promise<PortalInvitation[]> {
  const rows = await db
    .select({
      participantId: schema.participant.id,
      submissionId: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      recordPrefix: schema.event.recordPrefix,
      eventName: schema.event.name,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(
      and(
        eq(schema.participant.contactId, contactId),
        eq(schema.participant.inviteStatus, "invited"),
        eq(schema.event.orgId, orgId),
      ),
    );

  return rows.map((row) => ({
    participantId: row.participantId,
    submissionId: row.submissionId,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    eventName: row.eventName,
  }));
}

export interface PortalParticipantScope {
  id: string;
  contactId: string;
  inviteStatus: string;
  orgId: string;
}

/** Ownership lookup for a single participant row, scoped to the caller's
 * org — used before any /portal/invitations/:participantId write. */
export async function getParticipantScope(db: Db, participantId: string): Promise<PortalParticipantScope | null> {
  const rows = await db
    .select({
      id: schema.participant.id,
      contactId: schema.participant.contactId,
      inviteStatus: schema.participant.inviteStatus,
      orgId: schema.event.orgId,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.participant.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setInviteStatus(db: Db, participantId: string, status: "accepted" | "declined"): Promise<void> {
  await db
    .update(schema.participant)
    .set({ inviteStatus: status, updatedAt: new Date() })
    .where(eq(schema.participant.id, participantId));
}
