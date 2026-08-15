// Files repo — organizer content-approval status (J8, DEC-020 contract).
// Split out of files.ts (contention decomposition) — no behavior change,
// files.ts re-exports everything below for existing callers.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { ApiError } from "../http";
import { chunkIds } from "../../lib/chunk";

// ---------------------------------------------------------------------------
// Content status (organizer approval)
// ---------------------------------------------------------------------------

export const CONTENT_STATUSES = ["pending", "approved", "changes_requested"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isValidContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
}

// DEC-720 (wave 53 amendment): `changes_requested` has exactly one writer —
// POST /submissions/:id/content-note, which posts the note, moves status and
// mails the speakers. The bare content-status routes (single + bulk) stay
// mailer-free per DEC-720's original ruling, so they may only WRITE the two
// values that carry no notification obligation. content-notes.ts continues
// to write via updateContentStatus directly using the full CONTENT_STATUSES
// vocabulary above — this narrower guard is for the two bare routes only.
export const BARE_CONTENT_STATUS_WRITES = ["pending", "approved"] as const;
export type BareContentStatusWrite = (typeof BARE_CONTENT_STATUS_WRITES)[number];

export function isValidBareContentStatusWrite(value: unknown): value is BareContentStatusWrite {
  return typeof value === "string" && (BARE_CONTENT_STATUS_WRITES as readonly string[]).includes(value);
}

// DEC-713: the one status a speaker may still delete their own latest
// version under — imported by the delete route rather than re-listing the
// "pending" literal.
export const PENDING_CONTENT_STATUS: ContentStatus = "pending";

/** Organizer-only content approval; DEC-009 invariant — this module MUST
 * NEVER import a mailer. Status changes never send email. */
export async function updateContentStatus(db: Db, submissionId: string, contentStatus: ContentStatus): Promise<void> {
  await db
    .update(schema.submission)
    .set({ contentStatus, updatedAt: new Date() })
    .where(eq(schema.submission.id, submissionId));
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
 * applies here too — this module MUST NEVER import a mailer. */
export async function reopenContentReview(db: Db, submissionId: string): Promise<void> {
  await db
    .update(schema.submission)
    .set({ contentStatus: PENDING_CONTENT_STATUS, updatedAt: new Date() })
    .where(
      and(
        eq(schema.submission.id, submissionId),
        inArray(schema.submission.contentStatus, ["approved", "changes_requested"]),
      ),
    );
}
