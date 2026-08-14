// Session minting (DEC-994, wave-6b amendment; wave-22 amendment): login
// rotates THIS session, not the user's whole fleet — SHARED demo personas
// mean revoking every row on login signs other concurrent sessions (eval
// agent, human judge) out mid-run. issueSession deletes only the row
// matching the token presented on the request (plus any already-expired
// rows for the user) before minting. presentedTokenHash is derived from the
// request's chq_session cookie (src/routes/auth.tsx:384-387) — client
// input, not something the server can trust to name only the caller's own
// row. Wave-22: the presented-hash delete is scoped by BOTH userId and
// tokenHash, not tokenHash alone — a login as user A that happens to carry
// user B's live session cookie must not delete B's row (that would revoke a
// session belonging to someone who isn't even authenticating right now,
// contradicting the "Leaves other live sessions for this user untouched"
// contract below). Password-reset paths (claim, account password change)
// still want the old revoke-everything behaviour — that's
// issueSessionRevokingAll. These are the ONLY exports that may
// `insert(schema.authSession)`; a source-grep test
// (test/session-rotation.test.ts) enumerates and enforces that, plus a
// second scan enforcing every `delete(schema.authSession)` site is scoped
// by authSession.userId except the one ledgered exception (POST /logout,
// which resolves only the session presented on that request).

import { and, eq, lte } from "drizzle-orm";
import * as schema from "../db/schema";
import { newId } from "../domain/ids";
import { newSessionToken, hashToken } from "../auth/tokens";
import type { Db } from "./context";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function mintSession(db: Db, userId: string, now: Date): Promise<string> {
  const token = newSessionToken();
  const tokenHash = await hashToken(token);
  await db.insert(schema.authSession).values({
    id: newId(),
    userId,
    tokenHash,
    expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS),
    createdAt: now,
    updatedAt: now,
  });

  return token;
}

/**
 * Rotate the session presented on this request. Deletes the row whose
 * tokenHash matches `presentedTokenHash` AND whose userId matches `userId`
 * (when presentedTokenHash is non-null) and every already-expired row for
 * this user, then mints one fresh row. Leaves other live sessions for this
 * user untouched. The userId predicate matters because presentedTokenHash
 * comes straight off the request's chq_session cookie (client input): if
 * the caller logging in as `userId` happens to carry a *different* user's
 * live session cookie, deleting by tokenHash alone would revoke that other
 * user's session — someone not even authenticating on this request.
 */
export async function issueSession(
  db: Db,
  userId: string,
  now: Date,
  presentedTokenHash: string | null,
): Promise<string> {
  await db
    .delete(schema.authSession)
    .where(and(eq(schema.authSession.userId, userId), lte(schema.authSession.expiresAt, now)));

  if (presentedTokenHash !== null) {
    await db
      .delete(schema.authSession)
      .where(and(eq(schema.authSession.userId, userId), eq(schema.authSession.tokenHash, presentedTokenHash)));
  }

  return mintSession(db, userId, now);
}

/** Revoke every existing auth_session row for this user, then mint one fresh row. */
export async function issueSessionRevokingAll(db: Db, userId: string, now: Date): Promise<string> {
  await db.delete(schema.authSession).where(eq(schema.authSession.userId, userId));
  return mintSession(db, userId, now);
}
