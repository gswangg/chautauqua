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
import { DEC_851 } from "../../decisions";

void DEC_851;

// w1-i + DEC-783: the /agenda and /schedule surfaces honour ?q=/?trackId=
// exactly as /sessions does — as SQL-level predicates inside getPublicAgenda,
// so `items` and `total` are graded from the same filtered set. The former
// in-memory matchesAgendaFilter() helper is gone: a post-fetch JS filter
// desyncs the "Showing the first N of M" line from the rows it counts.

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
      // DEC-851 (wave 64 amendment): track is a render-level HIGHLIGHT on
      // this surface, never a SQL predicate — every session still renders,
      // so `?trackId=` is parsed but never threaded into getPublicAgenda's
      // params. `?format=` is not an agenda facet at all (no parse, no
      // fetch of format options). `q` stays a real SQL predicate — search
      // still narrows the day's rows.
      const highlightTrackId = parseTrackId(query.trackId);
      const q = parseNameQuery(query.q);
      // DEC-804: the same search/track control the sessions list renders —
      // reuse the ONE getPublicTracks repo call (sessions already calls it)
      // rather than adding a second query for the same list.
      const tracks = await getPublicTracks(db, event.id);
      const { items, total } = await getPublicAgenda(db, event, { day: query.day, q });
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
            tracks={tracks}
            items={items}
            total={total}
            embed={query.embed}
            allDays={allDays}
            activeDay={query.day ?? null}
            highlightTrackId={highlightTrackId}
            q={q}
          />
        ),
      };
    }
    case "schedule": {
      // DEC-851 (wave 64 amendment): same highlight-not-filter treatment as
      // the agenda case above — `?trackId=` never reaches getPublicAgenda's
      // params, `?format=` is not an agenda facet at all.
      const highlightTrackId = parseTrackId(query.trackId);
      const q = parseNameQuery(query.q);
      // DEC-804: same reuse as the agenda case above — one getPublicTracks
      // call feeds the search form's track <select>.
      const tracks = await getPublicTracks(db, event.id);
      const { items, total } = await getPublicAgenda(db, event, { day: query.day, q });
      // DEC-768: ?day= narrows `items`, so the day switcher's full day list
      // is fetched independently (same as the agenda case above) — the
      // ?q= filter narrows the ROWS only, never the switcher.
      const allDays = query.day ? (await getPublicScheduleDayCounts(db, event)).map((d) => d.day) : null;
      return {
        title: `Schedule - ${event.name}`,
        content: (
          <ScheduleContent
            event={event}
            tracks={tracks}
            items={items}
            total={total}
            embed={query.embed}
            allDays={allDays}
            activeDay={query.day ?? null}
            highlightTrackId={highlightTrackId}
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
