// Templates CRUD (DEC-019). Split out of the former monolithic
// src/routes/comms.ts — no behavior change.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError, requireAtLeastOneField } from "../../server/http";
import * as repo from "../../server/repo/comms";
import { listTemplateLastUsedAt } from "../../server/repo/email";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_RICH_TEXT_LENGTH } from "../../forms/validate"; // DEC-417
import { overCapFieldMessage } from "../../domain/cap-copy";
import { clampPage, listPerPage } from "../../lib/pagination";
import { requireOwnedEvent } from "./shared";

export function serializeTemplate(t: repo.EmailTemplateRow, lastUsedAt: number | null = null) {
  return { id: t.id, eventId: t.eventId, name: t.name, subject: t.subject, bodyText: t.bodyText, lastUsedAt };
}

export const templatesRoutes = new Hono<AppEnv>();

templatesRoutes.get("/api/v1/events/:eventId/templates", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  // DEC-890: one grouped query for the whole event's last-used-at map,
  // joined onto this page's rows in memory -- never a per-row query.
  const [items, total, lastUsedAt] = await Promise.all([
    repo.listTemplates(c.var.db, eventId, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countTemplates(c.var.db, eventId),
    listTemplateLastUsedAt(c.var.db, eventId),
  ]);
  return c.json({ items: items.map((t) => serializeTemplate(t, lastUsedAt.get(t.id) ?? null)), total, page, perPage });
});

templatesRoutes.post("/api/v1/events/:eventId/templates", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });

  const errors: Record<string, string> = {};
  if (typeof body.name !== "string" || body.name.trim() === "") errors.name = "required";
  else if (body.name.length > MAX_NAME_LENGTH) errors.name = overCapFieldMessage(body.name.length, MAX_NAME_LENGTH); // DEC-417
  if (typeof body.subject !== "string" || body.subject.trim() === "") errors.subject = "required";
  else if (body.subject.length > MAX_TEXT_LENGTH) errors.subject = overCapFieldMessage(body.subject.length, MAX_TEXT_LENGTH); // DEC-417
  if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") errors.bodyText = "required";
  else if (body.bodyText.length > MAX_RICH_TEXT_LENGTH) errors.bodyText = overCapFieldMessage(body.bodyText.length, MAX_RICH_TEXT_LENGTH); // DEC-417
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Validation failed", errors);

  const created = await repo.createTemplate(c.var.db, eventId, {
    name: body.name,
    subject: body.subject,
    bodyText: body.bodyText,
  });
  return c.json(serializeTemplate(created), 201);
});

templatesRoutes.patch("/api/v1/templates/:templateId", requireOrganizer, csrfJson, async (c) => {
  const templateId = c.req.param("templateId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const existing = await repo.findTemplateForOrg(c.var.db, templateId, auth.orgId);
  if (!existing) throw new ApiError("not_found", "Template not found");

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });
  // DEC-627 (amendment, wave 6): all three fields are optional; an empty
  // body must be refused rather than reaching patchTemplate as a no-op.
  requireAtLeastOneField(body, ["name", "subject", "bodyText"]);

  const errors: Record<string, string> = {};
  const patch: repo.TemplatePatch = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") errors.name = "must be a non-empty string";
    else if (body.name.length > MAX_NAME_LENGTH) errors.name = overCapFieldMessage(body.name.length, MAX_NAME_LENGTH); // DEC-417
    else patch.name = body.name;
  }
  if (body.subject !== undefined) {
    if (typeof body.subject !== "string" || body.subject.trim() === "") errors.subject = "must be a non-empty string";
    else if (body.subject.length > MAX_TEXT_LENGTH) errors.subject = overCapFieldMessage(body.subject.length, MAX_TEXT_LENGTH); // DEC-417
    else patch.subject = body.subject;
  }
  if (body.bodyText !== undefined) {
    if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") errors.bodyText = "must be a non-empty string";
    else if (body.bodyText.length > MAX_RICH_TEXT_LENGTH) errors.bodyText = overCapFieldMessage(body.bodyText.length, MAX_RICH_TEXT_LENGTH); // DEC-417
    else patch.bodyText = body.bodyText;
  }
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Validation failed", errors);

  const updated = await repo.patchTemplate(c.var.db, templateId, patch);
  return c.json(serializeTemplate(updated));
});

templatesRoutes.delete("/api/v1/templates/:templateId", requireOrganizer, csrfJson, async (c) => {
  const templateId = c.req.param("templateId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const existing = await repo.findTemplateForOrg(c.var.db, templateId, auth.orgId);
  if (!existing) throw new ApiError("not_found", "Template not found");

  await repo.deleteTemplate(c.var.db, templateId);
  return c.json({ ok: true });
});
