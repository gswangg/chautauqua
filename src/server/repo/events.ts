// Data access for events, tracks, rooms (w2-b). Every lookup-by-id is
// scoped to the caller's org/event so cross-tenant IDs 404 (no IDOR).

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId, formatRef } from "../../domain/ids";
import { ApiError } from "../http";
import { isUniqueViolation } from "./constraints";
import { findFormForEvent } from "./forms";
import { listPlansForEvent } from "./review";
import { formatScheduleSlotLabel } from "../../lib/event-time";
import { touchSubmissionsForTracks } from "./submissions/touch";
import { DEC_229, DEC_461, DEC_851, DEC_931 } from "../../decisions";
import { EMBED_SURFACES, knobsForSurface } from "../../lib/embed-knobs";

void DEC_931; // delete-refusal fields name their blocking rows -- see deleteTrack/deleteRoom below
void DEC_851; // deleteTrack's saved-embed blocker only fires for surfaces that actually honor trackId -- see below

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

/**
 * DEC-013 (wave-26 amendment): the "anchor event" for an org — used
 * wherever a caller is not event-scoped but a row still requires a
 * non-null event_id (e.g. email_log.event_id is NOT NULL, and org user
 * accounts themselves are not event-scoped, so password-reset mail and
 * account-creation mail must pick *some* event to attribute the row to).
 *
 * Ordering contract: the anchor is the same row that would sort first
 * from listEventsForOrg's default ordering — most recent startDate desc,
 * ties broken by id asc — but selected with LIMIT 1 so this never
 * materialises more than one row. Do not change listEventsForOrg's
 * ordering without updating this comment and the contract test.
 */
export async function getAnchorEventForOrg(db: Db, orgId: string): Promise<EventRecord | undefined> {
  const rows = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.orgId, orgId))
    .orderBy(desc(schema.event.startDate), asc(schema.event.id))
    .limit(1);
  return rows[0] ? toEventRecord(rows[0]) : undefined;
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
  // DEC-558 (wave 75): event_slug_idx is a uniqueIndex on schema.event.slug,
  // so this predicate already narrows to at most one row.
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

/** DEC-552 amendment (findings wave 14): isSlugTaken (routes/api/events.ts)
 * is a fast-path pre-check only, not the gate — a concurrent create can land
 * its INSERT between that check and this write. The INSERT itself is the
 * authority: it targets event_slug_idx (migrations/0000_secret_matthew_
 * murdock.sql) with onConflictDoNothing, and a post-insert re-select-by-id
 * that comes up empty means this call's row lost the race, at which point it
 * throws the exact same refusal the route's pre-check already raises. */
export async function createEvent(db: Db, input: CreateEventInput): Promise<EventRecord> {
  const now = new Date();
  const id = newId();
  await db
    .insert(schema.event)
    .values({
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
    })
    .onConflictDoNothing({ target: schema.event.slug });
  const rows = await db.select().from(schema.event).where(eq(schema.event.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError("invalid", "Slug is already in use", { slug: "Already in use" });
  }
  return toEventRecord(row);
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

/** DEC-111 amendment (findings wave 15): routes/api/events.ts's isSlugTaken
 * check ahead of this call is a fast-path pre-check only, not the gate — a
 * raced or double-submitted rename can land its own UPDATE between that
 * check and this write. The UPDATE itself is the authority: it targets
 * event_slug_idx (migrations/0000_secret_matthew_murdock.sql), and a raw
 * D1 "UNIQUE constraint failed: event.slug" is caught and translated into
 * the exact same refusal the route's pre-check already raises — anything
 * else rethrows unchanged. */
export async function updateEvent(
  db: Db,
  eventId: string,
  orgId: string,
  input: UpdateEventInput,
): Promise<EventRecord> {
  const existing = await getEventForOrg(db, eventId, orgId);
  if (!existing) throw new ApiError("not_found", "Event not found");

  try {
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
  } catch (err) {
    if (isUniqueViolation(err, "event.slug")) {
      throw new ApiError("invalid", "Slug is already in use", { slug: "Already in use" });
    }
    throw err;
  }

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
  // DEC-916: rides the same list read as every other field -- computed by
  // ONE grouped aggregate over schema.submissionTrack joined to
  // schema.submission scoped to this event (matching the submissions list's
  // own trackId EXISTS predicate, src/server/repo/submissions/list.ts), never
  // a per-track follow-up request.
  submissionCount: number;
}

function toTrackRecord(row: typeof schema.track.$inferSelect, submissionCount: number): TrackRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    color: row.color,
    position: row.position,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    submissionCount,
  };
}

export async function listTracksForEvent(db: Db, eventId: string, page?: RepoPage): Promise<TrackRecord[]> {
  const base = db
    .select()
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId))
    .orderBy(asc(schema.track.position), asc(schema.track.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;

  // DEC-916: ONE grouped query for every track on this page -- never one
  // request per track. Scoped through schema.submission.eventId (same scope
  // the submissions list's trackId EXISTS predicate uses) so this count and
  // the submissions list's per-track count can never drift.
  const countRows = await db
    .select({
      trackId: schema.submissionTrack.trackId,
      count: sql<number>`count(*)`,
    })
    .from(schema.submissionTrack)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.submissionTrack.submissionId))
    .where(eq(schema.submission.eventId, eventId))
    .groupBy(schema.submissionTrack.trackId);
  const counts = new Map(countRows.map((r) => [r.trackId, Number(r.count)]));

  return rows.map((row) => toTrackRecord(row, counts.get(row.id) ?? 0));
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
  if (!row) return null;
  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submissionTrack)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.submissionTrack.submissionId))
    .where(and(eq(schema.submissionTrack.trackId, trackId), eq(schema.submission.eventId, eventId)));
  return toTrackRecord(row, Number(countRows[0]?.count ?? 0));
}

export async function updateTrack(
  db: Db,
  trackId: string,
  eventId: string,
  input: { name?: string; color?: string | null },
): Promise<TrackRecord> {
  const existing = await getTrackForEvent(db, trackId, eventId);
  if (!existing) throw new ApiError("not_found", "Track not found");

  const now = new Date();
  await db
    .update(schema.track)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      updatedAt: now,
    })
    .where(eq(schema.track.id, trackId));

  // DEC-725 (wave-32 amendment): the track name is serialized into every
  // submission's pushed Tracks cell — bump dependent submissions only when
  // the name actually changed (a color-only edit is a no-op), mirroring
  // DEC-519's same-string no-op rule.
  if (input.name !== undefined && input.name !== existing.name) {
    await touchSubmissionsForTracks(db, [trackId], now);
  }

  const updated = await getTrackForEvent(db, trackId, eventId);
  if (!updated) throw new Error("updateTrack: row disappeared after update");
  return updated;
}

/** DEC-931: appends "... and N more" once `total` exceeds the already-
 * bounded (<=5) `names` list the caller read via a `limit(5)` SELECT. */
function namesWithMore(names: string[], total: number): string[] {
  if (total <= names.length) return names;
  return [...names, `... and ${total - names.length} more`];
}

/** Event row fields every DEC-931 delete-refusal message needs to name its
 * blockers by human handle: `recordPrefix` for formatRef, `timezone` for
 * schedule-slot labels. Never falls back to the server's own zone. */
async function getEventRefFields(db: Db, eventId: string): Promise<{ recordPrefix: string; timezone: string }> {
  const rows = await db
    .select({ recordPrefix: schema.event.recordPrefix, timezone: schema.event.timezone })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`getEventRefFields: event ${eventId} not found`);
  return row;
}

/** 409 conflict (never cascades, DEC-229) when the track is referenced by a
 * submission, the event's form, an evaluation plan's track filter, or a
 * reviewer's track scope. DEC-931: each refusal's `fields` map names up to
 * five blocking rows plus "... and N more" -- every blocker read is bounded
 * (limit 5 + a separate COUNT), never an unbounded fetch, and the
 * reviewer-scope check is ONE query joining plan_reviewer to
 * evaluation_plan on eventId, never a query per plan. */
export async function deleteTrack(db: Db, trackId: string, eventId: string): Promise<void> {
  const existing = await getTrackForEvent(db, trackId, eventId);
  if (!existing) throw new ApiError("not_found", "Track not found");

  const { recordPrefix } = await getEventRefFields(db, eventId);

  const subRows = await db
    .select({ seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submissionTrack)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.submissionTrack.submissionId))
    .where(eq(schema.submissionTrack.trackId, trackId))
    .limit(5);
  if (subRows.length > 0) {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.submissionTrack)
      .where(eq(schema.submissionTrack.trackId, trackId));
    const total = Number(countRows[0]?.count ?? 0);
    const names = subRows.map((r) => `${formatRef(recordPrefix, r.seq)} - ${r.title}`);
    throw new ApiError("conflict", "Track is referenced by one or more submissions", {
      submissions: namesWithMore(names, total).join("; "),
    });
  }

  // DEC-229: never cascade -- also reject when a form's tracks_json, a
  // plan's filters_json track filter, or a plan_reviewer track scope still
  // names this track. Reuse the canonical parsed shapes from forms.ts /
  // review.ts rather than re-parsing the raw JSON columns here.
  const form = await findFormForEvent(db, eventId);
  if (form && form.tracks && form.tracks.includes(trackId)) {
    throw new ApiError("conflict", "Track is referenced by a form's track selection", {
      form: form.title,
    });
  }

  const plans = await listPlansForEvent(db, eventId);
  const filterPlans = plans.filter((p) => p.filters?.trackIds?.includes(trackId));
  if (filterPlans.length > 0) {
    const names = filterPlans.slice(0, 5).map((p) => p.name);
    throw new ApiError("conflict", "Track is referenced by an evaluation plan's track filter", {
      plans: namesWithMore(names, filterPlans.length).join("; "),
    });
  }

  // DEC-931: ONE query joining plan_reviewer to evaluation_plan on eventId
  // and filtering trackId -- never a query per plan (the previous shape
  // iterated `plans` and called listReviewerRowsForPlan once per row).
  const reviewerRows = await db
    .select({ email: schema.user.email, planName: schema.evaluationPlan.name })
    .from(schema.planReviewer)
    .innerJoin(schema.evaluationPlan, eq(schema.evaluationPlan.id, schema.planReviewer.planId))
    .innerJoin(schema.user, eq(schema.user.id, schema.planReviewer.userId))
    .where(and(eq(schema.evaluationPlan.eventId, eventId), eq(schema.planReviewer.trackId, trackId)))
    .limit(5);
  if (reviewerRows.length > 0) {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.planReviewer)
      .innerJoin(schema.evaluationPlan, eq(schema.evaluationPlan.id, schema.planReviewer.planId))
      .where(and(eq(schema.evaluationPlan.eventId, eventId), eq(schema.planReviewer.trackId, trackId)));
    const total = Number(countRows[0]?.count ?? 0);
    const names = reviewerRows.map((r) => `${r.email} in '${r.planName}'`);
    throw new ApiError("conflict", "Track is referenced by a reviewer's track scope", {
      reviewers: namesWithMore(names, total).join("; "),
    });
  }

  // DEC-931 amendment (w63-a): a saved embed whose stored recipe
  // (options_json.trackId) names this track blocks deletion too -- an
  // organizer-facing saved_view (filters_json) is deliberately NOT a
  // blocker here: it's a private admin filter with no public consequence.
  // An embed blocks regardless of its `enabled` column -- a disabled embed
  // can be re-enabled later, so it still names a live dependency.
  //
  // DEC-851 (wave-55 amendment): only a surface whose EMBED_KNOB_TABLE row
  // actually declares `trackId` can be blocking on it -- derived from
  // knobsForSurface, never a hand-listed surface set, so this stays in
  // sync with the ONE source of truth as the table changes.
  const trackFilterSurfaces = EMBED_SURFACES.filter((surface) => knobsForSurface(surface).includes("trackId"));
  const embedRows =
    trackFilterSurfaces.length === 0
      ? []
      : await db
          .select({ name: schema.embed.name })
          .from(schema.embed)
          .where(
            and(
              eq(schema.embed.eventId, eventId),
              inArray(schema.embed.surface, trackFilterSurfaces),
              sql`json_extract(${schema.embed.optionsJson}, '$.trackId') = ${trackId}`,
            ),
          )
          .limit(5);
  if (embedRows.length > 0) {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.embed)
      .where(
        and(
          eq(schema.embed.eventId, eventId),
          inArray(schema.embed.surface, trackFilterSurfaces),
          sql`json_extract(${schema.embed.optionsJson}, '$.trackId') = ${trackId}`,
        ),
      );
    const total = Number(countRows[0]?.count ?? 0);
    const names = embedRows.map((r) => r.name);
    throw new ApiError("conflict", "Track is referenced by a saved embed", {
      embeds: namesWithMore(names, total).join("; "),
    });
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
  // DEC-896 amendment (wave 26): rides the same list read as tracks'
  // submissionCount -- one grouped aggregate over schema.scheduleSlot scoped
  // to this event, matching deleteRoom's own blocking predicate
  // (schema.scheduleSlot.roomId), so the settings row's proactive disable
  // and the delete route's reactive refusal can never drift apart.
  sessionCount: number;
}

function toRoomRecord(row: typeof schema.room.$inferSelect, sessionCount: number): RoomRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    capacity: row.capacity,
    position: row.position,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    sessionCount,
  };
}

export async function listRoomsForEvent(db: Db, eventId: string, page?: RepoPage): Promise<RoomRecord[]> {
  const base = db
    .select()
    .from(schema.room)
    .where(eq(schema.room.eventId, eventId))
    .orderBy(asc(schema.room.position), asc(schema.room.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;

  const countRows = await db
    .select({
      roomId: schema.scheduleSlot.roomId,
      count: sql<number>`count(*)`,
    })
    .from(schema.scheduleSlot)
    .innerJoin(schema.room, eq(schema.room.id, schema.scheduleSlot.roomId))
    .where(eq(schema.room.eventId, eventId))
    .groupBy(schema.scheduleSlot.roomId);
  const counts = new Map(countRows.map((r) => [r.roomId, Number(r.count)]));

  return rows.map((row) => toRoomRecord(row, counts.get(row.id) ?? 0));
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
  if (!row) return null;
  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.roomId, roomId));
  return toRoomRecord(row, Number(countRows[0]?.count ?? 0));
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
 * this room, so there is no ics_sequence bump to make here. DEC-931: the
 * refusal's `fields.slots` names up to five blocking sessions as "REF -
 * Title (Wed 12, 10:00, Room name)", the day/time formatted through
 * src/lib/event-time.ts against the OWNING event's timezone (never the
 * server's) — bounded via a limit-5 SELECT plus a separate COUNT. */
export async function deleteRoom(db: Db, roomId: string, eventId: string): Promise<void> {
  const existing = await getRoomForEvent(db, roomId, eventId);
  if (!existing) throw new ApiError("not_found", "Room not found");

  const { recordPrefix, timezone } = await getEventRefFields(db, eventId);

  const slotRows = await db
    .select({
      seq: schema.submission.seq,
      title: schema.submission.title,
      day: schema.scheduleSlot.day,
      startMin: schema.scheduleSlot.startMin,
    })
    .from(schema.scheduleSlot)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.scheduleSlot.submissionId))
    .where(eq(schema.scheduleSlot.roomId, roomId))
    .limit(5);
  if (slotRows.length > 0) {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.scheduleSlot)
      .where(eq(schema.scheduleSlot.roomId, roomId));
    const total = Number(countRows[0]?.count ?? 0);
    const names = slotRows.map(
      (r) =>
        `${formatRef(recordPrefix, r.seq)} - ${r.title} (${formatScheduleSlotLabel(r.day, r.startMin, timezone)}, ${existing.name})`,
    );
    throw new ApiError("conflict", "Room is referenced by one or more schedule slots", {
      slots: namesWithMore(names, total).join("; "),
    });
  }

  // DEC-931 amendment (w63-a): a saved embed whose stored recipe
  // (options_json.roomId) names this room blocks deletion too -- see the
  // matching comment in deleteTrack above (saved_view is not a blocker;
  // a disabled embed still blocks since it can be re-enabled).
  const embedRows = await db
    .select({ name: schema.embed.name })
    .from(schema.embed)
    .where(
      and(
        eq(schema.embed.eventId, eventId),
        sql`json_extract(${schema.embed.optionsJson}, '$.roomId') = ${roomId}`,
      ),
    )
    .limit(5);
  if (embedRows.length > 0) {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.embed)
      .where(
        and(
          eq(schema.embed.eventId, eventId),
          sql`json_extract(${schema.embed.optionsJson}, '$.roomId') = ${roomId}`,
        ),
      );
    const total = Number(countRows[0]?.count ?? 0);
    const names = embedRows.map((r) => r.name);
    throw new ApiError("conflict", "Room is referenced by a saved embed", {
      embeds: namesWithMore(names, total).join("; "),
    });
  }

  await db.delete(schema.room).where(eq(schema.room.id, roomId));
}
