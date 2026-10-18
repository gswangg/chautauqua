// Preview as participant (Portals frame, flow 4): an organizer sees one
// person's home exactly as the participant does, rendered from the same
// person view (src/server/repo/portals/view.ts), under a fixed ink bar that
// can't be scrolled away. Read-only: every control is disabled and no link
// leads into the person's own pages. Every open writes an audit_event row
// (who looked at whose portal, when). Organizer-only; every other session
// gets the portal's ordinary 404, like /portal/preview. Mounted ahead of
// the speaker-gated portal routes (src/index.ts); only src/index.ts mounts
// it (DEC-012).

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import * as schema from "../../db/schema";
import { getEventForOrg } from "../../server/repo/events";
import { buildPersonView } from "../../server/repo/portals/view";
import { sessionPlacementLine } from "../../server/repo/portals/invitations";
import { writeAuditEvent } from "../../server/repo/audit";
import { ANONYMOUS_NOT_FOUND_LINKS, NotFoundDocument, ORGANIZER_NOT_FOUND_LINKS, resolveNotFoundEyebrow } from "../../server/not-found";
import { PortalLayout } from "./shared";
import { HomeBody } from "./home";
import { ensureCsrfCookie } from "./tasks/shared";

export const portalPersonPreviewRoutes = new Hono<AppEnv>();

portalPersonPreviewRoutes.get("/preview/people/:eventId/:contactId", async (c) => {
  const auth = c.var.auth;
  // DEC-550: anonymous is turned away before any db access, with the
  // db-free default eyebrow (the same split as /portal/preview)
  if (!auth) {
    return c.html(
      <NotFoundDocument eyebrow="Not found" body="The link may be old, or the event may have been switched since it was saved." links={ANONYMOUS_NOT_FOUND_LINKS} />,
      404,
    );
  }
  const notFound = async () => {
    const eyebrow = await resolveNotFoundEyebrow(c.var.db);
    const links = auth?.role === "organizer" ? ORGANIZER_NOT_FOUND_LINKS : ANONYMOUS_NOT_FOUND_LINKS;
    return c.html(<NotFoundDocument eyebrow={eyebrow} body="The link may be old, or the event may have been switched since it was saved." links={links} />, 404);
  };
  if (!auth || auth.role !== "organizer") return notFound();
  const eventId = c.req.param("eventId");
  const contactId = c.req.param("contactId");
  const event = await getEventForOrg(c.var.db, eventId, auth.orgId);
  if (!event) return notFound();
  const contacts = await c.var.db
    .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
    .from(schema.contact)
    .where(and(eq(schema.contact.id, contactId), eq(schema.contact.orgId, auth.orgId)))
    .limit(1);
  const contact = contacts[0];
  if (!contact) return notFound();
  const name = `${contact.firstName} ${contact.lastName}`.trim();

  const now = new Date();
  const users = await c.var.db
    .select({ name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, auth.userId))
    .limit(1);
  await writeAuditEvent(
    c.var.db,
    {
      orgId: auth.orgId,
      eventId,
      actor: { userId: auth.userId, contactId: null, label: users[0]?.name?.trim() || users[0]?.email || "An organizer" },
      action: "portal.preview",
      targetType: "contact",
      targetId: contactId,
      subjectContactId: contactId,
      details: { name },
    },
    now,
  );

  const view = await buildPersonView(c.var.db, { eventId, contactId, now: now.getTime() });
  const placements = new Map<string, string | null>();
  for (const s of view.sections) {
    const sid = s.participation.session?.submissionId;
    if (sid && !placements.has(sid)) placements.set(sid, await sessionPlacementLine(c.var.db, sid));
  }
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  c.header("Cache-Control", "no-store");
  return c.html(
    <PortalLayout
      branding={{ eventName: event.name, welcomeMessage: null, accentColor: null, logoUrl: null }}
      csrfToken={csrfToken}
      speakerName={name}
      headerSignOut={false}
    >
      <div class="chq-preview-bar" role="note">
        <span class="chq-preview-bar-label">Preview</span>
        <span class="chq-preview-bar-text">Viewing {name}’s portal. Personal data — this view is logged.</span>
        <a class="chq-preview-bar-exit" href={`/admin/contacts/${contactId}`}>
          Exit preview
        </a>
      </div>
      <HomeBody firstName={contact.firstName || name} data={{ views: [view], placements }} csrfToken={csrfToken} preview={true} />
    </PortalLayout>,
  );
});
