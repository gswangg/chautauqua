// Multi-portal person view: everything one person gets at one event and why.
// The participant home (/portal), the organizer's person record, and
// preview-as-participant all render from this one builder, so they cannot
// disagree about what someone sees.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import {
  isActiveParticipation,
  isMatchableParticipation,
  participationLabel,
  participationRoleLabel,
  unmatchedReason,
  type Participation,
} from "../../../domain/portals/participations";
import { matchesRule } from "../../../domain/portals/rules";
import {
  canActOnItem,
  graceEndDay,
  openUntilDay,
  itemState,
  mergeItemSettings,
  portalItemDueDay,
  SYSTEM_ITEM_LABELS,
  type ItemState,
  type MergedItem,
  type PortalItemSettings,
  type SystemItemKind,
} from "../../../domain/portals/items";
import {
  PROFILE_FIELDS,
  SESSION_FIELDS,
  CAPABILITIES,
  resolveCapability,
  resolveField,
  type Capability,
  type PermissionField,
  type PermissionSource,
  type ResolvedField,
} from "../../../domain/portals/permissions";
import { formatNoun, packageSummary, type Slot } from "../../../domain/sponsors";
import { loadPackages } from "../sponsors/package";
import { effectiveAssignmentDueDayLabel, isAssignmentOverdue } from "../../../domain/task-due";
import type { TaskKind } from "../../../domain/task-kinds";
import { loadParticipations } from "./participations";
import { loadEventLibraryTasks, loadEventPortals, type LibraryTask, type PortalItemRecord, type PortalRecord } from "./store";
import { MATERIALISED_KINDS, scopeKeyFor } from "./reconcile";

export interface ViewItem {
  // stable within the view: `${taskId}|${scopeKey}`, `sys:<kind>:<key>`
  key: string;
  kind: TaskKind | SystemItemKind;
  title: string;
  taskId: string | null;
  formId: string | null;
  assignmentId: string | null;
  scopeKey: string;
  state: ItemState;
  required: boolean;
  dueDay: number | null;
  graceDays: number;
  canAct: boolean;
  completedAt: number | null;
  // portals that bring it, and whether an organizer also assigned it directly
  portals: { id: string; name: string }[];
  direct: boolean;
  merge: Pick<MergedItem, "deadlineFrom" | "requiredFrom"> | null;
  // the answer stays on the record after every portal that gave it is gone
  detached: boolean;
  // extra status text for built-in items ("1 talk approved · 1 workshop needs changes")
  statusLine: string | null;
  // overrides the state's own word ("Changes requested")
  statusWord: string | null;
  // overdue but still open: the day label it stays open until
  openUntil: number | null;
  instructions: string | null;
  // the task's own one-line description (today's worklist showed it)
  description?: string | null;
}

export interface ViewSection {
  participation: Participation;
  heading: string;
  // "your invited panel": used in lock lines
  phrase: string;
  notes: string[];
  items: ViewItem[];
  // invited and not yet accepted: what acceptance brings, by name
  deferredItemNames: string[];
  // the same, with each item's deadline as the portal sets it -- a fixed
  // day, or N days after accepting (relative deadlines start then)
  deferredItems: { name: string; dueDay: number | null; relativeDays: number | null }[];
  invitation: { replyBy: number | null; message: string | null } | null;
  sponsor: {
    sponsorshipId: string;
    companyName: string;
    tierName: string | null;
    teammates: number;
    slots: Slot[];
    canDesign: boolean;
    canAddTeammates: boolean;
  } | null;
  capabilities: Record<Capability, boolean>;
  sessionFields: Record<(typeof SESSION_FIELDS)[number], ResolvedField>;
}

export interface ViewParticipation {
  participation: Participation;
  label: string;
  portals: { id: string; name: string }[];
  active: boolean;
  declined: boolean;
  unmatchedReason: string | null;
}

export interface PersonView {
  eventId: string;
  eventName: string;
  timezone: string;
  contactId: string;
  participations: ViewParticipation[];
  profileItems: ViewItem[];
  profileNotes: string[];
  sections: ViewSection[];
  profileFields: Record<(typeof PROFILE_FIELDS)[number], ResolvedField>;
  // the count in "Hi Priya — 5 things to do"
  todoCount: number;
  // portal-limited resources this person can see
  resourceIds: string[];
  // a portal brings an item with no assignment row yet (reconciliation
  // hasn't run since the change): the caller reconciles and rebuilds
  needsReconcile: boolean;
}

function sectionHeading(p: Participation): string {
  if (p.company) return p.company.tierName ? `${p.company.tierName} sponsor` : "Sponsor";
  if (p.session) {
    if (p.participationStatus === "invited") return "Invitation";
    if (p.session.status !== "accepted") return "Your submission";
    const noun = p.session.format ? formatNoun(p.session.format) : p.role === "panelist" ? "panel" : "session";
    if (p.session.origin === "organizer") return `Invited ${noun}`;
    if (p.session.origin === "sponsor") return `Your sponsored ${noun}`;
    return `Your ${noun}`;
  }
  return participationRoleLabel(p.role);
}

function sectionPhrase(heading: string): string {
  const lower = heading.charAt(0).toLowerCase() + heading.slice(1);
  return lower.startsWith("your ") ? lower : `your ${lower}`;
}

function toSettings(portal: PortalRecord, item: PortalItemRecord): PortalItemSettings {
  return {
    portalId: portal.id,
    portalName: portal.name,
    displayName: item.displayName,
    deadlineKind: item.deadlineKind,
    dueDate: item.dueDate,
    relativeDays: item.relativeDays,
    required: item.required,
    graceDays: item.graceDays,
    allowEditAfterSubmit: item.allowEditAfterSubmit,
    viewOnlyWhenDone: item.viewOnlyWhenDone,
  };
}

interface AssignmentRow {
  id: string;
  taskId: string;
  scopeKey: string;
  status: string;
  source: string;
  detachedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  reopenedUntil: Date | null;
}

async function loadAssignments(db: Db, contactId: string, taskIds: string[]): Promise<AssignmentRow[]> {
  const out: AssignmentRow[] = [];
  for (const chunk of chunkIds(taskIds)) {
    out.push(
      ...(await db
        .select({
          id: schema.taskAssignment.id,
          taskId: schema.taskAssignment.taskId,
          scopeKey: schema.taskAssignment.scopeKey,
          status: schema.taskAssignment.status,
          source: schema.taskAssignment.source,
          detachedAt: schema.taskAssignment.detachedAt,
          completedAt: schema.taskAssignment.completedAt,
          createdAt: schema.taskAssignment.createdAt,
          reopenedUntil: schema.taskAssignment.reopenedUntil,
        })
        .from(schema.taskAssignment)
        .where(and(eq(schema.taskAssignment.contactId, contactId), inArray(schema.taskAssignment.taskId, chunk)))),
    );
  }
  return out;
}

export interface BuildViewInput {
  eventId: string;
  contactId: string;
  now: number;
  // the organizer record includes detached finished work; homes do not
  includeDetached?: boolean;
}

export async function buildPersonView(db: Db, input: BuildViewInput): Promise<PersonView> {
  const { eventId, contactId, now } = input;
  const [eventRows, participations, portals, tasks, memberships] = await Promise.all([
    db
      .select({ name: schema.event.name, timezone: schema.event.timezone })
      .from(schema.event)
      .where(eq(schema.event.id, eventId))
      .limit(1),
    loadParticipations(db, { eventId, contactId }),
    loadEventPortals(db, eventId),
    loadEventLibraryTasks(db, eventId),
    db
      .select({
        portalId: schema.portalMembership.portalId,
        participationKey: schema.portalMembership.participationKey,
        activatedAt: schema.portalMembership.activatedAt,
      })
      .from(schema.portalMembership)
      .where(and(eq(schema.portalMembership.eventId, eventId), eq(schema.portalMembership.contactId, contactId))),
  ]);
  const event = eventRows[0];
  if (!event) throw new Error(`event ${eventId} not found`);
  const tz = event.timezone;
  const activatedAt = new Map(memberships.map((m) => [`${m.portalId}|${m.participationKey}`, m.activatedAt?.getTime() ?? null]));
  const assignments = await loadAssignments(db, contactId, [...tasks.keys()]);
  const assignmentByKey = new Map(assignments.map((a) => [`${a.taskId}|${a.scopeKey}`, a]));

  // which portals each participation matches (live, not the stored
  // membership: the view is never stale even before reconciliation runs)
  const matched = new Map<string, PortalRecord[]>();
  for (const p of participations) {
    matched.set(p.key, isMatchableParticipation(p) ? portals.filter((portal) => matchesRule(portal.rule, p)) : []);
  }
  const activeSession = participations.some(
    (p) => p.session && p.session.status === "accepted" && isActiveParticipation(p),
  );

  // collect item contributions per (task, scope)
  interface Contribution {
    settings: PortalItemSettings;
    dueDay: number | null;
    participation: Participation;
  }
  const contributions = new Map<string, { task: LibraryTask; scopeKey: string; entries: Contribution[] }>();
  const deferred = new Map<string, Set<string>>();
  const deferredDetail = new Map<string, Map<string, { dueDay: number | null; relativeDays: number | null }>>();
  const defer = (key: string, name: string, item: PortalItemRecord) => {
    const names = deferred.get(key) ?? new Set<string>();
    names.add(name);
    deferred.set(key, names);
    const detail = deferredDetail.get(key) ?? new Map();
    const prev = detail.get(name);
    const next = {
      dueDay: item.deadlineKind === "fixed" ? item.dueDate : null,
      relativeDays: item.deadlineKind === "relative" ? item.relativeDays : null,
    };
    // two portals naming the same item: the earlier fixed day, the shorter window
    if (!prev) detail.set(name, next);
    else
      detail.set(name, {
        dueDay: prev.dueDay === null ? next.dueDay : next.dueDay === null ? prev.dueDay : Math.min(prev.dueDay, next.dueDay),
        relativeDays: prev.relativeDays === null ? next.relativeDays : next.relativeDays === null ? prev.relativeDays : Math.min(prev.relativeDays, next.relativeDays),
      });
    deferredDetail.set(key, detail);
  };
  const sectionNotes = new Map<string, Set<string>>();
  const profileNotes = new Set<string>();
  const systemItems: { kind: SystemItemKind; participation: Participation; portal: PortalRecord; item: PortalItemRecord }[] = [];
  const resourceIds = new Set<string>();
  const profileSystem = new Map<"bio" | "headshot", { settings: PortalItemSettings; dueDay: number | null }[]>();

  for (const p of participations) {
    for (const portal of matched.get(p.key) ?? []) {
      const active = isActiveParticipation(p);
      const activation = activatedAt.get(`${portal.id}|${p.key}`) ?? (active ? now : null);
      let bringsParticipationItem = false;
      let bringsPersonItem = false;
      for (const item of portal.items) {
        if (item.resourceId) {
          if (active) resourceIds.add(item.resourceId);
          continue;
        }
        if (item.systemKind === "bio" || item.systemKind === "headshot") {
          bringsPersonItem = true;
          if (!active) {
            defer(p.key, item.displayName ?? SYSTEM_ITEM_LABELS[item.systemKind], item);
            continue;
          }
          const list = profileSystem.get(item.systemKind) ?? [];
          list.push({ settings: toSettings(portal, item), dueDay: portalItemDueDay(item, activation, tz) });
          profileSystem.set(item.systemKind, list);
          continue;
        }
        if (item.systemKind) {
          if (item.systemKind === "acceptance" && !(p.session && p.participationStatus !== "none")) continue;
          if (item.systemKind === "sponsor_sessions" && !p.company) continue;
          systemItems.push({ kind: item.systemKind, participation: p, portal, item });
          bringsParticipationItem = true;
          continue;
        }
        const task = item.taskId ? tasks.get(item.taskId) : undefined;
        if (!task) continue;
        if (task.scope === "participation") bringsParticipationItem = true;
        else bringsPersonItem = true;
        if (!active) {
          defer(p.key, item.displayName ?? task.title, item);
          continue;
        }
        const scopeKey = scopeKeyFor(task, p.key);
        const key = `${task.id}|${scopeKey}`;
        const entry = contributions.get(key) ?? { task, scopeKey, entries: [] };
        entry.entries.push({ settings: toSettings(portal, item), dueDay: portalItemDueDay(item, activation, tz), participation: p });
        contributions.set(key, entry);
      }
      if (portal.note) {
        if (bringsParticipationItem) {
          const notes = sectionNotes.get(p.key) ?? new Set<string>();
          notes.add(portal.note);
          sectionNotes.set(p.key, notes);
        } else if (bringsPersonItem && active) profileNotes.add(portal.note);
      }
    }
  }

  function taskItem(task: LibraryTask, scopeKey: string, merged: MergedItem | null, direct: boolean): ViewItem | null {
    const a = assignmentByKey.get(`${task.id}|${scopeKey}`) ?? null;
    const detached = a !== null && a.source === "portal" && a.detachedAt !== null && merged === null && !direct;
    if (detached && !input.includeDetached) return null;
    const done = a?.status === "complete";
    let state: ItemState;
    let dueDay: number | null;
    let required: boolean;
    let graceDays: number;
    if (merged) {
      dueDay = merged.dueDay;
      required = merged.required;
      graceDays = merged.graceDays;
      state = itemState({ done, required, dueDay, graceDays, now, timeZone: tz, reopenedUntil: a?.reopenedUntil?.getTime() ?? null });
    } else {
      // a direct assignment keeps today's semantics: due on the task's own
      // date (with the late-assignment grace), always a thing to do
      const assignedAt = a ? a.createdAt.getTime() : now;
      dueDay = effectiveAssignmentDueDayLabel(task.dueDate, assignedAt, tz);
      required = task.required;
      graceDays = 0;
      state = done ? "done" : isAssignmentOverdue(task.dueDate, assignedAt, now, tz) ? "closed" : "todo";
      if (state === "closed") state = "overdue_open";
    }
    const reopenedUntil = a?.reopenedUntil?.getTime() ?? null;
    const openUntil = state === "overdue_open" && dueDay !== null ? openUntilDay(dueDay, graceDays, reopenedUntil) : null;
    const allowEdit = merged?.allowEditAfterSubmit ?? true;
    const viewOnly = merged?.viewOnlyWhenDone ?? false;
    return {
      key: `${task.id}|${scopeKey}`,
      kind: task.kind,
      title: merged?.displayName ?? task.title,
      taskId: task.id,
      formId: task.formId,
      assignmentId: a?.id ?? null,
      scopeKey,
      state,
      required,
      dueDay,
      graceDays,
      canAct: a !== null && canActOnItem(state, { viewOnlyWhenDone: viewOnly, allowEditAfterSubmit: allowEdit }),
      completedAt: a?.completedAt?.getTime() ?? null,
      portals: merged?.portals ?? [],
      direct,
      merge: merged ? { deadlineFrom: merged.deadlineFrom, requiredFrom: merged.requiredFrom } : null,
      detached,
      statusLine: null,
      statusWord: null,
      openUntil,
      instructions: task.instructions,
      description: task.description,
    };
  }

  const profileItems: ViewItem[] = [];
  const itemsBySection = new Map<string, ViewItem[]>();
  const seen = new Set<string>();
  for (const [key, c] of contributions) {
    const merged = mergeItemSettings(c.entries);
    const a = assignmentByKey.get(key);
    const item = taskItem(c.task, c.scopeKey, merged, a?.source === "direct");
    seen.add(key);
    if (!item) continue;
    if (c.scopeKey === "") profileItems.push(item);
    else {
      const list = itemsBySection.get(c.scopeKey) ?? [];
      list.push(item);
      itemsBySection.set(c.scopeKey, list);
    }
  }
  // direct assignments and detached portal work that no portal brings now
  for (const a of assignments) {
    const key = `${a.taskId}|${a.scopeKey}`;
    if (seen.has(key)) continue;
    const task = tasks.get(a.taskId);
    if (!task) continue;
    if (a.source === "direct" && !activeSession && !input.includeDetached) continue;
    const item = taskItem(task, a.scopeKey, null, a.source === "direct");
    if (!item) continue;
    if (a.scopeKey === "") profileItems.push(item);
    else {
      const list = itemsBySection.get(a.scopeKey) ?? [];
      list.push(item);
      itemsBySection.set(a.scopeKey, list);
    }
  }

  // sponsor packages for company sections
  const companyParticipations = participations.filter((p) => p.company && isActiveParticipation(p));
  const packages = await loadPackages(db, companyParticipations.map((p) => p.company!.sponsorshipId));

  // invitation details for invited sessions
  const invitedIds = participations.filter((p) => p.session && p.participationStatus !== "none").map((p) => p.session!.participantId);
  const invitations = new Map<string, { replyBy: number | null; message: string | null }>();
  for (const chunk of chunkIds(invitedIds)) {
    const rows = await db
      .select({
        id: schema.participant.id,
        inviteStatus: schema.participant.inviteStatus,
        replyBy: schema.participant.replyBy,
        message: schema.participant.invitationMessage,
      })
      .from(schema.participant)
      .where(inArray(schema.participant.id, chunk));
    // a declined invitation has no section to show it in
    for (const r of rows) {
      if (r.inviteStatus !== "declined") invitations.set(r.id, { replyBy: r.replyBy?.getTime() ?? null, message: r.message });
    }
  }

  // permission sources
  const sourcesFor = (p: Participation, phrase: string): PermissionSource[] =>
    (matched.get(p.key) ?? []).map((portal) => ({
      portalName: portal.name,
      participationKey: p.key,
      participationPhrase: phrase,
      fields: portal.fieldPermissions,
      capabilities: portal.capabilities,
    }));

  const sections: ViewSection[] = [];
  const allProfileSources: PermissionSource[] = [];
  for (const p of participations) {
    if (!isMatchableParticipation(p)) continue;
    const heading = sectionHeading(p);
    const phrase = sectionPhrase(heading);
    const sources = sourcesFor(p, phrase);
    if (isActiveParticipation(p)) allProfileSources.push(...sources);
    const capabilities = Object.fromEntries(CAPABILITIES.map((c) => [c, resolveCapability(c, sources)])) as Record<Capability, boolean>;
    const sessionFields = Object.fromEntries(SESSION_FIELDS.map((f) => [f, resolveField(f, sources)])) as ViewSection["sessionFields"];
    const items = [...(itemsBySection.get(p.key) ?? [])];
    let sponsor: ViewSection["sponsor"] = null;
    if (p.company) {
      const pkg = packages.get(p.company.sponsorshipId);
      sponsor = {
        sponsorshipId: p.company.sponsorshipId,
        companyName: p.company.companyName,
        tierName: p.company.tierName,
        teammates: Math.max(0, (pkg?.joinedContacts ?? 1) - 1),
        slots: pkg?.slots ?? [],
        canDesign: capabilities.createSponsorSessions,
        canAddTeammates: capabilities.addTeammates,
      };
    }
    for (const sys of systemItems.filter((s) => s.participation.key === p.key)) {
      const settings = toSettings(sys.portal, sys.item);
      const dueDay = portalItemDueDay(settings, activatedAt.get(`${sys.portal.id}|${p.key}`) ?? null, tz);
      if (items.some((i) => i.key === `sys:${sys.kind}:${p.key}`)) continue;
      if (sys.kind === "acceptance") {
        const state: ItemState =
          p.participationStatus === "accepted" ? "done" : p.participationStatus === "invited" ? "waiting" : "done";
        const inv = p.session ? invitations.get(p.session.participantId) : undefined;
        items.unshift({
          key: `sys:acceptance:${p.key}`,
          kind: "acceptance",
          title: sys.item.displayName ?? SYSTEM_ITEM_LABELS.acceptance,
          taskId: null,
          formId: null,
          assignmentId: null,
          scopeKey: p.key,
          state,
          required: true,
          dueDay: inv?.replyBy ?? dueDay,
          graceDays: 0,
          canAct: state === "waiting",
          completedAt: state === "done" ? (activatedAt.get(`${sys.portal.id}|${p.key}`) ?? null) : null,
          portals: [{ id: sys.portal.id, name: sys.portal.name }],
          direct: false,
          merge: null,
          detached: false,
          statusLine: null,
          statusWord: state === "done" ? "Accepted" : null,
          openUntil: null,
          instructions: null,
        });
      } else if (sponsor) {
        const summary = packageSummary(sponsor.slots);
        items.push({
          key: `sys:sponsor_sessions:${p.key}`,
          kind: "sponsor_sessions",
          title: sys.item.displayName ?? SYSTEM_ITEM_LABELS.sponsor_sessions,
          taskId: null,
          formId: null,
          assignmentId: null,
          scopeKey: p.key,
          state: summary.state === "done" ? "done" : summary.state === "waiting" ? "waiting" : "todo",
          required: settings.required,
          dueDay,
          graceDays: settings.graceDays,
          canAct: sponsor.canDesign,
          completedAt: null,
          portals: [{ id: sys.portal.id, name: sys.portal.name }],
          direct: false,
          merge: null,
          detached: false,
          statusLine: summary.line,
          statusWord: summary.state === "changes_requested" ? "Changes requested" : null,
          openUntil: null,
          instructions: null,
        });
      }
    }
    sections.push({
      participation: p,
      heading,
      phrase,
      notes: [...(sectionNotes.get(p.key) ?? [])],
      items,
      deferredItemNames: p.participationStatus === "invited" ? [...(deferred.get(p.key) ?? [])] : [],
      deferredItems:
        p.participationStatus === "invited"
          ? [...(deferredDetail.get(p.key) ?? new Map()).entries()].map(([name, d]) => ({ name, ...d }))
          : [],
      invitation: p.session && p.participationStatus !== "none" ? (invitations.get(p.session.participantId) ?? null) : null,
      sponsor,
      capabilities,
      sessionFields,
    });
  }

  const profileFields = Object.fromEntries(
    PROFILE_FIELDS.map((f) => [f, resolveField(f as PermissionField, allProfileSources)]),
  ) as PersonView["profileFields"];

  // built-in profile items, shown once at the top of the profile area
  if (profileSystem.size > 0) {
    const contactRows = await db
      .select({ bio: schema.contact.bio, headshotUrl: schema.contact.headshotUrl, headshotFileId: schema.contact.headshotFileId })
      .from(schema.contact)
      .where(eq(schema.contact.id, contactId))
      .limit(1);
    const c = contactRows[0];
    const builtIns: ViewItem[] = [];
    for (const kind of ["bio", "headshot"] as const) {
      const entries = profileSystem.get(kind);
      if (!entries) continue;
      const merged = mergeItemSettings(entries);
      const done = kind === "bio" ? Boolean(c?.bio && c.bio.trim()) : Boolean(c?.headshotUrl || c?.headshotFileId);
      const state = itemState({ done, required: merged.required, dueDay: merged.dueDay, graceDays: merged.graceDays, now, timeZone: tz });
      const editable = profileFields[kind].level === "edit";
      builtIns.push({
        key: `sys:${kind}`,
        kind,
        title: merged.displayName ?? SYSTEM_ITEM_LABELS[kind],
        taskId: null,
        formId: null,
        assignmentId: null,
        scopeKey: "",
        state,
        required: merged.required,
        dueDay: merged.dueDay,
        graceDays: merged.graceDays,
        canAct: editable && canActOnItem(state, { viewOnlyWhenDone: merged.viewOnlyWhenDone, allowEditAfterSubmit: true }),
        completedAt: null,
        portals: merged.portals,
        direct: false,
        merge: { deadlineFrom: merged.deadlineFrom, requiredFrom: merged.requiredFrom },
        detached: false,
        statusLine: null,
        statusWord: null,
        openUntil: state === "overdue_open" && merged.dueDay !== null ? graceEndDay(merged.dueDay, merged.graceDays) : null,
        instructions: profileFields[kind].help ?? null,
      });
    }
    profileItems.unshift(...builtIns);
  }

  const viewParticipations: ViewParticipation[] = participations.map((p) => {
    const ps = matched.get(p.key) ?? [];
    return {
      participation: p,
      label: participationLabel(p, participationRoleLabel),
      portals: ps.map((x) => ({ id: x.id, name: x.name })),
      active: isActiveParticipation(p),
      declined: !isMatchableParticipation(p),
      unmatchedReason: isMatchableParticipation(p) && ps.length === 0 ? unmatchedReason(p, participationRoleLabel) : null,
    };
  });

  const countable = (i: ViewItem) => i.state === "todo" || i.state === "overdue_open" || (i.kind === "sponsor_sessions" && i.state !== "done" && i.state !== "waiting");
  const todoCount =
    profileItems.filter(countable).length +
    sections.reduce((n, s) => n + s.items.filter((i) => countable(i) || (i.kind === "acceptance" && i.state === "waiting")).length, 0);

  return {
    eventId,
    eventName: event.name,
    timezone: tz,
    contactId,
    participations: viewParticipations,
    profileItems,
    profileNotes: [...profileNotes],
    sections,
    profileFields,
    todoCount,
    resourceIds: [...resourceIds],
    needsReconcile: [...contributions.entries()].some(([key, c]) => MATERIALISED_KINDS.has(c.task.kind) && !assignmentByKey.has(key)),
  };
}
