// Compose pipeline shared logic (DEC-019/DEC-051/DEC-122/DEC-317/DEC-530/
// DEC-682/DEC-792/DEC-847/DEC-912): validation, preflight, and the batched
// render-target builder shared by compose/preview and compose/send. Split
// out of the former monolithic src/routes/comms.ts — no behavior change.

import type { AppEnv } from "../../server/env";
import { ApiError, parseBoundedIdArray } from "../../server/http";
import * as repo from "../../server/repo/comms";
import { getPlanById } from "../../server/repo/review/plans";
import type { KVStore } from "../../auth/claim";
import { resolvePortalLinks } from "../../server/repo/portal-link";
import { blockFieldsInTemplate } from "../../mail/render";
import { zonedMinutesToUtc } from "../../lib/timezone";
import {
  buildMergeVars,
  expandRecipients,
  MAX_COMPOSE_RECIPIENTS,
  NO_DUE_DATE_TEXT,
  NO_TASKS_TEXT,
  type ComposeSubmission,
} from "../../domain/compose";
import { formatTaskLines, type ReminderAssignment } from "../../domain/reminders";
import { listOutstandingForEvent } from "../../server/repo/tasks/reminders";
import { formatCalendarDate } from "../../lib/event-time";
import { formatRef } from "../../domain/ids";
import { DEC_122 } from "../../decisions";
import { MAX_TEXT_LENGTH, MAX_RICH_TEXT_LENGTH } from "../../forms/validate"; // DEC-417
import { overCapFieldMessage } from "../../domain/cap-copy";
import { resolveBaseUrl } from "../../server/origin";
import type { EmailShellOptions } from "../../mail/shell";

export interface ComposeBody {
  templateId?: string;
  subject?: string;
  bodyText?: string;
  submissionIds: string[];
  includeFeedback?: boolean;
  feedbackPlanId?: string;
  feedbackRound?: number;
  attachIcs?: boolean;
}

/** DEC-122 (DEC-019 no-silent-skips): loadComposeSubmissions silently drops
 * ids that don't belong to this event (see its contract comment in
 * server/repo/comms.ts). Shared by preview + send so a compose call against
 * a stale/foreign/deleted submission id fails loudly with a 400 naming the
 * unknown ids, instead of quietly composing to a smaller recipient set. */
export function requireFullMatch(requestedIds: string[], submissions: { id: string }[]): void {
  void DEC_122;
  const foundIds = new Set(submissions.map((s) => s.id));
  const missing = requestedIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ApiError("invalid", "One or more submission ids do not belong to this event", {
      submissionIds: `unknown ids: ${missing.join(", ")}`,
    });
  }
}

/** DEC-682: when includeFeedback is set, the caller must name exactly which
 * plan+round's comments to attach — never "whatever this submission has
 * ever collected". Returns null when includeFeedback is false (feedback not
 * attached at all). */
export async function resolveFeedbackScope(
  c: { var: { db: import("../../server/context").Db; auth?: { orgId: string } } },
  eventId: string,
  b: Partial<ComposeBody>,
): Promise<{ planId: string; round: number } | null> {
  if (b.includeFeedback !== true) return null;

  if (typeof b.feedbackPlanId !== "string" || b.feedbackPlanId.trim() === "") {
    throw new ApiError("invalid", "Choose which evaluation plan's feedback to attach", {
      feedbackPlanId: "Choose which evaluation plan's feedback to attach",
    });
  }
  const plan = await getPlanById(c.var.db, b.feedbackPlanId);
  if (!plan || plan.eventId !== eventId) throw new ApiError("not_found", "Evaluation plan not found");

  const round = b.feedbackRound !== undefined ? b.feedbackRound : plan.currentRound;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 1 || round > plan.rounds) {
    throw new ApiError("invalid", `feedbackRound must be an integer between 1 and ${plan.rounds}`, {
      feedbackRound: `must be between 1 and ${plan.rounds}`,
    });
  }

  return { planId: plan.id, round };
}

export async function resolveComposeInput(
  c: { var: { db: import("../../server/context").Db; auth?: { orgId: string } } },
  eventId: string,
  body: unknown,
): Promise<{
  subjectTemplate: string;
  bodyTemplate: string;
  submissionIds: string[];
  feedback: { planId: string; round: number } | null;
  attachIcs: boolean;
}> {
  const b = body as Partial<ComposeBody> | null;
  if (!b || typeof b !== "object") throw new ApiError("invalid", "Invalid JSON body");

  // DEC-396: shared bounded-array validation (id shape + MAX_COMPOSE_RECIPIENTS
  // cap) instead of a hand-rolled check, so preview/send both fail loudly
  // before any D1 read on an oversized or malformed submissionIds array.
  const submissionIds = parseBoundedIdArray(b.submissionIds, "submissionIds", {
    maxCount: MAX_COMPOSE_RECIPIENTS,
  });

  let subjectTemplate: string;
  let bodyTemplate: string;
  // DEC-832: the composer copies a template's text into its own fields and
  // clears the selection client-side, so a request naming BOTH templateId
  // and subject/bodyText names an ambiguous instruction — reject it loudly
  // instead of picking a silent precedence rule between them.
  if (b.templateId !== undefined && (b.subject !== undefined || b.bodyText !== undefined)) {
    throw new ApiError("invalid", "Provide either templateId or subject/bodyText, not both", {
      templateId: "cannot be combined with subject/bodyText",
    });
  }
  if (b.templateId !== undefined) {
    const auth = c.var.auth;
    if (!auth) throw new ApiError("unauthorized", "Login required");
    const template = await repo.findTemplateForOrg(c.var.db, b.templateId, auth.orgId);
    if (!template || template.eventId !== eventId) throw new ApiError("not_found", "Template not found");
    subjectTemplate = template.subject;
    bodyTemplate = template.bodyText;
  } else {
    if (typeof b.subject !== "string" || typeof b.bodyText !== "string") {
      throw new ApiError("invalid", "Validation failed", {
        templateId: "provide templateId, or both subject and bodyText",
      });
    }
    // DEC-417
    if (b.subject.length > MAX_TEXT_LENGTH) {
      throw new ApiError("invalid", `subject must be at most ${MAX_TEXT_LENGTH} characters`, {
        subject: overCapFieldMessage(b.subject.length, MAX_TEXT_LENGTH),
      });
    }
    if (b.bodyText.length > MAX_RICH_TEXT_LENGTH) {
      throw new ApiError("invalid", `bodyText must be at most ${MAX_RICH_TEXT_LENGTH} characters`, {
        bodyText: overCapFieldMessage(b.bodyText.length, MAX_RICH_TEXT_LENGTH),
      });
    }
    subjectTemplate = b.subject;
    bodyTemplate = b.bodyText;
  }

  // DEC-847: a subject is one line. task_list/feedback render as multi-line
  // blocks, so a subject referencing either — whether typed or loaded from a
  // stored template — fails loudly instead of mailing a paragraph subject.
  const subjectBlockFields = blockFieldsInTemplate(subjectTemplate);
  if (subjectBlockFields.length > 0) {
    const field = subjectBlockFields[0];
    const noun = field === "task_list" ? "a list" : "a block of text";
    const message = `{${field}} is ${noun}; it cannot go in a subject`;
    throw new ApiError("invalid", message, { subject: message });
  }

  const feedback = await resolveFeedbackScope(c, eventId, b);

  return {
    subjectTemplate,
    bodyTemplate,
    submissionIds,
    feedback,
    attachIcs: b.attachIcs === true,
  };
}

/** Pure part of the DEC-051 preflight: given the loaded schedule data and the
 * full set of selected submission ids, returns the ApiError `fields` map for
 * every submission with no schedule_slot row (empty when all are scheduled).
 * Split out from preflightIcsSchedule so it's unit-testable without a Db. */
export function unscheduledIcsFields(
  icsMap: Map<string, repo.IcsScheduleRow>,
  submissionIds: string[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const id of submissionIds) {
    if (!icsMap.has(id)) fields[id] = "not scheduled";
  }
  return fields;
}

/** DEC-317 preflight: after loadComposeSubmissions (which now filters
 * participants down to ACTIVE_INVITE_STATUSES), a submission whose
 * participants all declined or are still 'invited' loads with zero participants
 * — a silent-drop hole that would otherwise render/send to a smaller
 * recipient set than requested with no error. Returns the ApiError `fields`
 * map for every selected submission id with zero loaded participants
 * (including ids that failed to load at all), empty when every selection has
 * at least one eligible recipient. */
export function noRecipientFields(submissions: repo.ComposeSubmission[], submissionIds: string[]): Record<string, string> {
  const bySubmissionId = new Map(submissions.map((s) => [s.id, s]));
  const fields: Record<string, string> = {};
  for (const id of submissionIds) {
    const submission = bySubmissionId.get(id);
    if (!submission || submission.participants.length === 0) fields[id] = "no eligible recipients";
  }
  return fields;
}

/** DEC-051 preflight: when attachIcs is set, every selected submission must
 * have a schedule slot. Runs before any render/send is attempted (atomic per
 * DEC-019) and returns the schedule data so the caller doesn't re-query. */
export async function preflightIcsSchedule(
  db: import("../../server/context").Db,
  event: { startDate: string; endDate: string },
  submissionIds: string[],
): Promise<Map<string, repo.IcsScheduleRow>> {
  const icsMap = await repo.loadIcsScheduleData(db, event, submissionIds);
  const fields = unscheduledIcsFields(icsMap, submissionIds);
  if (Object.keys(fields).length > 0) {
    throw new ApiError("invalid", "Cannot attach calendar invites: some selected sessions are unscheduled", fields);
  }
  return icsMap;
}

export interface IcsPreviewInfo {
  startUtc: string;
  endUtc: string;
  room: string | null;
  sequence: number;
  /** DEC-494: the OWNING EVENT's IANA timezone, so the compose preview chip
   * renders the session's local time instead of the viewer's ambient zone. */
  timeZone: string;
}

export function icsPreviewInfoFor(slot: repo.IcsScheduleRow, event: { timezone: string }): IcsPreviewInfo {
  return {
    startUtc: zonedMinutesToUtc(slot.day, slot.startMin, event.timezone).toISOString(),
    endUtc: zonedMinutesToUtc(slot.day, slot.endMin, event.timezone).toISOString(),
    room: slot.roomName,
    sequence: slot.icsSequence,
    timeZone: event.timezone,
  };
}

/** Exported for test/comms-batched-lookups.test.ts (DEC-530): this is the
 * per-request hotspot the batching fixed, so its query-count characteristics
 * are tested directly rather than only through the full HTTP route. */
export async function buildRenderTargets(
  c: {
    var: { db: import("../../server/context").Db; auth?: { orgId: string } };
    env: { KV: KVNamespace; PUBLIC_BASE_URL?: string; DEV_MODE?: string };
    req: { url: string; header(name: string): string | undefined };
  },
  event: { id: string; name: string; recordPrefix: string; startDate: string; endDate: string },
  submissions: ComposeSubmission[],
  feedback: { planId: string; round: number } | null,
) {
  const expanded = expandRecipients(submissions);
  if (!expanded.ok) throw new ApiError("invalid", expanded.message);

  const submissionById = new Map(submissions.map((s) => [s.id, s]));
  const kv = c.env.KV as unknown as KVStore;
  const origin = resolveBaseUrl(c);

  // DEC-530: resolve the feedback-comment and account-identity lookups once
  // for the whole expanded recipient set instead of per-recipient — at the
  // DEC-019 100-recipient cap this collapses up to 200 sequential D1
  // round trips into 2. DEC-682: feedback is scoped to exactly the
  // composing plan+round — never the submission's entire comment history.
  const submissionIds = [...new Set(expanded.recipients.map((r) => r.submissionId))];
  const feedbackMap = feedback
    ? await repo.listFeedbackCommentsForSubmissions(c.var.db, submissionIds, feedback)
    : new Map<string, string[]>();
  const accountMap = await repo.findAccountUserIds(
    c.var.db,
    expanded.recipients.map((r) => ({ contactId: r.contactId, email: r.email })),
  );

  // DEC-792/DEC-530: one batched outstanding-task query for the whole
  // expanded recipient set (never per-recipient), grouped by contactId, so
  // the {task_list}/{due_date} merge fields cost one extra round trip
  // regardless of recipient count.
  const contactIds = [...new Set(expanded.recipients.map((r) => r.contactId))];
  const outstandingRows = await listOutstandingForEvent(c.var.db, event.id, undefined, contactIds);

  // DEC-912: 'ref' (talk display code) and 'scheduled' (whether a
  // schedule_slot exists) are populated on EVERY rendered recipient,
  // unconditionally — never gated on attachIcs, which only governs the
  // `ics` attachment payload computed at the callsite below. One batched
  // schedule-data query for the whole expanded submission set (never
  // per-recipient), mirroring the feedback/account/task batching above.
  const icsScheduleMap = await repo.loadIcsScheduleData(c.var.db, event, submissionIds);
  const outstandingByContact = new Map<string, ReminderAssignment[]>();
  for (const row of outstandingRows) {
    const arr = outstandingByContact.get(row.contactId) ?? [];
    arr.push({
      assignmentId: row.assignmentId,
      contactId: row.contactId,
      status: row.status,
      dueDate: row.dueDate ? row.dueDate.getTime() : null,
      lastRemindedAt: row.lastRemindedAt ? row.lastRemindedAt.getTime() : null,
      taskId: row.taskId,
      taskTitle: row.taskTitle,
    });
    outstandingByContact.set(row.contactId, arr);
  }

  // DEC-397 wave-50 amendment (MINT LATE): the render pass that VALIDATES
  // always resolves links with mintClaimTokens=false — zero KV writes, a
  // non-empty PREVIEW_CLAIM_TOKEN placeholder so merge-field presence checks
  // behave identically to a real send. Only once preflightRender accepts the
  // batch does the caller mint real tokens via applyMintedPortalLinks and
  // re-render.
  const recipientAccounts = expanded.recipients.map((r) => ({
    contactId: r.contactId,
    userId: accountMap.get(r.contactId) ?? null,
  }));
  const portalLinkMap = await resolvePortalLinks(kv, recipientAccounts, event.id, origin, false);

  const targets = [];
  for (const recipient of expanded.recipients) {
    const submission = submissionById.get(recipient.submissionId);
    if (!submission) throw new Error(`recipient references unknown submission ${recipient.submissionId}`);
    const feedbackComments = feedback ? feedbackMap.get(recipient.submissionId) ?? [] : null;
    const portalLink = portalLinkMap.get(recipient.contactId);
    if (!portalLink) throw new Error(`no portal link resolved for contactId ${recipient.contactId}`);

    const assignments = outstandingByContact.get(recipient.contactId) ?? [];
    const taskList = assignments.length > 0 ? formatTaskLines(assignments).join("\n") : NO_TASKS_TEXT;
    const earliestDue = assignments.reduce<number | null>((min, a) => {
      if (a.dueDate === null) return min;
      if (min === null || a.dueDate < min) return a.dueDate;
      return min;
    }, null);
    const dueDate = earliestDue !== null ? formatCalendarDate(earliestDue) : NO_DUE_DATE_TEXT;

    const vars = buildMergeVars({
      speakerName: recipient.name,
      talkTitle: submission.title,
      eventName: event.name,
      portalLink,
      feedbackComments,
      taskList,
      dueDate,
    });
    targets.push({
      contactId: recipient.contactId,
      submissionId: recipient.submissionId,
      email: recipient.email,
      name: recipient.name,
      ref: formatRef(event.recordPrefix, submission.seq),
      scheduled: icsScheduleMap.has(recipient.submissionId),
      vars,
    });
  }
  return { targets, recipients: recipientAccounts };
}

/** DEC-037 amendment: the single source of the mail-shell options both
 * /compose/preview and /compose/send pass to renderEmailHtml, so a preview
 * renders exactly the shell the send call wraps every body in -- not a
 * separately hand-typed reason string that can drift from it. */
export function composeEmailShellOptions(event: { name: string }): EmailShellOptions {
  return {
    eventName: event.name,
    reason: `you're a participant in a submission at ${event.name}`,
  };
}

export function missingToFields(missing: { contactId: string; submissionId: string; fields: string[] }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const m of missing) {
    fields[`${m.contactId}:${m.submissionId}`] = `missing merge fields: ${m.fields.join(", ")}`;
  }
  return fields;
}

// re-export type used by route modules for the AppEnv-typed Hono sub-apps
export type { AppEnv };
