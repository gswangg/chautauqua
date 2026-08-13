// Duplicate dismissal (DEC-770): "Not a duplicate" / "Keep both" are
// persisted facts about a pair, not a session mood. Split out beside
// merge.ts (its own file per w1-g's task boundary -- crud.ts is owned by a
// sibling task this wave) for the same contention reasons the rest of this
// directory is decomposed.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError } from "../../../server/http";
import * as repo from "../../../server/repo/contacts";
import { currentOrgId, asRecord, requireOwnedContact } from "./shared";

export function registerDuplicatesRoutes(contactsRoutes: Hono<AppEnv>): void {
  contactsRoutes.post("/contacts/duplicates/dismiss", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    const contactIds = body.contactIds;
    if (
      !Array.isArray(contactIds) ||
      contactIds.length !== 2 ||
      typeof contactIds[0] !== "string" ||
      typeof contactIds[1] !== "string"
    ) {
      throw new ApiError("invalid", "Validation failed", { contactIds: "must be an array of exactly two ids" });
    }
    const [idA, idB] = contactIds as [string, string];

    // Both ids must be verified org-scoped BEFORE any write -- a
    // cross-org pair is refused, not silently dismissed.
    await requireOwnedContact(c.var.db, idA, orgId);
    await requireOwnedContact(c.var.db, idB, orgId);

    await repo.dismissDuplicatePair(c.var.db, orgId, idA, idB);
    return c.json({ ok: true });
  });
}
