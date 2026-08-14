// Contacts repo: dashboard stats. Split out of repo/contacts.ts (contention
// decomposition, no behavior change). See repo/contacts.ts for the
// module-level contract notes.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { findDuplicateGroupsForOrg } from "./merge";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";
import { DEC_711 } from "../../../decisions";

void DEC_711; // speakerCount + duplicateCount: every figure the directory page states is endpoint-backed

export interface ContactStats {
  total: number;
  topCompanies: { company: string; count: number }[];
  // DEC-710/DEC-711: figures the directory title summary and rail actually
  // render — a contact holding a 'speaker' participant role on any of the
  // org's events, and the group count from findDuplicateGroupsForOrg
  // (computed once here, not a second time by the caller).
  speakerCount: number;
  duplicateCount: number;
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

  return { total, topCompanies, speakerCount, duplicateCount };
}
