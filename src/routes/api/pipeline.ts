// CRM sourcing pipeline API (CRM-07/08, DEC-157). Route file exports a named
// Hono<AppEnv> sub-app; only src/index.ts mounts it (DEC-012). Every
// endpoint is organizer-only + csrfJson on mutations, org-scoped via
// auth.orgId, with object-level ownership checks on every :id lookup (no
// IDOR). This module must never import a mailer — pipeline moves/notes
// never send email (product principle 4).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as repo from "../../server/repo/pipeline";
import { findContactForOrg } from "../../server/repo/contacts";
import { clampPage, clampPerPage } from "../../lib/pagination";

export const pipelineRoutes = new Hono<AppEnv>();

pipelineRoutes.use("/pipeline", requireOrganizer);
pipelineRoutes.use("/pipeline/*", requireOrganizer);

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

function serializeEntry(row: repo.PipelineListItem) {
  return {
    id: row.id,
    contactId: row.contactId,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    email: row.email,
    stage: row.stage,
    updatedAt: row.updatedAt,
  };
}

function serializeActivity(row: repo.PipelineActivityRow) {
  return {
    kind: row.kind,
    body: row.body,
    fromStage: row.fromStage,
    toStage: row.toStage,
    authorName: row.authorName,
    createdAt: row.createdAt,
  };
}

async function requireOwnedEntry(c: { var: { db: AppEnv["Variables"]["db"] } }, id: string, orgId: string) {
  const entry = await repo.findEntryForOrg(c.var.db, id, orgId);
  if (!entry) throw new ApiError("not_found", "Pipeline entry not found");
  return entry;
}

pipelineRoutes.get("/pipeline", async (c) => {
  const orgId = currentOrgId(c);
  const page = clampPage(c.req.query("page"));
  const perPage = clampPerPage(c.req.query("perPage") ?? 200);
  const [items, total] = await Promise.all([
    repo.listPipelineForOrg(c.var.db, orgId, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countPipelineForOrg(c.var.db, orgId),
  ]);
  return c.json({ items: items.map(serializeEntry), total, page, perPage });
});

pipelineRoutes.post("/pipeline", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const auth = c.var.auth!;
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.contactId !== "string" || body.contactId.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { contactId: "required" });
  }
  const stage = body.stage === undefined ? "identified" : body.stage;
  if (!repo.isPipelineStage(stage)) {
    throw new ApiError("invalid", "Validation failed", { stage: `must be one of ${repo.PIPELINE_STAGES.join(", ")}` });
  }

  const contact = await findContactForOrg(c.var.db, body.contactId, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");

  const existing = await repo.findEntryByContact(c.var.db, orgId, contact.id);
  if (existing) throw new ApiError("invalid", "Contact is already enrolled in the pipeline", { contactId: "already enrolled" });

  const authorName = await repo.resolveAuthorName(c.var.db, auth.userId);
  const entry = await repo.enrollContact(c.var.db, orgId, contact.id, stage, { userId: auth.userId, name: authorName });

  return c.json(
    serializeEntry({
      id: entry.id,
      contactId: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      email: contact.email,
      stage: entry.stage,
      updatedAt: entry.updatedAt,
    }),
    201,
  );
});

pipelineRoutes.get("/pipeline/:id", async (c) => {
  const orgId = currentOrgId(c);
  const entry = await requireOwnedEntry(c, c.req.param("id"), orgId);
  const contact = await findContactForOrg(c.var.db, entry.contactId, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");
  const activity = await repo.listActivityForEntry(c.var.db, entry.id);

  return c.json({
    entry: {
      id: entry.id,
      contactId: entry.contactId,
      stage: entry.stage,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
    contact: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      email: contact.email,
    },
    activity: activity.map(serializeActivity),
  });
});

pipelineRoutes.patch("/pipeline/:id", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const auth = c.var.auth!;
  const entry = await requireOwnedEntry(c, c.req.param("id"), orgId);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (!repo.isPipelineStage(body.stage)) {
    throw new ApiError("invalid", "Validation failed", { stage: `must be one of ${repo.PIPELINE_STAGES.join(", ")}` });
  }

  const authorName = await repo.resolveAuthorName(c.var.db, auth.userId);
  const updated = await repo.moveEntry(c.var.db, entry, body.stage, { userId: auth.userId, name: authorName });

  const contact = await findContactForOrg(c.var.db, updated.contactId, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");

  return c.json(
    serializeEntry({
      id: updated.id,
      contactId: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      email: contact.email,
      stage: updated.stage,
      updatedAt: updated.updatedAt,
    }),
  );
});

pipelineRoutes.post("/pipeline/:id/notes", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const auth = c.var.auth!;
  const entry = await requireOwnedEntry(c, c.req.param("id"), orgId);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.body !== "string" || body.body.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { body: "required" });
  }

  const authorName = await repo.resolveAuthorName(c.var.db, auth.userId);
  const activity = await repo.addNote(c.var.db, entry, body.body, { userId: auth.userId, name: authorName });

  return c.json(serializeActivity(activity), 201);
});
