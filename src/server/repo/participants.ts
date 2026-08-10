// Organizer participant-management repo (DEC-070): invite a participant
// onto an existing submission, and toggle a participant's public
// visibility. This module deliberately contains NO mail/mailer import —
// per product principle 4 (communications are deliberate, not automatic),
// creating an invitation NEVER sends email; notifying the invitee is a
// separate, explicit action via the existing compose flow. Verified by a
// source-scan test in test/api-participants.test.ts (DEC-009-style
// tripwire).

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { DEC_070 } from "../../decisions";

// Compile-checked dependency marker: this module implements DEC_070's
// endpoint contract (invite shape, duplicate rejection, visibility toggle).
void DEC_070;

/** Sentinel returned by inviteParticipant when the (submissionId, contactId)
 * pair already has a participant row — callers surface this as an
 * ApiError('invalid', ..., { contactId: ... }). */
export const DUPLICATE_PARTICIPANT = "duplicate" as const;

export interface InviteParticipantInput {
  submissionId: string;
  contactId: string;
  role?: string;
}

/** Participant row shape shared by both endpoints' responses, matching
 * src/server/repo/submissions/detail.ts's participant serialization
 * (minus the contact name/email projection, which callers can join in
 * separately if needed). */
export interface ParticipantRow {
  id: string;
  contactId: string;
  role: string;
  order: number;
  visible: boolean;
  inviteStatus: string;
}

/** Inserts a new participant row: visible=true, inviteStatus='invited',
 * order=max(order)+1 for the submission, role defaults to 'speaker'.
 * Returns DUPLICATE_PARTICIPANT (without writing) if a participant already
 * exists for this (submissionId, contactId) pair. Caller is expected to
 * have already verified the submission and contact both belong to the
 * caller's org. */
export async function inviteParticipant(
  db: Db,
  input: InviteParticipantInput,
): Promise<ParticipantRow | typeof DUPLICATE_PARTICIPANT> {
  const { submissionId, contactId } = input;
  const role = input.role && input.role.trim() ? input.role : "speaker";

  const existing = await db
    .select({ id: schema.participant.id })
    .from(schema.participant)
    .where(and(eq(schema.participant.submissionId, submissionId), eq(schema.participant.contactId, contactId)))
    .limit(1);
  if (existing[0]) return DUPLICATE_PARTICIPANT;

  const existingOrderRows = await db
    .select({ maxOrder: sql<number>`max(${schema.participant.order})` })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId));
  const nextOrder = (existingOrderRows[0]?.maxOrder ?? -1) + 1;

  const now = new Date();
  const id = newId();
  await db.insert(schema.participant).values({
    id,
    submissionId,
    contactId,
    role,
    order: nextOrder,
    visible: true,
    inviteStatus: "invited",
    createdAt: now,
    updatedAt: now,
  });

  return { id, contactId, role, order: nextOrder, visible: true, inviteStatus: "invited" };
}

export interface ParticipantScope {
  id: string;
  submissionId: string;
  orgId: string;
}

/** Ownership lookup for a single participant row, scoped through its
 * submission -> event -> org — used before any visibility-toggle write. */
export async function getParticipantOwnership(db: Db, participantId: string): Promise<ParticipantScope | null> {
  const rows = await db
    .select({
      id: schema.participant.id,
      submissionId: schema.participant.submissionId,
      orgId: schema.event.orgId,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.participant.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setParticipantVisible(db: Db, participantId: string, visible: boolean): Promise<void> {
  await db
    .update(schema.participant)
    .set({ visible, updatedAt: new Date() })
    .where(eq(schema.participant.id, participantId));
}

/** Fetches a single participant row in the same shape inviteParticipant
 * returns, for endpoints (like the PATCH visibility toggle) that mutate a
 * participant and then need to serialize the current state. */
export async function getParticipantRow(db: Db, participantId: string): Promise<ParticipantRow | null> {
  const rows = await db
    .select({
      id: schema.participant.id,
      contactId: schema.participant.contactId,
      role: schema.participant.role,
      order: schema.participant.order,
      visible: schema.participant.visible,
      inviteStatus: schema.participant.inviteStatus,
    })
    .from(schema.participant)
    .where(eq(schema.participant.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}
