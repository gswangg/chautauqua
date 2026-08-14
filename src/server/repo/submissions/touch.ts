// DEC-725 amendment (wave 63): a submission's `updated_at` must cover every
// table its PUBLISHED shape is composed from, not just the submission row
// itself. src/sync/airtable.ts builds the Speakers cell from `participant`
// and the Tracks cell from `submission_track`, but writers of those two
// tables historically bumped only their own row's updatedAt (or nothing at
// all, for submission_track — it has no updatedAt column) and never touched
// the submission row. Consequence: under DEC-725's incremental watermark
// (`gt(schema.submission.updatedAt, mark)`), a change that is entirely
// contained in participant/submission_track — most dangerously, declining a
// co-presenter, which DEC-981 requires to drop that name from the pushed
// Speakers cell — never re-selects the submission on the next tick, so the
// stale (wrong) Speakers string stays live in the customer's Airtable base
// indefinitely.
//
// This is deliberately a touch-ON-WRITE shape (every writer of participant /
// submission_track calls touchSubmissions for the submission id or ids it
// just changed) and NOT a change to airtable.ts's predicate. An EXISTS-over-
// dependents predicate (e.g. "OR EXISTS (SELECT 1 FROM participant WHERE
// participant.submission_id = submission.id AND participant.updated_at >
// mark)") looks equivalent but is not: it cannot see a DELETE, because after
// a participant row is gone there is nothing left with an updated_at to
// compare against the watermark. Removing a participant would then silently
// stop re-publishing the submission that lost them. touchSubmissions must be
// called BEFORE (or as part of the same logical operation as) any delete of
// a row this stamp is supposed to represent, while the affected submission
// id is still derivable.
//
// Readers that depend on this stamp — anyone adding a new participant /
// submission_track writer owes both of these an up-to-date updated_at:
//   - src/sync/airtable.ts's DEC-725 watermark (`gt(submission.updatedAt, mark)`)
//   - src/server/repo/overview.ts's producer awaiting-approval worklist,
//     which orders by `desc(submission.updatedAt)` so a session whose
//     speaker list just changed moves back to the top.

import { inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";

/** Bumps `submission.updated_at` for every id in `submissionIds` to `now`.
 * Dedupes, no-ops on an empty list, and issues one chunked set-based UPDATE
 * per chunk (never a per-row update, never a read-then-write). Callers pass
 * the submission id or ids whose participant/submission_track composition
 * just changed. */
export async function touchSubmissions(db: Db, submissionIds: string[], now: Date): Promise<void> {
  const ids = [...new Set(submissionIds)];
  if (ids.length === 0) return;
  for (const chunk of chunkIds(ids)) {
    await db.update(schema.submission).set({ updatedAt: now }).where(inArray(schema.submission.id, chunk));
  }
}
