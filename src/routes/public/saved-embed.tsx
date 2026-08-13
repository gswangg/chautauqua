// DEC-785/DEC-822/DEC-839: saved embeds. GET /embed/e/:embedId resolves the
// embed row. An unknown id returns the SAME designed 404 page every other
// unknown public route uses (publicNotFound, ./index.tsx). A DISABLED embed
// is DEC-822's explicit override of DEC-785: it returns an empty 200 (an
// intentional blank inside someone else's iframe), not a 404 -- a page the
// organiser switched off must not shout "not found" on a customer's site.
// When enabled, it renders the saved surface with the saved options through
// the existing embed render path (renderSurfaceContent + EmbedShell — the
// identical pipeline /embed/:eventSlug/:surface uses). Route file exports a
// named Hono sub-app; mounted with one line from ./index.tsx (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { getPublicEventById } from "../../server/repo/public";
import { getEmbedById } from "../../server/repo/embeds";
import { isSurface, setCacheHeaders, EmbedShell } from "./shell";
import { parseTrackId, parseNameQuery, parseDay, parseLimit, parseCardFields, parseAccent, parseFormat, parseRoomId } from "./query";
import { renderSurfaceContent } from "./dispatch";
import { publicNotFound } from "./not-found";
import { publicCacheMiddleware, defaultCache } from "../../server/pubcache";
import { DEC_822, DEC_839 } from "../../decisions";

void DEC_822;
void DEC_839;

export const savedEmbedRoutes = new Hono<AppEnv>();

savedEmbedRoutes.use("/embed/e/*", publicCacheMiddleware(defaultCache));

savedEmbedRoutes.get("/embed/e/:embedId", async (c) => {
  setCacheHeaders(c);
  const embed = await getEmbedById(c.var.db, c.req.param("embedId"));
  if (!embed) return publicNotFound(c, "Embed not found.");
  // DEC-822/DEC-839: disabled is an intentional blank, not a 404 -- keep
  // the cache headers setCacheHeaders(c) already set above (unlike
  // publicNotFound, which forces no-store).
  if (!embed.enabled) return c.html("");
  if (!isSurface(embed.surface)) return publicNotFound(c, "Embed not found.");

  const event = await getPublicEventById(c.var.db, embed.eventId);
  if (!event) return publicNotFound(c, "Embed not found.");

  // DEC-839: embed.options is already the PARSED shape (repo re-hydrates
  // options_json once, in src/server/repo/embeds.ts) -- no local re-parse.
  const opts = embed.options;
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
