// Public CFP submission SSR (J1 share link + J2 submit), per DEC-005
// (/submit/:eventSlug), DEC-006 (confirmation email via the Mailer port),
// DEC-008 (form engine + server-side validation), DEC-012 (thin handlers:
// parse/authz -> repo -> pure core -> response), DEC-014 (drafts + claim
// token), DEC-016 (locked fields persist to real columns). Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012).
//
// View components (SubmitPage, ConfirmationPage, etc.) live in
// ./submit-views.tsx and request-parsing helpers live in ./submit-body.ts —
// split out of this file purely to reduce merge contention; no behavior
// change (all route paths and exports are unchanged).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfForm, checkDoubleSubmitCsrf } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { makeMailer, makeFileStore } from "../../server/context";
import {
  getEventBySlug,
  getDefaultForm,
  getFormFields,
  getEventTracks,
  findContactByEmail,
  createContact,
  createSubmission,
  createParticipant,
  createSubmissionTracks,
  upsertSubmissionAnswers,
  insertAttachmentFile,
} from "../../server/repo/submit";
import { findAccountUserId } from "../../server/repo/comms";
import { commitSubmissionDelete } from "../../server/repo/submission-delete";
import { validateAnswers } from "../../forms/validate";
import { makeVisibilityPredicate } from "../../forms/visibility";
import type { AnswerMap } from "../../forms/types";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS } from "../../forms/types";
import {
  formWindowState,
  validateTrackChoice,
  resolveOfferedTrackIds,
  extractFileAnswers,
} from "../../lib/submit-core";
import { requestIpFromHeaders } from "../../lib/rate-limit";
import { checkAndIncrementScopedLimit } from "../../server/repo/rate-limit";
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../forms/validate";
import { DEC_814 } from "../../decisions";
// implements DEC_814 (an anonymous CFP match never writes to the CRM contact row).
void DEC_814;
import {
  saveDraft,
  readDraft,
  deleteDraft,
  newDraftToken,
  draftCookieName,
  type KVStore as DraftKVStore,
} from "../../lib/draft";
import { createClaimToken, type KVStore as ClaimKVStore } from "../../auth/claim";
import { parseCookies, newCsrfToken, buildCsrfCookie, buildDraftCookie, isSecureRequest, CSRF_COOKIE_NAME } from "../../auth/cookies";
import { renderTemplate, escapeHtml } from "../../mail/render";
import { validateUpload, sanitizeFilenameForKey, type ValidUpload } from "../../domain/files";
import { newId, formatRef } from "../../domain/ids";
import { fieldInputName } from "../../views/form-render";
import {
  DEC_014,
  DEC_016,
  DEC_036,
  DEC_040,
  DEC_132,
  DEC_252,
  DEC_366,
  DEC_367,
  DEC_371,
  DEC_373,
  DEC_374,
  DEC_377,
} from "../../decisions";
import { resolveBaseUrl } from "../../server/origin";
import { publicNotFound } from "./not-found";
import {
  ClosedPage,
  ConfirmationPage,
  NotYetOpenPage,
  SubmitPage,
  type ConfirmationState,
} from "./submit-views";
import { ensureCsrfCookie, extractAnswers, extractTrackIds } from "./submit-body";

void DEC_252;

export const publicSubmitRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_014;
void DEC_016;
void DEC_036;
void DEC_040;
void DEC_132;
void DEC_366;
void DEC_367;
void DEC_371;
void DEC_373;
void DEC_374;
void DEC_377;

// DEC-374: the strict hex-only guard for the per-event accent is the one
// exported from ./shell (validAccent) -- anything that doesn't match becomes
// the default brand olive, never interpolated unchecked into a style
// attribute. Every public SSR surface shares that single guard so the CFP
// page and the branded event pages can never disagree about what a valid
// accent is.

// DEC-626/DEC-020: a cheap same-origin check runs BEFORE the body is ever
// parsed on the final-submit POST -- the Origin header (falling back to
// Referer when Origin is absent, matching ordinary browser behavior for
// same-site navigations/older UAs) must name the same host this request
// arrived on. When NEITHER header is present this fails OPEN (the
// double-submit CSRF token compared later remains the primary defense;
// some legitimate clients send neither header) -- only a header that is
// present and names a DIFFERENT host is treated as cross-origin.
function isSameOriginSubmitPost(c: { req: { url: string; header(name: string): string | undefined } }): boolean {
  const candidate = c.req.header("Origin") ?? c.req.header("Referer");
  if (!candidate) return true;
  let candidateHost: string;
  try {
    candidateHost = new URL(candidate).host;
  } catch {
    return false;
  }
  return candidateHost === new URL(c.req.url).host;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

publicSubmitRoutes.get("/submit/:eventSlug", async (c) => {
  const db = c.var.db;
  const event = await getEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const form = await getDefaultForm(db, event.id);
  if (!form) return publicNotFound(c, "This event is not accepting submissions yet.");

  const windowState = formWindowState(form.openDate, form.closeDate, Date.now(), event.timezone);
  if (windowState === "not_yet_open") {
    return c.html(<NotYetOpenPage event={event} form={form} />);
  }
  if (windowState === "closed") {
    return c.html(<ClosedPage event={event} form={form} />);
  }

  const fields = await getFormFields(db, form.id);
  const eventTracks = await getEventTracks(db, event.id);
  const offeredTrackIds = resolveOfferedTrackIds(form.tracksJson, eventTracks.map((t) => t.id));
  const tracks = eventTracks.filter((t) => offeredTrackIds.includes(t.id));

  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });

  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const draftCookie = cookies[draftCookieName(form.id)];
  let answers: AnswerMap = {};
  let selectedTrackIds: string[] = [];
  let hasDraft = false;
  let draftSavedAt: number | undefined;
  if (draftCookie) {
    const kv = c.env.KV as unknown as DraftKVStore;
    const draft = await readDraft(kv, draftCookie);
    if (draft && draft.formId === form.id) {
      answers = draft.answers;
      selectedTrackIds = Array.isArray(draft.answers.__trackIds) ? (draft.answers.__trackIds as string[]) : [];
      hasDraft = true;
      draftSavedAt = draft.savedAt;
    }
  }

  return c.html(
    <SubmitPage
      event={event}
      form={form}
      fields={fields}
      tracks={tracks}
      answers={answers}
      selectedTrackIds={selectedTrackIds}
      hasDraft={hasDraft}
      draftSavedAt={draftSavedAt}
      csrfToken={csrfToken}
      draftSavedNotice={c.req.query("draft") === "saved"}
    />,
  );
});

publicSubmitRoutes.post("/submit/:eventSlug/save-draft", csrfForm, async (c) => {
  const db = c.var.db;
  const event = await getEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const form = await getDefaultForm(db, event.id);
  if (!form) return publicNotFound(c, "This event is not accepting submissions yet.");

  const windowState = formWindowState(form.openDate, form.closeDate, Date.now(), event.timezone);
  if (windowState === "not_yet_open") {
    return c.html(<NotYetOpenPage event={event} form={form} />);
  }
  if (windowState === "closed") {
    return c.html(<ClosedPage event={event} form={form} />);
  }

  // DEC-422: save-draft is an otherwise-unmetered KV write path — mirror the
  // final-submit handler's per-IP scoped limiter (DEC-072/DEC-057/DEC-038)
  // before touching KV.
  const kv = c.env.KV as unknown as DraftKVStore;
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const rate = await checkAndIncrementScopedLimit(db, "draft", ip, Date.now(), {
    windowSeconds: 3600,
    max: 60,
  });
  if (!rate.ok) {
    throw new ApiError("invalid", "Too many submissions from this address. Try again later.");
  }

  const fields = await getFormFields(db, form.id);
  const eventTracks = await getEventTracks(db, event.id);
  const offeredTrackIds = resolveOfferedTrackIds(form.tracksJson, eventTracks.map((t) => t.id));
  const tracks = eventTracks.filter((t) => offeredTrackIds.includes(t.id));
  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const answers = extractAnswers(fields, body);
  const selectedTrackIds = extractTrackIds(body);

  // DEC-422: reject any answer over its field-kind cap before it ever
  // reaches saveDraft — never truncate.
  const fieldCapsById = new Map(fields.map((field) => [field.id, field]));
  for (const [fieldId, value] of Object.entries(answers)) {
    if (typeof value !== "string") continue;
    const field = fieldCapsById.get(fieldId);
    if (!field) continue;
    const cap = field.kind === "long_text" ? MAX_LONG_TEXT_LENGTH : MAX_TEXT_LENGTH;
    if (value.length > cap) {
      return c.html(
        <SubmitPage
          event={event}
          form={form}
          fields={fields}
          tracks={tracks}
          answers={answers}
          selectedTrackIds={selectedTrackIds}
          hasDraft={false}
          csrfToken={(c.req.header("cookie") && parseCookies(c.req.header("cookie") ?? null)[CSRF_COOKIE_NAME]) || newCsrfToken()}
          errors={{ [fieldId]: `${field.label} is too long.` }}
        />,
        400,
      );
    }
  }

  // Track selection is stored in the same draft answers blob under a
  // reserved key so it survives resume, without becoming a fake form field.
  (answers as Record<string, unknown>).__trackIds = selectedTrackIds;
  // Drafts never persist file selections (DEC-040): file answers are
  // extracted only at final submit, so `answers` here already omits them.

  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const cookieName = draftCookieName(form.id);
  const token = cookies[cookieName] ?? newDraftToken();
  const savedAt = Date.now();
  await saveDraft(kv, token, { formId: form.id, answers, savedAt });

  if (!cookies[cookieName]) {
    c.header(
      "Set-Cookie",
      buildDraftCookie(cookieName, token, { secure: isSecureRequest(c.req.url) }),
      { append: true },
    );
  }

  // DEC-245: redirect (rather than re-render) so the URL itself carries the
  // ?draft=saved marker — the GET handler reads it and renders a distinct
  // "Draft saved" confirmation banner above the form.
  return c.redirect(`/submit/${event.slug}?draft=saved`, 302);
});

// DEC-626/DEC-020: two body-free guards (same-origin, per-IP rate limit) run
// before the body is ever parsed; the in-body double-submit CSRF check below
// still does its own thing (rather than the csrfForm middleware) so a
// missing/mismatched cookie can re-render <SubmitPage> with the submitter's
// parsed answers intact instead of throwing a JSON-shaped ApiError that
// discards the just-typed form -- see each guard's inline comment.
publicSubmitRoutes.post("/submit/:eventSlug", async (c) => {
  const db = c.var.db;
  const event = await getEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const form = await getDefaultForm(db, event.id);
  if (!form) return publicNotFound(c, "This event is not accepting submissions yet.");

  const windowState = formWindowState(form.openDate, form.closeDate, Date.now(), event.timezone);
  if (windowState === "not_yet_open") {
    return c.html(<NotYetOpenPage event={event} form={form} />);
  }
  if (windowState === "closed") {
    return c.html(<ClosedPage event={event} form={form} />);
  }

  const fields = await getFormFields(db, form.id);
  const eventTracks = await getEventTracks(db, event.id);
  const offeredTrackIds = resolveOfferedTrackIds(form.tracksJson, eventTracks.map((t) => t.id));
  const tracks = eventTracks.filter((t) => offeredTrackIds.includes(t.id));

  // Body-free guards run BEFORE the body is ever parsed, so a hostile or
  // over-limit request never pays the cost of materializing (and later
  // uploading) a multipart body:
  //  (a) same-origin check (DEC-626/DEC-020) -- a cross-origin POST gets
  //      the same CSRF-failure page the in-body double-submit check below
  //      renders, but with an EMPTY answer set since nothing was parsed.
  if (!isSameOriginSubmitPost(c)) {
    const freshToken = newCsrfToken();
    c.header("Set-Cookie", buildCsrfCookie(freshToken, { secure: isSecureRequest(c.req.url) }), { append: true });
    return c.html(
      <SubmitPage
        event={event}
        form={form}
        fields={fields}
        tracks={tracks}
        answers={{}}
        selectedTrackIds={[]}
        hasDraft={false}
        csrfToken={freshToken}
        banner="Your session expired — your answers are still here, press Submit again"
      />,
      400,
    );
  }

  //  (b) DEC-072: per-IP rate limit, raised from 10 to 60/hour — shared IPs
  //      (offices, conference wifi, NAT) legitimately produce bursts of
  //      submissions from distinct speakers; the cap exists to stop abuse,
  //      not to punish shared addresses. DEC-057: uses the canonical scoped
  //      limiter (DEC-038). Also runs before the body is parsed, so its 429
  //      page necessarily shows an empty answer set.
  const kv = c.env.KV as unknown as DraftKVStore;
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const rate = await checkAndIncrementScopedLimit(db, "submit", ip, Date.now(), {
    windowSeconds: 3600,
    max: 60,
  });
  if (!rate.ok) {
    const cookiesForRateLimit = parseCookies(c.req.header("cookie") ?? null);
    return c.html(
      <SubmitPage
        event={event}
        form={form}
        fields={fields}
        tracks={tracks}
        answers={{}}
        selectedTrackIds={[]}
        hasDraft={false}
        csrfToken={cookiesForRateLimit[CSRF_COOKIE_NAME] ?? newCsrfToken()}
        banner="Too many submissions from this address. Try again later."
      />,
      429,
    );
  }

  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const answers = extractAnswers(fields, body);
  const selectedTrackIds = extractTrackIds(body);

  // DEC-626: this ONE route does its own CSRF check in-body (rather than the
  // csrfForm middleware) so a missing/mismatched cookie can re-render
  // <SubmitPage> with the submitter's parsed answers intact instead of
  // throwing a JSON-shaped ApiError that discards the just-typed form -- the
  // public CFP keeps the submitter's answers. The double-submit comparison
  // itself still delegates to the shared checkDoubleSubmitCsrf predicate
  // (DEC-544); this never re-inlines the comparison.
  const cookiesForCsrf = parseCookies(c.req.header("cookie") ?? null);
  const csrfCookieToken = cookiesForCsrf[CSRF_COOKIE_NAME];
  const csrfFormToken = body[CSRF_COOKIE_NAME];
  if (!checkDoubleSubmitCsrf(csrfCookieToken, csrfFormToken)) {
    const freshToken = newCsrfToken();
    c.header("Set-Cookie", buildCsrfCookie(freshToken, { secure: isSecureRequest(c.req.url) }), { append: true });
    return c.html(
      <SubmitPage
        event={event}
        form={form}
        fields={fields}
        tracks={tracks}
        answers={answers}
        selectedTrackIds={selectedTrackIds}
        hasDraft={false}
        csrfToken={freshToken}
        banner="Your session expired — your answers are still here, press Submit again"
      />,
      400,
    );
  }

  // File-kind answers (DEC-040): pull the uploaded File instances, validate
  // type/size up front (no I/O yet — the submission doesn't exist until
  // validation passes), and stand in a placeholder value so validateAnswers'
  // required check sees a present answer for fields with a valid upload.
  const fileFields = fields.filter((field) => field.kind === "file");
  const fileAnswers = extractFileAnswers(
    fileFields.map((field) => field.id),
    fieldInputName,
    body,
  );
  const fileValidations: Record<string, ValidUpload> = {};
  const fileErrors: Record<string, string> = {};
  // DEC-532: built from the FULL field list — a hidden non-file field can
  // transitively hide a file field.
  const isFieldVisible = makeVisibilityPredicate(fields, answers);
  for (const field of fileFields) {
    // DEC-132: rule-hidden file fields are ignored entirely — no upload
    // validation, no error, no "pending" placeholder — so a hidden field
    // never blocks submit and never leaves any trace of an attempted file.
    if (!isFieldVisible(field, answers)) continue;
    const file = fileAnswers[field.id];
    if (!file) continue;
    // `kind` here only selects the extension/size allowlist tier inside
    // validateUpload — the file row this becomes is always kind 'attachment'
    // (DEC-040), never one of the submission-deliverable kinds.
    const result = validateUpload({ filename: file.name, sizeBytes: file.size, kind: "handout" });
    if (!result.ok) {
      fileErrors[field.id] = result.message;
      continue;
    }
    fileValidations[field.id] = result;
    answers[field.id] = "pending";
  }

  const validation = validateAnswers(fields, answers);
  const trackResult = validateTrackChoice(selectedTrackIds, offeredTrackIds);
  const hasFileErrors = Object.keys(fileErrors).length > 0;

  if (!validation.ok || !trackResult.ok || hasFileErrors) {
    const mergedErrors = { ...(validation.ok ? {} : validation.errors), ...fileErrors };
    return c.html(
      <SubmitPage
        event={event}
        form={form}
        fields={fields}
        tracks={tracks}
        answers={answers}
        selectedTrackIds={selectedTrackIds}
        hasDraft={false}
        csrfToken={(c.req.header("cookie") && parseCookies(c.req.header("cookie") ?? null)[CSRF_COOKIE_NAME]) || newCsrfToken()}
        errors={mergedErrors}
        trackError={trackResult.ok ? undefined : trackResult.error}
      />,
      400,
    );
  }

  const cleaned = validation.cleaned;
  const title = String(cleaned[LOCKED_SESSION_FIELDS[0]] ?? "");
  const description = String(cleaned[LOCKED_SESSION_FIELDS[1]] ?? "");
  const firstName = String(cleaned[LOCKED_SPEAKER_FIELDS[0]] ?? "");
  const lastName = String(cleaned[LOCKED_SPEAKER_FIELDS[1]] ?? "");
  const email = String(cleaned[LOCKED_SPEAKER_FIELDS[2]] ?? "").trim().toLowerCase();
  // DEC-321: job_title/company/bio, appended (optional) to the default CFP
  // so the public speakers list isn't blank for real submitters.
  const jobTitle = String(cleaned[LOCKED_SPEAKER_FIELDS[3]] ?? "").trim() || null;
  const company = String(cleaned[LOCKED_SPEAKER_FIELDS[4]] ?? "").trim() || null;
  const bio = String(cleaned[LOCKED_SPEAKER_FIELDS[5]] ?? "").trim() || null;

  const existingContact = await findContactByEmail(db, event.orgId, email);
  const contactIsFresh = !existingContact;
  let contactId: string;
  let resolvedTitle: string | null;
  let resolvedCompany: string | null;
  if (existingContact) {
    contactId = existingContact.id;
    // DEC-814 supersedes DEC-321(b)'s fill-on-match behavior: an anonymous
    // CFP submission must never write to an existing CRM contact row. The
    // submitted job title/company are carried only onto this participant's
    // titleAtTime/orgAtTime snapshot (DEC-258), falling back to the
    // contact's stored values when the submitter left a field blank. The
    // contact row itself — and its bio — are left byte-identical.
    resolvedTitle = jobTitle ?? existingContact.title;
    resolvedCompany = company ?? existingContact.company;
  } else {
    contactId = await createContact(db, {
      orgId: event.orgId,
      firstName,
      lastName,
      email,
      title: jobTitle,
      company,
      bio,
    });
    resolvedTitle = jobTitle;
    resolvedCompany = company;
  }

  // Upload every valid file answer to R2 BEFORE any row is created — a
  // submission id doesn't exist yet, so the key is rooted under
  // `sub/pending/` rather than `sub/<submissionId>/`; the same key is
  // referenced on the file row below and is never renamed. Streamed
  // (file.stream(), not file.arrayBuffer()) so a large upload is never
  // buffered whole in memory.
  const fileStore = makeFileStore(c.env.FILES);
  const preparedFiles: { fieldId: string; file: File; r2Key: string; validated: ValidUpload }[] = [];
  for (const field of fileFields) {
    // DEC-132: only proceed for fields that survived validation with the
    // "pending" placeholder (visible + valid upload) — hidden fields never
    // reach `answers[field.id] = "pending"` above, so `cleaned[field.id]`
    // is undefined here and this loop skips them entirely.
    if (cleaned[field.id] !== "pending") continue;
    const file = fileAnswers[field.id];
    const validated = fileValidations[field.id];
    if (!file || !validated) continue;
    const r2Key = `sub/pending/${newId()}-${sanitizeFilenameForKey(file.name)}`;
    await fileStore.put(r2Key, file.stream(), validated.servedContentType);
    preparedFiles.push({ fieldId: field.id, file, r2Key, validated });
  }

  // The DB write phase is one committed unit: any failure past this point
  // (including a thrown error from any of these repo calls) deletes every
  // R2 object just written above and the submission row it created (via the
  // same cascade delete the admin session-delete route uses), then rethrows
  // so the failure is loud rather than leaving an orphaned row or R2 object.
  let submission: { id: string; seq: number } | undefined;
  try {
    submission = await createSubmission(db, { eventId: event.id, formId: form.id, title, description });
    await createParticipant(db, {
      submissionId: submission.id,
      contactId,
      titleAtTime: resolvedTitle,
      orgAtTime: resolvedCompany,
    });
    await createSubmissionTracks(db, submission.id, selectedTrackIds);

    for (const pf of preparedFiles) {
      const fileId = await insertAttachmentFile(db, {
        submissionId: submission.id,
        filename: pf.file.name,
        r2Key: pf.r2Key,
        sizeBytes: pf.file.size,
        contentType: pf.validated.servedContentType,
        uploadedByContactId: contactId,
      });
      cleaned[pf.fieldId] = fileId;
    }

    await upsertSubmissionAnswers(db, submission.id, cleaned);
  } catch (err) {
    for (const pf of preparedFiles) {
      await fileStore.delete(pf.r2Key);
    }
    if (submission !== undefined) {
      await commitSubmissionDelete(db, event.id, [submission.id]);
    }
    throw err;
  }

  const ref = formatRef(event.recordPrefix, submission.seq);

  // Delete the KV draft — drafts never survive a successful submit (DEC-014).
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const draftCookie = cookies[draftCookieName(form.id)];
  if (draftCookie) {
    await deleteDraft(kv, draftCookie);
    c.header("Set-Cookie", `${draftCookieName(form.id)}=; Path=/submit; SameSite=Lax; Max-Age=0`, { append: true });
  }

  // DEC-252: the on-page href is relative (never depends on origin
  // inference); the emailed copy is absolute, built from resolveBaseUrl so
  // it's correct under local `wrangler dev` even though wrangler.jsonc's
  // production `routes`/`custom_domain` entry would otherwise make
  // `new URL(c.req.url).origin` resolve to the live deployed host.
  const origin = resolveBaseUrl(c);
  const existingUser = await findAccountUserId(db, { contactId, email });
  let claimPath = "/login";
  if (!existingUser) {
    const claimKv = c.env.KV as unknown as ClaimKVStore;
    const claimToken = await createClaimToken(claimKv, { contactId, eventId: event.id });
    claimPath = `/claim/${claimToken}`;
  }
  const claimUrl = `${origin}${claimPath}`;

  const text = renderTemplate(
    "Hi {speaker_name},\n\nWe received your submission \"{talk_title}\" ({ref}) for {event_name}.\n\n{portal_link}\n",
    {
      speaker_name: `${firstName} ${lastName}`.trim(),
      talk_title: title,
      ref,
      event_name: event.name,
      portal_link: claimUrl,
    },
  );
  const safeSpeakerName = escapeHtml(`${firstName} ${lastName}`.trim());
  const safeTitle = escapeHtml(title);
  const safeRef = escapeHtml(ref);
  const safeEventName = escapeHtml(event.name);
  const safeClaimUrl = escapeHtml(claimUrl);
  const html = `<p>Hi ${safeSpeakerName},</p><p>We received your submission "${safeTitle}" (${safeRef}) for ${safeEventName}.</p><p><a href="${safeClaimUrl}">${safeClaimUrl}</a></p>`;
  // The submission is already persisted; the confirmation email is a
  // best-effort side effect at an IO boundary (a real provider can reject a
  // recipient or transiently fail). A send failure must NOT 500 the submit —
  // that showed the speaker an error page while the row persisted, so every
  // retry created a duplicate. Log it (the send attempt is recorded in
  // email_log with status 'failed' by the mailer) and still show success.
  try {
    // DEC-547: construct the mailer inside this same guarded region — a
    // misconfigured environment throws here exactly like a rejected send,
    // and both must fall through to the same "log and still show success"
    // path rather than 500ing a submit whose row is already persisted.
    const mailer = makeMailer(db, c.env);
    await mailer.send({
      to: { email, name: `${firstName} ${lastName}`.trim() },
      subject: `We received your submission: ${title}`,
      text,
      html,
      eventId: event.id,
      contactId,
    });
  } catch (err) {
    console.error("submission confirmation email failed (submission still saved):", err);
  }

  // DEC-098: the claim token is minted and emailed in both no-user cases
  // (existing contact or fresh) — only whether it's rendered on screen
  // differs, since the email always goes to the address the submitter
  // typed, while the on-screen page is visible to whoever is at the
  // keyboard right now, who may not be that address's real owner.
  const confirmationState: ConfirmationState = existingUser
    ? "has-account"
    : contactIsFresh
      ? "fresh"
      : "pending-existing-contact";

  return c.html(
    <ConfirmationPage
      event={event}
      title={title}
      ref={ref}
      submittedEmail={email}
      claimPath={claimPath}
      state={confirmationState}
      eventSlug={event.slug}
      form={form}
    />,
  );
});
