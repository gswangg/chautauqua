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
 * DEC-238 wave-3 ruling (body term added by the DEC-936 wave-17 amendment,
 * see below). Event scoping is applied by the caller (the reader is already
 * scoped to one eventId), not folded into this key. JSON-encoded so no
 * separator collision is possible between an email/subject/body that
 * happens to contain the separator character.
 *
 * DEC-936 (wave-17 amendment): a static subject that spends a
 * PER_SUBMISSION_MERGE_VARS token (talk_title/feedback/session_time, see
 * src/domain/compose.ts) only in the BODY renders a DIFFERENT message per
 * submission while keeping an IDENTICAL subject — email_log.body_text IS
 * written on every send (src/routes/comms/send.ts), so the store can
 * honestly judge the cross-call window at message granularity, not just
 * (email, subject). Without the body term, stage 2 would treat two
 * genuinely different messages (same subject, different body) as the same
 * "already sent" message and refuse the second one.
 *
 * DEC-397 (this wave's amendment): the body term is normalized through
 * normalizeClaimLinks below before it is hashed — see that function for
 * why. The normalization lives INSIDE this key function on purpose: both
 * sides of every cross-call comparison (a caller's wanted key and
 * src/server/repo/comms.ts's loadRecentlySent row key) already reach
 * identity through here, so neither side can re-derive the rule
 * independently and drift. */
export function dedupeKey(toEmail: string, subject: string, body: string): string {
  return JSON.stringify([toEmail.trim().toLowerCase(), subject, normalizeClaimLinks(body)]);
}

/** DEC-397 (this wave's amendment): what any `/claim/<token>` URL path
 * collapses to inside a dedupe key. It is NEVER rendered into an email and
 * never stored — it exists only inside the key. */
export const DEDUPE_CLAIM_TOKEN_PLACEHOLDER = "<claim-token>";

/** The claim-token URL path shape both sides of a dedupe comparison can
 * produce. `newClaimToken()` (src/auth/claim.ts) is base64url, charset
 * `[A-Za-z0-9_-]`, and PREVIEW_CLAIM_TOKEN ("example-one-time-link",
 * src/domain/compose.ts) is drawn from the same class, so both collapse to
 * the identical placeholder. */
const CLAIM_URL_PATH_RE = /\/claim\/[A-Za-z0-9_-]+/g;

/** DEC-397 (this wave's amendment): A MINT IS THE LAST THING A SEND DOES,
 * so a mint is DOWNSTREAM of message identity and identity must not read
 * it. POST /api/v1/contacts/bulk-email computes its dedupe plan on the
 * UNMINTED preflight render (portal_link resolves to the fixed
 * PREVIEW_CLAIM_TOKEN placeholder) and only then overwrites vars.portal_link
 * with a freshly minted per-recipient token via applyMintedPortalLinks — so
 * email_log.body_text stores `<origin>/claim/<real token>` while the NEXT
 * call keys on `<origin>/claim/example-one-time-link`. Without this
 * normalization the two bodies can never be byte-equal for any template
 * spending `{portal_link}`, and the one-hour cross-call window is silently
 * dead for every such message.
 *
 * Normalizing the KEY rather than the stored row is what keeps email_log
 * honest: the log keeps the real shipped body, and log fidelity is never
 * traded for dedupe stability. Dropping the body term instead would
 * re-open exactly the hole DEC-936's wave-17 amendment closed. */
export function normalizeClaimLinks(body: string): string {
  return body.replace(CLAIM_URL_PATH_RE, `/claim/${DEDUPE_CLAIM_TOKEN_PLACEHOLDER}`);
}

/** DEC-936 (wave-22 amendment, widened wave-17): the stage-1 (intra-batch)
 * key — (lower-cased, trimmed email, exact rendered subject, exact rendered
 * body, attachmentKey). Stage 1 grows an attachmentKey term beyond
 * dedupeKey's (email, subject, body) triple: two rendered rows for one
 * contact can share an identical subject+body (no PER_SUBMISSION_MERGE_VARS
 * token spent at all, or spent only via an attachment) while still
 * attaching two DIFFERENT per-submission .ics invites, and stage 1 must not
 * collapse them.
 *
 * DEC-936 (wave-17 amendment): the body term itself is what stops stage 1
 * from undoing expandRecipients' non-collapse decision — a composed
 * message that keeps a static subject and spends its per-submission merge
 * vars in the BODY (with no .ics attachment, attachmentKey === "") used to
 * collapse to one row here even though expandRecipients had just decided
 * to keep all N of a speaker's submissions distinct. Stage 2
 * (already_sent_recently) now keys on dedupeKey(email, subject, body) too
 * — email_log.body_text IS written on every send, so this is no longer
 * true only of stage 1. */
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
  T extends { email: string; name: string; subject: string; text: string; submissionId: string; attachmentKey?: string },
>(
  rendered: readonly T[],
  recentlySent: ReadonlyMap<string, number>,
): { toSend: T[]; skipped: ComposeDedupeSkip[] } {
  const skipped: ComposeDedupeSkip[] = [];
  const seenInBatch = new Set<string>();
  const afterIntraBatch: T[] = [];
  for (const r of rendered) {
    // DEC-936 (wave-22 amendment, widened wave-17): stage 1 keys on the
    // rendered body and attachment identity too — see intraBatchKey.
    // `attachmentKey` defaults to "" for a caller that never sets it (e.g. a
    // non-ics compose), which reduces this to plain dedupeKey(email,subject,body)
    // behaviour.
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
