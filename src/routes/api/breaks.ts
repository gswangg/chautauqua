// Schedule breaks API (DEC-022 amendment, wave 63). Route file exports a
// named Hono sub-app; only src/index.ts mounts it (DEC-012). Organizer-only,
// org-scoped (via the owning event), csrfJson on writes. See
// src/server/repo/breaks.ts's header for the hard boundary: a break is
// never a submission.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError, parseBoundedText, parseBoundedOptionalText } from "../../server/http";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { MINUTES_PER_DAY } from "../../domain/schedule";
import { getEventInfo, isDayWithinEventRange } from "../../server/repo/agenda"; // DEC-318
import {
  countBreaksForEvent,
  createBreak,
  deleteBreak,
  getBreakForEvent,
  listBreaksForEvent,
  MAX_BREAKS_PER_EVENT,
} from "../../server/repo/breaks";

export const breaksRoutes = new Hono<AppEnv>();

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

async function assertEventOwnership(
  c: Context<AppEnv>,
  eventId: string,
  auth: AuthInfo,
): Promise<{ startDate: string; endDate: string }> {
  const event = await getEventInfo(c.var.db, eventId);
  if (!event) throw new ApiError("not_found", "Event not found");
  if (event.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");
  return event;
}

// GET /api/v1/events/:eventId/breaks
breaksRoutes.get("/events/:eventId/breaks", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c, eventId, auth);

  const day = c.req.query("day");
  const items = await listBreaksForEvent(c.var.db, eventId, day || undefined);
  return c.json({ items });
});

interface CreateBreakBody {
  day?: unknown;
  label?: unknown;
  location?: unknown;
  startMin?: unknown;
  durationMin?: unknown;
}

function parseStartMin(value: unknown, fields: Record<string, string>): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MINUTES_PER_DAY - 1) {
    fields.startMin = `must be an integer between 0 and ${MINUTES_PER_DAY - 1}`;
    return 0;
  }
  return value;
}

function parseDurationMin(value: unknown, fields: Record<string, string>): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MINUTES_PER_DAY) {
    fields.durationMin = `must be an integer between 1 and ${MINUTES_PER_DAY}`;
    return 1;
  }
  return value;
}

// POST /api/v1/events/:eventId/breaks
breaksRoutes.post("/events/:eventId/breaks", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const event = await assertEventOwnership(c, eventId, auth);

  const count = await countBreaksForEvent(c.var.db, eventId);
  if (count >= MAX_BREAKS_PER_EVENT) {
    throw new ApiError("invalid", `This event already has ${MAX_BREAKS_PER_EVENT} breaks, the maximum allowed`);
  }

  const body = (await c.req.json().catch(() => ({}))) as CreateBreakBody;
  const fields: Record<string, string> = {};

  const label = parseBoundedText(body.label, "label", { max: MAX_NAME_LENGTH, required: true });
  const location = parseBoundedOptionalText(body.location, "location", { max: MAX_NAME_LENGTH });

  if (typeof body.day !== "string" || body.day.length === 0) {
    fields.day = "Required";
  } else if (!isDayWithinEventRange(body.day, event.startDate, event.endDate)) {
    fields.day = `Outside ${event.startDate}..${event.endDate}`;
  }

  const startMin = parseStartMin(body.startMin, fields);
  const durationMin = parseDurationMin(body.durationMin, fields);

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid break input", fields);
  }

  const created = await createBreak(c.var.db, eventId, {
    day: body.day as string,
    label,
    location,
    startMin,
    durationMin,
  });
  return c.json(created, 201);
});

// DELETE /api/v1/breaks/:id
breaksRoutes.delete("/breaks/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getBreakForEvent(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Break not found");
  await assertEventOwnership(c, ownership.eventId, auth);

  await deleteBreak(c.var.db, id);
  return c.json({ deleted: true });
});
