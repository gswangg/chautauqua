// Saved views repo (J3 gaps, DEC-031). Repo functions are the only code
// that touches drizzle row types (DEC-012); handlers in
// src/routes/api/views.ts call these. config_json shape validation is pure
// (no I/O) and unit-tested directly.

import { and, eq, or, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { DEC_031, DEC_904 } from "../../decisions";
import { SUBMISSION_STATUSES } from "../../domain/status";
import { SORT_ORDERS } from "./submissions/query";
import { MAX_SAVED_VIEW_COLUMNS } from "../../domain/saved-views";
import { MAX_TEXT_LENGTH, MAX_NAME_LENGTH } from "../../forms/validate"; // DEC-417/DEC-422

// Compile-checked dependency marker per the field guide: this module
// implements DEC_031 (saved views as server rows scoped to the event) and
// DEC_904 (a saved view is private until its author shares it).
void DEC_031;
void DEC_904;

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

  if (typeof v.q !== "string" || v.q.length > MAX_TEXT_LENGTH) return false;
  if (!Array.isArray(v.status) || !v.status.every((token) => typeof token === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(token))) {
    return false;
  }
  if (v.trackId !== null && (typeof v.trackId !== "string" || v.trackId.length > MAX_NAME_LENGTH)) return false;
  if (typeof v.sort !== "string" || !(SORT_ORDERS as readonly string[]).includes(v.sort)) return false;
  if (
    !Array.isArray(v.columns) ||
    v.columns.length > MAX_SAVED_VIEW_COLUMNS ||
    !v.columns.every((c) => typeof c === "string" && c.length <= MAX_NAME_LENGTH)
  ) {
    return false;
  }

  return true;
}

export interface SavedViewRecord {
  id: string;
  eventId: string;
  name: string;
  config: SavedViewConfig;
  createdByUserId: string | null;
  shared: boolean;
  createdAt: number;
  updatedAt: number;
}

function toRecord(row: {
  id: string;
  eventId: string;
  name: string;
  configJson: string;
  createdByUserId: string | null;
  shared: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SavedViewRecord {
  const parsed: unknown = JSON.parse(row.configJson);
  if (!isValidSavedViewConfig(parsed)) {
    throw new Error(`saved_view ${row.id}.config_json: does not match the DEC-031 config shape`);
  }
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    config: parsed,
    createdByUserId: row.createdByUserId,
    shared: row.shared,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** DEC-904: a saved view is visible to a viewer iff it's shared OR the
 * viewer is its author -- pushed into the WHERE clause as ONE predicate
 * (never a post-fetch JS filter), so listSavedViews and countSavedViews
 * agree on exactly the same set of rows. */
function visibleToViewer(viewerUserId: string) {
  return or(eq(schema.savedView.shared, true), eq(schema.savedView.createdByUserId, viewerUserId));
}

/** DEC-461: optional trailing page param — absent means today's unbounded
 * behavior (internal callers unchanged). `id asc` is a deterministic
 * tiebreak after createdAt for stable pagination across pages. */
export async function listSavedViews(
  db: Db,
  eventId: string,
  viewerUserId: string,
  page?: { limit: number; offset: number },
): Promise<SavedViewRecord[]> {
  const base = db
    .select()
    .from(schema.savedView)
    .where(and(eq(schema.savedView.eventId, eventId), visibleToViewer(viewerUserId)))
    .orderBy(schema.savedView.createdAt, schema.savedView.id);
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toRecord);
}

/** DEC-461 sibling count fn for the true `total` alongside a bounded
 * listSavedViews page -- DEC-904's same visibleToViewer predicate, so the
 * paged total always agrees with what the page can show. */
export async function countSavedViews(db: Db, eventId: string, viewerUserId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.savedView)
    .where(and(eq(schema.savedView.eventId, eventId), visibleToViewer(viewerUserId)));
  return Number(rows[0]?.count ?? 0);
}

/** DEC-422 wave-10 amendment: the per-event saved-view CAP predicate, kept
 * deliberately separate from visibleToViewer/countSavedViews above. The cap
 * is authorship, not visibility -- counting shared rows authored by other
 * organisers here would let a handful of colleagues who like `shared: true`
 * permanently lock everyone else in the org out of creating a view (nobody
 * can create past the cap, nobody can delete someone else's row). Legacy
 * rows with createdByUserId === null are pre-DEC-904 org-owned rows and are
 * NOT counted against any individual author. */
export async function countSavedViewsCreatedBy(db: Db, eventId: string, createdByUserId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.savedView)
    .where(and(eq(schema.savedView.eventId, eventId), eq(schema.savedView.createdByUserId, createdByUserId)));
  return Number(rows[0]?.count ?? 0);
}

export async function createSavedView(
  db: Db,
  eventId: string,
  name: string,
  config: SavedViewConfig,
  createdByUserId: string,
  shared: boolean,
): Promise<SavedViewRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.savedView).values({
    id,
    eventId,
    name,
    configJson: JSON.stringify(config),
    createdByUserId,
    shared,
    createdAt: now,
    updatedAt: now,
  });
  return { id, eventId, name, config, createdByUserId, shared, createdAt: now.getTime(), updatedAt: now.getTime() };
}

/** Returns the saved view's eventId + org id + author + sharing state, for
 * both the cross-org authz check and the DEC-975 delete gate (which must
 * match the DEC-904 read gate: an unshared view is invisible to anyone but
 * its author) — null if the view doesn't exist. */
export async function getSavedViewOwnership(
  db: Db,
  id: string,
): Promise<{ eventId: string; orgId: string; createdByUserId: string | null; shared: boolean } | null> {
  const rows = await db
    .select({
      eventId: schema.savedView.eventId,
      orgId: schema.event.orgId,
      createdByUserId: schema.savedView.createdByUserId,
      shared: schema.savedView.shared,
    })
    .from(schema.savedView)
    .innerJoin(schema.event, eq(schema.savedView.eventId, schema.event.id))
    .where(eq(schema.savedView.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteSavedView(db: Db, id: string, eventId: string): Promise<void> {
  await db.delete(schema.savedView).where(and(eq(schema.savedView.id, id), eq(schema.savedView.eventId, eventId)));
}
