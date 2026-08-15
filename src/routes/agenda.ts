// Agenda API (J9, DEC-021). Route file exports a named Hono sub-app; only
// src/index.ts mounts it (DEC-012). All endpoints organizer-only + csrfJson
// on writes. Conflicts NEVER block writes (DEC-010) — PUT/DELETE always
// succeed for accepted submissions and return refreshed { conflicts, summary }.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../server/env";
import { requireOrganizer, csrfJson } from "../server/middleware";
import { ApiError, readJsonBody, readOptionalJsonBody } from "../server/http";
import { MINUTES_PER_DAY } from "../domain/schedule";
import {
  countPubliclyVisible,
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
  if (event.orgId !== auth.orgId) throw new ApiError("not_found", "Event not found");

  const payload = await getAgendaPayload(c.var.db, eventId, event);
  return c.json(payload);
});

// PUT /api/v1/submissions/:id/slot
agendaRoutes.put("/submissions/:id/slot", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const submissionId = c.req.param("id");
  const ownership = await getSubmissionOwnership(c.var.db, submissionId);
  if (!ownership) throw new ApiError("not_found", "Submission not found");
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");
  if (ownership.status !== "accepted") {
    throw new ApiError("invalid", "Only accepted submissions can be scheduled");
  }

  const body = await readJsonBody(c);
  if (!isValidSlotInput(body)) {
    throw new ApiError(
      "invalid",
      `day, startMin, endMin (startMin < endMin, both within 0..${MINUTES_PER_DAY}) are required`,
      {
        slot: `Invalid slot input: startMin/endMin must fall within a single day (0..${MINUTES_PER_DAY} minutes)`,
      },
    );
  }
  // DEC-155 wave-34 amendment: roomBelongsToEvent (only when body.roomId is
  // a string) and getEventInfo consume nothing from each other, so they
  // issue as one wave. Both can independently produce a user-facing
  // ApiError past this point, so the wave uses allSettled and re-throws in
  // SOURCE order (room check first, event-not-found second) — a doubly-bad
  // request must still produce the identical 'Room does not belong to this
  // event' error it did before this change.
  let event: Awaited<ReturnType<typeof getEventInfo>>;
  if (typeof body.roomId === "string") {
    const roomId = body.roomId;
    const [roomResult, eventResult] = await Promise.allSettled([
      (async () => {
        if (!(await roomBelongsToEvent(c.var.db, roomId, ownership.eventId))) {
          throw new ApiError("invalid", "Room does not belong to this event", {
            roomId: "Room does not belong to this event",
          });
        }
      })(),
      getEventInfo(c.var.db, ownership.eventId),
    ]);
    if (roomResult.status === "rejected") throw roomResult.reason;
    if (eventResult.status === "rejected") throw eventResult.reason;
    event = eventResult.value;
  } else {
    event = await getEventInfo(c.var.db, ownership.eventId);
  }
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
  if (ownership.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  // DEC-155 wave-34 amendment: getEventInfo observes nothing the delete
  // writes (unscheduleSlot only touches schedule_slot; getEventInfo reads
  // the event row's dates), so it joins the write's wave rather than
  // trailing it as a fourth sequential await.
  const [, event] = await Promise.all([
    unscheduleSlot(c.var.db, submissionId),
    getEventInfo(c.var.db, ownership.eventId),
  ]);
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
  if (event.orgId !== auth.orgId) throw new ApiError("not_found", "Event not found");

  const payload = await getAgendaPayload(c.var.db, eventId, event);
  const placed = payload.placed.length;
  const publicCount = await countPubliclyVisible(
    c.var.db,
    eventId,
    payload.placed.map((s) => s.submissionId),
  );
  return c.json({ placed, public: publicCount, heldBack: placed - publicCount });
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
  dayStartMin: { min: 0, max: MINUTES_PER_DAY - 1 },
  dayEndMin: { min: 1, max: MINUTES_PER_DAY },
  defaultDurationMin: { min: 1, max: MINUTES_PER_DAY },
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
  if (event.orgId !== auth.orgId) throw new ApiError("not_found", "Event not found");

  const body = (await readOptionalJsonBody(c)) as unknown as AutoScheduleBody;
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
