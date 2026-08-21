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

/** DEC-936 (wave-22 amendment): the stage-1 (intra-batch) key — (lower-cased, trimmed email,
 * exact rendered subject, attachmentKey). Stage 1 alone grows an
 * attachmentKey term beyond dedupeKey's (email, subject) pair: two rendered
 * rows for one contact can share an identical subject+body (no
 * PER_SUBMISSION_MERGE_VARS token spent) while still attaching two DIFFERENT
 * per-submission .ics invites, and stage 1 must not collapse them.  Stage 2
 * (already_sent_recently) stays on plain dedupeKey — email_log records no
 * attachment identity, so the cross-call window can only honestly be judged
 * at the granularity the store keeps. */
export function intraBatchKey(toEmail: string, subject: string, attachmentKey: string): string {
  return JSON.stringify([toEmail.trim().toLowerCase(), subject, attachmentKey]);
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

/** DEC-936 (wave-21 amendment): expandRecipients' contact-collapse runs
 * UPSTREAM of planComposeSends, so the rows it withholds never reach either
 * dedupe stage and would otherwise vanish from the response entirely — a
 * suppression the organizer cannot see is indistinguishable from a lost
 * email. This is the ONE place that turns a withheld row into the same
 * ComposeDedupeSkip shape the planner emits: the same 'duplicate_in_batch'
 * reason literal (it IS an intra-batch collapse, just one stage earlier) and
 * no `retryAtIso` (there is no window to wait out). Both /compose/preview and
 * /compose/send call it, so the plan and the send can never disagree about
 * who was held back. */
export function collapsedRecipientSkips(
  withheld: readonly { email: string; name: string; submissionId: string }[],
): ComposeDedupeSkip[] {
  return withheld.map((r) => ({
    email: r.email,
    name: r.name,
    submissionId: r.submissionId,
    reason: "duplicate_in_batch",
  }));
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
  T extends { email: string; name: string; subject: string; submissionId: string; attachmentKey?: string },
>(
  rendered: readonly T[],
  recentlySent: ReadonlyMap<string, number>,
): { toSend: T[]; skipped: ComposeDedupeSkip[] } {
  const skipped: ComposeDedupeSkip[] = [];
  const seenInBatch = new Set<string>();
  const afterIntraBatch: T[] = [];
  for (const r of rendered) {
    // DEC-936 (wave-22 amendment): stage 1 keys on attachment identity too — see intraBatchKey.
    // `attachmentKey` defaults to "" for a caller that never sets it (e.g. a
    // non-ics compose), which reduces this to plain dedupeKey(email,subject)
    // behaviour, unchanged from before this amendment.
    const key = intraBatchKey(r.email, r.subject, r.attachmentKey ?? "");
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
