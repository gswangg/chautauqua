// GET /api/v1/events/:eventId/email-log — J5 per-recipient comms history for
// the admin Comms screen. Organizer-only (DEC-013 default), DEC-013 list
// envelope { items, total, page, perPage }. Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { listEmailLog } from "../../server/repo/email";
import { clampPage, clampPerPage } from "../../lib/pagination";
import { ApiError } from "../../server/http";
import * as schema from "../../db/schema";

export const emailLogRoutes = new Hono<AppEnv>();

emailLogRoutes.get("/api/v1/events/:eventId/email-log", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  // Object-level ownership check: the event must belong to the caller's org.
  const eventRows = await c.var.db
    .select({ id: schema.event.id, orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const eventRow = eventRows[0];
  if (!eventRow || eventRow.orgId !== auth.orgId) {
    throw new ApiError("not_found", "Event not found");
  }

  const page = clampPage(c.req.query("page"));
  const perPage = clampPerPage(c.req.query("perPage"));
  const contactId = c.req.query("contactId") || undefined;
  const status = c.req.query("status") || undefined;

  const { items, total } = await listEmailLog(c.var.db, {
    eventId,
    contactId,
    status,
    page,
    perPage,
  });

  return c.json({ items, total, page, perPage });
});
