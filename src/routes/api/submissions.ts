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
  getSubmissionContent,
  getSubmissionDetail,
  getSubmissionOwnership,
  getUserEmail,
  isValidStatusLiteral,
  listSubmissions,
  parseListQuery,
  updateSubmissionFields,
  updateSubmissionStatuses,
} from "../../server/repo/submissions";
import {
  DUPLICATE_PARTICIPANT,
  getParticipantOwnership,
  getParticipantRow,
  inviteParticipant,
  setParticipantVisible,
} from "../../server/repo/participants";
import { findContactForOrg } from "../../server/repo/contacts";
import { appendSubmissionRevision, getRevision, listRevisions } from "../../server/repo/revisions";

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

interface UpdateSubmissionBody {
  title?: unknown;
  description?: unknown;
}

// PATCH /api/v1/submissions/:id — organizer-only edit of title/description
// (CNT-09: admin session editing). Org-ownership check mirrors the clone
// route above. An empty patch (neither field provided) is rejected rather
// than silently no-op'ing (fail loudly). The global bumpPublicVersionMiddleware
// (src/server/pubcache.ts) purges the public cache on any successful
// mutating request, so no separate purge call is needed here.
submissionsRoutes.patch("/submissions/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

  const body = (await c.req.json().catch(() => ({}))) as UpdateSubmissionBody;
  const fields: { title?: string; description?: string | null } = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) throw new ApiError("invalid", "Title is required", { title: "Required" });
    fields.title = title;
  }
  if (body.description !== undefined) {
    fields.description = typeof body.description === "string" ? body.description : null;
  }

  if (Object.keys(fields).length === 0) {
    throw new ApiError("invalid", "At least one of title or description is required", {
      title: "Provide title or description",
    });
  }

  // DEC-158 (CNT-11): snapshot the pre-edit content so we can tell whether
  // this PATCH actually changed title/description before appending history.
  const before = await getSubmissionContent(c.var.db, id);
  if (!before) throw new ApiError("not_found", "Submission not found");

  await updateSubmissionFields(c.var.db, id, fields);

  const newTitle = fields.title ?? before.title;
  const newDescription = fields.description !== undefined ? fields.description : before.description;
  if (newTitle !== before.title || newDescription !== before.description) {
    const editorName = (await getUserEmail(c.var.db, auth.userId)) ?? auth.userId;
    await appendSubmissionRevision(c.var.db, {
      submissionId: id,
      editorUserId: auth.userId,
      editorName,
      title: newTitle,
      description: newDescription,
    });
  }

  const detail = await getSubmissionDetail(c.var.db, id);
  return c.json(detail);
});

// GET /api/v1/submissions/:id/revisions — organizer-only content history
// (CNT-11, DEC-158), newest-first standard list envelope.
submissionsRoutes.get("/submissions/:id/revisions", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

  const items = await listRevisions(c.var.db, id);
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1 });
});

// POST /api/v1/submissions/:id/revisions/:revisionId/restore — organizer-only.
// Applies the snapshot's title+description through the same update path as
// the PATCH handler above, so the restore itself lands its own history row
// attributed to the restorer. Never sends email.
submissionsRoutes.post(
  "/submissions/:id/revisions/:revisionId/restore",
  requireOrganizer,
  csrfJson,
  async (c) => {
    const auth = requireAuth(c);
    const id = c.req.param("id");
    const revisionId = c.req.param("revisionId");
    const ownership = await getSubmissionOwnership(c.var.db, id);
    if (!ownership) throw new ApiError("not_found", "Submission not found");
    if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

    const revision = await getRevision(c.var.db, id, revisionId);
    if (!revision) throw new ApiError("not_found", "Revision not found");

    const before = await getSubmissionContent(c.var.db, id);
    if (!before) throw new ApiError("not_found", "Submission not found");

    await updateSubmissionFields(c.var.db, id, { title: revision.title, description: revision.description });

    if (revision.title !== before.title || revision.description !== before.description) {
      const editorName = (await getUserEmail(c.var.db, auth.userId)) ?? auth.userId;
      await appendSubmissionRevision(c.var.db, {
        submissionId: id,
        editorUserId: auth.userId,
        editorName,
        title: revision.title,
        description: revision.description,
      });
    }

    const detail = await getSubmissionDetail(c.var.db, id);
    return c.json(detail);
  },
);

interface InviteParticipantBody {
  contactId?: unknown;
  role?: unknown;
}

// POST /api/v1/submissions/:id/participants — invite a participant onto an
// existing submission (DEC-070; closes w12-c PLANNER item #1: previously
// the only way to construct a participant row with invite_status='invited'
// was a direct D1 write from the walkthrough script). Per product
// principle 4, this does NOT send an email — notifying the invitee is a
// separate, explicit comms action.
submissionsRoutes.post("/submissions/:id/participants", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

  const body = (await c.req.json().catch(() => ({}))) as InviteParticipantBody;
  const contactId = typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (!contactId) {
    throw new ApiError("invalid", "contactId is required", { contactId: "Required" });
  }
  const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : undefined;

  const contact = await findContactForOrg(c.var.db, contactId, auth.orgId);
  if (!contact) {
    throw new ApiError("invalid", "Contact not found in this org", { contactId: "Invalid contact" });
  }

  const result = await inviteParticipant(c.var.db, { submissionId: id, contactId, role });
  if (result === DUPLICATE_PARTICIPANT) {
    throw new ApiError("invalid", "This contact is already a participant on this submission", {
      contactId: "Already invited",
    });
  }

  return c.json(result, 201);
});

interface ParticipantVisibilityBody {
  visible?: unknown;
}

// PATCH /api/v1/submissions/:id/participants/:participantId — toggle a
// participant's public visibility. (w12-c PLANNER item #2: previously
// participant.visible was only ever written at submission-create time.)
submissionsRoutes.patch(
  "/submissions/:id/participants/:participantId",
  requireOrganizer,
  csrfJson,
  async (c) => {
    const auth = requireAuth(c);
    const id = c.req.param("id");
    const participantId = c.req.param("participantId");
    const ownership = await getSubmissionOwnership(c.var.db, id);
    if (!ownership) throw new ApiError("not_found", "Submission not found");
    if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

    const scope = await getParticipantOwnership(c.var.db, participantId);
    if (!scope || scope.submissionId !== id) {
      throw new ApiError("not_found", "Participant not found on this submission");
    }

    const body = (await c.req.json().catch(() => ({}))) as ParticipantVisibilityBody;
    if (typeof body.visible !== "boolean") {
      throw new ApiError("invalid", "visible must be a boolean", { visible: "Required" });
    }

    await setParticipantVisible(c.var.db, participantId, body.visible);
    const row = await getParticipantRow(c.var.db, participantId);
    return c.json(row);
  },
);

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
