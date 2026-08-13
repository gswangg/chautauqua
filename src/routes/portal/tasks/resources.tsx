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
import { isImageContentType } from "../../../domain/files";
import { requireAuth, ensureCsrfCookie } from "./shared";
import { ResourcesPage } from "./views";

export const portalResourcesRoutes = new Hono<AppEnv>();

portalResourcesRoutes.get("/resources", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");

  const [data, groups] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMyResources(c.var.db, contactId, auth.orgId),
  ]);
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

  const scope = await getResourceDownloadScope(c.var.db, resourceId, contactId, auth.orgId);
  if (!scope) throw new ApiError("not_found", "Resource not found");

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
