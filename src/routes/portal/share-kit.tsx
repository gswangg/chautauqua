// Share kit (a multi-portal library item kind): the promotion copy an
// organizer wrote for speakers or sponsors, filled in for this person and
// session, with share links and a "Mark as shared" that completes the item.
// Placeholders in the instructions: {name}, {event}, {session}, {link}.
// Own-assignment only (getAssignmentScope + assertOwnAssignmentOr403, the
// same gate every /portal/tasks/:assignmentId route uses). Route file
// exports a sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import * as schema from "../../db/schema";
import { ApiError } from "../../server/http";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";
import { CSRF_COOKIE_NAME } from "../../auth/cookies";
import { resolveBaseUrl } from "../../server/origin";
import { getAssignmentScope, getPortalData } from "../../server/repo/portal";
import { PortalBackLink, PortalLayout, speakerGate } from "./shared";
import { assertOwnAssignmentOr403, ensureCsrfCookie, requireAuth } from "./tasks/shared";

export const portalShareKitRoutes = new Hono<AppEnv>();

portalShareKitRoutes.use("/tasks/:assignmentId/share", speakerGate);

const DEFAULT_SHARE_TEXT = "I'm speaking at {event}: {session}. {link}";

/** Fills the share-kit template for one person. Unknown placeholders stay as
 * typed, so a typo shows rather than vanishing. */
export function fillShareText(template: string, values: { name: string; event: string; session: string; link: string }): string {
  return template.replace(/\{(name|event|session|link)\}/g, (_m, key: keyof typeof values) => values[key]);
}

portalShareKitRoutes.get("/tasks/:assignmentId/share", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");
  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "share_kit") throw new ApiError("not_found", "Task assignment not found");

  const [data, taskRows, eventRows, assignmentRows] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    c.var.db.select({ title: schema.task.title, instructions: schema.task.instructions }).from(schema.task).where(eq(schema.task.id, scope.taskId)).limit(1),
    c.var.db.select({ name: schema.event.name, slug: schema.event.slug }).from(schema.event).where(eq(schema.event.id, scope.eventId)).limit(1),
    c.var.db.select({ scopeKey: schema.taskAssignment.scopeKey }).from(schema.taskAssignment).where(eq(schema.taskAssignment.id, assignmentId)).limit(1),
  ]);
  const task = taskRows[0];
  const event = eventRows[0];
  if (!task || !event) throw new ApiError("not_found", "Task assignment not found");
  const origin = resolveBaseUrl(c);

  // an item about one session or sponsor company names it; otherwise the
  // event page
  let session = "";
  let link = `${origin}/e/${event.slug}`;
  const scopeKey = assignmentRows[0]?.scopeKey ?? "";
  if (scopeKey.startsWith("p:")) {
    const parts = await c.var.db
      .select({ submissionId: schema.participant.submissionId, contactId: schema.participant.contactId, title: schema.submission.title })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
      .where(and(eq(schema.participant.id, scopeKey.slice(2)), inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES)))
      .limit(1);
    const p = parts[0];
    if (p && p.contactId === contactId) {
      session = p.title;
      link = `${origin}/e/${event.slug}/sessions/${p.submissionId}`;
    }
  } else if (scopeKey.startsWith("c:")) {
    const rows = await c.var.db
      .select({ contactId: schema.sponsorContact.contactId, companyName: schema.sponsorCompany.name })
      .from(schema.sponsorContact)
      .innerJoin(schema.sponsorship, eq(schema.sponsorship.id, schema.sponsorContact.sponsorshipId))
      .innerJoin(schema.sponsorCompany, eq(schema.sponsorCompany.id, schema.sponsorship.companyId))
      .where(eq(schema.sponsorContact.id, scopeKey.slice(2)))
      .limit(1);
    if (rows[0] && rows[0].contactId === contactId) session = rows[0].companyName;
  }
  const text = fillShareText(task.instructions?.trim() || DEFAULT_SHARE_TEXT, {
    name: data.contactName,
    event: event.name,
    session,
    link,
  });
  const enc = encodeURIComponent;
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(
    <PortalLayout branding={data.branding} csrfToken={csrfToken} speakerName={data.contactName}>
      <PortalBackLink to="/portal" />
      <h1 class="chq-portal-hero chq-portal-hero-drill">{task.title}</h1>
      <p class="chq-portal-sub">Copy this, or share it straight from here.</p>
      <div class="chq-portal-field">
        <label class="chq-portal-field-label" for="share-text">Share text</label>
        <textarea class="chq-textarea" id="share-text" rows={5} readOnly maxLength={4000}>
          {text}
        </textarea>
      </div>
      <div class="chq-home-actions">
        <a class="chq-btn chq-btn-secondary" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(link)}`} rel="noopener" target="_blank">
          Share on LinkedIn
        </a>
        <a class="chq-btn chq-btn-secondary" href={`https://bsky.app/intent/compose?text=${enc(text)}`} rel="noopener" target="_blank">
          Share on Bluesky
        </a>
        <a class="chq-btn chq-btn-secondary" href={`https://twitter.com/intent/tweet?text=${enc(text)}`} rel="noopener" target="_blank">
          Share on X
        </a>
      </div>
      {scope.status === "complete" ? (
        <p role="status">Marked as shared. Thank you.</p>
      ) : (
        <form method="post" action={`/portal/tasks/${assignmentId}/complete`} class="chq-home-actions">
          <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
          <button type="submit" class="chq-btn chq-btn-primary">Mark as shared</button>
        </form>
      )}
    </PortalLayout>,
  );
});
