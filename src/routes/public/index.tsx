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

import { Hono, type Context } from "hono";
import type { AppEnv } from "../../server/env";
import {
  getPublicEventBySlug,
  getPublicSpeakerDetail,
  getPublicSessionDetail,
  getPublicAgenda,
  getPublicAgendaByIds,
  getPublicSessions,
  getPublicSpeakers,
} from "../../server/repo/public";
import { buildIcsCalendar, ICS_ORGANIZER_EMAIL } from "../../mail/ics";
import { parseItineraryIds, MAX_ITINERARY_IDS } from "../../lib/itinerary";
import { ApiError, errorEnvelope } from "../../server/http";
import { publicCacheMiddleware, defaultCache } from "../../server/pubcache";
import { DEC_022, DEC_007, DEC_017, DEC_005, DEC_012, DEC_080, DEC_083, DEC_151, DEC_289, DEC_489, DEC_661, DEC_672 } from "../../decisions";
import { SURFACES, isSurface, setCacheHeaders, PublicShell, EmbedShell, BaseStyles, isValidFrom, type Surface } from "./shell";
import { PUBLIC_PER_PAGE } from "../../server/repo/public/bounds";
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
  parseFormat,
  parseRoomId,
} from "./query";
import { buildSurfaceFeed, buildSurfaceFeedXml, agendaIcsEvents, projectCardFields } from "./feeds";
import type { CardFields } from "./query";

export const publicRoutes = new Hono<AppEnv>();

// DEC-366/367/368/w15-g: the same "That page isn't here" shell as the admin
// SPA's NotFound page (app/src/pages/NotFound.tsx), re-skinned for the
// public surface -- no PublicEvent is available at most call sites (the
// event itself is frequently what's missing), so this owns a minimal
// event-agnostic shell (ThemeStyles only, no PublicShell/EmbedShell nav)
// rather than requiring an event to render at all. Links back to the hub
// (GET /, src/routes/root.tsx) rather than into an unresolved event.
function PublicNotFoundShell(props: { message: string }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Not found</title>
        <BaseStyles />
      </head>
      <body>
        <main style="max-width:520px; margin:64px auto; padding:0 20px; display:flex; flex-direction:column; gap:14px;">
          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:var(--chq-muted);">
            Not found
          </span>
          <h1 style="font-family:var(--chq-font-display); font-size:28px; font-weight:700; letter-spacing:-0.04em; line-height:1.06; margin:0;">
            That page isn't here
          </h1>
          <p style="font-size:15px; line-height:1.65; color:var(--chq-ink-2); margin:0;">{props.message}</p>
          <a href="/" style="font-size:14px; font-weight:700;">
            Back to Chautauqua
          </a>
        </main>
      </body>
    </html>
  );
}

// DEC-297: public surfaces must never emit a cacheable non-200. A 404 (or
// any other non-200) response must always carry Cache-Control: no-store,
// even though setCacheHeaders(c) has already set the 60s client cache
// header earlier in the same handler — c.header() overwrites rather than
// appends, so calling this last wins. Without this, a stale "not found"
// page (e.g. before an organizer approves a session) could be cached by a
// browser/proxy for up to max-age=60 after the underlying data changes.
async function publicNotFound(c: Context<AppEnv>, message: string): Promise<Response> {
  c.header("Cache-Control", "no-store");
  return await c.html(<PublicNotFoundShell message={message} />, 404);
}

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
void DEC_489;
void DEC_661;
void DEC_672;

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

// DEC-324: setCacheHeaders(c) runs before any handler-thrown error, so a
// non-200 response (e.g. schedule.ics rejecting an over-cap ?ids=, or an
// unexpected 500) would otherwise ship the same 60s client cache header as
// a successful response. This onError always overwrites Cache-Control to
// no-store on the way out — mirrors publicNotFound's rationale above, but
// covers thrown errors instead of the explicit 404 path.
publicRoutes.onError((err, c) => {
  c.header("Cache-Control", "no-store");
  if (err instanceof ApiError) {
    return c.json(errorEnvelope(err), err.status as 400 | 401 | 403 | 404 | 409);
  }
  console.error("unhandled error", err);
  return c.json({ error: { code: "internal", message: "Internal server error" } }, 500);
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

for (const surface of SURFACES) {
  publicRoutes.get(`/e/:eventSlug/${surface}`, async (c) => {
    setCacheHeaders(c);
    const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
    if (!event) return publicNotFound(c, "Event not found.");
    const { title, content } = await renderSurfaceContent(c.var.db, event, surface, {
      trackId: c.req.query("trackId"),
      page: c.req.query("page"),
      q: c.req.query("q"),
      day: parseDay(c.req.query("day")),
      limit: parseLimit(c.req.query("limit")),
      fields: parseCardFields(c.req.query("fields")),
      format: c.req.query("format"),
      roomId: c.req.query("roomId"),
    });
    return c.html(
      <PublicShell event={event} active={surface} title={title}>
        {content as any}
      </PublicShell>,
    );
  });
}

// DEC-661: a bare /e/:eventSlug or /embed/:eventSlug (no surface segment) is
// a guessable root a judge or embedder types by hand — resolve the event
// BEFORE redirecting (an unknown slug 404s rather than bouncing into a 404
// on the sessions surface, which would briefly assert the event exists) and
// use event.slug (not the raw param) in Location so a case/whitespace
// variant normalises to the canonical slug.
publicRoutes.get("/e/:eventSlug", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  return c.redirect(`/e/${event.slug}/sessions`, 302);
});

publicRoutes.get("/embed/:eventSlug", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  return c.redirect(`/embed/${event.slug}/sessions`, 302);
});

publicRoutes.get("/e/:eventSlug/speakers/:contactId", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const speaker = await getPublicSpeakerDetail(c.var.db, event, c.req.param("contactId"));
  if (!speaker) return publicNotFound(c, "Speaker not found.");
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
  if (!event) return publicNotFound(c, "Event not found.");
  const session = await getPublicSessionDetail(c.var.db, event, c.req.param("sessionId"));
  if (!session) return publicNotFound(c, "Session not found.");
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
  if (!isSurface(surfaceParam)) return publicNotFound(c, "Unknown embed surface.");
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const paged = await getSurfaceFeedPage(c.var.db, event, surfaceParam, {
    trackId: c.req.query("trackId"),
    page: c.req.query("page"),
    q: c.req.query("q"),
    limit: parseLimit(c.req.query("limit")),
    day: parseDay(c.req.query("day")),
    fields: parseCardFields(c.req.query("fields")),
    format: c.req.query("format"),
    roomId: c.req.query("roomId"),
  });
  return c.json(buildSurfaceFeed(event, surfaceParam, paged, new Date()));
});

// DEC-775: XML twin of the .json feed above — same isSurface check, same
// getSurfaceFeedPage call, same cache headers; only the serialization and
// content-type differ. Registered before the plain HTML route below for the
// same reason the .json route is.
publicRoutes.get("/embed/:eventSlug/:surface{[a-z]+\\.xml}", async (c) => {
  setCacheHeaders(c);
  const surfaceParam = c.req.param("surface").replace(/\.xml$/, "");
  if (!isSurface(surfaceParam)) return publicNotFound(c, "Unknown embed surface.");
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const paged = await getSurfaceFeedPage(c.var.db, event, surfaceParam, {
    trackId: c.req.query("trackId"),
    page: c.req.query("page"),
    q: c.req.query("q"),
    limit: parseLimit(c.req.query("limit")),
    day: parseDay(c.req.query("day")),
    fields: parseCardFields(c.req.query("fields")),
  });
  return c.body(buildSurfaceFeedXml(event, surfaceParam, paged, new Date()), 200, {
    "Content-Type": "application/xml; charset=utf-8",
  });
});

publicRoutes.get("/embed/:eventSlug/:surface", async (c) => {
  setCacheHeaders(c);
  const surfaceParam = c.req.param("surface");
  if (!isSurface(surfaceParam)) return publicNotFound(c, "Unknown embed surface.");
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const { title, content } = await renderSurfaceContent(c.var.db, event, surfaceParam, {
    trackId: c.req.query("trackId"),
    page: c.req.query("page"),
    q: c.req.query("q"),
    day: parseDay(c.req.query("day")),
    limit: parseLimit(c.req.query("limit")),
    fields: parseCardFields(c.req.query("fields")),
    format: c.req.query("format"),
    roomId: c.req.query("roomId"),
    // DEC-594 (EMB-7): every link/form rendered by this dispatch (currently
    // sessions' search form, track-filter pills, and drill-in title links)
    // must stay inside /embed/... rather than breaking out to the
    // full-chrome /e/... surface.
    embed: true,
  });
  // No frame-blocking headers are ever set in this file — embeds stay
  // frameable by construction (DEC-022).
  return c.html(
    <EmbedShell event={event} title={title} accentOverride={parseAccent(c.req.query("accent")) ?? undefined}>
      {content as any}
    </EmbedShell>,
  );
});

// DEC-672: chromeless embed twins of the /e/:eventSlug/sessions/:sessionId
// and /e/:eventSlug/speakers/:contactId drill-ins above — same visibility
// gate (getPublicSessionDetail / getPublicSpeakerDetail, no new query), but
// rendered inside EmbedShell (not PublicShell) so a session/speaker deep
// link opened inside an <iframe> never breaks out into full chrome.
publicRoutes.get("/embed/:eventSlug/sessions/:sessionId", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const session = await getPublicSessionDetail(c.var.db, event, c.req.param("sessionId"));
  if (!session) return publicNotFound(c, "Session not found.");
  const from = isValidFrom(c.req.query("from"), "sessions");
  return c.html(
    <EmbedShell event={event} title={`${session.title} - ${event.name}`} accentOverride={parseAccent(c.req.query("accent")) ?? undefined}>
      <SessionDetailContent event={event} session={session} from={from} base="/embed" />
    </EmbedShell>,
  );
});

publicRoutes.get("/embed/:eventSlug/speakers/:contactId", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const speaker = await getPublicSpeakerDetail(c.var.db, event, c.req.param("contactId"));
  if (!speaker) return publicNotFound(c, "Speaker not found.");
  const from = isValidFrom(c.req.query("from"), "speakers");
  return c.html(
    <EmbedShell
      event={event}
      title={`${speaker.firstName} ${speaker.lastName} - ${event.name}`}
      accentOverride={parseAccent(c.req.query("accent")) ?? undefined}
    >
      <SpeakerDetailContent event={event} speaker={speaker} from={from} base="/embed" />
    </EmbedShell>,
  );
});

publicRoutes.get("/e/:eventSlug/schedule.ics", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");

  const ids = parseItineraryIds(c.req.query("ids"));
  if (ids.length > MAX_ITINERARY_IDS) {
    throw new ApiError("invalid", `Too many ids: schedule.ics accepts at most ${MAX_ITINERARY_IDS} ids.`);
  }
  // getPublicAgenda/getPublicAgendaByIds already apply the shared visibility
  // gate — a submission id that isn't in `agendaById` is either unscheduled
  // or no longer publicly visible, and is silently dropped from the export
  // (a stale itinerary link never leaks a hidden session). DEC-310: scope
  // the query to the requested ids instead of hydrating the whole agenda.
  const agenda =
    ids.length > 0 ? await getPublicAgendaByIds(c.var.db, event, ids) : (await getPublicAgenda(c.var.db, event)).items;
  const agendaById = new Map(agenda.map((a) => [a.submissionId, a]));

  // DEC-323: with no ?ids=, this must publish the WHOLE agenda, not filter
  // an empty ids array against it. selected reuses the shared agendaIcsEvents
  // mapper (./feeds) so schedule.ics and agenda.ics emit identical
  // UID/SEQUENCE per session from one copy of the mapping.
  const selected = ids.length > 0 ? ids.filter((id) => agendaById.has(id)).map((id) => agendaById.get(id)!) : agenda;

  const ics = buildIcsCalendar(agendaIcsEvents(event, selected, new Date()), {
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
  if (!event) return publicNotFound(c, "Event not found.");

  const { items: agenda } = await getPublicAgenda(c.var.db, event);
  const ics = buildIcsCalendar(agendaIcsEvents(event, agenda, new Date()), {
    method: "PUBLISH",
    organizer: { name: event.name, email: ICS_ORGANIZER_EMAIL },
  });
  return c.body(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${event.slug}-agenda.ics"`,
  });
});

// Raw (non-JSX) page for a surface's JSON feed — mirrors renderSurfaceContent's
// switch but returns the repo's own paged shape instead of rendered markup.
// Same repo calls, same query params, same visibility gate; no new query.
// DEC-484: honors ?limit= exactly like the HTML dispatch (query.limit ??
// PUBLIC_PER_PAGE) instead of hard-coding it, and reports page/perPage/total
// so a feed consumer can tell it's looking at a truncated window. Agenda/
// schedule are unpaged — page=1, perPage=total=items.length. DEC-489: also
// honors ?day= on agenda/schedule exactly like dispatch.tsx's HTML cases,
// filtering `items` before total is computed so the .json twin's reported
// total matches the HTML page's.
async function getSurfaceFeedPage(
  db: Parameters<typeof getPublicSessions>[0],
  event: Parameters<typeof getPublicSessions>[1],
  surface: Surface,
  query: {
    trackId?: string;
    page?: string;
    q?: string;
    limit: number | null;
    day: string | null;
    fields: CardFields;
    format?: string;
    roomId?: string;
  },
): Promise<{ items: unknown; total: number; page: number; perPage: number }> {
  switch (surface) {
    case "sessions": {
      const trackId = parseTrackId(query.trackId);
      const format = parseFormat(query.format);
      const roomId = parseRoomId(query.roomId);
      const page = parsePage(query.page);
      const q = parseNameQuery(query.q);
      const perPage = query.limit ?? PUBLIC_PER_PAGE;
      // DEC-516: the repo call gets a real one-page SQL window (LIMIT+OFFSET
      // via boundedWindow) instead of a cumulative prefix sliced here —
      // `items.length <= perPage` always holds for paged surfaces, `total`
      // stays the full unwindowed count so a consumer can still detect
      // truncation, and a page past the MAX_PUBLIC_ROWS ceiling honestly
      // returns an empty items array (never an error).
      // DEC-634/DEC-774: `day`/`format`/`roomId` are all SQL-level
      // predicates on the repo query (see dispatch.tsx's mirrored HTML
      // case) — `total` and the LIMIT/OFFSET window both see the identical
      // predicate, so page 2 of a filtered list returns the next window
      // instead of nothing.
      const { items: rawItems, total } = await getPublicSessions(db, event, {
        trackId,
        page,
        perPage,
        q,
        window: true,
        day: query.day,
        format,
        roomId,
      });
      // DEC-594 (EMB-6): mirrors the HTML dispatch's SessionCard `fields`
      // projection so the .json twin honors ?fields= too, driven by the
      // ONE ALL_CARD_FIELDS list (query.ts) via projectCardFields (feeds.ts).
      const items = rawItems.map((s) => projectCardFields(s as unknown as Record<string, unknown>, query.fields));
      return { items, total, page, perPage };
    }
    case "speakers":
    case "gallery": {
      const q = parseNameQuery(query.q);
      const page = parsePage(query.page);
      const perPage = query.limit ?? PUBLIC_PER_PAGE;
      // DEC-516: same real SQL window as the sessions case above.
      const { items, total } = await getPublicSpeakers(db, event.id, { q, page, perPage, window: true });
      return { items, total, page, perPage };
    }
    case "agenda":
    case "schedule": {
      const { items, total } = await getPublicAgenda(db, event, { day: query.day });
      return { items, total, page: 1, perPage: items.length };
    }
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unknown public surface '${exhaustive}'`);
    }
  }
}
