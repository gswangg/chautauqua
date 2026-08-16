// Schedule breaks API (DEC-022 amendment, wave 63). Route file exports a
// named Hono sub-app; only src/index.ts mounts it (DEC-012). Organizer-only,
// org-scoped (via the owning event), csrfJson on writes. See
// src/server/repo/breaks.ts's header for the hard boundary: a break is
// never a submission.

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import {
  ApiError,
  collectBoundedText,
  collectBoundedOptionalText,
  readOptionalJsonBody,
  requireAtLeastOneField,
} from "../../server/http";
import { MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417
import { MAX_BREAKS_PER_EVENT, MINUTES_PER_DAY } from "../../domain/schedule";
import { getEventInfo, isDayWithinEventRange, isIsoDay } from "../../server/repo/agenda"; // DEC-318
import {
  countBreaksForEvent,
  createBreak,
  deleteBreak,
  getBreakById,
  getBreakForEvent,
  listBreaksForEvent,
  updateBreak,
  type ScheduleBreak,
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
  if (event.orgId !== auth.orgId) throw new ApiError("not_found", "Event not found");
  return event;
}

// GET /api/v1/events/:eventId/breaks
breaksRoutes.get("/events/:eventId/breaks", requireOrganizer, async (c) => {
  const auth = requireAuth(c);
  const eventId = c.req.param("eventId");
  await assertEventOwnership(c, eventId, auth);

  const day = c.req.query("day");
  // DEC-905 (wave-31 amendment): fail loudly on a malformed ?day= instead of
  // silently returning an unfiltered (or confidently empty) list -- the same
  // isIsoDay shape gate the POST/PATCH body already runs through.
  if (day !== undefined && !isIsoDay(day)) {
    throw new ApiError("invalid", "day must be YYYY-MM-DD", { day: "invalid" });
  }
  const items = await listBreaksForEvent(c.var.db, eventId, day || undefined);
  // DEC-461(a) list envelope, in DEC-488's shape for a cap-bounded list:
  // MAX_BREAKS_PER_EVENT is the real per-request ceiling (listBreaksForEvent
  // refuses loudly above it), so it -- never `items.length || 1` (DEC-466) --
  // is the perPage. This read is unpaginated on purpose: a break set is one
  // page by construction.
  return c.json({ items, total: items.length, page: 1, perPage: MAX_BREAKS_PER_EVENT });
});

interface BreakBody {
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

interface ResolvedBreakFields {
  day: string;
  label: string;
  location: string | null;
  startMin: number;
  durationMin: number;
}

/** Shared validator for POST create (DEC-022 amendment) and PATCH edit
 * (DEC-022 amendment, wave 71) break writes. `existing` is null for POST
 * (every field is required); it's the stored row for PATCH, and any field
 * absent from `body` resolves against it BEFORE the cross-field midnight
 * check runs -- so PATCHing only durationMin still catches a break that
 * would now run past midnight. A present-but-null/malformed value is a
 * deliberate edit, not an omission (field guide: "submitted blank CLEARS,
 * absent key is silence"), so it's validated (and can fail) even under
 * `existing`. */
function validateBreakWrite(
  body: BreakBody,
  event: { startDate: string; endDate: string },
  existing: ResolvedBreakFields | null,
): { fields: Record<string, string>; values: ResolvedBreakFields } {
  const fields: Record<string, string> = {};

  let day = existing?.day ?? "";
  if (body.day !== undefined || !existing) {
    // DEC-417: isDayWithinEventRange compares lexically, so it alone would
    // let an arbitrarily long string through on a multi-day event. isIsoDay
    // is the shared shape gate (src/server/repo/agenda/days.ts, same one
    // isValidSlotInput uses) and pins `day` at exactly 10 chars before the
    // range check runs.
    if (!isIsoDay(body.day)) {
      fields.day = "Required (YYYY-MM-DD)";
    } else if (!isDayWithinEventRange(body.day, event.startDate, event.endDate)) {
      fields.day = `Outside ${event.startDate}..${event.endDate}`;
    } else {
      day = body.day;
    }
  }

  let label = existing?.label ?? "";
  if (body.label !== undefined || !existing) {
    // DEC-417 (amendment, wave 14): collect, don't throw -- so an invalid
    // label doesn't short-circuit the day/startMin/durationMin checks below.
    label = collectBoundedText(body.label, "label", { max: MAX_NAME_LENGTH, required: true }, fields);
  }

  let location = existing?.location ?? null;
  if (body.location !== undefined || !existing) {
    // DEC-417 (amendment, wave 14): collect, don't throw -- same rationale as label above.
    location = collectBoundedOptionalText(body.location, "location", { max: MAX_NAME_LENGTH }, fields);
  }

  let startMin = existing?.startMin ?? 0;
  if (body.startMin !== undefined || !existing) {
    startMin = parseStartMin(body.startMin, fields);
  }

  let durationMin = existing?.durationMin ?? 1;
  if (body.durationMin !== undefined || !existing) {
    durationMin = parseDurationMin(body.durationMin, fields);
  }

  // DEC-022 amendment (wave 66): the two per-field checks above validate
  // startMin and durationMin independently, so {startMin: 1430,
  // durationMin: 120} passes both yet describes a break ending at 25:50 — a
  // break cannot run past midnight. Cross-field check runs alongside (not
  // instead of) the per-field ones, and only overwrites `fields.durationMin`
  // when both individual fields were themselves valid (an already-invalid
  // durationMin keeps its own, more specific message). This check always
  // runs against the RESOLVED startMin/durationMin (stored values folded in
  // for any field a PATCH omitted), never just the fields present on `body`.
  if (!fields.startMin && !fields.durationMin && startMin + durationMin > MINUTES_PER_DAY) {
    fields.durationMin = `startMin + durationMin must not exceed ${MINUTES_PER_DAY} (a break cannot run past midnight)`;
  }

  return { fields, values: { day, label, location, startMin, durationMin } };
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

  const body = (await readOptionalJsonBody(c)) as unknown as BreakBody;
  const { fields, values } = validateBreakWrite(body, event, null);

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid break input", fields);
  }

  const created = await createBreak(c.var.db, eventId, values);
  return c.json(created, 201);
});

// PATCH /api/v1/breaks/:id
breaksRoutes.patch("/breaks/:id", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const id = c.req.param("id");
  const ownership = await getBreakForEvent(c.var.db, id);
  if (!ownership) throw new ApiError("not_found", "Break not found");
  const event = await assertEventOwnership(c, ownership.eventId, auth);

  const existing = await getBreakById(c.var.db, id);
  if (!existing) throw new ApiError("not_found", "Break not found");

  const body = (await readOptionalJsonBody(c)) as unknown as BreakBody;
  // DEC-627 (amendment, wave 6): every field is optional on a PATCH (they
  // all default to the existing row); an empty body must be refused rather
  // than reaching updateBreak with every value unchanged.
  requireAtLeastOneField(body as unknown as Record<string, unknown>, [
    "day",
    "label",
    "location",
    "startMin",
    "durationMin",
  ]);
  const { fields, values } = validateBreakWrite(body, event, existing as ResolvedBreakFields);

  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Invalid break input", fields);
  }

  const updated: ScheduleBreak = await updateBreak(c.var.db, id, values);
  return c.json(updated);
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
