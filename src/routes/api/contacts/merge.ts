// Contact merge. Split out of the former monolithic
// src/routes/api/contacts.ts for contention (803-line hotspot) reasons
// only; no behavior change.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError, parseBoundedIdArray } from "../../../server/http";
import * as repo from "../../../server/repo/contacts";
import { currentOrgId, asRecord, serializeContact, requireOwnedContact } from "./shared";

export function registerMergeRoutes(contactsRoutes: Hono<AppEnv>): void {
  contactsRoutes.post("/contacts/merge", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    if (typeof body.keepId !== "string") {
      throw new ApiError("invalid", "Validation failed", { keepId: "required" });
    }
    const mergeIds = parseBoundedIdArray(body.mergeIds, "mergeIds", { maxCount: 20 });

    // DEC-629: every id (keepId + all mergeIds) must be verified
    // org-scoped BEFORE any write, so one foreign or unknown id means zero
    // writes -- not a partial merge of whichever ids happened to be checked
    // first.
    await requireOwnedContact(c.var.db, body.keepId, orgId);
    for (const mergeId of mergeIds) {
      await requireOwnedContact(c.var.db, mergeId, orgId);
    }

    const merged = await repo.mergeContacts(c.var.db, body.keepId, mergeIds);
    return c.json(serializeContact(merged));
  });
}
