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
import { ApiError, parseBoundedIdArray } from "../server/http";
import { makeFileStore } from "../server/context";
import { newId } from "../domain/ids";
import { buildZip } from "../lib/zip";
import {
  isImageContentType,
  isValidFileKind,
  isValidVersionChain,
  sanitizeFilenameForKey,
  slugifyTitle,
  validateUpload,
} from "../domain/files";
import {
  canAccessFile,
  canAccessResourceFile,
  canAccessTaskFile,
  getEventFilesScope,
  getFileScope,
  getReplacesTarget,
  getResourceFileScope,
  getSubmissionScope,
  getTaskFileScope,
  insertFile,
  insertFileComment,
  isValidContentStatus,
  listEventDeliverableFiles,
  listFileComments,
  listSubmissionFiles,
  resolveLatestVersions,
  reviewerCanAccessSubmissionFile,
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
// GET /api/v1/events/:eventId/files — DEC-159 central files library
// -----------------------------------------------------------------------
fileApiRoutes.get("/events/:eventId/files", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const scope = await getEventFilesScope(c.var.db, eventId);
  if (!scope) throw new ApiError("not_found", "Event not found");
  if (scope.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");

  const items = await listEventDeliverableFiles(c.var.db, eventId);
  return c.json({ items, total: items.length, page: 1, perPage: items.length || 1 });
});

// -----------------------------------------------------------------------
// POST /api/v1/events/:eventId/files/archive — DEC-160 bulk ZIP download
// -----------------------------------------------------------------------
const MAX_ARCHIVE_FILES = 50;

fileApiRoutes.post("/events/:eventId/files/archive", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const scope = await getEventFilesScope(c.var.db, eventId);
  if (!scope) throw new ApiError("not_found", "Event not found");
  if (scope.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");

  const body = (await c.req.json().catch(() => ({}))) as { fileIds?: unknown };
  const fileIds = parseBoundedIdArray(body.fileIds, "fileIds", { maxCount: MAX_ARCHIVE_FILES }); // DEC-182

  // Loud 404 on any unknown/non-deliverable id — no silent skips (DEC-160).
  const resolved = await resolveLatestVersions(c.var.db, eventId, fileIds);
  const chains = await listEventDeliverableFiles(c.var.db, eventId);
  const submissionTitleByLatestId = new Map(chains.map((ch) => [ch.latestFileId, ch.submissionTitle]));

  const store = makeFileStore(c.env.FILES);
  const entries: { name: string; data: Uint8Array }[] = [];
  let seq = 1;
  for (const requestedId of fileIds) {
    const latest = resolved.get(requestedId);
    if (!latest) throw new Error("unreachable: resolveLatestVersions validated every id");
    const obj = await store.get(latest.r2Key);
    if (!obj) throw new ApiError("not_found", `File contents not found for ${latest.filename}`);
    const buf = new Uint8Array(await new Response(obj.body).arrayBuffer());
    const title = submissionTitleByLatestId.get(latest.id) ?? "submission";
    entries.push({ name: `${seq}-${slugifyTitle(title)}/${latest.filename}`, data: buf });
    seq += 1;
  }

  const built = buildZip(entries);
  // Copy into a plain ArrayBuffer-backed view: buildZip's return type is
  // Uint8Array<ArrayBufferLike> (SharedArrayBuffer-compatible per DEC-002
  // pure-core typing), narrower than Hono's c.body Uint8Array<ArrayBuffer>.
  const zip = new Uint8Array(built.length);
  zip.set(built);
  return c.body(zip, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${scope.slug}-files.zip"`,
  });
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

interface ServeScope {
  filename: string;
  contentType: string;
  r2Key: string;
}

/** GET /files/:fileId serves three disjoint file populations: submission
 * deliverables/attachments (getFileScope, organizer-or-participant, plus
 * DEC-066 assigned reviewers), DEC-047 resource files (getResourceFileScope,
 * organizer-only), and DEC-065/DEC-248 task-assignment uploads
 * (getTaskFileScope, organizer-or-assigned-speaker; population is
 * submissionId-null + referenced by task_assignment.fileId, any kind). A
 * file row belongs to exactly one population, never more than one —
 * resource/task files have submissionId null. */
async function authzServeFile(c: Context<AppEnv>, fileId: string): Promise<ServeScope> {
  const auth = requireAuth(c);
  const scope = await getFileScope(c.var.db, fileId);
  if (scope) {
    // DEC-170 (supersedes DEC-066): reviewers aren't named in canAccessFile's
    // org/participant logic — pass whether this reviewer's non-anonymized
    // plan assignments put the file's submission in scope, precomputed here
    // so canAccessFile stays a pure function. getFileScope only ever returns
    // a non-null submissionId (it returns null itself when the file isn't
    // submission-attached), so this is safe.
    if (auth.role === "reviewer" && !scope.submissionId) {
      throw new ApiError("forbidden", "Not authorized for this file");
    }
    const reviewerInScope =
      auth.role === "reviewer" && scope.submissionId
        ? await reviewerCanAccessSubmissionFile(c.var.db, auth.userId, scope.eventId, scope.submissionId)
        : undefined;
    if (!canAccessFile(auth, scope, { reviewerInScope })) {
      throw new ApiError("forbidden", "Not authorized for this file");
    }
    return scope;
  }
  const resourceScope = await getResourceFileScope(c.var.db, fileId);
  if (resourceScope) {
    if (!canAccessResourceFile(auth, resourceScope)) throw new ApiError("forbidden", "Not authorized for this file");
    return resourceScope;
  }
  const taskScope = await getTaskFileScope(c.var.db, fileId);
  if (!taskScope) throw new ApiError("not_found", "File not found");
  if (!canAccessTaskFile(auth, taskScope)) throw new ApiError("forbidden", "Not authorized for this file");
  return taskScope;
}

fileServeRoutes.get("/files/:fileId", async (c) => {
  const fileId = c.req.param("fileId");
  const scope = await authzServeFile(c, fileId);

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
