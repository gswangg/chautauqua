// Claim-token flow, per DEC-014: on submission creation, store
// claim:<sha256(token)> -> { contactId, eventId } in KV with a 30-day TTL;
// GET /claim/:token shows a create-password form, POST creates the speaker
// user and deletes the KV key. Pure Web Crypto + a plain KV interface only
// (DEC-002) — no node:/cloudflare imports, so this is fully vitest-testable
// against an in-memory fake.

import { DEC_949 } from "../decisions";

void DEC_949;

export const CLAIM_TTL_SECONDS = 30 * 24 * 60 * 60;

/** DEC-949 (wave 18 amendment): a mint SUPERSEDES the prior grant, it does
 * not instantly revoke it — the superseded record is re-put with this
 * shorter TTL so a batch send that fails after minting doesn't permanently
 * strand the speaker with no working link. */
export const SUPERSEDED_GRACE_SECONDS = 48 * 60 * 60;

export interface ClaimRecord {
  contactId: string;
  eventId: string;
}

/** DEC-014 amendment (wave 10): KV holds arbitrary external bytes -- a
 * record that fails this shape check is treated exactly as a missing
 * token by every caller, never as a half-record with an undefined
 * contactId reaching user creation. */
export function parseClaimRecord(raw: string): ClaimRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.contactId !== "string" || !record.contactId) return null;
  if (typeof record.eventId !== "string" || !record.eventId) return null;
  return { contactId: record.contactId, eventId: record.eventId };
}

/** Structural subset of Cloudflare's KVNamespace — small enough to fake. */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

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

export async function hashClaimToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function claimKvKey(tokenHash: string): string {
  return `claim:${tokenHash}`;
}

/** DEC-949: a grant is SINGLE-ACTIVE per (contactId, eventId) — this index
 * key holds the hash of the currently-live token, so createClaimToken can
 * find and revoke the previous grant before minting a new one. */
export function claimIndexKey(contactId: string, eventId: string): string {
  return `claim-for:${contactId}:${eventId}`;
}

export function newClaimToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

/** Creates and stores a fresh claim token, returning the plaintext token
 * (only ever placed in an email link / on-screen confirmation URL).
 * DEC-949 (wave 18 amendment): a mint SUPERSEDES the prior grant for the
 * same (contactId, eventId) — it does not instantly revoke it. The newest
 * link is canonical (the index moves to its hash immediately), but the
 * prior grant's record is re-put with a bounded SUPERSEDED_GRACE_SECONDS
 * (48h) overlap rather than deleted, so a failed send (mint happens before
 * the best-effort per-recipient delivery loop) doesn't permanently strand
 * the speaker with no working link. Only a delivered link ever actually
 * revokes the one before it, by aging out. Only hashes are ever stored;
 * plaintext exists nowhere but the email. */
export async function createClaimToken(kv: KVStore, record: ClaimRecord): Promise<string> {
  const indexKey = claimIndexKey(record.contactId, record.eventId);
  const priorHash = await kv.get(indexKey);
  if (priorHash) {
    const priorKey = claimKvKey(priorHash);
    const priorRaw = await kv.get(priorKey);
    if (priorRaw !== null) {
      await kv.put(priorKey, priorRaw, { expirationTtl: SUPERSEDED_GRACE_SECONDS });
    }
  }

  const token = newClaimToken();
  const hash = await hashClaimToken(token);
  await kv.put(claimKvKey(hash), JSON.stringify(record), { expirationTtl: CLAIM_TTL_SECONDS });
  await kv.put(indexKey, hash, { expirationTtl: CLAIM_TTL_SECONDS });
  return token;
}

/** Reads a claim record without consuming it (used to render the GET form). */
export async function readClaimToken(kv: KVStore, token: string): Promise<ClaimRecord | null> {
  const hash = await hashClaimToken(token);
  const raw = await kv.get(claimKvKey(hash));
  if (!raw) return null;
  return parseClaimRecord(raw);
}

/** Reads and deletes the claim record (used on successful POST). DEC-949:
 * also deletes the (contactId, eventId) index when it still points at the
 * hash being consumed, so a stale index never resurrects a dead grant. */
export async function consumeClaimToken(kv: KVStore, token: string): Promise<ClaimRecord | null> {
  const hash = await hashClaimToken(token);
  const key = claimKvKey(hash);
  const raw = await kv.get(key);
  if (!raw) return null;
  const record = parseClaimRecord(raw);
  if (!record) {
    await kv.delete(key);
    return null;
  }
  await kv.delete(key);
  const indexKey = claimIndexKey(record.contactId, record.eventId);
  const indexedHash = await kv.get(indexKey);
  if (indexedHash === hash) {
    await kv.delete(indexKey);
  }
  return record;
}
