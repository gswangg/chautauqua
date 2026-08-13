// Contacts repo: history (DEC-026: submissions + last 20 emails + distinct
// events). Split out of repo/contacts.ts (contention decomposition, no
// behavior change). See repo/contacts.ts for the module-level contract
// notes.

import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";

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
    .orderBy(asc(schema.submission.createdAt), asc(schema.submission.id));

  const submissions: ContactHistorySubmission[] = submissionRows.map((r) => ({
    id: r.id,
    ref: formatRef(r.recordPrefix, r.seq),
    title: r.title,
    eventId: r.eventId,
    eventName: r.eventName,
    status: r.status,
  }));

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

  const events = Array.from(new Set(submissions.map((s) => s.eventName)));

  return { submissions, emails, events };
}
