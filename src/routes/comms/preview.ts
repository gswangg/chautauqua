// Compose preview (DEC-019/DEC-397/DEC-883). Split out of the former
// monolithic src/routes/comms.ts — no behavior change.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as repo from "../../server/repo/comms";
import { preflightRender } from "../../domain/compose";
import { renderEmailHtml } from "../../mail/shell";
import { requireOwnedEvent } from "./shared";
import {
  requireFullMatch,
  resolveComposeInput,
  noRecipientFields,
  preflightIcsSchedule,
  icsPreviewInfoFor,
  buildRenderTargets,
  missingToFields,
  composeEmailShellOptions,
} from "./compose-core";

export const previewRoutes = new Hono<AppEnv>();

previewRoutes.post("/api/v1/events/:eventId/compose/preview", requireOrganizer, csrfJson, async (c) => {
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
  // DEC-037 amendment: the preview's `html` field renders through the exact
  // same shell (composeEmailShellOptions) that /compose/send wraps every
  // body in — preview-only, never returned by /compose/send (DEC-949).
  const items = result.rendered.map((r) => {
    const withHtml = { ...r, html: renderEmailHtml(r.text, composeEmailShellOptions(event)) };
    const withIcs = icsMap ? { ...withHtml, ics: icsPreviewInfoFor(icsMap.get(r.submissionId)!, event) } : withHtml;
    const feedback = feedbackByTarget.get(`${r.contactId}:${r.submissionId}`);
    return feedback !== undefined ? { ...withIcs, vars: { feedback } } : withIcs;
  });

  return c.json({ items });
});
