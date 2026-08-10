// Saved views API (J3 gaps, DEC-031). Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012). Handlers stay thin:
// parse/authz -> repo function -> response.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import type { Db } from "../../server/context";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { getEventOrgId } from "../../server/repo/submissions";
import {
  createSavedView,
  deleteSavedView,
  getSavedViewOwnership,
  isValidSavedViewConfig,
  listSavedViews,
} from "../../server/repo/views";

export const viewsRoutes = new Hono<AppEnv>();

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

// GET /api/v1/events/:eventId/views
viewsRoutes.get("/events/:eventId/views", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const items = await listSavedViews(c.var.db, eventId);
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1 });
});

interface CreateViewBody {
  name?: unknown;
  config?: unknown;
}

// POST /api/v1/events/:eventId/views
viewsRoutes.post("/events/:eventId/views", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = (await c.req.json().catch(() => ({}))) as CreateViewBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    throw new ApiError("invalid", "Name is required", { name: "Required" });
  }
  if (!isValidSavedViewConfig(body.config)) {
    throw new ApiError("invalid", "config must match the DEC-031 saved view shape", {
      config: "Invalid saved view configuration",
    });
  }

  const view = await createSavedView(c.var.db, eventId, name, body.config);
  return c.json(view, 201);
});

// DELETE /api/v1/views/:id
viewsRoutes.delete("/views/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSavedViewOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Saved view not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Saved view belongs to a different org");

  await deleteSavedView(c.var.db, id, ownership.eventId);
  return c.json({ deleted: true });
});
