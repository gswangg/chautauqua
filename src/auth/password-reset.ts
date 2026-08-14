// Password-reset token flow, per DEC-014 (wave 25 amendment). Modelled on
// src/auth/claim.ts (same pure Web Crypto + KVStore shape, DEC-002 — no
// node:/cloudflare imports, fully vitest-testable against an in-memory
// fake), but DELIBERATELY different where the threat model differs:
//
//   claim.ts:   an organizer mints the link for someone else. A batch send
//               can fail AFTER the mint, so a new grant SUPERSEDES the
//               prior one with a 48h grace re-put rather than deleting it
//               outright — losing the only working link would strand the
//               speaker with no way to ask again themselves.
//
//   this file:  the account owner requests their own link, and can
//               trivially ask again if a send fails or they lose the
//               email. So a fresh mint HARD-DELETES the prior record
//               before minting the new one — newest-only, no grace
//               window. RESET_TTL_SECONDS is 1 hour (not 30 days): a
//               reset asserts "I lost my credential right now", not
//               "onboard me whenever I get around to it".
//
// Only hashes are ever stored; the plaintext token exists nowhere but the
// one email it's minted for.

export const RESET_TTL_SECONDS = 60 * 60;

// Re-export the structural KVStore interface claim.ts already defines
// (DEC-002: one small fake-able shape, not a second copy of the same
// three methods).
export type { KVStore } from "./claim";
import type { KVStore } from "./claim";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function resetKvKey(tokenHash: string): string {
  return `pwreset:${tokenHash}`;
}

/** Names the ONE currently-live reset grant for this user — a fresh mint
 * hard-deletes whatever this index currently points at (newest-only, no
 * supersede grace; see the module docstring for the contrast with
 * claim.ts's claimIndexKey). */
export function resetIndexKey(userId: string): string {
  return `pwreset-for:${userId}`;
}

export function newResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

export async function hashResetToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

/** Mints and stores a fresh reset token for `userId`, returning the
 * plaintext token (only ever placed in the emailed reset link). Newest-
 * only: if a live grant already exists for this user (per
 * resetIndexKey), it is HARD-DELETED first — a reset is requested by the
 * person themselves, who can trivially ask again, so there is no reason
 * to keep a stale link alive. */
export async function createResetToken(kv: KVStore, userId: string): Promise<string> {
  const indexKey = resetIndexKey(userId);
  const priorHash = await kv.get(indexKey);
  if (priorHash) {
    await kv.delete(resetKvKey(priorHash));
  }

  const token = newResetToken();
  const hash = await hashResetToken(token);
  await kv.put(resetKvKey(hash), userId, { expirationTtl: RESET_TTL_SECONDS });
  await kv.put(indexKey, hash, { expirationTtl: RESET_TTL_SECONDS });
  return token;
}

/** Reads a reset grant without consuming it (used to render the GET /reset/:token form). */
export async function readResetToken(kv: KVStore, token: string): Promise<{ userId: string } | null> {
  const hash = await hashResetToken(token);
  const userId = await kv.get(resetKvKey(hash));
  if (!userId) return null;
  return { userId };
}

/** Reads and deletes the reset grant (used on a successful POST). Also
 * deletes the userId's index when it still points at the hash being
 * consumed, so a stale index never resurrects a dead grant. Consuming
 * FIRST (before any password/session mutation) means a replayed POST
 * against an already-used token always lands on the 410 "no longer
 * valid" card rather than silently re-running the change. */
export async function consumeResetToken(kv: KVStore, token: string): Promise<{ userId: string } | null> {
  const hash = await hashResetToken(token);
  const key = resetKvKey(hash);
  const userId = await kv.get(key);
  if (!userId) return null;
  await kv.delete(key);
  const indexKey = resetIndexKey(userId);
  const indexedHash = await kv.get(indexKey);
  if (indexedHash === hash) {
    await kv.delete(indexKey);
  }
  return { userId };
}
