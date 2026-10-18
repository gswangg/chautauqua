// Multi-portal items: per-portal deadlines, how an item that arrives from
// several portals merges, and the state a participant sees. Pure core.

import { dayLabelEndInstant, dayLabelOfInstant } from "../../lib/timezone";

export const ITEM_SCOPES = ["person", "participation"] as const;
export type ItemScope = (typeof ITEM_SCOPES)[number];

/** What an organizer can put in the item library (the built-in items --
 * acceptance, sponsor sessions, bio, headshot -- are always there). */
export const LIBRARY_TYPES = ["task", "form", "file_request", "share_kit", "resource"] as const;
export type LibraryType = (typeof LIBRARY_TYPES)[number];

export const ITEM_SCOPE_LABELS: Record<ItemScope, string> = {
  person: "The person",
  participation: "The session or company",
};

// Built-in items with no library row, derived on read. Acceptance tracks the
// participant's invitation; sponsor sessions tracks a company's entitlement
// slots; bio and headshot are done when the person's profile has them.
export const SYSTEM_ITEM_KINDS = ["acceptance", "sponsor_sessions", "bio", "headshot"] as const;
export type SystemItemKind = (typeof SYSTEM_ITEM_KINDS)[number];

export function isSystemItemKind(v: string): v is SystemItemKind {
  return (SYSTEM_ITEM_KINDS as readonly string[]).includes(v);
}

export const SYSTEM_ITEM_LABELS: Record<SystemItemKind, string> = {
  acceptance: "Accept your invitation",
  sponsor_sessions: "Design your sessions",
  bio: "Bio",
  headshot: "Headshot",
};

export const SYSTEM_ITEM_SCOPES: Record<SystemItemKind, ItemScope> = {
  acceptance: "participation",
  sponsor_sessions: "participation",
  bio: "person",
  headshot: "person",
};

// Built-in items only make sense for some participations.
export const SYSTEM_ITEM_HINTS: Record<SystemItemKind, string> = {
  acceptance: "Built in · invited participations",
  sponsor_sessions: "Built in · sponsor contacts",
  bio: "Built in · the person's profile",
  headshot: "Built in · the person's profile",
};

export const DEADLINE_KINDS = ["none", "fixed", "relative"] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];

export const MAX_RELATIVE_DAYS = 365;
export const MAX_GRACE_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One portal's settings for one library item. */
export interface PortalItemSettings {
  portalId: string;
  portalName: string;
  displayName: string | null;
  deadlineKind: DeadlineKind;
  dueDate: number | null;
  relativeDays: number | null;
  required: boolean;
  graceDays: number;
  allowEditAfterSubmit: boolean;
  viewOnlyWhenDone: boolean;
}

/** The day label (UTC-midnight stand-in, src/domain/task-due.ts) an item is
 * due on for one portal, or null. Relative deadlines count from the day the
 * participation became active (joined the portal, or accepted its
 * invitation); before that they have no date. */
export function portalItemDueDay(
  s: Pick<PortalItemSettings, "deadlineKind" | "dueDate" | "relativeDays">,
  activatedAt: number | null,
  timeZone: string,
): number | null {
  if (s.deadlineKind === "fixed") return s.dueDate;
  if (s.deadlineKind === "relative") {
    if (activatedAt === null || s.relativeDays === null) return null;
    return dayLabelOfInstant(activatedAt + s.relativeDays * DAY_MS, timeZone);
  }
  return null;
}

/** The settings a participant sees when one item reaches them through
 * several portals (Portals README "Portals stack"): the earliest deadline,
 * required if any portal requires it, the longer grace, view-only if any
 * portal says so, editable after submitting if any portal allows it. The
 * display name is the first portal's that renames it. */
export interface MergedItem {
  dueDay: number | null;
  required: boolean;
  graceDays: number;
  allowEditAfterSubmit: boolean;
  viewOnlyWhenDone: boolean;
  displayName: string | null;
  // every portal that brings the item, in portal order
  portals: { id: string; name: string }[];
  // the portal whose deadline won, when deadlines differed
  deadlineFrom: string | null;
  requiredFrom: string | null;
}

export function mergeItemSettings(
  entries: { settings: PortalItemSettings; dueDay: number | null }[],
): MergedItem {
  if (entries.length === 0) throw new Error("mergeItemSettings needs at least one portal");
  let dueDay: number | null = null;
  let deadlineFrom: string | null = null;
  let requiredFrom: string | null = null;
  for (const e of entries) {
    if (e.dueDay !== null && (dueDay === null || e.dueDay < dueDay)) {
      dueDay = e.dueDay;
      deadlineFrom = e.settings.portalName;
    }
    if (e.settings.required && requiredFrom === null) requiredFrom = e.settings.portalName;
  }
  const distinctDeadlines = new Set(entries.map((e) => e.dueDay)).size > 1;
  const distinctPortals = new Set(entries.map((e) => e.settings.portalId)).size;
  return {
    dueDay,
    required: requiredFrom !== null,
    graceDays: Math.max(...entries.map((e) => e.settings.graceDays)),
    allowEditAfterSubmit: entries.some((e) => e.settings.allowEditAfterSubmit),
    viewOnlyWhenDone: entries.some((e) => e.settings.viewOnlyWhenDone),
    displayName: entries.find((e) => e.settings.displayName)?.settings.displayName ?? null,
    portals: [...new Map(entries.map((e) => [e.settings.portalId, { id: e.settings.portalId, name: e.settings.portalName }])).values()],
    deadlineFrom: distinctDeadlines ? deadlineFrom : null,
    requiredFrom: distinctPortals > 1 ? requiredFrom : null,
  };
}

export const ITEM_STATES = ["done", "todo", "overdue_open", "closed", "optional", "waiting"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

/** The word a state reads as, on the participant's home and the organizer's
 * person record alike (a built-in item's own status word overrides it). */
export const ITEM_STATE_WORDS: Record<ItemState, string> = {
  done: "Done",
  todo: "To do",
  overdue_open: "Overdue",
  closed: "Closed",
  optional: "Optional",
  waiting: "Waiting",
};

/** What the participant sees for an item: done; to do; overdue but still
 * open inside its grace period; closed (past grace, "ask the organizers");
 * optional (not required, not done). */
export function itemState(input: {
  done: boolean;
  required: boolean;
  dueDay: number | null;
  graceDays: number;
  now: number;
  timeZone: string;
  // an organizer reopened the item for this person until this day label
  reopenedUntil?: number | null;
}): ItemState {
  if (input.done) return "done";
  if (input.dueDay !== null) {
    const dueEnd = dayLabelEndInstant(input.dueDay, input.timeZone);
    if (input.now > dueEnd) {
      const graceEnd = dayLabelEndInstant(input.dueDay + input.graceDays * DAY_MS, input.timeZone);
      if (input.graceDays > 0 && input.now <= graceEnd) return "overdue_open";
      if (input.reopenedUntil != null && input.now <= dayLabelEndInstant(input.reopenedUntil, input.timeZone)) return "overdue_open";
      return "closed";
    }
  }
  return input.required ? "todo" : "optional";
}

/** The day label a graced item stays open until. */
export function graceEndDay(dueDay: number, graceDays: number): number {
  return dueDay + graceDays * DAY_MS;
}

/** The day an overdue-but-open item stays open until: the later of its
 * grace end and an organizer's reopen (a reopen after grace ran out is
 * what keeps it open, so it is the day to show). */
export function openUntilDay(dueDay: number, graceDays: number, reopenedUntil: number | null): number | null {
  const candidates = [graceDays > 0 ? graceEndDay(dueDay, graceDays) : null, reopenedUntil].filter((d): d is number => d !== null);
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

/** Whether the participant can still act on an item. */
export function canActOnItem(state: ItemState, opts: { viewOnlyWhenDone: boolean; allowEditAfterSubmit: boolean }): boolean {
  if (state === "closed" || state === "waiting") return false;
  if (state === "done") return opts.allowEditAfterSubmit && !opts.viewOnlyWhenDone;
  return true;
}
