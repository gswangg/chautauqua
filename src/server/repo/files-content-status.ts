// Files repo — organizer content-approval status (J8, DEC-020 contract).
// Split out of files.ts (contention decomposition) — no behavior change,
// files.ts re-exports everything below for existing callers.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { ApiError } from "../http";
import { chunkIds } from "../../lib/chunk";
import { CONTENT_STATUSES, type ContentStatus } from "../../domain/content-status";

// ---------------------------------------------------------------------------
// Content status (organizer approval)
// ---------------------------------------------------------------------------

// DEC-003 wave-73 amendment: CONTENT_STATUSES/ContentStatus now live in
// src/domain/content-status.ts (pure core, importable from the SPA); this
// module re-exports them verbatim so none of its importers change.
export { CONTENT_STATUSES, type ContentStatus };

export function isValidContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
}

// DEC-720 wave-32 amendment: the prior ROUTE_SETTABLE_CONTENT_STATUSES /
// isRouteSettableContentStatus predicate refused `changes_requested` on the
// two bare status doors (files.ts, api/submissions.ts), forcing every
// transition into that state through POST .../content-note, which
// unconditionally mails. That inverted DEC-009 ("status changes never
// auto-email") for the one status that matters most at volume. Both routes
// now validate against `isValidContentStatus` like updateContentStatus/
// updateContentStatuses already do — this module still MUST NEVER import a
// mailer, and that invariant now covers all three values uniformly.

// DEC-713: the one status a speaker may still delete their own latest
// version under — imported by the delete route rather than re-listing the
// "pending" literal.
export const PENDING_CONTENT_STATUS: ContentStatus = "pending";

/** Organizer-only content approval; DEC-009 invariant — this module MUST
 * NEVER import a mailer. Status changes never send email.
 *
 * DEC-962 wave-58 amendment: scoped on eventId in the WHERE, matching the
 * bulk twin below — every submission WRITE in this module carries scope of
 * its own rather than depending on a caller's prior ownership check. Both
 * callers (files.ts, content-notes.ts) already hold eventId from their own
 * getSubmissionScope lookup. */
export async function updateContentStatus(
  db: Db,
  eventId: string,
  submissionId: string,
  contentStatus: ContentStatus,
): Promise<void> {
  await db
    .update(schema.submission)
    .set({ contentStatus, updatedAt: new Date() })
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.id, submissionId)));
}

/** Bulk content-status write (DEC-568): the only way to move a batch of
 * submissions' content_status without one HTTP round-trip per row. DEC-009
 * invariant applies here too — this module MUST NEVER import a mailer;
 * content-status changes never send email.
 *
 * Empty ids -> `{ updated: 0 }` with zero statements issued. Otherwise:
 * chunked SELECT of ids scoped to eventId (loud full-set guard mirroring
 * submissions/status.ts — any requested id not found under this event
 * throws `invalid` naming the unknown ids), then one chunked UPDATE per
 * batch. Returns the count of distinct requested ids updated. */
export async function updateContentStatuses(
  db: Db,
  eventId: string,
  ids: string[],
  contentStatus: ContentStatus,
): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };

  const foundIds: string[] = [];
  for (const idChunk of chunkIds(ids)) {
    const rows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
    foundIds.push(...rows.map((r) => r.id));
  }

  const requested = [...new Set(ids)];
  const foundIdSet = new Set(foundIds);
  const missing = requested.filter((id) => !foundIdSet.has(id));
  if (missing.length > 0) {
    throw new ApiError("invalid", "One or more submission ids do not belong to this event", {
      ids: `unknown ids: ${missing.join(", ")}`,
    });
  }

  const now = new Date();
  for (const idChunk of chunkIds(requested)) {
    await db
      .update(schema.submission)
      .set({ contentStatus, updatedAt: now })
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
  }

  return { updated: requested.length };
}

/** DEC-020 amendment: a new deliverable version reopens content review.
 * One set-based UPDATE, never read-then-write; idempotent — a submission
 * already 'pending' is left untouched (WHERE excludes it), and rows outside
 * ('approved','changes_requested') are simply not matched. DEC-009 invariant
 * applies here too — this module MUST NEVER import a mailer.
 *
 * DEC-020 wave-58 amendment: returns `{ reopened }`, derived from
 * `.returning()` on the SAME statement (never a second SELECT) — true iff
 * this call's WHERE actually matched a row (i.e. the submission moved
 * approved/changes_requested -> pending), false when it was already
 * 'pending' (idempotent no-op) or doesn't exist. Callers use this to
 * disclose the reopen at the point of upload rather than leaving it silent.
 *
 * DEC-962 wave-58 amendment: takes eventId and scopes on it — both callers
 * (files.ts's organizer upload, portal/tasks.tsx's speaker upload) already
 * hold eventId from their own scope lookup (getSubmissionScope /
 * getAssignmentScope), so this carries scope of its own rather than
 * depending on the caller's prior authz check alone. */
export async function reopenContentReview(db: Db, eventId: string, submissionId: string): Promise<{ reopened: boolean }> {
  const rows = await db
    .update(schema.submission)
    .set({ contentStatus: PENDING_CONTENT_STATUS, updatedAt: new Date() })
    .where(
      and(
        eq(schema.submission.eventId, eventId),
        eq(schema.submission.id, submissionId),
        inArray(schema.submission.contentStatus, ["approved", "changes_requested"]),
      ),
    )
    .returning({ id: schema.submission.id });
  return { reopened: rows.length > 0 };
}
