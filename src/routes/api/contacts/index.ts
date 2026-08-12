// CRM API (J11), per DEC-026. Route file exports a named Hono<AppEnv>
// sub-app; only src/index.ts mounts it (DEC-012). Every endpoint is
// organizer-only + csrfJson on mutations, org-scoped via auth.orgId, with
// object-level ownership checks on every :id lookup (no IDOR).
//
// This directory is a decomposition of what was previously a single
// 803-line src/routes/api/contacts.ts (a merge-conflict contention
// hotspot) into cohesive submodules, with no behavior change. This file
// wires the submodules onto one shared Hono sub-app and re-exports the
// small surface other modules/tests import by name.

import { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { requireOrganizer } from "../../../server/middleware";
import { registerCrudRoutes } from "./crud";
import { registerImportRoutes, MAX_IMPORT_CSV_BYTES, MAX_IMPORT_ROWS } from "./import";
import { registerMergeRoutes } from "./merge";
import { registerSegmentRoutes, parseRulesQueryParam } from "./segments";
import { registerBulkEmailRoutes } from "./bulk-email";

export const contactsRoutes = new Hono<AppEnv>();

// NOTE: see events.ts for why a blanket `.use("*", requireOrganizer)` is
// unsafe once mounted under /api/v1 alongside sibling sub-apps — scope to
// this router's own path prefixes instead (DEC-060 w8-d finding).
contactsRoutes.use("/contacts", requireOrganizer);
contactsRoutes.use("/contacts/*", requireOrganizer);
contactsRoutes.use("/segments", requireOrganizer);
contactsRoutes.use("/segments/*", requireOrganizer);

registerCrudRoutes(contactsRoutes);
registerImportRoutes(contactsRoutes);
registerMergeRoutes(contactsRoutes);
registerSegmentRoutes(contactsRoutes);
registerBulkEmailRoutes(contactsRoutes);

// Re-exported for external callers/tests (DEC-417 bounds, DEC-149 query param parser).
export { MAX_IMPORT_CSV_BYTES, MAX_IMPORT_ROWS, parseRulesQueryParam };
