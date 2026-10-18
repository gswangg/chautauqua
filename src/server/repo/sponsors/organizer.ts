// Organizer side of sponsorships (Portals frame, flow 5): tiers and their
// entitlements, sponsor companies, sponsorships, their contacts and extras.
// Every function is scoped by an event the caller already proved they own.

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { ApiError } from "../../http";
import { chunkIds } from "../../../lib/chunk";
import {
  MAX_ENTITLEMENT_COUNT,
  MAX_ENTITLEMENT_ROWS,
  buildPackage,
  entitlementSummary,
  formatMinutes,
  packageStatusLine,
  type Entitlement,
  type SlotSession,
} from "../../../domain/sponsors";
import { SPONSORSHIP_STATUSES, type SponsorshipStatus } from "../../../domain/portals/participations";
import { findOrCreateContact } from "../submissions/create";
import { loadPackages } from "./package";
import { MAX_PERSON_NAME, MAX_SPONSOR_CONTACTS, MAX_SPONSOR_NAME, MAX_TIERS_PER_EVENT, MAX_TIER_NAME } from "../../../domain/portals/limits";


export interface EntitlementInput {
  id?: string;
  count: number;
  format: string;
  minutes: number | null;
}

/** Validates an untrusted entitlement list (tier editor rows, or a
 * sponsorship's extras). */
export function parseEntitlementInputs(input: unknown): EntitlementInput[] {
  if (!Array.isArray(input)) throw new ApiError("invalid", "Entitlements must be a list.", { entitlements: "Must be a list" });
  if (input.length > MAX_ENTITLEMENT_ROWS) {
    throw new ApiError("invalid", `A tier can list at most ${MAX_ENTITLEMENT_ROWS} session types.`, { entitlements: "Too many rows" });
  }
  return input.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) throw new ApiError("invalid", `Row ${i + 1} is not a session type.`);
    const { id, count, format, minutes } = raw as Record<string, unknown>;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_ENTITLEMENT_COUNT) {
      throw new ApiError("invalid", `Row ${i + 1}: the count must be between 1 and ${MAX_ENTITLEMENT_COUNT}.`, { [`entitlements.${i}.count`]: "Out of range" });
    }
    if (typeof format !== "string" || format.trim() === "" || format.length > 120) {
      throw new ApiError("invalid", `Row ${i + 1} needs a session type.`, { [`entitlements.${i}.format`]: "Required" });
    }
    if (minutes !== undefined && minutes !== null && (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 5 || minutes > 600)) {
      throw new ApiError("invalid", `Row ${i + 1}: the length must be between 5 and 600 minutes.`, { [`entitlements.${i}.minutes`]: "Out of range" });
    }
    return {
      id: typeof id === "string" && id !== "" ? id : undefined,
      count,
      format: format.trim(),
      minutes: typeof minutes === "number" ? minutes : formatMinutes(format),
    };
  });
}

export interface TierRow {
  id: string;
  name: string;
  position: number;
  entitlements: (Entitlement & { position: number })[];
  summary: string;
  sponsors: number;
}

export async function listTiers(db: Db, eventId: string): Promise<TierRow[]> {
  const tiers = await db
    .select()
    .from(schema.sponsorTier)
    .where(eq(schema.sponsorTier.eventId, eventId))
    .orderBy(asc(schema.sponsorTier.position), asc(schema.sponsorTier.createdAt));
  if (tiers.length === 0) return [];
  const ids = tiers.map((t) => t.id);
  const [entitlements, counts] = await Promise.all([
    db
      .select()
      .from(schema.sponsorEntitlement)
      .where(and(inArray(schema.sponsorEntitlement.tierId, ids), isNull(schema.sponsorEntitlement.sponsorshipId)))
      .orderBy(asc(schema.sponsorEntitlement.position)),
    db
      .select({ tierId: schema.sponsorship.tierId, n: sql<number>`count(*)` })
      .from(schema.sponsorship)
      .where(and(eq(schema.sponsorship.eventId, eventId), inArray(schema.sponsorship.tierId, ids)))
      .groupBy(schema.sponsorship.tierId),
  ]);
  return tiers.map((t) => {
    const rows = entitlements
      .filter((e) => e.tierId === t.id)
      .map((e) => ({ id: e.id, count: e.count, format: e.format, minutes: e.minutes, extra: false, position: e.position }));
    return {
      id: t.id,
      name: t.name,
      position: t.position,
      entitlements: rows,
      summary: entitlementSummary(rows),
      sponsors: Number(counts.find((c) => c.tierId === t.id)?.n ?? 0),
    };
  });
}

export async function findTier(db: Db, eventId: string, tierId: string) {
  const rows = await db
    .select()
    .from(schema.sponsorTier)
    .where(and(eq(schema.sponsorTier.id, tierId), eq(schema.sponsorTier.eventId, eventId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface OverAllowance {
  sponsorshipId: string;
  companyName: string;
  sessions: { id: string; title: string; status: string }[];
}

/** Which sponsors on a tier would hold more sessions than the edited
 * entitlements allow. Nothing is removed by a tier change -- this is the
 * warning the editor shows before saving. */
export async function previewTierChange(
  db: Db,
  eventId: string,
  tierId: string | null,
  rows: EntitlementInput[],
): Promise<OverAllowance[]> {
  if (!tierId) return [];
  const sponsorships = await db
    .select({ id: schema.sponsorship.id, companyName: schema.sponsorCompany.name })
    .from(schema.sponsorship)
    .innerJoin(schema.sponsorCompany, eq(schema.sponsorCompany.id, schema.sponsorship.companyId))
    .where(and(eq(schema.sponsorship.eventId, eventId), eq(schema.sponsorship.tierId, tierId)));
  if (sponsorships.length === 0) return [];
  const packages = await loadPackages(db, sponsorships.map((s) => s.id));
  const out: OverAllowance[] = [];
  for (const s of sponsorships) {
    const pkg = packages.get(s.id)!;
    const extras = pkg.entitlements.filter((e) => e.extra);
    // a new row (no id yet) can't be held by anything; give it a fresh id
    const proposed: Entitlement[] = [
      ...rows.map((r, i) => ({ id: r.id ?? `new-${i}`, count: r.count, format: r.format, minutes: r.minutes, extra: false })),
      ...extras,
    ];
    const sessions: SlotSession[] = [...pkg.slots.map((x) => x.session).filter((x): x is SlotSession => x !== null), ...pkg.over];
    const { over } = buildPackage(proposed, sessions);
    if (over.length > 0) {
      out.push({ sponsorshipId: s.id, companyName: s.companyName, sessions: over.map((o) => ({ id: o.id, title: o.title, status: o.status })) });
    }
  }
  return out;
}

function parseTierName(name: unknown): string {
  if (typeof name !== "string" || name.trim() === "") throw new ApiError("invalid", "A tier needs a name.", { name: "Required" });
  if (name.trim().length > MAX_TIER_NAME) throw new ApiError("invalid", `A tier name is at most ${MAX_TIER_NAME} characters.`, { name: "Too long" });
  return name.trim();
}

/** Creates or updates a tier and replaces its entitlement rows. Rows keep
 * their ids so the sessions holding them keep their slots; a removed row's
 * sessions show as over the allowance (never deleted). */
export async function saveTier(
  db: Db,
  eventId: string,
  input: { id: string | null; name: unknown; entitlements: unknown },
  now: Date,
): Promise<{ id: string; before: string; after: string }> {
  const name = parseTierName(input.name);
  const rows = parseEntitlementInputs(input.entitlements);
  let tierId = input.id;
  let before = "";
  if (tierId) {
    const tier = await findTier(db, eventId, tierId);
    if (!tier) throw new ApiError("not_found", "Tier not found");
    const current = (await listTiers(db, eventId)).find((t) => t.id === tierId);
    before = current ? `${current.name}: ${current.summary}` : "";
    await db.update(schema.sponsorTier).set({ name, updatedAt: now }).where(eq(schema.sponsorTier.id, tierId));
  } else {
    const existing = await db.select({ id: schema.sponsorTier.id }).from(schema.sponsorTier).where(eq(schema.sponsorTier.eventId, eventId));
    if (existing.length >= MAX_TIERS_PER_EVENT) throw new ApiError("invalid", `An event can have at most ${MAX_TIERS_PER_EVENT} tiers.`);
    tierId = newId();
    await db.insert(schema.sponsorTier).values({ id: tierId, eventId, name, position: existing.length, createdAt: now, updatedAt: now });
  }
  const currentRows = await db
    .select({ id: schema.sponsorEntitlement.id })
    .from(schema.sponsorEntitlement)
    .where(and(eq(schema.sponsorEntitlement.tierId, tierId), isNull(schema.sponsorEntitlement.sponsorshipId)));
  const currentIds = new Set(currentRows.map((r) => r.id));
  const keep = new Set<string>();
  for (const [position, r] of rows.entries()) {
    if (r.id && currentIds.has(r.id)) {
      keep.add(r.id);
      await db
        .update(schema.sponsorEntitlement)
        .set({ count: r.count, format: r.format, minutes: r.minutes, position, updatedAt: now })
        .where(eq(schema.sponsorEntitlement.id, r.id));
    } else {
      await db.insert(schema.sponsorEntitlement).values({
        id: newId(),
        tierId,
        sponsorshipId: null,
        count: r.count,
        format: r.format,
        minutes: r.minutes,
        position,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const removed = [...currentIds].filter((id) => !keep.has(id));
  for (const chunk of chunkIds(removed)) {
    await db.delete(schema.sponsorEntitlement).where(inArray(schema.sponsorEntitlement.id, chunk));
  }
  return { id: tierId, before, after: `${name}: ${entitlementSummary(rows)}` };
}

/** Deletes a tier with no sponsors on it. */
export async function deleteTier(db: Db, eventId: string, tierId: string): Promise<void> {
  const tier = await findTier(db, eventId, tierId);
  if (!tier) throw new ApiError("not_found", "Tier not found");
  const using = await db
    .select({ id: schema.sponsorship.id })
    .from(schema.sponsorship)
    .where(and(eq(schema.sponsorship.eventId, eventId), eq(schema.sponsorship.tierId, tierId)))
    .orderBy(asc(schema.sponsorship.id)).limit(1);
  if (using.length > 0) throw new ApiError("conflict", "Move this tier's sponsors to another tier before deleting it.");
  await db.delete(schema.sponsorEntitlement).where(eq(schema.sponsorEntitlement.tierId, tierId));
  await db.delete(schema.sponsorTier).where(eq(schema.sponsorTier.id, tierId));
}

export interface SponsorshipRow {
  id: string;
  companyId: string;
  companyName: string;
  tierId: string | null;
  tierName: string | null;
  status: SponsorshipStatus;
  statusLine: string;
  contacts: number;
  waiting: number;
  extras: Entitlement[];
}

export async function listSponsorships(db: Db, eventId: string): Promise<SponsorshipRow[]> {
  const rows = await db
    .select({
      id: schema.sponsorship.id,
      companyId: schema.sponsorship.companyId,
      companyName: schema.sponsorCompany.name,
      tierId: schema.sponsorship.tierId,
      tierName: schema.sponsorTier.name,
      tierPosition: schema.sponsorTier.position,
      status: schema.sponsorship.status,
    })
    .from(schema.sponsorship)
    .innerJoin(schema.sponsorCompany, eq(schema.sponsorCompany.id, schema.sponsorship.companyId))
    .leftJoin(schema.sponsorTier, eq(schema.sponsorTier.id, schema.sponsorship.tierId))
    .where(eq(schema.sponsorship.eventId, eventId))
    .orderBy(sql`coalesce(${schema.sponsorTier.position}, 9999)`, asc(schema.sponsorCompany.name));
  const packages = await loadPackages(db, rows.map((r) => r.id));
  return rows.map((r) => {
    const pkg = packages.get(r.id)!;
    return {
      id: r.id,
      companyId: r.companyId,
      companyName: r.companyName,
      tierId: r.tierId,
      tierName: r.tierName,
      status: (SPONSORSHIP_STATUSES as readonly string[]).includes(r.status) ? (r.status as SponsorshipStatus) : "pending",
      statusLine: packageStatusLine(pkg.slots),
      contacts: pkg.contacts,
      waiting: pkg.slots.filter((s) => s.session?.status === "submitted").length,
      extras: pkg.entitlements.filter((e) => e.extra),
    };
  });
}

export async function findSponsorship(db: Db, eventId: string, sponsorshipId: string) {
  const rows = await db
    .select({
      id: schema.sponsorship.id,
      companyId: schema.sponsorship.companyId,
      companyName: schema.sponsorCompany.name,
      tierId: schema.sponsorship.tierId,
      status: schema.sponsorship.status,
    })
    .from(schema.sponsorship)
    .innerJoin(schema.sponsorCompany, eq(schema.sponsorCompany.id, schema.sponsorship.companyId))
    .where(and(eq(schema.sponsorship.id, sponsorshipId), eq(schema.sponsorship.eventId, eventId)))
    .limit(1);
  return rows[0] ?? null;
}

function parseSponsorshipStatus(v: unknown): SponsorshipStatus {
  if (typeof v !== "string" || !(SPONSORSHIP_STATUSES as readonly string[]).includes(v)) {
    throw new ApiError("invalid", `Status must be one of ${SPONSORSHIP_STATUSES.join(", ")}.`, { status: "Invalid value" });
  }
  return v as SponsorshipStatus;
}

async function requireTierOrNull(db: Db, eventId: string, tierId: unknown): Promise<string | null> {
  if (tierId === null || tierId === undefined || tierId === "") return null;
  if (typeof tierId !== "string") throw new ApiError("invalid", "tierId must be a string", { tierId: "Invalid value" });
  if (!(await findTier(db, eventId, tierId))) throw new ApiError("invalid", "That tier isn't on this event.", { tierId: "Unknown tier" });
  return tierId;
}

/** Adds a sponsor company to the event. The company is org-level, so a
 * returning sponsor is matched by name and reused. */
export async function createSponsorship(
  db: Db,
  input: { orgId: string; eventId: string; companyName: unknown; tierId: unknown; status: unknown },
  now: Date,
): Promise<string> {
  if (typeof input.companyName !== "string" || input.companyName.trim() === "") {
    throw new ApiError("invalid", "A sponsor needs a company name.", { companyName: "Required" });
  }
  const companyName = input.companyName.trim();
  if (companyName.length > MAX_SPONSOR_NAME) throw new ApiError("invalid", "That company name is too long.", { companyName: "Too long" });
  const tierId = await requireTierOrNull(db, input.eventId, input.tierId);
  const status = input.status === undefined ? "active" : parseSponsorshipStatus(input.status);
  const existingCompany = await db
    .select({ id: schema.sponsorCompany.id })
    .from(schema.sponsorCompany)
    .where(and(eq(schema.sponsorCompany.orgId, input.orgId), sql`lower(${schema.sponsorCompany.name}) = lower(${companyName})`))
    .orderBy(asc(schema.sponsorCompany.id)).limit(1);
  let companyId = existingCompany[0]?.id;
  if (!companyId) {
    companyId = newId();
    await db.insert(schema.sponsorCompany).values({ id: companyId, orgId: input.orgId, name: companyName, createdAt: now, updatedAt: now });
  }
  const id = newId();
  const inserted = await db
    .insert(schema.sponsorship)
    .values({ id, eventId: input.eventId, companyId, tierId, status, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: [schema.sponsorship.eventId, schema.sponsorship.companyId] })
    .returning({ id: schema.sponsorship.id });
  if (inserted.length === 0) throw new ApiError("conflict", `${companyName} already sponsors this event.`, { companyName: "Already a sponsor" });
  return id;
}

/** Changes a sponsorship's tier, status, or per-sponsor extras. Returns a
 * before/after description for the audit log. */
export async function updateSponsorship(
  db: Db,
  eventId: string,
  sponsorshipId: string,
  input: { tierId?: unknown; status?: unknown; extras?: unknown },
  now: Date,
): Promise<{ changes: Record<string, string> }> {
  const current = await findSponsorship(db, eventId, sponsorshipId);
  if (!current) throw new ApiError("not_found", "Sponsorship not found");
  const changes: Record<string, string> = {};
  const set: Partial<typeof schema.sponsorship.$inferInsert> = { updatedAt: now };
  if (input.tierId !== undefined) {
    set.tierId = await requireTierOrNull(db, eventId, input.tierId);
    if (set.tierId !== current.tierId) changes.tier = `${current.tierId ?? "none"} -> ${set.tierId ?? "none"}`;
  }
  if (input.status !== undefined) {
    set.status = parseSponsorshipStatus(input.status);
    if (set.status !== current.status) changes.status = `${current.status} -> ${set.status}`;
  }
  await db.update(schema.sponsorship).set(set).where(eq(schema.sponsorship.id, sponsorshipId));
  if (input.extras !== undefined) {
    const rows = parseEntitlementInputs(input.extras);
    const existing = await db
      .select({ id: schema.sponsorEntitlement.id })
      .from(schema.sponsorEntitlement)
      .where(eq(schema.sponsorEntitlement.sponsorshipId, sponsorshipId));
    const existingIds = new Set(existing.map((e) => e.id));
    const keep = new Set<string>();
    for (const [position, r] of rows.entries()) {
      if (r.id && existingIds.has(r.id)) {
        keep.add(r.id);
        await db
          .update(schema.sponsorEntitlement)
          .set({ count: r.count, format: r.format, minutes: r.minutes, position, updatedAt: now })
          .where(eq(schema.sponsorEntitlement.id, r.id));
      } else {
        await db.insert(schema.sponsorEntitlement).values({
          id: newId(),
          tierId: null,
          sponsorshipId,
          count: r.count,
          format: r.format,
          minutes: r.minutes,
          position,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const removed = [...existingIds].filter((id) => !keep.has(id));
    for (const chunk of chunkIds(removed)) {
      await db.delete(schema.sponsorEntitlement).where(inArray(schema.sponsorEntitlement.id, chunk));
    }
    changes.extras = entitlementSummary(rows);
  }
  return { changes };
}

export interface SponsorContactRow {
  id: string;
  contactId: string;
  name: string;
  email: string;
  status: "invited" | "joined";
  isPrimary: boolean;
  invitedAt: number | null;
  joinedAt: number | null;
}

export async function listSponsorContacts(db: Db, sponsorshipId: string): Promise<SponsorContactRow[]> {
  const rows = await db
    .select({
      id: schema.sponsorContact.id,
      contactId: schema.sponsorContact.contactId,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      status: schema.sponsorContact.status,
      isPrimary: schema.sponsorContact.isPrimary,
      invitedAt: schema.sponsorContact.invitedAt,
      joinedAt: schema.sponsorContact.joinedAt,
      createdAt: schema.sponsorContact.createdAt,
    })
    .from(schema.sponsorContact)
    .innerJoin(schema.contact, eq(schema.contact.id, schema.sponsorContact.contactId))
    .where(eq(schema.sponsorContact.sponsorshipId, sponsorshipId))
    .orderBy(sql`${schema.sponsorContact.isPrimary} desc`, asc(schema.sponsorContact.createdAt), asc(schema.sponsorContact.id));
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    name: `${r.firstName} ${r.lastName}`.trim() || r.email,
    email: r.email,
    status: r.status === "invited" ? "invited" : "joined",
    isPrimary: r.isPrimary,
    invitedAt: r.invitedAt?.getTime() ?? null,
    joinedAt: r.joinedAt?.getTime() ?? null,
  }));
}

export function parsePersonInput(input: { firstName?: unknown; lastName?: unknown; name?: unknown; email?: unknown }): {
  firstName: string;
  lastName: string;
  email: string;
} {
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ApiError("invalid", "Enter a valid email address.", { email: "Invalid email" });
  }
  let firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  let lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  if (!firstName && typeof input.name === "string") {
    const parts = input.name.trim().split(/\s+/);
    firstName = parts.shift() ?? "";
    lastName = parts.join(" ");
  }
  if (!firstName) throw new ApiError("invalid", "Enter a name.", { name: "Required" });
  if (firstName.length > MAX_PERSON_NAME || lastName.length > MAX_PERSON_NAME) throw new ApiError("invalid", "That name is too long.", { name: "Too long" });
  return { firstName, lastName, email };
}

/** Adds a person as a contact on a sponsorship. Organizers add joined
 * contacts; a sponsor contact's teammate invitation adds an invited one. */
export async function addSponsorContact(
  db: Db,
  input: {
    orgId: string;
    eventId: string;
    sponsorshipId: string;
    person: { firstName: string; lastName: string; email: string };
    status: "invited" | "joined";
    isPrimary: boolean;
    invitedByContactId: string | null;
  },
  now: Date,
): Promise<{ sponsorContactId: string; contactId: string; created: boolean }> {
  const existing = await db
    .select({ id: schema.sponsorContact.id })
    .from(schema.sponsorContact)
    .where(eq(schema.sponsorContact.sponsorshipId, input.sponsorshipId));
  if (existing.length >= MAX_SPONSOR_CONTACTS) throw new ApiError("invalid", `A sponsor can have at most ${MAX_SPONSOR_CONTACTS} contacts.`);
  const contact = await findOrCreateContact(db, input.orgId, input.person, now);
  const id = newId();
  const inserted = await db
    .insert(schema.sponsorContact)
    .values({
      id,
      sponsorshipId: input.sponsorshipId,
      eventId: input.eventId,
      contactId: contact.id,
      status: input.status,
      isPrimary: input.isPrimary,
      invitedByContactId: input.invitedByContactId,
      invitedAt: input.status === "invited" ? now : null,
      joinedAt: input.status === "joined" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [schema.sponsorContact.sponsorshipId, schema.sponsorContact.contactId] })
    .returning({ id: schema.sponsorContact.id });
  if (inserted.length === 0) throw new ApiError("conflict", "That person is already on this team.", { email: "Already on the team" });
  if (input.isPrimary) {
    await db
      .update(schema.sponsorContact)
      .set({ isPrimary: false, updatedAt: now })
      .where(and(eq(schema.sponsorContact.sponsorshipId, input.sponsorshipId), sql`${schema.sponsorContact.id} <> ${id}`));
  }
  return { sponsorContactId: id, contactId: contact.id, created: true };
}

/** Removes a contact from a sponsorship. The primary contact stays. */
export async function removeSponsorContact(db: Db, sponsorshipId: string, sponsorContactId: string): Promise<{ contactId: string }> {
  const rows = await db
    .select({ id: schema.sponsorContact.id, contactId: schema.sponsorContact.contactId, isPrimary: schema.sponsorContact.isPrimary })
    .from(schema.sponsorContact)
    .where(and(eq(schema.sponsorContact.id, sponsorContactId), eq(schema.sponsorContact.sponsorshipId, sponsorshipId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError("not_found", "Team member not found");
  if (row.isPrimary) throw new ApiError("invalid", "The primary contact can't be removed. Make someone else primary first.");
  await db
    .delete(schema.sponsorContact)
    .where(and(eq(schema.sponsorContact.id, row.id), eq(schema.sponsorContact.sponsorshipId, sponsorshipId)));
  return { contactId: row.contactId };
}

/** A teammate joins the moment they first open their portal. Returns the
 * events whose portals need reconciling. */
export async function markSponsorContactsJoined(db: Db, contactId: string, now: Date): Promise<string[]> {
  const rows = await db
    .select({ id: schema.sponsorContact.id, eventId: schema.sponsorContact.eventId })
    .from(schema.sponsorContact)
    .where(and(eq(schema.sponsorContact.contactId, contactId), eq(schema.sponsorContact.status, "invited")));
  if (rows.length === 0) return [];
  for (const chunk of chunkIds(rows.map((r) => r.id))) {
    await db
      .update(schema.sponsorContact)
      .set({ status: "joined", joinedAt: now, updatedAt: now })
      .where(inArray(schema.sponsorContact.id, chunk));
  }
  return [...new Set(rows.map((r) => r.eventId))];
}
