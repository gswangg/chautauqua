// DEC-785: saved embeds. GET /embed/e/:embedId resolves the embed row and,
// when it's missing or disabled, returns the SAME designed 404 page every
// other unknown public route uses (publicNotFound, ./index.tsx) — never a
// silently-served page. When enabled, it renders the saved surface with the
// saved options through the existing embed render path (renderSurfaceContent
// + EmbedShell — the identical pipeline /embed/:eventSlug/:surface uses).
// Route file exports a named Hono sub-app; mounted with one line from
// ./index.tsx (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { getPublicEventById } from "../../server/repo/public";
import { getEmbedById } from "../../server/repo/embeds";
import { isSurface, setCacheHeaders, EmbedShell } from "./shell";
import { parseTrackId, parseNameQuery, parseDay, parseLimit, parseCardFields, parseAccent } from "./query";
import { renderSurfaceContent } from "./dispatch";
import { publicNotFound } from "./not-found";
import { publicCacheMiddleware, defaultCache } from "../../server/pubcache";

export const savedEmbedRoutes = new Hono<AppEnv>();

savedEmbedRoutes.use("/embed/e/*", publicCacheMiddleware(defaultCache));

interface StoredEmbedOptions {
  trackId?: string;
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
  // DEC-785: missing OR disabled both 404 — a disabled embed's public
  // effect is a 404, not a grey pill.
  if (!embed || !embed.enabled) return publicNotFound(c, "Embed not found.");
  if (!isSurface(embed.surface)) return publicNotFound(c, "Embed not found.");

  const event = await getPublicEventById(c.var.db, embed.eventId);
  if (!event) return publicNotFound(c, "Embed not found.");

  const opts = parseStoredOptions(embed.optionsJson);
  const { title, content } = await renderSurfaceContent(c.var.db, event, embed.surface, {
    trackId: parseTrackId(opts.trackId) ?? undefined,
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
