// Segments (migrations/0005_w4_segment.sql, DEC-025/DEC-026). Split out of
// the former monolithic src/routes/api/contacts.ts for contention
// (803-line hotspot) reasons only; no behavior change.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError } from "../../../server/http";
import { MAX_NAME_LENGTH } from "../../../forms/validate"; // DEC-417
import * as repo from "../../../server/repo/contacts";
import { matchesSegment, type ContactRecord, type SegmentRule } from "../../../domain/contacts";
import { clampPage, listPerPage } from "../../../lib/pagination";
import { currentOrgId, asRecord, checkLen, serializeSegment, requireOwnedSegment } from "./shared";

function isRuleShape(r: unknown): r is SegmentRule {
  return (
    typeof r === "object" &&
    r !== null &&
    typeof (r as Record<string, unknown>).field === "string" &&
    ["eq", "ne", "contains"].includes((r as Record<string, unknown>).op as string) &&
    typeof (r as Record<string, unknown>).value === "string"
  );
}

/** Throws (rather than returning an error) if any rule references a field
 * matchesSegment doesn't recognize — fail loudly at parse time rather than
 * at filter time (DEC-149 'any' is a recognized pseudo-field here). */
function assertRulesResolvable(rules: SegmentRule[]): void {
  const probe: ContactRecord = { id: "probe", email: "", firstName: "", lastName: "" };
  matchesSegment(rules, probe);
}

function parseRules(body: Record<string, unknown>, fields: Record<string, string>): SegmentRule[] | undefined {
  if (!Array.isArray(body.rules)) {
    fields.rules = "must be an array of {field,op,value}";
    return undefined;
  }
  const rules: SegmentRule[] = [];
  for (const r of body.rules) {
    if (!isRuleShape(r)) {
      fields.rules = "each rule needs field, op (eq|ne|contains), value";
      return undefined;
    }
    rules.push(r);
  }
  // Fail loudly at creation time rather than at filter time: a bad field
  // name should reject the segment, not silently break every list query
  // that later applies it.
  try {
    assertRulesResolvable(rules);
  } catch (err) {
    fields.rules = err instanceof Error ? err.message : "invalid rule";
    return undefined;
  }
  return rules;
}

/** Parses+validates GET /contacts?rules=<URL-encoded JSON array>
 * (DEC-149). Hono's c.req.query() already URL-decodes the raw param, so
 * this only JSON.parses + shape-checks it. Absent/blank rules param means
 * "no rules" (returns []), matching q/segmentId's absent-means-off
 * convention; any malformed value 400s with {error:{code,message,fields}}. */
export function parseRulesQueryParam(raw: string | undefined): SegmentRule[] {
  if (raw === undefined || raw.trim() === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError("invalid", "rules must be URL-encoded JSON", { rules: "invalid JSON" });
  }
  if (!Array.isArray(parsed)) {
    throw new ApiError("invalid", "rules must be a JSON array", { rules: "must be an array of {field,op,value}" });
  }
  const rules: SegmentRule[] = [];
  for (const r of parsed) {
    if (!isRuleShape(r)) {
      throw new ApiError("invalid", "each rule needs field, op (eq|ne|contains), value", {
        rules: "each rule needs field, op (eq|ne|contains), value",
      });
    }
    rules.push(r);
  }
  try {
    assertRulesResolvable(rules);
  } catch (err) {
    throw new ApiError("invalid", err instanceof Error ? err.message : "invalid rule", {
      rules: err instanceof Error ? err.message : "invalid rule",
    });
  }
  return rules;
}

export function registerSegmentRoutes(contactsRoutes: Hono<AppEnv>): void {
  contactsRoutes.get("/segments", async (c) => {
    const orgId = currentOrgId(c);
    const page = clampPage(c.req.query("page"));
    const perPage = listPerPage(c.req.query("perPage")); // DEC-465
    const [items, total] = await Promise.all([
      repo.listSegmentsForOrg(c.var.db, orgId, { limit: perPage, offset: (page - 1) * perPage }),
      repo.countSegmentsForOrg(c.var.db, orgId),
    ]);
    return c.json({ items: items.map(serializeSegment), total, page, perPage });
  });

  contactsRoutes.post("/segments", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    const fields: Record<string, string> = {};
    if (typeof body.name !== "string" || body.name.trim() === "") fields.name = "required";
    else checkLen(body.name, "name", MAX_NAME_LENGTH, fields); // DEC-417
    const rules = parseRules(body, fields);
    if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

    const created = await repo.createSegment(c.var.db, orgId, body.name as string, rules as SegmentRule[]);
    return c.json(serializeSegment(created), 201);
  });

  contactsRoutes.patch("/segments/:id", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const segment = await requireOwnedSegment(c.var.db, c.req.param("id"), orgId);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    const fields: Record<string, string> = {};
    const patch: { name?: string; rules?: SegmentRule[] } = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") fields.name = "must be a non-empty string";
      else { checkLen(body.name, "name", MAX_NAME_LENGTH, fields); patch.name = body.name; } // DEC-417
    }
    if (body.rules !== undefined) {
      const rules = parseRules(body, fields);
      if (rules) patch.rules = rules;
    }
    if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

    const updated = await repo.patchSegment(c.var.db, segment.id, patch);
    return c.json(serializeSegment(updated));
  });

  contactsRoutes.delete("/segments/:id", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const segment = await requireOwnedSegment(c.var.db, c.req.param("id"), orgId);
    await repo.deleteSegment(c.var.db, segment.id);
    return c.json({ ok: true });
  });
}
