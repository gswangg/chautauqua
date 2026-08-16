// Sessionboard import, layer 3 of 3 (DEC-612, DEC-613): the endpoint. Route
// file exports a named Hono<AppEnv> sub-app; only src/index.ts mounts it
// (DEC-012). Organiser-only, org-scoped via getEventForOrg -- an eventId
// belonging to another org is 404, never 403 (never leaks existence).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { requireOrganizer, csrfJson } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { getEventForOrg } from "../../server/repo/events";
import { applySessionboardPlans } from "../../server/repo/import/sessionboard";
import { parseCsv } from "../../domain/csv";
import { autoMapSessionboardColumns, planSessionboardRows, type SbEntity } from "../../domain/sessionboard";
import { MAX_IMPORT_CSV_BYTES, MAX_IMPORT_ROWS } from "./contacts/import";
import { currentOrgId, asRecord, isPlainObject } from "./contacts/shared";
import { overCapCountMessage } from "../../domain/cap-copy";

export const importRoutes = new Hono<AppEnv>();

// See events.ts/contacts/index.ts for why a blanket `.use("*", ...)` is
// unsafe once mounted under /api/v1 alongside sibling sub-apps — Hono DOES
// rewrite "*" with the mount prefix, but "/api/v1/*" still matches every
// sibling sub-app's routes too, not just this router's own. Scope to this
// router's own path prefix instead (DEC-060 wave-34 amendment), enforced by
// test/role-refusal-probe.test.ts (DEC-459 wave-32).
importRoutes.use("/events/:eventId/import/sessionboard", requireOrganizer);

const SB_ENTITIES: readonly SbEntity[] = ["contacts", "submissions", "tracks", "participants"];

function isSbEntity(v: unknown): v is SbEntity {
  return typeof v === "string" && (SB_ENTITIES as readonly string[]).includes(v);
}

importRoutes.post("/events/:eventId/import/sessionboard", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const eventId = c.req.param("eventId");
  // DEC-612/DEC-613: an eventId from another org is 404, never 403 -- never
  // leaks existence.
  const event = await getEventForOrg(c.var.db, eventId, orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.csvText !== "string" || body.csvText.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { csvText: "required" });
  }
  // DEC-417 pattern, DEC-613: bound the raw CSV payload before parseCsv
  // touches it, using the CRM importer's caps (never re-declared).
  const csvByteLength = new TextEncoder().encode(body.csvText).length;
  if (csvByteLength > MAX_IMPORT_CSV_BYTES) {
    throw new ApiError("invalid", `csvText must be at most ${MAX_IMPORT_CSV_BYTES} bytes`, {
      csvText: overCapCountMessage(csvByteLength, MAX_IMPORT_CSV_BYTES, "byte"),
    });
  }
  if (!isSbEntity(body.entity)) {
    throw new ApiError("invalid", "Validation failed", {
      entity: "must be one of contacts, submissions, tracks, participants",
    });
  }
  const entity = body.entity;
  if (!isPlainObject(body.mapping)) {
    throw new ApiError("invalid", "Validation failed", { mapping: "required, column -> field" });
  }
  const mapping = body.mapping as Record<string, string>;
  if (typeof body.dryRun !== "boolean") {
    throw new ApiError("invalid", "Validation failed", { dryRun: "required boolean" });
  }
  const dryRun = body.dryRun;

  let table: string[][];
  try {
    table = parseCsv(body.csvText);
  } catch (err) {
    throw new ApiError("invalid", err instanceof Error ? err.message : "Failed to parse CSV");
  }
  if (table.length === 0) {
    return c.json({ dryRun, entity, created: 0, updated: 0, skipped: [], issues: [] });
  }
  const [header, ...dataRows] = table;
  if (!header) throw new ApiError("invalid", "CSV has no header row");
  // DEC-417/DEC-613: bound row count after parsing, before planning/applying.
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ApiError("invalid", `csvText must have at most ${MAX_IMPORT_ROWS} data rows`, {
      csvText: overCapCountMessage(dataRows.length, MAX_IMPORT_ROWS, "row"),
    });
  }

  const effectiveMapping =
    Object.keys(mapping).length > 0 ? mapping : autoMapSessionboardColumns(entity, header);
  const { plans, issues } = planSessionboardRows(entity, header, dataRows, effectiveMapping);

  // DEC-613: ONE planner for both modes -- dryRun changes only whether the
  // writes below execute, never how created/updated/skipped are derived.
  const result = await applySessionboardPlans(c.var.db, {
    orgId,
    eventId: event.id,
    entity,
    plans,
    dryRun,
  });

  return c.json({
    dryRun,
    entity,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    issues,
  });
});
