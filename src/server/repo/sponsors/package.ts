// A sponsorship's package: its tier's entitlements plus its own extras, and
// the sponsor sessions holding each slot (src/domain/sponsors.ts).

import { and, inArray, isNull } from "drizzle-orm";
import { chunkIds } from "../../../lib/chunk";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { buildPackage, isSponsorSessionStatus, type Entitlement, type Slot, type SlotSession } from "../../../domain/sponsors";

export interface SponsorPackage {
  sponsorshipId: string;
  entitlements: Entitlement[];
  slots: Slot[];
  // sessions holding no slot (the tier was lowered after they were made)
  over: SlotSession[];
  // joined contacts on the sponsorship
  joinedContacts: number;
  contacts: number;
}

export async function loadPackages(db: Db, sponsorshipIds: string[]): Promise<Map<string, SponsorPackage>> {
  const out = new Map<string, SponsorPackage>();
  const ids = [...new Set(sponsorshipIds)];
  if (ids.length === 0) return out;
  const sponsorships: { id: string; tierId: string | null }[] = [];
  const entitlementRows: (typeof schema.sponsorEntitlement.$inferSelect)[] = [];
  const sessions: { id: string; sponsorshipId: string; entitlementId: string; title: string; status: string; createdAt: Date }[] = [];
  const contacts: { sponsorshipId: string; status: string }[] = [];
  for (const chunk of chunkIds(ids)) {
    sponsorships.push(
      ...(await db
        .select({ id: schema.sponsorship.id, tierId: schema.sponsorship.tierId })
        .from(schema.sponsorship)
        .where(inArray(schema.sponsorship.id, chunk))),
    );
    entitlementRows.push(...(await db.select().from(schema.sponsorEntitlement).where(inArray(schema.sponsorEntitlement.sponsorshipId, chunk))));
    sessions.push(
      ...(await db
        .select({
          id: schema.sponsorSession.id,
          sponsorshipId: schema.sponsorSession.sponsorshipId,
          entitlementId: schema.sponsorSession.entitlementId,
          title: schema.sponsorSession.title,
          status: schema.sponsorSession.status,
          createdAt: schema.sponsorSession.createdAt,
        })
        .from(schema.sponsorSession)
        .where(inArray(schema.sponsorSession.sponsorshipId, chunk))),
    );
    contacts.push(
      ...(await db
        .select({ sponsorshipId: schema.sponsorContact.sponsorshipId, status: schema.sponsorContact.status })
        .from(schema.sponsorContact)
        .where(inArray(schema.sponsorContact.sponsorshipId, chunk))),
    );
  }
  const tierIds = [...new Set(sponsorships.map((s) => s.tierId).filter((t): t is string => t !== null))];
  for (const chunk of chunkIds(tierIds)) {
    entitlementRows.push(
      ...(await db
        .select()
        .from(schema.sponsorEntitlement)
        .where(and(inArray(schema.sponsorEntitlement.tierId, chunk), isNull(schema.sponsorEntitlement.sponsorshipId)))),
    );
  }
  for (const s of sponsorships) {
    const entitlements: Entitlement[] = entitlementRows
      .filter((e) => e.sponsorshipId === s.id || (s.tierId !== null && e.tierId === s.tierId && e.sponsorshipId === null))
      .sort((a, b) => Number(a.sponsorshipId !== null) - Number(b.sponsorshipId !== null) || a.position - b.position)
      .map((e) => ({ id: e.id, count: e.count, format: e.format, minutes: e.minutes, extra: e.sponsorshipId !== null }));
    const slotSessions: SlotSession[] = sessions
      .filter((x) => x.sponsorshipId === s.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1))
      .map((x) => {
        if (!isSponsorSessionStatus(x.status)) throw new Error(`sponsor_session ${x.id} has an unknown status ${x.status}`);
        return { id: x.id, entitlementId: x.entitlementId, title: x.title, status: x.status };
      });
    const pkg = buildPackage(entitlements, slotSessions);
    const mine = contacts.filter((c) => c.sponsorshipId === s.id);
    out.set(s.id, {
      sponsorshipId: s.id,
      entitlements,
      slots: pkg.slots,
      over: pkg.over,
      joinedContacts: mine.filter((c) => c.status === "joined").length,
      contacts: mine.length,
    });
  }
  return out;
}
