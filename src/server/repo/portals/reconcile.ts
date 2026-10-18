// Multi-portal reconciliation: turn "which participations match which
// portals right now" into materialised memberships and task assignments.
//
// Runs after a portal is saved, after data that rules read changes
// (acceptance, sponsor changes, invitations), and on the 15-minute cron as a
// backstop. It never deletes an assignment: a portal-sourced row that loses
// every portal gets detached_at set (the answer stays on the record, the
// item leaves the participant's home) and is re-attached if it comes back.

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { matchesRule } from "../../../domain/portals/rules";
import { isActiveParticipation, isMatchableParticipation, type Participation } from "../../../domain/portals/participations";
import { loadParticipations } from "./participations";
import { portalItemDueDay } from "../../../domain/portals/items";
import { loadEventLibraryTasks, loadEventPortals, loadEventTimezone, type LibraryTask, type PortalRecord } from "./store";
import { insertColumnCount } from "../../../db/insert-columns";

// Library kinds that become task_assignment rows. Built-in items
// (acceptance, sponsor sessions) and resources are derived on read.
export const MATERIALISED_KINDS: ReadonlySet<string> = new Set(["general", "form", "file_request", "share_kit"]);

export type NotifyMode = "auto" | "none" | "all";

export interface ReconcileResult {
  joined: { portalId: string; participationKey: string; contactId: string }[];
  left: { portalId: string; participationKey: string; contactId: string }[];
  assignmentsCreated: number;
  assignmentsDetached: number;
  assignmentsReattached: number;
  notifiedContactIds: string[];
}

export interface DesiredMembership {
  portal: PortalRecord;
  participation: Participation;
}

/** Which portals each matchable participation matches. Pure: the change
 * preview runs it against a portal as edited. */
export function computeMemberships(portals: PortalRecord[], participations: Participation[]): DesiredMembership[] {
  const out: DesiredMembership[] = [];
  for (const participation of participations) {
    if (!isMatchableParticipation(participation)) continue;
    for (const portal of portals) {
      if (matchesRule(portal.rule, participation)) out.push({ portal, participation });
    }
  }
  return out;
}

export function scopeKeyFor(task: Pick<LibraryTask, "scope">, participationKey: string): string {
  return task.scope === "participation" ? participationKey : "";
}

export interface DesiredAssignment {
  taskId: string;
  contactId: string;
  scopeKey: string;
  portalIds: string[];
  // merged across the portals that bring it (src/domain/portals/items.ts):
  // the earliest deadline, required if any portal requires it
  dueDay: number | null;
  required: boolean;
}

/** The task assignments active memberships call for, one per (task,
 * person, scope), with every portal that calls for it. `activatedAt` gives
 * the day a membership became active (relative deadlines count from it). */
export function computeDesiredAssignments(
  memberships: DesiredMembership[],
  tasks: Map<string, LibraryTask>,
  activatedAt: (portalId: string, participationKey: string) => number | null,
  timeZone: string,
): Map<string, DesiredAssignment> {
  const out = new Map<string, DesiredAssignment>();
  for (const { portal, participation } of memberships) {
    if (!isActiveParticipation(participation)) continue;
    for (const item of portal.items) {
      if (!item.taskId) continue;
      const task = tasks.get(item.taskId);
      if (!task || !MATERIALISED_KINDS.has(task.kind)) continue;
      const scopeKey = scopeKeyFor(task, participation.key);
      const key = assignmentKey(task.id, participation.contactId, scopeKey);
      const dueDay = portalItemDueDay(item, activatedAt(portal.id, participation.key), timeZone);
      const existing = out.get(key);
      if (existing) {
        if (!existing.portalIds.includes(portal.id)) existing.portalIds.push(portal.id);
        if (dueDay !== null && (existing.dueDay === null || dueDay < existing.dueDay)) existing.dueDay = dueDay;
        existing.required = existing.required || item.required;
      } else {
        out.set(key, {
          taskId: task.id,
          contactId: participation.contactId,
          scopeKey,
          portalIds: [portal.id],
          dueDay,
          required: item.required,
        });
      }
    }
  }
  return out;
}

export function assignmentKey(taskId: string, contactId: string, scopeKey: string): string {
  return `${taskId}\u0000${contactId}\u0000${scopeKey}`;
}

function membershipKey(portalId: string, participationKey: string): string {
  return `${portalId}\u0000${participationKey}`;
}

/** Reconciles one event. `notify` decides whether people who gain new items
 * are queued an email: 'auto' follows each portal's notify-on-join setting,
 * 'all' and 'none' override it (the organizer's choice on a portal save). */
export async function reconcileEventPortals(
  db: Db,
  eventId: string,
  now: Date,
  opts: { notify: NotifyMode } = { notify: "auto" },
): Promise<ReconcileResult> {
  const portals = await loadEventPortals(db, eventId);
  // an event with no portals and no memberships left to end has nothing to
  // reconcile: skip loading every participation (the expensive read)
  if (portals.length === 0) {
    const anyMembership = await db
      .select({ id: schema.portalMembership.id })
      .from(schema.portalMembership)
      .where(eq(schema.portalMembership.eventId, eventId))
      .orderBy(asc(schema.portalMembership.id))
      .limit(1);
    if (!anyMembership[0]) {
      return { joined: [], left: [], assignmentsCreated: 0, assignmentsDetached: 0, assignmentsReattached: 0, notifiedContactIds: [] };
    }
  }
  const [participations, tasks, timeZone] = await Promise.all([
    loadParticipations(db, { eventId }),
    loadEventLibraryTasks(db, eventId),
    loadEventTimezone(db, eventId),
  ]);
  const desired = computeMemberships(portals, participations);

  // memberships
  const existingRows = await db
    .select()
    .from(schema.portalMembership)
    .where(eq(schema.portalMembership.eventId, eventId));
  const existing = new Map(existingRows.map((r) => [membershipKey(r.portalId, r.participationKey), r]));
  const desiredKeys = new Set<string>();
  const joined: ReconcileResult["joined"] = [];
  const toInsert: (typeof schema.portalMembership.$inferInsert)[] = [];
  const activations: { id: string; activatedAt: Date | null }[] = [];
  // the activation each desired membership has once this pass is written
  const activatedAtByKey = new Map<string, number | null>();
  for (const { portal, participation } of desired) {
    const key = membershipKey(portal.id, participation.key);
    desiredKeys.add(key);
    const active = isActiveParticipation(participation);
    const row = existing.get(key);
    activatedAtByKey.set(
      key,
      !active ? null : row?.activatedAt ? row.activatedAt.getTime() : now.getTime(),
    );
    if (!row) {
      joined.push({ portalId: portal.id, participationKey: participation.key, contactId: participation.contactId });
      toInsert.push({
        id: newId(),
        portalId: portal.id,
        eventId,
        participationKey: participation.key,
        contactId: participation.contactId,
        joinedAt: now,
        activatedAt: active ? now : null,
        createdAt: now,
        updatedAt: now,
      });
    } else if (active && row.activatedAt === null) {
      activations.push({ id: row.id, activatedAt: now });
    } else if (!active && row.activatedAt !== null) {
      activations.push({ id: row.id, activatedAt: null });
    }
  }
  for (const chunk of chunkRowsForInsert(toInsert, { boundColumns: insertColumnCount(schema.portalMembership) })) {
    await db
      .insert(schema.portalMembership)
      .values(chunk)
      .onConflictDoNothing({ target: [schema.portalMembership.portalId, schema.portalMembership.participationKey] });
  }
  // an activation is either "now" or cleared: one set-based update each
  const activate = activations.filter((a) => a.activatedAt !== null).map((a) => a.id);
  const deactivate = activations.filter((a) => a.activatedAt === null).map((a) => a.id);
  for (const chunk of chunkIds(activate)) {
    await db.update(schema.portalMembership).set({ activatedAt: now, updatedAt: now }).where(inArray(schema.portalMembership.id, chunk));
  }
  for (const chunk of chunkIds(deactivate)) {
    await db.update(schema.portalMembership).set({ activatedAt: null, updatedAt: now }).where(inArray(schema.portalMembership.id, chunk));
  }
  const left = existingRows.filter((r) => !desiredKeys.has(membershipKey(r.portalId, r.participationKey)));
  for (const chunk of chunkIds(left.map((r) => r.id))) {
    await db.delete(schema.portalMembership).where(inArray(schema.portalMembership.id, chunk));
  }

  // assignments
  const desiredAssignments = computeDesiredAssignments(
    desired,
    tasks,
    (portalId, participationKey) => activatedAtByKey.get(membershipKey(portalId, participationKey)) ?? null,
    timeZone,
  );
  const taskIds = [...tasks.keys()];
  const existingAssignments: {
    id: string;
    taskId: string;
    contactId: string;
    scopeKey: string;
    source: string;
    detachedAt: Date | null;
    dueDate: Date | null;
    required: boolean | null;
  }[] = [];
  for (const chunk of chunkIds(taskIds)) {
    existingAssignments.push(
      ...(await db
        .select({
          id: schema.taskAssignment.id,
          taskId: schema.taskAssignment.taskId,
          contactId: schema.taskAssignment.contactId,
          scopeKey: schema.taskAssignment.scopeKey,
          source: schema.taskAssignment.source,
          detachedAt: schema.taskAssignment.detachedAt,
          dueDate: schema.taskAssignment.dueDate,
          required: schema.taskAssignment.required,
        })
        .from(schema.taskAssignment)
        .where(inArray(schema.taskAssignment.taskId, chunk))),
    );
  }
  const existingByKey = new Map(existingAssignments.map((a) => [assignmentKey(a.taskId, a.contactId, a.scopeKey), a]));

  const newAssignments: (typeof schema.taskAssignment.$inferInsert)[] = [];
  const reattach: string[] = [];
  const settle = new Map<string, { dueDay: number | null; required: boolean; ids: string[] }>();
  const gainedByContact = new Map<string, { taskIds: Set<string>; portalIds: Set<string> }>();
  for (const [key, d] of desiredAssignments) {
    const row = existingByKey.get(key);
    if (!row) {
      newAssignments.push({
        id: newId(),
        taskId: d.taskId,
        contactId: d.contactId,
        scopeKey: d.scopeKey,
        source: "portal",
        status: "pending",
        dueDate: d.dueDay === null ? null : new Date(d.dueDay),
        required: d.required,
        createdAt: now,
        updatedAt: now,
      });
      const gained = gainedByContact.get(d.contactId) ?? { taskIds: new Set<string>(), portalIds: new Set<string>() };
      gained.taskIds.add(d.taskId);
      for (const p of d.portalIds) gained.portalIds.add(p);
      gainedByContact.set(d.contactId, gained);
    } else if (row.source === "portal") {
      if (row.detachedAt !== null) reattach.push(row.id);
      // a rule, item or activation change can move the merged deadline
      if ((row.dueDate?.getTime() ?? null) !== d.dueDay || row.required !== d.required) {
        const k = `${d.dueDay ?? ""}|${d.required ? 1 : 0}`;
        const group = settle.get(k) ?? { dueDay: d.dueDay, required: d.required, ids: [] };
        group.ids.push(row.id);
        settle.set(k, group);
      }
    }
  }
  const detach = existingAssignments
    .filter((a) => a.source === "portal" && a.detachedAt === null && !desiredAssignments.has(assignmentKey(a.taskId, a.contactId, a.scopeKey)))
    .map((a) => a.id);

  for (const chunk of chunkRowsForInsert(newAssignments, { boundColumns: insertColumnCount(schema.taskAssignment) })) {
    await db
      .insert(schema.taskAssignment)
      .values(chunk)
      .onConflictDoNothing({
        target: [schema.taskAssignment.taskId, schema.taskAssignment.contactId, schema.taskAssignment.scopeKey],
      });
  }
  for (const chunk of chunkIds(reattach)) {
    await db
      .update(schema.taskAssignment)
      .set({ detachedAt: null, updatedAt: now })
      .where(and(inArray(schema.taskAssignment.id, chunk), eq(schema.taskAssignment.source, "portal")));
  }
  for (const group of settle.values()) {
    for (const chunk of chunkIds(group.ids)) {
      await db
        .update(schema.taskAssignment)
        .set({ dueDate: group.dueDay === null ? null : new Date(group.dueDay), required: group.required, updatedAt: now })
        .where(and(inArray(schema.taskAssignment.id, chunk), eq(schema.taskAssignment.source, "portal")));
    }
  }
  for (const chunk of chunkIds(detach)) {
    await db
      .update(schema.taskAssignment)
      .set({ detachedAt: now, updatedAt: now })
      .where(and(inArray(schema.taskAssignment.id, chunk), eq(schema.taskAssignment.source, "portal")));
  }

  // notifications
  const portalsById = new Map(portals.map((p) => [p.id, p]));
  const notified: string[] = [];
  const notifications: (typeof schema.portalNotification.$inferInsert)[] = [];
  for (const [contactId, gained] of gainedByContact) {
    const wants =
      opts.notify === "all" ||
      (opts.notify === "auto" && [...gained.portalIds].some((id) => portalsById.get(id)?.notifyOnJoin === true));
    if (!wants) continue;
    notified.push(contactId);
    notifications.push({
      id: newId(),
      eventId,
      contactId,
      taskIdsJson: JSON.stringify([...gained.taskIds]),
      createdAt: now,
      sentAt: null,
    });
  }
  for (const chunk of chunkRowsForInsert(notifications, { boundColumns: insertColumnCount(schema.portalNotification) })) {
    await db.insert(schema.portalNotification).values(chunk);
  }

  return {
    joined,
    left: left.map((r) => ({ portalId: r.portalId, participationKey: r.participationKey, contactId: r.contactId })),
    assignmentsCreated: newAssignments.length,
    assignmentsDetached: detach.length,
    assignmentsReattached: reattach.length,
    notifiedContactIds: notified,
  };
}
