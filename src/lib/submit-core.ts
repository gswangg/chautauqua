// Pure logic backing the public CFP submit flow (src/routes/public/submit.tsx,
// src/server/repo/submit.ts): closed-date gate (CFP-04), track-choice
// validation, seq-ref formatting (DEC-003), and the naive per-IP rate
// limiter (DEC-014 note: 10 submissions/hour). Web APIs + a plain KV
// interface only (DEC-002) — no node:/cloudflare/drizzle imports.

import { formatRef } from "../domain/ids";
import type { KVStore } from "./draft";

/** CFP-04: past form.close_date rejects new submissions. A null/undefined
 * close date means the form never closes. */
export function isFormClosed(closeDate: number | null | undefined, now: number): boolean {
  if (closeDate === null || closeDate === undefined) return false;
  return now > closeDate;
}

export type TrackChoiceResult = { ok: true } | { ok: false; error: string };

/** At least one track must be chosen, and only from the set actually
 * offered by the form (DEC-015 form.tracks_json / all event tracks). */
export function validateTrackChoice(
  selectedTrackIds: string[],
  availableTrackIds: string[],
): TrackChoiceResult {
  if (selectedTrackIds.length === 0) {
    return { ok: false, error: "Select at least one track." };
  }
  const available = new Set(availableTrackIds);
  const hasUnknown = selectedTrackIds.some((id) => !available.has(id));
  if (hasUnknown) {
    return { ok: false, error: "Selected track is not offered by this form." };
  }
  return { ok: true };
}

/** Resolves the offered track ids for a form: form.tracks_json (parsed)
 * when present and non-empty, else every event track id (DEC-015). */
export function resolveOfferedTrackIds(
  tracksJson: string | null | undefined,
  eventTrackIds: string[],
): string[] {
  if (!tracksJson) return eventTrackIds;
  const parsed = JSON.parse(tracksJson) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) return eventTrackIds;
  return parsed.filter((v): v is string => typeof v === "string");
}

/** DEC-003 display ref for the next submission in an event. Seq allocation
 * itself is INSERT-select COALESCE(MAX(seq),0)+1 (repo layer, needs the DB);
 * this formats the ref from that allocated seq. */
export function nextSeqRef(recordPrefix: string, currentMaxSeq: number): string {
  return formatRef(recordPrefix, currentMaxSeq + 1);
}

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX = 10;

export function rateLimitKey(ip: string, windowStartMs: number): string {
  return `ratelimit:submit:${ip}:${windowStartMs}`;
}

export interface RateLimitResult {
  ok: boolean;
  count: number;
}

/** Naive per-IP KV counter: 10 submissions/hour, fixed 1-hour windows keyed
 * by window start. Fails loudly by rejecting once the cap is hit — never
 * silently drops the count or allows overflow. */
export async function checkAndIncrementRateLimit(
  kv: KVStore,
  ip: string,
  now: number,
  windowSeconds: number = RATE_LIMIT_WINDOW_SECONDS,
  max: number = RATE_LIMIT_MAX,
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = rateLimitKey(ip, windowStart);
  const raw = await kv.get(key);
  const count = raw ? Number(raw) : 0;
  if (count >= max) {
    return { ok: false, count };
  }
  await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return { ok: true, count: count + 1 };
}
