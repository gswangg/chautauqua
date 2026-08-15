// Public surfaces count API (DEC-767). Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012). Handler stays thin:
// authz -> repo function -> response. Organizer-only, event-scoped —
// mirrors src/routes/api/overview.ts's ownership-check shape.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { getEventOrgId } from "../../server/repo/submissions";
import { getPublicSurfaceCounts } from "../../server/repo/public/counts";

export const publicSurfacesRoutes = new Hono<AppEnv>();

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

// GET /api/v1/events/:eventId/public-surfaces
publicSurfacesRoutes.get("/events/:eventId/public-surfaces", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");

  const eventOrgId = await getEventOrgId(c.var.db, eventId);
  if (!eventOrgId) throw new ApiError("not_found", "Event not found");
  if (eventOrgId !== auth.orgId) throw new ApiError("not_found", "Event not found");

  const counts = await getPublicSurfaceCounts(c.var.db, eventId);
  return c.json(counts);
});
