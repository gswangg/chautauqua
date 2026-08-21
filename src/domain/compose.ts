// Deliberate-notify compose pipeline (DEC-019, DEC-006): pure core, no
// node:/cloudflare imports (DEC-002). Recipients expand to one row per
// (contactId, submissionId); the 100-recipient cap and the atomic
// preflight-before-send rule both live here so the route handler stays thin.

import { renderTemplate, missingMergeFields } from "../mail/render";

/** DEC-019: more than 100 recipients rejects the whole batch as 'invalid'. */
export const MAX_COMPOSE_RECIPIENTS = 100;

/** DEC-019: the stated value for zero reviewer comments (not a silent blank). */
export const NO_FEEDBACK_TEXT = "No reviewer feedback was recorded.";

/** DEC-792/DEC-847: the stated value for a recipient with zero outstanding
 * tasks (not a silent blank), mirroring NO_FEEDBACK_TEXT's precedent. No
 * terminal period: {task_list} is substituted inline into the template's
 * own sentence, which owns its own punctuation (unlike NO_FEEDBACK_TEXT,
 * which stands alone as a block paragraph). */
export const NO_TASKS_TEXT = "No outstanding tasks";

/** DEC-792 (amendment, wave 45): the stated value for {task_due_date} when
 * the recipient has no outstanding task carrying a due date (not a silent
 * blank). {due_date} is a permanent alias resolved in src/mail/render.ts. */
export const NO_DUE_DATE_TEXT = "No due date";

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
  /** DEC-912: the submission's seq, combined with the event's recordPrefix
   * (via domain/ids.ts formatRef) at the route layer to produce the human
   * ref (e.g. 'DFC-014') every rendered recipient carries. */
  seq: number;
  participants: ComposeParticipant[];
}

export interface ComposeRecipient {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
}

export type ExpandRecipientsResult =
  | {
      ok: true;
      recipients: ComposeRecipient[];
      /**
       * DEC-936 (wave-21 amendment): the rows the contact-collapse WITHHELD —
       * every (contactId, submissionId) expansion after the first for a
       * contact, dropped because the composed text spends no per-submission
       * merge var. Empty whenever `perSubmissionVarsSpent` is true (nothing
       * collapses). Returned rather than discarded because "a contact-collapse
       * must NAME whom it collapsed": a suppression the organizer cannot see is
       * indistinguishable from a lost email, so both production call sites fold
       * these into the same `skipped` array the dedupe planner fills, with the
       * same `duplicate_in_batch` reason literal and no `retryAtIso`.
       */
      withheld: ComposeRecipient[];
    }
  | { ok: false; error: "invalid"; message: string };

/**
 * DEC-936 (wave-19 amendment): the merge-var tokens buildMergeVars sets from
 * SUBMISSION-scoped input rather than contact/global input — read straight
 * off buildMergeVars below: talk_title (submission.title), feedback
 * (submission-scoped comments), session_time (submission's schedule slot).
 * speaker_name/event_name/portal_link are per-person/global, and
 * task_list/task_due_date are per-CONTACT (grouped by contactId across ALL
 * of that contact's submissions in buildRenderTargets, so they don't vary by
 * which submission a collapsed row keeps) — none of those five belong here.
 *
 * DEC-912's `ref` field (the human-readable submission ref, e.g. 'DFC-014')
 * is ALSO submission-scoped and was part of the precedence dilemma DEC-936's
 * wave-19 amendment names, but it is never a {template} placeholder — it is
 * a structural field on RenderTarget/RenderedRecipientEmail set outside
 * `vars` (src/routes/comms/compose-core.ts), so renderTemplate would throw
 * MergeFieldError for a literal `{ref}` regardless of this set. It cannot be
 * a member of a token set scanned against composed TEXT, and a collapsed
 * row's `ref` is already covered by "keep the first occurrence" (below) —
 * not by a spend check.
 */
export const PER_SUBMISSION_MERGE_VARS: ReadonlySet<string> = new Set(["talk_title", "feedback", "session_time"]);

const PER_SUBMISSION_VAR_RE = /\{([a-zA-Z0-9_]+)\}/g;

/** DEC-936 (wave-19 amendment): true when the composed subject+body spends
 * at least one of PER_SUBMISSION_MERGE_VARS, i.e. the message text itself
 * differs meaningfully across a contact's submissions. Pure text scan —
 * doesn't resolve merge-field aliases (none of PER_SUBMISSION_MERGE_VARS has
 * one in src/mail/render.ts's MERGE_FIELD_ALIASES). */
export function spendsPerSubmissionVars(text: string): boolean {
  for (const match of text.matchAll(PER_SUBMISSION_VAR_RE)) {
    const name = match[1];
    if (name !== undefined && PER_SUBMISSION_MERGE_VARS.has(name)) return true;
  }
  return false;
}

/**
 * Expands the selected submissions into one recipient row per
 * (contactId, submissionId) — every participant on every selected
 * submission.
 *
 * DEC-936 (wave-19 amendment): when `opts.perSubmissionVarsSpent` is false
 * — the composed text spends none of PER_SUBMISSION_MERGE_VARS — the list
 * collapses to one row per contactId, keeping the FIRST occurrence in this
 * function's existing iteration order (submissions in input order, then
 * participants in input order — test/compose-order.test.ts pins that order
 * as deterministic). Defaults to `true` (no collapsing) so an existing
 * caller that doesn't pass `opts` keeps today's per-(contact, submission)
 * shape unchanged.
 *
 * DEC-936 (wave-21 amendment): every collapsed row is returned in `withheld`
 * rather than discarded, so the callers can name whom the collapse held back.
 *
 * Rejects the whole batch as 'invalid' when the FINAL (post-collapse) count
 * exceeds MAX_COMPOSE_RECIPIENTS (DEC-019: the producer must narrow the
 * batch, no silent truncation).
 */
export function expandRecipients(
  submissions: ComposeSubmission[],
  opts: { perSubmissionVarsSpent: boolean } = { perSubmissionVarsSpent: true },
): ExpandRecipientsResult {
  const expanded: ComposeRecipient[] = [];
  for (const submission of submissions) {
    for (const participant of submission.participants) {
      expanded.push({
        contactId: participant.contactId,
        submissionId: submission.id,
        email: participant.email,
        name: `${participant.firstName} ${participant.lastName}`.trim(),
      });
    }
  }

  let recipients: ComposeRecipient[];
  // DEC-936 (wave-21 amendment): the collapsed rows are KEPT, not dropped on
  // the floor — see ExpandRecipientsResult.withheld above.
  const withheld: ComposeRecipient[] = [];
  if (opts.perSubmissionVarsSpent) {
    recipients = expanded;
  } else {
    const seenContacts = new Set<string>();
    recipients = [];
    for (const r of expanded) {
      if (seenContacts.has(r.contactId)) {
        withheld.push(r);
        continue;
      }
      seenContacts.add(r.contactId);
      recipients.push(r);
    }
  }

  if (recipients.length > MAX_COMPOSE_RECIPIENTS) {
    return {
      ok: false,
      error: "invalid",
      message: `${recipients.length} recipients exceeds the ${MAX_COMPOSE_RECIPIENTS}-recipient cap; narrow the batch.`,
    };
  }
  return { ok: true, recipients, withheld };
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
  /** DEC-792: the recipient's outstanding-task list, already rendered via
   * the shared src/domain/reminders.ts formatTaskLines (DEC-564) — pass
   * NO_TASKS_TEXT when the recipient has zero outstanding tasks. Unlike
   * feedbackComments, task_list/task_due_date are ALWAYS present (never
   * omitted) since every recipient of a compose has a well-defined "no
   * tasks" state. */
  taskList: string;
  /** DEC-792: the recipient's earliest outstanding due date, already
   * formatted via formatCalendarDate — pass NO_DUE_DATE_TEXT when the
   * recipient has no outstanding task carrying a due date. */
  dueDate: string;
  /** DEC-660 (wave 142): the recipient's submission's scheduled slot,
   * already formatted through the same event-local clock helper the
   * compose recipient table's Slot column uses (formatDayMedium +
   * clockHHMM) — `null` when the submission has no schedule_slot row
   * (RenderTarget.scheduled is false). Unlike taskList/dueDate, `null`
   * here means the field is OMITTED entirely (the `feedback`/DEC-682
   * precedent), never a blank string: an unscheduled recipient must fail
   * preflightRender loudly and be named by the existing missing-fields
   * banner. */
  sessionTime: string | null;
}

/** Builds the DEC-006 merge vars for one recipient (speaker_name, talk_title,
 * event_name, portal_link, feedback, task_due_date, task_list, session_time —
 * DEC-792 grows the compose vocabulary to match the DEC-023 reminders
 * pipeline; DEC-660 wave-142 adds session_time). DEC-682: the `feedback` key
 * is omitted entirely when feedbackComments is null; task_list/task_due_date
 * are ALWAYS set (never omitted) so a template referencing them never fails
 * preflight for a recipient with no tasks. `session_time` follows the same
 * omit-not-blank rule as `feedback`: it is set only when sessionTime is
 * non-null, so a template referencing {session_time} fails preflightRender
 * loudly for an unscheduled recipient instead of mailing a blank slot.
 * Keyed `task_due_date` (the canonical token, wave-45 amendment) — a
 * template still using the {due_date} alias is resolved against this same
 * key by src/mail/render.ts's renderTemplate. */
export function buildMergeVars(input: MergeVarsInput): Record<string, string> {
  const vars: Record<string, string> = {
    speaker_name: input.speakerName,
    talk_title: input.talkTitle,
    event_name: input.eventName,
    portal_link: input.portalLink,
    task_list: input.taskList,
    task_due_date: input.dueDate,
  };
  if (input.feedbackComments !== null) {
    vars.feedback = formatFeedback(input.feedbackComments);
  }
  if (input.sessionTime !== null) {
    vars.session_time = input.sessionTime;
  }
  return vars;
}

export interface RenderTarget {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
  /** DEC-912: the submission's human ref (e.g. 'DFC-014'), carried through
   * to the rendered recipient row unconditionally — not gated on attachIcs. */
  ref: string;
  /** DEC-912: whether this submission has a schedule_slot row, carried
   * through to the rendered recipient row unconditionally. This is the
   * FACT of scheduling, distinct from `ics` (the attachment payload, which
   * stays gated on attachIcs). */
  scheduled: boolean;
  vars: Record<string, string>;
}

export interface RenderedRecipientEmail {
  contactId: string;
  submissionId: string;
  email: string;
  name: string;
  ref: string;
  scheduled: boolean;
  subject: string;
  text: string;
}

export interface PreflightMissingField {
  contactId: string;
  submissionId: string;
  fields: string[];
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
    const subjectMissing = missingMergeFields(subjectTemplate, target.vars);
    const bodyMissing = missingMergeFields(bodyTemplate, target.vars);
    const fields = [...subjectMissing];
    for (const f of bodyMissing) {
      if (!fields.includes(f)) fields.push(f);
    }

    if (fields.length > 0) {
      missing.push({ contactId: target.contactId, submissionId: target.submissionId, fields });
      continue;
    }

    rendered.push({
      contactId: target.contactId,
      submissionId: target.submissionId,
      email: target.email,
      name: target.name,
      ref: target.ref,
      scheduled: target.scheduled,
      subject: renderTemplate(subjectTemplate, target.vars),
      text: renderTemplate(bodyTemplate, target.vars),
    });
  }

  if (missing.length > 0) {
    return { ok: false, error: "invalid", missing };
  }
  return { ok: true, rendered };
}
