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
  getPublicBreaksByDay,
  type PublicEvent,
} from "../../server/repo/public";
import type { Surface } from "./shell";
import { parsePage, parseTrackId, parseNameQuery, parseFormat, parseRoomId, type CardFields } from "./query";
import { PUBLIC_PER_PAGE } from "../../server/repo/public/bounds";
import { SessionsContent } from "./sessions";
import { SpeakersContent, GalleryContent } from "./speakers";
import { AgendaContent, ScheduleContent } from "./agenda";
import { eventDays } from "../../domain/event-days";
import { DEC_851, DEC_774 } from "../../decisions";

void DEC_851;
void DEC_774;

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
    // DEC-489 (wave-54 amendment): /embed-only knob — accent is the
    // <iframe>'s own accent override, never rendered on /e/ (which carries
    // the event's stored branding instead). Only index.tsx's /embed HTML
    // route ever supplies a non-null value here.
    accent?: string | null;
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
      // v7 active-filter line needs the UNFILTERED count ("9 of 18
      // sessions"); one extra COUNT-shaped query, run only when a filter is
      // actually active — at rest grandTotal === total and the line renders
      // nothing anyway. /embed is excluded wholesale: configured knobs are
      // not user filters (DEC-489's rationale survives v7 for embeds — a
      // removable chip inside an embed would un-configure it). Both
      // `anyFilter` and `query.embed` are known before any await, so the
      // decision of WHICH reads to issue is made up front and folded into
      // the single wave below (DEC-774 wave-34 amendment: a skipped read
      // stays skipped, never fetched-then-discarded).
      const anyFilter = !query.embed && Boolean(q || query.day || trackId || format || roomId);
      const [tracks, rooms, formatOptions, sessionsPage, grandTotalPage, dayCounts, cfpWindow] = await Promise.all([
        getPublicTracks(db, event.id),
        // DEC-774: rooms/format options fetched alongside tracks — same
        // "list of possible filter chips" shape, queried once regardless of
        // whether the corresponding filter is active.
        getPublicRooms(db, event.id),
        getPublicFormatOptions(db, event.id),
        // DEC-634/DEC-774: `day`/`format`/`roomId` are all SQL-level
        // predicates on the repo query (joined/EXISTS'd + counted alongside
        // trackId/q) rather than a post-page filter — LIMIT/OFFSET and
        // `total` see the identical predicate.
        getPublicSessions(db, event, {
          trackId,
          page,
          perPage,
          q,
          day: query.day ?? null,
          format,
          roomId,
        }),
        anyFilter
          ? getPublicSessions(db, event, { trackId: null, page: 1, perPage: 1, q: null, day: null, format: null, roomId: null })
          : Promise.resolve(null),
        // DEC-683: the rail (Your schedule / day index / call for papers) is
        // chromeless-closed — /embed never renders it, so these two extra
        // queries are skipped entirely rather than fetched-then-hidden.
        query.embed ? Promise.resolve<{ day: string; count: number }[]>([]) : getPublicScheduleDayCounts(db, event),
        query.embed ? Promise.resolve(null) : getPublicCfpWindow(db, event.id),
      ]);
      const { items, total } = sessionsPage;
      const grandTotal = anyFilter ? grandTotalPage!.total : total;
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
            activeDay={query.embed ? null : (query.day ?? null)}
            items={items}
            total={total}
            grandTotal={grandTotal}
            page={page}
            perPage={perPage}
            limit={query.limit ?? null}
            fields={query.fields}
            embed={query.embed}
            accent={query.accent ?? null}
            dayCounts={dayCounts}
            cfpWindow={cfpWindow}
          />
        ),
      };
    }
    case "speakers": {
      const q = parseNameQuery(query.q);
      const trackId = parseTrackId(query.trackId);
      const page = parsePage(query.page);
      const perPage = query.limit ?? PUBLIC_PER_PAGE;
      // DEC-990 amendment (wave 64): the one track facet — same
      // getPublicTracks call the sessions/agenda surfaces already use for
      // their track select's options. DEC-774 wave-34 amendment: issued
      // alongside the speakers page in one wave (neither read depends on
      // the other).
      const [tracks, speakersPage] = await Promise.all([
        getPublicTracks(db, event.id),
        getPublicSpeakers(db, event.id, { q, trackId, page, perPage }),
      ]);
      const { items, total } = speakersPage;
      return {
        title: `Speakers - ${event.name}`,
        content: (
          <SpeakersContent
            event={event}
            speakers={items}
            total={total}
            page={page}
            q={q}
            tracks={tracks}
            activeTrackId={trackId}
            perPage={perPage}
            limit={query.limit ?? null}
            embed={query.embed}
            accent={query.accent ?? null}
          />
        ),
      };
    }
    case "gallery": {
      const q = parseNameQuery(query.q);
      const trackId = parseTrackId(query.trackId);
      const page = parsePage(query.page);
      const perPage = query.limit ?? PUBLIC_PER_PAGE;
      // DEC-990 amendment (wave 64): /gallery is the same reader as
      // /speakers (DEC-593) — same facet, same query, photo-led rendering.
      // DEC-774 wave-34 amendment: one wave, same as /speakers above.
      const [tracks, speakersPage] = await Promise.all([
        getPublicTracks(db, event.id),
        getPublicSpeakers(db, event.id, { q, trackId, page, perPage }),
      ]);
      const { items, total } = speakersPage;
      return {
        title: `Speaker gallery - ${event.name}`,
        content: (
          <GalleryContent
            event={event}
            speakers={items}
            total={total}
            page={page}
            q={q}
            tracks={tracks}
            activeTrackId={trackId}
            perPage={perPage}
            limit={query.limit ?? null}
            embed={query.embed}
            accent={query.accent ?? null}
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
      // DEC-768 (wave 67 amendment): /agenda is single-day by default -- the
      // day-count list is fetched on EVERY request (not only when ?day= is
      // set) so the default day can be derived from it: the FIRST day with
      // scheduled sessions, deterministic (never a "today" comparison) so
      // the version-salted cached copy stays correct for any visitor on any
      // date. `effectiveDay` is null only when the event has nothing
      // scheduled at all.
      // DEC-774 wave-34 amendment: tracks and dayCounts are the wave-1
      // read pair (neither depends on the other); getPublicAgenda and
      // getPublicBreaksByDay form wave 2 because both need `effectiveDay`,
      // which only dayCounts can produce -- EXACTLY two waves, no further
      // collapse.
      const [tracks, dayCounts] = await Promise.all([getPublicTracks(db, event.id), getPublicScheduleDayCounts(db, event)]);
      // DEC-277 (wave 60 amendment): the switcher's day set is the event's
      // FULL calendar range (src/domain/event-days.ts's eventDays), same
      // owner /sessions' rail reads -- an unscheduled day stays selectable
      // instead of vanishing from the switcher. The DEFAULT active day is
      // unaffected: it still comes from dayCounts, the first day that
      // actually has sessions, never from the full range.
      const allDays = eventDays(event.startDate, event.endDate);
      const firstDayWithSessions = dayCounts[0]?.day ?? null;
      const effectiveDay = query.day ?? firstDayWithSessions;
      // DEC-022 amendment: breaks read through server/repo/public's ONE
      // mockable barrel (getPublicBreaksByDay), which itself reads through
      // the SAME repo function src/routes/api/breaks.ts's GET uses -- never
      // a second, public-only query.
      const [agendaPage, breaksByDay] = await Promise.all([
        getPublicAgenda(db, event, { day: effectiveDay, q }),
        getPublicBreaksByDay(db, event, effectiveDay),
      ]);
      const { items, total } = agendaPage;
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
            activeDay={effectiveDay}
            highlightTrackId={highlightTrackId}
            q={q}
            breaksByDay={breaksByDay}
          />
        ),
      };
    }
    case "schedule": {
      // DEC-851 (wave-55 amendment): schedule honours no trackId at all --
      // there is no highlight control on this frame and no feed twin reads
      // it either, so the knob is not parsed here.
      const q = parseNameQuery(query.q);
      // DEC-804: same reuse as the agenda case above — one getPublicTracks
      // call feeds the search form's track <select>.
      // DEC-774 (wave-55 amendment): the day-switcher day-counts read is
      // gone entirely -- its only consumer was the deleted `allDays` prop,
      // and a skipped read stays skipped, never fetched-then-discarded.
      const [tracks, agendaPage, breaksByDay] = await Promise.all([
        getPublicTracks(db, event.id),
        getPublicAgenda(db, event, { day: query.day, q }),
        getPublicBreaksByDay(db, event, query.day),
      ]);
      const { items, total } = agendaPage;
      return {
        title: `Schedule - ${event.name}`,
        content: (
          <ScheduleContent
            event={event}
            tracks={tracks}
            items={items}
            total={total}
            embed={query.embed}
            q={q}
            breaksByDay={breaksByDay}
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
