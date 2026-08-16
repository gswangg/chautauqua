// Compose send (DEC-019/DEC-051/DEC-238/DEC-397/DEC-547/DEC-603/DEC-923/
// DEC-949). Split out of the former monolithic src/routes/comms.ts — no
// behavior change.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as repo from "../../server/repo/comms";
import { bumpIcsSequences } from "../../server/repo/ics-sequence";
import type { KVStore } from "../../auth/claim";
import { applyMintedPortalLinks } from "../../server/repo/portal-link";
import { templateUsesMergeField } from "../../mail/render";
import { renderEmailHtml } from "../../mail/shell";
import { buildIcsEvent } from "../../mail/ics";
import { resolveIcsOrganizerEmail } from "../../server/context";
import { zonedMinutesToUtc } from "../../lib/timezone";
import { preflightRender } from "../../domain/compose";
import { resolveBaseUrl } from "../../server/origin";
import { newId } from "../../domain/ids";
import { requireOwnedEvent } from "./shared";
import { dedupeCutoff, planComposeSends } from "../../domain/comms-dedupe";
import { DEC_238, DEC_846 } from "../../decisions";
import { MAIL_FANOUT_CONCURRENCY, mapWithConcurrency } from "../../lib/fanout";
import {
  requireFullMatch,
  resolveComposeInput,
  noRecipientFields,
  preflightIcsSchedule,
  buildRenderTargets,
  missingToFields,
  composeEmailShellOptions,
} from "./compose-core";

export const sendRoutes = new Hono<AppEnv>();

sendRoutes.post("/api/v1/events/:eventId/compose/send", requireOrganizer, csrfJson, async (c) => {
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
    // wave 60 amendment (DEC-317): same named count as compose/preview.
    const blockedCount = Object.keys(noRecipients).length;
    throw new ApiError(
      "invalid",
      `${blockedCount} of ${input.submissionIds.length} selected sessions have no eligible recipients — every speaker on them has declined or has not been invited yet.`,
      noRecipients,
    );
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

  // DEC-397 wave-62 amendment (MINT ONLY WHAT SHIPS): dedupe keys are
  // computed on this UNMINTED render — a claim token is never part of the
  // dedupe identity. The mint itself is deferred past every 400 (including
  // templateId validation below) and past both dedupe stages, and then
  // narrowed to only the recipients that survive into `toSend` — see below.
  //
  // DEC-238 wave-3 amendment: refuse to deliver the same message (event,
  // lower(email), exact rendered subject) to the same address twice within
  // COMPOSE_DEDUPE_WINDOW_MS of the prior successful send — a gate-7 probe
  // re-sent the same template to the same recipients 40s apart and both were
  // emailed again. This runs BEFORE the send loop so a skip is decided from
  // one consistent snapshot of email_log, not interleaved with this call's
  // own sends.
  //
  // DEC-238 wave-15 amendment: mirrors bulk-email.ts's two-stage shape.
  // Stage 1 (intra-batch) runs FIRST, inside planComposeSends, before its
  // stage 2 consults `recentlySent` — a stage-1 collapse is never also
  // checked against the window. Unlike bulk-email (one subject for the
  // whole batch, so stage 1 keys on address alone), compose renders a
  // PER-SUBMISSION subject — a speaker with two accepted talks legitimately
  // gets two different messages to one address — so stage 1 here keys on
  // dedupeKey(email, subject) exactly like stage 2, not on address alone.
  // wave-60 note: `recentlySent` is loaded for every rendered row (not just
  // stage-1 survivors) because loadRecentlySent itself dedupes its wanted
  // keys into a Set — this is the same query cost, and it lets
  // /compose/preview call it identically without also re-implementing
  // stage 1 first.
  void DEC_238;
  const now = new Date();
  // wave-60 amendment (DEC-238, P1 cluster 4): the two-stage dedupe itself
  // now lives in the pure src/domain/comms-dedupe.ts planner (planComposeSends)
  // so /compose/preview can run the identical decision before any mail is
  // sent. This route still loads its own `recentlySent` snapshot (stage 2
  // needs a fresh read of email_log at send time, same as before) but the
  // stage-1/stage-2 logic itself is shared, not re-implemented here.
  //
  // wave-62 (DEC-397 MINT ONLY WHAT SHIPS): the planner is fed
  // `preflightResult.rendered` — the UNMINTED render — so a claim token is
  // never part of the dedupe identity. Its survivors are `toSendKeys`; the
  // mint and the final render happen below, after the last 400.
  const recentlySent = await repo.loadRecentlySent(
    c.var.db,
    eventId,
    preflightResult.rendered.map((r) => ({ email: r.email, subject: r.subject })),
    dedupeCutoff(now.getTime()),
  );
  const { toSend: toSendKeys, skipped } = planComposeSends(preflightResult.rendered, recentlySent);

  const submissionById = new Map(submissions.map((s) => [s.id, s]));
  // DEC-846 wave-3 amendment: templateId is PROVENANCE, not authority — the
  // composer always sends its own rendered subject/bodyText, but a posted
  // templateId must still name a real template of THIS event; an
  // unvalidated foreign id written into email_log.template_id is a
  // cross-tenant leak.
  void DEC_846;
  let templateId: string | undefined;
  if (body.templateId !== undefined) {
    if (typeof body.templateId !== "string") {
      throw new ApiError("invalid", "templateId must be a string", { templateId: "must be a string" });
    }
    const template = await repo.findTemplateById(c.var.db, body.templateId);
    if (!template || template.eventId !== eventId) {
      throw new ApiError("invalid", "Template not found for this event", { templateId: "not found for this event" });
    }
    templateId = template.id;
  }

  // DEC-397 wave-62 amendment (MINT ONLY WHAT SHIPS): mint a claim
  // credential only for recipients that survived every 400 (templateId
  // included) and both dedupe stages — createClaimToken supersedes any
  // prior grant onto a fresh 48h TTL, so minting for a `skipped` recipient
  // would revoke their live, already-delivered portal link and never
  // deliver the replacement. Only if the send actually references
  // {portal_link} do we mint at all. Targets/recipients are narrowed to
  // toSendKeys' contactIds before minting, then just those targets are
  // re-rendered (preflightRender is pure, so this extra pass costs no IO).
  const needsPortalLink =
    templateUsesMergeField(input.subjectTemplate, "portal_link") ||
    templateUsesMergeField(input.bodyTemplate, "portal_link");
  // Keyed on (contactId, submissionId) — not contactId alone — because a
  // speaker with two accepted talks (DEC-238 wave-15) has one target per
  // submission under the same contactId, and only some of those
  // submissions' messages may have survived dedupe.
  const toSendTargetKeys = new Set(toSendKeys.map((r) => `${r.contactId}::${r.submissionId}`));
  const toSendTargets = targets.filter((t) => toSendTargetKeys.has(`${t.contactId}::${t.submissionId}`));
  const toSendContactIds = new Set(toSendKeys.map((r) => r.contactId));
  const toSendRecipients = recipients.filter((r) => toSendContactIds.has(r.contactId));
  if (needsPortalLink && toSendTargets.length > 0) {
    const kv = c.env.KV as unknown as KVStore;
    const origin = resolveBaseUrl(c);
    await applyMintedPortalLinks(kv, toSendRecipients, event.id, origin, toSendTargets);
  }
  const finalResult = preflightRender(toSendTargets, input.subjectTemplate, input.bodyTemplate);
  if (!finalResult.ok) {
    throw new ApiError(
      "invalid",
      "One or more recipients are missing merge fields",
      missingToFields(finalResult.missing),
    );
  }
  const toSend = finalResult.rendered;

  const { makeMailer, d1EmailLogWriter } = await import("../../server/context");
  const mailer = makeMailer(c.var.db, c.env);
  // DEC-603: one id per fan-out call, shared by every recipient in this
  // loop, so the comms history tab can group the batch into one row.
  const batchId = newId();
  // DEC-238 class 2 (organizer-triggered batch): a bad recipient must not
  // abort the whole send — catch per-recipient, keep going, and report the
  // partial outcome in the 200 response rather than surfacing a 500.
  // DEC-530 wave-70 amendment: up to MAIL_FANOUT_CONCURRENCY sends are now
  // in flight at once instead of one strictly-sequential await per
  // recipient. mapWithConcurrency never rejects and returns results in
  // INPUT order, so the failed[] accounting below reconstructs byte-for-byte
  // what the old sequential try/catch loop produced.
  const results = await mapWithConcurrency(toSend, MAIL_FANOUT_CONCURRENCY, async (rendered) => {
    // DEC-547 amendment (wave 43): the ICS construction (and its
    // resolveIcsOrganizerEmail(c.env) config read, which can throw when
    // mail isn't configured) runs INSIDE this per-recipient unit — an
    // unconfigured deployment must land in `failed[]`, never 500.
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
      html: renderEmailHtml(rendered.text, composeEmailShellOptions(event)),
      ics,
      templateId,
      eventId,
      contactId: rendered.contactId,
      batchId,
    };
    await mailer.send(attempt);
  });
  const failed: { email: string; message: string }[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      // DEC-923: the mailer itself logs the failed attempt (status
      // 'failed') before rethrowing — no route-level duplicate write.
      const rendered = toSend[i]!;
      const err = result.reason;
      failed.push({ email: rendered.email, message: err instanceof Error ? err.message : String(err) });
    }
  });

  // DEC-238 (wave-8 amendment, sha efb77e4a): the comms history row must
  // agree with the send report about skipped recipients — write one
  // email_log row per `skipped` entry through the SAME single insert owner
  // (d1EmailLogWriter) that DevSinkMailer/EmailBindingMailer/UnconfiguredMailer
  // use, rather than a second insert site for schema.emailLog. `skipped`
  // entries do not carry contactId/subject/text (ComposeDedupeSkip is a
  // display shape shared with /compose/preview), so look each one back up
  // in `preflightResult.rendered` by (submissionId, lower(email)) — the same
  // UNMINTED render the planner itself was fed.
  //
  // Invariant 1: loadRecentlySent (src/server/repo/comms.ts) filters
  // `status = 'sent'`, so a skipped row written here can never itself count
  // as a prior send and cause a second skip — covered by
  // test/comms/send-skipped-log.route.test.ts.
  //
  // Invariant 2: no claim token is ever minted for a skipped recipient
  // (minting above is narrowed to `toSendTargets`), so the body stored here
  // is the UNMINTED preflightResult.rendered text/subject and must contain
  // no {portal_link} substitution — also covered by that test.
  if (skipped.length > 0) {
    const renderedBySubmissionAndEmail = new Map(
      preflightResult.rendered.map((r) => [`${r.submissionId}::${r.email.trim().toLowerCase()}`, r]),
    );
    const emailLogWriter = d1EmailLogWriter(c.var.db);
    const sentAtMs = now.getTime();
    for (const skip of skipped) {
      const source = renderedBySubmissionAndEmail.get(`${skip.submissionId}::${skip.email.trim().toLowerCase()}`);
      if (!source) continue;
      await emailLogWriter.write({
        eventId,
        contactId: source.contactId,
        templateId,
        batchId,
        toEmail: source.email,
        toName: source.name,
        subject: source.subject,
        bodyText: source.text,
        // No html render exists for a skipped recipient -- their message
        // never reached the shell-rendering step (send.ts:235 runs only
        // inside the fan-out loop, over `toSend`, not over `skipped`).
        bodyHtml: "",
        provider: "none",
        status: "skipped",
        sentAt: sentAtMs,
      });
    }
  }

  // Bump ics_sequence exactly once per submission per send call — after
  // every recipient of every submission has been sent the CURRENT stored
  // sequence value (DEC-051). Never runs on preview.
  //
  // RULING (DEC-238 wave-3 amendment, dedupe): this bump stays UNCONDITIONAL
  // over every submission in input.submissionIds, exactly as before the
  // dedupe change — it does NOT narrow to submissions with at least one
  // toSend recipient. The pre-existing behavior already bumps the sequence
  // even when every recipient of a submission lands in `failed` (a
  // mailer-failure outcome), so a dedupe skip — a strictly milder, expected
  // outcome — is held to the same standard: the sequence is a property of
  // "this send call attempted this submission", not of how many of its
  // recipients actually received mail this time.
  if (icsMap) {
    await bumpIcsSequences(c.var.db, input.submissionIds);
  }

  // DEC-949 amendment: the send response must never carry rendered bodies
  // (they contain live claim tokens minted above) -- only the SPA-consumed
  // counts. Preview handlers legitimately return `items`; send never does.
  return c.json({ sent: toSend.length - failed.length, skipped, failed });
});
