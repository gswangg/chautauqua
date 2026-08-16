// Bulk email (DEC-019 atomic send semantics, DEC-026 restricted whitelist).
// Split out of the former monolithic src/routes/api/contacts.ts for
// contention (803-line hotspot) reasons only; no behavior change.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError, parseBoundedIdArray } from "../../../server/http";
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../../forms/validate"; // DEC-417
import { overCapFieldMessage } from "../../../domain/cap-copy";
import * as repo from "../../../server/repo/contacts";
import { loadRecentlySent } from "../../../server/repo/comms";
import { getEventForOrg } from "../../../server/repo/events";
import type { KVStore } from "../../../auth/claim";
import { preflightRender, MAX_COMPOSE_RECIPIENTS, type RenderTarget } from "../../../domain/compose";
import { applyMintedPortalLinks, resolvePortalLinks } from "../../../server/repo/portal-link";
import { templateUsesMergeField, BULK_EMAIL_MERGE_FIELDS } from "../../../mail/render";
import { renderEmailHtml } from "../../../mail/shell";
import type { Db } from "../../../server/context";
import { resolveBaseUrl } from "../../../server/origin";
import { currentOrgId, asRecord } from "./shared";
import { newId } from "../../../domain/ids";
import { dedupeCutoff, dedupeKey } from "../../../domain/comms-dedupe";
import { DEC_766, DEC_238 } from "../../../decisions";
import { MAIL_FANOUT_CONCURRENCY, mapWithConcurrency } from "../../../lib/fanout";

void DEC_766;

// DEC-019/DEC-422 (amendment, wave 59): the bulk-email batch and the
// compose batch are ONE cap -- MAX_COMPOSE_RECIPIENTS (src/domain/compose.ts),
// never a private second literal.

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
  // DEC-182: parseBoundedIdArray's RESULT (deduped, order-preserved) is the
  // one array used below for both the org lookup and the full-match check —
  // never re-read the raw body, or a repeated contactId silently 404s or
  // double-sends.
  const contactIds = parseBoundedIdArray(body.contactIds, "contactIds", { maxCount: MAX_COMPOSE_RECIPIENTS });
  if (typeof body.eventId !== "string" || body.eventId.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { eventId: "required" });
  }
  if (typeof body.subject !== "string" || body.subject.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { subject: "required" });
  }
  if (body.subject.length > MAX_TEXT_LENGTH) {
    throw new ApiError("invalid", "Validation failed", { subject: overCapFieldMessage(body.subject.length, MAX_TEXT_LENGTH) }); // DEC-417
  }
  if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { bodyText: "required" });
  }
  if (body.bodyText.length > MAX_LONG_TEXT_LENGTH) {
    throw new ApiError("invalid", "Validation failed", { bodyText: overCapFieldMessage(body.bodyText.length, MAX_LONG_TEXT_LENGTH) }); // DEC-417
  }

  const event = await getEventForOrg(db, body.eventId, orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

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

/** DEC-856 (wave 60 amendment): the fields map must name the person, not
 * their opaque contactId — keyed by the recipient's EMAIL (the identifier
 * the organizer actually recognizes) with a value naming them and every
 * missing placeholder. Resolves name+email from `targets` (already loaded
 * by renderBulkEmailTargets — no extra D1 query). The ApiError's own
 * message leads with the count and the missing tokens so a client that
 * only reads err.message (never err.fields) still gets a usable refusal. */
function bulkEmailMergeFieldError(
  missing: { contactId: string; fields: string[] }[],
  targets: RenderTarget[],
  totalRecipients: number,
): ApiError {
  const fields: Record<string, string> = {};
  const allTokens = new Set<string>();
  for (const m of missing) {
    const target = targets.find((t) => t.contactId === m.contactId);
    const name = target?.name || target?.email || m.contactId;
    const tokens = m.fields.map((f) => `{${f}}`).join(", ");
    const key = target?.email ?? m.contactId;
    fields[key] = `${name} is missing ${tokens}`;
    for (const f of m.fields) allTokens.add(f);
  }
  const tokenList = [...allTokens].map((f) => `{${f}}`).join(", ");
  const allowed = BULK_EMAIL_MERGE_FIELDS.map((f) => `{${f}}`);
  const allowedList = allowed.length > 1
    ? `${allowed.slice(0, -1).join(", ")} and ${allowed[allowed.length - 1]}`
    : allowed.join(", ");
  return new ApiError(
    "invalid",
    `${missing.length} of ${totalRecipients} recipients are missing ${tokenList} — only ${allowedList} can be merged in a bulk email.`,
    fields,
  );
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
      throw bulkEmailMergeFieldError(preflightResult.missing, targets, targets.length);
    }

    // DEC-238 wave-14 amendment: bulk-email is the SAME dedupe class as
    // compose/send (src/routes/comms/send.ts:110-139) — mirrored here, not
    // reinvented. Stage 1 (intra-batch): collapse to the FIRST rendered
    // entry per lower-cased trimmed address — a bulk email renders one
    // subject for everyone, so two contact rows sharing an address would
    // otherwise each get a byte-identical copy. Stage 2 (cross-call): drop
    // any surviving entry whose (email, subject) was already sent within
    // COMPOSE_DEDUPE_WINDOW_MS (src/domain/comms-dedupe.ts) — the one
    // window, never a second literal.
    //
    // DEC-397 wave-62 amendment (MINT ONLY WHAT SHIPS): dedupe keys are
    // computed on the UNMINTED render (preflightResult), never on a
    // post-mint render — a claim token is never part of the dedupe
    // identity.
    void DEC_238;
    const seenAddresses = new Set<string>();
    let intraBatchSkipped = 0;
    const afterIntraBatch: typeof preflightResult.rendered = [];
    for (const rendered of preflightResult.rendered) {
      const addressKey = rendered.email.trim().toLowerCase();
      if (seenAddresses.has(addressKey)) {
        intraBatchSkipped += 1;
        continue;
      }
      seenAddresses.add(addressKey);
      afterIntraBatch.push(rendered);
    }
    const recentlySent = await loadRecentlySent(
      c.var.db,
      event.id,
      afterIntraBatch.map((r) => ({ email: r.email, subject: r.subject })),
      dedupeCutoff(Date.now()),
    );
    let crossCallSkipped = 0;
    const toSendKeys: typeof preflightResult.rendered = [];
    for (const rendered of afterIntraBatch) {
      if (recentlySent.has(dedupeKey(rendered.email, rendered.subject))) {
        crossCallSkipped += 1;
        continue;
      }
      toSendKeys.push(rendered);
    }

    // DEC-397 wave-62 amendment (MINT ONLY WHAT SHIPS): mint a claim
    // credential only for recipients that survived both dedupe stages —
    // createClaimToken supersedes any prior grant onto a fresh 48h TTL, so
    // minting for a skipped recipient would revoke their live,
    // already-delivered portal link and never deliver the replacement.
    // Only if the send actually references {portal_link} do we mint at all.
    // (Unlike content-notes.ts and reminders.ts, which always embed the
    // link in their fixed body text, this template is organizer-authored
    // and may omit it entirely.) Targets/recipients are narrowed to
    // toSendKeys' contactIds before minting, then just those targets are
    // re-rendered (preflightRender is pure, so this extra pass costs no
    // IO).
    const needsPortalLink = templateUsesMergeField(subject, "portal_link") || templateUsesMergeField(bodyText, "portal_link");
    const toSendContactIds = new Set(toSendKeys.map((r) => r.contactId));
    const toSendTargets = targets.filter((t) => toSendContactIds.has(t.contactId));
    const toSendRecipients = recipients.filter((r) => toSendContactIds.has(r.contactId));
    if (needsPortalLink && toSendTargets.length > 0) {
      await applyMintedPortalLinks(kv, toSendRecipients, event.id, origin, toSendTargets);
    }
    const finalResult = preflightRender(toSendTargets, subject, bodyText);
    if (!finalResult.ok) {
      throw bulkEmailMergeFieldError(finalResult.missing, toSendTargets, toSendTargets.length);
    }
    const toSend = finalResult.rendered;

    const { makeMailer } = await import("../../../server/context");
    // DEC-603: one id per fan-out call, shared by every recipient in this
    // loop, so the comms history tab can group the batch into one row.
    const batchId = newId();
    // DEC-238 class 2 (organizer-triggered batch): a bad recipient must not
    // abort the whole send — catch per-recipient, keep going, and report the
    // partial outcome in the 200 response rather than surfacing a 500.
    const failed: { email: string; message: string }[] = [];

    // DEC-547 amendment (wave 43): makeMailer never throws — it always
    // returns a Mailer (DevSinkMailer/EmailBindingMailer/UnconfiguredMailer), so a
    // misconfigured environment surfaces as a per-recipient 'failed' row
    // from UnconfiguredMailer.send inside the try/catch below, not here.
    const mailer = makeMailer(c.var.db, c.env);

    // DEC-530 wave-70 amendment: up to MAIL_FANOUT_CONCURRENCY sends in
    // flight at once; results come back in INPUT order so failed[] below
    // reconstructs exactly what the old sequential loop produced.
    const results = await mapWithConcurrency(toSend, MAIL_FANOUT_CONCURRENCY, async (rendered) => {
      const attempt = {
        to: { email: rendered.email, name: rendered.name },
        subject: rendered.subject,
        text: rendered.text,
        html: renderEmailHtml(rendered.text, {
          eventName: event.name,
          reason: `an organizer sent a bulk email to contacts of ${event.name}`,
        }),
        eventId: event.id,
        contactId: rendered.contactId,
        batchId,
      };
      await mailer.send(attempt);
    });
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const rendered = toSend[i]!;
        console.error("CRM bulk email failed for", rendered.email, result.reason);
        // DEC-923: the mailer itself logs the failed attempt before
        // rethrowing — no route-level duplicate write.
        const err = result.reason;
        failed.push({ email: rendered.email, message: err instanceof Error ? err.message : String(err) });
      }
    });

    // DEC-949 amendment: the send response must never carry rendered bodies
    // (they contain live claim tokens minted above) -- only the SPA-consumed
    // counts. The preview handler below legitimately returns `items`.
    // DEC-238 wave-14 amendment: `skipped` is a COUNT (both dedupe stages
    // combined), matching app/src/lib/sendResult.ts's SendResult contract —
    // not the per-recipient array compose/send returns.
    return c.json({ sent: toSend.length - failed.length, skipped: intraBatchSkipped + crossCallSkipped, failed });
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
    const { targets: previewTargets, result } = await renderBulkEmailTargets(c.var.db, kv, origin, event, previewContacts, subject, bodyText);
    if (!result.ok) {
      throw bulkEmailMergeFieldError(result.missing, previewTargets, previewTargets.length);
    }

    return c.json({
      items: result.rendered.map((r) => ({ contactId: r.contactId, email: r.email, subject: r.subject, bodyText: r.text })),
    });
  });
}
