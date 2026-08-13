// Surface rendering dispatch, shared by the /e/... and /embed/... route
// handlers in index.tsx. Split out of the former monolithic src/routes/
// public.tsx (contention decomposition) — no behavior change.

import {
  getPublicTracks,
  getPublicSessions,
  getPublicSpeakers,
  getPublicAgenda,
  getPublicScheduleDayCounts,
  getPublicCfpWindow,
  type PublicEvent,
} from "../../server/repo/public";
import type { Surface } from "./shell";
import { parsePage, parseTrackId, parseNameQuery, type CardFields } from "./query";
import { PUBLIC_PER_PAGE } from "../../server/repo/public/bounds";
import { SessionsContent } from "./sessions";
import { SpeakersContent, GalleryContent } from "./speakers";
import { AgendaContent, ScheduleContent } from "./agenda";

export async function renderSurfaceContent(
  db: Parameters<typeof getPublicSessions>[0],
  event: PublicEvent,
  surface: Surface,
  query: { trackId?: string; page?: string; q?: string; day?: string | null; limit?: number | null; fields?: CardFields; embed?: boolean },
): Promise<{ title: string; content: unknown }> {
  switch (surface) {
    case "sessions": {
      const trackId = parseTrackId(query.trackId);
      const page = parsePage(query.page);
      const q = parseNameQuery(query.q);
      const perPage = query.limit ?? PUBLIC_PER_PAGE;
      const tracks = await getPublicTracks(db, event.id);
      // DEC-634: `day` is now a SQL-level predicate on the repo query
      // (joined + counted alongside trackId/q) rather than a post-page
      // filter — LIMIT/OFFSET and `total` see the identical predicate.
      const { items, total } = await getPublicSessions(db, event, {
        trackId,
        page,
        perPage,
        q,
        day: query.day ?? null,
      });
      // DEC-683: the rail (Your schedule / day index / call for papers) is
      // chromeless-closed — /embed never renders it, so these two extra
      // queries are skipped entirely rather than fetched-then-hidden.
      const dayCounts = query.embed ? [] : await getPublicScheduleDayCounts(db, event);
      const cfpWindow = query.embed ? null : await getPublicCfpWindow(db, event.id);
      return {
        title: `Sessions - ${event.name}`,
        content: (
          <SessionsContent
            event={event}
            tracks={tracks}
            activeTrackId={trackId}
            q={q}
            items={items}
            total={total}
            page={page}
            perPage={perPage}
            limit={query.limit ?? null}
            fields={query.fields}
            embed={query.embed}
            dayCounts={dayCounts}
            cfpWindow={cfpWindow}
          />
        ),
      };
    }
    case "speakers": {
      const q = parseNameQuery(query.q);
      const page = parsePage(query.page);
      const perPage = query.limit ?? PUBLIC_PER_PAGE;
      const { items, total } = await getPublicSpeakers(db, event.id, { q, page, perPage });
      return {
        title: `Speakers - ${event.name}`,
        content: (
          <SpeakersContent
            event={event}
            speakers={items}
            total={total}
            page={page}
            q={q}
            perPage={perPage}
            limit={query.limit ?? null}
            embed={query.embed}
          />
        ),
      };
    }
    case "gallery": {
      const q = parseNameQuery(query.q);
      const page = parsePage(query.page);
      const perPage = query.limit ?? PUBLIC_PER_PAGE;
      const { items, total } = await getPublicSpeakers(db, event.id, { q, page, perPage });
      return {
        title: `Speaker gallery - ${event.name}`,
        content: (
          <GalleryContent
            event={event}
            speakers={items}
            total={total}
            page={page}
            q={q}
            perPage={perPage}
            limit={query.limit ?? null}
            embed={query.embed}
          />
        ),
      };
    }
    case "agenda": {
      // DEC-783: q/trackId parsed with the ONE parsers /sessions already
      // uses (query.ts) and pushed into the repo query as SQL predicates —
      // both `items` and `total` see the identical filter.
      const trackId = parseTrackId(query.trackId);
      const q = parseNameQuery(query.q);
      const { items, total } = await getPublicAgenda(db, event, { day: query.day, trackId, q });
      // DEC-768: ?day= filters `items` down to one day's rows, so the day
      // switcher can no longer derive its full day list from `items` alone
      // (that would drop every other day's pill, dead-ending a visitor who
      // arrived here from the Sessions rail's day index). Fetch the full set
      // of scheduled days independently so the switcher always shows every
      // day, with the requested one marked current.
      const allDays = query.day ? (await getPublicScheduleDayCounts(db, event)).map((d) => d.day) : null;
      return {
        title: `Agenda - ${event.name}`,
        content: (
          <AgendaContent
            event={event}
            items={items}
            total={total}
            embed={query.embed}
            allDays={allDays}
            activeDay={query.day ?? null}
            trackId={trackId}
            q={q}
          />
        ),
      };
    }
    case "schedule": {
      const trackId = parseTrackId(query.trackId);
      const q = parseNameQuery(query.q);
      const { items, total } = await getPublicAgenda(db, event, { day: query.day, trackId, q });
      const allDays = query.day ? (await getPublicScheduleDayCounts(db, event)).map((d) => d.day) : null;
      return {
        title: `Schedule - ${event.name}`,
        content: (
          <ScheduleContent
            event={event}
            items={items}
            total={total}
            embed={query.embed}
            allDays={allDays}
            activeDay={query.day ?? null}
            trackId={trackId}
            q={q}
          />
        ),
      };
    }
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unknown public surface '${exhaustive}'`);
    }
  }
}
