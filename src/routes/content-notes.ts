// DEC-720/DEC-741: asking for changes is a MESSAGE, not a column flip. This
// is a NEW file (not files.ts) precisely because files.ts carries the
// DEC-009 invariant "this module MUST NEVER import a mailer" — the content
// note endpoint's whole job is to post a note to the DEC-573 chain thread,
// optionally move content_status, and mail the submission's active-invite
// participants so the send appears in Comms history. Approval stays
// entirely silent (no code path here ever sets 'approved').

import { Hono, type Context } from "hono";
import type { AppEnv, AuthInfo } from "../server/env";
import { requireOrganizer, csrfJson } from "../server/middleware";
import { ApiError, readOptionalJsonBody } from "../server/http";
import { MAX_COMMENT_BODY_LENGTH } from "../domain/files"; // DEC-244
import { plural } from "../domain/count-copy"; // DEC-925/DEC-987
import { makeMailer } from "../server/context";
import { resolveBaseUrl } from "../server/origin";
import { renderEmailHtml } from "../mail/shell";
import { getEventForOrg } from "../server/repo/events";
import { newId } from "../domain/ids";
import type { KVStore } from "../auth/claim";
import { resolvePortalLinks } from "../server/repo/portal-link";
import { getFileScope, getSubmissionScope, insertFileComment, updateContentStatus } from "../server/repo/files";
import { findAccountUserIds, loadComposeSubmissions } from "../server/repo/comms";
import { noRecipientFields } from "./comms";
import { DEC_009, DEC_317, DEC_573, DEC_720, DEC_741 } from "../decisions";

void DEC_009;
void DEC_317;
void DEC_573;
void DEC_720;
void DEC_741;

// Mounted at /api/v1 in src/index.ts.
export const contentNoteRoutes = new Hono<AppEnv>();

function requireAuth(c: Context<AppEnv>): AuthInfo {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth;
}

interface ContentNoteBody {
  fileId?: unknown;
  body?: unknown;
  requestChanges?: unknown;
}

// -----------------------------------------------------------------------
// POST /api/v1/submissions/:id/content-note — organizer-only (DEC-741)
// -----------------------------------------------------------------------
contentNoteRoutes.post("/submissions/:id/content-note", requireOrganizer, csrfJson, async (c) => {
  const auth = requireAuth(c);
  const submissionId = c.req.param("id");

  const scope = await getSubmissionScope(c.var.db, submissionId);
  if (!scope) throw new ApiError("not_found", "Submission not found");
  if (scope.orgId !== auth.orgId) throw new ApiError("not_found", "Submission not found");

  const body = (await readOptionalJsonBody(c)) as unknown as ContentNoteBody;

  if (typeof body.fileId !== "string" || body.fileId.trim() === "") {
    throw new ApiError("invalid", "fileId is required", { fileId: "Required" });
  }
  const fileId = body.fileId;

  const noteText = typeof body.body === "string" ? body.body.trim() : "";
  if (!noteText) throw new ApiError("invalid", "body is required", { body: "Required" });
  if (noteText.length > MAX_COMMENT_BODY_LENGTH) {
    const overBy = noteText.length - MAX_COMMENT_BODY_LENGTH;
    throw new ApiError(
      "invalid",
      `Note is too long by ${overBy.toLocaleString("en-US")} ${plural(overBy, "character")} — keep it to ${MAX_COMMENT_BODY_LENGTH.toLocaleString("en-US")} characters or fewer.`,
      { body: `Too long by ${overBy.toLocaleString("en-US")} ${plural(overBy, "character")}` },
    ); // DEC-244
  }

  if (typeof body.requestChanges !== "boolean") {
    throw new ApiError("invalid", "requestChanges must be a boolean", { requestChanges: "Required" });
  }
  const requestChanges = body.requestChanges;

  // fileId must name a file attached to THIS submission — an IDOR guard
  // (a note posting to another submission's chain thread would be a leak).
  const fileScope = await getFileScope(c.var.db, fileId);
  if (!fileScope || fileScope.submissionId !== submissionId) {
    throw new ApiError("invalid", "fileId does not reference a file on this submission", { fileId: "Invalid" });
  }

  // DEC-317: resolve the SAME active-invite recipient set the comms compose
  // path uses — before any send, and before any write (atomic per DEC-019).
  const [composeSubmission] = await loadComposeSubmissions(c.var.db, scope.eventId, [submissionId]);
  const noRecipients = noRecipientFields(composeSubmission ? [composeSubmission] : [], [submissionId]);
  if (Object.keys(noRecipients).length > 0) {
    throw new ApiError("invalid", "This session has no eligible recipients to notify", noRecipients); // DEC-317
  }

  // Post the note to the DEC-573 chain thread (writes anchor on the latest
  // file id in the chain, same row /files/:fileId/comments POST writes).
  await insertFileComment(c.var.db, {
    fileId,
    body: noteText,
    authorUserId: auth.userId,
    authorContactId: auth.contactId ?? null,
  });

  // DEC-720: never sets 'approved', never mails on approval — status only
  // moves (to changes_requested) when the caller explicitly asked for that.
  if (requestChanges) {
    await updateContentStatus(c.var.db, submissionId, "changes_requested");
  }

  const kv = c.env.KV as unknown as KVStore;
  const origin = resolveBaseUrl(c);
  // B9: the note-reply shell names the event in its wordmark/footer
  // (DEC-037 amendment) -- scope already validated auth.orgId owns it above.
  const noteEvent = await getEventForOrg(c.var.db, scope.eventId, auth.orgId);
  const accountMap = await findAccountUserIds(
    c.var.db,
    composeSubmission!.participants.map((p) => ({ contactId: p.contactId, email: p.email })),
  );

  // DEC-547 amendment (wave 43): construct the mailer lazily, inside the
  // per-recipient guarded region below, so a note reply on an unconfigured
  // deployment returns { sent, failed } instead of 500ing before any
  // participant is attempted.
  const batchId = newId();
  const subject = `A note on "${composeSubmission!.title}"`;

  // DEC-530 wave-42 amendment: resolve every participant's portal link (and
  // mint any claim tokens needed) through ONE batched Promise.all before the
  // send loop, instead of an await-per-participant KV round trip inside it.
  const portalLinkMap = await resolvePortalLinks(
    kv,
    composeSubmission!.participants.map((p) => ({ contactId: p.contactId, userId: accountMap.get(p.contactId) ?? null })),
    scope.eventId,
    origin,
    true,
  );

  // DEC-238 class 2 (organizer-triggered batch): a bad recipient must not
  // abort the whole send — catch per-recipient, keep going, report partial
  // outcome in the 200 response.
  const failed: { email: string; message: string }[] = [];
  let sent = 0;
  for (const participant of composeSubmission!.participants) {
    const portalLink = portalLinkMap.get(participant.contactId);
    if (!portalLink) throw new Error(`no portal link resolved for contactId ${participant.contactId}`);
    const name = `${participant.firstName} ${participant.lastName}`.trim();
    const text = `${noteText}\n\nView your submission: ${portalLink}`;
    try {
      const mailer = makeMailer(c.var.db, c.env);
      await mailer.send({
        to: { email: participant.email, name },
        subject,
        text,
        html: renderEmailHtml(text, {
          eventName: noteEvent?.name ?? null,
          reason: `an organizer left a note on your submission${requestChanges ? " requesting changes" : ""}`,
        }),
        eventId: scope.eventId,
        contactId: participant.contactId,
        batchId,
      });
      sent += 1;
    } catch (err) {
      console.error("content-note send failed for", participant.email, err);
      failed.push({ email: participant.email, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return c.json({ sent, failed });
});
