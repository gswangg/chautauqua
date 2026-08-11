// EMB-15 (DEC-289): machine-readable public surface feeds. Pure builders —
// no Hono import, no query source of its own. Callers (index.tsx) fetch
// data through the same src/server/repo/public.ts calls the HTML dispatch
// uses (single-sourced visibility gate) and pass the resulting items
// through unchanged into the envelope this module shapes.

import type { PublicEvent, PublicAgendaItem } from "../../server/repo/public";
import type { Surface } from "./shell";
import type { IcsEventInput } from "../../mail/ics";
import { zonedMinutesToUtc } from "../../lib/timezone";

/** DEC-289 envelope: { event, surface, generatedAt, items }. `items` is
 * whatever the surface's existing repo shape already is (PublicSession[],
 * PublicSpeakerWithSessions[], PublicAgendaItem[]) — passed through
 * unchanged, never re-shaped here. */
export interface PublicSurfaceFeed<T> {
  event: {
    slug: string;
    name: string;
    timezone: string;
    startDate: string;
    endDate: string;
  };
  surface: Surface;
  generatedAt: string;
  items: T;
}

export function buildSurfaceFeed<T>(
  event: PublicEvent,
  surface: Surface,
  items: T,
  now: Date,
): PublicSurfaceFeed<T> {
  return {
    event: {
      slug: event.slug,
      name: event.name,
      timezone: event.timezone,
      startDate: event.startDate,
      endDate: event.endDate,
    },
    surface,
    generatedAt: now.toISOString(),
    items,
  };
}

/** Maps a full public agenda to the IcsEventInput[] shape buildIcsCalendar
 * expects (mirrors src/routes/public/index.tsx's schedule.ics handler) —
 * same uidSubmissionId/sequence per session so a calendar app that already
 * has a schedule.ics-imported event updates it rather than duplicating it. */
export function agendaIcsEvents(event: PublicEvent, agendaItems: PublicAgendaItem[], now: Date): IcsEventInput[] {
  return agendaItems.map((item) => ({
    uidSubmissionId: item.submissionId,
    sequence: item.icsSequence,
    title: item.title,
    description: item.description ?? undefined,
    startUtc: zonedMinutesToUtc(item.day, item.startMin, event.timezone),
    endUtc: zonedMinutesToUtc(item.day, item.endMin, event.timezone),
    location: item.roomName ?? undefined,
    dtstamp: now,
  }));
}
