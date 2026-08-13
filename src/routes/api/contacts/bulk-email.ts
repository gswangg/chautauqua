// Bulk email (DEC-019 atomic send semantics, DEC-026 restricted whitelist).
// Split out of the former monolithic src/routes/api/contacts.ts for
// contention (803-line hotspot) reasons only; no behavior change.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError, parseBoundedIdArray } from "../../../server/http";
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../../forms/validate"; // DEC-417
import * as repo from "../../../server/repo/contacts";
import { getEventForOrg } from "../../../server/repo/events";
import type { KVStore } from "../../../auth/claim";
import { preflightRender, type RenderTarget } from "../../../domain/compose";
import { applyMintedPortalLinks, resolvePortalLinks } from "../../../server/repo/portal-link";
import { textToHtml } from "../../../mail/render";
import type { Db } from "../../../server/context";
import { resolveBaseUrl } from "../../../server/origin";
import { currentOrgId, asRecord } from "./shared";
import { newId } from "../../../domain/ids";
import { DEC_766 } from "../../../decisions";

void DEC_766;

const MAX_BULK_EMAIL_RECIPIENTS = 100;

type BulkEmailRequest = {
  event: { id: string; name: string };
  contacts: repo.ContactRow[];
  subject: string;
  bodyText: string;
};

/** Shared validation for bulk-email send + preview (w2-c): checks
 * contactIds shape/cap, required eventId/subject/bodyText, org-scoped
 * event lookup, and that every contactId resolves to an org-owned
 * contact (IDOR guard — "foreign" contactIds are rejected here). */
async function validateBulkEmailRequest(db: Db, orgId: string, body: Record<string, unknown>): Promise<BulkEmailRequest> {
  // DEC-182
  parseBoundedIdArray(body.contactIds, "contactIds", { maxCount: MAX_BULK_EMAIL_RECIPIENTS });
  if (typeof body.eventId !== "string" || body.eventId.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { eventId: "required" });
  }
  if (typeof body.subject !== "string" || body.subject.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { subject: "required" });
  }
  if (body.subject.length > MAX_TEXT_LENGTH) {
    throw new ApiError("invalid", "Validation failed", { subject: `Max ${MAX_TEXT_LENGTH}` }); // DEC-417
  }
  if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { bodyText: "required" });
  }
  if (body.bodyText.length > MAX_LONG_TEXT_LENGTH) {
    throw new ApiError("invalid", "Validation failed", { bodyText: `Max ${MAX_LONG_TEXT_LENGTH}` }); // DEC-417
  }

  const event = await getEventForOrg(db, body.eventId, orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

  const contactIds = body.contactIds as string[];
  const contacts = await repo.findContactsForOrg(db, contactIds, orgId);
  if (contacts.length !== contactIds.length) {
    throw new ApiError("not_found", "One or more contacts not found");
  }

  return { event, contacts, subject: body.subject, bodyText: body.bodyText };
}

/** Builds the RenderTarget[] (DEC-026 contact-scoped merge vars) for a
 * subset of contacts, then runs preflightRender — the single merge-field
 * rendering path shared by both POST /contacts/bulk-email (send) and
 * POST /contacts/bulk-email/preview. */
async function renderBulkEmailTargets(
  db: Db,
  kv: KVStore,
  origin: string,
  event: { id: string; name: string },
  contacts: repo.ContactRow[],
  subject: string,
  bodyText: string,
) {
  // DEC-530: resolve account identity once for the whole contact batch
  // instead of once per contact.
  const accountMap = await repo.findAccountUserIds(
    db,
    contacts.map((c) => ({ contactId: c.id, email: c.email })),
  );

  // DEC-397 wave-50 amendment (MINT LATE): the render pass that VALIDATES
  // always resolves links with mintClaimTokens=false — zero KV writes, a
  // non-empty PREVIEW_CLAIM_TOKEN placeholder so merge-field presence checks
  // behave identically to a real send. The send handler mints real tokens
  // via applyMintedPortalLinks only after preflightRender accepts the batch.
  const recipients = contacts.map((c) => ({ contactId: c.id, userId: accountMap.get(c.id) ?? null }));
  const portalLinkMap = await resolvePortalLinks(kv, recipients, event.id, origin, false);

  const targets: RenderTarget[] = [];
  for (const contact of contacts) {
    const portalLink = portalLinkMap.get(contact.id);
    if (!portalLink) throw new Error(`no portal link resolved for contactId ${contact.id}`);
    targets.push({
      contactId: contact.id,
      submissionId: "",
      email: contact.email,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      // DEC-912's ref/scheduled describe a talk; bulk email is
      // contact-scoped (DEC-026), not submission-scoped, so there is no
      // talk to name here.
      ref: "",
      scheduled: false,
      vars: {
        speaker_name: `${contact.firstName} ${contact.lastName}`.trim(),
        event_name: event.name,
        portal_link: portalLink,
      },
    });
  }
  const result = preflightRender(targets, subject, bodyText);
  return { targets, recipients, result };
}

const BULK_EMAIL_PREVIEW_LIMIT = 5;

export function registerBulkEmailRoutes(contactsRoutes: Hono<AppEnv>): void {
  contactsRoutes.post("/contacts/bulk-email", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    const { event, contacts, subject, bodyText } = await validateBulkEmailRequest(c.var.db, orgId, body);

    const kv = c.env.KV as unknown as KVStore;
    const origin = resolveBaseUrl(c);

    // Atomic preflight (DEC-019): every recipient must render before the
    // first send is attempted; any failure (including a submission-scoped
    // placeholder like {talk_title}/{feedback}, absent from the whitelist
    // above) rejects the whole batch — zero sends.
    // DEC-397 wave-50 amendment (MINT LATE): renderBulkEmailTargets always
    // resolves links with mintClaimTokens=false, so this preflight throws
    // the 400 BEFORE any KV credential is minted. Only once it accepts the
    // batch do we mint real portal links and re-run preflightRender
    // (preflightRender is pure — the second pass costs no IO).
    const { targets, recipients, result: preflightResult } = await renderBulkEmailTargets(
      c.var.db,
      kv,
      origin,
      event,
      contacts,
      subject,
      bodyText,
    );
    if (!preflightResult.ok) {
      const fields: Record<string, string> = {};
      for (const m of preflightResult.missing) fields[m.contactId] = `missing merge fields: ${m.fields.join(", ")}`;
      throw new ApiError("invalid", "One or more recipients are missing merge fields (only speaker_name/event_name/portal_link are allowed)", fields);
    }

    await applyMintedPortalLinks(kv, recipients, event.id, origin, targets);
    const result = preflightRender(targets, subject, bodyText);
    if (!result.ok) {
      const fields: Record<string, string> = {};
      for (const m of result.missing) fields[m.contactId] = `missing merge fields: ${m.fields.join(", ")}`;
      throw new ApiError("invalid", "One or more recipients are missing merge fields (only speaker_name/event_name/portal_link are allowed)", fields);
    }

    const { makeMailer } = await import("../../../server/context");
    // DEC-603: one id per fan-out call, shared by every recipient in this
    // loop, so the comms history tab can group the batch into one row.
    const batchId = newId();
    // DEC-238 class 2 (organizer-triggered batch): a bad recipient must not
    // abort the whole send — catch per-recipient, keep going, and report the
    // partial outcome in the 200 response rather than surfacing a 500.
    const failed: { email: string; message: string }[] = [];

    // DEC-547 amendment (wave 43): makeMailer never throws — it always
    // returns a Mailer (DevSinkMailer/ResendMailer/UnconfiguredMailer), so a
    // misconfigured environment surfaces as a per-recipient 'failed' row
    // from UnconfiguredMailer.send inside the try/catch below, not here.
    const mailer = makeMailer(c.var.db, c.env);

    for (const rendered of result.rendered) {
      const attempt = {
        to: { email: rendered.email, name: rendered.name },
        subject: rendered.subject,
        text: rendered.text,
        html: textToHtml(rendered.text),
        eventId: event.id,
        contactId: rendered.contactId,
        batchId,
      };
      try {
        await mailer.send(attempt);
      } catch (err) {
        console.error("CRM bulk email failed for", rendered.email, err);
        // DEC-923: the mailer itself logs the failed attempt before
        // rethrowing — no route-level duplicate write.
        failed.push({ email: rendered.email, message: err instanceof Error ? err.message : String(err) });
      }
    }

    // DEC-949 amendment: the send response must never carry rendered bodies
    // (they contain live claim tokens minted above) -- only the SPA-consumed
    // counts. The preview handler below legitimately returns `items`.
    return c.json({ sent: result.rendered.length - failed.length, failed });
  });

  /** CRM-11 (DEC-150): preview uses the exact same merge-field rendering
   * helper as the send path, capped to the first 5 recipients. Never
   * writes email_log — no mailer call. */
  contactsRoutes.post("/contacts/bulk-email/preview", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    const { event, contacts, subject, bodyText } = await validateBulkEmailRequest(c.var.db, orgId, body);

    const kv = c.env.KV as unknown as KVStore;
    const origin = resolveBaseUrl(c);
    const previewContacts = contacts.slice(0, BULK_EMAIL_PREVIEW_LIMIT);

    // DEC-397: preview never mints credentials — renderBulkEmailTargets
    // always resolves links with mintClaimTokens=false now.
    const { result } = await renderBulkEmailTargets(c.var.db, kv, origin, event, previewContacts, subject, bodyText);
    if (!result.ok) {
      const fields: Record<string, string> = {};
      for (const m of result.missing) fields[m.contactId] = `missing merge fields: ${m.fields.join(", ")}`;
      throw new ApiError("invalid", "One or more recipients are missing merge fields (only speaker_name/event_name/portal_link are allowed)", fields);
    }

    return c.json({
      items: result.rendered.map((r) => ({ contactId: r.contactId, email: r.email, subject: r.subject, bodyText: r.text })),
    });
  });
}
