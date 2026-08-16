// Org user directory repo (J4/DEC-043): organizers create reviewer/organizer
// accounts here. user_email_idx (schema.ts) is globally unique across orgs —
// a duplicate email anywhere fails loudly as a 409 conflict.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { ApiError } from "../http";
import { DEC_757, DEC_865 } from "../../decisions";

void DEC_757;
void DEC_865; // organizer user-directory API must never reach speaker portal accounts

/** DEC-865: the org-user directory (list/count/reset-password/role-change)
 * is organizer/reviewer accounts only -- speaker portal accounts share the
 * `user` table but must never surface here. */
export const ORG_USER_ROLES = ["organizer", "reviewer"] as const;
export type OrgUserRole = (typeof ORG_USER_ROLES)[number];
export function isOrgUserRole(value: string): value is OrgUserRole {
  return (ORG_USER_ROLES as readonly string[]).includes(value);
}

/** Single where-builder shared by listOrgUsers and countOrgUsers (DEC-865) so
 * the list and its total can never drift on which roles count as "org
 * users". Always scopes to ORG_USER_ROLES even when a specific role is
 * requested, so a speaker id can never be reached via ?role=. */
function orgUserWhere(orgId: string, role?: string) {
  if (role === undefined) {
    return and(eq(schema.user.orgId, orgId), inArray(schema.user.role, ORG_USER_ROLES));
  }
  if (!isOrgUserRole(role)) throw new Error(`orgUserWhere: role must already be validated by the route, got ${role}`);
  return and(eq(schema.user.orgId, orgId), eq(schema.user.role, role));
}

export interface OrgUserRecord {
  id: string;
  orgId: string;
  email: string;
  role: string;
  contactId: string | null;
  name: string | null;
  createdAt: number;
}

function toOrgUserRecord(row: typeof schema.user.$inferSelect): OrgUserRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    role: row.role,
    contactId: row.contactId,
    name: row.name,
    createdAt: row.createdAt.getTime(),
  };
}

/** Lists users in an org, optionally narrowed by role, ordered deterministically
 * by id asc. `page` absent means today's unbounded behavior (internal callers
 * are unaffected) — see countOrgUsers for the matching total (DEC-460/461). */
export async function listOrgUsers(db: Db, orgId: string, role?: string, page?: { limit: number; offset: number }): Promise<OrgUserRecord[]> {
  const whereExpr = orgUserWhere(orgId, role);
  let query = db.select().from(schema.user).where(whereExpr).orderBy(asc(schema.user.id));
  if (page) {
    query = query.limit(page.limit).offset(page.offset) as typeof query;
  }
  const rows = await query;
  return rows.map(toOrgUserRecord);
}

/** Counts org users under the same optional role filter as listOrgUsers. */
export async function countOrgUsers(db: Db, orgId: string, role?: string): Promise<number> {
  const whereExpr = orgUserWhere(orgId, role);
  const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.user).where(whereExpr);
  return Number(rows[0]?.count ?? 0);
}

export interface CreateUserInput {
  orgId: string;
  email: string;
  role: string;
  passwordHash: string;
  // DEC-757: optional display name, composed by the route from firstName/lastName.
  name?: string | null;
}

/** Creates an org user account. Throws ApiError('conflict') on duplicate
 * email (user_email_idx is unique) rather than swallowing the D1 error.
 *
 * DEC-552 amendment (findings wave 14): the pre-read below is a fast path
 * only, not the gate — a concurrent POST /api/v1/users (or a race with the
 * speaker-account insert in routes/auth-claim.tsx) can land its INSERT
 * between this SELECT and the write. The INSERT itself is the authority:
 * it targets user_email_idx (migrations/0000_secret_matthew_murdock.sql)
 * with onConflictDoNothing, and a post-insert re-select-by-id that comes up
 * empty means this call's row lost the race, at which point it throws the
 * exact same ApiError the pre-check raises. */
export async function createUser(db: Db, input: CreateUserInput): Promise<OrgUserRecord> {
  if (input.email !== input.email.toLowerCase()) throw new Error("createUser: email must be lowercased by the caller");
  // DEC-558 (wave 75): user_email_idx is a uniqueIndex on schema.user.email,
  // and input.email is already lowercased (asserted above), so this
  // predicate already narrows to at most one row.
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
  await db
    .insert(schema.user)
    .values({
      id,
      orgId: input.orgId,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
      name: input.name ?? null,
      contactId: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: schema.user.email });
  const rows = await db.select().from(schema.user).where(eq(schema.user.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError("conflict", "A user with this email already exists", { email: "already in use" });
  }
  return toOrgUserRecord(row);
}

/** Loads a user by id, scoped to orgId — returns undefined for an unknown
 * id, a cross-org id, OR a same-org id outside ORG_USER_ROLES (DEC-865: a
 * speaker portal account's id reads as missing here too), so callers can
 * 404 without leaking which case it was. */
export async function getOrgUserById(db: Db, userId: string, orgId: string): Promise<OrgUserRecord | undefined> {
  const rows = await db
    .select()
    .from(schema.user)
    .where(and(eq(schema.user.id, userId), eq(schema.user.orgId, orgId), inArray(schema.user.role, ORG_USER_ROLES)))
    .limit(1);
  const row = rows[0];
  return row ? toOrgUserRecord(row) : undefined;
}

/** Updates a user's password_hash (DEC-215 org-user password re-issue). */
export async function updateUserPasswordHash(db: Db, userId: string, passwordHash: string): Promise<void> {
  await db.update(schema.user).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.user.id, userId));
}

/** Updates a user's role (DEC-778 role change), scoped to orgId in its own
 * WHERE (DEC-962 shape -- this can no longer rely on a caller-side lookup
 * having already scoped the row) and refusing a last-organizer demotion
 * atomically (DEC-100 amendment, wave 65): count-then-write on "at least one
 * organizer exists" lets two concurrent demotions of two DIFFERENT
 * organizers both observe count 2 and both admit, leaving zero organizers.
 * The WHERE instead carries a correlated `count(*) > 1` over the org's
 * current organizer rows, applied only when the row being updated is
 * currently an organizer and the new role is not 'organizer' -- so a
 * same-role or non-organizer-target write is never blocked by it. Caller is
 * still responsible for every other guard (self-service refusal, unknown
 * role, 404 on missing/cross-org id). Returns undefined when the WHERE
 * matched no row -- either the id/org didn't match, or the last-organizer
 * guard refused; the route can't tell which without a prior lookup, so it
 * looks the target up first and treats an empty result as the guard firing
 * (DEC-948's pattern: the echo comes from the write). */
export async function updateUserRole(db: Db, userId: string, orgId: string, role: string): Promise<OrgUserRecord | undefined> {
  const lastOrganizerGuard =
    role === "organizer"
      ? sql`1 = 1`
      : sql`(${schema.user.role} <> 'organizer' OR (select count(*) from "user" where "org_id" = ${orgId} and "role" = 'organizer') > 1)`;
  const rows = await db
    .update(schema.user)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(schema.user.id, userId), eq(schema.user.orgId, orgId), lastOrganizerGuard))
    .returning();
  const row = rows[0];
  return row ? toOrgUserRecord(row) : undefined;
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
 * throws — no id fallback, fail loudly.
 *
 * w5-i note: DEC-708's batchUserDisplayNames (review/users.ts) additionally
 * tries an org-scoped contact-email match when a user has no contactId link
 * — a strictly more complete resolver than this one. This function is NOT
 * rewritten to delegate to it: dozens of route tests script this module's
 * db calls as an exact ordered select-queue (test/submission-revisions.ts
 * et al.), and batchUserDisplayNames issues a different query shape/count
 * that desyncs every one of those scripts. Left as a narrower interpretation
 * for this task — flagged rather than silently deciding to touch a
 * widely-depended-on call shape. */
export async function resolveActorName(db: Db, userId: string): Promise<string> {
  const rows = await db
    .select({ email: schema.user.email, contactId: schema.user.contactId, name: schema.user.name })
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
  if (user.name && user.name.trim()) return user.name;
  return user.email;
}
