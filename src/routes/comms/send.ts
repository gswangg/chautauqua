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
  const { makeMailer } = await import("../../server/context");
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
        html: renderEmailHtml(rendered.text, composeEmailShellOptions(event)),
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
