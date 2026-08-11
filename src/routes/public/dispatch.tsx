// Surface rendering dispatch, shared by the /e/... and /embed/... route
// handlers in index.tsx. Split out of the former monolithic src/routes/
// public.tsx (contention decomposition) — no behavior change.

import {
  getPublicTracks,
  getPublicSessions,
  getPublicSpeakers,
  getPublicAgenda,
  type PublicEvent,
} from "../../server/repo/public";
import { PER_PAGE, type Surface } from "./shell";
import { parsePage, parseTrackId, parseNameQuery, type CardFields } from "./query";
import { SessionsContent } from "./sessions";
import { SpeakersContent, GalleryContent } from "./speakers";
import { AgendaContent, ScheduleContent } from "./agenda";

export async function renderSurfaceContent(
  db: Parameters<typeof getPublicSessions>[0],
  event: PublicEvent,
  surface: Surface,
  query: { trackId?: string; page?: string; q?: string; day?: string | null; limit?: number | null; fields?: CardFields },
): Promise<{ title: string; content: unknown }> {
  switch (surface) {
    case "sessions": {
      const trackId = parseTrackId(query.trackId);
      const page = parsePage(query.page);
      const q = parseNameQuery(query.q);
      const perPage = query.limit ?? PER_PAGE;
      const tracks = await getPublicTracks(db, event.id);
      const { items, total } = await getPublicSessions(db, event, { trackId, page, perPage, q });
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
            day={query.day ?? null}
            limit={query.limit ?? null}
            fields={query.fields}
          />
        ),
      };
    }
    case "speakers": {
      const q = parseNameQuery(query.q);
      const speakers = await getPublicSpeakers(db, event.id, { q });
      return { title: `Speakers - ${event.name}`, content: <SpeakersContent event={event} speakers={speakers} q={q} /> };
    }
    case "gallery": {
      const q = parseNameQuery(query.q);
      const speakers = await getPublicSpeakers(db, event.id, { q });
      return { title: `Speaker gallery - ${event.name}`, content: <GalleryContent event={event} speakers={speakers} q={q} /> };
    }
    case "agenda": {
      let items = await getPublicAgenda(db, event);
      if (query.day) items = items.filter((i) => i.day === query.day);
      return { title: `Agenda - ${event.name}`, content: <AgendaContent event={event} items={items} /> };
    }
    case "schedule": {
      let items = await getPublicAgenda(db, event);
      if (query.day) items = items.filter((i) => i.day === query.day);
      return { title: `Schedule - ${event.name}`, content: <ScheduleContent event={event} items={items} /> };
    }
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unknown public surface '${exhaustive}'`);
    }
  }
}
