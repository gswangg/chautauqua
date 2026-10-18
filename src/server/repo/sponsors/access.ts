// Sponsor isolation: the one gate every sponsor-contact read and write goes
// through. A contact reaches a sponsorship only through their own joined
// sponsor_contact row on it, so no path can hand them another sponsor's
// sessions, team, entitlements or data.

import { and, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";

export interface SponsorAccess {
  sponsorshipId: string;
  sponsorContactId: string;
  contactId: string;
  eventId: string;
  orgId: string;
  companyId: string;
  companyName: string;
  tierId: string | null;
  tierName: string | null;
  isPrimary: boolean;
  sponsorshipStatus: string;
}

/** The caller's membership of one sponsorship, or null when they have none
 * (or it belongs to another org). Invited-but-not-joined teammates get null
 * too: nothing is theirs until they join. */
export async function resolveSponsorAccess(
  db: Db,
  input: { contactId: string; orgId: string; sponsorshipId: string },
): Promise<SponsorAccess | null> {
  const rows = await db
    .select({
      sponsorshipId: schema.sponsorship.id,
      sponsorContactId: schema.sponsorContact.id,
      contactId: schema.sponsorContact.contactId,
      contactStatus: schema.sponsorContact.status,
      eventId: schema.sponsorship.eventId,
      orgId: schema.event.orgId,
      companyId: schema.sponsorCompany.id,
      companyName: schema.sponsorCompany.name,
      tierId: schema.sponsorship.tierId,
      isPrimary: schema.sponsorContact.isPrimary,
      sponsorshipStatus: schema.sponsorship.status,
    })
    .from(schema.sponsorContact)
    .innerJoin(schema.sponsorship, eq(schema.sponsorship.id, schema.sponsorContact.sponsorshipId))
    .innerJoin(schema.sponsorCompany, eq(schema.sponsorCompany.id, schema.sponsorship.companyId))
    .innerJoin(schema.event, eq(schema.event.id, schema.sponsorship.eventId))
    .where(
      and(
        eq(schema.sponsorContact.sponsorshipId, input.sponsorshipId),
        eq(schema.sponsorContact.contactId, input.contactId),
        eq(schema.event.orgId, input.orgId),
        eq(schema.sponsorCompany.orgId, input.orgId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || row.contactStatus !== "joined") return null;
  let tierName: string | null = null;
  if (row.tierId) {
    const tiers = await db
      .select({ name: schema.sponsorTier.name })
      .from(schema.sponsorTier)
      .where(and(eq(schema.sponsorTier.id, row.tierId), eq(schema.sponsorTier.eventId, row.eventId)))
      .limit(1);
    tierName = tiers[0]?.name ?? null;
  }
  return {
    sponsorshipId: row.sponsorshipId,
    sponsorContactId: row.sponsorContactId,
    contactId: row.contactId,
    eventId: row.eventId,
    orgId: row.orgId,
    companyId: row.companyId,
    companyName: row.companyName,
    tierId: row.tierId,
    tierName,
    isPrimary: row.isPrimary,
    sponsorshipStatus: row.sponsorshipStatus,
  };
}

/** Loads a sponsor session only if it belongs to the caller's sponsorship. */
export async function findSponsorSessionForAccess(db: Db, access: SponsorAccess, sessionId: string) {
  const rows = await db
    .select()
    .from(schema.sponsorSession)
    .where(and(eq(schema.sponsorSession.id, sessionId), eq(schema.sponsorSession.sponsorshipId, access.sponsorshipId)))
    .limit(1);
  return rows[0] ?? null;
}
