// Submission detail HISTORY panel (DEC-892): a real timeline, not the
// content-revisions list alone. Unions four sources that each already have
// their own writer/reader elsewhere -- this module adds no table and no
// column, it only reads and merges:
//   1. submitted    -- submission.created_at (+ its external_ref source, if
//                       the submission was imported -- DEC-612).
//   2. edited        -- submission_revision rows, via the SAME query
//                       listRevisions (repo/revisions.ts) already runs.
//   3. reviewed      -- evaluation rows with submitted_at set, labelled with
//                       the owning plan's name and honouring the SAME
//                       reviewer-anonymization resolver the review surface
//                       uses (domain/review-identity.ts).
//   4. emailed       -- email_log rows addressed to one of this submission's
//                       participant contacts, sent at/after the submission
//                       was created -- one joined query, never one query per
//                       participant.

import { and, eq, gte } from "drizzle-orm";
import * as schema from "../../../db/schema";
import type { Db } from "../../context";
import { listRevisions } from "../revisions";
import { resolveReviewerIdentity, ANONYMIZED_REVIEWER_CELL } from "../../../domain/review-identity";

export interface SubmissionHistoryEntry {
  id: string;
  at: Date;
  kind: "submitted" | "edited" | "reviewed" | "emailed";
  label: string;
  detail: string | null;
}

/** Newest-first (`at` desc, `id` asc tiebreak) timeline for a submission's
 * detail page. Callers must have already checked ownership/authz -- this
 * function trusts submissionId and throws (fails loudly) if the submission
 * itself doesn't exist, since every caller today reaches this only after an
 * ownership lookup already confirmed it does. */
export async function listSubmissionHistory(db: Db, submissionId: string): Promise<SubmissionHistoryEntry[]> {
  const submissionRows = await db
    .select({
      id: schema.submission.id,
      createdAt: schema.submission.createdAt,
      externalRef: schema.submission.externalRef,
    })
    .from(schema.submission)
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const submissionRow = submissionRows[0];
  if (!submissionRow) throw new Error(`listSubmissionHistory: submission ${submissionId} not found`);

  const [revisions, reviewedRows, emailedRows] = await Promise.all([
    listRevisions(db, submissionId),
    db
      .select({
        id: schema.evaluation.id,
        planName: schema.evaluationPlan.name,
        anonymized: schema.evaluationPlan.anonymized,
        submittedAt: schema.evaluation.submittedAt,
        reviewerFirstName: schema.contact.firstName,
        reviewerLastName: schema.contact.lastName,
        reviewerEmail: schema.user.email,
      })
      .from(schema.evaluation)
      .innerJoin(schema.evaluationPlan, eq(schema.evaluation.planId, schema.evaluationPlan.id))
      .innerJoin(schema.user, eq(schema.evaluation.reviewerId, schema.user.id))
      .leftJoin(schema.contact, eq(schema.user.contactId, schema.contact.id))
      .where(eq(schema.evaluation.submissionId, submissionId)),
    // DEC-892: one join, never one email_log lookup per participant.
    db
      .select({
        id: schema.emailLog.id,
        subject: schema.emailLog.subject,
        sentAt: schema.emailLog.sentAt,
      })
      .from(schema.emailLog)
      .innerJoin(schema.participant, eq(schema.emailLog.contactId, schema.participant.contactId))
      .where(
        and(
          eq(schema.participant.submissionId, submissionId),
          gte(schema.emailLog.sentAt, submissionRow.createdAt),
        ),
      ),
  ]);

  const entries: SubmissionHistoryEntry[] = [];

  entries.push({
    id: `submission:${submissionRow.id}`,
    at: submissionRow.createdAt,
    kind: "submitted",
    label: "Submitted",
    detail: submissionRow.externalRef ? `Imported via ${submissionRow.externalRef.split(":")[0]}` : null,
  });

  for (const r of revisions) {
    entries.push({
      id: r.id,
      at: new Date(r.createdAt),
      kind: "edited",
      label: `Edited by ${r.editorName}`,
      detail: r.title,
    });
  }

  for (const r of reviewedRows) {
    if (!r.submittedAt) continue; // in-progress evaluation, not a history event
    const reviewerLabel =
      resolveReviewerIdentity({
        anonymized: r.anonymized,
        firstName: r.reviewerFirstName,
        lastName: r.reviewerLastName,
        email: r.reviewerEmail,
      }) ?? ANONYMIZED_REVIEWER_CELL;
    entries.push({
      id: r.id,
      at: r.submittedAt,
      kind: "reviewed",
      label: `Reviewed — ${r.planName}`,
      detail: reviewerLabel,
    });
  }

  for (const r of emailedRows) {
    entries.push({
      id: r.id,
      at: r.sentAt,
      kind: "emailed",
      label: "Emailed",
      detail: r.subject,
    });
  }

  entries.sort((a, b) => {
    const diff = b.at.getTime() - a.at.getTime();
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return entries;
}
