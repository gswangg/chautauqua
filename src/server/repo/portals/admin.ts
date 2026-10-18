// Organizer side of portals (Portals frame, flows 1-3): the overview with
// coverage, the editor's data and live matches, the change-impact preview,
// saving, duplicating, deleting, templates and copying from another event.

import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { ApiError } from "../../http";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import {
  PARTICIPATION_KINDS,
  PARTICIPATION_KIND_LABELS,
  RULE_ROLE_OPTIONS,
  SESSION_ORIGINS,
  SESSION_ORIGIN_LABELS,
  SPONSORSHIP_STATUSES,
  isActiveParticipation,
  isMatchableParticipation,
  participationLabel,
  participationRoleLabel,
  unmatchedReason,
  type Participation,
} from "../../../domain/portals/participations";
import { RULE_FIELDS, RULE_FIELD_LABELS, describeRule, matchesRule, parsePortalRule, type PortalRule } from "../../../domain/portals/rules";
import {
  CAPABILITIES,
  FIELD_LEVELS,
  parseCapabilities,
  parseFieldPermissions,
  type Capabilities,
  type FieldPermissions,
} from "../../../domain/portals/permissions";
import {
  DEADLINE_KINDS,
  MAX_GRACE_DAYS,
  MAX_RELATIVE_DAYS,
  SYSTEM_ITEM_LABELS,
  SYSTEM_ITEM_SCOPES,
  isSystemItemKind,
  type DeadlineKind,
  type SystemItemKind,
} from "../../../domain/portals/items";
import { PORTAL_TEMPLATES, findPortalTemplate, type PortalTemplate } from "../../../domain/portals/templates";
import { SUBMISSION_STATUSES } from "../../../domain/status";
import { MAX_PORTALS_PER_EVENT, MAX_PORTAL_ITEMS, MAX_PORTAL_NAME, MAX_PORTAL_NOTE } from "../../../domain/portals/limits";
import { isIsoDate } from "../../../domain/iso-date";
import { capitalizeFirst } from "../../../domain/count-copy";
import { INVITE_STATUSES } from "../../../domain/invite-status";
import { getFieldOptionsByRole } from "../form-roles";
import { loadParticipations } from "./participations";
import { findPortal, loadEventLibraryTasks, loadEventPortals, type LibraryTask, type PortalItemRecord, type PortalRecord } from "./store";
import { computeDesiredAssignments, computeMemberships, scopeKeyFor } from "./reconcile";


// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface PortalItemInput {
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
}

export interface PortalInput {
  name: string;
  note: string | null;
  rule: PortalRule;
  fieldPermissions: FieldPermissions;
  capabilities: Capabilities;
  notifyOnJoin: boolean;
  items: PortalItemInput[];
}

function refuse(message: string, field: string): never {
  throw new ApiError("invalid", message, { [field]: message });
}

function parseDay(v: unknown, field: string): number {
  if (typeof v !== "string" || !isIsoDate(v)) refuse("Dates are YYYY-MM-DD.", field);
  const [y, m, d] = (v as string).split("-").map(Number) as [number, number, number];
  const ms = Date.UTC(y, m - 1, d);
  if (Number.isNaN(ms) || new Date(ms).getUTCDate() !== d) refuse("That isn't a real date.", field);
  return ms;
}

function parseItem(raw: unknown, i: number): PortalItemInput {
  if (typeof raw !== "object" || raw === null) refuse(`Item ${i + 1} is not an item.`, `items.${i}`);
  const r = raw as Record<string, unknown>;
  const taskId = typeof r.taskId === "string" && r.taskId ? r.taskId : null;
  const resourceId = typeof r.resourceId === "string" && r.resourceId ? r.resourceId : null;
  const systemKind = typeof r.systemKind === "string" && r.systemKind ? r.systemKind : null;
  if ([taskId, resourceId, systemKind].filter(Boolean).length !== 1) {
    refuse(`Item ${i + 1} must be exactly one library task, resource or built-in item.`, `items.${i}`);
  }
  if (systemKind !== null && !isSystemItemKind(systemKind)) refuse(`Item ${i + 1}: unknown built-in item.`, `items.${i}.systemKind`);
  const deadlineKind = (r.deadlineKind ?? "none") as string;
  if (!(DEADLINE_KINDS as readonly string[]).includes(deadlineKind)) refuse(`Item ${i + 1}: unknown deadline.`, `items.${i}.deadlineKind`);
  let dueDate: number | null = null;
  let relativeDays: number | null = null;
  if (deadlineKind === "fixed") dueDate = parseDay(r.dueDate, `items.${i}.dueDate`);
  if (deadlineKind === "relative") {
    const n = r.relativeDays;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > MAX_RELATIVE_DAYS) {
      refuse(`Item ${i + 1}: days after joining must be 0 to ${MAX_RELATIVE_DAYS}.`, `items.${i}.relativeDays`);
    }
    relativeDays = n as number;
  }
  const grace = r.graceDays ?? 0;
  if (typeof grace !== "number" || !Number.isInteger(grace) || grace < 0 || grace > MAX_GRACE_DAYS) {
    refuse(`Item ${i + 1}: grace must be 0 to ${MAX_GRACE_DAYS} days.`, `items.${i}.graceDays`);
  }
  let displayName: string | null = null;
  if (r.displayName !== undefined && r.displayName !== null) {
    if (typeof r.displayName !== "string" || r.displayName.length > 120) refuse(`Item ${i + 1}: the name is too long.`, `items.${i}.displayName`);
    displayName = (r.displayName as string).trim() || null;
  }
  const bool = (v: unknown, name: string): boolean => {
    if (v === undefined) return false;
    if (typeof v !== "boolean") refuse(`Item ${i + 1}: ${name} must be true or false.`, `items.${i}.${name}`);
    return v as boolean;
  };
  return {
    taskId,
    resourceId,
    systemKind: systemKind as SystemItemKind | null,
    displayName,
    deadlineKind: deadlineKind as DeadlineKind,
    dueDate,
    relativeDays,
    required: bool(r.required, "required"),
    graceDays: grace as number,
    allowEditAfterSubmit: bool(r.allowEditAfterSubmit, "allowEditAfterSubmit"),
    viewOnlyWhenDone: bool(r.viewOnlyWhenDone, "viewOnlyWhenDone"),
  };
}

/** Validates an untrusted portal body. Library references are checked
 * against the event separately (assertItemsBelongToEvent). */
export function parsePortalInput(body: Record<string, unknown>): PortalInput {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) refuse("A portal needs a name.", "name");
  if (name.length > MAX_PORTAL_NAME) refuse(`A portal name is at most ${MAX_PORTAL_NAME} characters.`, "name");
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string" || body.note.length > MAX_PORTAL_NOTE) refuse(`The note is at most ${MAX_PORTAL_NOTE} characters.`, "note");
    note = (body.note as string).trim() || null;
  }
  let rule: PortalRule;
  let fieldPermissions: FieldPermissions;
  let capabilities: Capabilities;
  try {
    rule = parsePortalRule(body.rule ?? { groups: [] });
  } catch (err) {
    refuse((err as Error).message, "rule");
  }
  try {
    fieldPermissions = parseFieldPermissions(body.fieldPermissions ?? {});
  } catch (err) {
    refuse((err as Error).message, "fieldPermissions");
  }
  try {
    capabilities = parseCapabilities(body.capabilities ?? {});
  } catch (err) {
    refuse((err as Error).message, "capabilities");
  }
  const itemsRaw = body.items ?? [];
  if (!Array.isArray(itemsRaw)) refuse("Items must be a list.", "items");
  if ((itemsRaw as unknown[]).length > MAX_PORTAL_ITEMS) refuse(`A portal can have at most ${MAX_PORTAL_ITEMS} items.`, "items");
  const items = (itemsRaw as unknown[]).map(parseItem);
  const seen = new Set<string>();
  for (const it of items) {
    const k = it.taskId ?? it.resourceId ?? `sys:${it.systemKind}`;
    if (seen.has(k)) refuse("The same item is in this portal twice.", "items");
    seen.add(k);
  }
  const notifyOnJoin = body.notifyOnJoin === undefined ? true : body.notifyOnJoin === true;
  return { name, note, rule: rule!, fieldPermissions: fieldPermissions!, capabilities: capabilities!, notifyOnJoin, items };
}

async function assertItemsBelongToEvent(db: Db, eventId: string, items: PortalItemInput[]): Promise<void> {
  const taskIds = items.map((i) => i.taskId).filter((x): x is string => x !== null);
  const resourceIds = items.map((i) => i.resourceId).filter((x): x is string => x !== null);
  if (taskIds.length > 0) {
    const rows = await db
      .select({ id: schema.task.id })
      .from(schema.task)
      .where(and(eq(schema.task.eventId, eventId), inArray(schema.task.id, taskIds)));
    if (rows.length !== new Set(taskIds).size) refuse("An item isn't in this event's library.", "items");
  }
  if (resourceIds.length > 0) {
    const rows = await db
      .select({ id: schema.resource.id })
      .from(schema.resource)
      .where(and(eq(schema.resource.eventId, eventId), inArray(schema.resource.id, resourceIds)));
    if (rows.length !== new Set(resourceIds).size) refuse("A resource isn't in this event's library.", "items");
  }
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/** The participations coverage is measured over: everyone an organizer
 * would expect a portal for -- people on accepted sessions (invited ones
 * included, so they can see their invitation), sponsor contacts and event
 * roles. Sessions still in review and declined sessions are not gaps. */
export function isCoverageParticipation(p: Participation): boolean {
  if (!isMatchableParticipation(p)) return false;
  if (p.session) return p.session.status === "accepted";
  return true;
}

export interface PortalSummary {
  id: string;
  name: string;
  template: string | null;
  who: string;
  participations: number;
  items: number;
  matchesNobody: boolean;
  createdAt: number;
}

export interface UnmatchedRow {
  key: string;
  contactId: string;
  name: string;
  participation: string;
  reason: string;
}

export interface PortalOverview {
  portals: PortalSummary[];
  covered: number;
  total: number;
  notInAny: number;
  overlap: number;
  templates: { key: string; name: string; blurb: string }[];
}

export interface RuleLabelContext {
  tiers: Map<string, string>;
  tracks: Map<string, string>;
}

export function ruleLabels(ctx: RuleLabelContext) {
  return {
    field: (f: string) => (f.startsWith("custom:") ? `Contact field ${f.slice(7)}` : (RULE_FIELD_LABELS as Record<string, string>)[f] ?? f),
    value: (f: string, v: string) => {
      if (f === "role") return participationRoleLabel(v);
      if (f === "arrival") return (SESSION_ORIGIN_LABELS as Record<string, string>)[v] ?? v;
      if (f === "sponsor_tier") return ctx.tiers.get(v) ?? v;
      if (f === "track") return ctx.tracks.get(v) ?? v;
      if (f === "kind") return (PARTICIPATION_KIND_LABELS as Record<string, string>)[v] ?? v;
      return v;
    },
  };
}

async function loadRuleLabelContext(db: Db, eventId: string): Promise<RuleLabelContext> {
  const [tiers, tracks] = await Promise.all([
    db.select({ id: schema.sponsorTier.id, name: schema.sponsorTier.name }).from(schema.sponsorTier).where(eq(schema.sponsorTier.eventId, eventId)),
    db.select({ id: schema.track.id, name: schema.track.name }).from(schema.track).where(eq(schema.track.eventId, eventId)),
  ]);
  return { tiers: new Map(tiers.map((t) => [t.id, t.name])), tracks: new Map(tracks.map((t) => [t.id, t.name])) };
}

export async function getPortalOverview(db: Db, eventId: string): Promise<PortalOverview> {
  const [portals, participations, ctx] = await Promise.all([
    loadEventPortals(db, eventId),
    loadParticipations(db, { eventId }),
    loadRuleLabelContext(db, eventId),
  ]);
  const universe = participations.filter(isCoverageParticipation);
  const matchCount = new Map<string, number>();
  let covered = 0;
  let overlap = 0;
  for (const p of universe) {
    const hits = portals.filter((portal) => matchesRule(portal.rule, p));
    if (hits.length > 0) covered += 1;
    if (hits.length > 1) overlap += 1;
    for (const h of hits) matchCount.set(h.id, (matchCount.get(h.id) ?? 0) + 1);
  }
  const labels = ruleLabels(ctx);
  return {
    portals: portals.map((p) => {
      // a portal also counts the invited and in-review people it matches
      const n = participations.filter((x) => isMatchableParticipation(x) && matchesRule(p.rule, x)).length;
      return {
        id: p.id,
        name: p.name,
        template: p.template,
        who: describeRule(p.rule, labels),
        participations: Math.max(n, matchCount.get(p.id) ?? 0),
        items: p.items.length,
        matchesNobody: n === 0,
        createdAt: p.createdAt,
      };
    }),
    covered,
    total: universe.length,
    notInAny: universe.length - covered,
    overlap,
    templates: PORTAL_TEMPLATES.map((t) => ({ key: t.key, name: t.name, blurb: t.blurb })),
  };
}

/** Speakers · not in any portal: every coverage participation no portal
 * matches, with the reason. */
export async function listUnmatchedParticipations(db: Db, eventId: string): Promise<UnmatchedRow[]> {
  const [portals, participations] = await Promise.all([loadEventPortals(db, eventId), loadParticipations(db, { eventId })]);
  return participations
    .filter((p) => isCoverageParticipation(p) && !portals.some((portal) => matchesRule(portal.rule, p)))
    .map((p) => ({
      key: p.key,
      contactId: p.contactId,
      name: p.contactName,
      participation: participationLabel(p, participationRoleLabel),
      reason: unmatchedReason(p, participationRoleLabel),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export interface RuleFieldOption {
  field: string;
  label: string;
  values: { value: string; label: string }[];
}

/** The rule builder's fields and the values each can take at this event. */
export async function getRuleOptions(db: Db, eventId: string): Promise<RuleFieldOption[]> {
  const [ctx, formats] = await Promise.all([loadRuleLabelContext(db, eventId), getFieldOptionsByRole(db, eventId, "session_format")]);
  const values: Record<string, { value: string; label: string }[]> = {
    kind: PARTICIPATION_KINDS.map((k) => ({ value: k, label: PARTICIPATION_KIND_LABELS[k] })),
    role: RULE_ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    arrival: SESSION_ORIGINS.map((o) => ({ value: o, label: SESSION_ORIGIN_LABELS[o] })),
    format: (formats ?? []).map((f) => ({ value: f, label: f })),
    track: [...ctx.tracks].map(([value, label]) => ({ value, label })),
    session_status: SUBMISSION_STATUSES.map((s) => ({ value: s, label: capitalizeFirst(s.replace(/_/g, " ")) })),
    participation_status: INVITE_STATUSES.map((status) => ({ value: status, label: status === "none" ? "Active" : capitalizeFirst(status) })),
    sponsor_tier: [...ctx.tiers].map(([value, label]) => ({ value, label })),
    sponsorship_status: SPONSORSHIP_STATUSES.map((status) => ({ value: status, label: capitalizeFirst(status) })),
  };
  return RULE_FIELDS.map((f) => ({ field: f, label: RULE_FIELD_LABELS[f], values: values[f] ?? [] }));
}

export interface MatchRow {
  key: string;
  contactId: string;
  name: string;
  participation: string;
}

export interface EditorItem extends PortalItemRecord {
  title: string;
  kind: string;
  scope: string;
  libraryHint: string;
}

export interface PortalEditorData {
  portal: PortalRecord;
  items: EditorItem[];
  matches: { count: number; rows: MatchRow[]; saved: number };
  ruleText: string;
  ruleOptions: RuleFieldOption[];
  fieldLevels: readonly string[];
  capabilities: readonly string[];
}

function itemMeta(item: Pick<PortalItemRecord, "taskId" | "resourceId" | "systemKind">, tasks: Map<string, LibraryTask>, resources: Map<string, string>) {
  if (item.systemKind) return { title: SYSTEM_ITEM_LABELS[item.systemKind], kind: item.systemKind, scope: SYSTEM_ITEM_SCOPES[item.systemKind] };
  if (item.taskId) {
    const t = tasks.get(item.taskId);
    return { title: t?.title ?? "Missing item", kind: t?.kind ?? "general", scope: t?.scope ?? "person" };
  }
  return { title: resources.get(item.resourceId ?? "") ?? "Missing resource", kind: "resource", scope: "person" };
}

export async function getPortalEditorData(db: Db, eventId: string, portalId: string): Promise<PortalEditorData | null> {
  const portal = await findPortal(db, portalId);
  if (!portal || portal.eventId !== eventId) return null;
  const [participations, tasks, resources, ctx, ruleOptions, saved, allPortals] = await Promise.all([
    loadParticipations(db, { eventId }),
    loadEventLibraryTasks(db, eventId),
    db.select({ id: schema.resource.id, title: schema.resource.title }).from(schema.resource).where(eq(schema.resource.eventId, eventId)),
    loadRuleLabelContext(db, eventId),
    getRuleOptions(db, eventId),
    db.select({ n: sql<number>`count(*)` }).from(schema.portalMembership).where(eq(schema.portalMembership.portalId, portalId)),
    loadEventPortals(db, eventId),
  ]);
  const resourceTitles = new Map(resources.map((r) => [r.id, r.title]));
  const usedBy = (taskId: string) => allPortals.filter((p) => p.id !== portal.id && p.items.some((i) => i.taskId === taskId)).map((p) => p.name);
  const matches = participations.filter((p) => isMatchableParticipation(p) && matchesRule(portal.rule, p));
  return {
    portal,
    items: portal.items.map((i) => {
      const meta = itemMeta(i, tasks, resourceTitles);
      const others = i.taskId ? usedBy(i.taskId) : [];
      return { ...i, ...meta, libraryHint: i.systemKind ? "Built in" : others.length > 0 ? `Shared library item · also in ${others.join(", ")}` : "Shared library item" };
    }),
    matches: {
      count: matches.length,
      rows: matches.slice(0, 200).map((p) => ({ key: p.key, contactId: p.contactId, name: p.contactName, participation: participationLabel(p, participationRoleLabel) })),
      saved: Number(saved[0]?.n ?? 0),
    },
    ruleText: describeRule(portal.rule, ruleLabels(ctx)),
    ruleOptions,
    fieldLevels: FIELD_LEVELS,
    capabilities: CAPABILITIES,
  };
}

/** Live matches for a rule as edited (the panel pinned beside the rule). */
export async function matchRule(db: Db, eventId: string, rule: PortalRule, portalId: string | null): Promise<{ count: number; rows: MatchRow[]; gained: number; lost: number }> {
  const participations = await loadParticipations(db, { eventId });
  const matches = participations.filter((p) => isMatchableParticipation(p) && matchesRule(rule, p));
  let gained = 0;
  let lost = 0;
  if (portalId) {
    const current = await findPortal(db, portalId);
    if (current && current.eventId === eventId) {
      const before = new Set(participations.filter((p) => isMatchableParticipation(p) && matchesRule(current.rule, p)).map((p) => p.key));
      const after = new Set(matches.map((p) => p.key));
      gained = [...after].filter((k) => !before.has(k)).length;
      lost = [...before].filter((k) => !after.has(k)).length;
    }
  }
  return {
    count: matches.length,
    rows: matches.slice(0, 200).map((p) => ({ key: p.key, contactId: p.contactId, name: p.contactName, participation: participationLabel(p, participationRoleLabel) })),
    gained,
    lost,
  };
}

// ---------------------------------------------------------------------------
// Change-impact preview
// ---------------------------------------------------------------------------

export interface ImpactItemLine {
  title: string;
  people: number;
  // losers who already finished it (answers are kept)
  filed?: number;
  // losers who keep it through another portal
  keptThrough?: { portal: string; people: number }[];
}

export interface PortalImpact {
  affected: number;
  gain: { count: number; who: string; items: ImpactItemLine[] };
  lose: { count: number; who: string; items: ImpactItemLine[] };
  // people who would get at least one item they don't have now
  newItems: { people: number; contactIds: string[] };
  permissionChanges: string[];
  people: { contactId: string; name: string; participation: string; change: "gain" | "lose" | "new_items" }[];
  // a note-only change saves without this preview
  needsPreview: boolean;
}

function describeGroup(ps: Participation[]): string {
  if (ps.length === 0) return "";
  const roles = new Map<string, number>();
  for (const p of ps) {
    let label = participationRoleLabel(p.role).toLowerCase();
    if (p.session?.format) {
      const fmt = p.session.format.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
      label = p.role === "speaker" ? `${fmt} speakers` : `${fmt} ${label}s`;
    } else label = `${label}s`;
    if (p.session?.origin === "cfp" && !label.startsWith("cfp")) label = `CFP ${label}`;
    roles.set(label, (roles.get(label) ?? 0) + 1);
  }
  const sorted = [...roles].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 1) return sorted[0]![0];
  return `${sorted[0]![0]} and ${ps.length - sorted[0]![1]} more`;
}

function toRecord(portalId: string, eventId: string, input: PortalInput, base: PortalRecord | null): PortalRecord {
  return {
    id: portalId,
    eventId,
    name: input.name,
    note: input.note,
    rule: input.rule,
    fieldPermissions: input.fieldPermissions,
    capabilities: input.capabilities,
    notifyOnJoin: input.notifyOnJoin,
    template: base?.template ?? null,
    position: base?.position ?? 0,
    createdAt: base?.createdAt ?? 0,
    updatedAt: base?.updatedAt ?? 0,
    items: input.items.map((it, position) => ({ id: `draft-${position}`, portalId, position, ...it })),
  };
}

/** What saving the edited portal would do, computed from the edited rule,
 * items and permissions against today's data. Nothing is written. */
export async function previewPortalChange(db: Db, eventId: string, portalId: string | null, input: PortalInput): Promise<PortalImpact> {
  await assertItemsBelongToEvent(db, eventId, input.items);
  const [portals, participations, tasks] = await Promise.all([
    loadEventPortals(db, eventId),
    loadParticipations(db, { eventId }),
    loadEventLibraryTasks(db, eventId),
  ]);
  const current = portalId ? (portals.find((p) => p.id === portalId) ?? null) : null;
  if (portalId && !current) throw new ApiError("not_found", "Portal not found");
  const draftId = portalId ?? "draft";
  const edited = toRecord(draftId, eventId, input, current);
  const others = portals.filter((p) => p.id !== portalId);

  const matchable = participations.filter(isMatchableParticipation);
  const before = new Set(current ? matchable.filter((p) => matchesRule(current.rule, p)).map((p) => p.key) : []);
  const after = new Set(matchable.filter((p) => matchesRule(edited.rule, p)).map((p) => p.key));
  const gainers = matchable.filter((p) => after.has(p.key) && !before.has(p.key));
  const losers = matchable.filter((p) => before.has(p.key) && !after.has(p.key));

  // assignments before/after, active participations only (the reconcile model)
  const activation = () => Date.now();
  const tz = "UTC";
  const desiredBefore = computeDesiredAssignments(computeMemberships(portals, participations), tasks, activation, tz);
  const desiredAfter = computeDesiredAssignments(computeMemberships([...others, edited], participations), tasks, activation, tz);
  const newByContact = new Map<string, Set<string>>();
  for (const [k, d] of desiredAfter) {
    if (desiredBefore.has(k)) continue;
    const set = newByContact.get(d.contactId) ?? new Set<string>();
    set.add(d.taskId);
    newByContact.set(d.contactId, set);
  }

  // finished work among the losers
  const loserContactIds = [...new Set(losers.map((p) => p.contactId))];
  const done = new Set<string>();
  for (const chunk of chunkIds(loserContactIds)) {
    const rows = await db
      .select({ taskId: schema.taskAssignment.taskId, contactId: schema.taskAssignment.contactId, scopeKey: schema.taskAssignment.scopeKey })
      .from(schema.taskAssignment)
      .where(and(inArray(schema.taskAssignment.contactId, chunk), eq(schema.taskAssignment.status, "complete")));
    for (const r of rows) done.add(`${r.taskId}|${r.contactId}|${r.scopeKey}`);
  }

  const titleOf = (item: PortalItemRecord): string => {
    if (item.systemKind) return item.displayName ?? SYSTEM_ITEM_LABELS[item.systemKind];
    if (item.taskId) return item.displayName ?? tasks.get(item.taskId)?.title ?? "Item";
    return item.displayName ?? "Resource";
  };

  const gainItems: ImpactItemLine[] = edited.items.map((item) => {
    let people = 0;
    for (const p of gainers) {
      if (!isActiveParticipation(p) && !item.systemKind) {
        people += 1;
        continue;
      }
      if (item.taskId) {
        const task = tasks.get(item.taskId);
        if (!task) continue;
        const k = `${task.id}\u0000${p.contactId}\u0000${scopeKeyFor(task, p.key)}`;
        if (!desiredBefore.has(k)) people += 1;
      } else people += 1;
    }
    return { title: titleOf(item), people };
  });

  const loseItems: ImpactItemLine[] = (current?.items ?? []).map((item) => {
    let people = 0;
    let filed = 0;
    const kept = new Map<string, number>();
    for (const p of losers) {
      people += 1;
      if (item.taskId) {
        const task = tasks.get(item.taskId);
        if (!task) continue;
        const scopeKey = scopeKeyFor(task, p.key);
        if (done.has(`${task.id}|${p.contactId}|${scopeKey}`)) filed += 1;
        const via = others.find((o) =>
          o.items.some((oi) => oi.taskId === task.id) &&
          participations.some((q) => q.contactId === p.contactId && (scopeKey === "" || q.key === p.key) && isMatchableParticipation(q) && matchesRule(o.rule, q)),
        );
        if (via) kept.set(via.name, (kept.get(via.name) ?? 0) + 1);
      }
    }
    return {
      title: titleOf(item),
      people,
      ...(filed > 0 ? { filed } : {}),
      ...(kept.size > 0 ? { keptThrough: [...kept].map(([portal, n]) => ({ portal, people: n })) } : {}),
    };
  });

  const permissionChanges: string[] = [];
  if (current) {
    const fields = new Set([...Object.keys(current.fieldPermissions), ...Object.keys(input.fieldPermissions)]);
    for (const f of fields) {
      const a = (current.fieldPermissions as Record<string, { level: string } | undefined>)[f]?.level ?? "edit";
      const b = (input.fieldPermissions as Record<string, { level: string } | undefined>)[f]?.level ?? "edit";
      if (a !== b) permissionChanges.push(`${f}: ${a} -> ${b}`);
    }
    for (const cap of CAPABILITIES) {
      const a = current.capabilities[cap] ?? false;
      const b = input.capabilities[cap] ?? false;
      if (a !== b) permissionChanges.push(`${cap}: ${a ? "on" : "off"} -> ${b ? "on" : "off"}`);
    }
  }

  const people: PortalImpact["people"] = [
    ...gainers.map((p) => ({ contactId: p.contactId, name: p.contactName, participation: participationLabel(p, participationRoleLabel), change: "gain" as const })),
    ...losers.map((p) => ({ contactId: p.contactId, name: p.contactName, participation: participationLabel(p, participationRoleLabel), change: "lose" as const })),
  ];
  const listed = new Set(people.map((p) => p.contactId));
  for (const contactId of newByContact.keys()) {
    if (listed.has(contactId)) continue;
    const p = participations.find((x) => x.contactId === contactId);
    if (p) people.push({ contactId, name: p.contactName, participation: participationLabel(p, participationRoleLabel), change: "new_items" });
  }

  const ruleChanged = !current || JSON.stringify(current.rule) !== JSON.stringify(input.rule);
  const itemsChanged =
    !current ||
    JSON.stringify(current.items.map(({ id: _id, portalId: _p, position: _pos, ...rest }) => rest)) !==
      JSON.stringify(edited.items.map(({ id: _id, portalId: _p, position: _pos, ...rest }) => rest));
  return {
    affected: gainers.length + losers.length,
    gain: { count: gainers.length, who: describeGroup(gainers), items: gainItems.filter((i) => i.people > 0) },
    lose: { count: losers.length, who: describeGroup(losers), items: loseItems },
    newItems: { people: newByContact.size, contactIds: [...newByContact.keys()] },
    permissionChanges,
    people,
    needsPreview: ruleChanged || itemsChanged || permissionChanges.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function writeItems(db: Db, portalId: string, items: PortalItemInput[], now: Date): Promise<void> {
  await db.delete(schema.portalItem).where(eq(schema.portalItem.portalId, portalId));
  const rows = items.map((it, position) => ({
    id: newId(),
    portalId,
    taskId: it.taskId,
    resourceId: it.resourceId,
    systemKind: it.systemKind,
    displayName: it.displayName,
    deadlineKind: it.deadlineKind,
    dueDate: it.dueDate === null ? null : new Date(it.dueDate),
    relativeDays: it.relativeDays,
    required: it.required,
    graceDays: it.graceDays,
    allowEditAfterSubmit: it.allowEditAfterSubmit,
    viewOnlyWhenDone: it.viewOnlyWhenDone,
    position,
    createdAt: now,
    updatedAt: now,
  }));
  for (const chunk of chunkRowsForInsert(rows)) {
    await db.insert(schema.portalItem).values(chunk);
  }
}

export async function createPortal(db: Db, eventId: string, input: PortalInput, now: Date, template: string | null = null): Promise<string> {
  await assertItemsBelongToEvent(db, eventId, input.items);
  const count = await db.select({ n: sql<number>`count(*)` }).from(schema.portal).where(eq(schema.portal.eventId, eventId));
  const n = Number(count[0]?.n ?? 0);
  if (n >= MAX_PORTALS_PER_EVENT) throw new ApiError("invalid", `An event can have at most ${MAX_PORTALS_PER_EVENT} portals.`);
  const id = newId();
  await db.insert(schema.portal).values({
    id,
    eventId,
    name: input.name,
    note: input.note,
    ruleJson: JSON.stringify(input.rule),
    fieldPermissionsJson: JSON.stringify(input.fieldPermissions),
    capabilitiesJson: JSON.stringify(input.capabilities),
    notifyOnJoin: input.notifyOnJoin,
    template,
    position: n,
    createdAt: now,
    updatedAt: now,
  });
  await writeItems(db, id, input.items, now);
  return id;
}

export async function updatePortal(db: Db, eventId: string, portalId: string, input: PortalInput, now: Date): Promise<PortalRecord> {
  const current = await findPortal(db, portalId);
  if (!current || current.eventId !== eventId) throw new ApiError("not_found", "Portal not found");
  await assertItemsBelongToEvent(db, eventId, input.items);
  await db
    .update(schema.portal)
    .set({
      name: input.name,
      note: input.note,
      ruleJson: JSON.stringify(input.rule),
      fieldPermissionsJson: JSON.stringify(input.fieldPermissions),
      capabilitiesJson: JSON.stringify(input.capabilities),
      notifyOnJoin: input.notifyOnJoin,
      updatedAt: now,
    })
    .where(eq(schema.portal.id, portalId));
  // items keep their settings when unchanged; a full rewrite is simplest and
  // nothing references portal_item rows by id
  await writeItems(db, portalId, input.items, now);
  return current;
}

export function portalToInput(p: PortalRecord): PortalInput {
  return {
    name: p.name,
    note: p.note,
    rule: p.rule,
    fieldPermissions: p.fieldPermissions,
    capabilities: p.capabilities,
    notifyOnJoin: p.notifyOnJoin,
    items: p.items.map(({ id: _id, portalId: _portalId, position: _position, ...rest }) => rest),
  };
}

/** Copies a portal within its event as "<name> (copy)" with a rule that
 * matches nobody until edited, so a copy never doubles anyone's items. */
export async function duplicatePortal(db: Db, eventId: string, portalId: string, now: Date): Promise<string> {
  const current = await findPortal(db, portalId);
  if (!current || current.eventId !== eventId) throw new ApiError("not_found", "Portal not found");
  const input = portalToInput(current);
  return createPortal(db, eventId, { ...input, name: `${current.name} (copy)`.slice(0, MAX_PORTAL_NAME), rule: { groups: [] } }, now, current.template);
}

/** Deletes a portal. Its memberships go; reconciliation then detaches the
 * items it alone gave (finished work stays on the record). */
export async function deletePortal(db: Db, eventId: string, portalId: string): Promise<PortalRecord> {
  const current = await findPortal(db, portalId);
  if (!current || current.eventId !== eventId) throw new ApiError("not_found", "Portal not found");
  await db.delete(schema.portalItem).where(eq(schema.portalItem.portalId, portalId));
  await db.delete(schema.portalMembership).where(eq(schema.portalMembership.portalId, portalId));
  await db.delete(schema.portal).where(eq(schema.portal.id, portalId));
  return current;
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

/** Finds a library task by title in this event, or creates it as a portal
 * library item (audience 'portal': never back-filled onto every speaker). */
export async function findOrCreateLibraryTask(
  db: Db,
  eventId: string,
  t: { title: string; kind: string; scope: string; instructions?: string | null },
  now: Date,
): Promise<string> {
  const existing = await db
    .select({ id: schema.task.id })
    .from(schema.task)
    .where(and(eq(schema.task.eventId, eventId), eq(schema.task.title, t.title)))
    .orderBy(asc(schema.task.id)).limit(1);
  if (existing[0]) return existing[0].id;
  const id = newId();
  await db
    .insert(schema.task)
    .values({
      id,
      eventId,
      kind: t.kind,
      title: t.title,
      instructions: t.instructions ?? null,
      required: false,
      audience: "portal",
      scope: t.scope,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [schema.task.eventId, schema.task.title] });
  const row = await db
    .select({ id: schema.task.id })
    .from(schema.task)
    .where(and(eq(schema.task.eventId, eventId), eq(schema.task.title, t.title)))
    .orderBy(asc(schema.task.id)).limit(1);
  return row[0]!.id;
}

export function templateToInput(template: PortalTemplate, taskIds: string[]): PortalInput {
  let ti = 0;
  return {
    name: template.name,
    note: template.note,
    rule: template.rule,
    fieldPermissions: template.fieldPermissions,
    capabilities: template.capabilities,
    notifyOnJoin: true,
    items: template.items.map((it) => ({
      taskId: it.task ? taskIds[ti++]! : null,
      resourceId: null,
      systemKind: it.systemKind ?? null,
      displayName: null,
      deadlineKind: it.deadlineKind,
      dueDate: null,
      relativeDays: it.relativeDays ?? null,
      required: it.required,
      graceDays: it.graceDays ?? 0,
      allowEditAfterSubmit: false,
      viewOnlyWhenDone: false,
    })),
  };
}

export async function createPortalFromTemplate(db: Db, eventId: string, key: string, now: Date): Promise<string> {
  const template = findPortalTemplate(key);
  if (!template) throw new ApiError("invalid", "Unknown template.", { template: "Unknown template" });
  const taskIds: string[] = [];
  for (const it of template.items) {
    if (it.task) taskIds.push(await findOrCreateLibraryTask(db, eventId, it.task, now));
  }
  const input = templateToInput(template, taskIds);
  // a template portal that already exists gets a numbered name
  const names = new Set(
    (await db.select({ name: schema.portal.name }).from(schema.portal).where(eq(schema.portal.eventId, eventId))).map((r) => r.name),
  );
  let name = input.name;
  for (let n = 2; names.has(name); n++) name = `${input.name} ${n}`;
  return createPortal(db, eventId, { ...input, name }, now, template.key);
}

/** The Profile basics portal every new event starts with (the migration
 * gave every existing event one). No items: what speakers see is unchanged
 * until an organizer adds some. */
export async function ensureProfileBasicsPortal(db: Db, eventId: string, now: Date): Promise<void> {
  const existing = await db.select({ id: schema.portal.id }).from(schema.portal).where(eq(schema.portal.eventId, eventId)).orderBy(asc(schema.portal.id)).limit(1);
  if (existing[0]) return;
  const template = findPortalTemplate("profile_basics")!;
  await createPortal(db, eventId, { ...templateToInput(template, []), items: [] }, now, "profile_basics");
}

export interface CopyResult {
  portals: number;
  tiers: number;
  tasks: number;
  skipped: string[];
}

/** Copies portals (with the library items they use) and sponsor tiers (with
 * entitlements) from another event in the same org. Rules that name tiers
 * or tracks are re-pointed by name; names that already exist here are
 * skipped, never overwritten. */
export async function copyFromEvent(
  db: Db,
  input: { orgId: string; targetEventId: string; sourceEventId: string; portals: boolean; tiers: boolean },
  now: Date,
): Promise<CopyResult> {
  if (input.sourceEventId === input.targetEventId) refuse("Choose a different event to copy from.", "sourceEventId");
  const source = await db
    .select({ id: schema.event.id })
    .from(schema.event)
    .where(and(eq(schema.event.id, input.sourceEventId), eq(schema.event.orgId, input.orgId)))
    .limit(1);
  if (!source[0]) throw new ApiError("not_found", "Event not found");
  const result: CopyResult = { portals: 0, tiers: 0, tasks: 0, skipped: [] };

  const tierIdMap = new Map<string, string>();
  const [sourceTiers, targetTiers] = await Promise.all([
    db.select().from(schema.sponsorTier).where(eq(schema.sponsorTier.eventId, input.sourceEventId)).orderBy(asc(schema.sponsorTier.position)),
    db.select().from(schema.sponsorTier).where(eq(schema.sponsorTier.eventId, input.targetEventId)),
  ]);
  for (const t of sourceTiers) {
    const same = targetTiers.find((x) => x.name.toLowerCase() === t.name.toLowerCase());
    if (same) {
      tierIdMap.set(t.id, same.id);
      if (input.tiers) result.skipped.push(`Tier ${t.name} already exists`);
      continue;
    }
    if (!input.tiers) continue;
    const id = newId();
    await db.insert(schema.sponsorTier).values({ id, eventId: input.targetEventId, name: t.name, position: targetTiers.length + result.tiers, createdAt: now, updatedAt: now });
    const ents = await db
      .select()
      .from(schema.sponsorEntitlement)
      .where(and(eq(schema.sponsorEntitlement.tierId, t.id), sql`${schema.sponsorEntitlement.sponsorshipId} is null`));
    for (const e of ents) {
      await db.insert(schema.sponsorEntitlement).values({
        id: newId(),
        tierId: id,
        sponsorshipId: null,
        count: e.count,
        format: e.format,
        minutes: e.minutes,
        position: e.position,
        createdAt: now,
        updatedAt: now,
      });
    }
    tierIdMap.set(t.id, id);
    result.tiers += 1;
  }

  if (input.portals) {
    const [sourcePortals, targetPortals, sourceTracks, targetTracks, sourceTasks, sourceResources] = await Promise.all([
      loadEventPortals(db, input.sourceEventId),
      loadEventPortals(db, input.targetEventId),
      db.select({ id: schema.track.id, name: schema.track.name }).from(schema.track).where(eq(schema.track.eventId, input.sourceEventId)),
      db.select({ id: schema.track.id, name: schema.track.name }).from(schema.track).where(eq(schema.track.eventId, input.targetEventId)),
      loadEventLibraryTasks(db, input.sourceEventId),
      db.select().from(schema.resource).where(eq(schema.resource.eventId, input.sourceEventId)),
    ]);
    const trackIdMap = new Map<string, string>();
    for (const t of sourceTracks) {
      const same = targetTracks.find((x) => x.name.toLowerCase() === t.name.toLowerCase());
      if (same) trackIdMap.set(t.id, same.id);
    }
    const resourceIdMap = new Map<string, string>();
    const taskIdMap = new Map<string, string>();
    for (const portal of sourcePortals) {
      if (targetPortals.some((p) => p.name.toLowerCase() === portal.name.toLowerCase())) {
        result.skipped.push(`Portal ${portal.name} already exists`);
        continue;
      }
      const items: PortalItemInput[] = [];
      for (const it of portal.items) {
        let taskId: string | null = null;
        let resourceId: string | null = null;
        if (it.taskId) {
          const task = sourceTasks.get(it.taskId);
          if (!task) continue;
          if (!taskIdMap.has(task.id)) {
            const before = await db
              .select({ id: schema.task.id })
              .from(schema.task)
              .where(and(eq(schema.task.eventId, input.targetEventId), eq(schema.task.title, task.title)))
              .orderBy(asc(schema.task.id)).limit(1);
            const id = await findOrCreateLibraryTask(db, input.targetEventId, task, now);
            if (!before[0]) {
              result.tasks += 1;
              await db
                .update(schema.task)
                .set({
                  description: task.description,
                  acceptedTypesJson: task.acceptedTypes ? JSON.stringify(task.acceptedTypes) : null,
                  maxSizeMb: task.maxSizeMb,
                  maxFiles: task.maxFiles,
                  deliverableKind: task.deliverableKind,
                })
                .where(eq(schema.task.id, id));
            }
            taskIdMap.set(task.id, id);
          }
          taskId = taskIdMap.get(task.id)!;
        } else if (it.resourceId) {
          const res = sourceResources.find((r) => r.id === it.resourceId);
          if (!res) continue;
          if (!resourceIdMap.has(res.id)) {
            const id = newId();
            await db.insert(schema.resource).values({
              id,
              eventId: input.targetEventId,
              kind: res.kind,
              title: res.title,
              content: res.content,
              fileId: res.fileId,
              position: res.position,
              visibility: res.visibility,
              createdAt: now,
              updatedAt: now,
            });
            resourceIdMap.set(res.id, id);
          }
          resourceId = resourceIdMap.get(res.id)!;
        }
        // fixed dates belong to the other event's calendar: copy as no deadline
        items.push({
          taskId,
          resourceId,
          systemKind: it.systemKind,
          displayName: it.displayName,
          deadlineKind: it.deadlineKind === "fixed" ? "none" : it.deadlineKind,
          dueDate: null,
          relativeDays: it.relativeDays,
          required: it.required,
          graceDays: it.graceDays,
          allowEditAfterSubmit: it.allowEditAfterSubmit,
          viewOnlyWhenDone: it.viewOnlyWhenDone,
        });
      }
      const rule: PortalRule = {
        groups: portal.rule.groups.map((g) => ({
          conditions: g.conditions.map((c) => ({
            ...c,
            values:
              c.field === "sponsor_tier"
                ? c.values.map((v) => tierIdMap.get(v) ?? v)
                : c.field === "track"
                  ? c.values.map((v) => trackIdMap.get(v) ?? v)
                  : c.values,
          })),
        })),
      };
      await createPortal(
        db,
        input.targetEventId,
        {
          name: portal.name,
          note: portal.note,
          rule,
          fieldPermissions: portal.fieldPermissions,
          capabilities: portal.capabilities,
          notifyOnJoin: portal.notifyOnJoin,
          items,
        },
        now,
        portal.template,
      );
      result.portals += 1;
    }
  }
  return result;
}

/** Other events in the org a portal set can be copied from. */
export async function listCopySources(db: Db, orgId: string, eventId: string) {
  const rows = await db
    .select({ id: schema.event.id, name: schema.event.name, startDate: schema.event.startDate })
    .from(schema.event)
    .where(and(eq(schema.event.orgId, orgId), ne(schema.event.id, eventId)))
    .orderBy(asc(schema.event.startDate));
  const out: { id: string; name: string; portals: number; tiers: number }[] = [];
  for (const r of rows) {
    const [p, t] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(schema.portal).where(eq(schema.portal.eventId, r.id)),
      db.select({ n: sql<number>`count(*)` }).from(schema.sponsorTier).where(eq(schema.sponsorTier.eventId, r.id)),
    ]);
    out.push({ id: r.id, name: r.name, portals: Number(p[0]?.n ?? 0), tiers: Number(t[0]?.n ?? 0) });
  }
  return out;
}
