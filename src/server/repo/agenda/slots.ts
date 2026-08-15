// Slot writes (DEC-021: accepted-only, always bump ics_sequence).

import { eq } from "drizzle-orm";
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
 * ics_sequence (DEC-007 caller duty). Throws (via caller's ApiError) is the
 * route's job — this function assumes the accepted-only check already ran. */
export async function upsertSlot(db: Db, submissionId: string, input: SlotInput): Promise<void> {
  const now = new Date();
  // DEC-552: one atomic statement -- no read-then-write over the
  // schedule_slot_submission_id_idx uniqueIndex.
  // Tri-state roomId (DEC-021 wave-66 amendment): decide by key presence,
  // not resolved value, so an absent key on the UPDATE branch leaves the
  // stored room untouched (house idiom: portal-edit.ts, pipeline.ts's
  // `if ("fitScore" in fit)`). The INSERT branch has nothing to preserve,
  // so it keeps the `?? null` default.
  const roomIdKeyPresent = "roomId" in input;
  await db
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
    });

  await bumpIcsSequences(db, [submissionId]);
}

export async function unscheduleSlot(db: Db, submissionId: string): Promise<void> {
  await db.delete(schema.scheduleSlot).where(eq(schema.scheduleSlot.submissionId, submissionId));
  await bumpIcsSequences(db, [submissionId]);
}
