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
import { portalNotFound } from "../shared";
import { ResourcesPage } from "./views";

export const portalResourcesRoutes = new Hono<AppEnv>();

portalResourcesRoutes.get("/resources", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");

  // DEC-988 (wave-74 amendment): the producer's "Show resources" toggle is
  // PER EVENT — filter the speaker's resource groups down to events whose
  // flag is true. The 404 refusal is keyed on the PERMITTED-EVENT set, not
  // on the resulting group count: a speaker with zero resources yet, in an
  // event where the toggle is on, still sees the normal "No resources yet"
  // empty state (200) — only a speaker with NO permitted event at all is
  // refused, so nobody is locked out of Event B's resources because Event
  // A's toggle happens to be off.
  const [data, allGroups] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMyResources(c.var.db, contactId, auth.orgId),
  ]);
  const permittedEventIds = new Set(
    Object.entries(data.showResourcesByEventId)
      .filter(([, allowed]) => allowed)
      .map(([eventId]) => eventId),
  );
  if (permittedEventIds.size === 0) return portalNotFound(c);
  const groups = allGroups.filter((g) => permittedEventIds.has(g.eventId));

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

  // DEC-988 (wave-74 amendment): gate on the RESOURCE's OWN event, not the
  // portal's single "most recent submission" branding event — a direct
  // download link must not survive that resource's own event turning the
  // section off, still before any bytes stream.
  const data = await getPortalData(c.var.db, contactId, auth.orgId);
  if (!(data.showResourcesByEventId[scope.eventId] ?? true)) return portalNotFound(c);

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
