// DEC-729: the portal shows EVERY submission the speaker owns, with its
// status — pending and declined included, never only the accepted ones
// getMySessions (./sessions.ts) restricts to. "Owns" means the contact holds
// a participant row on the submission, any role, any invite_status — this
// is deliberately broader than getPortalData's PORTAL_VISIBLE_INVITE_STATUSES
// filter (which hides declined invitations from the worklist/session cards):
// a speaker who declined a co-presenter invite must still be able to see
// that the submission itself existed and what happened to it.

import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import type { SubmissionStatus } from "../../../domain/status";
import { answerFieldRoleCondition, roleAnswerMap } from "../form-roles";
import { speakerStatusLabel, type SpeakerStatusLabel } from "./shared";
import { loadTrackNamesBySubmission } from "../submission-tracks";

export interface PortalSubmissionListItem {
  id: string;
  ref: string;
  title: string;
  statusLabel: SpeakerStatusLabel;
  submittedAt: number;
  trackName: string | null;
  format: string | null;
}

/** Every submission where `contactId` holds a participant row (any role,
 * any invite_status), newest first. statusLabel goes through the DEC-016
 * speakerStatusLabel mapper — accept_queue/decline_queue never leak. */
export async function getMySubmissions(db: Db, contactId: string, orgId: string): Promise<PortalSubmissionListItem[]> {
  const rows = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      status: schema.submission.status,
      createdAt: schema.submission.createdAt,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(and(eq(schema.participant.contactId, contactId), eq(schema.event.orgId, orgId)))
    .orderBy(desc(schema.submission.createdAt));

  const ids = rows.map((r) => r.id);
  let formatBySubmission = new Map<string, string | null>();
  if (ids.length > 0) {
    // DEC-962 audit: `ids` is derived from the `rows` query above, which
    // already carries contactId/orgId in its own WHERE, but that scoping is
    // caller discipline within this function, not a predicate on THIS query
    // — join back through participant/event and AND the same contactId/orgId
    // here too, so this query can never be lifted out and reused against a
    // wider id list without silently losing its scope.
    const formatRows = await db
      .select({ submissionId: schema.submissionAnswer.submissionId, valueJson: schema.submissionAnswer.valueJson })
      .from(schema.submissionAnswer)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.submissionAnswer.submissionId))
      .innerJoin(schema.participant, eq(schema.participant.submissionId, schema.submission.id))
      .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
      .where(
        and(
          inArray(schema.submissionAnswer.submissionId, ids),
          answerFieldRoleCondition("session_format"),
          eq(schema.participant.contactId, contactId),
          eq(schema.event.orgId, orgId),
        ),
      );
    formatBySubmission = roleAnswerMap(formatRows);
  }

  const trackNames = await loadTrackNamesBySubmission(db, ids);

  return rows.map((row) => ({
    id: row.id,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    statusLabel: speakerStatusLabel(row.status as SubmissionStatus),
    submittedAt: row.createdAt.getTime(),
    trackName: trackNames.get(row.id)?.[0] ?? null,
    format: formatBySubmission.get(row.id) ?? null,
  }));
}
