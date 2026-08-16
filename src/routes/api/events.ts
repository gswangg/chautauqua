// Events, tracks, rooms API (w2-b). Organizer-only, per DEC-005/DEC-012/
// DEC-013. Route file exports a sub-app; only src/index.ts mounts it.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import type { AuthInfo } from "../../server/env";
import { ApiError, readJsonBody } from "../../server/http";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from "../../forms/validate"; // DEC-417
import { overCapFieldMessage } from "../../domain/cap-copy";
import * as schema from "../../db/schema";
import { clampPage, listPerPage } from "../../lib/pagination";
import {
  countEventsForOrg,
  countEventsForReviewer,
  countRoomsForEvent,
  countTracksForEvent,
  createEvent,
  createRoom,
  createTrack,
  deleteRoom,
  deleteTrack,
  getEventForOrg,
  getRoomForEvent,
  isSlugTaken,
  listEventsForOrg,
  listEventsForReviewer,
  listRoomsForEvent,
  listTracksForEvent,
  updateEvent,
  updateRoom,
  updateTrack,
  type EventBranding,
} from "../../server/repo/events";

import { createDefaultForm } from "../../server/repo/forms";
import { bumpIcsSequencesForRoom, bumpIcsSequencesForEvent } from "../../server/repo/ics-sequence";
import { isDateOrderValid, isValidSlug, isValidTimezone } from "./validators";
import { isIsoDate } from "../../domain/iso-date";
import { listSlotsOutsideWindow } from "../../server/repo/agenda";
import { listBreaksOutsideWindow } from "../../server/repo/breaks";
import { DEC_519, DEC_844, DEC_322 } from "../../decisions";
// DEC-371 amendment (wave 43): the hex-colour grammar (isValidHexColor,
// normalizeHexColor) lives ONE place, src/domain/color.ts.
import { isValidHexColor, normalizeHexColor } from "../../domain/color";
import { safeImageSrc } from "../../domain/brand-url";

void DEC_322;

// Compile-checked dependency marker: the room-rename ics_sequence bump
// below implements DEC-519.
void DEC_519;

export const eventsRoutes = new Hono<AppEnv>();

// NOTE: a blanket `.use("*", requireOrganizer)` here is unsafe once this
// sub-app is mounted via app.route("/api/v1", eventsRoutes) in src/index.ts.
// Hono DOES rewrite "*" with the mount prefix (mergePath in
// node_modules/hono/dist/hono-base.js merges "/api/v1" + "*" into
// "/api/v1/*"), but that is exactly the problem: "/api/v1/*" still matches
// every sibling sub-app mounted under /api/v1 too (e.g. /api/v1/me and
// /api/v1/review/*), not just this router's own routes. Scope the
// middleware to this router's own path prefixes instead (DEC-060 wave-34
// amendment). test/role-refusal-probe.test.ts (DEC-459 wave-32) is the
// enforcement this reasoning rests on: it probes every /api/v1 registration
// as a speaker and a reviewer and fails if either actor reaches a route it
// shouldn't.
//
// DEC-141: GET /events (the bare list route) is the one exception — it must
// stay reachable by reviewers too, so it is intentionally left off this
// blanket list and does its own inline role check below. Every other
// events/tracks/rooms route (including POST /events) stays organizer-only.
//
// NOTE: a "/events/*" wildcard here would ALSO match the bare "/events" path
// (Hono's `*` matches zero-or-more trailing segments), re-introducing the
// exact reviewer lockout this task fixes -- so nested event routes are
// listed explicitly by their one- and two-segment shapes instead.
eventsRoutes.use("/events/:eventId", requireOrganizer);
eventsRoutes.use("/events/:eventId/tracks", requireOrganizer);
eventsRoutes.use("/events/:eventId/rooms", requireOrganizer);
eventsRoutes.use("/tracks/*", requireOrganizer);
eventsRoutes.use("/rooms/*", requireOrganizer);

function requireAuth(c: { var: { auth?: AuthInfo } }): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

function currentOrgId(c: { var: { auth?: { orgId: string } } }): string {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth.orgId;
}

// DEC-417: maxLen defaults to MAX_NAME_LENGTH -- every caller of this helper
// today is an identifier/name/slug field.
function requireString(
  body: Record<string, unknown>,
  field: string,
  fields: Record<string, string>,
  maxLen: number = MAX_NAME_LENGTH,
): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    fields[field] = "Must be a non-empty string";
    return undefined;
  }
  if (value.length > maxLen) {
    fields[field] = overCapFieldMessage(value.length, maxLen);
    return undefined;
  }
  return value;
}

// DEC-417
function checkOptionalStringLen(
  value: unknown,
  field: string,
  fields: Record<string, string>,
  maxLen: number,
): void {
  if (typeof value === "string" && value.length > maxLen) {
    fields[field] = overCapFieldMessage(value.length, maxLen);
  }
}

function parseBranding(body: Record<string, unknown>, fields: Record<string, string>): EventBranding | undefined {
  const branding = body.branding;
  if (branding === undefined) return undefined;
  if (branding === null) return {};
  if (typeof branding !== "object") {
    fields.branding = "Must be an object";
    return undefined;
  }
  const b = branding as Record<string, unknown>;
  const out: EventBranding = {};
  if (b.logoUrl !== undefined) {
    if (typeof b.logoUrl !== "string") {
      fields["branding.logoUrl"] = "Must be a string";
    } else if (b.logoUrl.length > MAX_TEXT_LENGTH) {
      fields["branding.logoUrl"] = overCapFieldMessage(b.logoUrl.length, MAX_TEXT_LENGTH); // DEC-417
    } else {
      // DEC-322 wave-30 amendment: gate the logo URL at the write door so an
      // unsafe value can never reach storage (and, from there, an <img src>).
      // A blank value clears the logo and stays legal; a non-blank value
      // that fails the contract is rejected.
      const safe = safeImageSrc(b.logoUrl);
      if (b.logoUrl.trim() !== "" && safe === null) {
        fields["branding.logoUrl"] = "Must be an http or https URL, or a path starting with /";
      } else {
        out.logoUrl = safe ?? "";
      }
    }
  }
  if (b.accentColor !== undefined) {
    if (typeof b.accentColor !== "string" || !isValidHexColor(b.accentColor)) {
      fields["branding.accentColor"] = "Must be a hex color like #336699";
    } else {
      // DEC-371 amendment (wave 43): normalize on WRITE so a reader (SSR
      // shells, embed query parser) can never disagree with the writer that
      // accepted the value — '#abc' is stored as '#aabbcc'.
      out.accentColor = normalizeHexColor(b.accentColor) as string;
    }
  }
  return out;
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

/** Finds the event_id owning a track row, with no org filter yet (helper for cross-table IDOR checks). */
async function trackEventId(db: import("../../server/context").Db, trackId: string): Promise<string | null> {
  const rows = await db
    .select({ eventId: schema.track.eventId })
    .from(schema.track)
    .where(eq(schema.track.id, trackId))
    .limit(1);
  return rows[0]?.eventId ?? null;
}

// Not routed through roomBelongsToEvent (DEC-248): this reports the room's
// OWN eventId for a cross-table IDOR check upstream, it does not test
// membership against a caller-supplied eventId — different semantics.
async function roomEventId(db: import("../../server/context").Db, roomId: string): Promise<string | null> {
  const rows = await db
    .select({ eventId: schema.room.eventId })
    .from(schema.room)
    .where(eq(schema.room.id, roomId))
    .limit(1);
  return rows[0]?.eventId ?? null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

eventsRoutes.get("/events", async (c) => {
  const auth = requireAuth(c);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  const repoPage = { limit: perPage, offset: (page - 1) * perPage };

  let items;
  let total;
  if (auth.role === "organizer") {
    items = await listEventsForOrg(c.var.db, auth.orgId, repoPage);
    total = await countEventsForOrg(c.var.db, auth.orgId);
  } else if (auth.role === "reviewer") {
    items = await listEventsForReviewer(c.var.db, auth.userId, auth.orgId, repoPage);
    total = await countEventsForReviewer(c.var.db, auth.userId, auth.orgId);
  } else {
    throw new ApiError("forbidden", "Requires role 'organizer' or 'reviewer'");
  }
  return c.json({ items, total, page, perPage });
});

eventsRoutes.post("/events", requireOrganizer, csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};

  const name = requireString(body, "name", fields);
  const slug = requireString(body, "slug", fields);
  const startDate = requireString(body, "startDate", fields);
  const endDate = requireString(body, "endDate", fields);
  const timezone = requireString(body, "timezone", fields);
  const location = body.location;
  if (location !== undefined && location !== null && typeof location !== "string") {
    fields.location = "Must be a string";
  }
  checkOptionalStringLen(location, "location", fields, MAX_TEXT_LENGTH); // DEC-417

  if (slug !== undefined && !isValidSlug(slug)) {
    fields.slug = "Must match [a-z0-9-]+";
  }
  if (timezone !== undefined && !isValidTimezone(timezone)) {
    fields.timezone = "Must be a valid IANA timezone";
  }
  // DEC-510: format must be strict ISO YYYY-MM-DD before we even attempt an
  // order comparison — Date.parse (inside isDateOrderValid) accepts many
  // non-ISO formats that would otherwise persist verbatim and break
  // downstream string-based date math.
  let startFormatValid = true;
  let endFormatValid = true;
  if (startDate !== undefined && !isIsoDate(startDate)) {
    fields.startDate = "Must be YYYY-MM-DD";
    startFormatValid = false;
  }
  if (endDate !== undefined && !isIsoDate(endDate)) {
    fields.endDate = "Must be YYYY-MM-DD";
    endFormatValid = false;
  }
  if (
    startFormatValid &&
    endFormatValid &&
    startDate !== undefined &&
    endDate !== undefined &&
    !isDateOrderValid(startDate, endDate)
  ) {
    fields.endDate = "Must be on or after startDate";
  }

  const branding = parseBranding(body, fields);

  if (name === undefined) fields.name ??= "Required";
  if (slug === undefined) fields.slug ??= "Required";
  if (startDate === undefined) fields.startDate ??= "Required";
  if (endDate === undefined) fields.endDate ??= "Required";
  if (timezone === undefined) fields.timezone ??= "Required";

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid event", fields);
  }

  // Non-null assertions are safe here: all required fields were validated above.
  if (await isSlugTaken(c.var.db, slug as string)) {
    throw new ApiError("invalid", "Slug is already in use", { slug: "Already in use" });
  }

  const created = await createEvent(c.var.db, {
    orgId,
    name: name as string,
    slug: slug as string,
    startDate: startDate as string,
    endDate: endDate as string,
    location: (location as string | undefined) ?? null,
    timezone: timezone as string,
    branding: branding ?? null,
  });
  // DEC-050: provision the default CFP form immediately so the event is
  // submittable without relying on getOrCreateForm's first-read fallback
  // (which previously crashed on the second event's global-PK collision).
  await createDefaultForm(c.var.db, created.id);
  // SPEC section 2.1 "settings get defaults, not wizards" + DEC-301: every
  // new event ships one 'General' track so the CFP is submittable from
  // minute one (a form offering zero tracks cannot pass the required-track
  // validation). The producer renames it in Settings, and track colors plus
  // track-scoped reviewer assignment work immediately.
  await createTrack(c.var.db, created.id, { name: "General", color: null });
  return c.json(created, 201);
});

eventsRoutes.get("/events/:eventId", async (c) => {
  const orgId = currentOrgId(c);
  const event = await requireEvent(c.var.db, orgId, c.req.param("eventId"));
  return c.json(event);
});

eventsRoutes.patch("/events/:eventId", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  const existing = await requireEvent(c.var.db, orgId, eventId);
  if (!existing) throw new ApiError("not_found", "Event not found");

  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};

  const name = requireString(body, "name", fields);
  const slug = requireString(body, "slug", fields);
  const startDate = requireString(body, "startDate", fields);
  const endDate = requireString(body, "endDate", fields);
  const timezone = requireString(body, "timezone", fields);
  const location = body.location;
  if (location !== undefined && location !== null && typeof location !== "string") {
    fields.location = "Must be a string";
  }
  checkOptionalStringLen(location, "location", fields, MAX_TEXT_LENGTH); // DEC-417

  if (slug !== undefined && !isValidSlug(slug)) {
    fields.slug = "Must match [a-z0-9-]+";
  }
  if (timezone !== undefined && !isValidTimezone(timezone)) {
    fields.timezone = "Must be a valid IANA timezone";
  }
  // DEC-510: format must be strict ISO YYYY-MM-DD before we attempt an order
  // comparison. Only the fields actually supplied in this PATCH are
  // format-checked; the stored value for an unsupplied field is presumed
  // already ISO (it was validated when written).
  let startFormatValid = true;
  let endFormatValid = true;
  if (startDate !== undefined && !isIsoDate(startDate)) {
    fields.startDate = "Must be YYYY-MM-DD";
    startFormatValid = false;
  }
  if (endDate !== undefined && !isIsoDate(endDate)) {
    fields.endDate = "Must be YYYY-MM-DD";
    endFormatValid = false;
  }
  const effectiveStart = startDate ?? existing.startDate;
  const effectiveEnd = endDate ?? existing.endDate;
  if (
    startFormatValid &&
    endFormatValid &&
    (startDate !== undefined || endDate !== undefined) &&
    !isDateOrderValid(effectiveStart, effectiveEnd)
  ) {
    fields.endDate = "Must be on or after startDate";
  }

  const branding = parseBranding(body, fields);

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid event", fields);
  }

  if (slug !== undefined && slug !== existing.slug && (await isSlugTaken(c.var.db, slug))) {
    throw new ApiError("invalid", "Slug is already in use", { slug: "Already in use" });
  }

  const updated = await updateEvent(c.var.db, eventId, orgId, {
    name,
    slug,
    startDate,
    endDate,
    location: location === undefined ? undefined : (location as string | null),
    timezone,
    branding,
  });

  // DEC-519 (wave-11 amendment): a timezone change reaches every scheduled
  // submission's absolute DTSTART/DTEND — bump only when the string
  // actually changed (a same-string PATCH is a no-op), mirroring the
  // room-rename rule at events.ts:537-539. Explicitly refused: name,
  // location, startDate, endDate — see DEC-519's wave-11 amendment.
  if (timezone !== undefined && timezone !== existing.timezone) {
    await bumpIcsSequencesForEvent(c.var.db, eventId);
  }

  // DEC-844 (amended wave 68): narrowing the window never blocks the write,
  // but names every placed session AND every break it orphans — both
  // computed AFTER the update succeeds, against the NEW (now-persisted)
  // window.
  void DEC_844;
  const [unscheduledByWindow, breaksOutsideWindow] = await Promise.all([
    listSlotsOutsideWindow(c.var.db, eventId, updated.startDate, updated.endDate),
    listBreaksOutsideWindow(c.var.db, eventId, updated.startDate, updated.endDate),
  ]);
  return c.json({ ...updated, unscheduledByWindow, breaksOutsideWindow });
});

// ---------------------------------------------------------------------------
// Tracks (nested under events; PATCH/DELETE are top-level /tracks/:trackId)
// ---------------------------------------------------------------------------

eventsRoutes.get("/events/:eventId/tracks", async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  const items = await listTracksForEvent(c.var.db, eventId, { limit: perPage, offset: (page - 1) * perPage });
  const total = await countTracksForEvent(c.var.db, eventId);
  return c.json({ items, total, page, perPage });
});

eventsRoutes.post("/events/:eventId/tracks", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);

  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};
  const name = requireString(body, "name", fields);
  if (name === undefined) fields.name ??= "Required";
  const color = body.color;
  if (color !== undefined && color !== null) {
    if (typeof color !== "string" || !isValidHexColor(color)) {
      fields.color = "Must be a hex color like #336699";
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid track", fields);
  }

  const created = await createTrack(c.var.db, eventId, {
    name: name as string,
    color: (color as string | undefined) ?? null,
  });
  return c.json(created, 201);
});

eventsRoutes.patch("/tracks/:trackId", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const trackId = c.req.param("trackId");
  const db = c.var.db;

  const eventId = await trackEventId(db, trackId);
  if (!eventId) throw new ApiError("not_found", "Track not found");
  await requireEvent(db, orgId, eventId);

  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};
  const name = requireString(body, "name", fields);
  const color = body.color;
  if (color !== undefined && color !== null) {
    if (typeof color !== "string" || !isValidHexColor(color)) {
      fields.color = "Must be a hex color like #336699";
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid track", fields);
  }

  const updated = await updateTrack(db, trackId, eventId, {
    name,
    color: color === undefined ? undefined : (color as string | null),
  });
  return c.json(updated);
});

eventsRoutes.delete("/tracks/:trackId", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const trackId = c.req.param("trackId");
  const db = c.var.db;

  const eventId = await trackEventId(db, trackId);
  if (!eventId) throw new ApiError("not_found", "Track not found");
  await requireEvent(db, orgId, eventId);

  await deleteTrack(db, trackId, eventId);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Rooms (nested under events; PATCH/DELETE are top-level /rooms/:roomId)
// ---------------------------------------------------------------------------

eventsRoutes.get("/events/:eventId/rooms", async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  const items = await listRoomsForEvent(c.var.db, eventId, { limit: perPage, offset: (page - 1) * perPage });
  const total = await countRoomsForEvent(c.var.db, eventId);
  return c.json({ items, total, page, perPage });
});

eventsRoutes.post("/events/:eventId/rooms", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  await requireEvent(c.var.db, orgId, eventId);

  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};
  const name = requireString(body, "name", fields);
  if (name === undefined) fields.name ??= "Required";
  const capacity = body.capacity;
  if (capacity !== undefined && capacity !== null) {
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 0) {
      fields.capacity = "Must be a non-negative integer";
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid room", fields);
  }

  const created = await createRoom(c.var.db, eventId, {
    name: name as string,
    capacity: (capacity as number | undefined) ?? null,
  });
  return c.json(created, 201);
});

eventsRoutes.patch("/rooms/:roomId", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const roomId = c.req.param("roomId");
  const db = c.var.db;

  const eventId = await roomEventId(db, roomId);
  if (!eventId) throw new ApiError("not_found", "Room not found");
  await requireEvent(db, orgId, eventId);

  const body = await readJsonBody(c);
  const fields: Record<string, string> = {};
  const name = requireString(body, "name", fields);
  const capacity = body.capacity;
  if (capacity !== undefined && capacity !== null) {
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 0) {
      fields.capacity = "Must be a non-negative integer";
    }
  }
  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid room", fields);
  }

  const before = await getRoomForEvent(db, roomId, eventId);
  const updated = await updateRoom(db, roomId, eventId, {
    name,
    capacity: capacity === undefined ? undefined : (capacity as number | null),
  });
  // DEC-519: the room name is serialized into every scheduled submission's
  // VEVENT LOCATION — bump only when the name actually changed (a rename to
  // the same string is a no-op) so subscribers' calendars pick up the text.
  if (name !== undefined && before && name !== before.name) {
    await bumpIcsSequencesForRoom(db, roomId);
  }
  return c.json(updated);
});

eventsRoutes.delete("/rooms/:roomId", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const roomId = c.req.param("roomId");
  const db = c.var.db;

  const eventId = await roomEventId(db, roomId);
  if (!eventId) throw new ApiError("not_found", "Room not found");
  await requireEvent(db, orgId, eventId);

  await deleteRoom(db, roomId, eventId);
  return c.body(null, 204);
});
