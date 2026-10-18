// Sponsor-designed sessions (Portals frame, flows 5 and 7): a sponsor
// contact drafts a session on a free slot of their package, submits it, and
// an organizer approves, asks for changes, or declines. Approval turns it
// into an ordinary accepted session (origin 'sponsor') with the sponsor's
// speakers as participants; a decline gives the slot back.
//
// Sponsor-side functions take a SponsorAccess (./access.ts), so they can only
// ever touch the caller's own sponsorship.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { ApiError } from "../../http";
import {
  MAX_SPONSOR_SESSION_SPEAKERS,
  freeSlots,
  isSponsorSessionStatus,
  organizerCanDecide,
  slotLabel,
  sponsorCanEdit,
  sponsorCanSubmit,
  sponsorCanWithdraw,
  type Slot,
  type SponsorSessionStatus,
} from "../../../domain/sponsors";
import { submissionSeqSubquery } from "../submissions/seq";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { touchSubmissions } from "../submissions/touch";
import { findOrCreateContact } from "../submissions/create";
import { getEventFieldIdByRole } from "../form-roles";
import { loadPackages } from "./package";
import type { SponsorAccess } from "./access";
import { findSponsorSessionForAccess } from "./access";
import { parsePersonInput } from "./organizer";
import { MAX_ORGANIZER_NOTE, MAX_SPONSOR_SESSION_ABSTRACT, MAX_SPONSOR_SESSION_TITLE } from "../../../domain/portals/limits";


export interface SponsorSessionSpeaker {
  id: string;
  contactId: string;
  name: string;
  email: string;
  // has no portal account yet: invited when the session is approved
  isNew: boolean;
}

export interface SponsorSessionDetail {
  id: string;
  sponsorshipId: string;
  eventId: string;
  companyName: string;
  tierName: string | null;
  entitlementId: string;
  slotLabel: string;
  format: string;
  minutes: number | null;
  title: string;
  abstract: string | null;
  status: SponsorSessionStatus;
  lastNote: string | null;
  lastNoteAt: number | null;
  lastNoteBy: string | null;
  declineReason: string | null;
  submissionId: string | null;
  submittedAt: number | null;
  submitCount: number;
  decidedAt: number | null;
  createdAt: number;
  speakers: SponsorSessionSpeaker[];
  slots: Slot[];
}

async function loadSpeakers(db: Db, sessionIds: string[]): Promise<Map<string, SponsorSessionSpeaker[]>> {
  const out = new Map<string, SponsorSessionSpeaker[]>();
  if (sessionIds.length === 0) return out;
  const rows: { id: string; sessionId: string; contactId: string; firstName: string; lastName: string; email: string; userId: string | null }[] = [];
  for (const chunk of chunkIds(sessionIds)) {
    rows.push(
      ...(await db
        .select({
          id: schema.sponsorSessionSpeaker.id,
          sessionId: schema.sponsorSessionSpeaker.sponsorSessionId,
          contactId: schema.sponsorSessionSpeaker.contactId,
          firstName: schema.contact.firstName,
          lastName: schema.contact.lastName,
          email: schema.contact.email,
          userId: schema.user.id,
        })
        .from(schema.sponsorSessionSpeaker)
        .innerJoin(schema.contact, eq(schema.contact.id, schema.sponsorSessionSpeaker.contactId))
        .leftJoin(schema.user, eq(schema.user.contactId, schema.contact.id))
        .where(inArray(schema.sponsorSessionSpeaker.sponsorSessionId, chunk))
        .orderBy(asc(schema.sponsorSessionSpeaker.position), asc(schema.sponsorSessionSpeaker.createdAt))),
    );
  }
  for (const r of rows) {
    const list = out.get(r.sessionId) ?? [];
    if (list.some((s) => s.contactId === r.contactId)) continue;
    list.push({
      id: r.id,
      contactId: r.contactId,
      name: `${r.firstName} ${r.lastName}`.trim() || r.email,
      email: r.email,
      isNew: r.userId === null,
    });
    out.set(r.sessionId, list);
  }
  return out;
}

async function loadDetails(db: Db, rows: (typeof schema.sponsorSession.$inferSelect)[]): Promise<SponsorSessionDetail[]> {
  if (rows.length === 0) return [];
  const sponsorshipIds = [...new Set(rows.map((r) => r.sponsorshipId))];
  const meta: { id: string; companyName: string; tierName: string | null }[] = [];
  for (const chunk of chunkIds(sponsorshipIds)) {
    meta.push(
      ...(await db
        .select({ id: schema.sponsorship.id, companyName: schema.sponsorCompany.name, tierName: schema.sponsorTier.name })
        .from(schema.sponsorship)
        .innerJoin(schema.sponsorCompany, eq(schema.sponsorCompany.id, schema.sponsorship.companyId))
        .leftJoin(schema.sponsorTier, eq(schema.sponsorTier.id, schema.sponsorship.tierId))
        .where(inArray(schema.sponsorship.id, chunk))),
    );
  }
  const entitlements: (typeof schema.sponsorEntitlement.$inferSelect)[] = [];
  for (const chunk of chunkIds([...new Set(rows.map((r) => r.entitlementId))])) {
    entitlements.push(...(await db.select().from(schema.sponsorEntitlement).where(inArray(schema.sponsorEntitlement.id, chunk))));
  }
  const [speakers, packages] = await Promise.all([loadSpeakers(db, rows.map((r) => r.id)), loadPackages(db, sponsorshipIds)]);
  return rows.map((r) => {
    const m = meta.find((x) => x.id === r.sponsorshipId);
    const e = entitlements.find((x) => x.id === r.entitlementId);
    if (!isSponsorSessionStatus(r.status)) throw new Error(`sponsor_session ${r.id} has an unknown status ${r.status}`);
    const format = e?.format ?? "Session";
    const minutes = e?.minutes ?? null;
    return {
      id: r.id,
      sponsorshipId: r.sponsorshipId,
      eventId: r.eventId,
      companyName: m?.companyName ?? "",
      tierName: m?.tierName ?? null,
      entitlementId: r.entitlementId,
      slotLabel: slotLabel({ format, minutes }),
      format,
      minutes,
      title: r.title,
      abstract: r.abstract,
      status: r.status,
      lastNote: r.lastNote,
      lastNoteAt: r.lastNoteAt?.getTime() ?? null,
      lastNoteBy: r.lastNoteBy,
      declineReason: r.declineReason,
      submissionId: r.submissionId,
      submittedAt: r.submittedAt?.getTime() ?? null,
      submitCount: r.submitCount,
      decidedAt: r.decidedAt?.getTime() ?? null,
      createdAt: r.createdAt.getTime(),
      speakers: speakers.get(r.id) ?? [],
      slots: packages.get(r.sponsorshipId)?.slots ?? [],
    };
  });
}

// ---------------------------------------------------------------------------
// Sponsor side
// ---------------------------------------------------------------------------

export async function listSessionsForAccess(db: Db, access: SponsorAccess): Promise<SponsorSessionDetail[]> {
  const rows = await db
    .select()
    .from(schema.sponsorSession)
    .where(eq(schema.sponsorSession.sponsorshipId, access.sponsorshipId))
    .orderBy(asc(schema.sponsorSession.createdAt), asc(schema.sponsorSession.id));
  return loadDetails(db, rows);
}

export async function getSessionForAccess(db: Db, access: SponsorAccess, sessionId: string): Promise<SponsorSessionDetail | null> {
  const row = await findSponsorSessionForAccess(db, access, sessionId);
  if (!row) return null;
  return (await loadDetails(db, [row]))[0] ?? null;
}

/** Starts a draft on a free slot of `entitlementId`, with the creator as
 * its first speaker. */
export async function createSponsorDraft(db: Db, access: SponsorAccess, entitlementId: unknown, now: Date): Promise<string> {
  if (typeof entitlementId !== "string" || entitlementId === "") {
    throw new ApiError("invalid", "Choose what this session is using.", { entitlementId: "Required" });
  }
  const pkg = (await loadPackages(db, [access.sponsorshipId])).get(access.sponsorshipId);
  if (!pkg || !pkg.entitlements.some((e) => e.id === entitlementId)) {
    throw new ApiError("invalid", "That isn't part of your package.", { entitlementId: "Unknown entitlement" });
  }
  if (!freeSlots(pkg.slots).some((s) => s.entitlementId === entitlementId)) {
    throw new ApiError("conflict", "That part of your package is already used.", { entitlementId: "Already used" });
  }
  const id = newId();
  await db.insert(schema.sponsorSession).values({
    id,
    sponsorshipId: access.sponsorshipId,
    eventId: access.eventId,
    entitlementId,
    title: "",
    status: "draft",
    createdByContactId: access.contactId,
    createdAt: now,
    updatedAt: now,
  });
  await db
    .insert(schema.sponsorSessionSpeaker)
    .values({ id: newId(), sponsorSessionId: id, contactId: access.contactId, position: 0, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: [schema.sponsorSessionSpeaker.sponsorSessionId, schema.sponsorSessionSpeaker.contactId] });
  return id;
}

function requireEditable(status: string): void {
  if (!isSponsorSessionStatus(status) || !sponsorCanEdit(status)) {
    throw new ApiError("conflict", "This session is locked while the organizers review it.");
  }
}

export async function updateSponsorDraft(
  db: Db,
  access: SponsorAccess,
  sessionId: string,
  input: { title?: unknown; abstract?: unknown },
  now: Date,
): Promise<void> {
  const row = await findSponsorSessionForAccess(db, access, sessionId);
  if (!row) throw new ApiError("not_found", "Session not found");
  requireEditable(row.status);
  const set: Partial<typeof schema.sponsorSession.$inferInsert> = { updatedAt: now };
  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.length > MAX_SPONSOR_SESSION_TITLE) {
      throw new ApiError("invalid", `A title is at most ${MAX_SPONSOR_SESSION_TITLE} characters.`, { title: "Too long" });
    }
    set.title = input.title.trim();
  }
  if (input.abstract !== undefined) {
    if (input.abstract !== null && (typeof input.abstract !== "string" || input.abstract.length > MAX_SPONSOR_SESSION_ABSTRACT)) {
      throw new ApiError("invalid", `An abstract is at most ${MAX_SPONSOR_SESSION_ABSTRACT} characters.`, { abstract: "Too long" });
    }
    set.abstract = typeof input.abstract === "string" && input.abstract.trim() ? input.abstract.trim() : null;
  }
  await db
    .update(schema.sponsorSession)
    .set(set)
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.sponsorshipId, access.sponsorshipId)));
}

/** Adds a speaker by name and email. Someone not in the system gets a
 * person record now; their invitation goes out only on approval. */
export async function addSponsorSpeaker(
  db: Db,
  access: SponsorAccess,
  sessionId: string,
  input: { name?: unknown; email?: unknown },
  now: Date,
): Promise<{ contactId: string }> {
  const row = await findSponsorSessionForAccess(db, access, sessionId);
  if (!row) throw new ApiError("not_found", "Session not found");
  requireEditable(row.status);
  const person = parsePersonInput(input);
  const existing = await db
    .select({ id: schema.sponsorSessionSpeaker.id })
    .from(schema.sponsorSessionSpeaker)
    .where(eq(schema.sponsorSessionSpeaker.sponsorSessionId, row.id));
  if (existing.length >= MAX_SPONSOR_SESSION_SPEAKERS) {
    throw new ApiError("invalid", `A session can have at most ${MAX_SPONSOR_SESSION_SPEAKERS} speakers.`);
  }
  const contact = await findOrCreateContact(db, access.orgId, person, now);
  const inserted = await db
    .insert(schema.sponsorSessionSpeaker)
    .values({ id: newId(), sponsorSessionId: row.id, contactId: contact.id, position: existing.length, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: [schema.sponsorSessionSpeaker.sponsorSessionId, schema.sponsorSessionSpeaker.contactId] })
    .returning({ id: schema.sponsorSessionSpeaker.id });
  if (inserted.length === 0) throw new ApiError("conflict", "That person is already a speaker on this session.", { email: "Already a speaker" });
  await db
    .update(schema.sponsorSession)
    .set({ updatedAt: now })
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.sponsorshipId, access.sponsorshipId)));
  return { contactId: contact.id };
}

export async function removeSponsorSpeaker(db: Db, access: SponsorAccess, sessionId: string, speakerId: string, now: Date): Promise<void> {
  const row = await findSponsorSessionForAccess(db, access, sessionId);
  if (!row) throw new ApiError("not_found", "Session not found");
  requireEditable(row.status);
  const deleted = await db
    .delete(schema.sponsorSessionSpeaker)
    .where(and(eq(schema.sponsorSessionSpeaker.id, speakerId), eq(schema.sponsorSessionSpeaker.sponsorSessionId, row.id)))
    .returning({ id: schema.sponsorSessionSpeaker.id });
  if (deleted.length === 0) throw new ApiError("not_found", "Speaker not found");
  await db
    .update(schema.sponsorSession)
    .set({ updatedAt: now })
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.sponsorshipId, access.sponsorshipId)));
}

/** Sends a draft (or a reopened session) to the organizers' queue. */
export async function submitSponsorSession(db: Db, access: SponsorAccess, sessionId: string, now: Date): Promise<{ resubmitted: boolean; title: string }> {
  const row = await findSponsorSessionForAccess(db, access, sessionId);
  if (!row) throw new ApiError("not_found", "Session not found");
  if (!isSponsorSessionStatus(row.status) || !sponsorCanSubmit(row.status)) {
    throw new ApiError("conflict", "This session is already with the organizers.");
  }
  if (row.title.trim() === "") throw new ApiError("invalid", "Give the session a title before sending it.", { title: "Required" });
  const speakers = await db
    .select({ id: schema.sponsorSessionSpeaker.id })
    .from(schema.sponsorSessionSpeaker)
    .where(eq(schema.sponsorSessionSpeaker.sponsorSessionId, row.id))
    .orderBy(asc(schema.sponsorSessionSpeaker.id)).limit(1);
  if (speakers.length === 0) throw new ApiError("invalid", "Add at least one speaker before sending it.", { speakers: "Required" });
  await db
    .update(schema.sponsorSession)
    .set({ status: "submitted", submittedAt: now, submitCount: row.submitCount + 1, updatedAt: now })
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.status, row.status)));
  return { resubmitted: row.submitCount > 0, title: row.title };
}

/** Takes a submitted session back to draft; it keeps its slot. */
export async function withdrawSponsorSession(db: Db, access: SponsorAccess, sessionId: string, now: Date): Promise<{ title: string }> {
  const row = await findSponsorSessionForAccess(db, access, sessionId);
  if (!row) throw new ApiError("not_found", "Session not found");
  if (!isSponsorSessionStatus(row.status) || !sponsorCanWithdraw(row.status)) {
    throw new ApiError("conflict", "Only a session waiting for the organizers can be withdrawn.");
  }
  await db
    .update(schema.sponsorSession)
    .set({ status: "draft", updatedAt: now })
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.status, "submitted")));
  return { title: row.title };
}

/** Deletes a draft that was never sent. */
export async function discardSponsorDraft(db: Db, access: SponsorAccess, sessionId: string): Promise<void> {
  const row = await findSponsorSessionForAccess(db, access, sessionId);
  if (!row) throw new ApiError("not_found", "Session not found");
  if (row.status !== "draft" || row.submitCount > 0) throw new ApiError("conflict", "Only a draft that was never sent can be discarded.");
  await db.delete(schema.sponsorSessionSpeaker).where(eq(schema.sponsorSessionSpeaker.sponsorSessionId, row.id));
  await db
    .delete(schema.sponsorSession)
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.sponsorshipId, access.sponsorshipId)));
}

// ---------------------------------------------------------------------------
// Organizer side
// ---------------------------------------------------------------------------

export interface QueueGroups {
  waiting: SponsorSessionDetail[];
  withSponsor: SponsorSessionDetail[];
  decided: SponsorSessionDetail[];
}

/** The approval queue: waiting first (oldest submission first), then
 * sessions back with the sponsor, then decided ones (newest first). Drafts
 * never sent are the sponsor's own business and stay out. */
export async function listSponsorSessionQueue(db: Db, eventId: string): Promise<QueueGroups> {
  const rows = await db
    .select()
    .from(schema.sponsorSession)
    .where(
      and(
        eq(schema.sponsorSession.eventId, eventId),
        sql`not (${schema.sponsorSession.status} = 'draft' and ${schema.sponsorSession.submitCount} = 0)`,
      ),
    )
    .orderBy(asc(schema.sponsorSession.submittedAt), asc(schema.sponsorSession.id));
  const details = await loadDetails(db, rows);
  return {
    waiting: details.filter((d) => d.status === "submitted"),
    withSponsor: details.filter((d) => d.status === "changes_requested" || d.status === "draft"),
    decided: details
      .filter((d) => d.status === "approved" || d.status === "declined")
      .sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0)),
  };
}

export async function countWaitingSponsorSessions(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.sponsorSession)
    .where(and(eq(schema.sponsorSession.eventId, eventId), eq(schema.sponsorSession.status, "submitted")));
  return Number(rows[0]?.n ?? 0);
}

export async function getSponsorSessionForEvent(db: Db, eventId: string, sessionId: string): Promise<SponsorSessionDetail | null> {
  const rows = await db
    .select()
    .from(schema.sponsorSession)
    .where(and(eq(schema.sponsorSession.id, sessionId), eq(schema.sponsorSession.eventId, eventId)))
    .limit(1);
  if (!rows[0]) return null;
  return (await loadDetails(db, rows))[0] ?? null;
}

async function requireDecidable(db: Db, eventId: string, sessionId: string) {
  const rows = await db
    .select()
    .from(schema.sponsorSession)
    .where(and(eq(schema.sponsorSession.id, sessionId), eq(schema.sponsorSession.eventId, eventId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not_found", "Sponsor session not found");
  if (!isSponsorSessionStatus(row.status) || !organizerCanDecide(row.status)) {
    throw new ApiError("conflict", "This session isn't waiting for a decision.");
  }
  return row;
}

function parseNote(note: unknown, field: string, what: string): string {
  if (typeof note !== "string" || note.trim() === "") throw new ApiError("invalid", `${what} is required.`, { [field]: "Required" });
  if (note.length > MAX_ORGANIZER_NOTE) throw new ApiError("invalid", `${what} is at most ${MAX_ORGANIZER_NOTE} characters.`, { [field]: "Too long" });
  return note.trim();
}

export async function requestSponsorSessionChanges(
  db: Db,
  eventId: string,
  sessionId: string,
  input: { note: unknown; organizerName: string },
  now: Date,
): Promise<SponsorSessionDetail> {
  const row = await requireDecidable(db, eventId, sessionId);
  const note = parseNote(input.note, "note", "A note saying what needs to change");
  await db
    .update(schema.sponsorSession)
    .set({ status: "changes_requested", lastNote: note, lastNoteAt: now, lastNoteBy: input.organizerName, updatedAt: now })
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.status, "submitted")));
  return (await getSponsorSessionForEvent(db, eventId, sessionId))!;
}

export async function declineSponsorSession(
  db: Db,
  eventId: string,
  sessionId: string,
  input: { reason: unknown; organizerName: string },
  now: Date,
): Promise<SponsorSessionDetail> {
  const row = await requireDecidable(db, eventId, sessionId);
  const reason = parseNote(input.reason, "reason", "A reason");
  await db
    .update(schema.sponsorSession)
    .set({ status: "declined", declineReason: reason, lastNoteBy: input.organizerName, decidedAt: now, updatedAt: now })
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.status, "submitted")));
  return (await getSponsorSessionForEvent(db, eventId, sessionId))!;
}

/** Approves: creates the accepted session in Submissions (origin 'sponsor',
 * its format answer set from the slot) with every speaker as a participant.
 * Returns the new submission and the speakers who have no account yet (the
 * caller invites them). */
export async function approveSponsorSession(
  db: Db,
  eventId: string,
  sessionId: string,
  input: { organizerName: string },
  now: Date,
): Promise<{ detail: SponsorSessionDetail; submissionId: string; newSpeakers: SponsorSessionSpeaker[] }> {
  const row = await requireDecidable(db, eventId, sessionId);
  const detail = (await getSponsorSessionForEvent(db, eventId, sessionId))!;
  if (detail.speakers.length === 0) throw new ApiError("invalid", "This session has no speakers.");
  // claim the transition first so a double click approves once
  const claimed = await db
    .update(schema.sponsorSession)
    .set({ status: "approved", decidedAt: now, lastNoteBy: input.organizerName, updatedAt: now })
    .where(and(eq(schema.sponsorSession.id, row.id), eq(schema.sponsorSession.status, "submitted")))
    .returning({ id: schema.sponsorSession.id });
  if (claimed.length === 0) throw new ApiError("conflict", "This session was already decided.");

  const submissionId = newId();
  await db.insert(schema.submission).values({
    id: submissionId,
    eventId,
    formId: null,
    seq: submissionSeqSubquery(eventId),
    title: detail.title,
    description: detail.abstract,
    status: "accepted",
    contentStatus: "pending",
    acceptedAt: now,
    origin: "sponsor",
    createdAt: now,
    updatedAt: now,
  });
  const formatFieldId = await getEventFieldIdByRole(db, eventId, "session_format");
  if (formatFieldId) {
    await db
      .insert(schema.submissionAnswer)
      .values({ id: newId(), submissionId, formFieldId: formatFieldId, valueJson: JSON.stringify(detail.format), createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: [schema.submissionAnswer.submissionId, schema.submissionAnswer.formFieldId] });
  }
  const contacts = await db
    .select({ id: schema.contact.id, title: schema.contact.title, company: schema.contact.company, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
    .from(schema.contact)
    .where(inArray(schema.contact.id, detail.speakers.map((s) => s.contactId)));
  const participantRows = detail.speakers.map((s, order) => {
    const c = contacts.find((x) => x.id === s.contactId);
    return {
      id: newId(),
      submissionId,
      contactId: s.contactId,
      role: "speaker",
      order,
      visible: true,
      inviteStatus: "none",
      titleAtTime: c?.title ?? null,
      orgAtTime: c?.company ?? detail.companyName,
      nameAtTime: c ? `${c.firstName} ${c.lastName}`.trim() : s.name,
      createdAt: now,
      updatedAt: now,
    };
  });
  for (const chunk of chunkRowsForInsert(participantRows)) {
    await db
      .insert(schema.participant)
      .values(chunk)
      .onConflictDoNothing({ target: [schema.participant.submissionId, schema.participant.contactId] });
  }
  await db.update(schema.sponsorSession).set({ submissionId }).where(eq(schema.sponsorSession.id, row.id));
  await touchSubmissions(db, [submissionId], now);
  return {
    detail: (await getSponsorSessionForEvent(db, eventId, sessionId))!,
    submissionId,
    newSpeakers: detail.speakers.filter((s) => s.isNew),
  };
}

/** The joined contacts of a sponsorship: who hears about decisions. */
export async function listSponsorRecipients(db: Db, sponsorshipId: string) {
  return db
    .select({
      contactId: schema.sponsorContact.contactId,
      email: schema.contact.email,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
    })
    .from(schema.sponsorContact)
    .innerJoin(schema.contact, eq(schema.contact.id, schema.sponsorContact.contactId))
    .where(and(eq(schema.sponsorContact.sponsorshipId, sponsorshipId), eq(schema.sponsorContact.status, "joined")))
    .orderBy(desc(schema.sponsorContact.isPrimary), asc(schema.sponsorContact.createdAt));
}
