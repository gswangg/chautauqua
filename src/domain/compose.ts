// Deliberate-notify compose pipeline (DEC-019, DEC-006): pure core, no
// node:/cloudflare imports (DEC-002). Recipients expand to one row per
// (contactId, submissionId); the 100-recipient cap and the atomic
// preflight-before-send rule both live here so the route handler stays thin.

import { renderTemplate, MergeFieldError } from "../mail/render";

/** DEC-019: more than 100 recipients rejects the whole batch as 'invalid'. */
export const MAX_COMPOSE_RECIPIENTS = 100;

/** DEC-019: the stated value for zero reviewer comments (not a silent blank). */
export const NO_FEEDBACK_TEXT = "No reviewer feedback was recorded.";

/** DEC-397: preview never mints credentials. When a compose/bulk-email
 * preview would otherwise mint a claim token for a userless recipient, it
 * renders this fixed placeholder token instead — zero KV writes. */
export const PREVIEW_CLAIM_TOKEN = "example-one-time-link";

export interface ComposeParticipant {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ComposeSubmission {
  id: string;
  title: string;
  participants: ComposeParticipant[];
}

export interface ComposeRecipient {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
}

export type ExpandRecipientsResult =
  | { ok: true; recipients: ComposeRecipient[] }
  | { ok: false; error: "invalid"; message: string };

/**
 * Expands the selected submissions into one recipient row per
 * (contactId, submissionId) — every participant on every selected
 * submission. Rejects the whole batch as 'invalid' when the expanded count
 * exceeds MAX_COMPOSE_RECIPIENTS (DEC-019: the producer must narrow the
 * batch, no silent truncation).
 */
export function expandRecipients(submissions: ComposeSubmission[]): ExpandRecipientsResult {
  const recipients: ComposeRecipient[] = [];
  for (const submission of submissions) {
    for (const participant of submission.participants) {
      recipients.push({
        contactId: participant.contactId,
        submissionId: submission.id,
        email: participant.email,
        name: `${participant.firstName} ${participant.lastName}`.trim(),
      });
    }
  }
  if (recipients.length > MAX_COMPOSE_RECIPIENTS) {
    return {
      ok: false,
      error: "invalid",
      message: `${recipients.length} recipients exceeds the ${MAX_COMPOSE_RECIPIENTS}-recipient cap; narrow the batch.`,
    };
  }
  return { ok: true, recipients };
}

/**
 * Formats a submission's evaluation comments as an anonymized bullet list
 * ('Reviewer 1: ...', 'Reviewer 2: ...' in the given order — callers control
 * ordering, e.g. by submission time, never by exposing reviewer identity).
 * Blank/whitespace-only comments are dropped; zero remaining comments
 * renders NO_FEEDBACK_TEXT rather than an empty string.
 */
export function formatFeedback(comments: string[]): string {
  const nonEmpty = comments.map((c) => c.trim()).filter((c) => c.length > 0);
  if (nonEmpty.length === 0) return NO_FEEDBACK_TEXT;
  return nonEmpty.map((c, i) => `Reviewer ${i + 1}: ${c}`).join("\n");
}

export interface MergeVarsInput {
  speakerName: string;
  talkTitle: string;
  eventName: string;
  portalLink: string;
  /** Raw (non-anonymized-yet) evaluation comments for this recipient's
   * submission. DEC-682: `null` means feedback was NOT attached to this
   * compose (the "include reviewer feedback" toggle is off, or no plan+round
   * scope was given) — the `feedback` merge key is omitted entirely in that
   * case, so a template referencing {feedback} fails preflightRender loudly
   * instead of silently inventing/leaking text. An empty array means
   * feedback WAS attached but this recipient's submission has zero
   * qualifying comments — that still renders NO_FEEDBACK_TEXT. */
  feedbackComments: string[] | null;
}

/** Builds the DEC-006 merge vars for one recipient (speaker_name, talk_title,
 * event_name, portal_link, feedback). Does not include due_date/task_list —
 * those belong to the reminders pipeline (DEC-023), not compose. DEC-682:
 * the `feedback` key is omitted entirely when feedbackComments is null. */
export function buildMergeVars(input: MergeVarsInput): Record<string, string> {
  const vars: Record<string, string> = {
    speaker_name: input.speakerName,
    talk_title: input.talkTitle,
    event_name: input.eventName,
    portal_link: input.portalLink,
  };
  if (input.feedbackComments !== null) {
    vars.feedback = formatFeedback(input.feedbackComments);
  }
  return vars;
}

export interface RenderTarget {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
  vars: Record<string, string>;
}

export interface RenderedRecipientEmail {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
  subject: string;
  text: string;
}

export interface PreflightMissingField {
  contactId: string;
  submissionId: string;
  field: string;
}

export type PreflightResult =
  | { ok: true; rendered: RenderedRecipientEmail[] }
  | { ok: false; error: "invalid"; missing: PreflightMissingField[] };

/**
 * Atomic preflight (DEC-019): renders subject + body for every recipient
 * before any send is attempted. If even one recipient is missing a merge
 * field, the whole batch is rejected 'invalid' with the full list of
 * missing fields — no half-sent batches, no silent per-recipient skips.
 */
export function preflightRender(
  targets: RenderTarget[],
  subjectTemplate: string,
  bodyTemplate: string,
): PreflightResult {
  const missing: PreflightMissingField[] = [];
  const rendered: RenderedRecipientEmail[] = [];

  for (const target of targets) {
    let subject: string | undefined;
    let text: string | undefined;

    try {
      subject = renderTemplate(subjectTemplate, target.vars);
    } catch (err) {
      if (!(err instanceof MergeFieldError)) throw err;
      missing.push({ contactId: target.contactId, submissionId: target.submissionId, field: err.field });
    }
    try {
      text = renderTemplate(bodyTemplate, target.vars);
    } catch (err) {
      if (!(err instanceof MergeFieldError)) throw err;
      missing.push({ contactId: target.contactId, submissionId: target.submissionId, field: err.field });
    }

    if (subject !== undefined && text !== undefined) {
      rendered.push({
        contactId: target.contactId,
        submissionId: target.submissionId,
        email: target.email,
        name: target.name,
        subject,
        text,
      });
    }
  }

  if (missing.length > 0) {
    return { ok: false, error: "invalid", missing };
  }
  return { ok: true, rendered };
}
