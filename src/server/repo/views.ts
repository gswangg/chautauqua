// Saved views repo (J3 gaps, DEC-031). Repo functions are the only code
// that touches drizzle row types (DEC-012); handlers in
// src/routes/api/views.ts call these. config_json shape validation is pure
// (no I/O) and unit-tested directly.

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { DEC_031 } from "../../decisions";
import { SUBMISSION_STATUSES } from "../../domain/status";
import { SORT_ORDERS } from "./submissions/query";

// Compile-checked dependency marker per the field guide: this module
// implements DEC_031 (saved views as server rows scoped to the event).
void DEC_031;

// DEC-031 config_json shape, matching the landed submissions filter/column
// state shapes (app/src/pages/submissions/types.ts SubmissionsFilterState +
// visible column ids) exactly.
export interface SavedViewConfig {
  q: string;
  status: string[];
  trackId: string | null;
  sort: string;
  columns: string[];
}

/**
 * Validates an arbitrary parsed JSON value against the DEC-031 config_json
 * shape. Fails loudly by returning false rather than coercing/guessing —
 * callers wrap this into an ApiError('invalid', ...) at the route boundary.
 */
export function isValidSavedViewConfig(value: unknown): value is SavedViewConfig {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  if (typeof v.q !== "string") return false;
  if (!Array.isArray(v.status) || !v.status.every((s) => typeof s === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(s))) {
    return false;
  }
  if (v.trackId !== null && typeof v.trackId !== "string") return false;
  if (typeof v.sort !== "string" || !(SORT_ORDERS as readonly string[]).includes(v.sort)) return false;
  if (!Array.isArray(v.columns) || !v.columns.every((c) => typeof c === "string")) return false;

  return true;
}

export interface SavedViewRecord {
  id: string;
  eventId: string;
  name: string;
  config: SavedViewConfig;
  createdAt: number;
  updatedAt: number;
}

function toRecord(row: {
  id: string;
  eventId: string;
  name: string;
  configJson: string;
  createdAt: Date;
  updatedAt: Date;
}): SavedViewRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    config: JSON.parse(row.configJson) as SavedViewConfig,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** DEC-461: optional trailing page param — absent means today's unbounded
 * behavior (internal callers unchanged). `id asc` is a deterministic
 * tiebreak after createdAt for stable pagination across pages. */
export async function listSavedViews(
  db: Db,
  eventId: string,
  page?: { limit: number; offset: number },
): Promise<SavedViewRecord[]> {
  const base = db
    .select()
    .from(schema.savedView)
    .where(eq(schema.savedView.eventId, eventId))
    .orderBy(schema.savedView.createdAt, schema.savedView.id);
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toRecord);
}

/** DEC-461 sibling count fn for the true `total` alongside a bounded
 * listSavedViews page. */
export async function countSavedViews(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.savedView)
    .where(eq(schema.savedView.eventId, eventId));
  return Number(rows[0]?.count ?? 0);
}

export async function createSavedView(
  db: Db,
  eventId: string,
  name: string,
  config: SavedViewConfig,
): Promise<SavedViewRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.savedView).values({
    id,
    eventId,
    name,
    configJson: JSON.stringify(config),
    createdAt: now,
    updatedAt: now,
  });
  return { id, eventId, name, config, createdAt: now.getTime(), updatedAt: now.getTime() };
}

/** Returns the saved view's eventId + org id, for ownership checks — null if
 * the view doesn't exist. */
export async function getSavedViewOwnership(
  db: Db,
  id: string,
): Promise<{ eventId: string; orgId: string } | null> {
  const rows = await db
    .select({ eventId: schema.savedView.eventId, orgId: schema.event.orgId })
    .from(schema.savedView)
    .innerJoin(schema.event, eq(schema.savedView.eventId, schema.event.id))
    .where(eq(schema.savedView.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteSavedView(db: Db, id: string, eventId: string): Promise<void> {
  await db.delete(schema.savedView).where(and(eq(schema.savedView.id, id), eq(schema.savedView.eventId, eventId)));
}
