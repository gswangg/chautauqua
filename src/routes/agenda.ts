// Agenda API (J9, DEC-021). Route file exports a named Hono sub-app; only
// src/index.ts mounts it (DEC-012). All endpoints organizer-only + csrfJson
// on writes. Conflicts NEVER block writes (DEC-010) — PUT/DELETE always
// succeed for accepted submissions and return refreshed { conflicts, summary }.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../server/env";
import { requireOrganizer, csrfJson } from "../server/middleware";
import { ApiError } from "../server/http";
import {
  DEFAULT_AUTO_SCHEDULE_PARAMS,
  getAgendaPayload,
  getConflictsAndSummary,
  getEventInfo,
  getSubmissionOwnership,
  isDayWithinEventRange,
  isValidSlotInput,
  roomBelongsToEvent,
  runAutoSchedule,
  unscheduleSlot,
  upsertSlot,
} from "../server/repo/agenda";

export const agendaRoutes = new Hono<AppEnv>();

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

// GET /api/v1/events/:eventId/agenda
agendaRoutes.get("/events/:eventId/agenda", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const event = await getEventInfo(c.var.db, eventId);
  if (!event) throw new ApiError("not_found", "Event not found");
  if (event.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");

  const payload = await getAgendaPayload(c.var.db, eventId, event);
  return c.json(payload);
});

// PUT /api/v1/submissions/:id/slot
agendaRoutes.put("/submissions/:id/slot", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const submissionId = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, submissionId);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");
  if (ownership.status !== "accepted") {
    throw new ApiError("invalid", "Only accepted submissions can be scheduled");
  }

  const body = await c.req.json().catch(() => null);
  if (!isValidSlotInput(body)) {
    throw new ApiError("invalid", "day, startMin, endMin (startMin < endMin) are required", {
      slot: "Invalid slot input",
    });
  }
  if (typeof body.roomId === "string" && !(await roomBelongsToEvent(c.var.db, body.roomId, ownership.eventId))) {
    throw new ApiError("invalid", "Room does not belong to this event", {
      roomId: "Room does not belong to this event",
    });
  }

  const event = await getEventInfo(c.var.db, ownership.eventId);
  if (!event) throw new ApiError("not_found", "Event not found");
  if (!isDayWithinEventRange(body.day, event.startDate, event.endDate)) {
    throw new ApiError("invalid", "Slot day is outside the event date range", {
      day: `Outside ${event.startDate}..${event.endDate}`,
    });
  }

  await upsertSlot(c.var.db, submissionId, body);

  const refreshed = await getConflictsAndSummary(c.var.db, ownership.eventId, event);
  return c.json(refreshed);
});

// DELETE /api/v1/submissions/:id/slot
agendaRoutes.delete("/submissions/:id/slot", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const submissionId = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, submissionId);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("forbidden", "Submission belongs to a different org");

  await unscheduleSlot(c.var.db, submissionId);

  const event = await getEventInfo(c.var.db, ownership.eventId);
  if (!event) throw new ApiError("not_found", "Event not found");
  const refreshed = await getConflictsAndSummary(c.var.db, ownership.eventId, event);
  return c.json(refreshed);
});

// POST /api/v1/events/:eventId/agenda/publish — AIA-07: explicit publish
// affordance. DEC-155: this is a pubcache purge affordance only, not a
// separate draft/published state on the agenda itself — the schedule is
// always "live" data, this endpoint just gives organizers a deliberate
// moment to invalidate the public cache after a scheduling session. The
// purge itself is the global bumpPublicVersionMiddleware (src/server/
// pubcache.ts), which bumps the public cache version after any successful
// (status < 400) mutating request — no separate purge call is needed here,
// matching the established pattern in src/routes/api/submissions.ts's
// PATCH /submissions/:id. No email is sent (house invariant).
agendaRoutes.post("/events/:eventId/agenda/publish", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const event = await getEventInfo(c.var.db, eventId);
  if (!event) throw new ApiError("not_found", "Event not found");
  if (event.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");

  const payload = await getAgendaPayload(c.var.db, eventId, event);
  return c.json({ published: payload.placed.length });
});

interface AutoScheduleBody {
  dayStartMin?: unknown;
  dayEndMin?: unknown;
  defaultDurationMin?: unknown;
  gridMin?: unknown;
}

// DEC-298: auto-schedule parameters are a bounded, integer-validated
// allowlist. This is what keeps src/domain/schedule.ts's greedy grid loop
// (startMin += gridMin) from being handed a zero/negative/absurd step that
// never advances, which would run the isolate to its CPU limit.
const AUTO_SCHEDULE_BOUNDS = {
  dayStartMin: { min: 0, max: 1439 },
  dayEndMin: { min: 1, max: 1440 },
  defaultDurationMin: { min: 1, max: 1440 },
  gridMin: { min: 1, max: 480 },
} as const;

type AutoScheduleKey = keyof typeof AUTO_SCHEDULE_BOUNDS;

/** Absent -> default (today's behavior). Present -> must be an in-bounds
 * integer, else a fields[key] validation error (DEC-298). */
function parseBoundedInt(
  key: AutoScheduleKey,
  value: unknown,
  fallback: number,
  fields: Record<string, string>,
): number {
  if (value === undefined) return fallback;
  const { min, max } = AUTO_SCHEDULE_BOUNDS[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fields[key] = `must be an integer between ${min} and ${max}`;
    return fallback;
  }
  return value;
}

// POST /api/v1/events/:eventId/agenda/auto-schedule
agendaRoutes.post("/events/:eventId/agenda/auto-schedule", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  const event = await getEventInfo(c.var.db, eventId);
  if (!event) throw new ApiError("not_found", "Event not found");
  if (event.orgId !== auth.orgId) throw new ApiError("forbidden", "Event belongs to a different org");

  const body = ((await c.req.json().catch(() => ({}))) ?? {}) as AutoScheduleBody;
  const fields: Record<string, string> = {};
  const params = {
    dayStartMin: parseBoundedInt(
      "dayStartMin",
      body.dayStartMin,
      DEFAULT_AUTO_SCHEDULE_PARAMS.dayStartMin,
      fields,
    ),
    dayEndMin: parseBoundedInt("dayEndMin", body.dayEndMin, DEFAULT_AUTO_SCHEDULE_PARAMS.dayEndMin, fields),
    defaultDurationMin: parseBoundedInt(
      "defaultDurationMin",
      body.defaultDurationMin,
      DEFAULT_AUTO_SCHEDULE_PARAMS.defaultDurationMin,
      fields,
    ),
    gridMin: parseBoundedInt("gridMin", body.gridMin, DEFAULT_AUTO_SCHEDULE_PARAMS.gridMin, fields),
  };
  if (params.dayEndMin <= params.dayStartMin) {
    fields.dayEndMin = fields.dayEndMin ?? "must be greater than dayStartMin";
  }
  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid auto-schedule parameters", fields);
  }

  const payload = await runAutoSchedule(c.var.db, eventId, event, params);
  return c.json(payload);
});
