// Claim-token flow, per DEC-014: on submission creation, store
// claim:<sha256(token)> -> { contactId, eventId } in KV with a 30-day TTL;
// GET /claim/:token shows a create-password form, POST creates the speaker
// user and deletes the KV key. Pure Web Crypto + a plain KV interface only
// (DEC-002) — no node:/cloudflare imports, so this is fully vitest-testable
// against an in-memory fake.

export const CLAIM_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface ClaimRecord {
  contactId: string;
  eventId: string;
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

export function newClaimToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

/** Creates and stores a fresh claim token, returning the plaintext token
 * (only ever placed in an email link / on-screen confirmation URL). */
export async function createClaimToken(kv: KVStore, record: ClaimRecord): Promise<string> {
  const token = newClaimToken();
  const hash = await hashClaimToken(token);
  await kv.put(claimKvKey(hash), JSON.stringify(record), { expirationTtl: CLAIM_TTL_SECONDS });
  return token;
}

/** Reads a claim record without consuming it (used to render the GET form). */
export async function readClaimToken(kv: KVStore, token: string): Promise<ClaimRecord | null> {
  const hash = await hashClaimToken(token);
  const raw = await kv.get(claimKvKey(hash));
  if (!raw) return null;
  return JSON.parse(raw) as ClaimRecord;
}

/** Reads and deletes the claim record (used on successful POST). */
export async function consumeClaimToken(kv: KVStore, token: string): Promise<ClaimRecord | null> {
  const hash = await hashClaimToken(token);
  const key = claimKvKey(hash);
  const raw = await kv.get(key);
  if (!raw) return null;
  await kv.delete(key);
  return JSON.parse(raw) as ClaimRecord;
}
