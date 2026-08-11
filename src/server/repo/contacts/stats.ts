// Contacts repo: dashboard stats. Split out of repo/contacts.ts (contention
// decomposition, no behavior change). See repo/contacts.ts for the
// module-level contract notes.

import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";

export interface ContactStats {
  total: number;
  eventCount: number;
  returningSpeakers: number;
  topCompanies: { company: string; count: number }[];
}

export async function getContactStats(db: Db, orgId: string): Promise<ContactStats> {
  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(eq(schema.contact.orgId, orgId));
  const total = Number(totalRows[0]?.count ?? 0);

  // CRM-12 dashboard KPI: total events the org runs (not per-contact).
  const orgEventCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.event)
    .where(eq(schema.event.orgId, orgId));
  const eventCount = Number(orgEventCountRows[0]?.count ?? 0);

  const eventCountRows = await db
    .select({
      contactId: schema.contact.id,
      eventCount: sql<number>`count(distinct ${schema.submission.eventId})`,
    })
    .from(schema.contact)
    .innerJoin(schema.participant, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .where(eq(schema.contact.orgId, orgId))
    .groupBy(schema.contact.id);
  const returningSpeakers = eventCountRows.filter((r) => Number(r.eventCount) > 1).length;

  const companyRows = await db
    .select({ company: schema.contact.company, count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), sql`${schema.contact.company} is not null and ${schema.contact.company} != ''`))
    .groupBy(schema.contact.company)
    .orderBy(desc(sql`count(*)`))
    .limit(5);
  const topCompanies = companyRows
    .filter((r): r is { company: string; count: number } => r.company !== null)
    .map((r) => ({ company: r.company, count: Number(r.count) }));

  return { total, eventCount, returningSpeakers, topCompanies };
}
