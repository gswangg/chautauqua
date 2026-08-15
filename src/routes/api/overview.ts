// Overview worklist API (DEC-030). Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012). Handler stays thin:
// parse/authz -> repo function -> response.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { getEventOrgId } from "../../server/repo/submissions";
import { getOverviewPayload } from "../../server/repo/overview";

export const overviewRoutes = new Hono<AppEnv>();

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

// GET /api/v1/events/:eventId/overview
overviewRoutes.get("/events/:eventId/overview", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");

  const eventOrgId = await getEventOrgId(c.var.db, eventId);
  if (!eventOrgId) throw new ApiError("not_found", "Event not found");
  if (eventOrgId !== auth.orgId) throw new ApiError("not_found", "Event not found");

  const payload = await getOverviewPayload(c.var.db, eventId, Date.now());
  return c.json(payload);
});
