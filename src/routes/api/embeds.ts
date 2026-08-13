// Saved embeds API (DEC-785). Route files export a named Hono sub-app; only
// src/index.ts mounts it (DEC-012). Handlers stay thin: parse/authz -> repo
// function -> response.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import type { Db } from "../../server/context";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError, parseBoundedText } from "../../server/http";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { getEventOrgId } from "../../server/repo/submissions";
import { clampPage, listPerPage } from "../../lib/pagination";
import { isSurface } from "../public/shell";
import { EMBED_FORMATS } from "../../lib/embed-formats";
import { DEC_785 } from "../../decisions";
import {
  countEmbeds,
  createEmbed,
  deleteEmbed,
  getEmbedOwnership,
  listEmbeds,
  updateEmbed,
} from "../../server/repo/embeds";

void DEC_785;

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

  const body = (await c.req.json().catch(() => ({}))) as CreateEmbedBody;
  const name = parseBoundedText(body.name, "name", { max: MAX_NAME_LENGTH, required: true }); // DEC-417

  if (typeof body.surface !== "string" || !isSurface(body.surface)) {
    throw new ApiError("invalid", "surface must be a known public surface", { surface: "Unknown surface" });
  }
  if (typeof body.format !== "string" || !(EMBED_FORMATS as readonly string[]).includes(body.format)) {
    throw new ApiError("invalid", "format must be a known embed format", { format: "Unknown format" });
  }
  const options = body.options !== undefined && body.options !== null ? body.options : {};
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new ApiError("invalid", "options must be an object", { options: "Invalid options" });
  }

  const embed = await createEmbed(c.var.db, auth.orgId, eventId, name, body.surface, body.format, JSON.stringify(options));
  return c.json(embed, 201);
});

interface UpdateEmbedBody {
  name?: unknown;
  enabled?: unknown;
}

// PATCH /api/v1/embeds/:id
embedsRoutes.patch("/embeds/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getEmbedOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Embed not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Embed belongs to a different org");

  const body = (await c.req.json().catch(() => ({}))) as UpdateEmbedBody;
  const patch: { name?: string; enabled?: boolean } = {};
  if (body.name !== undefined) {
    patch.name = parseBoundedText(body.name, "name", { max: MAX_NAME_LENGTH, required: true });
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
