// GET /api/v1/events/:eventId/email-log — J5 per-recipient comms history for
// the admin Comms screen. Organizer-only (DEC-013 default), DEC-013 list
// envelope { items, total, page, perPage }. Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { listEmailBatches, listEmailLog } from "../../server/repo/email";
import { clampPage, clampPerPage } from "../../lib/pagination";
import { ApiError, parseBoundedText } from "../../server/http";
import * as schema from "../../db/schema";
import { EMAIL_LOG_STATUSES } from "../../mail/types";

export const emailLogRoutes = new Hono<AppEnv>();

emailLogRoutes.get("/api/v1/events/:eventId/email-log", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  // Object-level ownership check: the event must belong to the caller's org.
  const eventRows = await c.var.db
    .select({ id: schema.event.id, orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const eventRow = eventRows[0];
  if (!eventRow || eventRow.orgId !== auth.orgId) {
    throw new ApiError("not_found", "Event not found");
  }

  const page = clampPage(c.req.query("page"));
  const perPage = clampPerPage(c.req.query("perPage"));
  const contactIdRaw = c.req.query("contactId") || undefined;
  const contactId =
    contactIdRaw !== undefined
      ? parseBoundedText(contactIdRaw, "contactId", { max: 64, required: false })
      : undefined;
  const statusRaw = c.req.query("status") || undefined;
  if (statusRaw !== undefined && !(EMAIL_LOG_STATUSES as readonly string[]).includes(statusRaw)) {
    throw new ApiError("invalid", `status must be one of ${EMAIL_LOG_STATUSES.join(", ")}`, {
      status: "invalid",
    });
  }
  const status = statusRaw;
  const qRaw = c.req.query("q") || undefined;
  const q = qRaw !== undefined ? parseBoundedText(qRaw, "q", { max: 200, required: false }) : undefined;
  const batchIdRaw = c.req.query("batchId") || undefined;
  const batchId =
    batchIdRaw !== undefined
      ? parseBoundedText(batchIdRaw, "batchId", { max: 64, required: false })
      : undefined;
  const templateIdRaw = c.req.query("templateId") || undefined;
  const templateId =
    templateIdRaw !== undefined
      ? parseBoundedText(templateIdRaw, "templateId", { max: 64, required: false })
      : undefined;

  // DEC-905: epoch-ms lower bound on sentAt, backing the Comms head's "N
  // sent in the last 7 days" -- fails loudly on a malformed value rather
  // than silently ignoring the filter.
  const sinceRaw = c.req.query("since");
  let since: number | undefined;
  if (sinceRaw !== undefined) {
    const n = Number(sinceRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new ApiError("invalid", "since must be a non-negative integer epoch-ms timestamp", { since: "invalid" });
    }
    since = n;
  }

  // DEC-603: ?groupBy=batch collapses a fan-out send's recipient rows into
  // one row (when/subject/N recipients/status tally); ?batchId= drills into
  // one batch's recipients (flat shape, same as the default), keeping
  // contactId's existing per-contact filter behavior intact alongside it.
  if (c.req.query("groupBy") === "batch") {
    // DEC-905: batch grain has no per-recipient status/contact, and no
    // single-batch drill-down (that's ?batchId= on the flat shape below) --
    // silently dropping those filters would answer a narrower question than
    // the one asked, so name the parameter batch grain can't express.
    if (status !== undefined) {
      throw new ApiError("invalid", "status cannot be combined with groupBy=batch", { groupBy: "status" });
    }
    if (contactId !== undefined) {
      throw new ApiError("invalid", "contactId cannot be combined with groupBy=batch", { groupBy: "contactId" });
    }
    if (batchId !== undefined) {
      throw new ApiError("invalid", "batchId cannot be combined with groupBy=batch", { groupBy: "batchId" });
    }
    const { items, total } = await listEmailBatches(c.var.db, { eventId, q, since, templateId, page, perPage });
    return c.json({ items, total, page, perPage });
  }

  const { items, total } = await listEmailLog(c.var.db, {
    eventId,
    contactId,
    status,
    q,
    batchKey: batchId,
    since,
    templateId,
    page,
    perPage,
  });

  return c.json({ items, total, page, perPage });
});
