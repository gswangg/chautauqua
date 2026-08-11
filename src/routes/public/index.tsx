// J10: the five public surfaces + embeds + itinerary .ics (DEC-022), SSR
// with hono/jsx, mobile-first, no login/session dependence anywhere in this
// module. src/server/repo/public.ts is the ONLY query source (single-sourced
// visibility gate); this module is thin rendering + query-param parsing
// (DEC-012). Route files export a named Hono sub-app; only src/index.ts
// mounts it.
//
// Contention decomposition: this used to be one 891-line src/routes/
// public.tsx file. It's now split by surface across src/routes/public/*
// (shell/cards/query/sessions/speakers/agenda/detail/dispatch), with this
// index.tsx owning route registration and re-exporting the symbols other
// modules and tests import from "../routes/public" / "../src/routes/public".
// No behavior change.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import {
  getPublicEventBySlug,
  getPublicSpeakerDetail,
  getPublicSessionDetail,
  getPublicAgenda,
  getPublicSessions,
  getPublicSpeakers,
} from "../../server/repo/public";
import { buildIcsCalendar, ICS_ORGANIZER_EMAIL } from "../../mail/ics";
import { zonedMinutesToUtc } from "../../lib/timezone";
import { parseItineraryIds, MAX_ITINERARY_IDS } from "../../lib/itinerary";
import { ApiError } from "../../server/http";
import { publicCacheMiddleware, defaultCache } from "../../server/pubcache";
import { DEC_022, DEC_007, DEC_017, DEC_005, DEC_012, DEC_080, DEC_083, DEC_151, DEC_289 } from "../../decisions";
import { SURFACES, isSurface, setCacheHeaders, PublicShell, EmbedShell, isValidFrom, PER_PAGE, type Surface } from "./shell";
import { renderSurfaceContent } from "./dispatch";
import { SpeakerDetailContent, SessionDetailContent } from "./detail";
import {
  parsePage,
  parseTrackId,
  parseNameQuery,
  parseDay,
  parseLimit,
  parseCardFields,
  parseAccent,
} from "./query";
import { buildSurfaceFeed, agendaIcsEvents } from "./feeds";

export const publicRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_022;
void DEC_007;
void DEC_017;
void DEC_005;
void DEC_012;
void DEC_080;
void DEC_083;
void DEC_151;
void DEC_289;

// re-exports: public surface for other modules / tests (unchanged names).
export type { Surface } from "./shell";
export { sessionDetailPath, speakerDetailPath, isValidFrom } from "./shell";
export { parseNameQuery } from "./query";
export { sessionTimeLabel } from "./detail";

// DEC-083 supersedes DEC-022's "no purge machinery" sentence: public/embed
// HTML GETs are now served through a version-salted caches.default, purged
// by any successful mutation (see bumpPublicVersionMiddleware in
// src/server/app.ts). setCacheHeaders below and its 60s client-facing
// max-age are unchanged — the long-TTL edge copy is an implementation
// detail behind that same client contract.
publicRoutes.use("/e/*", publicCacheMiddleware(defaultCache));
publicRoutes.use("/embed/*", publicCacheMiddleware(defaultCache));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

for (const surface of SURFACES) {
  publicRoutes.get(`/e/:eventSlug/${surface}`, async (c) => {
    setCacheHeaders(c);
    const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
    if (!event) return c.text("Event not found.", 404);
    const { title, content } = await renderSurfaceContent(c.var.db, event, surface, {
      trackId: c.req.query("trackId"),
      page: c.req.query("page"),
      q: c.req.query("q"),
      day: parseDay(c.req.query("day")),
      limit: parseLimit(c.req.query("limit")),
      fields: parseCardFields(c.req.query("fields")),
    });
    return c.html(
      <PublicShell event={event} active={surface} title={title}>
        {content as any}
      </PublicShell>,
    );
  });
}

publicRoutes.get("/e/:eventSlug/speakers/:contactId", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const speaker = await getPublicSpeakerDetail(c.var.db, event.id, c.req.param("contactId"));
  if (!speaker) return c.text("Speaker not found.", 404);
  const from = isValidFrom(c.req.query("from"), "speakers");
  return c.html(
    <PublicShell event={event} active={from === "gallery" ? "gallery" : "speakers"} title={`${speaker.firstName} ${speaker.lastName} - ${event.name}`}>
      <SpeakerDetailContent event={event} speaker={speaker} from={from} />
    </PublicShell>,
  );
});

publicRoutes.get("/e/:eventSlug/sessions/:sessionId", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const session = await getPublicSessionDetail(c.var.db, event, c.req.param("sessionId"));
  if (!session) return c.text("Session not found.", 404);
  const from = isValidFrom(c.req.query("from"), "sessions");
  return c.html(
    <PublicShell event={event} active={from} title={`${session.title} - ${event.name}`}>
      <SessionDetailContent event={event} session={session} from={from} />
    </PublicShell>,
  );
});

// EMB-15 (DEC-289): JSON feed of a public surface, registered ahead of the
// plain HTML /embed/:eventSlug/:surface route below so the `.json` suffix
// is matched here first (the regex param constraint keeps every other
// surface value falling through to the HTML route untouched). Data comes
// from the exact same src/server/repo/public.ts calls renderSurfaceContent
// uses for the HTML dispatch — this is not a new query, just a JSON
// projection of the same visibility-gated rows.
publicRoutes.get("/embed/:eventSlug/:surface{[a-z]+\\.json}", async (c) => {
  setCacheHeaders(c);
  const surfaceParam = c.req.param("surface").replace(/\.json$/, "");
  if (!isSurface(surfaceParam)) return c.text("Unknown embed surface.", 404);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const items = await getSurfaceFeedItems(c.var.db, event, surfaceParam, {
    trackId: c.req.query("trackId"),
    page: c.req.query("page"),
    q: c.req.query("q"),
  });
  return c.json(buildSurfaceFeed(event, surfaceParam, items, new Date()));
});

publicRoutes.get("/embed/:eventSlug/:surface", async (c) => {
  setCacheHeaders(c);
  const surfaceParam = c.req.param("surface");
  if (!isSurface(surfaceParam)) return c.text("Unknown embed surface.", 404);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const { title, content } = await renderSurfaceContent(c.var.db, event, surfaceParam, {
    trackId: c.req.query("trackId"),
    page: c.req.query("page"),
    q: c.req.query("q"),
    day: parseDay(c.req.query("day")),
    limit: parseLimit(c.req.query("limit")),
    fields: parseCardFields(c.req.query("fields")),
  });
  // No frame-blocking headers are ever set in this file — embeds stay
  // frameable by construction (DEC-022).
  return c.html(
    <EmbedShell event={event} title={title} accentOverride={parseAccent(c.req.query("accent")) ?? undefined}>
      {content as any}
    </EmbedShell>,
  );
});

publicRoutes.get("/e/:eventSlug/schedule.ics", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);

  const ids = parseItineraryIds(c.req.query("ids"));
  if (ids.length > MAX_ITINERARY_IDS) {
    throw new ApiError("invalid", `Too many ids: schedule.ics accepts at most ${MAX_ITINERARY_IDS} ids.`);
  }
  // getPublicAgenda already applies the shared visibility gate — a
  // submission id that isn't in `agendaById` is either unscheduled or no
  // longer publicly visible, and is silently dropped from the export (a
  // stale itinerary link never leaks a hidden session).
  const agenda = await getPublicAgenda(c.var.db, event);
  const agendaById = new Map(agenda.map((a) => [a.submissionId, a]));

  const events = ids
    .filter((id) => agendaById.has(id))
    .map((id) => {
      const item = agendaById.get(id)!;
      return {
        uidSubmissionId: item.submissionId,
        sequence: item.icsSequence,
        title: item.title,
        description: item.description ?? undefined,
        startUtc: zonedMinutesToUtc(item.day, item.startMin, event.timezone),
        endUtc: zonedMinutesToUtc(item.day, item.endMin, event.timezone),
        location: item.roomName ?? undefined,
        dtstamp: new Date(),
      };
    });

  const ics = buildIcsCalendar(events, {
    method: "PUBLISH",
    organizer: { name: event.name, email: ICS_ORGANIZER_EMAIL },
  });
  return c.body(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${event.slug}-itinerary.ics"`,
  });
});

// EMB-15 (DEC-289): the full published agenda as .ics — same UIDs/SEQUENCE
// as schedule.ics (agendaIcsEvents in ./feeds mirrors its mapping exactly)
// so a calendar app that already imported an itinerary link updates rather
// than duplicates when it later subscribes to the whole agenda.
publicRoutes.get("/e/:eventSlug/agenda.ics", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);

  const agenda = await getPublicAgenda(c.var.db, event);
  const ics = buildIcsCalendar(agendaIcsEvents(event, agenda, new Date()), {
    method: "PUBLISH",
    organizer: { name: event.name, email: ICS_ORGANIZER_EMAIL },
  });
  return c.body(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${event.slug}-agenda.ics"`,
  });
});

// Raw (non-JSX) items for a surface's JSON feed — mirrors renderSurfaceContent's
// switch but returns the repo's own item shape instead of rendered markup.
// Same repo calls, same query params, same visibility gate; no new query.
async function getSurfaceFeedItems(
  db: Parameters<typeof getPublicSessions>[0],
  event: Parameters<typeof getPublicSessions>[1],
  surface: Surface,
  query: { trackId?: string; page?: string; q?: string },
): Promise<unknown> {
  switch (surface) {
    case "sessions": {
      const trackId = parseTrackId(query.trackId);
      const page = parsePage(query.page);
      const q = parseNameQuery(query.q);
      const { items } = await getPublicSessions(db, event, { trackId, page, perPage: PER_PAGE, q });
      return items;
    }
    case "speakers":
    case "gallery": {
      const q = parseNameQuery(query.q);
      return getPublicSpeakers(db, event.id, { q });
    }
    case "agenda":
    case "schedule":
      return getPublicAgenda(db, event);
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unknown public surface '${exhaustive}'`);
    }
  }
}
