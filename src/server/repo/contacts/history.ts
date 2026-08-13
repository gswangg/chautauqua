// Contacts repo: history (DEC-026: submissions + last 20 emails + distinct
// events). Split out of repo/contacts.ts (contention decomposition, no
// behavior change). See repo/contacts.ts for the module-level contract
// notes.

import { asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";

// w56-c: the drawer's submissions list is capped (matching the existing
// 20-email cap below) so it can never grow unbounded. The cap is a slice of
// the ordered list, never the population — submissionsTotal (a separate
// count(*)) and events (a separate distinct query) both stay computed over
// the FULL join so capping the list can never shrink either.
export const MAX_CONTACT_HISTORY_SUBMISSIONS = 20;

export interface ContactHistorySubmission {
  id: string;
  ref: string;
  title: string;
  // DEC-795: a name is not an identity -- the id travels alongside the
  // display name so the client can test "is this THE selected event" rather
  // than string-comparing names.
  eventId: string;
  eventName: string;
  status: string;
}

export interface ContactHistoryEmail {
  id: string;
  subject: string;
  toEmail: string;
  status: string;
  sentAt: number;
}

export interface ContactHistory {
  submissions: ContactHistorySubmission[];
  submissionsTotal: number;
  emails: ContactHistoryEmail[];
  events: string[];
}

export async function getContactHistory(db: Db, contactId: string): Promise<ContactHistory> {
  const submissionRows = await db
    .select({
      id: schema.submission.id,
      title: schema.submission.title,
      status: schema.submission.status,
      seq: schema.submission.seq,
      eventId: schema.event.id,
      eventName: schema.event.name,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(eq(schema.participant.contactId, contactId))
    // DEC-534: unforced row order was arbitrary — order the per-contact
    // history panel deterministically by submission creation then id.
    .orderBy(asc(schema.submission.createdAt), asc(schema.submission.id))
    // w56-c: deterministic cap, matching the emails cap below — bounded by
    // the SAME order the drawer renders, plus one over the cap so the count
    // query (not this row count) is the only source of truth for the total.
    .limit(MAX_CONTACT_HISTORY_SUBMISSIONS + 1);

  const submissions: ContactHistorySubmission[] = submissionRows.slice(0, MAX_CONTACT_HISTORY_SUBMISSIONS).map((r) => ({
    id: r.id,
    ref: formatRef(r.recordPrefix, r.seq),
    title: r.title,
    eventId: r.eventId,
    eventName: r.eventName,
    status: r.status,
  }));

  const [submissionsTotalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(eq(schema.participant.contactId, contactId));
  const submissionsTotal = submissionsTotalRow?.count ?? 0;

  const emailRows = await db
    .select({
      id: schema.emailLog.id,
      subject: schema.emailLog.subject,
      toEmail: schema.emailLog.toEmail,
      status: schema.emailLog.status,
      sentAt: schema.emailLog.sentAt,
    })
    .from(schema.emailLog)
    .where(eq(schema.emailLog.contactId, contactId))
    // DEC-534: sentAt alone is not unique — tiebreak on id so "last 20
    // emails" is a stable 20 rather than an arbitrary subset.
    .orderBy(desc(schema.emailLog.sentAt), asc(schema.emailLog.id))
    .limit(20);

  const emails: ContactHistoryEmail[] = emailRows.map((r) => ({ ...r, sentAt: r.sentAt.getTime() }));

  // w56-c: its OWN distinct query over the full join — capping the
  // submissions list above must never shrink "Across your events".
  const eventRows = await db
    .selectDistinct({ eventName: schema.event.name })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
    .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
    .where(eq(schema.participant.contactId, contactId))
    .orderBy(asc(schema.event.name));
  const events = eventRows.map((r) => r.eventName);

  return { submissions, submissionsTotal, emails, events };
}
