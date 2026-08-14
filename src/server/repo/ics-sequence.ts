// Canonical, set-based ics_sequence bump (DEC-492). submission.ics_sequence
// is the load-bearing field for room-assigned-later invite updates
// (docs/clarifications.md:12-14) — every caller MUST bump it atomically via
// this module, never via a read-then-write race.

import { eq, inArray, sql } from "drizzle-orm";
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

/** DEC-519: a room rename changes the LOCATION text serialized into every
 * VEVENT for a submission currently scheduled into that room. Bumps all of
 * them in one atomic set-based UPDATE ... WHERE id IN (SELECT submission_id
 * FROM schedule_slot WHERE room_id = ?) — never a read-then-loop
 * (DEC-078/DEC-492). Callers must only invoke this when the room's name
 * actually changed (a same-string rename is a no-op and must not bump). */
export async function bumpIcsSequencesForRoom(db: Db, roomId: string): Promise<void> {
  const now = new Date();
  await db
    .update(schema.submission)
    .set({ icsSequence: sql`${schema.submission.icsSequence} + 1`, updatedAt: now })
    .where(
      inArray(
        schema.submission.id,
        db
          .select({ submissionId: schema.scheduleSlot.submissionId })
          .from(schema.scheduleSlot)
          .where(eq(schema.scheduleSlot.roomId, roomId)),
      ),
    );
}

/** DEC-519 (wave-11 amendment): an event timezone change reaches every
 * scheduled submission's VEVENT, since DTSTART/DTEND are computed as
 * zonedMinutesToUtc(day, startMin, event.timezone) in BOTH readers
 * (src/routes/comms.ts:617-618 for METHOD:REQUEST invites and
 * src/routes/public/feeds.ts:196-197 for the PUBLISH feed). Bumps all
 * submissions with a schedule_slot in this event in one atomic set-based
 * UPDATE ... WHERE id IN (SELECT submission_id FROM schedule_slot JOIN
 * submission ... WHERE submission.event_id = ?) — never a read-then-loop
 * (DEC-078/DEC-492). Callers must only invoke this when the timezone
 * actually changed (a same-string PATCH is a no-op and must not bump). */
export async function bumpIcsSequencesForEvent(db: Db, eventId: string): Promise<void> {
  const now = new Date();
  await db
    .update(schema.submission)
    .set({ icsSequence: sql`${schema.submission.icsSequence} + 1`, updatedAt: now })
    .where(
      inArray(
        schema.submission.id,
        db
          .select({ submissionId: schema.scheduleSlot.submissionId })
          .from(schema.scheduleSlot)
          .innerJoin(schema.submission, eq(schema.submission.id, schema.scheduleSlot.submissionId))
          .where(eq(schema.submission.eventId, eventId)),
      ),
    );
}
