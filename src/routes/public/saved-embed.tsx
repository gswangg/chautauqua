// DEC-785 / DEC-822: saved embeds. GET /embed/e/:embedId resolves the embed
// row and splits into two distinct cases: an UNKNOWN/missing id keeps the
// SAME designed 404 page every other unknown public route uses
// (publicNotFound, ./index.tsx) — never a silently-served page for an id
// that was never real. A row that exists but is DISABLED returns an EMPTY
// 200 HTML document instead (DEC-822 overrides DEC-785 here): an organiser
// switching an embed off must not shout "not found" inside someone else's
// iframe — that's an intentional blank, not a broken page. When enabled, it
// renders the saved surface with the saved options through the existing
// embed render path (renderSurfaceContent + EmbedShell — the identical
// pipeline /embed/:eventSlug/:surface uses). Route file exports a named
// Hono sub-app; mounted with one line from ./index.tsx (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { getPublicEventById } from "../../server/repo/public";
import { getEmbedById } from "../../server/repo/embeds";
import { isSurface, setCacheHeaders, EmbedShell } from "./shell";
import { parseTrackId, parseNameQuery, parseDay, parseLimit, parseCardFields, parseAccent, parseFormat, parseRoomId } from "./query";
import { renderSurfaceContent } from "./dispatch";
import { publicNotFound } from "./not-found";
import { publicCacheMiddleware, defaultCache } from "../../server/pubcache";
import { DEC_822 } from "../../decisions";

void DEC_822;

export const savedEmbedRoutes = new Hono<AppEnv>();

savedEmbedRoutes.use("/embed/e/*", publicCacheMiddleware(defaultCache));

interface StoredEmbedOptions {
  trackId?: string;
  // DEC-774/DEC-822: the sessions-only format/room filter knobs, carried
  // through the saved recipe the same as EmbedsPanel's live builder (named
  // sessionFormat here for the same reason embedSnippet.ts's EmbedOptions
  // does — the server query param is `format`, but that name is taken by
  // the embed's own output format below in the surface/format columns).
  sessionFormat?: string;
  roomId?: string;
  day?: string;
  q?: string;
  limit?: number | string;
  fields?: string[];
  accent?: string;
}

function parseStoredOptions(raw: string): StoredEmbedOptions {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as StoredEmbedOptions;
  } catch {
    return {};
  }
}

savedEmbedRoutes.get("/embed/e/:embedId", async (c) => {
  setCacheHeaders(c);
  const embed = await getEmbedById(c.var.db, c.req.param("embedId"));
  // DEC-822: an UNKNOWN id 404s the designed not-found page — it was never
  // real. A row that exists but is DISABLED is a different case (below):
  // an empty 200, not a 404.
  if (!embed) return publicNotFound(c, "Embed not found.");
  if (!isSurface(embed.surface)) return publicNotFound(c, "Embed not found.");

  // DEC-822: a disabled embed is an intentional blank — the organiser
  // turned it off, so the page it's pasted on should render nothing, not
  // shout "not found" (which would read as a broken customer page). No
  // chrome, no error copy: literally an empty document, same cache
  // headers as the enabled case so a CDN can't serve a stale enabled
  // render after it's switched off.
  if (!embed.enabled) return c.html("");

  const event = await getPublicEventById(c.var.db, embed.eventId);
  if (!event) return publicNotFound(c, "Embed not found.");

  const opts = parseStoredOptions(embed.optionsJson);
  const { title, content } = await renderSurfaceContent(c.var.db, event, embed.surface, {
    trackId: parseTrackId(opts.trackId) ?? undefined,
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
