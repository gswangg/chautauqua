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

/** A recipient the dedupe planner held back, named individually (never a
 * bare count) — mirrors app/src/pages/comms/types.ts's
 * ComposeSkippedRecipient, which is the wire shape this is serialized as. */
export interface ComposeDedupeSkip {
  email: string;
  name: string;
  submissionId: string;
  // 'duplicate_in_batch' is the intra-batch stage (stage 1): two renders of
  // the same (email, subject) inside ONE call. No retryAtIso — there is no
  // window to wait out, the second occurrence is simply not resent.
  reason: "already_sent_recently" | "duplicate_in_batch";
  retryAtIso?: string;
}

/** wave-60 amendment (DEC-238, P1 cluster 4): the two-stage dedupe extracted
 * from src/routes/comms/send.ts into a pure planner so
 * src/routes/comms/preview.ts can run the EXACT SAME decision before any
 * mail is sent — a preview and its matching send must never disagree about
 * who gets skipped and why. Same key function, same stage order, same
 * reason literals as the send.ts logic this replaces:
 *
 * Stage 1 (intra-batch) runs FIRST — before recentlySent is even consulted
 * — so two renders that collapse into "duplicate_in_batch" are never also
 * checked against the window. Stage 2 (already_sent_recently) checks each
 * stage-1 survivor against `recentlySent`, a caller-supplied
 * dedupeKey(email, subject) -> last-sent-at-ms snapshot (loaded once, so a
 * multi-recipient batch is judged against one consistent read of
 * email_log, not interleaved with this call's own sends). */
export function planComposeSends<
  T extends { email: string; name: string; subject: string; submissionId: string },
>(
  rendered: readonly T[],
  recentlySent: ReadonlyMap<string, number>,
): { toSend: T[]; skipped: ComposeDedupeSkip[] } {
  const skipped: ComposeDedupeSkip[] = [];
  const seenInBatch = new Set<string>();
  const afterIntraBatch: T[] = [];
  for (const r of rendered) {
    const key = dedupeKey(r.email, r.subject);
    if (seenInBatch.has(key)) {
      skipped.push({ email: r.email, name: r.name, submissionId: r.submissionId, reason: "duplicate_in_batch" });
      continue;
    }
    seenInBatch.add(key);
    afterIntraBatch.push(r);
  }
  const toSend: T[] = [];
  for (const r of afterIntraBatch) {
    const lastSentAt = recentlySent.get(dedupeKey(r.email, r.subject));
    if (lastSentAt !== undefined) {
      skipped.push({
        email: r.email,
        name: r.name,
        submissionId: r.submissionId,
        reason: "already_sent_recently",
        retryAtIso: new Date(retryAtMs(lastSentAt)).toISOString(),
      });
      continue;
    }
    toSend.push(r);
  }
  return { toSend, skipped };
}
