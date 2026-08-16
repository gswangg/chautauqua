// Portal settings + resources API (w4-h). Organizer-only, per DEC-005/
// DEC-012/DEC-013/DEC-032. Route file exports a sub-app; only src/index.ts
// mounts it. Resource creation is JSON -> kind='wiki'; multipart/form-data
// (title + file) -> kind='file' via validateUpload (DEC-047, DEC-020).

import { Hono, type Context } from "hono";
import type { AppEnv } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError, readJsonBody } from "../../server/http";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH, MAX_RICH_TEXT_LENGTH } from "../../forms/validate"; // DEC-417
import { overCapFieldMessage } from "../../domain/cap-copy";
import { makeFileStore, putThenRecord } from "../../server/context";
import { newId } from "../../domain/ids";
import { sanitizeFilenameForKey, validateUpload } from "../../domain/files";
import { getEventForOrg } from "../../server/repo/events";
import {
  countResourcesForEvent,
  createFileResource,
  createWikiResource,
  deleteResource,
  getFileForDelete,
  deleteFileRow,
  getPortalSettingsForEvent,
  insertResourceFile,
  listResourcesForEvent,
  resourceEventId,
  updateResource,
  upsertPortalSettings,
} from "../../server/repo/portal-config";
import { isValidHexColor, normalizeHexColor } from "../../domain/color";
import { DEFAULT_PORTAL_SETTINGS } from "../../domain/portal-settings";
import { safeImageSrc } from "../../domain/brand-url";
import { clampPage, listPerPage } from "../../lib/pagination";
import { DEC_523, DEC_322 } from "../../decisions";

void DEC_322;

// Compile-checked dependency marker: the explicit route-shape middleware
// below (replacing the forbidden `/events/*` wildcard) implements DEC-523.
void DEC_523;

export const portalConfigRoutes = new Hono<AppEnv>();

// NOTE: a `/events/*` wildcard here would ALSO match the bare `/api/v1/events`
// list route once this sub-app is composed under the shared "/api/v1" prefix
// (Hono's `*` matches zero-or-more trailing segments and does not respect
// sub-app boundaries) — that route is the DEC-141 exception eventsRoutes
// intentionally keeps reviewer-reachable via its own inline role check, so a
// wildcard here would silently 403 reviewers on it. It is inert today only
// because src/index.ts:42-43 happens to mount eventsRoutes before
// portalConfigRoutes; list this router's actual shapes explicitly instead.
portalConfigRoutes.use("/events/:eventId/portal-settings", requireOrganizer);
portalConfigRoutes.use("/events/:eventId/resources", requireOrganizer);
portalConfigRoutes.use("/resources/:resourceId", requireOrganizer);

function currentOrgId(c: { var: { auth?: { orgId: string } } }): string {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth.orgId;
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
      ...DEFAULT_PORTAL_SETTINGS,
      createdAt: null,
      updatedAt: null,
    },
  );
});

portalConfigRoutes.put("/events/:eventId/portal-settings", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);

  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};

  const logoUrl = body.logoUrl;
  // DEC-322 wave-30 amendment: gate the logo URL at the write door so an
  // unsafe value can never reach storage (and, from there, an <img src>). A
  // null/blank value clears the logo and stays legal.
  let sanitizedLogoUrl: string | null | undefined = undefined;
  if (logoUrl !== undefined && logoUrl !== null && typeof logoUrl !== "string") {
    fields.logoUrl = "Must be a string";
  } else if (typeof logoUrl === "string" && logoUrl.length > MAX_TEXT_LENGTH) {
    fields.logoUrl = overCapFieldMessage(logoUrl.length, MAX_TEXT_LENGTH); // DEC-417
  } else if (logoUrl === null) {
    sanitizedLogoUrl = null;
  } else if (typeof logoUrl === "string") {
    const safe = safeImageSrc(logoUrl);
    if (logoUrl.trim() !== "" && safe === null) {
      fields.logoUrl = "Must be an http or https URL, or a path starting with /";
    } else {
      sanitizedLogoUrl = safe;
    }
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
  } else if (typeof welcomeMessage === "string" && welcomeMessage.length > MAX_LONG_TEXT_LENGTH) {
    fields.welcomeMessage = overCapFieldMessage(welcomeMessage.length, MAX_LONG_TEXT_LENGTH); // DEC-417
  }

  const showResources = body.showResources;
  if (showResources !== undefined && typeof showResources !== "boolean") {
    fields.showResources = "Must be a boolean";
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid portal settings", fields);
  }

  const updated = await upsertPortalSettings(c.var.db, eventId, {
    logoUrl: logoUrl === undefined ? undefined : sanitizedLogoUrl,
    // DEC-371 amendment (wave 43): normalize on WRITE so a reader (SSR
    // shells, embed query parser) can never disagree with the writer that
    // accepted the value — '#abc' is stored as '#aabbcc'.
    accentColor:
      accentColor === undefined
        ? undefined
        : accentColor === null
          ? null
          : normalizeHexColor(accentColor as string),
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
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  const items = await listResourcesForEvent(c.var.db, eventId, { limit: perPage, offset: (page - 1) * perPage });
  const total = await countResourcesForEvent(c.var.db, eventId);
  return c.json({ items, total, page, perPage });
});

/** Pure parse of the optional multipart `position` field — extracted so the
 * non-negative-integer rule is unit-testable without a multipart request. */
export function parseFileResourcePosition(
  raw: unknown,
): { ok: true; value: number | undefined } | { ok: false; message: string } {
  if (typeof raw !== "string" || raw.length === 0) return { ok: true, value: undefined };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, message: "Must be a non-negative integer" };
  }
  return { ok: true, value: parsed };
}

/**
 * DEC-047 multipart branch of POST /events/:eventId/resources: title + file
 * -> validateUpload (document/handout tier — resources aren't submission
 * deliverables, so `kind` here only selects the size/extension tier, never
 * the stored file row kind) -> R2 put -> file row kind='resource'
 * (submissionId null) -> resource row kind='file' pointing at it.
 */
async function createFileResourceHandler(c: Context<AppEnv>, eventId: string) {
  const body = await c.req.parseBody();
  const title = body["title"];
  const file = body["file"];
  const positionRaw = body["position"];

  const fields: Record<string, string> = {};
  if (typeof title !== "string" || title.trim().length === 0) {
    fields.title = "Required";
  } else if (title.length > MAX_NAME_LENGTH) {
    fields.title = overCapFieldMessage(title.length, MAX_NAME_LENGTH); // DEC-417
  }
  if (!(file instanceof File)) {
    fields.file = "Required";
  }
  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid resource", fields);
  }

  const positionResult = parseFileResourcePosition(positionRaw);
  if (!positionResult.ok) {
    throw new ApiError("invalid", "Invalid resource", { position: positionResult.message });
  }
  const position = positionResult.value;

  const uploadedFile = file as File;
  const validation = validateUpload({ filename: uploadedFile.name, sizeBytes: uploadedFile.size, kind: "handout" });
  if (!validation.ok) {
    throw new ApiError("invalid", validation.message, validation.fields);
  }

  const sanitized = sanitizeFilenameForKey(uploadedFile.name);
  const r2Key = `resource/${eventId}/${newId()}-${sanitized}`;
  const store = makeFileStore(c.env.FILES);
  const fileId = await putThenRecord(store, r2Key, uploadedFile.stream(), validation.servedContentType, () =>
    insertResourceFile(c.var.db, {
      filename: uploadedFile.name,
      r2Key,
      sizeBytes: uploadedFile.size,
      contentType: validation.servedContentType,
    }),
  );

  const created = await createFileResource(c.var.db, eventId, {
    title: (title as string).trim(),
    fileId,
    position,
  });
  return c.json(created, 201);
}

portalConfigRoutes.post("/events/:eventId/resources", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);

  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return createFileResourceHandler(c, eventId);
  }

  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};

  const title = body.title;
  if (typeof title !== "string" || title.trim().length === 0) {
    fields.title = "Required";
  } else if (title.length > MAX_NAME_LENGTH) {
    fields.title = overCapFieldMessage(title.length, MAX_NAME_LENGTH); // DEC-417
  }
  const content = body.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    fields.content = "Required";
  } else if (content.length > MAX_RICH_TEXT_LENGTH) {
    fields.content = overCapFieldMessage(content.length, MAX_RICH_TEXT_LENGTH); // DEC-417
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

  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};

  const title = body.title;
  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    fields.title = "Must be a non-empty string";
  } else if (typeof title === "string" && title.length > MAX_NAME_LENGTH) {
    fields.title = overCapFieldMessage(title.length, MAX_NAME_LENGTH); // DEC-417
  }
  const content = body.content;
  if (content !== undefined && (typeof content !== "string" || content.trim().length === 0)) {
    fields.content = "Must be a non-empty string";
  } else if (typeof content === "string" && content.length > MAX_RICH_TEXT_LENGTH) {
    fields.content = overCapFieldMessage(content.length, MAX_RICH_TEXT_LENGTH); // DEC-417
  }
  const position = body.position;
  if (position !== undefined && (typeof position !== "number" || !Number.isInteger(position) || position < 0)) {
    fields.position = "Must be a non-negative integer";
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid resource", fields);
  }

  const updated = await updateResource(db, resourceId, eventId, {
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

  const { fileId } = await deleteResource(db, resourceId, eventId);
  if (fileId) {
    // DEC-047: file-kind resource — cascade-delete the file row + R2 object.
    // Fail loudly (getFileForDelete throws) rather than leaving an orphan
    // file row after the resource row is already gone.
    //
    // DEC-713 ordering (amended wave 50): row-delete commits FIRST, then the
    // R2 object is deleted. The two failure modes are not symmetric — a
    // committed row pointing at missing bytes 404s forever and silently
    // breaks the "history complete and downloadable" guarantee, while an
    // object outliving its row is just an unreferenced blob, invisible and
    // reclaimable. A store.delete throw after the commit is logged and
    // swallowed: a committed delete must never be reported as a failure.
    const { r2Key } = await getFileForDelete(db, fileId);
    await deleteFileRow(db, fileId);

    const store = makeFileStore(c.env.FILES);
    try {
      await store.delete(r2Key);
    } catch (err) {
      console.error(`portal-config/resources delete: store.delete failed for file ${fileId} after row commit (key ${r2Key})`, err);
    }
  }
  return c.body(null, 204);
});
