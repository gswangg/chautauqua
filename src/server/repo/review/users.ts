// Reviewer/user info lookups used by the review surfaces (batching bounded
// via chunkIds per DEC-078; org-scoped existence check for reviewer mgmt).

import { eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { ApiError } from "../../http";
import { chunkIds } from "../../../lib/chunk";

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
