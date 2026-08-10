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
} from "../../server/repo/public";
import { buildIcsCalendar, ICS_ORGANIZER_EMAIL } from "../../mail/ics";
import { zonedMinutesToUtc } from "../../lib/timezone";
import { parseItineraryIds, MAX_ITINERARY_IDS } from "../../lib/itinerary";
import { ApiError } from "../../server/http";
import { publicCacheMiddleware, defaultCache } from "../../server/pubcache";
import { DEC_022, DEC_007, DEC_017, DEC_005, DEC_012, DEC_080, DEC_083, DEC_151 } from "../../decisions";
import { SURFACES, isSurface, setCacheHeaders, PublicShell, EmbedShell, isValidFrom } from "./shell";
import { renderSurfaceContent } from "./dispatch";
import { SpeakerDetailContent, SessionDetailContent } from "./detail";

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
  });
  // No frame-blocking headers are ever set in this file — embeds stay
  // frameable by construction (DEC-022).
  return c.html(
    <EmbedShell event={event} title={title}>
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
