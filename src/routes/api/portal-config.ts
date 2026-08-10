// Portal settings + resources API (w4-h). Organizer-only, per DEC-005/
// DEC-012/DEC-013/DEC-032. Route file exports a sub-app; only src/index.ts
// mounts it. Resource creation via this API is kind='wiki' only — file-kind
// resources need w3-f's upload plumbing (later wave) per DEC-029.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { getEventForOrg } from "../../server/repo/events";
import {
  createWikiResource,
  deleteResource,
  getPortalSettingsForEvent,
  listResourcesForEvent,
  resourceEventId,
  updateWikiResource,
  upsertPortalSettings,
} from "../../server/repo/portal-config";
import { isValidHexColor } from "./validators";

export const portalConfigRoutes = new Hono<AppEnv>();

portalConfigRoutes.use("*", requireOrganizer);

function currentOrgId(c: { var: { auth?: { orgId: string } } }): string {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth.orgId;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("invalid", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

/** Resolves an event by id and asserts it belongs to orgId — 404 on any mismatch (no IDOR). */
async function requireEvent(
  db: import("../../server/context").Db,
  orgId: string,
  eventId: string,
): Promise<Awaited<ReturnType<typeof getEventForOrg>>> {
  const event = await getEventForOrg(db, eventId, orgId);
  if (!event) throw new ApiError("not_found", "Event not found");
  return event;
}

// ---------------------------------------------------------------------------
// Portal settings (single row per event, upsert)
// ---------------------------------------------------------------------------

portalConfigRoutes.get("/events/:eventId/portal-settings", async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);
  const settings = await getPortalSettingsForEvent(c.var.db, eventId);
  return c.json(
    settings ?? {
      id: null,
      eventId,
      logoUrl: null,
      accentColor: null,
      welcomeMessage: null,
      showResources: true,
      createdAt: null,
      updatedAt: null,
    },
  );
});

portalConfigRoutes.put("/events/:eventId/portal-settings", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);

  const body = asRecord(await c.req.json());
  const fields: Record<string, string> = {};

  const logoUrl = body.logoUrl;
  if (logoUrl !== undefined && logoUrl !== null && typeof logoUrl !== "string") {
    fields.logoUrl = "Must be a string";
  }

  const accentColor = body.accentColor;
  if (accentColor !== undefined && accentColor !== null) {
    if (typeof accentColor !== "string" || !isValidHexColor(accentColor)) {
      fields.accentColor = "Must be a hex color like #336699";
    }
  }

  const welcomeMessage = body.welcomeMessage;
  if (welcomeMessage !== undefined && welcomeMessage !== null && typeof welcomeMessage !== "string") {
    fields.welcomeMessage = "Must be a string";
  }

  const showResources = body.showResources;
  if (showResources !== undefined && typeof showResources !== "boolean") {
    fields.showResources = "Must be a boolean";
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid portal settings", fields);
  }

  const updated = await upsertPortalSettings(c.var.db, eventId, {
    logoUrl: logoUrl === undefined ? undefined : (logoUrl as string | null),
    accentColor: accentColor === undefined ? undefined : (accentColor as string | null),
    welcomeMessage: welcomeMessage === undefined ? undefined : (welcomeMessage as string | null),
    showResources: showResources === undefined ? undefined : (showResources as boolean),
  });
  return c.json(updated);
});

// ---------------------------------------------------------------------------
// Resources (wiki pages nested under events; PATCH/DELETE are top-level
// /resources/:id)
// ---------------------------------------------------------------------------

portalConfigRoutes.get("/events/:eventId/resources", async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);
  const items = await listResourcesForEvent(c.var.db, eventId);
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1 });
});

portalConfigRoutes.post("/events/:eventId/resources", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);

  const body = asRecord(await c.req.json());
  const fields: Record<string, string> = {};

  const title = body.title;
  if (typeof title !== "string" || title.trim().length === 0) {
    fields.title = "Required";
  }
  const content = body.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    fields.content = "Required";
  }
  const position = body.position;
  if (position !== undefined && (typeof position !== "number" || !Number.isInteger(position) || position < 0)) {
    fields.position = "Must be a non-negative integer";
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid resource", fields);
  }

  const created = await createWikiResource(c.var.db, eventId, {
    title: title as string,
    content: content as string,
    position: position as number | undefined,
  });
  return c.json(created, 201);
});

portalConfigRoutes.patch("/resources/:resourceId", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const resourceId = c.req.param("resourceId");
  const db = c.var.db;

  const eventId = await resourceEventId(db, resourceId);
  if (!eventId) throw new ApiError("not_found", "Resource not found");
  await requireEvent(db, orgId, eventId);

  const body = asRecord(await c.req.json());
  const fields: Record<string, string> = {};

  const title = body.title;
  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    fields.title = "Must be a non-empty string";
  }
  const content = body.content;
  if (content !== undefined && (typeof content !== "string" || content.trim().length === 0)) {
    fields.content = "Must be a non-empty string";
  }
  const position = body.position;
  if (position !== undefined && (typeof position !== "number" || !Number.isInteger(position) || position < 0)) {
    fields.position = "Must be a non-negative integer";
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid resource", fields);
  }

  const updated = await updateWikiResource(db, resourceId, eventId, {
    title: title as string | undefined,
    content: content as string | undefined,
    position: position as number | undefined,
  });
  return c.json(updated);
});

portalConfigRoutes.delete("/resources/:resourceId", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const resourceId = c.req.param("resourceId");
  const db = c.var.db;

  const eventId = await resourceEventId(db, resourceId);
  if (!eventId) throw new ApiError("not_found", "Resource not found");
  await requireEvent(db, orgId, eventId);

  await deleteResource(db, resourceId, eventId);
  return c.body(null, 204);
});
