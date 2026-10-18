// Multi-portal: load every participation of an event (or of one person)
// with the attributes portal rules match on (src/domain/portals/rules.ts).

import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { answerFieldRoleCondition, roleAnswerLabel } from "../form-roles";
import { parseContactCustomFields } from "../contacts/crud";
import { personNameOrEmail } from "../../../domain/person-name";
import {
  COMPANY_CONTACT_ROLE,
  companyParticipationKey,
  eventRoleParticipationKey,
  isSessionOrigin,
  sessionParticipationKey,
  type Participation,
  type SponsorshipStatus,
} from "../../../domain/portals/participations";

interface Scope {
  eventId: string;
  // narrow to one person's participations
  contactId?: string;
}

async function loadContacts(db: Db, ids: string[]): Promise<Map<string, { name: string; custom: Record<string, string> }>> {
  const out = new Map<string, { name: string; custom: Record<string, string> }>();
  for (const chunk of chunkIds([...new Set(ids)])) {
    const rows = await db
      .select({
        id: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
        customFieldsJson: schema.contact.customFieldsJson,
      })
      .from(schema.contact)
      .where(inArray(schema.contact.id, chunk));
    for (const r of rows) {
      out.set(r.id, { name: personNameOrEmail(r), custom: parseContactCustomFields(r.customFieldsJson) });
    }
  }
  return out;
}

async function loadSessionParticipations(db: Db, scope: Scope): Promise<Omit<Participation, "contactName" | "customFields">[]> {
  const where: SQL[] = [eq(schema.submission.eventId, scope.eventId)];
  if (scope.contactId) where.push(eq(schema.participant.contactId, scope.contactId));
  const rows = await db
    .select({
      participantId: schema.participant.id,
      contactId: schema.participant.contactId,
      role: schema.participant.role,
      inviteStatus: schema.participant.inviteStatus,
      submissionId: schema.submission.id,
      title: schema.submission.title,
      seq: schema.submission.seq,
      status: schema.submission.status,
      origin: schema.submission.origin,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(and(...where));
  if (rows.length === 0) return [];

  const submissionIds = [...new Set(rows.map((r) => r.submissionId))];
  const formats = new Map<string, string | null>();
  const tracks = new Map<string, Set<string>>();
  for (const chunk of chunkIds(submissionIds)) {
    const answers = await db
      .select({ submissionId: schema.submissionAnswer.submissionId, valueJson: schema.submissionAnswer.valueJson })
      .from(schema.submissionAnswer)
      .where(and(inArray(schema.submissionAnswer.submissionId, chunk), answerFieldRoleCondition("session_format")));
    for (const a of answers) formats.set(a.submissionId, roleAnswerLabel(a.valueJson));
    const trackRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
      .from(schema.submissionTrack)
      .where(inArray(schema.submissionTrack.submissionId, chunk));
    for (const t of trackRows) {
      const set = tracks.get(t.submissionId) ?? new Set<string>();
      set.add(t.trackId);
      tracks.set(t.submissionId, set);
    }
  }

  return rows.map((r) => {
    const trackIds = new Set(tracks.get(r.submissionId) ?? []);
    if (!isSessionOrigin(r.origin)) throw new Error(`submission ${r.submissionId} has an unknown origin: ${r.origin}`);
    return {
      key: sessionParticipationKey(r.participantId),
      kind: "session" as const,
      eventId: scope.eventId,
      contactId: r.contactId,
      role: r.role,
      participationStatus: r.inviteStatus,
      session: {
        submissionId: r.submissionId,
        participantId: r.participantId,
        title: r.title,
        ref: formatRef(r.recordPrefix, r.seq),
        status: r.status,
        origin: r.origin,
        format: formats.get(r.submissionId) ?? null,
        trackIds: [...trackIds],
      },
      company: null,
      eventRole: null,
    };
  });
}

async function loadCompanyParticipations(db: Db, scope: Scope): Promise<Omit<Participation, "contactName" | "customFields">[]> {
  const where: SQL[] = [eq(schema.sponsorContact.eventId, scope.eventId)];
  if (scope.contactId) where.push(eq(schema.sponsorContact.contactId, scope.contactId));
  const rows = await db
    .select({
      sponsorContactId: schema.sponsorContact.id,
      contactId: schema.sponsorContact.contactId,
      status: schema.sponsorContact.status,
      isPrimary: schema.sponsorContact.isPrimary,
      sponsorshipId: schema.sponsorship.id,
      sponsorshipStatus: schema.sponsorship.status,
      tierId: schema.sponsorship.tierId,
      companyId: schema.sponsorCompany.id,
      companyName: schema.sponsorCompany.name,
    })
    .from(schema.sponsorContact)
    .innerJoin(schema.sponsorship, eq(schema.sponsorship.id, schema.sponsorContact.sponsorshipId))
    .innerJoin(schema.sponsorCompany, eq(schema.sponsorCompany.id, schema.sponsorship.companyId))
    .where(and(...where));
  if (rows.length === 0) return [];
  const tierIds = [...new Set(rows.map((r) => r.tierId).filter((t): t is string => t !== null))];
  const tierNames = new Map<string, string>();
  for (const chunk of chunkIds(tierIds)) {
    const tiers = await db
      .select({ id: schema.sponsorTier.id, name: schema.sponsorTier.name })
      .from(schema.sponsorTier)
      .where(inArray(schema.sponsorTier.id, chunk));
    for (const t of tiers) tierNames.set(t.id, t.name);
  }
  return rows.map((r) => ({
    key: companyParticipationKey(r.sponsorContactId),
    kind: "company" as const,
    eventId: scope.eventId,
    contactId: r.contactId,
    role: COMPANY_CONTACT_ROLE,
    // a teammate who hasn't joined yet is like an unanswered invitation
    participationStatus: r.status === "invited" ? "invited" : "none",
    session: null,
    company: {
      sponsorContactId: r.sponsorContactId,
      sponsorshipId: r.sponsorshipId,
      companyId: r.companyId,
      companyName: r.companyName,
      tierId: r.tierId,
      tierName: r.tierId ? (tierNames.get(r.tierId) ?? null) : null,
      sponsorshipStatus: r.sponsorshipStatus as SponsorshipStatus,
      isPrimary: r.isPrimary,
    },
    eventRole: null,
  }));
}

async function loadEventRoleParticipations(db: Db, scope: Scope): Promise<Omit<Participation, "contactName" | "customFields">[]> {
  const where: SQL[] = [eq(schema.eventRole.eventId, scope.eventId)];
  if (scope.contactId) where.push(eq(schema.eventRole.contactId, scope.contactId));
  const rows = await db
    .select({ id: schema.eventRole.id, contactId: schema.eventRole.contactId, role: schema.eventRole.role })
    .from(schema.eventRole)
    .where(and(...where));
  return rows.map((r) => ({
    key: eventRoleParticipationKey(r.id),
    kind: "event_role" as const,
    eventId: scope.eventId,
    contactId: r.contactId,
    role: r.role,
    participationStatus: "none",
    session: null,
    company: null,
    eventRole: { eventRoleId: r.id },
  }));
}

/** Every participation of the event (or of one person in it), declined
 * ones included: callers decide what to drop. */
export async function loadParticipations(db: Db, scope: Scope): Promise<Participation[]> {
  const [sessions, companies, roles] = await Promise.all([
    loadSessionParticipations(db, scope),
    loadCompanyParticipations(db, scope),
    loadEventRoleParticipations(db, scope),
  ]);
  const all = [...sessions, ...companies, ...roles];
  const contacts = await loadContacts(
    db,
    all.map((p) => p.contactId),
  );
  return all.map((p) => {
    const c = contacts.get(p.contactId);
    if (!c) throw new Error(`participation ${p.key} names a missing contact ${p.contactId}`);
    return { ...p, contactName: c.name, customFields: c.custom };
  });
}

/** The events a person has any participation in, within one org. */
export async function listParticipationEventIds(db: Db, contactId: string, orgId: string): Promise<string[]> {
  const [viaSessions, viaCompanies, viaRoles] = await Promise.all([
    db
      .selectDistinct({ eventId: schema.submission.eventId })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
      .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
      .where(and(eq(schema.participant.contactId, contactId), eq(schema.event.orgId, orgId))),
    db
      .selectDistinct({ eventId: schema.sponsorContact.eventId })
      .from(schema.sponsorContact)
      .innerJoin(schema.event, eq(schema.event.id, schema.sponsorContact.eventId))
      .where(and(eq(schema.sponsorContact.contactId, contactId), eq(schema.event.orgId, orgId))),
    db
      .selectDistinct({ eventId: schema.eventRole.eventId })
      .from(schema.eventRole)
      .innerJoin(schema.event, eq(schema.event.id, schema.eventRole.eventId))
      .where(and(eq(schema.eventRole.contactId, contactId), eq(schema.event.orgId, orgId))),
  ]);
  return [...new Set([...viaSessions, ...viaCompanies, ...viaRoles].map((r) => r.eventId))];
}
