// Data access for events, tracks, rooms (w2-b). Every lookup-by-id is
// scoped to the caller's org/event so cross-tenant IDs 404 (no IDOR).

import { and, eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { ApiError } from "../http";

export interface EventBranding {
  logoUrl?: string;
  accentColor?: string;
}

export interface EventRecord {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  timezone: string;
  recordPrefix: string;
  branding: EventBranding | null;
  createdAt: number;
  updatedAt: number;
}

function toBranding(json: string | null): EventBranding | null {
  return json ? (JSON.parse(json) as EventBranding) : null;
}

function toEventRecord(row: typeof schema.event.$inferSelect): EventRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    slug: row.slug,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.location,
    timezone: row.timezone,
    recordPrefix: row.recordPrefix,
    branding: toBranding(row.brandingJson),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listEventsForOrg(db: Db, orgId: string): Promise<EventRecord[]> {
  const rows = await db.select().from(schema.event).where(eq(schema.event.orgId, orgId));
  return rows.map(toEventRecord);
}

/** DEC-049: org-agnostic lookup for the root SSR landing page — it links to
 * "the seeded event", not any particular org's event, so this is the one
 * place in the codebase that queries `event` without an orgId scope. */
export async function getFirstEventSlug(db: Db): Promise<string | null> {
  const rows = await db
    .select({ slug: schema.event.slug })
    .from(schema.event)
    .orderBy(schema.event.createdAt)
    .limit(1);
  return rows[0]?.slug ?? null;
}

export async function isSlugTaken(db: Db, slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.event.id })
    .from(schema.event)
    .where(eq(schema.event.slug, slug))
    .limit(1);
  return rows.length > 0;
}

export interface CreateEventInput {
  orgId: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  location?: string | null;
  timezone: string;
  branding?: EventBranding | null;
}

export async function createEvent(db: Db, input: CreateEventInput): Promise<EventRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.event).values({
    id,
    orgId: input.orgId,
    name: input.name,
    slug: input.slug,
    startDate: input.startDate,
    endDate: input.endDate,
    location: input.location ?? null,
    timezone: input.timezone,
    brandingJson: input.branding ? JSON.stringify(input.branding) : null,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getEventForOrg(db, id, input.orgId);
  if (!created) throw new Error("createEvent: insert did not persist");
  return created;
}

/** Scoped by orgId — returns null (never another org's row) when not found. */
export async function getEventForOrg(db: Db, eventId: string, orgId: string): Promise<EventRecord | null> {
  const rows = await db
    .select()
    .from(schema.event)
    .where(and(eq(schema.event.id, eventId), eq(schema.event.orgId, orgId)))
    .limit(1);
  const row = rows[0];
  return row ? toEventRecord(row) : null;
}

export interface UpdateEventInput {
  name?: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  timezone?: string;
  branding?: EventBranding | null;
}

export async function updateEvent(
  db: Db,
  eventId: string,
  orgId: string,
  input: UpdateEventInput,
): Promise<EventRecord> {
  const existing = await getEventForOrg(db, eventId, orgId);
  if (!existing) throw new ApiError("not_found", "Event not found");

  await db
    .update(schema.event)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.branding !== undefined
        ? { brandingJson: input.branding ? JSON.stringify(input.branding) : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.event.id, eventId));

  const updated = await getEventForOrg(db, eventId, orgId);
  if (!updated) throw new Error("updateEvent: row disappeared after update");
  return updated;
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export interface TrackRecord {
  id: string;
  eventId: string;
  name: string;
  color: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
}

function toTrackRecord(row: typeof schema.track.$inferSelect): TrackRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    color: row.color,
    position: row.position,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listTracksForEvent(db: Db, eventId: string): Promise<TrackRecord[]> {
  const rows = await db.select().from(schema.track).where(eq(schema.track.eventId, eventId));
  return rows.map(toTrackRecord);
}

export async function createTrack(
  db: Db,
  eventId: string,
  input: { name: string; color?: string | null },
): Promise<TrackRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.track).values({
    id,
    eventId,
    name: input.name,
    color: input.color ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getTrackForEvent(db, id, eventId);
  if (!created) throw new Error("createTrack: insert did not persist");
  return created;
}

export async function getTrackForEvent(db: Db, trackId: string, eventId: string): Promise<TrackRecord | null> {
  const rows = await db
    .select()
    .from(schema.track)
    .where(and(eq(schema.track.id, trackId), eq(schema.track.eventId, eventId)))
    .limit(1);
  const row = rows[0];
  return row ? toTrackRecord(row) : null;
}

export async function updateTrack(
  db: Db,
  trackId: string,
  eventId: string,
  input: { name?: string; color?: string | null },
): Promise<TrackRecord> {
  const existing = await getTrackForEvent(db, trackId, eventId);
  if (!existing) throw new ApiError("not_found", "Track not found");

  await db
    .update(schema.track)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.track.id, trackId));

  const updated = await getTrackForEvent(db, trackId, eventId);
  if (!updated) throw new Error("updateTrack: row disappeared after update");
  return updated;
}

/** 409 conflict (never cascades) when the track is referenced by a submission. */
export async function deleteTrack(db: Db, trackId: string, eventId: string): Promise<void> {
  const existing = await getTrackForEvent(db, trackId, eventId);
  if (!existing) throw new ApiError("not_found", "Track not found");

  const primaryRefs = await db
    .select({ id: schema.submission.id })
    .from(schema.submission)
    .where(eq(schema.submission.trackId, trackId))
    .limit(1);
  if (primaryRefs.length > 0) {
    throw new ApiError("conflict", "Track is referenced by one or more submissions");
  }

  const joinRefs = await db
    .select({ submissionId: schema.submissionTrack.submissionId })
    .from(schema.submissionTrack)
    .where(eq(schema.submissionTrack.trackId, trackId))
    .limit(1);
  if (joinRefs.length > 0) {
    throw new ApiError("conflict", "Track is referenced by one or more submissions");
  }

  await db.delete(schema.track).where(eq(schema.track.id, trackId));
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export interface RoomRecord {
  id: string;
  eventId: string;
  name: string;
  capacity: number | null;
  position: number;
  createdAt: number;
  updatedAt: number;
}

function toRoomRecord(row: typeof schema.room.$inferSelect): RoomRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    capacity: row.capacity,
    position: row.position,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listRoomsForEvent(db: Db, eventId: string): Promise<RoomRecord[]> {
  const rows = await db.select().from(schema.room).where(eq(schema.room.eventId, eventId));
  return rows.map(toRoomRecord);
}

export async function createRoom(
  db: Db,
  eventId: string,
  input: { name: string; capacity?: number | null },
): Promise<RoomRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.room).values({
    id,
    eventId,
    name: input.name,
    capacity: input.capacity ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getRoomForEvent(db, id, eventId);
  if (!created) throw new Error("createRoom: insert did not persist");
  return created;
}

export async function getRoomForEvent(db: Db, roomId: string, eventId: string): Promise<RoomRecord | null> {
  const rows = await db
    .select()
    .from(schema.room)
    .where(and(eq(schema.room.id, roomId), eq(schema.room.eventId, eventId)))
    .limit(1);
  const row = rows[0];
  return row ? toRoomRecord(row) : null;
}

export async function updateRoom(
  db: Db,
  roomId: string,
  eventId: string,
  input: { name?: string; capacity?: number | null },
): Promise<RoomRecord> {
  const existing = await getRoomForEvent(db, roomId, eventId);
  if (!existing) throw new ApiError("not_found", "Room not found");

  await db
    .update(schema.room)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.room.id, roomId));

  const updated = await getRoomForEvent(db, roomId, eventId);
  if (!updated) throw new Error("updateRoom: row disappeared after update");
  return updated;
}

/** 409 conflict (never cascades) when the room is referenced by a schedule slot. */
export async function deleteRoom(db: Db, roomId: string, eventId: string): Promise<void> {
  const existing = await getRoomForEvent(db, roomId, eventId);
  if (!existing) throw new ApiError("not_found", "Room not found");

  const refs = await db
    .select({ id: schema.scheduleSlot.id })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.roomId, roomId))
    .limit(1);
  if (refs.length > 0) {
    throw new ApiError("conflict", "Room is referenced by one or more schedule slots");
  }

  await db.delete(schema.room).where(eq(schema.room.id, roomId));
}
