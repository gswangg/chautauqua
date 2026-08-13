// Org user directory repo (J4/DEC-043): organizers create reviewer/organizer
// accounts here. user_email_idx (schema.ts) is globally unique across orgs —
// a duplicate email anywhere fails loudly as a 409 conflict.

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { ApiError } from "../http";
import { DEC_757 } from "../../decisions";

void DEC_757;

export interface OrgUserRecord {
  id: string;
  orgId: string;
  email: string;
  role: string;
  contactId: string | null;
  createdAt: number;
}

function toOrgUserRecord(row: typeof schema.user.$inferSelect): OrgUserRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    role: row.role,
    contactId: row.contactId,
    createdAt: row.createdAt.getTime(),
  };
}

/** Lists users in an org, optionally narrowed by role, ordered deterministically
 * by id asc. `page` absent means today's unbounded behavior (internal callers
 * are unaffected) — see countOrgUsers for the matching total (DEC-460/461). */
export async function listOrgUsers(db: Db, orgId: string, role?: string, page?: { limit: number; offset: number }): Promise<OrgUserRecord[]> {
  const whereExpr = role ? and(eq(schema.user.orgId, orgId), eq(schema.user.role, role)) : eq(schema.user.orgId, orgId);
  let query = db.select().from(schema.user).where(whereExpr).orderBy(asc(schema.user.id));
  if (page) {
    query = query.limit(page.limit).offset(page.offset) as typeof query;
  }
  const rows = await query;
  return rows.map(toOrgUserRecord);
}

/** Counts org users under the same optional role filter as listOrgUsers. */
export async function countOrgUsers(db: Db, orgId: string, role?: string): Promise<number> {
  const whereExpr = role ? and(eq(schema.user.orgId, orgId), eq(schema.user.role, role)) : eq(schema.user.orgId, orgId);
  const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.user).where(whereExpr);
  return Number(rows[0]?.count ?? 0);
}

export interface CreateUserInput {
  orgId: string;
  email: string;
  role: string;
  passwordHash: string;
}

/** Creates an org user account. Throws ApiError('conflict') on duplicate
 * email (user_email_idx is unique) rather than swallowing the D1 error. */
export async function createUser(db: Db, input: CreateUserInput): Promise<OrgUserRecord> {
  if (input.email !== input.email.toLowerCase()) throw new Error("createUser: email must be lowercased by the caller");
  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = ${input.email}`)
    .limit(1);
  if (existing.length > 0) {
    throw new ApiError("conflict", "A user with this email already exists", { email: "already in use" });
  }
  const now = new Date();
  const id = newId();
  await db.insert(schema.user).values({
    id,
    orgId: input.orgId,
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role,
    contactId: null,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(schema.user).where(eq(schema.user.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("createUser: insert did not persist");
  return toOrgUserRecord(row);
}

/** Loads a user by id, scoped to orgId — returns undefined for an unknown
 * id OR a cross-org id, so callers can 404 without leaking which case it was. */
export async function getOrgUserById(db: Db, userId: string, orgId: string): Promise<OrgUserRecord | undefined> {
  const rows = await db
    .select()
    .from(schema.user)
    .where(and(eq(schema.user.id, userId), eq(schema.user.orgId, orgId)))
    .limit(1);
  const row = rows[0];
  return row ? toOrgUserRecord(row) : undefined;
}

/** Updates a user's password_hash (DEC-215 org-user password re-issue). */
export async function updateUserPasswordHash(db: Db, userId: string, passwordHash: string): Promise<void> {
  await db.update(schema.user).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.user.id, userId));
}

/** Updates a user's role (DEC-778 role change). Caller is responsible for
 * every guard (org scope, self-service refusal, last-organizer refusal) --
 * this just writes the column. */
export async function updateUserRole(db: Db, userId: string, role: string): Promise<void> {
  await db.update(schema.user).set({ role, updatedAt: new Date() }).where(eq(schema.user.id, userId));
}

/** Deletes every auth_session row for a user — used on password reset/
 * re-issue to force re-authentication everywhere (mirrors DEC-200's
 * self-service /account/password revoke-all behavior). */
export async function deleteUserSessions(db: Db, userId: string): Promise<void> {
  await db.delete(schema.authSession).where(eq(schema.authSession.userId, userId));
}

/** DEC-757: every author is a named person, never a raw email/id — resolves
 * the display name for a user acting in the system. A user with a linked
 * contact is named `${firstName} ${lastName}`; otherwise the user's email is
 * the best identifying attribute available (matches the existing
 * getUserEmail rationale). A missing user row is an invariant violation and
 * throws — no id fallback, fail loudly. */
export async function resolveActorName(db: Db, userId: string): Promise<string> {
  const rows = await db
    .select({ email: schema.user.email, contactId: schema.user.contactId })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) throw new Error(`resolveActorName: no user row for ${userId}`);
  if (user.contactId) {
    const contactRows = await db
      .select({ firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(eq(schema.contact.id, user.contactId))
      .limit(1);
    const contact = contactRows[0];
    if (!contact) throw new Error(`resolveActorName: user ${userId} references missing contact ${user.contactId}`);
    return `${contact.firstName} ${contact.lastName}`.trim();
  }
  return user.email;
}
