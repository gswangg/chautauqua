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
import { MAX_LONG_TEXT_LENGTH } from "../forms/validate"; // DEC-417
import { makeFileStore } from "../server/context";
import { newId } from "../domain/ids";
import { buildZip } from "../lib/zip";
import { clampPage, clampPerPage, listPerPage } from "../lib/pagination";
import { DEC_013, DEC_461, DEC_465, DEC_468, DEC_471, DEC_713 } from "../decisions";

void DEC_013;
void DEC_461;
void DEC_465;
void DEC_468;
void DEC_471;
void DEC_713;
import {
  FILE_KINDS,
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
  batchContactNames,
  deleteFileVersion,
  getFileDeleteScope,
  HEADSHOT_KIND,
  insertFile,
  insertFileComment,
  isValidContentStatus,
  listEventDeliverableFiles,
  listFileComments,
  listSubmissionFiles,
  PENDING_CONTENT_STATUS,
  resolveLatestVersions,
  reviewerCanAccessSubmissionFile,
  updateContentStatus,
} from "../server/repo/files";

// DEC-773: the ?kind= filter on the files library also accepts 'headshot'
// (a headshot is a file kind, not a separate tab/endpoint) — kept separate
// from domain FILE_KINDS, which stays the upload-time vocabulary
// (presentation/poster/handout only; a headshot is never uploaded through
// the submission-files upload route).
const LIBRARY_KIND_TOKENS: readonly string[] = [...FILE_KINDS, HEADSHOT_KIND];

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
  const items = Object.entries(grouped).flatMap(([kind, versions]) =>
    versions.map((v) => ({
      id: v.id,
      submissionId,
      kind,
      filename: v.filename,
      sizeBytes: v.sizeBytes,
      contentType: v.contentType,
      previousFileId: v.previousFileId,
      uploadedByContactId: v.uploadedByContactId,
      createdAt: v.createdAt,
    })),
  );
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  const start = (page - 1) * perPage;
  const slice = items.slice(start, start + perPage);

  // DEC-601: one batched contact lookup scoped to this page's uploader ids
  // — never the whole grouped list, never per-row.
  const contactIds = [...new Set(slice.map((v) => v.uploadedByContactId).filter((id): id is string => !!id))];
  const nameById = await batchContactNames(c.var.db, contactIds);
  const slicedWithNames = slice.map((v) => ({
    ...v,
    uploaderName: v.uploadedByContactId ? (nameById.get(v.uploadedByContactId) ?? null) : null,
  }));

  return c.json({ items: slicedWithNames, total: items.length, page, perPage });
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
// GET /api/v1/events/:eventId/files — DEC-159/344 central files library
// -----------------------------------------------------------------------

/** kind is repeatable (?kind=poster&kind=handout) or CSV (?kind=poster,handout);
 * unknown tokens are dropped silently, same tolerant parsing as `status` on
 * the submissions list (DEC-016). */
function parseKinds(c: Context<AppEnv>): string[] {
  const raw = [...(c.req.queries("kind") ?? [])];
  const single = c.req.query("kind");
  if (single) raw.push(single);
  const tokens = raw.flatMap((v) => v.split(","));
  return [...new Set(tokens.map((t) => t.trim()).filter((t) => LIBRARY_KIND_TOKENS.includes(t)))];
}

fileApiRoutes.get("/events/:eventId/files", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const scope = await getEventFilesScope(c.var.db, eventId);
  if (!scope) throw new ApiError("not_found", "Event not found");
  if (scope.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");

  const page = clampPage(c.req.query("page"));
  const perPage = clampPerPage(c.req.query("perPage"));
  const kinds = parseKinds(c);
  const qRaw = c.req.query("q");
  const q = qRaw && qRaw.trim().length > 0 ? qRaw.trim() : null;

  const result = await listEventDeliverableFiles(c.var.db, eventId, { page, perPage, kinds, q });
  return c.json({
    items: result.items,
    total: result.total,
    totalSizeBytes: result.totalSizeBytes,
    page: result.page,
    perPage: result.perPage,
    // DEC-902: one grouped-query count per LIBRARY_KIND, independent of the
    // caller's ?kind= selection -- the chip strip's own arithmetic.
    kindCounts: result.kindCounts,
  });
});

// -----------------------------------------------------------------------
// POST /api/v1/events/:eventId/files/archive — DEC-160 bulk ZIP download
// -----------------------------------------------------------------------
const MAX_ARCHIVE_FILES = 50;
// DEC-353: bound the memory the archive materialises in-worker — the sum of
// the resolved latest versions' sizeBytes must fit under this before any R2
// get is issued (fail loudly, no truncation/partial archive/silent skip).
export const ARCHIVE_MAX_TOTAL_BYTES = 40 * 1024 * 1024;

fileApiRoutes.post("/events/:eventId/files/archive", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const scope = await getEventFilesScope(c.var.db, eventId);
  if (!scope) throw new ApiError("not_found", "Event not found");
  if (scope.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");

  const body = (await c.req.json().catch(() => ({}))) as { fileIds?: unknown };
  const fileIds = parseBoundedIdArray(body.fileIds, "fileIds", { maxCount: MAX_ARCHIVE_FILES }); // DEC-182

  // Loud 404 on any unknown/non-deliverable id — no silent skips (DEC-160).
  // DEC-344: resolved already carries submissionTitle — no second
  // whole-event listEventDeliverableFiles scan needed here.
  const resolved = await resolveLatestVersions(c.var.db, eventId, fileIds);

  // DEC-353: sum the resolved latest versions' sizeBytes BEFORE the first R2
  // get — reject the whole request if it exceeds the archive memory budget
  // rather than truncating or silently skipping files.
  let totalBytes = 0;
  for (const requestedId of fileIds) {
    const latest = resolved.get(requestedId);
    if (!latest) throw new Error("unreachable: resolveLatestVersions validated every id");
    totalBytes += latest.sizeBytes;
  }
  if (totalBytes > ARCHIVE_MAX_TOTAL_BYTES) {
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    const capMb = (ARCHIVE_MAX_TOTAL_BYTES / (1024 * 1024)).toFixed(0);
    throw new ApiError(
      "invalid",
      `Requested files total ${totalMb}MB, which exceeds the ${capMb}MB archive limit. Select fewer files.`,
      { fileIds: "Too large" },
    );
  }

  const store = makeFileStore(c.env.FILES);
  const entries: { name: string; data: Uint8Array }[] = [];
  let seq = 1;
  for (const requestedId of fileIds) {
    const latest = resolved.get(requestedId);
    if (!latest) throw new Error("unreachable: resolveLatestVersions validated every id");
    const obj = await store.get(latest.r2Key);
    if (!obj) throw new ApiError("not_found", `File contents not found for ${latest.filename}`);
    const buf = new Uint8Array(await new Response(obj.body).arrayBuffer());
    const title = latest.submissionTitle || "submission";
    entries.push({ name: `${seq}-${slugifyTitle(title)}/${latest.filename}`, data: buf });
    seq += 1;
  }

  const built = buildZip(entries);
  // Copy into a plain ArrayBuffer-backed view: buildZip's return type is
  // Uint8Array<ArrayBufferLike> (SharedArrayBuffer-compatible per DEC-002
  // pure-core typing), narrower than Hono's c.body Uint8Array<ArrayBuffer>.
  // Tried narrowing this away per DEC-353 (3): tsc rejects
  // Uint8Array<ArrayBufferLike> -> Uint8Array<ArrayBuffer> even when the
  // runtime value is always ArrayBuffer-backed, so the copy stays.
  const zip = new Uint8Array(built.length);
  zip.set(built);
  return c.body(zip, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${scope.slug}-files.zip"`,
    "X-Content-Type-Options": "nosniff",
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
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage"));
  const result = await listFileComments(c.var.db, fileId, { limit: perPage, offset: (page - 1) * perPage });
  return c.json(result);
});

fileApiRoutes.post("/files/:fileId/comments", csrfJson, async (c) => {
  const fileId = c.req.param("fileId");
  const { auth } = await authzFileRead(c, fileId);

  const body = (await c.req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) throw new ApiError("invalid", "body is required", { body: "Required" });
  if (text.length > MAX_LONG_TEXT_LENGTH) {
    throw new ApiError("invalid", `body must be at most ${MAX_LONG_TEXT_LENGTH} characters`, {
      body: `Max ${MAX_LONG_TEXT_LENGTH}`,
    }); // DEC-417
  }

  const commentId = await insertFileComment(c.var.db, {
    fileId,
    body: text,
    authorUserId: auth.userId,
    authorContactId: auth.contactId ?? null,
  });
  return c.json({ id: commentId }, 201);
});

// -----------------------------------------------------------------------
// DELETE /api/v1/files/:fileId — DEC-713 version deletion
// -----------------------------------------------------------------------
fileApiRoutes.delete("/files/:fileId", csrfJson, async (c) => {
  const auth = requireAuth(c);
  const fileId = c.req.param("fileId");

  const scope = await getFileDeleteScope(c.var.db, fileId);
  if (!scope || !scope.submissionId || !scope.orgId) throw new ApiError("not_found", "File not found");

  if (auth.role === "organizer") {
    // DEC-713: an organizer may delete ANY version of a submission in their org.
    if (scope.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");
  } else if (auth.role === "speaker") {
    // DEC-713: a speaker may delete ONLY the latest version of the chain,
    // that they uploaded, while the submission is still pending review.
    if (!auth.contactId || scope.uploadedByContactId !== auth.contactId) {
      throw new ApiError("forbidden", "Only the speaker who uploaded this version may delete it");
    }
    if (!scope.isLatestInChain) {
      throw new ApiError("forbidden", "Only the latest version in the chain may be deleted");
    }
    if (scope.contentStatus !== PENDING_CONTENT_STATUS) {
      throw new ApiError("forbidden", "A version may only be deleted while the submission's content status is pending");
    }
  } else {
    throw new ApiError("forbidden", "Requires organizer or the uploading speaker");
  }

  // DEC-713: the R2 object is deleted through the same store abstraction the
  // upload path uses, and BEFORE any DB write — if the object delete throws,
  // nothing here has mutated yet, so the row (and chain) stays intact and
  // the request just errors. Never delete the row first and orphan the object.
  const store = makeFileStore(c.env.FILES);
  await store.delete(scope.r2Key);

  await deleteFileVersion(c.var.db, {
    fileId,
    deletedByUserId: auth.userId,
    deletedByContactId: auth.contactId ?? null,
  });

  return c.json({ id: fileId, deleted: true });
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
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
  if (!isImageContentType(contentType)) {
    const safeName = scope.filename.replace(/[\r\n"]/g, "");
    headers["Content-Disposition"] = `attachment; filename="${safeName}"`;
  }
  return c.body(obj.body, 200, headers);
});
