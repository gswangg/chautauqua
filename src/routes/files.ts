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
import { makeFileStore, putThenRecord } from "../server/context";
import { newId } from "../domain/ids";
import { buildZip } from "../lib/zip";
import { clampPage, clampPerPage, listPerPage } from "../lib/pagination";
import { DEC_013, DEC_461, DEC_465, DEC_468, DEC_471, DEC_713, DEC_965 } from "../decisions";

void DEC_013;
void DEC_461;
void DEC_465;
void DEC_468;
void DEC_471;
void DEC_713;
void DEC_965;
import {
  FILE_KINDS,
  isImageContentType,
  isValidFileKind,
  isValidVersionChain,
  sanitizeFilenameForKey,
  slugifyTitle,
  validateUpload,
} from "../domain/files";
import { canEditSubmission } from "../domain/edit-lock"; // DEC-041
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
 * on the submission (per DEC-020, "organizer or participant speaker").
 * reviewer (DEC-170 wave-54 amendment): only when the submission is in scope
 * for one of their non-anonymized plan assignments — the SAME repo predicate
 * (reviewerCanAccessSubmissionFile) that gates GET /files/:fileId and the
 * file comment endpoints, so a reviewer who can already see a file's
 * comments can also discover that file's id via this listing. Read only —
 * no edit-lock check. Used for GET listing and as the shared base of
 * authzSubmissionWrite (writes explicitly refuse reviewers, see
 * authzFileWrite). */
async function authzSubmissionRead(c: Context<AppEnv>, submissionId: string) {
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
  if (auth.role === "reviewer") {
    const inScope = await reviewerCanAccessSubmissionFile(c.var.db, auth.userId, scope.eventId, submissionId);
    if (inScope) return { auth, scope };
  }
  throw new ApiError("forbidden", "Requires organizer or participant speaker");
}

/** DEC-041 edit-lock, in ONE place: throws when a speaker's submission-scoped
 * write (upload, comment, or delete a version) falls outside the
 * canEditSubmission window — the same rule src/routes/portal/edit.tsx
 * enforces for the portal's own submission edits. This is the ONLY call site
 * of canEditSubmission in this file; every speaker write path routes
 * through it (wave-46 amendment: the DELETE path previously bypassed it). */
function assertSpeakerSubmissionUnlocked(scope: { status: string; formCloseDate: number | null; timezone: string }): void {
  if (!canEditSubmission(scope.status, scope.formCloseDate, Date.now(), scope.timezone)) {
    throw new ApiError("forbidden", "This submission can no longer be edited");
  }
}

/** authzSubmissionRead, plus the DEC-041 edit-lock. Organizers are never
 * locked. */
async function authzSubmissionWrite(c: Context<AppEnv>, submissionId: string) {
  const result = await authzSubmissionRead(c, submissionId);
  const { auth, scope } = result;
  if (auth.role === "speaker") {
    assertSpeakerSubmissionUnlocked(scope);
  }
  return result;
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
  const fileId = await putThenRecord(store, r2Key, file.stream(), validation.servedContentType, () =>
    insertFile(c.var.db, {
      submissionId,
      kind,
      filename: file.name,
      r2Key,
      sizeBytes: file.size,
      contentType: validation.servedContentType,
      previousFileId,
      uploadedByContactId: auth.contactId ?? null,
    }),
  );

  return c.json({ id: fileId, filename: file.name, kind, sizeBytes: file.size, contentType: validation.servedContentType }, 201);
});

// -----------------------------------------------------------------------
// GET /api/v1/submissions/:id/files
// -----------------------------------------------------------------------
fileApiRoutes.get("/submissions/:id/files", async (c) => {
  const submissionId = c.req.param("id");
  await authzSubmissionRead(c, submissionId);
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
      versionNo: v.versionNo,
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

/** kind is repeatable (?kind=poster&kind=handout) or CSV (?kind=poster,handout),
 * deduped preserving first-seen order. Per the DEC-843 amendment (w38), an
 * unknown token THROWS a plain Error naming the token — the same loud
 * contract as `status` on the submissions list — rather than being dropped,
 * so a typo can never silently widen the library to every kind. Callers wrap
 * this in try/catch and map the Error to ApiError('invalid', ...). */
function parseKinds(c: Context<AppEnv>): string[] {
  const raw = [...(c.req.queries("kind") ?? [])];
  const single = c.req.query("kind");
  if (single) raw.push(single);
  const tokens = raw
    .flatMap((v) => v.split(","))
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (!LIBRARY_KIND_TOKENS.includes(token)) {
      throw new Error(`Unknown kind '${token}'`);
    }
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  return result;
}

fileApiRoutes.get("/events/:eventId/files", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const scope = await getEventFilesScope(c.var.db, eventId);
  if (!scope) throw new ApiError("not_found", "Event not found");
  if (scope.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");

  const page = clampPage(c.req.query("page"));
  const perPage = clampPerPage(c.req.query("perPage"));
  let kinds: string[];
  try {
    kinds = parseKinds(c);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError("invalid", message);
  }
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
// DEC-353 (wave-46 amendment): bound the memory the archive materialises
// in-worker — the sum of the resolved latest versions' sizeBytes must fit
// under this before any R2 get is issued (fail loudly, no truncation/partial
// archive/silent skip). The cap is derived, not guessed: peak in-worker
// memory during archive build is the entry buffers (fetched, held in
// `entries`) plus the ByteWriter's transient growth while it assembles the
// body/central/eocd chunks and materialises the final Uint8Array — call that
// ARCHIVE_PEAK_MULTIPLIER x the total resolved bytes. That peak must stay
// well under the isolate's memory budget (with headroom for everything else
// running in the isolate), so ARCHIVE_MAX_TOTAL_BYTES is chosen such that
// ARCHIVE_MAX_TOTAL_BYTES * ARCHIVE_PEAK_MULTIPLIER <= 0.75 *
// ISOLATE_MEMORY_BUDGET_BYTES (see test/files-archive-budget.test.ts).
export const ISOLATE_MEMORY_BUDGET_BYTES = 128 * 1024 * 1024;
export const ARCHIVE_PEAK_MULTIPLIER = 4;
export const ARCHIVE_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

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

  // DEC-160 (wave-49 amendment): fetch every R2 object as ONE parallel wave —
  // the memory ceiling was already enforced above, before the first GET, so
  // concurrency changes neither peak memory nor output bytes, only latency.
  // `entries` is still built by walking `fileIds` IN REQUEST ORDER so the zip
  // bytes are unchanged regardless of which promise settles first; on the
  // first missing object or rejection (in request order) we throw the same
  // ApiError naming that file.
  const descriptors = fileIds.map((requestedId, index) => {
    const latest = resolved.get(requestedId);
    if (!latest) throw new Error("unreachable: resolveLatestVersions validated every id");
    const seq = index + 1;
    const title = latest.submissionTitle || "submission";
    return { latest, name: `${seq}-${slugifyTitle(title)}/${latest.filename}` };
  });

  const settled = await Promise.allSettled(
    descriptors.map(async (d) => {
      const obj = await store.get(d.latest.r2Key);
      if (!obj) return null;
      return new Uint8Array(await new Response(obj.body).arrayBuffer());
    }),
  );

  const entries: { name: string; data: Uint8Array }[] = [];
  for (const [i, d] of descriptors.entries()) {
    const result = settled[i];
    if (!result) throw new Error("unreachable: settled has one entry per descriptor");
    if (result.status === "rejected") throw result.reason;
    if (result.value === null) throw new ApiError("not_found", `File contents not found for ${d.latest.filename}`);
    entries.push({ name: d.name, data: result.value });
  }

  const built = buildZip(entries);
  return c.body(built, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${scope.slug}-files.zip"`,
    "X-Content-Type-Options": "nosniff",
  });
});

// -----------------------------------------------------------------------
// GET/POST /api/v1/files/:fileId/comments
// -----------------------------------------------------------------------
/** DEC-170 (wave-54 amendment): the whole reviewer-file-scope rule lives HERE,
 * ONE place, called from both authzFileRead (comments) and authzServeFile
 * (streaming) — a reviewer with no submissionId in scope is refused outright
 * (getFileScope's population always carries a submissionId when non-null, so
 * this only fires for the resource/task populations authzServeFile also
 * probes); otherwise defers to reviewerCanAccessSubmissionFile, the same
 * non-anonymized in-scope-plan predicate authzSubmissionRead uses. Returns
 * undefined for every non-reviewer role — canAccessFile only reads
 * opts.reviewerInScope on the reviewer branch, so undefined is inert there. */
async function resolveReviewerFileScope(
  c: Context<AppEnv>,
  auth: AuthInfo,
  scope: { eventId: string; submissionId: string | null },
): Promise<boolean | undefined> {
  if (auth.role !== "reviewer") return undefined;
  if (!scope.submissionId) throw new ApiError("forbidden", "Not authorized for this file");
  return reviewerCanAccessSubmissionFile(c.var.db, auth.userId, scope.eventId, scope.submissionId);
}

async function authzFileRead(c: Context<AppEnv>, fileId: string) {
  const auth = requireAuth(c);
  const scope = await getFileScope(c.var.db, fileId);
  if (!scope) throw new ApiError("not_found", "File not found");
  const reviewerInScope = await resolveReviewerFileScope(c, auth, scope);
  if (!canAccessFile(auth, scope, { reviewerInScope })) throw new ApiError("forbidden", "Not authorized for this file");
  return { auth, scope };
}

/** authzFileRead, plus the DEC-041 edit-lock for speaker writes (e.g.
 * posting a comment) — a read predicate must never gate a write. Reviewers
 * are refused OUTRIGHT here (DEC-170, wave-54 amendment): the read grant
 * (GET comments, GET the file itself) never implies a write grant — a
 * reviewer's non-anonymized in-scope plan lets them read, never comment.
 * Loads the file's submission scope to apply the same canEditSubmission
 * check authzSubmissionWrite uses; scope.submissionId is always non-null
 * here (getFileScope already filters to submission-attached files). */
async function authzFileWrite(c: Context<AppEnv>, fileId: string) {
  const result = await authzFileRead(c, fileId);
  const { auth, scope } = result;
  if (auth.role === "reviewer") {
    throw new ApiError("forbidden", "Reviewers may not modify files");
  }
  if (auth.role === "speaker") {
    if (!scope.submissionId) throw new ApiError("forbidden", "Not authorized for this file");
    const subScope = await getSubmissionScope(c.var.db, scope.submissionId);
    if (!subScope) throw new ApiError("not_found", "Submission not found");
    assertSpeakerSubmissionUnlocked(subScope);
  }
  return result;
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
  const { auth } = await authzFileWrite(c, fileId);

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
    // DEC-041 (wave-46 amendment): deleting the latest version is a
    // destructive submission-write like upload/comment — it must be equally
    // locked past the form close date.
    if (scope.status === null || scope.timezone === null) {
      throw new ApiError("not_found", "Submission not found");
    }
    assertSpeakerSubmissionUnlocked({ status: scope.status, formCloseDate: scope.formCloseDate, timezone: scope.timezone });
  } else {
    throw new ApiError("forbidden", "Requires organizer or the uploading speaker");
  }

  // DEC-713 ordering (amended wave 50): the DB write commits FIRST, then the
  // R2 object is deleted. The two failure modes are not symmetric — a
  // committed row pointing at missing bytes 404s forever and silently
  // breaks the "history complete and downloadable" guarantee, while an
  // object outliving its row is just an unreferenced blob, invisible and
  // reclaimable. A store.delete throw after the commit is logged and
  // swallowed: a committed delete must never be reported as a failure.
  await deleteFileVersion(c.var.db, {
    fileId,
    deletedByUserId: auth.userId,
    deletedByContactId: auth.contactId ?? null,
  });

  const store = makeFileStore(c.env.FILES);
  try {
    await store.delete(scope.r2Key);
  } catch (err) {
    console.error(`files/:fileId delete: store.delete failed for file ${fileId} after row commit (key ${scope.r2Key})`, err);
  }

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
    // DEC-170 (supersedes DEC-066; wave-54 amendment factors this lookup out
    // to resolveReviewerFileScope, shared with authzFileRead) — reviewers
    // aren't named in canAccessFile's org/participant logic, so pass whether
    // this reviewer's non-anonymized plan assignments put the file's
    // submission in scope, precomputed here so canAccessFile stays a pure
    // function.
    const reviewerInScope = await resolveReviewerFileScope(c, auth, scope);
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

  const contentType = scope.contentType;
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
