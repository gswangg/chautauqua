// Per-recipient send detail (DEC-833/DEC-949). Split out of the former
// monolithic src/routes/comms.ts — no behavior change.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { getEmailLogById } from "../../server/repo/email";
import { redactCredentialUrls } from "../../auth/credential-urls";

export const emailLogRoutes = new Hono<AppEnv>();

// Email log history: GET /api/v1/events/:eventId/email-log already landed on
// main (w2-i) at src/routes/api/email-log.ts, mounted separately in
// src/index.ts — not duplicated here (the task's contingency clause only
// applies if that route were missing). This file extends its repo function
// (listEmailLog, src/server/repo/email.ts) with the ?q filter the HistoryTab
// needs; see that route file for the endpoint itself.

// DEC-833: the audit surface for a single recipient's stored email_log row —
// getEmailLogById is already org-scoped (src/server/repo/email.ts:184), but
// an id belonging to a different event within the SAME org must still 404
// rather than let one event's "Show what was sent" disclosure read another
// event's mail (object-level ownership, not just org scoping).
emailLogRoutes.get("/api/v1/events/:eventId/email-log/:emailId", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const emailId = c.req.param("emailId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  const row = await getEmailLogById(c.var.db, emailId, auth.orgId);
  if (!row || row.eventId !== eventId) throw new ApiError("not_found", "Email not found");

  // DEC-949 (wave 34 amendment): the organizer-readable audit view never
  // renders a live claim OR reset grant — a `/claim/<token>` or
  // `/reset/<token>` URL stored verbatim in email_log is an account-
  // takeover credential. /dev/mailbox is intentionally left unredacted: it
  // is mounted only when DEV_MODE="1" and therefore does not exist in
  // production, which is what keeps the walkthrough gates able to click a
  // claim/reset link.
  return c.json({
    ...row,
    bodyText: redactCredentialUrls(row.bodyText),
    bodyHtml: row.bodyHtml === null ? null : redactCredentialUrls(row.bodyHtml),
  });
});
