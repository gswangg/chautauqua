// POST /submit/:eventSlug (J2 submit) -- split out of submit.tsx purely to
// reduce merge contention on that file; no behavior change. See submit.tsx
// for the shared DEC references (DEC-005, DEC-006, DEC-008, DEC-012,
// DEC-014, DEC-016).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { checkDoubleSubmitCsrf } from "../../server/middleware";
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
import { deleteContact } from "../../server/repo/contacts/crud";
import { validateAnswers } from "../../forms/validate";
import { makeVisibilityPredicate } from "../../forms/visibility";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS, lockedFieldName } from "../../forms/types";
import {
  formWindowState,
  validateTrackChoice,
  resolveOfferedTrackIds,
  extractFileAnswers,
} from "../../lib/submit-core";
import { NAME_REQUIRED_MESSAGE } from "./submit-body";
import { requestIpFromHeaders } from "../../lib/rate-limit";
import { checkAndIncrementScopedLimit } from "../../server/repo/rate-limit";
import { newId, formatRef } from "../../domain/ids";
import { DEC_814 } from "../../decisions";
// implements DEC_814 (an anonymous CFP match never writes to the CRM contact row).
void DEC_814;
import { deleteDraft, draftCookieName, type KVStore as DraftKVStore } from "../../lib/draft";
import { createClaimToken, type KVStore as ClaimKVStore } from "../../auth/claim";
import { parseCookies, newCsrfToken, buildCsrfCookie, isSecureRequest, CSRF_COOKIE_NAME } from "../../auth/cookies";
import { renderTemplate } from "../../mail/render";
import { renderEmailHtml } from "../../mail/shell";
import { validateUpload, sanitizeFilenameForKey, CFP_FILE_FIELD_KIND, type ValidUpload } from "../../domain/files";
import { fieldInputName } from "../../views/form-render";
import { resolveBaseUrl } from "../../server/origin";
import { publicNotFound } from "./not-found";
import {
  ClosedPage,
  ConfirmationPage,
  NotYetOpenPage,
  SubmitPage,
  type ConfirmationState,
} from "./submit-views";
import { extractAnswers, extractTrackIds, applyNameSplit } from "./submit-body";
import { emailBudgetOk, refundEmailBudget, isSameOriginSubmitPost } from "./submit-guards";
import { trackChoiceMessage } from "./submit-messages";

export const publicSubmitPostRoutes = new Hono<AppEnv>();

// DEC-626/DEC-020: two body-free guards (same-origin, per-IP rate limit) run
// before the body is ever parsed; the in-body double-submit CSRF check below
// still does its own thing (rather than the csrfForm middleware) so a
// missing/mismatched cookie can re-render <SubmitPage> with the submitter's
// parsed answers intact instead of throwing a JSON-shaped ApiError that
// discards the just-typed form -- see each guard's inline comment.
publicSubmitPostRoutes.post("/submit/:eventSlug", async (c) => {
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

  //  (b) DEC-072: two independent budgets, mirroring auth.tsx's login check.
  //      A per-IP rate limit, raised from 10 to 60/hour — shared IPs
  //      (offices, conference wifi, NAT) legitimately produce bursts of
  //      submissions from distinct speakers; the cap exists to stop abuse,
  //      not to punish shared addresses. DEC-057: uses the canonical scoped
  //      limiter (DEC-038). Runs before the body is parsed, so its 429
  //      page necessarily shows an empty answer set. A SECOND budget, keyed
  //      on the submitted email (scope "submit-email", 10/hour), closes the
  //      gap this per-IP check leaves open: x-forwarded-for is client-
  //      supplied (see rate-limit.ts's own doc comment) and trivially
  //      spoofable, so an attacker can rotate it to bypass the IP budget
  //      while hammering the same address. That second check runs later,
  //      once `email` is known (just above the first write) — see there.
  // DEC-072 (wave-67 amendment): this IP-keyed check is a FAILURE budget,
  // not an identity budget — it stays UNREFUNDED on any later failure.
  // requestIpFromHeaders (src/lib/rate-limit.ts, see its own doc comment)
  // is only "unknown" when BOTH headers are absent; a present
  // x-forwarded-for is returned verbatim and is client-controlled, so an
  // attacker can rotate it across distinct spoofed values to walk this
  // budget across distinct buckets instead of exhausting a single one.
  // Refunding here would make that rotation free, letting the attacker
  // burn an unlimited number of never-decrementing buckets at zero cost;
  // the guard only works because it never gives units back.
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
  // DEC-986 (wave 45 amendment): the locked first_name/last_name answers are
  // derived from the single Name control BEFORE validateAnswers runs — see
  // applyNameSplit's own comment for the split rule.
  applyNameSplit(fields, body, answers);
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
    const result = validateUpload({ filename: file.name, sizeBytes: file.size, kind: CFP_FILE_FIELD_KIND });
    if (!result.ok) {
      fileErrors[field.id] = result.message;
      continue;
    }
    fileValidations[field.id] = result;
    answers[field.id] = "pending";
  }

  // DEC-986 (wave 45 amendment): the single Name control is what's required
  // on this surface — the last_name half it also fills is exempt from
  // validateAnswers' own required check (a form must never fail on a field
  // it does not render), so this ONE call passes a locally-required-false
  // copy of the last_name field def, never mutating the `fields` array used
  // everywhere else (extraction, visibility, re-render).
  const firstNameField = fields.find((f) => lockedFieldName(f.id) === "first_name");
  const lastNameField = fields.find((f) => lockedFieldName(f.id) === "last_name");
  const validationFields = lastNameField
    ? fields.map((f) => (f.id === lastNameField.id ? { ...f, required: false } : f))
    : fields;
  const validation = validateAnswers(validationFields, answers);
  const trackResult = validateTrackChoice(selectedTrackIds, offeredTrackIds);
  const hasFileErrors = Object.keys(fileErrors).length > 0;

  if (!validation.ok || !trackResult.ok || hasFileErrors) {
    const mergedErrors = { ...(validation.ok ? {} : validation.errors), ...fileErrors };
    // The single Name control carries first_name's required-ness; its
    // generic "required" message is replaced with copy naming the ONE
    // control the submitter actually sees.
    if (firstNameField && mergedErrors[firstNameField.id] === "required") {
      mergedErrors[firstNameField.id] = NAME_REQUIRED_MESSAGE;
    }
    // DEC-124/DEC-422 (amendment): an over-length answer's message already
    // names both numbers (what was typed, and how far over) -- validateAnswers
    // emits the rich sentence directly via overCapSentence, so there is no
    // rewrite step here anymore.
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
        trackError={trackResult.ok ? undefined : trackChoiceMessage(trackResult.error)}
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

  // DEC-072: per-email budget, well below the per-IP budget above — closes
  // the spoofed-x-forwarded-for gap (see the comment at the IP check).
  // Runs here, after validation passes and before the FIRST write of any
  // kind (contact, submission, R2 object, email), so a refused attempt
  // never touches storage, but the submitter's just-typed answers survive
  // into the re-rendered page (unlike the pre-parse IP check, which
  // necessarily renders empty).
  // DEC-072 (wave-58 amendment): the spend and every possible refund of it
  // below must share the exact same window bucket, so the clock is read
  // once here rather than letting emailBudgetOk/refundEmailBudget each call
  // Date.now() independently.
  const budgetNow = Date.now();
  const emailRateOk = await emailBudgetOk(db, "submit-email", email, 10, budgetNow);
  if (!emailRateOk) {
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
        banner={`Too many submissions from ${email}. Try again later.`}
      />,
      429,
    );
  }

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
  // referenced on the file row below and is never renamed. requestBodyLimit
  // (src/server/body-limit.ts) refuses an oversized request by its
  // Content-Length header before parseBody ever runs, ahead of any handler;
  // validateUpload (src/domain/files.ts) then enforces the per-kind size cap
  // once the body has actually been parsed.
  const fileStore = makeFileStore(c.env.FILES);
  // DEC-132: only proceed for fields that survived validation with the
  // "pending" placeholder (visible + valid upload) — hidden fields never
  // reach `answers[field.id] = "pending"` above, so `cleaned[field.id]` is
  // undefined here and those fields are filtered out before upload.
  const toUpload = fileFields
    .filter((field) => cleaned[field.id] === "pending")
    .map((field) => ({ fieldId: field.id, file: fileAnswers[field.id], validated: fileValidations[field.id] }))
    .filter(
      (entry): entry is { fieldId: string; file: File; validated: ValidUpload } =>
        entry.file !== undefined && entry.validated !== undefined,
    );
  // DEC-530 (amended wave 26): R2 puts fan out in parallel, not one await
  // per field in a loop — order is preserved via .map so preparedFiles
  // still lines up 1:1 with toUpload regardless of which put settles
  // first. The fan-out owns its own cleanup: every r2Key is minted up
  // front (before any put is issued) so the full key set is known
  // regardless of which promises settle, puts run via Promise.allSettled
  // (never short-circuiting on the first rejection like Promise.all
  // would), and on any rejection every minted key is best-effort deleted
  // here before the first rejection is rethrown unmodified — a partial
  // failure must never leave sibling puts' objects orphaned.
  const minted = toUpload.map(({ fieldId, file, validated }) => ({
    fieldId,
    file,
    validated,
    r2Key: `sub/pending/${newId()}-${sanitizeFilenameForKey(file.name)}`,
  }));
  const putResults = await Promise.allSettled(
    minted.map(({ r2Key, file, validated }) => fileStore.put(r2Key, file.stream(), validated.servedContentType)),
  );
  const firstRejection = putResults.find(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  if (firstRejection !== undefined) {
    // DEC-713 (wave-67 amendment): no submission row exists yet on this
    // path, but `createContact` above already minted a contact row for a
    // never-before-seen email — clean it up before the best-effort R2
    // sweep, mirroring the DB-write-phase catch below. A pre-existing
    // contact (contactIsFresh === false) is never touched.
    if (contactIsFresh) {
      try {
        await deleteContact(db, contactId);
      } catch (cleanupErr) {
        console.error("submit upload: contact cleanup failed", cleanupErr);
      }
    }
    try {
      await Promise.all(minted.map((m) => fileStore.delete(m.r2Key)));
    } catch (cleanupErr) {
      console.error("submit upload: R2 cleanup failed", cleanupErr);
    }
    // DEC-072 (wave-58 amendment): the per-email budget was already spent
    // above for this attempt; an R2 rejection is a failure on our own side,
    // not a submitter abusing the endpoint, so give the unit back before
    // rethrowing (login-ip's refund at auth-login.tsx:213 is the precedent).
    await refundEmailBudget(db, "submit-email", email, budgetNow);
    throw firstRejection.reason;
  }
  const preparedFiles: { fieldId: string; file: File; r2Key: string; validated: ValidUpload }[] = minted;

  // The DB write phase is one committed unit: any failure past this point
  // (including a thrown error from any of these repo calls) deletes every
  // R2 object just written above, the submission row it created (via the
  // same cascade delete the admin session-delete route uses), and — DEC-713
  // wave-67 amendment — the CRM contact row this request minted, if any
  // (contactIsFresh; a pre-existing contact is never touched), then
  // rethrows so the failure is loud rather than leaving an orphaned row.
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
    // DEC-713 (wave 21, amended wave 67): a rollback is still an ordering —
    // commit the submission cascade first (this also removes any
    // `participant` row this request just created, so a freshly-minted
    // contact is never referenced by a dangling participant when the
    // contact delete below runs), then delete the contact row THIS
    // REQUEST minted (contactIsFresh, never a pre-existing contact), then
    // best-effort clean up the R2 objects (DEC-530: the cleanup still fans
    // out in parallel), then refund the budget, and always rethrow the
    // original error rather than letting any cleanup failure mask it.
    if (submission !== undefined) {
      await commitSubmissionDelete(db, event.id, [submission.id]);
    }
    if (contactIsFresh) {
      try {
        await deleteContact(db, contactId);
      } catch (cleanupErr) {
        console.error("submit rollback: contact cleanup failed", cleanupErr);
      }
    }
    try {
      await Promise.all(preparedFiles.map((pf) => fileStore.delete(pf.r2Key)));
    } catch (cleanupErr) {
      console.error("submit rollback: R2 cleanup failed", cleanupErr);
    }
    // DEC-072 (wave-58 amendment): same reasoning as the R2 fan-out
    // rejection above — the DB write phase failing is our own transient
    // failure, not submitter abuse, so refund the unit before rethrowing.
    await refundEmailBudget(db, "submit-email", email, budgetNow);
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
  const html = renderEmailHtml(text, {
    eventName: event.name,
    reason: "you submitted a talk to this event.",
    cta: {
      label: existingUser ? "Sign in to view your submission" : "Claim your account to view your submission",
      href: claimUrl,
    },
  });
  // The submission is already persisted; the confirmation email is a
  // best-effort side effect at an IO boundary (a real provider can reject a
  // recipient or transiently fail). A send failure must NOT 500 the submit —
  // that showed the speaker an error page while the row persisted, so every
  // retry created a duplicate. Log it (the send attempt is recorded in
  // email_log with status 'failed' by the mailer) and still show success.
  let confirmationEmailSent = true;
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
    confirmationEmailSent = false;
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

  // DEC-098 (wave 8 amendment): the confirmation card states the talk's
  // track and format, not just its title -- built from what was JUST
  // persisted, no extra query. The track clause is looked up from the
  // offered-tracks list already in scope (joined in that list's own order,
  // ' · '-separated, for the rare multi-select case); the format clause is
  // the session_format-role field's answer label verbatim (an option's raw
  // value already carries its own "(N min)" suffix -- see FormatChoices).
  const selectedTrackNames = tracks.filter((t) => selectedTrackIds.includes(t.id)).map((t) => t.name);
  const formatField = fields.find((f) => f.role === "session_format");
  const formatAnswer = formatField ? cleaned[formatField.id] : undefined;
  const formatLabel = typeof formatAnswer === "string" && formatAnswer.trim() !== "" ? formatAnswer : null;
  const metaParts = [
    selectedTrackNames.length > 0 ? selectedTrackNames.join(" · ") : null,
    formatLabel,
  ].filter((part): part is string => part !== null);
  const meta = metaParts.length > 0 ? metaParts.join(" · ") : null;

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
      emailDelivered={confirmationEmailSent}
      meta={meta}
    />,
  );
});
