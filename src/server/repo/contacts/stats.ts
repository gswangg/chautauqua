// Contacts repo: dashboard stats. Split out of repo/contacts.ts (contention
// decomposition, no behavior change). See repo/contacts.ts for the
// module-level contract notes.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { findDuplicateGroupsForOrg } from "./merge";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";
import { DEC_432, DEC_711, DEC_809 } from "../../../decisions";

void DEC_711; // speakerCount + duplicateCount: every figure the directory page states is endpoint-backed
void DEC_432; // returningSpeakers/eventCount: stays on the endpoint whether or not a surface renders it
void DEC_809; // directory headline states returning speakers + event reach alongside the counts already there

export interface ContactStats {
  total: number;
  topCompanies: { company: string; count: number }[];
  // DEC-710/DEC-711: figures the directory title summary and rail actually
  // render — a contact holding a 'speaker' participant role on any of the
  // org's events, and the group count from findDuplicateGroupsForOrg
  // (computed once here, not a second time by the caller).
  speakerCount: number;
  duplicateCount: number;
  // DEC-432/DEC-809: a contact holding an active 'speaker' role on more than
  // one of this org's own events (returningSpeakers), and the number of
  // DISTINCT such events (eventCount) — the same speakerParticipationConditions
  // population speakerCount uses, never a second predicate. Stays on the
  // endpoint even on a wave where no surface renders it (a figure the API
  // states must be true whether or not a surface renders it today).
  returningSpeakers: number;
  eventCount: number;
}

// Amendment (wave 21, narrowed wave 33): backs the speakerCount subquery — a
// contact holding a 'speaker' participant role with an ACTIVE invite status,
// on THIS ORG's events (via event.orgId, not just contact.orgId), never any
// participant role on any event.
function speakerParticipationConditions(orgId: string) {
  return and(
    eq(schema.contact.orgId, orgId),
    eq(schema.event.orgId, orgId),
    eq(schema.participant.role, "speaker"),
    inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
  );
}

export async function getContactStats(db: Db, orgId: string): Promise<ContactStats> {
  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId));
  const total = Number(totalRows[0]?.count ?? 0);

  const companyRows = await db
    .select({ company: schema.contact.company, count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), sql`${schema.contact.company} is not null and ${schema.contact.company} != ''`))
    .groupBy(schema.contact.company)
    .orderBy(desc(sql`count(*)`), asc(schema.contact.company))
    .limit(5);
  const topCompanies = companyRows
    .filter((r): r is { company: string; count: number } => r.company !== null)
    .map((r) => ({ company: r.company, count: Number(r.count) }));

  // Contacts holding a 'speaker' participant role on any of the org's
  // events (DEC-711): distinct contact count via a single count(*) over a
  // GROUP BY subquery, filtered by speakerParticipationConditions.
  const speakerSubquery = db
    .select({ contactId: schema.contact.id })
    .from(schema.contact)
    .innerJoin(schema.participant, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(speakerParticipationConditions(orgId))
    .groupBy(schema.contact.id)
    .as("speaker_contacts");
  const speakerCountRows = await db.select({ count: sql<number>`count(*)` }).from(speakerSubquery);
  const speakerCount = Number(speakerCountRows[0]?.count ?? 0);

  // DEC-711: the same group count the Duplicates tab and rail render — one
  // definition (findDuplicateGroupsForOrg), never a second tally.
  const duplicateGroups = await findDuplicateGroupsForOrg(db, orgId);
  const duplicateCount = duplicateGroups.length;

  // DEC-432/DEC-809: returningSpeakers — a contact holding an active
  // 'speaker' role on more than one of THIS org's events, over the same
  // speakerParticipationConditions population as speakerCount. A single
  // count(*) over a GROUP BY contact.id HAVING count(distinct eventId) > 1
  // subquery — never a JS post-filter over an unbounded row set.
  const returningSubquery = db
    .select({ contactId: schema.contact.id })
    .from(schema.contact)
    .innerJoin(schema.participant, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(speakerParticipationConditions(orgId))
    .groupBy(schema.contact.id)
    .having(sql`count(distinct ${schema.submission.eventId}) > 1`)
    .as("returning_speaker_contacts");
  const returningRows = await db.select({ count: sql<number>`count(*)` }).from(returningSubquery);
  const returningSpeakers = Number(returningRows[0]?.count ?? 0);

  // DEC-432/DEC-809: eventCount — the number of DISTINCT events in that same
  // population (not a count of participations).
  const eventCountRows = await db
    .select({ count: sql<number>`count(distinct ${schema.submission.eventId})` })
    .from(schema.contact)
    .innerJoin(schema.participant, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(speakerParticipationConditions(orgId));
  const eventCount = Number(eventCountRows[0]?.count ?? 0);

  return { total, topCompanies, speakerCount, duplicateCount, returningSpeakers, eventCount };
}
