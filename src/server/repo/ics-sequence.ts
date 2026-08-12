// Canonical, set-based ics_sequence bump (DEC-492). submission.ics_sequence
// is the load-bearing field for room-assigned-later invite updates
// (docs/clarifications.md:12-14) — every caller MUST bump it atomically via
// this module, never via a read-then-write race.

import { inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";

/** Bumps submission.ics_sequence by exactly 1 for each given submission id,
 * via one atomic set-based UPDATE per chunkIds() batch (DEC-078/DEC-492).
 * Dedupes ids first so a submission is never double-bumped in one call.
 * Empty input is a no-op. */
export async function bumpIcsSequences(db: Db, submissionIds: string[]): Promise<void> {
  const unique = [...new Set(submissionIds)];
  if (unique.length === 0) return;
  const now = new Date();
  for (const chunk of chunkIds(unique)) {
    await db
      .update(schema.submission)
      .set({ icsSequence: sql`${schema.submission.icsSequence} + 1`, updatedAt: now })
      .where(inArray(schema.submission.id, chunk));
  }
}
