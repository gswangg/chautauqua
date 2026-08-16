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
import { dedupeCutoff, planComposeSends } from "../../domain/comms-dedupe";
import { DEC_238 } from "../../decisions";
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
    // wave 60 amendment (DEC-317): name the count so the composer can tell
    // the organizer how many of the selection are blocked, not just that
    // some are -- the ids themselves travel in `fields` as before.
    const blockedCount = Object.keys(noRecipients).length;
    throw new ApiError(
      "invalid",
      `${blockedCount} of ${input.submissionIds.length} selected sessions have no eligible recipients — every speaker on them has declined or has not been invited yet.`,
      noRecipients,
    );
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

  // wave-60 amendment (DEC-238, P1 cluster 4): preview must run the EXACT
  // SAME two-stage dedupe decision /compose/send is about to make — a
  // preview that promises "36 emails" while send only sends 6 is the P1
  // this closes. Same planner (src/domain/comms-dedupe.ts), same
  // recentlySent snapshot shape (loaded fresh here, exactly like send.ts):
  // a skip decided on preview's snapshot can still change by the time send
  // actually runs (another organizer's concurrent send, or the window
  // simply advancing), so this is a best-effort PLAN, not a guarantee —
  // but it is never a fabricated number: it is the same arithmetic send.ts
  // would run against the same input right now.
  void DEC_238;
  const recentlySent = await repo.loadRecentlySent(
    c.var.db,
    eventId,
    result.rendered.map((r) => ({ email: r.email, subject: r.subject })),
    dedupeCutoff(Date.now()),
  );
  const { toSend, skipped } = planComposeSends(result.rendered, recentlySent);
  const toSendSet = new Set(toSend);
  const skipByKey = new Map(skipped.map((s) => [`${s.submissionId}:${s.email.trim().toLowerCase()}`, s]));

  // DEC-037 amendment: the preview's `html` field renders through the exact
  // same shell (composeEmailShellOptions) that /compose/send wraps every
  // body in — preview-only, never returned by /compose/send (DEC-949).
  const items = result.rendered.map((r) => {
    const withHtml = { ...r, html: renderEmailHtml(r.text, composeEmailShellOptions(event)) };
    const withIcs = icsMap ? { ...withHtml, ics: icsPreviewInfoFor(icsMap.get(r.submissionId)!, event) } : withHtml;
    const feedback = feedbackByTarget.get(`${r.contactId}:${r.submissionId}`);
    const withFeedback = feedback !== undefined ? { ...withIcs, vars: { feedback } } : withIcs;
    // Per-item disposition: which of send's two outcomes this recipient
    // would land in right now, so the SPA can render a per-row skip badge
    // without re-deriving the dedupe decision client-side.
    if (toSendSet.has(r)) {
      return { ...withFeedback, willSend: true as const };
    }
    const skip = skipByKey.get(`${r.submissionId}:${r.email.trim().toLowerCase()}`)!;
    return { ...withFeedback, willSend: false as const, skipReason: skip.reason, retryAtIso: skip.retryAtIso };
  });

  // `plan.willSend` is the number the primary Send button must display —
  // never `items.length` (the raw per-(contact,submission) expansion),
  // which is what produced the "Send 36 emails" / "6 sent" mismatch this
  // closes. `plan.skipped` is the same named-recipient list send.ts's 200
  // response returns, so the wizard can name the collapsed ones before the
  // organizer commits, not only after.
  return c.json({ items, plan: { willSend: toSend.length, skipped } });
});
