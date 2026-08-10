// J5 compose pipeline (DEC-019): templates CRUD + atomic preview/send.
// Route file exports a named Hono<AppEnv> sub-app; only src/index.ts mounts
// it (DEC-012). Every endpoint is organizer-only + csrfJson on mutations.

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { csrfJson, requireOrganizer } from "../server/middleware";
import { ApiError } from "../server/http";
import * as repo from "../server/repo/comms";
import { getEventForOrg } from "../server/repo/events";
import { createClaimToken, type KVStore } from "../auth/claim";
import {
  buildMergeVars,
  expandRecipients,
  preflightRender,
  type ComposeSubmission,
} from "../domain/compose";

export const commsRoutes = new Hono<AppEnv>();

async function requireOwnedEvent(c: { var: { db: import("../server/context").Db; auth?: { orgId: string } } }, eventId: string) {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const event = await getEventForOrg(c.var.db, eventId, auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");
  return event;
}

function serializeTemplate(t: repo.EmailTemplateRow) {
  return { id: t.id, eventId: t.eventId, name: t.name, subject: t.subject, bodyText: t.bodyText };
}

// ---------------------------------------------------------------------------
// Templates CRUD (DEC-019)
// ---------------------------------------------------------------------------

commsRoutes.get("/api/v1/events/:eventId/templates", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const items = await repo.listTemplates(c.var.db, eventId);
  return c.json({ items: items.map(serializeTemplate), total: items.length, page: 1, perPage: items.length || 1 });
});

commsRoutes.post("/api/v1/events/:eventId/templates", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });

  const errors: Record<string, string> = {};
  if (typeof body.name !== "string" || body.name.trim() === "") errors.name = "required";
  if (typeof body.subject !== "string" || body.subject.trim() === "") errors.subject = "required";
  if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") errors.bodyText = "required";
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Validation failed", errors);

  const created = await repo.createTemplate(c.var.db, eventId, {
    name: body.name,
    subject: body.subject,
    bodyText: body.bodyText,
  });
  return c.json(serializeTemplate(created), 201);
});

commsRoutes.patch("/api/v1/templates/:templateId", requireOrganizer, csrfJson, async (c) => {
  const templateId = c.req.param("templateId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const existing = await repo.findTemplateForOrg(c.var.db, templateId, auth.orgId);
  if (!existing) throw new ApiError("not_found", "Template not found");

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });

  const errors: Record<string, string> = {};
  const patch: repo.TemplatePatch = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") errors.name = "must be a non-empty string";
    else patch.name = body.name;
  }
  if (body.subject !== undefined) {
    if (typeof body.subject !== "string" || body.subject.trim() === "") errors.subject = "must be a non-empty string";
    else patch.subject = body.subject;
  }
  if (body.bodyText !== undefined) {
    if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") errors.bodyText = "must be a non-empty string";
    else patch.bodyText = body.bodyText;
  }
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Validation failed", errors);

  const updated = await repo.patchTemplate(c.var.db, templateId, patch);
  return c.json(serializeTemplate(updated));
});

commsRoutes.delete("/api/v1/templates/:templateId", requireOrganizer, csrfJson, async (c) => {
  const templateId = c.req.param("templateId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const existing = await repo.findTemplateForOrg(c.var.db, templateId, auth.orgId);
  if (!existing) throw new ApiError("not_found", "Template not found");

  await repo.deleteTemplate(c.var.db, templateId);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Compose: preview / send (DEC-019)
// ---------------------------------------------------------------------------

interface ComposeBody {
  templateId?: string;
  subject?: string;
  bodyText?: string;
  submissionIds: string[];
  includeFeedback?: boolean;
}

async function resolveComposeInput(
  c: { var: { db: import("../server/context").Db; auth?: { orgId: string } } },
  eventId: string,
  body: unknown,
): Promise<{ subjectTemplate: string; bodyTemplate: string; submissionIds: string[]; includeFeedback: boolean }> {
  const b = body as Partial<ComposeBody> | null;
  if (!b || typeof b !== "object") throw new ApiError("invalid", "Invalid JSON body");

  if (!Array.isArray(b.submissionIds) || b.submissionIds.length === 0 || !b.submissionIds.every((id) => typeof id === "string")) {
    throw new ApiError("invalid", "Validation failed", { submissionIds: "must be a non-empty array of submission ids" });
  }

  let subjectTemplate: string;
  let bodyTemplate: string;
  if (b.templateId !== undefined) {
    const auth = c.var.auth;
    if (!auth) throw new ApiError("unauthorized", "Login required");
    const template = await repo.findTemplateForOrg(c.var.db, b.templateId, auth.orgId);
    if (!template || template.eventId !== eventId) throw new ApiError("not_found", "Template not found");
    subjectTemplate = template.subject;
    bodyTemplate = template.bodyText;
  } else {
    if (typeof b.subject !== "string" || typeof b.bodyText !== "string") {
      throw new ApiError("invalid", "Validation failed", {
        templateId: "provide templateId, or both subject and bodyText",
      });
    }
    subjectTemplate = b.subject;
    bodyTemplate = b.bodyText;
  }

  return {
    subjectTemplate,
    bodyTemplate,
    submissionIds: b.submissionIds,
    includeFeedback: b.includeFeedback === true,
  };
}

/** portal_link (DEC-014/DEC-019): /portal when a user exists for the
 * contact's email, else a freshly minted claim link. */
async function resolvePortalLink(
  db: import("../server/context").Db,
  kv: KVStore,
  contactId: string,
  eventId: string,
  email: string,
): Promise<string> {
  const userId = await repo.findUserIdByEmail(db, email);
  if (userId) return "/portal";
  const token = await createClaimToken(kv, { contactId, eventId });
  return `/claim/${token}`;
}

async function buildRenderTargets(
  c: { var: { db: import("../server/context").Db; auth?: { orgId: string } }; env: { KV: KVNamespace } },
  event: { id: string; name: string },
  submissions: ComposeSubmission[],
  includeFeedback: boolean,
) {
  const expanded = expandRecipients(submissions);
  if (!expanded.ok) throw new ApiError("invalid", expanded.message);

  const submissionById = new Map(submissions.map((s) => [s.id, s]));
  const kv = c.env.KV as unknown as KVStore;

  const targets = [];
  for (const recipient of expanded.recipients) {
    const submission = submissionById.get(recipient.submissionId);
    if (!submission) throw new Error(`recipient references unknown submission ${recipient.submissionId}`);
    const feedbackComments = includeFeedback ? await repo.listFeedbackComments(c.var.db, recipient.submissionId) : [];
    const portalLink = await resolvePortalLink(c.var.db, kv, recipient.contactId, event.id, recipient.email);
    const vars = buildMergeVars({
      speakerName: recipient.name,
      talkTitle: submission.title,
      eventName: event.name,
      portalLink,
      feedbackComments,
    });
    targets.push({
      contactId: recipient.contactId,
      submissionId: recipient.submissionId,
      email: recipient.email,
      name: recipient.name,
      vars,
    });
  }
  return targets;
}

commsRoutes.post("/api/v1/events/:eventId/compose/preview", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });
  const input = await resolveComposeInput(c, eventId, body);

  const submissions = await repo.loadComposeSubmissions(c.var.db, eventId, input.submissionIds);
  const targets = await buildRenderTargets(c, event, submissions, input.includeFeedback);

  const result = preflightRender(targets, input.subjectTemplate, input.bodyTemplate);
  if (!result.ok) {
    throw new ApiError("invalid", "One or more recipients are missing merge fields", missingToFields(result.missing));
  }

  return c.json({ items: result.rendered });
});

commsRoutes.post("/api/v1/events/:eventId/compose/send", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });
  const input = await resolveComposeInput(c, eventId, body);

  const submissions = await repo.loadComposeSubmissions(c.var.db, eventId, input.submissionIds);
  const targets = await buildRenderTargets(c, event, submissions, input.includeFeedback);

  // Atomic preflight (DEC-019): every recipient must render BEFORE the first
  // send is attempted. Only once every recipient renders do we start sending.
  const result = preflightRender(targets, input.subjectTemplate, input.bodyTemplate);
  if (!result.ok) {
    throw new ApiError("invalid", "One or more recipients are missing merge fields", missingToFields(result.missing));
  }

  const templateId = typeof body.templateId === "string" ? body.templateId : undefined;
  const { makeMailer } = await import("../server/context");
  const mailer = makeMailer(c.var.db);
  for (const rendered of result.rendered) {
    await mailer.send({
      to: { email: rendered.email, name: rendered.name },
      subject: rendered.subject,
      text: rendered.text,
      html: `<p>${rendered.text.replace(/\n/g, "<br/>")}</p>`,
      templateId,
      eventId,
      contactId: rendered.contactId,
    });
  }

  return c.json({ sent: result.rendered.length, items: result.rendered });
});

function missingToFields(missing: { contactId: string; submissionId: string; field: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const m of missing) {
    fields[`${m.contactId}:${m.submissionId}`] = `missing merge field '${m.field}'`;
  }
  return fields;
}

// Email log history: GET /api/v1/events/:eventId/email-log already landed on
// main (w2-i) at src/routes/api/email-log.ts, mounted separately in
// src/index.ts — not duplicated here (the task's contingency clause only
// applies if that route were missing). This file extends its repo function
// (listEmailLog, src/server/repo/email.ts) with the ?q filter the HistoryTab
// needs; see that route file for the endpoint itself.
