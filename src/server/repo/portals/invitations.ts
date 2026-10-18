// Invite to speak (Portals frame, flow 8): an organizer invites a person
// onto a session with a message and a reply-by date; the email links to
// /portal/invitations/:token, which shows what accepting brings and lets
// them accept or decline. Declining ends the participation (it leaves every
// portal); accepting activates it.

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { ApiError } from "../../http";
import { hashClaimToken, newClaimToken } from "../../../auth/claim";
import { formatRef } from "../../../domain/ids";
import { PARTICIPANT_ROLE_OPTIONS } from "../../../domain/participant-roles";
import { inviteParticipant, DUPLICATE_PARTICIPANT, OVER_CAP } from "../participants";
import { findOrCreateContact } from "../submissions/create";
import { touchSubmissions } from "../submissions/touch";
import { parsePersonInput } from "../sponsors/organizer";
import { MAX_INVITATION_MESSAGE } from "../../../domain/portals/limits";
import { answerFieldRoleCondition, roleAnswerLabel } from "../form-roles";
import { formatDayMedium } from "../../../lib/event-time";
import { clockHHMM } from "../../../domain/clock";
import { publicRoomLabel } from "../../../domain/schedule";
import { formatMinutes } from "../../../domain/sponsors";
import { isIsoDate } from "../../../domain/iso-date";


export interface InvitationRecord {
  participantId: string;
  submissionId: string;
  contactId: string;
  eventId: string;
  orgId: string;
  role: string;
  inviteStatus: string;
  message: string | null;
  replyBy: number | null;
  declineNote: string | null;
  invitedByName: string | null;
  sessionTitle: string;
  sessionRef: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Resolves an invitation link. Unknown tokens resolve to null. */
export async function findInvitationByToken(db: Db, token: string): Promise<InvitationRecord | null> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return null;
  const hash = await hashClaimToken(token);
  const rows = await db
    .select({
      participantId: schema.participant.id,
      submissionId: schema.participant.submissionId,
      contactId: schema.participant.contactId,
      eventId: schema.submission.eventId,
      orgId: schema.event.orgId,
      role: schema.participant.role,
      inviteStatus: schema.participant.inviteStatus,
      message: schema.participant.invitationMessage,
      replyBy: schema.participant.replyBy,
      declineNote: schema.participant.declineNote,
      invitedByUserId: schema.participant.invitedByUserId,
      sessionTitle: schema.submission.title,
      seq: schema.submission.seq,
      recordPrefix: schema.event.recordPrefix,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
    .where(eq(schema.participant.invitationTokenHash, hash))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  let invitedByName: string | null = null;
  if (r.invitedByUserId) {
    const u = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, r.invitedByUserId)).limit(1);
    invitedByName = u[0]?.name ?? null;
  }
  return {
    participantId: r.participantId,
    submissionId: r.submissionId,
    contactId: r.contactId,
    eventId: r.eventId,
    orgId: r.orgId,
    role: r.role,
    inviteStatus: r.inviteStatus,
    message: r.message,
    replyBy: r.replyBy?.getTime() ?? null,
    declineNote: r.declineNote,
    invitedByName,
    sessionTitle: r.sessionTitle,
    sessionRef: formatRef(r.recordPrefix, r.seq),
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
  };
}

export interface InviteToSpeakInput {
  orgId: string;
  eventId: string;
  submissionId: unknown;
  contactId?: unknown;
  person?: { name?: unknown; firstName?: unknown; lastName?: unknown; email?: unknown };
  role?: unknown;
  message?: unknown;
  replyBy?: unknown;
  invitedByUserId: string;
}

/** Adds an invited participant to a session of this event and mints the
 * invitation link token. Returns the token (sent once, in the email). */
export async function inviteToSpeak(
  db: Db,
  input: InviteToSpeakInput,
  now: Date,
): Promise<{ participantId: string; contactId: string; token: string; role: string; replyBy: number | null; message: string | null }> {
  if (typeof input.submissionId !== "string" || input.submissionId === "") {
    throw new ApiError("invalid", "Choose the session to invite them to.", { submissionId: "Required" });
  }
  const sessions = await db
    .select({ id: schema.submission.id })
    .from(schema.submission)
    .where(and(eq(schema.submission.id, input.submissionId), eq(schema.submission.eventId, input.eventId)))
    .limit(1);
  if (!sessions[0]) throw new ApiError("not_found", "Session not found");
  const role = input.role === undefined ? "speaker" : input.role;
  if (typeof role !== "string" || !PARTICIPANT_ROLE_OPTIONS.some((o) => o.value === role)) {
    throw new ApiError("invalid", `Role must be one of ${PARTICIPANT_ROLE_OPTIONS.map((o) => o.value).join(", ")}.`, { role: "Invalid value" });
  }
  let message: string | null = null;
  if (input.message !== undefined && input.message !== null) {
    if (typeof input.message !== "string" || input.message.length > MAX_INVITATION_MESSAGE) {
      throw new ApiError("invalid", `The message is at most ${MAX_INVITATION_MESSAGE} characters.`, { message: "Too long" });
    }
    message = input.message.trim() || null;
  }
  let replyBy: Date | null = null;
  if (input.replyBy !== undefined && input.replyBy !== null && input.replyBy !== "") {
    if (typeof input.replyBy !== "string" || !isIsoDate(input.replyBy)) {
      throw new ApiError("invalid", "Reply-by must be a date (YYYY-MM-DD).", { replyBy: "Invalid date" });
    }
    const [y, m, d] = input.replyBy.split("-").map(Number) as [number, number, number];
    replyBy = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(replyBy.getTime())) throw new ApiError("invalid", "Reply-by must be a real date.", { replyBy: "Invalid date" });
  }

  let contact: { id: string; firstName: string; lastName: string; email: string; title: string | null; company: string | null };
  if (typeof input.contactId === "string" && input.contactId !== "") {
    const rows = await db
      .select({
        id: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
        title: schema.contact.title,
        company: schema.contact.company,
      })
      .from(schema.contact)
      .where(and(eq(schema.contact.id, input.contactId), eq(schema.contact.orgId, input.orgId)))
      .limit(1);
    if (!rows[0]) throw new ApiError("not_found", "Contact not found");
    contact = rows[0];
  } else {
    const person = parsePersonInput(input.person ?? {});
    const found = await findOrCreateContact(db, input.orgId, person, now);
    contact = { id: found.id, ...person, title: found.title, company: found.company };
  }

  const result = await inviteParticipant(db, {
    submissionId: input.submissionId,
    contactId: contact.id,
    role,
    titleAtTime: contact.title,
    orgAtTime: contact.company,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
  });
  if (result === DUPLICATE_PARTICIPANT) throw new ApiError("conflict", "They're already on this session.", { contactId: "Already a participant" });
  if (result === OVER_CAP) throw new ApiError("invalid", "This session already has as many participants as it can.");

  const token = newClaimToken();
  await db
    .update(schema.participant)
    .set({
      invitationMessage: message,
      replyBy,
      invitedByUserId: input.invitedByUserId,
      invitationTokenHash: await hashClaimToken(token),
      updatedAt: now,
    })
    .where(eq(schema.participant.id, result.id));
  await touchSubmissions(db, [input.submissionId as string], now);
  return { participantId: result.id, contactId: contact.id, token, role, replyBy: replyBy?.getTime() ?? null, message };
}

/** Answers an invitation from its link. Only an open invitation moves. */
export async function answerInvitation(
  db: Db,
  invitation: InvitationRecord,
  answer: "accepted" | "declined",
  now: Date,
): Promise<void> {
  if (invitation.inviteStatus !== "invited") throw new ApiError("conflict", "This invitation has already been answered.");
  const updated = await db
    .update(schema.participant)
    .set({ inviteStatus: answer, updatedAt: now })
    .where(and(eq(schema.participant.id, invitation.participantId), eq(schema.participant.inviteStatus, "invited")))
    .returning({ id: schema.participant.id });
  if (updated.length === 0) throw new ApiError("conflict", "This invitation has already been answered.");
  await touchSubmissions(db, [invitation.submissionId], now);
}

/** The optional message a decliner leaves for the organizers. */
export async function saveDeclineNote(db: Db, invitation: InvitationRecord, note: unknown, now: Date): Promise<void> {
  if (invitation.inviteStatus !== "declined") throw new ApiError("conflict", "Only a declined invitation takes a note.");
  if (typeof note !== "string" || note.length > MAX_INVITATION_MESSAGE) {
    throw new ApiError("invalid", `The note is at most ${MAX_INVITATION_MESSAGE} characters.`, { note: "Too long" });
  }
  await db
    .update(schema.participant)
    .set({ declineNote: note.trim() || null, updatedAt: now })
    .where(and(eq(schema.participant.id, invitation.participantId), eq(schema.participant.contactId, invitation.contactId)));
  await touchSubmissions(db, [invitation.submissionId], now);
}

/** "Wed 13 May · 14:00 · Main Stage · 30 min" for a session: its placement
 * when it's on the agenda, and its length from the format answer. Null when
 * there's nothing to say yet. */
export async function sessionPlacementLine(db: Db, submissionId: string): Promise<string | null> {
  const [slots, formats] = await Promise.all([
    db
      .select({ day: schema.scheduleSlot.day, startMin: schema.scheduleSlot.startMin, roomName: schema.room.name })
      .from(schema.scheduleSlot)
      .leftJoin(schema.room, eq(schema.room.id, schema.scheduleSlot.roomId))
      .where(eq(schema.scheduleSlot.submissionId, submissionId))
      .orderBy(asc(schema.scheduleSlot.id))
      .limit(1),
    db
      .select({ valueJson: schema.submissionAnswer.valueJson })
      .from(schema.submissionAnswer)
      .where(and(eq(schema.submissionAnswer.submissionId, submissionId), answerFieldRoleCondition("session_format")))
      .orderBy(asc(schema.submissionAnswer.id))
      .limit(1),
  ]);
  const parts: string[] = [];
  const slot = slots[0];
  if (slot) parts.push(formatDayMedium(slot.day), clockHHMM(slot.startMin), publicRoomLabel(slot.roomName));
  const format = formats[0] ? roleAnswerLabel(formats[0].valueJson) : null;
  const minutes = format ? formatMinutes(format) : null;
  if (minutes) parts.push(`${minutes} min`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
