// Data access for events, tracks, rooms (w2-b). Every lookup-by-id is
// scoped to the caller's org/event so cross-tenant IDs 404 (no IDOR).

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { ApiError } from "../http";
import { findFormForEvent } from "./forms";
import { listPlansForEvent, listReviewerRowsForPlan } from "./review";
import { DEC_229, DEC_461 } from "../../decisions";

void DEC_229; // deleteTrack's referential guard extends to forms/plans/plan_reviewer -- see below

/** DEC-461: optional trailing repo page param — absent means today's
 * unbounded behavior (internal non-HTTP callers, e.g. the agenda, still
 * need every row). Present means SQL LIMIT/OFFSET with a deterministic
 * ORDER BY tiebreak. */
export interface RepoPage {
  limit: number;
  offset: number;
}
void DEC_461;

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

export async function listEventsForOrg(db: Db, orgId: string, page?: RepoPage): Promise<EventRecord[]> {
  const base = db
    .select()
    .from(schema.event)
    .where(eq(schema.event.orgId, orgId))
    .orderBy(desc(schema.event.startDate), asc(schema.event.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toEventRecord);
}

export async function countEventsForOrg(db: Db, orgId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.event)
    .where(eq(schema.event.orgId, orgId));
  return Number(rows[0]?.count ?? 0);
}

/** DEC-141: reviewers list events via their plan_reviewer assignments, not
 * org membership directly — join plan_reviewer -> evaluation_plan -> event,
 * scope by orgId (defense in depth against cross-tenant leakage) and dedup
 * by event id (a reviewer may have multiple assignment rows on one plan, or
 * be assigned to more than one plan on the same event). */
export async function listEventsForReviewer(
  db: Db,
  userId: string,
  orgId: string,
  page?: RepoPage,
): Promise<EventRecord[]> {
  const base = db
    .selectDistinct({ event: schema.event })
    .from(schema.planReviewer)
    .innerJoin(schema.evaluationPlan, eq(schema.evaluationPlan.id, schema.planReviewer.planId))
    .innerJoin(schema.event, eq(schema.event.id, schema.evaluationPlan.eventId))
    .where(and(eq(schema.planReviewer.userId, userId), eq(schema.event.orgId, orgId)))
    .orderBy(desc(schema.event.startDate), asc(schema.event.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  const seen = new Map<string, EventRecord>();
  for (const row of rows) {
    const record = toEventRecord(row.event);
    seen.set(record.id, record);
  }
  return [...seen.values()];
}

/** COUNT(DISTINCT event.id) over the same plan_reviewer -> evaluation_plan
 * -> event join listEventsForReviewer uses, so `total` matches the same
 * dedup semantics as the item query. */
export async function countEventsForReviewer(db: Db, userId: string, orgId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(distinct ${schema.event.id})` })
    .from(schema.planReviewer)
    .innerJoin(schema.evaluationPlan, eq(schema.evaluationPlan.id, schema.planReviewer.planId))
    .innerJoin(schema.event, eq(schema.event.id, schema.evaluationPlan.eventId))
    .where(and(eq(schema.planReviewer.userId, userId), eq(schema.event.orgId, orgId)));
  return Number(rows[0]?.count ?? 0);
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

export async function listTracksForEvent(db: Db, eventId: string, page?: RepoPage): Promise<TrackRecord[]> {
  const base = db
    .select()
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId))
    .orderBy(asc(schema.track.position), asc(schema.track.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toTrackRecord);
}

export async function countTracksForEvent(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId));
  return Number(rows[0]?.count ?? 0);
}

export async function createTrack(
  db: Db,
  eventId: string,
  input: { name: string; color?: string | null },
): Promise<TrackRecord> {
  const now = new Date();
  const id = newId();
  const nextPositionSql = sql<number>`(SELECT COALESCE(MAX(${schema.track.position}), -1) + 1 FROM ${schema.track} WHERE ${schema.track.eventId} = ${eventId})`;
  await db.insert(schema.track).values({
    id,
    eventId,
    name: input.name,
    color: input.color ?? null,
    position: nextPositionSql,
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

  const joinRefs = await db
    .select({ submissionId: schema.submissionTrack.submissionId })
    .from(schema.submissionTrack)
    .where(eq(schema.submissionTrack.trackId, trackId))
    .limit(1);
  if (joinRefs.length > 0) {
    throw new ApiError("conflict", "Track is referenced by one or more submissions");
  }

  // DEC-229: never cascade -- also reject when a form's tracks_json, a
  // plan's filters_json track filter, or a plan_reviewer track scope still
  // names this track. Reuse the canonical parsed shapes from forms.ts /
  // review.ts rather than re-parsing the raw JSON columns here.
  const form = await findFormForEvent(db, eventId);
  if (form && form.tracks && form.tracks.includes(trackId)) {
    throw new ApiError("conflict", "Track is referenced by a form's track selection");
  }

  const plans = await listPlansForEvent(db, eventId);
  const filterPlan = plans.find((p) => p.filters?.trackIds?.includes(trackId));
  if (filterPlan) {
    throw new ApiError("conflict", "Track is referenced by an evaluation plan's track filter");
  }

  for (const plan of plans) {
    const reviewers = await listReviewerRowsForPlan(db, plan.id);
    if (reviewers.some((r) => r.trackId === trackId)) {
      throw new ApiError("conflict", "Track is referenced by a reviewer's track scope");
    }
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

export async function listRoomsForEvent(db: Db, eventId: string, page?: RepoPage): Promise<RoomRecord[]> {
  const base = db
    .select()
    .from(schema.room)
    .where(eq(schema.room.eventId, eventId))
    .orderBy(asc(schema.room.position), asc(schema.room.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toRoomRecord);
}

export async function countRoomsForEvent(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.room)
    .where(eq(schema.room.eventId, eventId));
  return Number(rows[0]?.count ?? 0);
}

export async function createRoom(
  db: Db,
  eventId: string,
  input: { name: string; capacity?: number | null },
): Promise<RoomRecord> {
  const now = new Date();
  const id = newId();
  const nextPositionSql = sql<number>`(SELECT COALESCE(MAX(${schema.room.position}), -1) + 1 FROM ${schema.room} WHERE ${schema.room.eventId} = ${eventId})`;
  await db.insert(schema.room).values({
    id,
    eventId,
    name: input.name,
    capacity: input.capacity ?? null,
    position: nextPositionSql,
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

/** 409 conflict (never cascades) when the room is referenced by a schedule
 * slot — DEC-519: deletion never mutates or clears an existing placement's
 * room_id, it is refused outright while any schedule_slot still references
 * this room, so there is no ics_sequence bump to make here. */
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
