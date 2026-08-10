// J8 file pipeline API (DEC-020): upload, list, authenticated serving,
// comments, content approval. Route file exports a named Hono sub-app; only
// src/index.ts mounts it (DEC-012). Handlers stay thin: parse/authz -> repo
// function -> pure core (src/domain/files.ts) -> response.
//
// DEC-009 invariant: content-status changes never send email — this module
// MUST NEVER import a mailer.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../server/env";
import { requireOrganizer, csrfJson } from "../server/middleware";
import { ApiError } from "../server/http";
import { makeFileStore } from "../server/context";
import { newId } from "../domain/ids";
import {
  isImageContentType,
  isValidFileKind,
  isValidVersionChain,
  sanitizeFilenameForKey,
  validateUpload,
} from "../domain/files";
import {
  canAccessFile,
  getFileScope,
  getReplacesTarget,
  getSubmissionScope,
  insertFile,
  insertFileComment,
  isValidContentStatus,
  listFileComments,
  listSubmissionFiles,
  updateContentStatus,
} from "../server/repo/files";

// Mounted at /api/v1 (submission-scoped file/comment/content-status
// endpoints) in src/index.ts.
export const fileApiRoutes = new Hono<AppEnv>();

// Mounted at / (root) — GET /files/:fileId, DEC-005 root-mounted authenticated
// streaming endpoint.
export const fileServeRoutes = new Hono<AppEnv>();

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

/** organizer: any submission in their org. speaker: only when a participant
 * on the submission (per DEC-020, "organizer or participant speaker"). */
async function authzSubmissionWrite(c: Context<AppEnv>, submissionId: string) {
  const auth = requireAuth(c);
  const scope = await getSubmissionScope(c.var.db, submissionId);
  if (!scope) throw new ApiError("not_found", "Submission not found");
  if (auth.role === "organizer") {
    if (scope.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");
    return { auth, scope };
  }
  if (auth.role === "speaker") {
    if (!auth.contactId || !scope.participantContactIds.includes(auth.contactId)) {
      throw new ApiError("forbidden", "Not a participant on this submission");
    }
    return { auth, scope };
  }
  throw new ApiError("forbidden", "Requires organizer or participant speaker");
}

// -----------------------------------------------------------------------
// POST /api/v1/submissions/:id/files
// -----------------------------------------------------------------------
fileApiRoutes.post("/submissions/:id/files", csrfJson, async (c) => {
  const submissionId = c.req.param("id");
  const { auth } = await authzSubmissionWrite(c, submissionId);

  const body = await c.req.parseBody();
  const file = body["file"];
  const kind = body["kind"];
  const replacesFileIdRaw = body["replacesFileId"];
  const replacesFileId = typeof replacesFileIdRaw === "string" && replacesFileIdRaw.length > 0 ? replacesFileIdRaw : null;

  if (!(file instanceof File)) {
    throw new ApiError("invalid", "file is required", { file: "Required" });
  }

  const validation = validateUpload({ filename: file.name, sizeBytes: file.size, kind });
  if (!validation.ok) {
    throw new ApiError("invalid", validation.message, validation.fields);
  }
  // validateUpload already checked isValidFileKind; re-check here purely to
  // narrow the type for insertFile without an unsafe cast.
  if (!isValidFileKind(kind)) {
    throw new ApiError("invalid", "kind must be presentation, poster, or handout", { kind: "Invalid file kind" });
  }

  let previousFileId: string | null = null;
  if (replacesFileId) {
    const target = await getReplacesTarget(c.var.db, replacesFileId);
    if (!target) {
      throw new ApiError("invalid", "replacesFileId does not reference an existing file", {
        replacesFileId: "Not found",
      });
    }
    if (!isValidVersionChain(target, { submissionId, kind })) {
      throw new ApiError(
        "invalid",
        "replacesFileId must reference a file on the same submission with the same kind",
        { replacesFileId: "Invalid version chain" },
      );
    }
    previousFileId = replacesFileId;
  }

  const sanitized = sanitizeFilenameForKey(file.name);
  const r2Key = `sub/${submissionId}/${newId()}-${sanitized}`;
  const store = makeFileStore(c.env.FILES);
  const buf = await file.arrayBuffer();
  await store.put(r2Key, buf, validation.servedContentType);

  const fileId = await insertFile(c.var.db, {
    submissionId,
    kind,
    filename: file.name,
    r2Key,
    sizeBytes: file.size,
    contentType: validation.servedContentType,
    previousFileId,
    uploadedByContactId: auth.contactId ?? null,
  });

  return c.json({ id: fileId, filename: file.name, kind, sizeBytes: file.size, contentType: validation.servedContentType }, 201);
});

// -----------------------------------------------------------------------
// GET /api/v1/submissions/:id/files
// -----------------------------------------------------------------------
fileApiRoutes.get("/submissions/:id/files", async (c) => {
  const submissionId = c.req.param("id");
  await authzSubmissionWrite(c, submissionId);
  const grouped = await listSubmissionFiles(c.var.db, submissionId);
  return c.json({ files: grouped });
});

// -----------------------------------------------------------------------
// POST /api/v1/submissions/:id/content-status — organizer-only
// -----------------------------------------------------------------------
fileApiRoutes.post("/submissions/:id/content-status", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const submissionId = c.req.param("id");
  const scope = await getSubmissionScope(c.var.db, submissionId);
  if (!scope) throw new ApiError("not_found", "Submission not found");
  if (scope.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

  const body = (await c.req.json().catch(() => ({}))) as { contentStatus?: unknown };
  if (!isValidContentStatus(body.contentStatus)) {
    throw new ApiError("invalid", "contentStatus must be one of pending, approved, changes_requested", {
      contentStatus: "Invalid value",
    });
  }

  await updateContentStatus(c.var.db, submissionId, body.contentStatus);
  return c.json({ id: submissionId, contentStatus: body.contentStatus });
});

// -----------------------------------------------------------------------
// GET/POST /api/v1/files/:fileId/comments
// -----------------------------------------------------------------------
async function authzFileRead(c: Context<AppEnv>, fileId: string) {
  const auth = requireAuth(c);
  const scope = await getFileScope(c.var.db, fileId);
  if (!scope) throw new ApiError("not_found", "File not found");
  if (!canAccessFile(auth, scope)) throw new ApiError("forbidden", "Not authorized for this file");
  return { auth, scope };
}

fileApiRoutes.get("/files/:fileId/comments", async (c) => {
  const fileId = c.req.param("fileId");
  await authzFileRead(c, fileId);
  const comments = await listFileComments(c.var.db, fileId);
  return c.json({ items: comments });
});

fileApiRoutes.post("/files/:fileId/comments", csrfJson, async (c) => {
  const fileId = c.req.param("fileId");
  const { auth } = await authzFileRead(c, fileId);

  const body = (await c.req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) throw new ApiError("invalid", "body is required", { body: "Required" });

  const commentId = await insertFileComment(c.var.db, {
    fileId,
    body: text,
    authorUserId: auth.userId,
    authorContactId: auth.contactId ?? null,
  });
  return c.json({ id: commentId }, 201);
});

// -----------------------------------------------------------------------
// GET /files/:fileId — root-mounted authenticated streaming
// -----------------------------------------------------------------------
fileServeRoutes.get("/files/:fileId", async (c) => {
  const fileId = c.req.param("fileId");
  const { scope } = await authzFileRead(c, fileId);

  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(scope.r2Key);
  if (!obj) throw new ApiError("not_found", "File contents not found");

  const contentType = obj.contentType ?? scope.contentType;
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (!isImageContentType(contentType)) {
    const safeName = scope.filename.replace(/[\r\n"]/g, "");
    headers["Content-Disposition"] = `attachment; filename="${safeName}"`;
  }
  return c.body(obj.body, 200, headers);
});
