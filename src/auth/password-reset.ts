// Password-reset token flow, per DEC-949 (wave 27 amendment): a self-
// service reset request is instantly repeatable by the user, so — unlike
// claim.ts's grant — there is no failed-batch hazard to hedge against, and a
// live older link is pure attack surface. claim.ts (src/auth/claim.ts:74-96)
// deliberately re-puts a superseded grant under a 48h grace window because
// an organizer's batch send can fail after minting and must not strand the
// speaker with no working link. A password-reset mint has the opposite
// premise: the request came from the person themselves, who asserted the
// credential is lost and can trivially ask again, so createPasswordResetToken
// HARD-DELETES the prior token immediately rather than superseding it with a
// grace window. Pure Web Crypto + the same structural KVStore interface as
// claim.ts (DEC-002) — no node:/cloudflare imports, so this is fully
// vitest-testable against an in-memory fake.

import { hashToken, newSessionToken } from "./tokens";
import { DEC_949 } from "../decisions";

void DEC_949;

export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

export interface PasswordResetRecord {
  userId: string;
  email: string;
}

/** Structural subset of Cloudflare's KVNamespace — small enough to fake. */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

function passwordResetKvKey(tokenHash: string): string {
  return `pwreset:${tokenHash}`;
}

/** DEC-949: a reset token is SINGLE-ACTIVE per user — this index key holds
 * the hash of the currently-live token, so createPasswordResetToken can find
 * and hard-delete the previous token before minting a new one. */
function passwordResetIndexKey(userId: string): string {
  return `pwreset:user:${userId}`;
}

/** Creates and stores a fresh password-reset token, returning the plaintext
 * token (only ever placed in an email link). DEC-949 (wave 27 amendment):
 * unlike claim.ts's createClaimToken, which supersedes the prior grant with
 * a bounded grace window, this HARD-DELETES the prior token's record before
 * minting the new one — a reset request is self-service and trivially
 * repeatable, so an older live link is pure attack surface, not a hedge
 * against a failed batch send. Only the hash is ever stored; plaintext
 * exists nowhere but the email. */
export async function createPasswordResetToken(
  kv: KVStore,
  record: PasswordResetRecord,
): Promise<string> {
  const indexKey = passwordResetIndexKey(record.userId);
  const priorHash = await kv.get(indexKey);
  if (priorHash) {
    await kv.delete(passwordResetKvKey(priorHash));
  }

  const token = newSessionToken();
  const hash = await hashToken(token);
  await kv.put(passwordResetKvKey(hash), JSON.stringify(record), {
    expirationTtl: PASSWORD_RESET_TTL_SECONDS,
  });
  await kv.put(indexKey, hash, { expirationTtl: PASSWORD_RESET_TTL_SECONDS });
  return token;
}

/** Reads a password-reset record without consuming it (used to render the
 * GET form before the user submits a new password). */
export async function peekPasswordResetToken(
  kv: KVStore,
  token: string,
): Promise<PasswordResetRecord | null> {
  const hash = await hashToken(token);
  const raw = await kv.get(passwordResetKvKey(hash));
  if (!raw) return null;
  return JSON.parse(raw) as PasswordResetRecord;
}

/** Reads and deletes the password-reset record (single use). DEC-949: also
 * deletes the per-user index when it still points at the hash being
 * consumed, so a stale index never resurrects a dead token. */
export async function consumePasswordResetToken(
  kv: KVStore,
  token: string,
): Promise<PasswordResetRecord | null> {
  const hash = await hashToken(token);
  const key = passwordResetKvKey(hash);
  const raw = await kv.get(key);
  if (!raw) return null;
  const record = JSON.parse(raw) as PasswordResetRecord;
  await kv.delete(key);
  const indexKey = passwordResetIndexKey(record.userId);
  const indexedHash = await kv.get(indexKey);
  if (indexedHash === hash) {
    await kv.delete(indexKey);
  }
  return record;
}

/** Revokes a user's outstanding reset token, if any. DEC-949: called after a
 * successful password change through any path (/reset/:token,
 * /account/password, /claim/:token) so a lost-credential request can't be
 * replayed once the credential has been recovered another way. */
export async function revokePasswordResetTokenForUser(
  kv: KVStore,
  userId: string,
): Promise<void> {
  const indexKey = passwordResetIndexKey(userId);
  const hash = await kv.get(indexKey);
  if (!hash) return;
  await kv.delete(passwordResetKvKey(hash));
  await kv.delete(indexKey);
}
