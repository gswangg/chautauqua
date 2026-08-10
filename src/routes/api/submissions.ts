// Submissions API (J3 backend, DEC-016 contract). Route files export a
// named Hono sub-app; only src/index.ts mounts it (DEC-012). Handlers stay
// thin: parse/authz -> repo function -> response.
//
// DEC-009 invariant #1: status changes never send email. This module MUST
// NEVER import a mailer — verified by a source-scan test in
// test/api-submissions.test.ts.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import type { Db } from "../../server/context";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError } from "../../server/http";
import {
  cloneSubmission,
  createSubmission,
  getEventOrgId,
  getSubmissionDetail,
  getSubmissionOwnership,
  isValidStatusLiteral,
  listSubmissions,
  parseListQuery,
  updateSubmissionStatuses,
} from "../../server/repo/submissions";

export const submissionsRoutes = new Hono<AppEnv>();

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

// GET /api/v1/events/:eventId/submissions
submissionsRoutes.get("/events/:eventId/submissions", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const raw = c.req.query();
  const parsed = parseListQuery(raw);
  const result = await listSubmissions(c.var.db, eventId, parsed);

  return c.json({
    items: result.items,
    total: result.total,
    page: parsed.page,
    perPage: parsed.perPage,
  });
});

// GET /api/v1/submissions/:id
submissionsRoutes.get("/submissions/:id", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

  const detail = await getSubmissionDetail(c.var.db, id);
  if (!detail) throw new ApiError("not_found", "Submission not found");
  return c.json(detail);
});

interface CreateSubmissionBody {
  title?: unknown;
  description?: unknown;
  contact?: { email?: unknown; firstName?: unknown; lastName?: unknown } | null;
}

// POST /api/v1/events/:eventId/submissions
submissionsRoutes.post("/events/:eventId/submissions", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = (await c.req.json().catch(() => ({}))) as CreateSubmissionBody;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    throw new ApiError("invalid", "Title is required", { title: "Required" });
  }
  const description = typeof body.description === "string" ? body.description : null;

  let contact: { email: string; firstName: string; lastName: string } | null = null;
  if (body.contact) {
    const email = typeof body.contact.email === "string" ? body.contact.email.trim() : "";
    const firstName = typeof body.contact.firstName === "string" ? body.contact.firstName.trim() : "";
    const lastName = typeof body.contact.lastName === "string" ? body.contact.lastName.trim() : "";
    if (!email) {
      throw new ApiError("invalid", "Contact email is required", { "contact.email": "Required" });
    }
    contact = { email, firstName, lastName };
  }

  const id = await createSubmission(c.var.db, eventId, auth.orgId, { title, description, contact });
  const detail = await getSubmissionDetail(c.var.db, id);
  return c.json(detail, 201);
});

// POST /api/v1/submissions/:id/clone
submissionsRoutes.post("/submissions/:id/clone", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

  const newId = await cloneSubmission(c.var.db, id);
  const detail = await getSubmissionDetail(c.var.db, newId);
  return c.json(detail, 201);
});

interface StatusUpdateBody {
  ids?: unknown;
  status?: unknown;
}

// POST /api/v1/events/:eventId/submissions/status
submissionsRoutes.post("/events/:eventId/submissions/status", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c.var.db, eventId, auth.orgId);

  const body = (await c.req.json().catch(() => ({}))) as StatusUpdateBody;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0) {
    throw new ApiError("invalid", "ids must be a non-empty array of submission ids", { ids: "Required" });
  }
  if (!isValidStatusLiteral(body.status)) {
    throw new ApiError("invalid", "status must be one of the DEC-003 submission statuses", {
      status: "Invalid status",
    });
  }

  const result = await updateSubmissionStatuses(c.var.db, eventId, ids, body.status, new Date());
  return c.json(result);
});
