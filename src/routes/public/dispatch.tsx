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
  getPublicRooms,
  getPublicFormatOptions,
  type PublicEvent,
} from "../../server/repo/public";
import type { Surface } from "./shell";
import { parsePage, parseTrackId, parseNameQuery, parseFormat, parseRoomId, type CardFields } from "./query";
import { PUBLIC_PER_PAGE } from "../../server/repo/public/bounds";
import { SessionsContent } from "./sessions";
import { SpeakersContent, GalleryContent } from "./speakers";
import { AgendaContent, ScheduleContent } from "./agenda";

export async function renderSurfaceContent(
  db: Parameters<typeof getPublicSessions>[0],
  event: PublicEvent,
  surface: Surface,
  query: {
    trackId?: string;
    page?: string;
    q?: string;
    day?: string | null;
    limit?: number | null;
    fields?: CardFields;
    embed?: boolean;
    format?: string;
    roomId?: string;
  },
): Promise<{ title: string; content: unknown }> {
  switch (surface) {
    case "sessions": {
      const trackId = parseTrackId(query.trackId);
      const format = parseFormat(query.format);
      const roomId = parseRoomId(query.roomId);
      const page = parsePage(query.page);
      const q = parseNameQuery(query.q);
      const perPage = query.limit ?? PUBLIC_PER_PAGE;
      const tracks = await getPublicTracks(db, event.id);
      // DEC-774: rooms/format options fetched alongside tracks — same
      // "list of possible filter chips" shape, queried once regardless of
      // whether the corresponding filter is active.
      const rooms = await getPublicRooms(db, event.id);
      const formatOptions = await getPublicFormatOptions(db, event.id);
      // DEC-634/DEC-774: `day`/`format`/`roomId` are all SQL-level predicates
      // on the repo query (joined/EXISTS'd + counted alongside trackId/q)
      // rather than a post-page filter — LIMIT/OFFSET and `total` see the
      // identical predicate.
      const { items, total } = await getPublicSessions(db, event, {
        trackId,
        page,
        perPage,
        q,
        day: query.day ?? null,
        format,
        roomId,
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
            rooms={rooms}
            activeRoomId={roomId}
            formatOptions={formatOptions}
            activeFormat={format}
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
      const { items, total } = await getPublicAgenda(db, event, { day: query.day });
      return {
        title: `Agenda - ${event.name}`,
        content: <AgendaContent event={event} items={items} total={total} embed={query.embed} />,
      };
    }
    case "schedule": {
      const { items, total } = await getPublicAgenda(db, event, { day: query.day });
      return {
        title: `Schedule - ${event.name}`,
        content: <ScheduleContent event={event} items={items} total={total} embed={query.embed} />,
      };
    }
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unknown public surface '${exhaustive}'`);
    }
  }
}
