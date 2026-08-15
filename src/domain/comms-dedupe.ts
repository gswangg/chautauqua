// DEC-238 wave-3 amendment: compose/send's one-hour message dedupe window.
// Pure domain module (DEC-002: no node:/cloudflare imports) — the route and
// repo layers import these constants/functions instead of hand-rolling the
// window math, mirroring src/server/repo/tasks/reminders.ts's
// MANUAL_DEDUPE_WINDOW_MS pattern for the highest-consequence fan-out.

/** DEC-238 amendment: a compose/send message to the same (event, email,
 * subject) is refused for one hour after the prior successful send. */
export const COMPOSE_DEDUPE_WINDOW_MS = 60 * 60 * 1000;

/** The earliest sent_at (inclusive) that still counts as "recently sent" for
 * a dedupe check performed at `nowMs`. */
export function dedupeCutoff(nowMs: number): number {
  return nowMs - COMPOSE_DEDUPE_WINDOW_MS;
}

/** The instant a skipped recipient becomes eligible again, given the prior
 * send's sent_at (in ms). */
export function retryAtMs(lastSentAtMs: number): number {
  return lastSentAtMs + COMPOSE_DEDUPE_WINDOW_MS;
}

/** The dedupe key: (lower-cased, trimmed email, exact rendered subject) —
 * keyed on the MESSAGE, not templateId, per the DEC-238 wave-3 ruling. Event
 * scoping is applied by the caller (the reader is already scoped to one
 * eventId), not folded into this key. JSON-encoded so no separator
 * collision is possible between an email and a subject that happens to
 * contain the separator character. */
export function dedupeKey(toEmail: string, subject: string): string {
  return JSON.stringify([toEmail.trim().toLowerCase(), subject]);
}
