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

/** The dedupe key: (lower-cased, trimmed email, exact rendered subject,
 * exact rendered body) — keyed on the MESSAGE, not templateId, per the
 * DEC-238 wave-3 ruling. DEC-936 (wave-17 amendment): the body term is
 * required because `email_log.body_text` is written on every send
 * (src/db/schema/email.ts, src/routes/comms/send.ts), so stage 2's
 * cross-call window CAN be judged at message granularity, not just
 * (email, subject) — and a static subject with per-submission content in
 * the body would otherwise collapse two genuinely different letters into
 * one "already sent" verdict. Event scoping is applied by the caller (the
 * reader is already scoped to one eventId), not folded into this key.
 * JSON-encoded so no separator collision is possible between an email,
 * subject or body that happens to contain the separator character.
 * `body` defaults to "" for callers whose composed message has no
 * per-submission body content to distinguish (e.g. plans-progress.ts's
 * constant-text review reminder) — this is additive, not a narrowing: a
 * caller that never passes `body` gets exactly its pre-wave-17 (email,
 * subject) behaviour, unchanged. */
export function dedupeKey(toEmail: string, subject: string, body: string = ""): string {
  return JSON.stringify([toEmail.trim().toLowerCase(), subject, body]);
}

/** DEC-936 (wave-22, wave-17 amendments): the stage-1 (intra-batch) key —
 * (lower-cased, trimmed email, exact rendered subject, exact rendered body,
 * attachmentKey). Stage 1 grows an attachmentKey term beyond dedupeKey's
 * (email, subject, body) triple: two rendered rows for one contact can
 * share identical subject+body (no PER_SUBMISSION_MERGE_VARS token spent)
 * while still attaching two DIFFERENT per-submission .ics invites, and
 * stage 1 must not collapse them. The body term (wave-17) is required for
 * the opposite case: a STATIC subject with a per-submission token (e.g.
 * {talk_title}) spent only in the body, and no attachment, must NOT
 * collapse — the rendered bodies differ even though subject and
 * attachmentKey do not. Stage 2 (already_sent_recently) uses plain
 * dedupeKey (email, subject, body) — email_log records no attachment
 * identity, so the cross-call window can only honestly be judged at the
 * granularity the store keeps, which is subject+body but not attachment. */
export function intraBatchKey(toEmail: string, subject: string, body: string, attachmentKey: string): string {
  return JSON.stringify([toEmail.trim().toLowerCase(), subject, body, attachmentKey]);
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
  T extends {
    email: string;
    name: string;
    subject: string;
    text: string;
    submissionId: string;
    attachmentKey?: string;
  },
>(
  rendered: readonly T[],
  recentlySent: ReadonlyMap<string, number>,
): { toSend: T[]; skipped: ComposeDedupeSkip[] } {
  const skipped: ComposeDedupeSkip[] = [];
  const seenInBatch = new Set<string>();
  const afterIntraBatch: T[] = [];
  for (const r of rendered) {
    // DEC-936 (wave-22, wave-17 amendments): stage 1 keys on attachment
    // identity AND rendered body — see intraBatchKey. `attachmentKey`
    // defaults to "" for a caller that never sets it (e.g. a non-ics
    // compose).
    const key = intraBatchKey(r.email, r.subject, r.text, r.attachmentKey ?? "");
    if (seenInBatch.has(key)) {
      skipped.push({ email: r.email, name: r.name, submissionId: r.submissionId, reason: "duplicate_in_batch" });
      continue;
    }
    seenInBatch.add(key);
    afterIntraBatch.push(r);
  }
  const toSend: T[] = [];
  for (const r of afterIntraBatch) {
    const lastSentAt = recentlySent.get(dedupeKey(r.email, r.subject, r.text));
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
