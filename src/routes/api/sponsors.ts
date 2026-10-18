// Sponsorships organizer API (Portals frame, flow 5): tiers and their
// entitlements, sponsors and their contacts, and the approval queue for
// sponsor-designed sessions. Organizer-only, every route scoped by an event
// the caller's org owns. Only src/index.ts mounts this sub-app (DEC-012).

import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import * as schema from "../../db/schema";
import type { KVStore } from "../../auth/claim";
import { csrfJson, requireCookieSession, requireOrganizer } from "../../server/middleware";
import { ApiError, readJsonBody, requireAtLeastOneField } from "../../server/http";
import { makeMailer } from "../../server/context";
import { resolveBaseUrl } from "../../server/origin";
import { requireOwnedEvent } from "../comms/shared";
import { writeAuditEvent, listAuditEventsForTarget, type AuditActor } from "../../server/repo/audit";
import {
  addSponsorContact,
  createSponsorship,
  deleteTier,
  findSponsorship,
  findTier,
  listSponsorContacts,
  listSponsorships,
  listTiers,
  parseEntitlementInputs,
  parsePersonInput,
  previewTierChange,
  removeSponsorContact,
  saveTier,
  updateSponsorship,
} from "../../server/repo/sponsors/organizer";
import {
  approveSponsorSession,
  countWaitingSponsorSessions,
  declineSponsorSession,
  getSponsorSessionForEvent,
  listSponsorRecipients,
  listSponsorSessionQueue,
  requestSponsorSessionChanges,
} from "../../server/repo/sponsors/sessions";
import { loadPackages } from "../../server/repo/sponsors/package";
import { sendSponsorSessionNotice, sendSponsorSpeakerWelcome } from "../../server/repo/portals/mail";
import { getFieldOptionsByRole } from "../../server/repo/form-roles";
import { reconcileEventPortals } from "../../server/repo/portals/reconcile";
import { scheduleReconcile } from "../../server/portal-sync";

export const sponsorsRoutes = new Hono<AppEnv>();

async function organizerActor(c: Context<AppEnv>): Promise<AuditActor> {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const rows = await c.var.db
    .select({ name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, auth.userId))
    .limit(1);
  const u = rows[0];
  return { userId: auth.userId, contactId: null, label: u?.name?.trim() || u?.email || "An organizer" };
}

// ---------------------------------------------------------------------------
// Overview: tiers and sponsors
// ---------------------------------------------------------------------------

sponsorsRoutes.get("/events/:eventId/sponsorships", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const [tiers, sponsors, waiting, formats] = await Promise.all([
    listTiers(c.var.db, eventId),
    listSponsorships(c.var.db, eventId),
    countWaitingSponsorSessions(c.var.db, eventId),
    getFieldOptionsByRole(c.var.db, eventId, "session_format"),
  ]);
  // formats and lengths come from Settings · Call for papers
  return c.json({ tiers, sponsors, waiting, formats: formats ?? [] });
});

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

sponsorsRoutes.post("/events/:eventId/sponsor-tiers", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const body = await readJsonBody(c);
  const now = new Date();
  const saved = await saveTier(c.var.db, eventId, { id: null, name: body.name, entitlements: body.entitlements ?? [] }, now);
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor: await organizerActor(c), action: "sponsor_tier.update", targetType: "sponsor_tier", targetId: saved.id, details: { before: null, after: saved.after } },
    now,
  );
  return c.json({ id: saved.id }, 201);
});

// Which sponsors would go over the edited allowance. Nothing is written.
sponsorsRoutes.post("/events/:eventId/sponsor-tiers/:tierId/preview", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const tierId = c.req.param("tierId");
  if (!(await findTier(c.var.db, eventId, tierId))) throw new ApiError("not_found", "Tier not found");
  const body = await readJsonBody(c);
  const over = await previewTierChange(c.var.db, eventId, tierId, parseEntitlementInputs(body.entitlements ?? []));
  return c.json({ over });
});

sponsorsRoutes.put("/events/:eventId/sponsor-tiers/:tierId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const tierId = c.req.param("tierId");
  const body = await readJsonBody(c);
  const now = new Date();
  const saved = await saveTier(c.var.db, eventId, { id: tierId, name: body.name, entitlements: body.entitlements ?? [] }, now);
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor: await organizerActor(c), action: "sponsor_tier.update", targetType: "sponsor_tier", targetId: tierId, details: { before: saved.before, after: saved.after } },
    now,
  );
  scheduleReconcile(c, [eventId]);
  return c.json({ ok: true });
});

sponsorsRoutes.delete("/events/:eventId/sponsor-tiers/:tierId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const tierId = c.req.param("tierId");
  const now = new Date();
  await deleteTier(c.var.db, eventId, tierId);
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor: await organizerActor(c), action: "sponsor_tier.update", targetType: "sponsor_tier", targetId: tierId, details: { deleted: true } },
    now,
  );
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Sponsors
// ---------------------------------------------------------------------------

sponsorsRoutes.post("/events/:eventId/sponsorships", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const body = await readJsonBody(c);
  const now = new Date();
  // parse the first contact before writing anything, so a bad email fails
  // the whole add
  const contact = body.contact && typeof body.contact === "object" ? parsePersonInput(body.contact as Record<string, unknown>) : null;
  const id = await createSponsorship(c.var.db, { orgId: event.orgId, eventId, companyName: body.companyName, tierId: body.tierId, status: body.status }, now);
  if (contact) {
    await addSponsorContact(
      c.var.db,
      { orgId: event.orgId, eventId, sponsorshipId: id, person: contact, status: "joined", isPrimary: true, invitedByContactId: null },
      now,
    );
  }
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor: await organizerActor(c), action: "sponsorship.update", targetType: "sponsorship", targetId: id, details: { created: true } },
    now,
  );
  await reconcileEventPortals(c.var.db, eventId, now, { notify: "auto" });
  return c.json({ id }, 201);
});

sponsorsRoutes.get("/events/:eventId/sponsorships/:sponsorshipId", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const sponsorshipId = c.req.param("sponsorshipId");
  const sponsorship = await findSponsorship(c.var.db, eventId, sponsorshipId);
  if (!sponsorship) throw new ApiError("not_found", "Sponsorship not found");
  const [contacts, packages] = await Promise.all([listSponsorContacts(c.var.db, sponsorshipId), loadPackages(c.var.db, [sponsorshipId])]);
  const pkg = packages.get(sponsorshipId)!;
  return c.json({ sponsorship, contacts, entitlements: pkg.entitlements, slots: pkg.slots, over: pkg.over });
});

sponsorsRoutes.patch("/events/:eventId/sponsorships/:sponsorshipId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const sponsorshipId = c.req.param("sponsorshipId");
  const body = await readJsonBody(c);
  requireAtLeastOneField(body, ["tierId", "status", "extras"]);
  const now = new Date();
  const { changes } = await updateSponsorship(c.var.db, eventId, sponsorshipId, { tierId: body.tierId, status: body.status, extras: body.extras }, now);
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor: await organizerActor(c), action: "sponsorship.update", targetType: "sponsorship", targetId: sponsorshipId, details: changes },
    now,
  );
  await reconcileEventPortals(c.var.db, eventId, now, { notify: "auto" });
  return c.json({ ok: true });
});

sponsorsRoutes.post("/events/:eventId/sponsorships/:sponsorshipId/contacts", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const sponsorshipId = c.req.param("sponsorshipId");
  if (!(await findSponsorship(c.var.db, eventId, sponsorshipId))) throw new ApiError("not_found", "Sponsorship not found");
  const body = await readJsonBody(c);
  const now = new Date();
  const result = await addSponsorContact(
    c.var.db,
    { orgId: event.orgId, eventId, sponsorshipId, person: parsePersonInput(body), status: "joined", isPrimary: body.primary === true, invitedByContactId: null },
    now,
  );
  await reconcileEventPortals(c.var.db, eventId, now, { notify: "auto" });
  return c.json(result, 201);
});

sponsorsRoutes.delete("/events/:eventId/sponsorships/:sponsorshipId/contacts/:sponsorContactId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const sponsorshipId = c.req.param("sponsorshipId");
  if (!(await findSponsorship(c.var.db, eventId, sponsorshipId))) throw new ApiError("not_found", "Sponsorship not found");
  await removeSponsorContact(c.var.db, sponsorshipId, c.req.param("sponsorContactId"));
  await reconcileEventPortals(c.var.db, eventId, new Date(), { notify: "none" });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Sponsor sessions: the approval queue
// ---------------------------------------------------------------------------

sponsorsRoutes.get("/events/:eventId/sponsor-sessions", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  return c.json(await listSponsorSessionQueue(c.var.db, eventId));
});

sponsorsRoutes.get("/events/:eventId/sponsor-sessions/:sessionId", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const sessionId = c.req.param("sessionId");
  const session = await getSponsorSessionForEvent(c.var.db, eventId, sessionId);
  if (!session) throw new ApiError("not_found", "Sponsor session not found");
  const history = await listAuditEventsForTarget(c.var.db, "sponsor_session", sessionId);
  return c.json({ session, history });
});

sponsorsRoutes.post("/events/:eventId/sponsor-sessions/:sessionId/request-changes", requireOrganizer, requireCookieSession, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const sessionId = c.req.param("sessionId");
  const body = await readJsonBody(c);
  const actor = await organizerActor(c);
  const now = new Date();
  const detail = await requestSponsorSessionChanges(c.var.db, eventId, sessionId, { note: body.note, organizerName: actor.label }, now);
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor, action: "sponsor_session.request_changes", targetType: "sponsor_session", targetId: sessionId, details: { note: detail.lastNote } },
    now,
  );
  const recipients = await listSponsorRecipients(c.var.db, detail.sponsorshipId);
  const mail = await sendSponsorSessionNotice(c.var.db, makeMailer(c.var.db, c.env), c.env.KV as unknown as KVStore, {
    eventId,
    origin: resolveBaseUrl(c),
    contactIds: recipients.map((r) => r.contactId),
    companyName: detail.companyName,
    sessionTitle: detail.title,
    decision: "changes_requested",
    note: detail.lastNote,
    organizerName: actor.label,
  });
  return c.json({ session: detail, told: recipients.map((r) => `${r.firstName} ${r.lastName}`.trim()), mail });
});

sponsorsRoutes.post("/events/:eventId/sponsor-sessions/:sessionId/decline", requireOrganizer, requireCookieSession, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const sessionId = c.req.param("sessionId");
  const body = await readJsonBody(c);
  const actor = await organizerActor(c);
  const now = new Date();
  const detail = await declineSponsorSession(c.var.db, eventId, sessionId, { reason: body.reason, organizerName: actor.label }, now);
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor, action: "sponsor_session.decline", targetType: "sponsor_session", targetId: sessionId, details: { reason: detail.declineReason } },
    now,
  );
  const recipients = await listSponsorRecipients(c.var.db, detail.sponsorshipId);
  const mail = await sendSponsorSessionNotice(c.var.db, makeMailer(c.var.db, c.env), c.env.KV as unknown as KVStore, {
    eventId,
    origin: resolveBaseUrl(c),
    contactIds: recipients.map((r) => r.contactId),
    companyName: detail.companyName,
    sessionTitle: detail.title,
    decision: "declined",
    note: detail.declineReason,
    organizerName: actor.label,
  });
  return c.json({ session: detail, told: recipients.map((r) => `${r.firstName} ${r.lastName}`.trim()), mail });
});

sponsorsRoutes.post("/events/:eventId/sponsor-sessions/:sessionId/approve", requireOrganizer, requireCookieSession, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const sessionId = c.req.param("sessionId");
  const actor = await organizerActor(c);
  const now = new Date();
  const { detail, submissionId, newSpeakers } = await approveSponsorSession(c.var.db, eventId, sessionId, { organizerName: actor.label }, now);
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor, action: "sponsor_session.approve", targetType: "sponsor_session", targetId: sessionId, details: { submissionId, speakers: detail.speakers.length } },
    now,
  );
  // the new session's speakers are accepted speakers like any other: their
  // portals pick them up now
  await reconcileEventPortals(c.var.db, eventId, now, { notify: "auto" });
  const kv = c.env.KV as unknown as KVStore;
  const mailer = makeMailer(c.var.db, c.env);
  const origin = resolveBaseUrl(c);
  const recipients = await listSponsorRecipients(c.var.db, detail.sponsorshipId);
  const [told, invited] = await Promise.all([
    sendSponsorSessionNotice(c.var.db, mailer, kv, {
      eventId,
      origin,
      contactIds: recipients.map((r) => r.contactId),
      companyName: detail.companyName,
      sessionTitle: detail.title,
      decision: "approved",
      note: null,
      organizerName: actor.label,
    }),
    sendSponsorSpeakerWelcome(c.var.db, mailer, kv, {
      eventId,
      origin,
      contactIds: newSpeakers.filter((s) => !recipients.some((r) => r.contactId === s.contactId)).map((s) => s.contactId),
      companyName: detail.companyName,
      sessionTitle: detail.title,
    }),
  ]);
  return c.json({
    session: detail,
    submissionId,
    invited: newSpeakers.map((s) => s.name),
    told: recipients.map((r) => `${r.firstName} ${r.lastName}`.trim()),
    mail: { told, invited },
  });
});
