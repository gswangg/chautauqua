// GET /api/v1/events/:eventId/export/:kind?format=csv|json — DEC-027
// canonical exports surface (distinct from the DEC-018 plan-results CSV).
// Organizer-only, object-level event ownership check, attachment
// disposition. Route files export a named Hono sub-app; only src/index.ts
// mounts it (DEC-012).

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as schema from "../../db/schema";
import { toCsv } from "../../lib/csv";
import { buildExport, isExportKind } from "../../server/repo/exports";
import { DEC_011, DEC_025, DEC_027 } from "../../decisions";

void DEC_011;
void DEC_025;
void DEC_027;

export const exportsRoutes = new Hono<AppEnv>();

exportsRoutes.get("/api/v1/events/:eventId/export/:kind", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const kind = c.req.param("kind");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  if (!isExportKind(kind)) {
    throw new ApiError("invalid", `Unknown export kind '${kind}'`);
  }

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

  const format = (c.req.query("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "json") {
    throw new ApiError("invalid", "format must be 'csv' or 'json'");
  }

  const table = await buildExport(c.var.db, eventId, kind);

  if (format === "json") {
    c.header("Content-Disposition", `attachment; filename="${kind}.json"`);
    return c.json(table.records);
  }

  const csv = toCsv([table.header, ...table.rows]);
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${kind}.csv"`);
  return c.body(csv);
});
