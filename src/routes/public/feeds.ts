// EMB-15 (DEC-289): machine-readable public surface feeds. Pure builders —
// no Hono import, no query source of its own. Callers (index.tsx) fetch
// data through the same src/server/repo/public.ts calls the HTML dispatch
// uses (single-sourced visibility gate) and pass the resulting items
// through unchanged into the envelope this module shapes.

import type { PublicEvent, PublicAgendaItem } from "../../server/repo/public";
import type { Surface } from "./shell";
import type { IcsEventInput } from "../../mail/ics";
import { zonedMinutesToUtc } from "../../lib/timezone";

/** DEC-289/DEC-484 envelope: { event, surface, generatedAt, page, perPage,
 * total, items }. `items` is whatever the surface's existing repo shape
 * already is (PublicSession[], PublicSpeakerWithSessions[],
 * PublicAgendaItem[]), windowed to exactly the requested page — DEC-502:
 * `items` is ONE page window (`items.length <= perPage`), never the
 * cumulative prefix the repo's LIMIT-only query returns internally.
 * page/perPage/total let a consumer detect truncation instead of silently
 * treating one page as the whole list (DEC-484); `total` is always the full
 * unwindowed count, even for a past-the-end page (which returns `items: []`).
 * Unpaged surfaces (agenda, schedule) report page=1, perPage=total=items.length. */
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
  page: number;
  perPage: number;
  total: number;
  items: T;
}

export function buildSurfaceFeed<T>(
  event: PublicEvent,
  surface: Surface,
  paged: { items: T; total: number; page: number; perPage: number },
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
    page: paged.page,
    perPage: paged.perPage,
    total: paged.total,
    items: paged.items,
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
