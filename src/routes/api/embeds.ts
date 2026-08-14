// Saved embeds API (DEC-785/DEC-822/DEC-839). Route files export a named
// Hono sub-app; only src/index.ts mounts it (DEC-012). Handlers stay thin:
// parse/authz -> repo function -> response.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import type { Db } from "../../server/context";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError, parseBoundedText, readOptionalJsonBody } from "../../server/http";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { getEventOrgId } from "../../server/repo/submissions";
import { clampPage, listPerPage } from "../../lib/pagination";
import { isSurface } from "../public/shell";
import { EMBED_FORMATS } from "../../lib/embed-formats";
import { ALL_CARD_FIELDS } from "../../lib/card-fields";
import { parseTrackId, parseDay, parseNameQuery, parseLimit, parseCardFields, parseAccent, parseFormat, parseRoomId } from "../public/query";
import { DEC_785, DEC_822, DEC_839 } from "../../decisions";
import {
  countEmbeds,
  createEmbed,
  deleteEmbed,
  getEmbedOwnership,
  listEmbeds,
  roomBelongsToEvent,
  trackBelongsToEvent,
  updateEmbed,
  type EmbedOptions,
} from "../../server/repo/embeds";

void DEC_785;
void DEC_822;
void DEC_839;

/** DEC-839: every option key the API accepts is validated through the SAME
 * parsers the live public route runs (src/routes/public/query.ts) -- an
 * unparseable value is a loud 400 naming the field, never silently dropped
 * or stored as junk the renderer will later ignore. Shared by POST and
 * PATCH so the two routes cannot drift. */
async function parseEmbedOptionsInput(db: Db, eventId: string, raw: unknown): Promise<EmbedOptions> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError("invalid", "options must be an object", { options: "Invalid options" });
  }
  const input = raw as Record<string, unknown>;
  const out: EmbedOptions = {};

  if (input.trackId !== undefined) {
    // DEC-839 amendment: bound the raw text BEFORE the live parser (which
    // has no maximum), then confirm the id resolves inside the embed's own
    // event -- a foreign-event id must never persist into options_json.
    const bounded = parseBoundedText(input.trackId, "trackId", { max: MAX_NAME_LENGTH, required: true });
    const parsed = parseTrackId(bounded);
    if (parsed === null) throw new ApiError("invalid", "trackId must be non-empty", { trackId: "Invalid trackId" });
    if (!(await trackBelongsToEvent(db, parsed, eventId))) {
      throw new ApiError("invalid", "trackId does not belong to this event", { trackId: "Unknown trackId" });
    }
    out.trackId = parsed;
  }
  // DEC-774: the sessions-surface format/room chip filters, validated
  // through the SAME live-route parsers as every other key.
  if (input.sessionFormat !== undefined) {
    const bounded = parseBoundedText(input.sessionFormat, "sessionFormat", { max: MAX_NAME_LENGTH, required: true });
    const parsed = parseFormat(bounded);
    if (parsed === null) {
      throw new ApiError("invalid", "sessionFormat must be non-empty", { sessionFormat: "Invalid sessionFormat" });
    }
    out.sessionFormat = parsed;
  }
  if (input.roomId !== undefined) {
    const bounded = parseBoundedText(input.roomId, "roomId", { max: MAX_NAME_LENGTH, required: true });
    const parsed = parseRoomId(bounded);
    if (parsed === null) throw new ApiError("invalid", "roomId must be non-empty", { roomId: "Invalid roomId" });
    if (!(await roomBelongsToEvent(db, parsed, eventId))) {
      throw new ApiError("invalid", "roomId does not belong to this event", { roomId: "Unknown roomId" });
    }
    out.roomId = parsed;
  }
  if (input.day !== undefined) {
    if (typeof input.day !== "string") {
      throw new ApiError("invalid", "day must be a string", { day: "Invalid day" });
    }
    const parsed = parseDay(input.day);
    if (parsed === null) throw new ApiError("invalid", "day must be YYYY-MM-DD", { day: "Invalid day" });
    out.day = parsed;
  }
  if (input.q !== undefined) {
    const bounded = parseBoundedText(input.q, "q", { max: MAX_NAME_LENGTH, required: true });
    const parsed = parseNameQuery(bounded);
    if (parsed === null) throw new ApiError("invalid", "q must be non-empty", { q: "Invalid q" });
    out.q = parsed;
  }
  if (input.limit !== undefined) {
    if (typeof input.limit !== "number" && typeof input.limit !== "string") {
      throw new ApiError("invalid", "limit must be a number", { limit: "Invalid limit" });
    }
    const parsed = parseLimit(String(input.limit));
    if (parsed === null) throw new ApiError("invalid", "limit must be an integer 1-100", { limit: "Invalid limit" });
    out.limit = parsed;
  }
  if (input.fields !== undefined) {
    if (!Array.isArray(input.fields) || !input.fields.every((f) => typeof f === "string")) {
      throw new ApiError("invalid", "fields must be an array of strings", { fields: "Invalid fields" });
    }
    const names = input.fields as string[];
    const unknown = names.find((n) => !(ALL_CARD_FIELDS as readonly string[]).includes(n));
    if (unknown !== undefined) {
      throw new ApiError("invalid", `unknown field name: ${unknown}`, { fields: "Unknown field name" });
    }
    const parsedFields = parseCardFields(names.join(","));
    out.fields = ALL_CARD_FIELDS.filter((f) => parsedFields[f]);
  }
  if (input.accent !== undefined) {
    if (typeof input.accent !== "string") {
      throw new ApiError("invalid", "accent must be a string", { accent: "Invalid accent" });
    }
    const parsed = parseAccent(input.accent);
    if (parsed === null) throw new ApiError("invalid", "accent must be a hex color", { accent: "Invalid accent" });
    out.accent = parsed;
  }
  return out;
}

export const embedsRoutes = new Hono<AppEnv>();

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

async function assertEventOwnership(db: Db, eventId: string, orgId: string) {
  const eventOrgId = await getEventOrgId(db, eventId);
  if (!eventOrgId) throw new ApiError("not_found", "Event not found");
  if (eventOrgId !== orgId) throw new ApiError("forbidden", "Event belongs to a different org");
}

// GET /api/v1/events/:eventId/embeds
embedsRoutes.get("/events/:eventId/embeds", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  const [items, total] = await Promise.all([
    listEmbeds(c.var.db, eventId, { limit: perPage, offset: (page - 1) * perPage }),
    countEmbeds(c.var.db, eventId),
  ]);
  return c.json({ items, total, page, perPage });
});

interface CreateEmbedBody {
  name?: unknown;
  surface?: unknown;
  format?: unknown;
  options?: unknown;
}

// POST /api/v1/events/:eventId/embeds
embedsRoutes.post("/events/:eventId/embeds", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = (await readOptionalJsonBody(c)) as unknown as CreateEmbedBody;
  const name = parseBoundedText(body.name, "name", { max: MAX_NAME_LENGTH, required: true }); // DEC-417

  if (typeof body.surface !== "string" || !isSurface(body.surface)) {
    throw new ApiError("invalid", "surface must be a known public surface", { surface: "Unknown surface" });
  }
  if (typeof body.format !== "string" || !(EMBED_FORMATS as readonly string[]).includes(body.format)) {
    throw new ApiError("invalid", "format must be a known embed format", { format: "Unknown format" });
  }
  const options = await parseEmbedOptionsInput(c.var.db, eventId, body.options);

  const embed = await createEmbed(
    c.var.db,
    auth.orgId,
    eventId,
    name,
    body.surface,
    body.format,
    JSON.stringify(options),
  );
  return c.json(embed, 201);
});

interface UpdateEmbedBody {
  name?: unknown;
  surface?: unknown;
  format?: unknown;
  options?: unknown;
  enabled?: unknown;
}

// PATCH /api/v1/embeds/:id — DEC-822: the builder's primary Save action
// PATCHes the FULL recipe (surface/format/options), not just name/enabled,
// so a saved embed's filters can be edited later instead of frozen at
// creation. Same validation POST already runs (isSurface, EMBED_FORMATS,
// object-shaped options) so a PATCH can never leave a row in a shape POST
// itself would have rejected.
embedsRoutes.patch("/embeds/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getEmbedOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Embed not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Embed belongs to a different org");

  const body = (await readOptionalJsonBody(c)) as unknown as UpdateEmbedBody;
  const patch: { name?: string; surface?: string; format?: string; optionsJson?: string; enabled?: boolean } = {};
  if (body.name !== undefined) {
    patch.name = parseBoundedText(body.name, "name", { max: MAX_NAME_LENGTH, required: true });
  }
  if (body.surface !== undefined) {
    if (typeof body.surface !== "string" || !isSurface(body.surface)) {
      throw new ApiError("invalid", "surface must be a known public surface", { surface: "Unknown surface" });
    }
    patch.surface = body.surface;
  }
  if (body.format !== undefined) {
    if (typeof body.format !== "string" || !(EMBED_FORMATS as readonly string[]).includes(body.format)) {
      throw new ApiError("invalid", "format must be a known embed format", { format: "Unknown format" });
    }
    patch.format = body.format;
  }
  if (body.options !== undefined) {
    patch.optionsJson = JSON.stringify(await parseEmbedOptionsInput(c.var.db, ownership.eventId, body.options));
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      throw new ApiError("invalid", "enabled must be a boolean", { enabled: "Must be true or false" });
    }
    patch.enabled = body.enabled;
  }

  const embed = await updateEmbed(c.var.db, id, patch);
  if (!embed) throw new ApiError("not_found", "Embed not found");
  return c.json(embed);
});

// DELETE /api/v1/embeds/:id
embedsRoutes.delete("/embeds/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getEmbedOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Embed not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Embed belongs to a different org");

  await deleteEmbed(c.var.db, id);
  return c.json({ deleted: true });
});
