// J5 compose pipeline (DEC-019): templates CRUD + atomic preview/send.
// Route file exports a named Hono<AppEnv> sub-app; only src/index.ts mounts
// it (DEC-012). Every endpoint is organizer-only + csrfJson on mutations.

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { csrfJson, requireOrganizer } from "../server/middleware";
import { ApiError, parseBoundedIdArray } from "../server/http";
import * as repo from "../server/repo/comms";
import { getEmailLogById, listTemplateLastUsedAt } from "../server/repo/email";
import { bumpIcsSequences } from "../server/repo/ics-sequence";
import { getEventForOrg } from "../server/repo/events";
import { getPlanById } from "../server/repo/review/plans";
import type { KVStore } from "../auth/claim";
import { redactClaimUrls } from "../auth/claim";
import { applyMintedPortalLinks, resolvePortalLinks } from "../server/repo/portal-link";
import { textToHtml, blockFieldsInTemplate, templateUsesMergeField } from "../mail/render";
import { buildIcsEvent } from "../mail/ics";
import { resolveIcsOrganizerEmail } from "../server/context";
import { zonedMinutesToUtc } from "../lib/timezone";
import {
  buildMergeVars,
  expandRecipients,
  preflightRender,
  MAX_COMPOSE_RECIPIENTS,
  NO_DUE_DATE_TEXT,
  NO_TASKS_TEXT,
  type ComposeSubmission,
} from "../domain/compose";
import { formatTaskLines, type ReminderAssignment } from "../domain/reminders";
import { listOutstandingForEvent } from "../server/repo/tasks/reminders";
import { formatCalendarDate } from "../lib/event-time";
import { formatRef } from "../domain/ids";
import {
  MAX_PORTAL_INVITE_RECIPIENTS,
  renderPortalInvites,
  type PortalInviteRecipient,
} from "../domain/portal-invite";
import { DEC_122, DEC_252, DEC_766, DEC_805, DEC_832, DEC_833 } from "../decisions";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_RICH_TEXT_LENGTH } from "../forms/validate"; // DEC-417
import { resolveBaseUrl } from "../server/origin";
import { clampPage, listPerPage } from "../lib/pagination";
import { newId } from "../domain/ids";

void DEC_252;
void DEC_766;
void DEC_805;
void DEC_832;
void DEC_833;

export const commsRoutes = new Hono<AppEnv>();

/** DEC-122 (DEC-019 no-silent-skips): loadComposeSubmissions silently drops
 * ids that don't belong to this event (see its contract comment in
 * server/repo/comms.ts). Shared by preview + send so a compose call against
 * a stale/foreign/deleted submission id fails loudly with a 400 naming the
 * unknown ids, instead of quietly composing to a smaller recipient set. */
function requireFullMatch(requestedIds: string[], submissions: { id: string }[]): void {
  void DEC_122;
  const foundIds = new Set(submissions.map((s) => s.id));
  const missing = requestedIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ApiError("invalid", "One or more submission ids do not belong to this event", {
      submissionIds: `unknown ids: ${missing.join(", ")}`,
    });
  }
}

async function requireOwnedEvent(c: { var: { db: import("../server/context").Db; auth?: { orgId: string } } }, eventId: string) {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const event = await getEventForOrg(c.var.db, eventId, auth.orgId);
  if (!event) throw new ApiError("not_found", "Event not found");
  return event;
}

function serializeTemplate(t: repo.EmailTemplateRow, lastUsedAt: number | null = null) {
  return { id: t.id, eventId: t.eventId, name: t.name, subject: t.subject, bodyText: t.bodyText, lastUsedAt };
}

// ---------------------------------------------------------------------------
// Templates CRUD (DEC-019)
// ---------------------------------------------------------------------------

commsRoutes.get("/api/v1/events/:eventId/templates", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);
  const page = clampPage(c.req.query("page"));
  const perPage = listPerPage(c.req.query("perPage")); // DEC-465
  // DEC-890: one grouped query for the whole event's last-used-at map,
  // joined onto this page's rows in memory -- never a per-row query.
  const [items, total, lastUsedAt] = await Promise.all([
    repo.listTemplates(c.var.db, eventId, { limit: perPage, offset: (page - 1) * perPage }),
    repo.countTemplates(c.var.db, eventId),
    listTemplateLastUsedAt(c.var.db, eventId),
  ]);
  return c.json({ items: items.map((t) => serializeTemplate(t, lastUsedAt.get(t.id) ?? null)), total, page, perPage });
});

commsRoutes.post("/api/v1/events/:eventId/templates", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });

  const errors: Record<string, string> = {};
  if (typeof body.name !== "string" || body.name.trim() === "") errors.name = "required";
  else if (body.name.length > MAX_NAME_LENGTH) errors.name = `Max ${MAX_NAME_LENGTH}`; // DEC-417
  if (typeof body.subject !== "string" || body.subject.trim() === "") errors.subject = "required";
  else if (body.subject.length > MAX_TEXT_LENGTH) errors.subject = `Max ${MAX_TEXT_LENGTH}`; // DEC-417
  if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") errors.bodyText = "required";
  else if (body.bodyText.length > MAX_RICH_TEXT_LENGTH) errors.bodyText = `Max ${MAX_RICH_TEXT_LENGTH}`; // DEC-417
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Validation failed", errors);

  const created = await repo.createTemplate(c.var.db, eventId, {
    name: body.name,
    subject: body.subject,
    bodyText: body.bodyText,
  });
  return c.json(serializeTemplate(created), 201);
});

commsRoutes.patch("/api/v1/templates/:templateId", requireOrganizer, csrfJson, async (c) => {
  const templateId = c.req.param("templateId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const existing = await repo.findTemplateForOrg(c.var.db, templateId, auth.orgId);
  if (!existing) throw new ApiError("not_found", "Template not found");

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });

  const errors: Record<string, string> = {};
  const patch: repo.TemplatePatch = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") errors.name = "must be a non-empty string";
    else if (body.name.length > MAX_NAME_LENGTH) errors.name = `Max ${MAX_NAME_LENGTH}`; // DEC-417
    else patch.name = body.name;
  }
  if (body.subject !== undefined) {
    if (typeof body.subject !== "string" || body.subject.trim() === "") errors.subject = "must be a non-empty string";
    else if (body.subject.length > MAX_TEXT_LENGTH) errors.subject = `Max ${MAX_TEXT_LENGTH}`; // DEC-417
    else patch.subject = body.subject;
  }
  if (body.bodyText !== undefined) {
    if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") errors.bodyText = "must be a non-empty string";
    else if (body.bodyText.length > MAX_RICH_TEXT_LENGTH) errors.bodyText = `Max ${MAX_RICH_TEXT_LENGTH}`; // DEC-417
    else patch.bodyText = body.bodyText;
  }
  if (Object.keys(errors).length > 0) throw new ApiError("invalid", "Validation failed", errors);

  const updated = await repo.patchTemplate(c.var.db, templateId, patch);
  return c.json(serializeTemplate(updated));
});

commsRoutes.delete("/api/v1/templates/:templateId", requireOrganizer, csrfJson, async (c) => {
  const templateId = c.req.param("templateId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const existing = await repo.findTemplateForOrg(c.var.db, templateId, auth.orgId);
  if (!existing) throw new ApiError("not_found", "Template not found");

  await repo.deleteTemplate(c.var.db, templateId);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Compose: preview / send (DEC-019)
// ---------------------------------------------------------------------------

interface ComposeBody {
  templateId?: string;
  subject?: string;
  bodyText?: string;
  submissionIds: string[];
  includeFeedback?: boolean;
  feedbackPlanId?: string;
  feedbackRound?: number;
  attachIcs?: boolean;
}

/** DEC-682: when includeFeedback is set, the caller must name exactly which
 * plan+round's comments to attach — never "whatever this submission has
 * ever collected". Returns null when includeFeedback is false (feedback not
 * attached at all). */
async function resolveFeedbackScope(
  c: { var: { db: import("../server/context").Db; auth?: { orgId: string } } },
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

async function resolveComposeInput(
  c: { var: { db: import("../server/context").Db; auth?: { orgId: string } } },
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
        subject: `Max ${MAX_TEXT_LENGTH}`,
      });
    }
    if (b.bodyText.length > MAX_RICH_TEXT_LENGTH) {
      throw new ApiError("invalid", `bodyText must be at most ${MAX_RICH_TEXT_LENGTH} characters`, {
        bodyText: `Max ${MAX_RICH_TEXT_LENGTH}`,
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
async function preflightIcsSchedule(
  db: import("../server/context").Db,
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

interface IcsPreviewInfo {
  startUtc: string;
  endUtc: string;
  room: string | null;
  sequence: number;
  /** DEC-494: the OWNING EVENT's IANA timezone, so the compose preview chip
   * renders the session's local time instead of the viewer's ambient zone. */
  timeZone: string;
}

function icsPreviewInfoFor(slot: repo.IcsScheduleRow, event: { timezone: string }): IcsPreviewInfo {
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
    var: { db: import("../server/context").Db; auth?: { orgId: string } };
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

commsRoutes.post("/api/v1/events/:eventId/compose/preview", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });
  const input = await resolveComposeInput(c, eventId, body);

  // DEC-122: loadComposeSubmissions silently excludes ids outside this event
  // (see its contract comment) — the caller must verify the full requested
  // set matched BEFORE any other preflight (e.g. ics scheduling) runs.
  const submissions = await repo.loadComposeSubmissions(c.var.db, eventId, input.submissionIds);
  requireFullMatch(input.submissionIds, submissions);

  // DEC-317: loadComposeSubmissions now filters participants down to active
  // invite statuses only, so a submission whose participants all declined
  // would otherwise silently compose to zero people.
  const noRecipients = noRecipientFields(submissions, input.submissionIds);
  if (Object.keys(noRecipients).length > 0) {
    throw new ApiError("invalid", "Some selected sessions have no eligible recipients", noRecipients);
  }

  const icsMap = input.attachIcs ? await preflightIcsSchedule(c.var.db, event, input.submissionIds) : undefined;

  // DEC-397: preview never mints credentials — buildRenderTargets always
  // resolves links with mintClaimTokens=false now.
  const { targets } = await buildRenderTargets(c, event, submissions, input.feedback);

  const result = preflightRender(targets, input.subjectTemplate, input.bodyTemplate);
  if (!result.ok) {
    throw new ApiError("invalid", "One or more recipients are missing merge fields", missingToFields(result.missing));
  }

  // DEC-883: the preview identifies the merged-feedback block by matching
  // this recipient's own resolved `feedback` var against the rendered body
  // -- never re-deriving or re-fetching it -- so the wire payload carries it
  // alongside the rendered text (preview only; /compose/send never does this).
  const feedbackByTarget = new Map(targets.map((t) => [`${t.contactId}:${t.submissionId}`, t.vars.feedback]));
  const items = result.rendered.map((r) => {
    const withIcs = icsMap ? { ...r, ics: icsPreviewInfoFor(icsMap.get(r.submissionId)!, event) } : r;
    const feedback = feedbackByTarget.get(`${r.contactId}:${r.submissionId}`);
    return feedback !== undefined ? { ...withIcs, vars: { feedback } } : withIcs;
  });

  return c.json({ items });
});

commsRoutes.post("/api/v1/events/:eventId/compose/send", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });
  const input = await resolveComposeInput(c, eventId, body);

  // Atomic preflight (DEC-019/DEC-051/DEC-122): full-set id match, then
  // schedule-slot + merge-field checks all run BEFORE the first send is
  // attempted. Only once every recipient renders (and, when attachIcs is
  // set, every selected submission is scheduled) do we start sending.
  const submissions = await repo.loadComposeSubmissions(c.var.db, eventId, input.submissionIds);
  requireFullMatch(input.submissionIds, submissions);

  // DEC-317: same atomic preflight as preview — reject the whole batch
  // before any mailer.send if a selected submission has no active-invite
  // participants left to notify.
  const noRecipients = noRecipientFields(submissions, input.submissionIds);
  if (Object.keys(noRecipients).length > 0) {
    throw new ApiError("invalid", "Some selected sessions have no eligible recipients", noRecipients);
  }

  const icsMap = input.attachIcs ? await preflightIcsSchedule(c.var.db, event, input.submissionIds) : undefined;

  // DEC-397 wave-50 amendment (MINT LATE): build targets with
  // mintClaimTokens=false and preflight FIRST — a bad merge-field template
  // must throw the 400 before any KV credential is minted. Only once
  // preflightRender accepts the batch do we mint real portal links and
  // re-render (preflightRender is pure, so the second pass costs no IO).
  const { targets, recipients } = await buildRenderTargets(c, event, submissions, input.feedback);

  const preflightResult = preflightRender(targets, input.subjectTemplate, input.bodyTemplate);
  if (!preflightResult.ok) {
    throw new ApiError(
      "invalid",
      "One or more recipients are missing merge fields",
      missingToFields(preflightResult.missing),
    );
  }

  // DEC-397 wave-62 amendment (MINT ONLY WHAT THE MESSAGE CARRIES): mint a
  // claim credential only if the send actually references {portal_link} —
  // an unused mint is destructive (it revokes/replaces any prior grant) for
  // no delivery benefit.
  const needsPortalLink =
    templateUsesMergeField(input.subjectTemplate, "portal_link") ||
    templateUsesMergeField(input.bodyTemplate, "portal_link");
  const kv = c.env.KV as unknown as KVStore;
  const origin = resolveBaseUrl(c);
  if (needsPortalLink) {
    await applyMintedPortalLinks(kv, recipients, event.id, origin, targets);
  }
  const result = preflightRender(targets, input.subjectTemplate, input.bodyTemplate);
  if (!result.ok) {
    throw new ApiError("invalid", "One or more recipients are missing merge fields", missingToFields(result.missing));
  }

  const submissionById = new Map(submissions.map((s) => [s.id, s]));
  const templateId = typeof body.templateId === "string" ? body.templateId : undefined;
  const { makeMailer } = await import("../server/context");
  const mailer = makeMailer(c.var.db, c.env);
  // DEC-603: one id per fan-out call, shared by every recipient in this
  // loop, so the comms history tab can group the batch into one row.
  const batchId = newId();
  // DEC-238 class 2 (organizer-triggered batch): a bad recipient must not
  // abort the whole send — catch per-recipient, keep going, and report the
  // partial outcome in the 200 response rather than surfacing a 500.
  const failed: { email: string; message: string }[] = [];
  for (const rendered of result.rendered) {
    try {
      // DEC-547 amendment (wave 43): the ICS construction (and its
      // resolveIcsOrganizerEmail(c.env) config read, which can throw when
      // mail isn't configured) now runs INSIDE this per-recipient try —
      // previously it ran before the try, so an unconfigured deployment
      // 500'd on the very first recipient instead of landing in `failed[]`.
      let ics: { filename: string; content: string } | undefined;
      if (icsMap) {
        const slot = icsMap.get(rendered.submissionId)!;
        const submission = submissionById.get(rendered.submissionId)!;
        ics = {
          filename: `chq-${rendered.submissionId}.ics`,
          content: buildIcsEvent(
            {
              uidSubmissionId: rendered.submissionId,
              sequence: slot.icsSequence,
              title: submission.title,
              startUtc: zonedMinutesToUtc(slot.day, slot.startMin, event.timezone),
              endUtc: zonedMinutesToUtc(slot.day, slot.endMin, event.timezone),
              location: slot.roomName ?? undefined,
              dtstamp: new Date(),
            },
            {
              method: "REQUEST",
              organizer: { name: event.name, email: resolveIcsOrganizerEmail(c.env) },
              attendee: { name: rendered.name, email: rendered.email },
            },
          ),
        };
      }
      const attempt = {
        to: { email: rendered.email, name: rendered.name },
        subject: rendered.subject,
        text: rendered.text,
        html: textToHtml(rendered.text),
        ics,
        templateId,
        eventId,
        contactId: rendered.contactId,
        batchId,
      };
      await mailer.send(attempt);
    } catch (err) {
      // DEC-923: the mailer itself logs the failed attempt (status
      // 'failed') before rethrowing — no route-level duplicate write.
      failed.push({ email: rendered.email, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Bump ics_sequence exactly once per submission per send call — after
  // every recipient of every submission has been sent the CURRENT stored
  // sequence value (DEC-051). Never runs on preview.
  if (icsMap) {
    await bumpIcsSequences(c.var.db, input.submissionIds);
  }

  // DEC-949 amendment: the send response must never carry rendered bodies
  // (they contain live claim tokens minted above) -- only the SPA-consumed
  // counts. Preview handlers legitimately return `items`; send never does.
  return c.json({ sent: result.rendered.length - failed.length, failed });
});

// ---------------------------------------------------------------------------
// Per-speaker portal invitation (DEC-805)
// ---------------------------------------------------------------------------

commsRoutes.post("/api/v1/events/:eventId/portal-invites", requireOrganizer, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);

  const body = await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  });
  const contactIds = parseBoundedIdArray((body as { contactIds?: unknown }).contactIds, "contactIds", {
    maxCount: MAX_PORTAL_INVITE_RECIPIENTS,
  });

  // Atomic preflight (DEC-805/DEC-019 precedent): every requested contactId
  // must be a participant on a submission in this event, or the whole call
  // fails loudly naming the ids that aren't — no half-sent batches.
  const participants = await repo.findParticipantContactsForEvent(c.var.db, eventId, contactIds);
  const foundIds = new Set(participants.map((p) => p.contactId));
  const missing = contactIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ApiError("invalid", "One or more contacts are not a participant on a submission in this event", {
      contactIds: `unknown ids: ${missing.join(", ")}`,
    });
  }

  const kv = c.env.KV as unknown as KVStore;
  const origin = resolveBaseUrl(c);

  // DEC-530: one batched account-identity lookup for the whole recipient
  // set instead of per-recipient.
  const accountMap = await repo.findAccountUserIds(
    c.var.db,
    participants.map((p) => ({ contactId: p.contactId, email: p.email })),
  );

  // portal_link built with the SAME batched helper the compose path uses
  // (DEC-530 wave-42 amendment); a portal invite always mints real claim
  // tokens (never a preview).
  const portalLinkByContactId = await resolvePortalLinks(
    kv,
    participants.map((p) => ({ contactId: p.contactId, userId: accountMap.get(p.contactId) ?? null })),
    eventId,
    origin,
    true,
  );

  const recipients: PortalInviteRecipient[] = participants.map((p) => ({
    contactId: p.contactId,
    name: `${p.firstName} ${p.lastName}`.trim(),
    email: p.email,
  }));
  // Subject+body render from the ONE exported invitation template through
  // the shared merge/render machinery — never a string typed here.
  const { rendered, missingEmail } = renderPortalInvites(recipients, event.name, portalLinkByContactId);

  const { makeMailer } = await import("../server/context");
  const mailer = makeMailer(c.var.db, c.env);
  const batchId = newId();
  // DEC-805: a recipient with no address on file never reaches the mailer —
  // named here (not a silent skip) alongside any real send failure.
  const failed: { email: string; message: string }[] = missingEmail.map((m) => ({
    email: "",
    message: `${m.name} has no email address on file`,
  }));
  let sent = 0;
  for (const r of rendered) {
    const attempt = {
      to: { email: r.email, name: r.name },
      subject: r.subject,
      text: r.text,
      html: textToHtml(r.text),
      eventId,
      contactId: r.contactId,
      batchId,
    };
    try {
      await mailer.send(attempt);
      sent += 1;
    } catch (err) {
      // DEC-923: the mailer itself logs the failed attempt before
      // rethrowing — no route-level duplicate write.
      failed.push({ email: r.email, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return c.json({ sent, skipped: 0, failed });
});

function missingToFields(missing: { contactId: string; submissionId: string; fields: string[] }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const m of missing) {
    fields[`${m.contactId}:${m.submissionId}`] = `missing merge fields: ${m.fields.join(", ")}`;
  }
  return fields;
}

// Email log history: GET /api/v1/events/:eventId/email-log already landed on
// main (w2-i) at src/routes/api/email-log.ts, mounted separately in
// src/index.ts — not duplicated here (the task's contingency clause only
// applies if that route were missing). This file extends its repo function
// (listEmailLog, src/server/repo/email.ts) with the ?q filter the HistoryTab
// needs; see that route file for the endpoint itself.

// ---------------------------------------------------------------------------
// Per-recipient send detail (DEC-833)
// ---------------------------------------------------------------------------

// DEC-833: the audit surface for a single recipient's stored email_log row —
// getEmailLogById is already org-scoped (src/server/repo/email.ts:184), but
// an id belonging to a different event within the SAME org must still 404
// rather than let one event's "Show what was sent" disclosure read another
// event's mail (object-level ownership, not just org scoping).
commsRoutes.get("/api/v1/events/:eventId/email-log/:emailId", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const emailId = c.req.param("emailId");
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");

  const row = await getEmailLogById(c.var.db, emailId, auth.orgId);
  if (!row || row.eventId !== eventId) throw new ApiError("not_found", "Email not found");

  // DEC-949: the organizer-readable audit view never renders a live claim
  // grant — a `/claim/<token>` URL stored verbatim in email_log is a
  // credential. /dev/mailbox is intentionally left unredacted: it is
  // mounted only when DEV_MODE="1" and therefore does not exist in
  // production, which is what keeps the walkthrough gates able to click a
  // claim link.
  return c.json({
    ...row,
    bodyText: redactClaimUrls(row.bodyText),
    bodyHtml: row.bodyHtml === null ? null : redactClaimUrls(row.bodyHtml),
  });
});
