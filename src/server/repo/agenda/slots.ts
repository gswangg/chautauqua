// Slot writes (DEC-021: accepted-only; DEC-519 wave-6 amendment: bump
// ics_sequence only on an actual VEVENT-affecting change, never on a no-op
// write, matching the differential events.ts already applies to timezone
// and room-name changes).

import { eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { bumpIcsSequences } from "../ics-sequence";
import { MINUTES_PER_DAY } from "../../../domain/schedule";
import { isIsoDay } from "./days"; // the ONE day-shape gate, shared with the breaks route

export interface SlotInput {
  day: string;
  startMin: number;
  endMin: number;
  /** Tri-state (DEC-021 wave-66 amendment): key ABSENT means "leave the
   * stored roomId untouched" (a time-only reschedule preserves the room);
   * key present with `null` means an explicit unassign to TBD (a real value
   * per A25); key present with a string replaces the room. upsertSlot must
   * decide by `"roomId" in input`, not by the resolved value, so callers
   * that omit the key never silently clear a room assignment. */
  roomId?: string | null;
}

export function isValidSlotInput(body: unknown): body is SlotInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  const dayOk = isIsoDay(b.day);
  const startOk =
    typeof b.startMin === "number" &&
    Number.isInteger(b.startMin) &&
    b.startMin >= 0 &&
    b.startMin <= MINUTES_PER_DAY - 1;
  const endOk =
    typeof b.endMin === "number" &&
    Number.isInteger(b.endMin) &&
    b.endMin > (b.startMin as number) &&
    b.endMin <= MINUTES_PER_DAY;
  const roomOk = b.roomId === undefined || b.roomId === null || typeof b.roomId === "string";
  return dayOk && startOk && endOk && roomOk;
}

/** Upserts the schedule_slot for an accepted submission and bumps
 * ics_sequence only when a column the VEVENT serializes (day/startMin/
 * endMin/roomId — see room-name and timezone bumps in api/events.ts for the
 * siblings of this differential) actually changed (DEC-519 wave-6
 * amendment). Throws (via caller's ApiError) is the route's job — this
 * function assumes the accepted-only check already ran. */
export async function upsertSlot(db: Db, submissionId: string, input: SlotInput): Promise<void> {
  const now = new Date();
  // DEC-552: one atomic statement -- no read-then-write over the
  // schedule_slot_submission_id_idx uniqueIndex. The `setWhere` clause
  // makes the DO UPDATE a no-op (and RETURNING empty) when every supplied
  // column already matches the stored row, per SQLite's UPSERT semantics
  // ("if the WHERE clause is false ... no change is made to that row ...
  // RETURNING doesn't return that row"). `IS NOT` (not `<>`) so a NULL
  // roomId compares correctly against `excluded.room_id`.
  // Tri-state roomId (DEC-021 wave-66 amendment): decide by key presence,
  // not resolved value, so an absent key on the UPDATE branch leaves the
  // stored room untouched (house idiom: portal-edit.ts, pipeline.ts's
  // `if ("fitScore" in fit)`). The INSERT branch has nothing to preserve,
  // so it keeps the `?? null` default. roomId is only compared in
  // `setWhere` when the key is present -- an absent key must never look
  // like a "no-op" bump refusal for the columns that WERE supplied.
  const roomIdKeyPresent = "roomId" in input;
  const changeConditions = [
    sql`${schema.scheduleSlot.day} IS NOT excluded.day`,
    sql`${schema.scheduleSlot.startMin} IS NOT excluded.start_min`,
    sql`${schema.scheduleSlot.endMin} IS NOT excluded.end_min`,
    ...(roomIdKeyPresent ? [sql`${schema.scheduleSlot.roomId} IS NOT excluded.room_id`] : []),
  ];
  const rows = await db
    .insert(schema.scheduleSlot)
    .values({
      id: newId(),
      submissionId,
      roomId: input.roomId ?? null,
      day: input.day,
      startMin: input.startMin,
      endMin: input.endMin,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.scheduleSlot.submissionId,
      set: {
        ...(roomIdKeyPresent ? { roomId: input.roomId ?? null } : {}),
        day: input.day,
        startMin: input.startMin,
        endMin: input.endMin,
        updatedAt: now,
      },
      setWhere: sql.join(changeConditions, sql` OR `),
    })
    .returning({ id: schema.scheduleSlot.id });

  // An INSERT always returns a row; an UPDATE returns one only when
  // `setWhere` was true, i.e. something actually changed. Either way,
  // an empty `rows` means the stored row was already byte-identical.
  if (rows.length > 0) {
    await bumpIcsSequences(db, [submissionId]);
  }
}

/** Deletes the schedule_slot for a submission and bumps ics_sequence only
 * when a row actually existed to delete (DEC-519 wave-6 amendment) -- a
 * submission with no slot has nothing to un-notify calendar subscribers
 * about. */
export async function unscheduleSlot(db: Db, submissionId: string): Promise<void> {
  const deleted = await db
    .delete(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.submissionId, submissionId))
    .returning({ id: schema.scheduleSlot.id });
  if (deleted.length > 0) {
    await bumpIcsSequences(db, [submissionId]);
  }
}
