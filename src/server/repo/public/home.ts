// Home hub repo layer (DEC-581): fetches candidate rows for GET / and
// applies nothing but org scope + a bounded window. Grouping/visibility is
// owned entirely by src/lib/home-hub.ts's groupHubEvents() — this module
// never filters or groups, it only binds primitives and hands back
// {items, total}. publishedSessionCount reuses visibleSessionConditions()
// (src/server/repo/public/gates.ts), the SAME predicate the public sessions
// list uses, so "published" never gets redefined a second way here.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formWindowState } from "../../../lib/submit-core";
import type { HubEvent } from "../../../lib/home-hub";
import { visibleSessionConditions } from "./gates";

/** DEC-522: event.start_date/end_date are DAY LABELS ('YYYY-MM-DD'), not
 * instants — parsed here as UTC midnight of that calendar day, the same
 * epoch-ms convention every other day-label field in this codebase uses
 * (form.open_date/close_date). Never toISOString. */
function parseDayLabelMs(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) {
    throw new Error(`Invalid day label '${day}' — expected 'YYYY-MM-DD'`);
  }
  return Date.UTC(year, month - 1, date);
}

/** The deployment's single org (STAGE 1 is single-tenant), ordered by id
 * asc so a multi-row test fixture still resolves deterministically. */
export async function getHubOrg(db: Db): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: schema.org.id, name: schema.org.name })
    .from(schema.org)
    .orderBy(asc(schema.org.id))
    .limit(1);
  return rows[0] ?? null;
}

export interface HubEventsPage {
  items: HubEvent[];
  total: number;
}

/** Candidate rows for the home hub (DEC-581): every event in the org,
 * joined to its default form for the CFP open/close window, LIMIT 100
 * ordered by start_date desc/id asc, alongside a truthful COUNT(*) total —
 * a capped list is never returned without the count that says it's capped.
 * Does NOT filter by cfpOpen/publishedSessionCount — that predicate lives
 * in groupHubEvents(), not here. */
export async function listHubEvents(db: Db, orgId: string, nowMs: number): Promise<HubEventsPage> {
  const rows = await db
    .select({
      id: schema.event.id,
      name: schema.event.name,
      slug: schema.event.slug,
      startDate: schema.event.startDate,
      endDate: schema.event.endDate,
      location: schema.event.location,
      timezone: schema.event.timezone,
      openDate: schema.form.openDate,
      closeDate: schema.form.closeDate,
    })
    .from(schema.event)
    .leftJoin(schema.form, and(eq(schema.form.eventId, schema.event.id), eq(schema.form.isDefault, true)))
    .where(eq(schema.event.orgId, orgId))
    .orderBy(desc(schema.event.startDate), asc(schema.event.id))
    .limit(100);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.event)
    .where(eq(schema.event.orgId, orgId));
  const total = Number(totalRows[0]?.count ?? 0);

  const eventIds = rows.map((r) => r.id);
  const countRows =
    eventIds.length === 0
      ? []
      : await db
          .select({ eventId: schema.submission.eventId, count: sql<number>`count(distinct ${schema.submission.id})` })
          .from(schema.submission)
          .where(and(inArray(schema.submission.eventId, eventIds), visibleSessionConditions()))
          .groupBy(schema.submission.eventId);
  const publishedCountByEventId = new Map(countRows.map((r) => [r.eventId, Number(r.count)]));

  const items: HubEvent[] = rows.map((row) => {
    const openDate = row.openDate ? row.openDate.getTime() : null;
    const closeDate = row.closeDate ? row.closeDate.getTime() : null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      startDate: parseDayLabelMs(row.startDate),
      endDate: parseDayLabelMs(row.endDate),
      location: row.location,
      timezone: row.timezone,
      cfpCloseDate: closeDate,
      cfpOpen: formWindowState(openDate, closeDate, nowMs, row.timezone) === "open",
      publishedSessionCount: publishedCountByEventId.get(row.id) ?? 0,
    };
  });

  return { items, total };
}
