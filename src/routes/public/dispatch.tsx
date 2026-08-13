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
  type PublicAgendaItem,
} from "../../server/repo/public";
import type { Surface } from "./shell";
import { parsePage, parseTrackId, parseNameQuery, type CardFields } from "./query";
import { PUBLIC_PER_PAGE } from "../../server/repo/public/bounds";
import { SessionsContent } from "./sessions";
import { SpeakersContent, GalleryContent } from "./speakers";
import { AgendaContent, ScheduleContent } from "./agenda";

// w1-i: the sessions surface honours ?q=/?trackId= (getPublicSessions'
// SQL-level predicate); /schedule never applied either, so a filtered link
// (e.g. `/schedule?trackId=X` shared from the /sessions track pills) landed
// on the FULL unfiltered itinerary picker instead of the narrowed set the
// URL claims to show. Filters in-memory over the same visibility-gated rows
// getPublicAgenda already returned — no new query, same predicate semantics
// as the sessions surface's title/speaker-name search.
function matchesAgendaFilter(item: PublicAgendaItem, trackId: string | null, q: string | null): boolean {
  if (trackId !== null && !item.tracks.some((t) => t.id === trackId)) return false;
  if (q !== null) {
    const needle = q.toLowerCase();
    const titleMatch = item.title.toLowerCase().includes(needle);
    const speakerMatch = item.speakers.some((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(needle));
    if (!titleMatch && !speakerMatch) return false;
  }
  return true;
}

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
      const { items, total } = await getPublicAgenda(db, event, { day: query.day });
      // DEC-768: ?day= filters `items` down to one day's rows, so the day
      // switcher can no longer derive its full day list from `items` alone
      // (that would drop every other day's pill, dead-ending a visitor who
      // arrived here from the Sessions rail's day index). Fetch the full set
      // of scheduled days independently so the switcher always shows every
      // day, with the requested one marked current.
      const allDays = query.day ? (await getPublicScheduleDayCounts(db, event)).map((d) => d.day) : null;
      return {
        title: `Agenda - ${event.name}`,
        content: <AgendaContent event={event} items={items} total={total} embed={query.embed} allDays={allDays} activeDay={query.day ?? null} />,
      };
    }
    case "schedule": {
      const trackId = parseTrackId(query.trackId);
      const q = parseNameQuery(query.q);
      const { items: rawItems, total: rawTotal } = await getPublicAgenda(db, event, { day: query.day });
      const filtered = trackId !== null || q !== null ? rawItems.filter((item) => matchesAgendaFilter(item, trackId, q)) : rawItems;
      const total = trackId !== null || q !== null ? filtered.length : rawTotal;
      // DEC-768: ?day= narrows `items`, so the day switcher's full day list
      // is fetched independently (same as the agenda case above) — the
      // w1-i ?trackId=/?q= filter narrows the ROWS only, never the switcher.
      const allDays = query.day ? (await getPublicScheduleDayCounts(db, event)).map((d) => d.day) : null;
      return {
        title: `Schedule - ${event.name}`,
        content: (
          <ScheduleContent event={event} items={filtered} total={total} embed={query.embed} allDays={allDays} activeDay={query.day ?? null} />
        ),
      };
    }
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unknown public surface '${exhaustive}'`);
    }
  }
}
