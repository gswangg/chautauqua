// Files repo — organizer content-approval status (J8, DEC-020 contract).
// Split out of files.ts (contention decomposition) — no behavior change,
// files.ts re-exports everything below for existing callers.

import { eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";

// ---------------------------------------------------------------------------
// Content status (organizer approval)
// ---------------------------------------------------------------------------

export const CONTENT_STATUSES = ["pending", "approved", "changes_requested"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isValidContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
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
