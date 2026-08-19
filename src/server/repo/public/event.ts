// Public/embed repo layer (J10, DEC-022, DEC-274): event / tracks lookups
// shared across every public surface.

import { and, asc, desc, eq, lt } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { getFieldOptionsByRole } from "../form-roles";
import { getPublicSurfaceCounts } from "./counts";

export interface PublicEvent {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  timezone: string;
  recordPrefix: string;
  brandingJson: string | null;
}

export async function getPublicEventBySlug(db: Db, slug: string): Promise<PublicEvent | null> {
  // DEC-558 (wave 75): event_slug_idx is a uniqueIndex on schema.event.slug,
  // so this predicate already narrows to at most one row.
  const rows = await db.select().from(schema.event).where(eq(schema.event.slug, slug)).limit(1);
  const row = rows[0];
  if (!row) return null;
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
    brandingJson: row.brandingJson,
  };
}

// DEC-785: the saved-embed public route (src/routes/public/saved-embed.tsx)
// resolves an embed row's eventId to its PublicEvent by id rather than by
// slug — the same visibility-gate-free lookup as getPublicEventBySlug,
// keyed differently.
export async function getPublicEventById(db: Db, id: string): Promise<PublicEvent | null> {
  const rows = await db.select().from(schema.event).where(eq(schema.event.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
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
    brandingJson: row.brandingJson,
  };
}

// DEC-745 (wave-107 amendment): docs/design/Chautauqua Public and
// Portal.dc.html:1167 `Public sessions · nothing published`'s fresh-empty
// sessions frame draws a "Last year"
// aside naming the org's most recent PRIOR event and its session count.
// "Prior" is same-org, endDate strictly before this event's startDate,
// most recent first -- event_org_id_idx already exists (DEC-558), so
// .orderBy(desc(endDate)).limit(1) is a single indexed scan, not a table
// scan. The session count is NEVER a second visibility vocabulary
// (DEC-613): it is the exact getPublicSurfaceCounts(db, prior.id).sessions
// read the settings public-pages panel and every other public surface
// share. Returns null both when there is no prior event AND when the prior
// event's publicly-visible session count is 0 -- an aside pointing at an
// unpublished programme is B7 rule 6's "empty table with headers" wearing
// a sidebar, not a useful escape hatch.
export async function getPriorPublicEvent(
  db: Db,
  event: PublicEvent,
): Promise<{ event: PublicEvent; sessionCount: number } | null> {
  const rows = await db
    .select()
    .from(schema.event)
    .where(and(eq(schema.event.orgId, event.orgId), lt(schema.event.endDate, event.startDate)))
    .orderBy(desc(schema.event.endDate))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const prior: PublicEvent = {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    slug: row.slug,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.location,
    timezone: row.timezone,
    recordPrefix: row.recordPrefix,
    brandingJson: row.brandingJson,
  };
  const sessionCount = (await getPublicSurfaceCounts(db, prior.id)).sessions;
  if (sessionCount === 0) return null;
  return { event: prior, sessionCount };
}

export interface PublicTrack {
  id: string;
  name: string;
  color: string | null;
}

/** DEC-683: the sessions rail's "Call for papers" card needs the event's
 * default form's open/close window, nothing else off the form row. Whether
 * that window is currently open is decided ONLY by src/lib/submit-core.ts's
 * formWindowState (the same resolver the home hub uses, src/server/repo/
 * public/home.ts) — never a second date comparison here. A null return
 * means the event has no default form at all (never happens post-seed, but
 * an org can delete every form), which callers treat as "no CFP card". */
export async function getPublicCfpWindow(
  db: Db,
  eventId: string,
): Promise<{ openDate: number | null; closeDate: number | null } | null> {
  // DEC-558/DEC-398 (wave 75, amended wave 5): isDefault=true is set on
  // exactly one form per event by createDefaultForm's application-level
  // invariant (src/server/repo/forms.ts), but (eventId, isDefault) has no
  // declared uniqueIndex backing that claim -- see findFormForEvent in that
  // file for the same gap. .orderBy(...) makes the pick deterministic
  // regardless of whether the invariant ever slips.
  const rows = await db
    .select({ openDate: schema.form.openDate, closeDate: schema.form.closeDate })
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true)))
    .orderBy(asc(schema.form.id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    openDate: row.openDate ? row.openDate.getTime() : null,
    closeDate: row.closeDate ? row.closeDate.getTime() : null,
  };
}

export async function getPublicTracks(db: Db, eventId: string): Promise<PublicTrack[]> {
  const rows = await db
    .select({ id: schema.track.id, name: schema.track.name, color: schema.track.color })
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId))
    .orderBy(asc(schema.track.position));
  return rows;
}

export interface PublicRoom {
  id: string;
  name: string;
}

/** DEC-774: the event's rooms, for the sessions surface's room-filter chips
 * — same shape/ordering convention as getPublicTracks. */
export async function getPublicRooms(db: Db, eventId: string): Promise<PublicRoom[]> {
  const rows = await db
    .select({ id: schema.room.id, name: schema.room.name })
    .from(schema.room)
    .where(eq(schema.room.eventId, eventId))
    .orderBy(asc(schema.room.position));
  return rows;
}

/** DEC-774: the event's default-form session_format-role dropdown options,
 * for the sessions surface's format-filter chips. Mirrors
 * getFormatFieldOptions (src/server/repo/forms.ts) — both delegate to
 * getFieldOptionsByRole (src/server/repo/form-roles.ts) — returns [] when
 * the event has no default form or the form has no format field. */
export async function getPublicFormatOptions(db: Db, eventId: string): Promise<string[]> {
  return (await getFieldOptionsByRole(db, eventId, "session_format")) ?? [];
}
