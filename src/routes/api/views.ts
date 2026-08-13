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
import { clampPage, listPerPage } from "../../lib/pagination";
import {
  countSavedViews,
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

  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  const [items, total] = await Promise.all([
    listSavedViews(c.var.db, eventId, auth.userId, { limit: perPage, offset: (page - 1) * perPage }),
    countSavedViews(c.var.db, eventId, auth.userId),
  ]);
  return c.json({ items, total, page, perPage });
});

interface CreateViewBody {
  name?: unknown;
  config?: unknown;
  shared?: unknown;
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
  // DEC-904: shared is required and author-controlled from the body, not
  // defaulted -- an absent/non-boolean value is a caller bug and fails
  // loudly rather than silently sharing (or hiding) the view.
  if (typeof body.shared !== "boolean") {
    throw new ApiError("invalid", "shared must be a boolean", {
      shared: "Invalid saved view configuration",
    });
  }

  // DEC-904: the author is always the authenticated caller, never a value
  // supplied in the body.
  const view = await createSavedView(c.var.db, eventId, name, body.config, auth.userId, body.shared);
  return c.json(view, 201);
});

// DELETE /api/v1/views/:id
viewsRoutes.delete("/views/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSavedViewOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Saved view not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Saved view belongs to a different org");

  // DEC-975: the delete gate matches the DEC-904 read gate. A row with
  // createdByUserId === null is legacy org-owned (pre-DEC-904) -- any
  // organiser in the org may delete it, so that branch falls through below
  // unconditionally rather than by accident of a null comparison.
  if (ownership.createdByUserId !== null && ownership.createdByUserId !== auth.userId) {
    if (!ownership.shared) {
      // Private and not authored by this caller: DEC-904 says it's not
      // visible to them at all, so a 403 here would confirm its existence.
      throw new ApiError("not_found", "Saved view not found");
    }
    throw new ApiError("forbidden", "Only the organiser who created a saved view can delete it");
  }

  await deleteSavedView(c.var.db, id, ownership.eventId);
  return c.json({ deleted: true });
});
