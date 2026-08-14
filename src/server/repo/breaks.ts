// Schedule breaks (DEC-022 amendment, wave 63): docs/design/README.md's
// Public agenda section names a break as "a spanning quiet rule with their
// label in small caps ('Lunch · Foyer') — real programmes have them, and
// they explain gaps that would otherwise read as missing data".
//
// HARD BOUNDARY: a break is not a submission. It never gets a ref, a
// speaker, a track, an ics UID, a room, or a row in any .ics/.json/.xml
// session feed (src/routes/public/feeds.ts never reads this table). It is
// a purely presentational row: id, event-scoped day/start/duration, a label
// and an optional location. Every function here is organizer-facing
// (src/routes/api/breaks.ts) or public-render-facing (src/routes/public/
// agenda.tsx via listBreaksForEvent) — never wired into agenda conflict
// detection, auto-schedule, or export machinery.

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { ApiError } from "../http";
import { DEC_022 } from "../../decisions";

void DEC_022;

export interface ScheduleBreak {
  id: string;
  eventId: string;
  day: string;
  label: string;
  location: string | null;
  startMin: number;
  durationMin: number;
  createdAt: number;
  updatedAt: number;
}

function toRecord(row: {
  id: string;
  eventId: string;
  day: string;
  label: string;
  location: string | null;
  startMin: number;
  durationMin: number;
  createdAt: Date;
  updatedAt: Date;
}): ScheduleBreak {
  return {
    id: row.id,
    eventId: row.eventId,
    day: row.day,
    label: row.label,
    location: row.location,
    startMin: row.startMin,
    durationMin: row.durationMin,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

// DEC-022 amendment: an event should never accumulate more than this many
// break rows — a break is a small, organizer-curated set (coffee/lunch per
// day), never a bulk-imported table. Bounded scan + loud refusal rather than
// a silent truncation (field guide: "a JS cap over unbounded read -> count/
// slice in SQL" — this is the SQL-side twin, matching src/server/repo/
// agenda.ts's MAX_AGENDA_SCAN `.limit(N + 1)` + throw pattern).
export const MAX_BREAKS_PER_EVENT = 200;

/** Ordered day asc, start_min asc, id asc (field guide: pagination ONE
 * shape + `id asc` deterministic tiebreak). `day` narrows to a single day
 * when provided (mirrors listSlotsForEvent-style callers); undefined
 * returns every break for the event. */
export async function listBreaksForEvent(db: Db, eventId: string, day?: string): Promise<ScheduleBreak[]> {
  const conditions = day
    ? and(eq(schema.scheduleBreak.eventId, eventId), eq(schema.scheduleBreak.day, day))
    : eq(schema.scheduleBreak.eventId, eventId);

  const rows = await db
    .select()
    .from(schema.scheduleBreak)
    .where(conditions)
    .orderBy(asc(schema.scheduleBreak.day), asc(schema.scheduleBreak.startMin), asc(schema.scheduleBreak.id))
    .limit(MAX_BREAKS_PER_EVENT + 1);

  if (rows.length > MAX_BREAKS_PER_EVENT) {
    throw new ApiError("invalid", `This event has more than ${MAX_BREAKS_PER_EVENT} breaks`);
  }

  return rows.map(toRecord);
}

export async function countBreaksForEvent(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.scheduleBreak)
    .where(eq(schema.scheduleBreak.eventId, eventId));
  return Number(rows[0]?.count ?? 0);
}

export interface CreateBreakInput {
  day: string;
  label: string;
  location: string | null;
  startMin: number;
  durationMin: number;
}

export async function createBreak(db: Db, eventId: string, input: CreateBreakInput): Promise<ScheduleBreak> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.scheduleBreak).values({
    id,
    eventId,
    day: input.day,
    label: input.label,
    location: input.location,
    startMin: input.startMin,
    durationMin: input.durationMin,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    eventId,
    day: input.day,
    label: input.label,
    location: input.location,
    startMin: input.startMin,
    durationMin: input.durationMin,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
}

/** Event-scoped ownership lookup for the DELETE-by-id route — null if the
 * break doesn't exist. Mirrors getEmbedOwnership's shape (src/server/repo/
 * embeds.ts). */
export async function getBreakForEvent(db: Db, id: string): Promise<{ eventId: string } | null> {
  const rows = await db
    .select({ eventId: schema.scheduleBreak.eventId })
    .from(schema.scheduleBreak)
    .where(eq(schema.scheduleBreak.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteBreak(db: Db, id: string): Promise<void> {
  await db.delete(schema.scheduleBreak).where(eq(schema.scheduleBreak.id, id));
}
