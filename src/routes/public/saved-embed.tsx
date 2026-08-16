// DEC-785/DEC-822/DEC-839: saved embeds. GET /embed/e/:embedId resolves the
// embed row. An unknown id returns the SAME designed 404 page every other
// unknown public route uses (publicNotFound, ./index.tsx). A DISABLED embed
// is DEC-822's explicit override of DEC-785: it returns 200 with a MINIMAL
// designed blank (DEC-822 wave-59 amendment) -- a single quiet line, not a
// literal empty body, and not a 404 -- a page the organiser switched off
// must not shout "not found" on a customer's site. The blank still runs
// with NO event lookup (getPublicEventById never runs for a disabled
// embed): a withdrawn embed must leak nothing about the event it was
// pointed at, so the blank is a self-contained document, not EmbedShell
// (which requires a PublicEvent). When enabled, it resolves in its SAVED
// format (DEC-850): iframe/element/
// link render inline through the existing embed render path
// (renderSurfaceContent + EmbedShell — the identical pipeline
// /embed/:eventSlug/:surface uses); json/xml redirect (302) to the
// per-surface feed twin (/embed/:eventSlug/:surface.json|.xml) carrying the
// saved options as query params; ics redirects to the fixed whole-agenda
// /e/:eventSlug/agenda.ics route (DEC-289). A redirect, not a re-render,
// because those feed routes in ./index.tsx are the ONE implementation of
// each envelope. Route file exports a named Hono sub-app; mounted with one
// line from ./index.tsx (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { getPublicEventById } from "../../server/repo/public";
import { getEmbedById } from "../../server/repo/embeds";
import { isSurface, setCacheHeaders, EmbedShell, BaseStyles } from "./shell";
import { parseTrackId, parseNameQuery, parseDay, parseLimit, parseCardFields, parseAccent, parseFormat, parseRoomId } from "./query";
import { renderSurfaceContent } from "./dispatch";
import { publicNotFound } from "./not-found";
import { publicCacheMiddleware, defaultCache } from "../../server/pubcache";
import { knobsForSurface, type EmbedSurface } from "../../lib/embed-knobs";
import { DEC_822, DEC_839, DEC_850, DEC_489 } from "../../decisions";

void DEC_822;
void DEC_839;
void DEC_850;
void DEC_489;

export const savedEmbedRoutes = new Hono<AppEnv>();

// DEC-083 wave-22 amendment: this is NOT a duplicate of publicRoutes'
// `/embed/*` cache registration in ./index.tsx -- it is the ONLY thing
// keeping /embed/e/:embedId behind the cache. Hono's compose() (node_modules/
// hono/dist/compose.js:22, 37) walks handlers strictly in registration order
// and only advances past a `.use()` when that middleware calls next() --
// there is no re-matching pass afterward. `publicRoutes.route("/",
// savedEmbedRoutes)` (./index.tsx:61) splices THIS sub-app's use()+handler in
// ahead of ./index.tsx:89-90's own `.use("/embed/*", ...)`, so once this
// route matches, the parent's later `/embed/*` registration never runs for
// it at all -- it's not "also" covered by the parent, it's covered ONLY
// here. Deleting this line would not create a duplicate cache pass; it would
// remove saved embeds from the cache entirely (0 passes, not 1). Proven at
// runtime (not by reading these lines) in
// test/pubcache-prefix-coverage.test.ts, which mounts the real publicRoutes
// sub-app and asserts exactly one kv.get(PUBVER_KEY) / cache.match per
// request for this shape.
savedEmbedRoutes.use("/embed/e/*", publicCacheMiddleware(defaultCache));

savedEmbedRoutes.get("/embed/e/:embedId", async (c) => {
  setCacheHeaders(c);
  const embed = await getEmbedById(c.var.db, c.req.param("embedId"));
  if (!embed) return publicNotFound(c, "Embed not found.");
  // DEC-822/DEC-839 (wave-59 amendment): disabled is an intentional blank,
  // not a 404 -- keep the cache headers setCacheHeaders(c) already set
  // above (unlike publicNotFound, which forces no-store), and run this
  // check strictly BEFORE getPublicEventById below so a withdrawn embed
  // never resolves (and cannot leak) the event it was pointed at. The
  // blank is a MINIMAL designed document, not a literal empty body -- a
  // single quiet line, still status 200, no EmbedShell (which requires a
  // PublicEvent this branch must never fetch).
  if (!embed.enabled) {
    return c.html(
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Chautauqua</title>
          <BaseStyles />
        </head>
        <body>
          <main class="chq-pub-main">
            <p>This embed has been turned off.</p>
          </main>
        </body>
      </html>,
    );
  }
  if (!isSurface(embed.surface)) return publicNotFound(c, "Embed not found.");

  const event = await getPublicEventById(c.var.db, embed.eventId);
  if (!event) return publicNotFound(c, "Embed not found.");

  // DEC-850: the saved id resolves in its SAVED format. json/xml are feed
  // formats with no inline rendering of their own -- redirect to the ONE
  // implementation of that envelope (the per-surface .json/.xml route in
  // ./index.tsx) rather than forking a second copy of it here. ics is
  // always the fixed whole-agenda route (DEC-289), never per-surface, and
  // carries no query knobs (mirrors buildEmbedUrl in
  // app/src/pages/settings/embedSnippet.ts).
  // DEC-839: embed.options is already the PARSED shape (repo re-hydrates
  // options_json once, in src/server/repo/embeds.ts) -- no local re-parse.
  const opts = embed.options;
  if (embed.format === "json" || embed.format === "xml") {
    // DEC-489 (wave-12 amendment): only serialize knobs the surface's table
    // lists into the redirect — same gate buildEmbedUrl applies
    // (embedSnippet.ts), so a saved recipe can never carry forward a knob
    // the .json/.xml feed twin (getSurfaceFeedPage, src/routes/public/
    // index.tsx) ignores for this surface.
    const surfaceKnobs = knobsForSurface(embed.surface as EmbedSurface);
    const params = new URLSearchParams();
    if (surfaceKnobs.includes("trackId") && opts.trackId) params.set("trackId", opts.trackId);
    if (surfaceKnobs.includes("format") && opts.sessionFormat) params.set("format", opts.sessionFormat);
    if (surfaceKnobs.includes("roomId") && opts.roomId) params.set("roomId", opts.roomId);
    if (surfaceKnobs.includes("day") && opts.day) params.set("day", opts.day);
    if (surfaceKnobs.includes("q") && opts.q) params.set("q", opts.q);
    if (surfaceKnobs.includes("limit") && opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (surfaceKnobs.includes("fields") && opts.fields && opts.fields.length > 0) params.set("fields", opts.fields.join(","));
    if (surfaceKnobs.includes("accent") && opts.accent) params.set("accent", opts.accent.replace(/^#/, ""));
    const qs = params.toString();
    return c.redirect(`/embed/${event.slug}/${embed.surface}.${embed.format}${qs ? `?${qs}` : ""}`, 302);
  }
  if (embed.format === "ics") {
    return c.redirect(`/e/${event.slug}/agenda.ics`, 302);
  }

  const { title, content } = await renderSurfaceContent(c.var.db, event, embed.surface, {
    trackId: parseTrackId(opts.trackId) ?? undefined,
    // DEC-774 (landed before DEC-839 pinned the key list): the sessions
    // surface's format/room chip filters are part of the saved recipe too,
    // carried as sessionFormat to avoid colliding with the embed's own
    // output format column.
    format: parseFormat(opts.sessionFormat) ?? undefined,
    roomId: parseRoomId(opts.roomId) ?? undefined,
    q: parseNameQuery(opts.q) ?? undefined,
    day: parseDay(opts.day),
    limit: parseLimit(opts.limit === undefined ? undefined : String(opts.limit)),
    fields: parseCardFields(Array.isArray(opts.fields) ? opts.fields.join(",") : undefined),
    embed: true,
  });

  return c.html(
    <EmbedShell event={event} title={title} accentOverride={parseAccent(opts.accent ?? "") ?? undefined}>
      {content as any}
    </EmbedShell>,
  );
});
