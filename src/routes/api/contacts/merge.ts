// Contact merge. Split out of the former monolithic
// src/routes/api/contacts.ts for contention (803-line hotspot) reasons
// only; no behavior change.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError, parseBoundedIdArray } from "../../../server/http";
import * as repo from "../../../server/repo/contacts";
import { previewMerge } from "../../../domain/contacts";
import { toContactRecord } from "../../../server/repo/contacts/rows";
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

  // DEC-705: preview beside the merge route, org-scoped/authz'd identically
  // (requireOwnedContact on every id BEFORE anything else). Computes its
  // report by running the same pure-core planMerge fold the POST route's
  // repo.mergeContacts uses (via previewMerge) over the FULL contact
  // records -- never a second implementation of the merge rules -- so the
  // preview and the write can never drift.
  contactsRoutes.get("/contacts/merge/preview", async (c) => {
    const orgId = currentOrgId(c);
    const idsParam = c.req.query("ids") ?? "";
    const keepId = c.req.query("keep");
    if (typeof keepId !== "string" || keepId === "") {
      throw new ApiError("invalid", "Validation failed", { keep: "required" });
    }
    const rawIds = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id !== "");
    const mergeIds = parseBoundedIdArray(rawIds, "ids", { maxCount: 20 }).filter((id) => id !== keepId);
    if (mergeIds.length === 0) {
      throw new ApiError("invalid", "ids must contain at least one id other than keep", { ids: "required" });
    }

    const keepRow = await requireOwnedContact(c.var.db, keepId, orgId);
    const duplicateRows = [];
    for (const mergeId of Array.from(new Set(mergeIds))) {
      duplicateRows.push(await requireOwnedContact(c.var.db, mergeId, orgId));
    }

    const fields = previewMerge(
      toContactRecord(keepRow),
      duplicateRows.map((row) => toContactRecord(row)),
    );
    return c.json({ fields });
  });
}
