// Per-speaker portal invitation (DEC-805). Split out of the former
// monolithic src/routes/comms.ts — no behavior change.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireCookieSession, requireOrganizer } from "../../server/middleware";
import { ApiError, parseBoundedIdArray, readJsonBody } from "../../server/http";
import * as repo from "../../server/repo/comms";
import { markParticipantsInvited } from "../../server/repo/participants";
import type { KVStore } from "../../auth/claim";
import { mintPortalLinks } from "../../server/repo/portal-link";
import { renderEmailHtml } from "../../mail/shell";
import { portalInviteReason } from "../../mail/reasons";
import {
  MAX_PORTAL_INVITE_RECIPIENTS,
  renderPortalInvites,
  type PortalInviteRecipient,
} from "../../domain/portal-invite";
import { resolveBaseUrl } from "../../server/origin";
import { newId } from "../../domain/ids";
import { requireOwnedEvent } from "./shared";
import { eventDatesLine } from "../../domain/event-meta";
import { describeUnresolvedSelection } from "../../lib/refusal-copy"; // DEC-856
import { MAIL_FANOUT_CONCURRENCY, mapWithConcurrency } from "../../lib/fanout";
import { DEC_027 } from "../../decisions";

void DEC_027;

export const portalInvitesRoutes = new Hono<AppEnv>();

// DEC-027 wave-18/wave-20 amendments: this route mints real claim tokens
// (mintPortalLinks below, DEC-027 wave-20's named entry point over
// resolvePortalLinks(..., true)) — a claim-token mint is a credential
// mint, so requireCookieSession goes immediately after the role guard.
portalInvitesRoutes.post("/api/v1/events/:eventId/portal-invites", requireOrganizer, requireCookieSession, csrfJson, async (c) => {
  const eventId = c.req.param("eventId");
  const event = await requireOwnedEvent(c, eventId);

  const body = await readJsonBody(c);
  const contactIds = parseBoundedIdArray(body.contactIds, "contactIds", {
    maxCount: MAX_PORTAL_INVITE_RECIPIENTS,
  });

  // Atomic preflight (DEC-805/DEC-019 precedent): every requested contactId
  // must be a participant on a submission in this event, or the whole call
  // fails loudly naming the ids that aren't — no half-sent batches.
  const participants = await repo.findParticipantContactsForEvent(c.var.db, eventId, contactIds);
  const foundIds = new Set(participants.map((p) => p.contactId));
  const missing = contactIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const resolvedNames = participants.map((p) => `${p.firstName} ${p.lastName}`.trim());
    throw new ApiError("invalid", "One or more contacts are not a participant on a submission in this event", {
      contactIds: describeUnresolvedSelection(resolvedNames, missing.length, "refresh the page and reselect"), // DEC-856
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
  const portalLinkByContactId = await mintPortalLinks(
    kv,
    participants.map((p) => ({ contactId: p.contactId, userId: accountMap.get(p.contactId) ?? null })),
    eventId,
    origin,
  );

  const recipients: PortalInviteRecipient[] = participants.map((p) => ({
    contactId: p.contactId,
    name: `${p.firstName} ${p.lastName}`.trim(),
    email: p.email,
  }));
  // Subject+body render from the ONE exported invitation template through
  // the shared merge/render machinery — never a string typed here.
  const { rendered, missingEmail } = renderPortalInvites(recipients, event.name, portalLinkByContactId);

  const { makeMailer } = await import("../../server/context");
  const mailer = makeMailer(c.var.db, c.env);
  const batchId = newId();
  // DEC-805: a recipient with no address on file never reaches the mailer —
  // named here (not a silent skip) alongside any real send failure.
  const failed: { email: string; message: string }[] = missingEmail.map((m) => ({
    email: "",
    message: `${m.name} has no email address on file`,
  }));
  // DEC-530 wave-70 amendment: up to MAIL_FANOUT_CONCURRENCY sends in
  // flight at once; results come back in INPUT order so the accounting
  // below reconstructs exactly what the old sequential loop produced.
  const results = await mapWithConcurrency(rendered, MAIL_FANOUT_CONCURRENCY, async (r) => {
    const attempt = {
      to: { email: r.email, name: r.name },
      subject: r.subject,
      text: r.text,
      html: renderEmailHtml(r.text, {
        eventName: event.name,
        reason: portalInviteReason(event.name),
        eventMeta: eventDatesLine(event),
      }),
      eventId,
      contactId: r.contactId,
      batchId,
    };
    await mailer.send(attempt);
  });
  let sent = 0;
  const invitedContactIds: string[] = [];
  results.forEach((result, i) => {
    const r = rendered[i]!;
    if (result.status === "fulfilled") {
      sent += 1;
      invitedContactIds.push(r.contactId);
      return;
    }
    // DEC-923: the mailer itself logs the failed attempt before
    // rethrowing — no route-level duplicate write.
    const err = result.reason;
    failed.push({ email: r.email, message: err instanceof Error ? err.message : String(err) });
  });

  // DEC-805/DEC-869: the send OWNS the 'invited' participation state — the
  // participation menu removed 'invited' from its selectable states because
  // this action mints it ("Emails a claim link and sets this to Invited").
  // Only the recipients whose send actually succeeded are marked; a recipient
  // with no address on file, or whose send threw, keeps its current state.
  await markParticipantsInvited(c.var.db, eventId, invitedContactIds);

  return c.json({ sent, skipped: 0, failed });
});
