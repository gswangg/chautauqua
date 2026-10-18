// Multi-portal: read an event's portals, their items, and the library tasks
// those items point at.

import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { parsePortalRuleJson, type PortalRule } from "../../../domain/portals/rules";
import {
  parseCapabilitiesJson,
  parseFieldPermissionsJson,
  type Capabilities,
  type FieldPermissions,
} from "../../../domain/portals/permissions";
import type { DeadlineKind, ItemScope, SystemItemKind } from "../../../domain/portals/items";
import type { TaskKind } from "../../../domain/task-kinds";
import { parseAcceptedTypesJson, type FileTypeGroup } from "../../../domain/portals/file-types";

export interface PortalItemRecord {
  id: string;
  portalId: string;
  taskId: string | null;
  resourceId: string | null;
  systemKind: SystemItemKind | null;
  displayName: string | null;
  deadlineKind: DeadlineKind;
  dueDate: number | null;
  relativeDays: number | null;
  required: boolean;
  graceDays: number;
  allowEditAfterSubmit: boolean;
  viewOnlyWhenDone: boolean;
  position: number;
}

export interface PortalRecord {
  id: string;
  eventId: string;
  name: string;
  note: string | null;
  rule: PortalRule;
  fieldPermissions: FieldPermissions;
  capabilities: Capabilities;
  notifyOnJoin: boolean;
  template: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
  items: PortalItemRecord[];
}

export interface LibraryTask {
  id: string;
  eventId: string;
  kind: TaskKind;
  title: string;
  description: string | null;
  instructions: string | null;
  scope: ItemScope;
  formId: string | null;
  required: boolean;
  dueDate: number | null;
  audience: string;
  acceptedTypes: FileTypeGroup[] | null;
  maxSizeMb: number | null;
  maxFiles: number | null;
  deliverableKind: string | null;
}

type PortalRow = typeof schema.portal.$inferSelect;
type ItemRow = typeof schema.portalItem.$inferSelect;

function toItem(r: ItemRow): PortalItemRecord {
  return {
    id: r.id,
    portalId: r.portalId,
    taskId: r.taskId,
    resourceId: r.resourceId,
    systemKind: r.systemKind as SystemItemKind | null,
    displayName: r.displayName,
    deadlineKind: r.deadlineKind as DeadlineKind,
    dueDate: r.dueDate ? r.dueDate.getTime() : null,
    relativeDays: r.relativeDays,
    required: r.required,
    graceDays: r.graceDays,
    allowEditAfterSubmit: r.allowEditAfterSubmit,
    viewOnlyWhenDone: r.viewOnlyWhenDone,
    position: r.position,
  };
}

function toPortal(r: PortalRow, items: PortalItemRecord[]): PortalRecord {
  return {
    id: r.id,
    eventId: r.eventId,
    name: r.name,
    note: r.note,
    rule: parsePortalRuleJson(r.ruleJson),
    fieldPermissions: parseFieldPermissionsJson(r.fieldPermissionsJson),
    capabilities: parseCapabilitiesJson(r.capabilitiesJson),
    notifyOnJoin: r.notifyOnJoin,
    template: r.template,
    position: r.position,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
    items: items.sort((a, b) => a.position - b.position),
  };
}

export async function loadEventPortals(db: Db, eventId: string): Promise<PortalRecord[]> {
  const rows = await db
    .select()
    .from(schema.portal)
    .where(eq(schema.portal.eventId, eventId))
    .orderBy(asc(schema.portal.position), asc(schema.portal.createdAt));
  if (rows.length === 0) return [];
  const items = new Map<string, PortalItemRecord[]>();
  for (const chunk of chunkIds(rows.map((r) => r.id))) {
    const itemRows = await db.select().from(schema.portalItem).where(inArray(schema.portalItem.portalId, chunk));
    for (const i of itemRows) {
      const list = items.get(i.portalId) ?? [];
      list.push(toItem(i));
      items.set(i.portalId, list);
    }
  }
  return rows.map((r) => toPortal(r, items.get(r.id) ?? []));
}

export async function findPortal(db: Db, portalId: string): Promise<PortalRecord | null> {
  const rows = await db.select().from(schema.portal).where(eq(schema.portal.id, portalId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const items = await db.select().from(schema.portalItem).where(eq(schema.portalItem.portalId, portalId));
  return toPortal(row, items.map(toItem));
}

type TaskRow = typeof schema.task.$inferSelect;

export function toLibraryTask(r: TaskRow): LibraryTask {
  return {
    id: r.id,
    eventId: r.eventId,
    kind: r.kind as TaskKind,
    title: r.title,
    description: r.description,
    instructions: r.instructions,
    scope: r.scope as ItemScope,
    formId: r.formId,
    required: r.required,
    dueDate: r.dueDate ? r.dueDate.getTime() : null,
    audience: r.audience,
    acceptedTypes: parseAcceptedTypesJson(r.acceptedTypesJson),
    maxSizeMb: r.maxSizeMb,
    maxFiles: r.maxFiles,
    deliverableKind: r.deliverableKind,
  };
}

export async function loadEventLibraryTasks(db: Db, eventId: string): Promise<Map<string, LibraryTask>> {
  const rows = await db.select().from(schema.task).where(eq(schema.task.eventId, eventId));
  return new Map(rows.map((r) => [r.id, toLibraryTask(r)]));
}

export async function loadEventTimezone(db: Db, eventId: string): Promise<string> {
  const rows = await db.select({ timezone: schema.event.timezone }).from(schema.event).where(eq(schema.event.id, eventId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`event ${eventId} not found`);
  return row.timezone;
}
