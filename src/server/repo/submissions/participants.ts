// Submissions repo: participant mutations (co-presenter invite, visibility
// toggle). Split out of repo/submissions.ts (contention decomposition, no
// behavior change). See repo/submissions.ts for the module-level contract
// notes. This module deliberately contains NO mail/mailer import (DEC-009
// invariant #1).

import { eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { findOrCreateContact } from "./create";

// ---------------------------------------------------------------------------
// Co-presenter invitations (w12-c PLANNER item #1): the only path that ever
// created a participant row with invite_status='invited' pre-w13 was a
// direct `wrangler d1 execute --local` INSERT from a walkthrough script.
// This is the real admin-facing endpoint: it adds a new participant to an
// existing submission with invite_status='invited'.
// Per DEC-009 invariant #1 (status changes never auto-send email), this
// function does NOT send an email — notification is a separate, explicit
// action (comms.ts), same as every other status transition.
// ---------------------------------------------------------------------------

export interface InviteCoPresenterInput {
  email: string;
  firstName: string;
  lastName: string;
}

/** Returns the new participant's id. Throws if the submission doesn't
 * exist (caller is expected to have already checked ownership). */
export async function inviteCoPresenter(
  db: Db,
  submissionId: string,
  orgId: string,
  input: InviteCoPresenterInput,
): Promise<string> {
  const now = new Date();
  const contactId = await findOrCreateContact(db, orgId, input, now);

  const existingOrderRows = await db
    .select({ maxOrder: sql<number>`max(${schema.participant.order})` })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId));
  const nextOrder = (existingOrderRows[0]?.maxOrder ?? -1) + 1;

  const id = newId();
  await db.insert(schema.participant).values({
    id,
    submissionId,
    contactId,
    role: "speaker",
    order: nextOrder,
    visible: true,
    inviteStatus: "invited",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

// ---------------------------------------------------------------------------
// Participant visibility toggle (w12-c PLANNER item #2): pre-w13 there was
// no admin API to flip participant.visible after submission-create time —
// the public.ts hidden-participant walkthrough check worked around this
// with a direct `wrangler d1 execute --local` UPDATE. This is the real
// organizer-facing "hide/show this speaker" mutation.
// ---------------------------------------------------------------------------

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
