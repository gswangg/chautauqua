// Draft save/resume flow, per DEC-014: 'Save draft' on /submit/:eventSlug
// persists { formId, answers, savedAt } as JSON in KV under key
// draft:<sha256(token)> with 30-day TTL; the random 32-byte b64url token
// lives in cookie chq_draft_<formId> (Path=/submit). Drafts never create
// submission rows. Pure Web Crypto + a plain KV interface only (DEC-002) —
// no node:/cloudflare imports, fully vitest-testable against an in-memory
// fake (mirrors src/auth/claim.ts).

import type { AnswerMap } from "../forms/types";

export const DRAFT_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface DraftRecord {
  formId: string;
  answers: AnswerMap;
  savedAt: number;
  trackIds: string[];
}

/** DEC-014 amendment (wave 10): KV holds arbitrary external bytes -- a
 * record that fails this shape check is treated exactly as a missing
 * record by every caller, never as a half-valid object. */
export function parseDraftRecord(raw: string): DraftRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.formId !== "string") return null;
  if (typeof record.savedAt !== "number" || !Number.isFinite(record.savedAt)) return null;
  if (typeof record.answers !== "object" || record.answers === null || Array.isArray(record.answers)) return null;
  for (const value of Object.values(record.answers as Record<string, unknown>)) {
    if (typeof value !== "string" && typeof value !== "boolean") return null;
  }
  if (!Array.isArray(record.trackIds) || record.trackIds.some((id) => typeof id !== "string")) return null;
  return {
    formId: record.formId,
    answers: record.answers as AnswerMap,
    savedAt: record.savedAt,
    trackIds: record.trackIds as string[],
  };
}

/** Structural subset of Cloudflare's KVNamespace — small enough to fake. */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export function draftCookieName(formId: string): string {
  return `chq_draft_${formId}`;
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

export async function hashDraftToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function draftKvKey(tokenHash: string): string {
  return `draft:${tokenHash}`;
}

export function newDraftToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

/** Creates and stores a fresh draft token, returning the plaintext token
 * (only ever placed in the chq_draft_<formId> cookie). */
export async function saveDraft(
  kv: KVStore,
  token: string,
  record: DraftRecord,
): Promise<void> {
  const hash = await hashDraftToken(token);
  await kv.put(draftKvKey(hash), JSON.stringify(record), { expirationTtl: DRAFT_TTL_SECONDS });
}

/** Reads a draft record without consuming it (resume banner + prefill). */
export async function readDraft(kv: KVStore, token: string): Promise<DraftRecord | null> {
  const hash = await hashDraftToken(token);
  const raw = await kv.get(draftKvKey(hash));
  if (!raw) return null;
  return parseDraftRecord(raw);
}

/** Deletes the draft record (called on successful submit). */
export async function deleteDraft(kv: KVStore, token: string): Promise<void> {
  const hash = await hashDraftToken(token);
  await kv.delete(draftKvKey(hash));
}
