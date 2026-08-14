// Slot writes (DEC-021: accepted-only, always bump ics_sequence).

import { eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { bumpIcsSequences } from "../ics-sequence";
import { MINUTES_PER_DAY } from "../../../domain/schedule";

export interface SlotInput {
  day: string;
  startMin: number;
  endMin: number;
  roomId?: string | null;
}

export function isValidSlotInput(body: unknown): body is SlotInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  const dayOk = typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day);
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
        roomId: input.roomId ?? null,
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
