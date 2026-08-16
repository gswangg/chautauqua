// Portal resources routes (list + download) — split out of the former
// single-file src/routes/portal/tasks.tsx (an 840-line merge-conflict
// hotspot). Mounted by ../tasks.tsx at "/" so the full URL space (/resources,
// /resources/:resourceId/download) under app.route("/portal", ...) is
// unchanged. No behavior change from the original inline handlers.

import { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { ApiError } from "../../../server/http";
import { makeFileStore } from "../../../server/context";
import { getMyResources, getPortalData, getResourceDownloadScope } from "../../../server/repo/portal";
import { assertServedContentTypeHeader, contentDispositionAttachment, isImageContentType } from "../../../domain/files";
import { requireAuth, ensureCsrfCookie } from "./shared";
import { ResourcesPage } from "./views";

export const portalResourcesRoutes = new Hono<AppEnv>();

portalResourcesRoutes.get("/resources", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");

  const data = await getPortalData(c.var.db, contactId, auth.orgId);
  // DEC-988 (wave-56 amendment): the producer's "Show resources" toggle
  // must be enforced server-side, not just hidden from navigation — refuse
  // before any resource read.
  if (!data.branding.showResources) return c.text("Not found", 404);

  const groups = await getMyResources(c.var.db, contactId, auth.orgId);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(
    <ResourcesPage branding={data.branding} groups={groups} csrfToken={csrfToken} speakerName={data.contactName} />,
  );
});

portalResourcesRoutes.get("/resources/:resourceId/download", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const resourceId = c.req.param("resourceId");

  // DEC-988 (wave-56 amendment): same server-side refusal as GET /resources
  // — a direct download link must not survive the section being turned off.
  const data = await getPortalData(c.var.db, contactId, auth.orgId);
  if (!data.branding.showResources) return c.text("Not found", 404);

  const scope = await getResourceDownloadScope(c.var.db, resourceId, contactId, auth.orgId);
  if (!scope) throw new ApiError("not_found", "Resource not found");

  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(scope.r2Key);
  if (!obj) throw new ApiError("not_found", "File contents not found");

  const contentType = assertServedContentTypeHeader(scope.contentType);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
  if (!isImageContentType(contentType)) {
    headers["Content-Disposition"] = contentDispositionAttachment(scope.filename);
  }
  return c.body(obj.body, 200, headers);
});
