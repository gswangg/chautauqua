// Public/embed repo layer (J10, DEC-022, DEC-274): event / tracks lookups
// shared across every public surface.

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";

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
  const rows = await db
    .select({ openDate: schema.form.openDate, closeDate: schema.form.closeDate })
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true)))
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
