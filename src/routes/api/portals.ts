// Multi-portal organizer API (Portals frame, flows 1-4 and 8): portals and
// their change preview, the item library, the person record, event roles,
// invitations to speak, and copying from another event. Organizer-only,
// every route scoped by an event the caller's org owns. Route file exports a
// sub-app; only src/index.ts mounts it (DEC-012).

import { Hono, type Context } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import * as schema from "../../db/schema";
import { csrfJson, requireCookieSession, requireOrganizer } from "../../server/middleware";
import { ApiError, readJsonBody, requireAtLeastOneField } from "../../server/http";
import { makeMailer } from "../../server/context";
import { resolveBaseUrl } from "../../server/origin";
import { requireOwnedEvent } from "../comms/shared";
import { isIsoDate } from "../../domain/iso-date";
import { participantRoleLabel } from "../../domain/participant-roles";
import { writeAuditEvent, type AuditActor } from "../../server/repo/audit";
import { reconcileEventPortals, type NotifyMode } from "../../server/repo/portals/reconcile";
import {
  copyFromEvent,
  createPortal,
  createPortalFromTemplate,
  deletePortal,
  duplicatePortal,
  getPortalEditorData,
  getPortalOverview,
  listCopySources,
  listUnmatchedParticipations,
  matchRule,
  parsePortalInput,
  portalToInput,
  previewPortalChange,
  updatePortal,
} from "../../server/repo/portals/admin";
import { findPortal } from "../../server/repo/portals/store";
import { createLibraryItem, listLibrary, parseLibraryItemInput, setResourceVisibility, updateLibraryTask, type LibraryItemInput } from "../../server/repo/portals/library";
import { buildPersonView } from "../../server/repo/portals/view";
import { addEventRole, listEventRoles, removeEventRole } from "../../server/repo/portals/event-roles";
import { inviteToSpeak, sessionPlacementLine } from "../../server/repo/portals/invitations";
import { sendInvitationToSpeak } from "../../server/repo/portals/mail";
import { parsePortalRule } from "../../domain/portals/rules";
import { scheduleReconcile } from "../../server/portal-sync";
import { getPortalSettingsForEvent, upsertPortalSettings } from "../../server/repo/portal-config";
import { MAX_LONG_TEXT_LENGTH } from "../../forms/validate";
import { overCapFieldMessage } from "../../domain/cap-copy";
import { PROFILE_BASICS_TEMPLATE } from "../../domain/portals/templates";

export const portalsRoutes = new Hono<AppEnv>();

// "We'd love you to give a talk at DevFlow Conf 2027."
const INVITATION_PITCH: Record<string, string> = {
  speaker: "give a talk",
  "co-presenter": "co-present a session",
  moderator: "moderate a session",
  panelist: "join a panel",
};

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

function parseNotify(v: unknown): NotifyMode {
  if (v === undefined || v === null) return "auto";
  if (v === "auto" || v === "all" || v === "none") return v;
  throw new ApiError("invalid", "notify must be auto, all or none", { notify: "Invalid value" });
}

async function portalInEvent(c: Context<AppEnv>, eventId: string, portalId: string) {
  const portal = await findPortal(c.var.db, portalId);
  if (!portal || portal.eventId !== eventId) throw new ApiError("not_found", "Portal not found");
  return portal;
}

// Profile basics' note is the event's welcome note (the Speaker portal
// section's, migrated): it is edited here and still shown where it always
// was, at the top of every participant's home -- so it is stored on the
// portal settings row, not as a second copy on the portal. Takes the note
// out of the body before the portal fields are parsed, with the welcome
// note's own length cap.
function takeWelcomeNote(body: Record<string, unknown>): { body: Record<string, unknown>; welcome: string | null } {
  const note = body.note;
  if (note !== undefined && note !== null && typeof note !== "string") {
    throw new ApiError("invalid", "The note must be text.", { note: "Must be a string" });
  }
  if (typeof note === "string" && note.length > MAX_LONG_TEXT_LENGTH) {
    throw new ApiError("invalid", overCapFieldMessage(note.length, MAX_LONG_TEXT_LENGTH), { note: overCapFieldMessage(note.length, MAX_LONG_TEXT_LENGTH) });
  }
  return { body: { ...body, note: null }, welcome: typeof note === "string" && note.trim() !== "" ? note : null };
}

// ---------------------------------------------------------------------------
// Portals
// ---------------------------------------------------------------------------

portalsRoutes.get("/events/:eventId/portals", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  return c.json(await getPortalOverview(c.var.db, eventId));
});

portalsRoutes.get("/events/:eventId/portals/unmatched", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const rows = await listUnmatchedParticipations(c.var.db, eventId);
  return c.json({ rows, total: rows.length });
});

portalsRoutes.get("/events/:eventId/portals/copy-sources", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  return c.json({ events: await listCopySources(c.var.db, event.orgId, eventId) });
});

// Creates a portal: from a starter template ({ template }), or blank.
portalsRoutes.post("/events/:eventId/portals", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const body = await readJsonBody(c);
  const now = new Date();
  let id: string;
  if (typeof body.template === "string" && body.template !== "") {
    id = await createPortalFromTemplate(c.var.db, eventId, body.template, now);
  } else {
    const input = parsePortalInput({ name: body.name ?? "New portal", rule: { groups: [] } });
    id = await createPortal(c.var.db, eventId, input, now);
  }
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor: await organizerActor(c), action: "portal.create", targetType: "portal", targetId: id, details: { template: typeof body.template === "string" ? body.template : null } },
    now,
  );
  // a template's rule may match people already: give them their items now
  // (the organizer reviews who'll be emailed on the first edit, not here)
  await reconcileEventPortals(c.var.db, eventId, now, { notify: "none" });
  return c.json({ id }, 201);
});

portalsRoutes.post("/events/:eventId/portals/copy", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const body = await readJsonBody(c);
  if (typeof body.sourceEventId !== "string" || body.sourceEventId === "") {
    throw new ApiError("invalid", "Choose the event to copy from.", { sourceEventId: "Required" });
  }
  const portals = body.portals !== false;
  const tiers = body.tiers !== false;
  if (!portals && !tiers) throw new ApiError("invalid", "Choose portals, tiers, or both.", { portals: "Nothing to copy" });
  const now = new Date();
  const result = await copyFromEvent(c.var.db, { orgId: event.orgId, targetEventId: eventId, sourceEventId: body.sourceEventId, portals, tiers }, now);
  await writeAuditEvent(
    c.var.db,
    {
      orgId: event.orgId,
      eventId,
      actor: await organizerActor(c),
      action: "portal.copy",
      targetType: "event",
      targetId: eventId,
      details: { sourceEventId: body.sourceEventId, portals: result.portals, tiers: result.tiers, tasks: result.tasks },
    },
    now,
  );
  // copied rules start matching people here; nobody is emailed by a copy
  await reconcileEventPortals(c.var.db, eventId, now, { notify: "none" });
  return c.json(result);
});

portalsRoutes.get("/events/:eventId/portals/:portalId", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const data = await getPortalEditorData(c.var.db, eventId, c.req.param("portalId"));
  if (!data) throw new ApiError("not_found", "Portal not found");
  const noteIsWelcome = data.portal.template === PROFILE_BASICS_TEMPLATE;
  if (noteIsWelcome) data.portal.note = (await getPortalSettingsForEvent(c.var.db, eventId))?.welcomeMessage ?? null;
  return c.json({ ...data, noteIsWelcome });
});

// Live matches for the rule as edited (the panel pinned beside the rule).
portalsRoutes.post("/events/:eventId/portals/:portalId/matches", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const portalId = c.req.param("portalId");
  await portalInEvent(c, eventId, portalId);
  const body = await readJsonBody(c);
  let rule;
  try {
    rule = parsePortalRule(body.rule);
  } catch (err) {
    throw new ApiError("invalid", (err as Error).message, { rule: (err as Error).message });
  }
  return c.json(await matchRule(c.var.db, eventId, rule, portalId));
});

// The change-impact preview: what saving would do. Nothing is written.
portalsRoutes.post("/events/:eventId/portals/:portalId/preview", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const portalId = c.req.param("portalId");
  const portal = await portalInEvent(c, eventId, portalId);
  let body = await readJsonBody(c);
  if (portal.template === PROFILE_BASICS_TEMPLATE) body = takeWelcomeNote(body).body;
  const input = parsePortalInput(body);
  return c.json(await previewPortalChange(c.var.db, eventId, portalId, input));
});

portalsRoutes.put("/events/:eventId/portals/:portalId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const portalId = c.req.param("portalId");
  const portal = await portalInEvent(c, eventId, portalId);
  let body = await readJsonBody(c);
  let welcome: string | null | undefined;
  if (portal.template === PROFILE_BASICS_TEMPLATE) ({ body, welcome } = takeWelcomeNote(body));
  const input = parsePortalInput(body);
  const notify = parseNotify(body.notify);
  const now = new Date();
  const before = await updatePortal(c.var.db, eventId, portalId, input, now);
  if (welcome !== undefined) await upsertPortalSettings(c.var.db, eventId, { welcomeMessage: welcome });
  const result = await reconcileEventPortals(c.var.db, eventId, now, { notify });
  const prior = portalToInput(before);
  await writeAuditEvent(
    c.var.db,
    {
      orgId: event.orgId,
      eventId,
      actor: await organizerActor(c),
      action: "portal.update",
      targetType: "portal",
      targetId: portalId,
      details: {
        name: input.name,
        ruleChanged: JSON.stringify(prior.rule) !== JSON.stringify(input.rule),
        permissionsChanged:
          JSON.stringify(prior.fieldPermissions) !== JSON.stringify(input.fieldPermissions) ||
          JSON.stringify(prior.capabilities) !== JSON.stringify(input.capabilities),
        itemsBefore: prior.items.length,
        itemsAfter: input.items.length,
        joined: result.joined.filter((j) => j.portalId === portalId).length,
        left: result.left.filter((l) => l.portalId === portalId).length,
        notify,
        emailed: result.notifiedContactIds.length,
      },
    },
    now,
  );
  return c.json({
    ok: true,
    joined: result.joined.filter((j) => j.portalId === portalId).length,
    left: result.left.filter((l) => l.portalId === portalId).length,
    emailed: result.notifiedContactIds.length,
  });
});

portalsRoutes.post("/events/:eventId/portals/:portalId/duplicate", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const portalId = c.req.param("portalId");
  const now = new Date();
  const id = await duplicatePortal(c.var.db, eventId, portalId, now);
  await writeAuditEvent(
    c.var.db,
    { orgId: event.orgId, eventId, actor: await organizerActor(c), action: "portal.duplicate", targetType: "portal", targetId: id, details: { from: portalId } },
    now,
  );
  return c.json({ id }, 201);
});

portalsRoutes.delete("/events/:eventId/portals/:portalId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const portalId = c.req.param("portalId");
  const now = new Date();
  const deleted = await deletePortal(c.var.db, eventId, portalId);
  const result = await reconcileEventPortals(c.var.db, eventId, now, { notify: "none" });
  await writeAuditEvent(
    c.var.db,
    {
      orgId: event.orgId,
      eventId,
      actor: await organizerActor(c),
      action: "portal.delete",
      targetType: "portal",
      targetId: portalId,
      details: { name: deleted.name, items: deleted.items.length, detached: result.assignmentsDetached },
    },
    now,
  );
  return c.json({ ok: true, detached: result.assignmentsDetached });
});

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

portalsRoutes.get("/events/:eventId/library", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  return c.json(await listLibrary(c.var.db, eventId));
});

portalsRoutes.post("/events/:eventId/library", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const parsed = parseLibraryItemInput(await readJsonBody(c));
  const input: LibraryItemInput = {
    type: parsed.type!,
    title: parsed.title!,
    scope: parsed.scope!,
    instructions: parsed.instructions ?? null,
    acceptedTypes: parsed.acceptedTypes ?? null,
    maxSizeMb: parsed.maxSizeMb ?? null,
    maxFiles: parsed.maxFiles ?? null,
    content: parsed.content ?? null,
  };
  const created = await createLibraryItem(c.var.db, eventId, input, new Date());
  return c.json(created, 201);
});

portalsRoutes.patch("/events/:eventId/library/tasks/:taskId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const body = await readJsonBody(c);
  requireAtLeastOneField(body, ["title", "scope", "instructions", "acceptedTypes", "maxSizeMb", "maxFiles"]);
  const input = parseLibraryItemInput(body, true);
  if (input.type !== undefined) throw new ApiError("invalid", "An item's type can't change.", { type: "Read-only" });
  await updateLibraryTask(c.var.db, eventId, c.req.param("taskId"), input, new Date());
  return c.json({ ok: true });
});

portalsRoutes.patch("/events/:eventId/library/resources/:resourceId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const body = await readJsonBody(c);
  requireAtLeastOneField(body, ["visibility"]);
  await setResourceVisibility(c.var.db, eventId, c.req.param("resourceId"), body.visibility, new Date());
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Person record: what a person gets, and why
// ---------------------------------------------------------------------------

async function contactForOrgOr404(c: Context<AppEnv>, orgId: string, contactId: string) {
  const rows = await c.var.db
    .select({
      id: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      title: schema.contact.title,
    })
    .from(schema.contact)
    .where(and(eq(schema.contact.id, contactId), eq(schema.contact.orgId, orgId)))
    .limit(1);
  if (!rows[0]) throw new ApiError("not_found", "Contact not found");
  return rows[0];
}

portalsRoutes.get("/events/:eventId/people/:contactId/portal", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const contact = await contactForOrgOr404(c, event.orgId, c.req.param("contactId"));
  let view = await buildPersonView(c.var.db, { eventId, contactId: contact.id, now: Date.now(), includeDetached: true });
  // a portal brings an item with no row yet (the background reconcile
  // hasn't run since the change): materialize it now, the way the home
  // heals itself, so the record's items can be reopened
  if (view.needsReconcile) {
    await reconcileEventPortals(c.var.db, eventId, new Date(), { notify: "auto" });
    view = await buildPersonView(c.var.db, { eventId, contactId: contact.id, now: Date.now(), includeDetached: true });
  }
  const roles = await listEventRoles(c.var.db, eventId, contact.id);
  return c.json({ contact, view, eventRoles: roles });
});

// Organizers reopen a closed item for one person until a day they choose.
portalsRoutes.post("/events/:eventId/people/:contactId/reopen", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const contact = await contactForOrgOr404(c, event.orgId, c.req.param("contactId"));
  const body = await readJsonBody(c);
  if (typeof body.assignmentId !== "string") throw new ApiError("invalid", "assignmentId is required", { assignmentId: "Required" });
  if (!isIsoDate(body.until)) throw new ApiError("invalid", "until must be a date (YYYY-MM-DD)", { until: "Invalid date" });
  const [y, m, d] = (body.until as string).split("-").map(Number) as [number, number, number];
  const until = new Date(Date.UTC(y, m - 1, d));
  const rows = await c.var.db
    .select({ id: schema.taskAssignment.id })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .where(and(eq(schema.taskAssignment.id, body.assignmentId), eq(schema.taskAssignment.contactId, contact.id), eq(schema.task.eventId, eventId)))
    .limit(1);
  if (!rows[0]) throw new ApiError("not_found", "Item not found");
  await c.var.db.update(schema.taskAssignment).set({ reopenedUntil: until, updatedAt: new Date() }).where(eq(schema.taskAssignment.id, rows[0].id));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Event roles (Press, Volunteer)
// ---------------------------------------------------------------------------

portalsRoutes.get("/events/:eventId/event-roles", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  return c.json({ roles: await listEventRoles(c.var.db, eventId) });
});

portalsRoutes.post("/events/:eventId/event-roles", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const body = await readJsonBody(c);
  const result = await addEventRole(c.var.db, { orgId: event.orgId, eventId, contactId: body.contactId, role: body.role }, new Date());
  scheduleReconcile(c, [eventId]);
  return c.json(result, result.created ? 201 : 200);
});

portalsRoutes.delete("/events/:eventId/event-roles/:eventRoleId", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  await removeEventRole(c.var.db, eventId, c.req.param("eventRoleId"));
  scheduleReconcile(c, [eventId]);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Invite to speak (flow 8)
// ---------------------------------------------------------------------------

portalsRoutes.post("/events/:eventId/invitations", requireOrganizer, requireCookieSession, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const body = await readJsonBody(c);
  const actor = await organizerActor(c);
  const now = new Date();
  const result = await inviteToSpeak(
    c.var.db,
    {
      orgId: event.orgId,
      eventId,
      submissionId: body.submissionId,
      contactId: body.contactId,
      person: typeof body.person === "object" && body.person !== null ? (body.person as Record<string, unknown>) : undefined,
      role: body.role,
      message: body.message,
      replyBy: body.replyBy,
      invitedByUserId: actor.userId!,
    },
    now,
  );
  const sessionRows = await c.var.db
    .select({ title: schema.submission.title })
    .from(schema.submission)
    .where(eq(schema.submission.id, body.submissionId as string))
    .limit(1);
  const role = result.role;
  await sendInvitationToSpeak(c.var.db, makeMailer(c.var.db, c.env), {
    eventId,
    contactId: result.contactId,
    origin: resolveBaseUrl(c),
    token: result.token,
    sessionTitle: sessionRows[0]?.title ?? "",
    sessionLine: await sessionPlacementLine(c.var.db, body.submissionId as string),
    pitch: INVITATION_PITCH[role] ?? `join as ${participantRoleLabel(role).toLowerCase()}`,
    replyBy: result.replyBy,
    message: result.message,
    organizerName: actor.label,
  });
  scheduleReconcile(c, [eventId]);
  return c.json({ participantId: result.participantId, contactId: result.contactId }, 201);
});
