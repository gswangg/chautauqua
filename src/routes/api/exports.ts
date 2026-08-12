// GET /api/v1/events/:eventId/export/:kind?format=csv|json — DEC-027
// canonical exports surface (distinct from the DEC-018 plan-results CSV).
// GET /api/v1/events/:eventId/exports/showflow.csv — DEC-055 show-flow
// export, a separate fixed-column surface on its own route.
// Organizer-only, object-level event ownership check, attachment
// disposition. Route files export a named Hono sub-app; only src/index.ts
// mounts it (DEC-012).

import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as schema from "../../db/schema";
import { toCsv } from "../../lib/csv";
import { buildExport, buildShowflowExport, isExportKind } from "../../server/repo/exports";
import { DEC_011, DEC_025, DEC_027, DEC_055 } from "../../decisions";

void DEC_011;
void DEC_025;
void DEC_027;
void DEC_055;

export const exportsRoutes = new Hono<AppEnv>();

// Object-level ownership check shared by both export surfaces below: the
// event must belong to the caller's org. Returns the event's orgId (DEC-597:
// the 'contacts' kind is org-scoped, and this is where that org id is
// resolved — the caller's own orgId, already proven to match).
async function requireOwnedEvent(c: Context<AppEnv>, eventId: string): Promise<string> {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const eventRows = await c.var.db
    .select({ id: schema.event.id, orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const eventRow = eventRows[0];
  if (!eventRow || eventRow.orgId !== auth.orgId) {
    throw new ApiError("not_found", "Event not found");
  }
  return eventRow.orgId;
}

// DEC-055: distinct route prefix ('/exports/', singular file) from the
// DEC-027 kinds below ('/export/:kind') per the decision doc's exact path.
exportsRoutes.get("/api/v1/events/:eventId/exports/showflow.csv", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);

  const table = await buildShowflowExport(c.var.db, eventId);
  const csv = toCsv([table.header, ...table.rows]);
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="showflow.csv"');
  return c.body(csv);
});

exportsRoutes.get("/api/v1/events/:eventId/export/:kind", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const kind = c.req.param("kind");

  if (!isExportKind(kind)) {
    throw new ApiError("invalid", `Unknown export kind '${kind}'`);
  }

  const orgId = await requireOwnedEvent(c, eventId);

  const format = (c.req.query("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "json") {
    throw new ApiError("invalid", "format must be 'csv' or 'json'");
  }

  const table = await buildExport(c.var.db, eventId, kind, orgId);

  if (format === "json") {
    c.header("Content-Disposition", `attachment; filename="${kind}.json"`);
    return c.json(table.records);
  }

  const csv = toCsv([table.header, ...table.rows]);
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${kind}.csv"`);
  return c.body(csv);
});
