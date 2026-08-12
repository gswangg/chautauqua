// Contact merge. Split out of the former monolithic
// src/routes/api/contacts.ts for contention (803-line hotspot) reasons
// only; no behavior change.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError } from "../../../server/http";
import * as repo from "../../../server/repo/contacts";
import { currentOrgId, asRecord, serializeContact, requireOwnedContact } from "./shared";

export function registerMergeRoutes(contactsRoutes: Hono<AppEnv>): void {
  contactsRoutes.post("/contacts/merge", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    if (typeof body.keepId !== "string" || typeof body.mergeId !== "string") {
      throw new ApiError("invalid", "Validation failed", { keepId: "required", mergeId: "required" });
    }
    if (body.keepId === body.mergeId) {
      throw new ApiError("invalid", "keepId and mergeId must differ", { mergeId: "must differ from keepId" });
    }

    await requireOwnedContact(c.var.db, body.keepId, orgId);
    await requireOwnedContact(c.var.db, body.mergeId, orgId);

    const merged = await repo.mergeContacts(c.var.db, body.keepId, body.mergeId);
    return c.json(serializeContact(merged));
  });
}
