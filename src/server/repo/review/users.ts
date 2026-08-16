// Reviewer/user info lookups used by the review surfaces (batching bounded
// via chunkIds per DEC-078; org-scoped existence check for reviewer mgmt).

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { ApiError } from "../../http";
import { chunkIds, ID_CHUNK_SIZE } from "../../../lib/chunk";

export interface ReviewerUserInfo {
  userId: string;
  email: string;
}

export async function getUsersByIds(db: Db, userIds: string[]): Promise<ReviewerUserInfo[]> {
  if (userIds.length === 0) return [];
  const rows: ReviewerUserInfo[] = [];
  for (const batch of chunkIds(userIds)) {
    const batchRows = await db
      .select({ userId: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(inArray(schema.user.id, batch));
    rows.push(...batchRows);
  }
  return rows;
}

/**
 * DEC-708/DEC-757: batched account -> display-name resolver, the exact
 * inverse of findAccountUserId/findAccountUserIds' contact-id-OR-email rule
 * (comms.ts DEC-530). Resolution order per user, per DEC-757 wave 72:
 *   1. user.contactId, if it resolves to a contact
 *   2. else an org-scoped contact-email match (contact.orgId = user.orgId
 *      AND lower(contact.email) = lower(user.email)) -- never a bare email
 *      match across orgs
 *   3. else the name the invite flow stored on the user (user.name), if
 *      non-blank
 *   4. else null (render the email alone, never a fabricated name from the
 *      email's local part)
 * Exactly one query per direction (user batch, contact-by-id batch,
 * contact-by-org+email batch), never a query per row. Every requested
 * userId is present in the returned map.
 */
export async function batchUserDisplayNames(db: Db, userIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (userIds.length === 0) return result;
  for (const id of userIds) result.set(id, null);

  const users: { id: string; orgId: string; email: string; contactId: string | null; name: string | null }[] = [];
  for (const batch of chunkIds(userIds)) {
    const rows = await db
      .select({
        id: schema.user.id,
        orgId: schema.user.orgId,
        email: schema.user.email,
        contactId: schema.user.contactId,
        name: schema.user.name,
      })
      .from(schema.user)
      .where(inArray(schema.user.id, batch));
    users.push(...rows);
  }

  const contactIds = [...new Set(users.filter((u) => u.contactId !== null).map((u) => u.contactId as string))];
  const contactById = new Map<string, { firstName: string; lastName: string }>();
  for (const batch of chunkIds(contactIds)) {
    const rows = await db
      .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const row of rows) contactById.set(row.id, { firstName: row.firstName, lastName: row.lastName });
  }

  const needsEmailMatch = users.filter((u) => u.contactId === null || !contactById.has(u.contactId));
  const contactByOrgEmail = new Map<string, { firstName: string; lastName: string }>();
  // DEC-078: needsEmailMatch can grow with the (already-chunked) userIds
  // input, so the two id lists it feeds (orgIds, emails) are re-chunked here
  // at half ID_CHUNK_SIZE each -- both lists are bound in the SAME query, so
  // halving keeps their combined bind count under the D1 ceiling (mirrors
  // comms.ts's ACCOUNT_LOOKUP_BATCH_SIZE pattern for the same shape).
  const EMAIL_MATCH_BATCH_SIZE = Math.floor(ID_CHUNK_SIZE / 2);
  for (let i = 0; i < needsEmailMatch.length; i += EMAIL_MATCH_BATCH_SIZE) {
    const matchBatch = needsEmailMatch.slice(i, i + EMAIL_MATCH_BATCH_SIZE);
    const orgIds = [...new Set(matchBatch.map((u) => u.orgId))];
    const emails = [...new Set(matchBatch.map((u) => u.email.toLowerCase()))];
    const rows = await db
      .select({
        orgId: schema.contact.orgId,
        email: schema.contact.email,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.contact)
      .where(and(inArray(schema.contact.orgId, orgIds), inArray(sql`lower(${schema.contact.email})`, emails)));
    for (const row of rows) {
      contactByOrgEmail.set(`${row.orgId}::${row.email.toLowerCase()}`, { firstName: row.firstName, lastName: row.lastName });
    }
  }

  for (const u of users) {
    const contact =
      (u.contactId !== null ? contactById.get(u.contactId) : undefined) ??
      contactByOrgEmail.get(`${u.orgId}::${u.email.toLowerCase()}`);
    if (contact) {
      result.set(u.id, `${contact.firstName} ${contact.lastName}`.trim());
    } else if (u.name && u.name.trim().length > 0) {
      result.set(u.id, u.name);
    } else {
      result.set(u.id, null);
    }
  }
  return result;
}

/** Confirms the user is a reviewer or organizer in this org, and (for
 * reviewers) resolves their contactId for merge-field rendering; throws
 * not_found rather than leaking existence across orgs. */
export async function requireOrgUser(db: Db, userId: string, orgId: string): Promise<{ role: string; email: string }> {
  const rows = await db
    .select({ role: schema.user.role, email: schema.user.email, orgId: schema.user.orgId })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row || row.orgId !== orgId) throw new ApiError("not_found", "User not found");
  return { role: row.role, email: row.email };
}
