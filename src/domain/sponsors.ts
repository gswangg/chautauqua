// Sponsors (multi-portal): tier entitlements become slots in each sponsor's
// package, and sponsor-designed sessions move through one lifecycle
// (Portals frame, flows 5 and 7). Pure core.

import { capitalizeFirst, plural, spellCount } from "./count-copy";
import { parseFormatDurationMin } from "./schedule";

export const SPONSOR_SESSION_STATUSES = ["draft", "submitted", "changes_requested", "approved", "declined"] as const;
export type SponsorSessionStatus = (typeof SPONSOR_SESSION_STATUSES)[number];

export const SPONSOR_SESSION_STATUS_LABELS: Record<SponsorSessionStatus, string> = {
  draft: "Draft",
  submitted: "With the organizers",
  changes_requested: "Changes requested",
  approved: "Approved",
  declined: "Not accepted",
};

// One line under the status, as the participant sees it.
export const SPONSOR_SESSION_STATUS_LINES: Record<SponsorSessionStatus, string> = {
  draft: "Only your team can see it",
  submitted: "Locked while they review",
  changes_requested: "Edit and resubmit",
  approved: "In the program",
  declined: "Your slot is free again",
};

export function isSponsorSessionStatus(v: string): v is SponsorSessionStatus {
  return (SPONSOR_SESSION_STATUSES as readonly string[]).includes(v);
}

/** A declined session gives its slot back; every other state holds it. */
export function holdsSlot(status: SponsorSessionStatus): boolean {
  return status !== "declined";
}

/** Sponsor contacts can edit while it is theirs: a draft, or reopened
 * with the organizers' note. */
export function sponsorCanEdit(status: SponsorSessionStatus): boolean {
  return status === "draft" || status === "changes_requested";
}

export function sponsorCanSubmit(status: SponsorSessionStatus): boolean {
  return status === "draft" || status === "changes_requested";
}

export function sponsorCanWithdraw(status: SponsorSessionStatus): boolean {
  return status === "submitted";
}

export function organizerCanDecide(status: SponsorSessionStatus): boolean {
  return status === "submitted";
}

export const MAX_ENTITLEMENT_COUNT = 20;
export const MAX_ENTITLEMENT_ROWS = 20;
export const MAX_SPONSOR_SESSION_SPEAKERS = 6;

export interface Entitlement {
  id: string;
  count: number;
  format: string;
  minutes: number | null;
  // from the tier (shared) or an extra on this sponsorship
  extra: boolean;
}

export interface SlotSession {
  id: string;
  entitlementId: string;
  title: string;
  status: SponsorSessionStatus;
}

export interface Slot {
  entitlementId: string;
  format: string;
  minutes: number | null;
  extra: boolean;
  session: SlotSession | null;
}

/** The package: one slot per unit of each entitlement, filled by the
 * sessions holding them in creation order. A session on an entitlement
 * that no longer has room (the tier was lowered) still shows, on an extra
 * slot marked over, because approved sessions are never removed. */
export function buildPackage(entitlements: Entitlement[], sessions: SlotSession[]): { slots: Slot[]; over: SlotSession[] } {
  const slots: Slot[] = [];
  const over: SlotSession[] = [];
  for (const e of entitlements) {
    const holding = sessions.filter((s) => s.entitlementId === e.id && holdsSlot(s.status));
    for (let i = 0; i < e.count; i++) {
      slots.push({ entitlementId: e.id, format: e.format, minutes: e.minutes, extra: e.extra, session: holding[i] ?? null });
    }
    over.push(...holding.slice(e.count));
  }
  // a session whose entitlement row was removed from the tier still holds
  // nothing, but is never dropped from view
  const known = new Set(entitlements.map((e) => e.id));
  over.push(...sessions.filter((s) => !known.has(s.entitlementId) && holdsSlot(s.status)));
  return { slots, over };
}

/** "Talk — approved · Workshop — changes requested", the organizer's one-line
 * read of a sponsor's package (Settings · Sponsorships). */
export function packageStatusLine(slots: Slot[]): string {
  if (slots.length === 0) return "No entitlements";
  const words: Record<SponsorSessionStatus, string> = {
    draft: "in draft",
    submitted: "awaiting approval",
    changes_requested: "changes requested",
    approved: "approved",
    declined: "not started",
  };
  const parts = slots.map((s) => `${formatNoun(s.format, true)} — ${s.session ? words[s.session.status] : "not started"}`);
  if (slots.every((s) => s.session?.status === "approved")) parts.push("package fully used");
  return parts.join(" · ");
}

/** "One 30-minute talk · one 120-minute workshop" for a tier's entitlements. */
export function entitlementSummary(rows: Pick<Entitlement, "count" | "format" | "minutes">[]): string {
  if (rows.length === 0) return "Nothing yet";
  return rows
    .map((r, i) => {
      const n = spellCount(r.count);
      const lead = i === 0 ? capitalizeFirst(n) : n;
      const noun = formatNoun(r.format);
      const minutes = r.minutes ?? formatMinutes(r.format);
      return `${lead} ${minutes ? `${minutes}-minute ` : ""}${plural(r.count, noun)}`;
    })
    .join(" · ");
}

export function freeSlots(slots: Slot[]): Slot[] {
  return slots.filter((s) => s.session === null);
}

/** "Talk · 30 min" */
export function slotLabel(s: Pick<Slot, "format" | "minutes">): string {
  return s.minutes ? `${formatNoun(s.format, true)} · ${s.minutes} min` : formatNoun(s.format, true);
}

/** The noun inside a format option label: "Workshop (90 min)" -> "workshop".
 * Capitalised on request. */
export function formatNoun(format: string | null, capitalise = false): string {
  const base = (format ?? "session").replace(/\s*\(.*\)\s*$/, "").trim() || "session";
  const lower = base.toLowerCase();
  return capitalise ? capitalizeFirst(lower) : lower;
}

/** Minutes written inside a format option label, if any -- the scheduler's
 * own rule (parseFormatDurationMin), never a second parser. */
export function formatMinutes(format: string): number | null {
  return parseFormatDurationMin(format);
}

/** The status line of the sponsor's "Design your sessions" item:
 * "1 talk approved · 1 workshop needs changes", or "Package fully used". */
export function packageSummary(slots: Slot[]): { line: string; state: "todo" | "changes_requested" | "waiting" | "done" } {
  if (slots.length === 0) return { line: "Nothing in your package yet", state: "done" };
  const parts: string[] = [];
  let changes = false;
  let waiting = false;
  for (const s of slots) {
    const noun = formatNoun(s.format);
    if (!s.session) parts.push(`1 ${noun} available`);
    else if (s.session.status === "approved") parts.push(`1 ${noun} approved`);
    else if (s.session.status === "changes_requested") {
      parts.push(`1 ${noun} needs changes`);
      changes = true;
    } else if (s.session.status === "submitted") {
      parts.push(`1 ${noun} with the organizers`);
      waiting = true;
    } else parts.push(`1 ${noun} in draft`);
  }
  const allApproved = slots.every((s) => s.session?.status === "approved");
  if (allApproved) return { line: "Package fully used", state: "done" };
  const state = changes ? "changes_requested" : slots.some((s) => !s.session || s.session.status === "draft") ? "todo" : waiting ? "waiting" : "todo";
  return { line: parts.join(" · "), state };
}
