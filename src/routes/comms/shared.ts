// Shared helpers used across the comms/ submodules (templates, compose
// preview/send, portal-invites, email-log). Split out of the former
// monolithic src/routes/comms.ts (804-line contention hotspot) — no
// behavior change, just module boundaries.

import { ApiError } from "../../server/http";
import { getEventForOrg } from "../../server/repo/events";

export async function requireOwnedEvent(
  c: { var: { db: import("../../server/context").Db; auth?: { orgId: string } } },
  eventId: string,
) {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const event = await getEventForOrg(c.var.db, eventId, auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");
  return event;
}
