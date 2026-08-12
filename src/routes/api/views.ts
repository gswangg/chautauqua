// Saved views API (J3 gaps, DEC-031). Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012). Handlers stay thin:
// parse/authz -> repo function -> response.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import type { Db } from "../../server/context";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError, parseBoundedText } from "../../server/http";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { getEventOrgId } from "../../server/repo/submissions";
import { clampPage, clampPerPage, MAX_PER_PAGE } from "../../lib/pagination";
import {
  countSavedViews,
  createSavedView,
  deleteSavedView,
  getSavedViewOwnership,
  isValidSavedViewConfig,
  listSavedViews,
} from "../../server/repo/views";

// DEC-460/DEC-461: this list previously returned every row unbounded. The
// site default here is 200 (not clampPerPage's own 50) — both an absent and
// an invalid perPage query param resolve to 200; only an explicit valid
// value gets clampPerPage's normal [1, MAX_PER_PAGE] clamp.
function perPageWithDefault200(raw: string | undefined): number {
  if (raw === undefined) return MAX_PER_PAGE;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return MAX_PER_PAGE;
  return clampPerPage(raw);
}

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

  const page = clampPage(c.req.query("page"));
  const perPage = perPageWithDefault200(c.req.query("perPage"));
  const [items, total] = await Promise.all([
    listSavedViews(c.var.db, eventId, { limit: perPage, offset: (page - 1) * perPage }),
    countSavedViews(c.var.db, eventId),
  ]);
  return c.json({ items, total, page, perPage });
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
  const name = parseBoundedText(body.name, "name", { max: MAX_NAME_LENGTH, required: true }); // DEC-417
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
