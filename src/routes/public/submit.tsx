// Public CFP submission SSR (J1 share link + J2 submit), per DEC-005
// (/submit/:eventSlug), DEC-006 (confirmation email via the Mailer port),
// DEC-008 (form engine + server-side validation), DEC-012 (thin handlers:
// parse/authz -> repo -> pure core -> response), DEC-014 (drafts + claim
// token), DEC-016 (locked fields persist to real columns). Route files
// export a named Hono sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { makeMailer, makeFileStore } from "../../server/context";
import {
  getEventBySlug,
  getDefaultForm,
  getFormFields,
  getEventTracks,
  findContactByEmail,
  createContact,
  findUserByEmail,
  createSubmission,
  createParticipant,
  createSubmissionTracks,
  createSubmissionAnswers,
  insertAttachmentFile,
  type EventRow,
  type FormRow,
  type TrackRow,
} from "../../server/repo/submit";
import { validateAnswers } from "../../forms/validate";
import { isVisible } from "../../forms/visibility";
import type { AnswerMap, FormFieldDef } from "../../forms/types";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS } from "../../forms/types";
import {
  formWindowState,
  validateTrackChoice,
  resolveOfferedTrackIds,
  checkAndIncrementRateLimit,
  extractFileAnswers,
} from "../../lib/submit-core";
import {
  saveDraft,
  readDraft,
  deleteDraft,
  newDraftToken,
  draftCookieName,
  type KVStore as DraftKVStore,
} from "../../lib/draft";
import { createClaimToken, type KVStore as ClaimKVStore } from "../../auth/claim";
import { parseCookies, newCsrfToken, CSRF_COOKIE_NAME } from "../../auth/cookies";
import { renderTemplate, escapeHtml } from "../../mail/render";
import { validateUpload, sanitizeFilenameForKey, type ValidUpload } from "../../domain/files";
import { newId } from "../../domain/ids";
import { FormFieldsSection, FieldRulesScript, fieldInputName } from "../../views/form-render";
import { DEC_014, DEC_016, DEC_036, DEC_040 } from "../../decisions";

export const publicSubmitRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_014;
void DEC_016;
void DEC_036;
void DEC_040;

function ensureCsrfCookie(c: { req: { header(name: string): string | undefined } }): {
  token: string;
  setCookieIfNew: string | null;
} {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return { token, setCookieIfNew: `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Lax` };
}

function branding(event: EventRow): { logoUrl?: string; accentColor?: string } {
  if (!event.brandingJson) return {};
  const parsed = JSON.parse(event.brandingJson) as { logoUrl?: string; accentColor?: string };
  return { logoUrl: parsed.logoUrl, accentColor: parsed.accentColor };
}

function requestIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
}

function PageShell(props: { title: string; accentColor?: string; children: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>{props.title}</title>
        {props.accentColor ? (
          <style>{`:root { --chq-accent: ${props.accentColor}; } a, button[type=submit] { color: var(--chq-accent); }`}</style>
        ) : null}
      </head>
      <body>{props.children as any}</body>
    </html>
  );
}

function ClosedPage(props: { event: EventRow; form: FormRow }) {
  return (
    <PageShell title={`Submissions closed - ${props.event.name}`} accentColor={branding(props.event).accentColor}>
      <h1>{props.event.name}</h1>
      <p role="alert">
        Submissions for this event closed on {new Date(props.form.closeDate ?? 0).toUTCString()}. Thanks for your
        interest — please reach out to the organizers directly if you have questions.
      </p>
    </PageShell>
  );
}

function NotYetOpenPage(props: { event: EventRow; form: FormRow }) {
  return (
    <PageShell title={`Submissions not yet open - ${props.event.name}`} accentColor={branding(props.event).accentColor}>
      <h1>{props.event.name}</h1>
      <p role="alert">
        Submissions open {new Date(props.form.openDate ?? 0).toUTCString()}. Please check back then.
      </p>
    </PageShell>
  );
}

function DraftBanner(props: { formId: string; savedAt: number }) {
  return (
    <p role="status">
      Resuming your saved draft from {new Date(props.savedAt).toUTCString()}.
    </p>
  );
}

function TrackChoices(props: { tracks: TrackRow[]; selected: string[] }) {
  return (
    <fieldset>
      <legend>Track *</legend>
      {props.tracks.map((track) => (
        <label>
          <input
            type="checkbox"
            name="trackIds"
            value={track.id}
            checked={props.selected.includes(track.id)}
          />
          {track.name}
        </label>
      ))}
    </fieldset>
  );
}

function SubmitPage(props: {
  event: EventRow;
  form: FormRow;
  fields: FormFieldDef[];
  tracks: TrackRow[];
  answers: AnswerMap;
  selectedTrackIds: string[];
  hasDraft: boolean;
  draftSavedAt?: number;
  csrfToken: string;
  errors?: Record<string, string>;
  trackError?: string;
}) {
  const { event, form, fields, tracks, answers, selectedTrackIds, csrfToken, errors, trackError } = props;
  const accentColor = branding(event).accentColor;
  const logoUrl = branding(event).logoUrl;
  return (
    <PageShell title={`Submit a session - ${event.name}`} accentColor={accentColor}>
      {logoUrl ? <img src={logoUrl} alt={`${event.name} logo`} /> : null}
      <h1>{event.name}</h1>
      <p>{form.title}</p>
      {form.closeDate ? <p>Submissions close {new Date(form.closeDate).toUTCString()}.</p> : null}
      {props.hasDraft && props.draftSavedAt !== undefined ? (
        <DraftBanner formId={form.id} savedAt={props.draftSavedAt} />
      ) : null}
      <form method="post" action={`/submit/${event.slug}`} enctype="multipart/form-data">
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <h2>Session</h2>
        <FormFieldsSection fields={fields} section="session" answers={answers} errors={errors} isVisible={isVisible} />
        {trackError ? (
          <p role="alert" class="field-error">
            {trackError}
          </p>
        ) : null}
        <TrackChoices tracks={tracks} selected={selectedTrackIds} />
        <h2>Speaker</h2>
        <FormFieldsSection fields={fields} section="speaker" answers={answers} errors={errors} isVisible={isVisible} />
        <button type="submit" formaction={`/submit/${event.slug}/save-draft`} formnovalidate>
          Save draft
        </button>
        <button type="submit">Submit</button>
      </form>
      <FieldRulesScript fields={fields} />
    </PageShell>
  );
}

function ConfirmationPage(props: { event: EventRow; title: string; claimUrl: string; alreadyHasAccount: boolean }) {
  return (
    <PageShell title={`Submission received - ${props.event.name}`}>
      <h1>Thanks for your submission!</h1>
      <p>
        We've emailed a confirmation for "{props.title}" to the address you provided.
      </p>
      {props.alreadyHasAccount ? (
        <p>
          <a href="/login">Log in</a> to track your submission.
        </p>
      ) : (
        <p>
          <a href={props.claimUrl}>Create a password to track your submission</a>
        </p>
      )}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Body parsing helpers
// ---------------------------------------------------------------------------

function extractAnswers(fields: FormFieldDef[], body: Record<string, unknown>): AnswerMap {
  const answers: AnswerMap = {};
  for (const field of fields) {
    // File-kind answers are handled separately (extractFileAnswers) since
    // they need async upload + a repo write before they become an answer
    // value — never stringified here (DEC-040).
    if (field.kind === "file") continue;
    const name = fieldInputName(field.id);
    if (field.kind === "checkbox") {
      answers[field.id] = body[name] !== undefined;
      continue;
    }
    const raw = body[name];
    if (raw === undefined) continue;
    answers[field.id] = typeof raw === "string" ? raw : String(raw);
  }
  return answers;
}

function extractTrackIds(body: Record<string, unknown>): string[] {
  const raw = body.trackIds;
  if (raw === undefined) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

publicSubmitRoutes.get("/submit/:eventSlug", async (c) => {
  const db = c.var.db;
  const event = await getEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const form = await getDefaultForm(db, event.id);
  if (!form) return c.text("This event is not accepting submissions yet.", 404);

  const windowState = formWindowState(form.openDate, form.closeDate, Date.now());
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
    />,
  );
});

publicSubmitRoutes.post("/submit/:eventSlug/save-draft", csrfForm, async (c) => {
  const db = c.var.db;
  const event = await getEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const form = await getDefaultForm(db, event.id);
  if (!form) return c.text("This event is not accepting submissions yet.", 404);

  const windowState = formWindowState(form.openDate, form.closeDate, Date.now());
  if (windowState === "not_yet_open") {
    return c.html(<NotYetOpenPage event={event} form={form} />);
  }
  if (windowState === "closed") {
    return c.html(<ClosedPage event={event} form={form} />);
  }

  const fields = await getFormFields(db, form.id);
  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const answers = extractAnswers(fields, body);
  // Track selection is stored in the same draft answers blob under a
  // reserved key so it survives resume, without becoming a fake form field.
  (answers as Record<string, unknown>).__trackIds = extractTrackIds(body);
  // Drafts never persist file selections (DEC-040): file answers are
  // extracted only at final submit, so `answers` here already omits them.

  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const cookieName = draftCookieName(form.id);
  const token = cookies[cookieName] ?? newDraftToken();
  const kv = c.env.KV as unknown as DraftKVStore;
  await saveDraft(kv, token, { formId: form.id, answers, savedAt: Date.now() });

  if (!cookies[cookieName]) {
    c.header("Set-Cookie", `${cookieName}=${token}; Path=/submit; SameSite=Lax`, { append: true });
  }
  return c.redirect(`/submit/${event.slug}`, 302);
});

publicSubmitRoutes.post("/submit/:eventSlug", csrfForm, async (c) => {
  const db = c.var.db;
  const event = await getEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const form = await getDefaultForm(db, event.id);
  if (!form) return c.text("This event is not accepting submissions yet.", 404);

  const windowState = formWindowState(form.openDate, form.closeDate, Date.now());
  if (windowState === "not_yet_open") {
    return c.html(<NotYetOpenPage event={event} form={form} />);
  }
  if (windowState === "closed") {
    return c.html(<ClosedPage event={event} form={form} />);
  }

  // Naive per-IP rate limit (DEC-014 note): 10 submissions/hour, fail loudly.
  const kv = c.env.KV as unknown as DraftKVStore;
  const rate = await checkAndIncrementRateLimit(kv, requestIp(c), Date.now());
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
  for (const field of fileFields) {
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

  let contact = await findContactByEmail(db, event.orgId, email);
  const contactId = contact ? contact.id : await createContact(db, { orgId: event.orgId, firstName, lastName, email });

  const submission = await createSubmission(db, { eventId: event.id, formId: form.id, title, description });
  await createParticipant(db, { submissionId: submission.id, contactId });
  await createSubmissionTracks(db, submission.id, selectedTrackIds);

  // Upload each valid file answer now that the submission exists, and swap
  // the "pending" placeholder for the real file id (DEC-040: the answer
  // value is the file.id string).
  const fileStore = makeFileStore(c.env.FILES);
  for (const field of fileFields) {
    const file = fileAnswers[field.id];
    const validated = fileValidations[field.id];
    if (!file || !validated) continue;
    const r2Key = `sub/${submission.id}/answer-${newId()}-${sanitizeFilenameForKey(file.name)}`;
    const buf = await file.arrayBuffer();
    await fileStore.put(r2Key, buf, validated.servedContentType);
    const fileId = await insertAttachmentFile(db, {
      submissionId: submission.id,
      filename: file.name,
      r2Key,
      sizeBytes: file.size,
      contentType: validated.servedContentType,
      uploadedByContactId: contactId,
    });
    cleaned[field.id] = fileId;
  }

  await createSubmissionAnswers(db, submission.id, cleaned);

  // Delete the KV draft — drafts never survive a successful submit (DEC-014).
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const draftCookie = cookies[draftCookieName(form.id)];
  if (draftCookie) {
    await deleteDraft(kv, draftCookie);
    c.header("Set-Cookie", `${draftCookieName(form.id)}=; Path=/submit; SameSite=Lax; Max-Age=0`, { append: true });
  }

  const origin = new URL(c.req.url).origin;
  const existingUser = await findUserByEmail(db, email);
  let claimUrl = `${origin}/login`;
  if (!existingUser) {
    const claimKv = c.env.KV as unknown as ClaimKVStore;
    const claimToken = await createClaimToken(claimKv, { contactId, eventId: event.id });
    claimUrl = `${origin}/claim/${claimToken}`;
  }

  const mailer = makeMailer(db);
  const text = renderTemplate(
    "Hi {speaker_name},\n\nWe received your submission \"{talk_title}\" for {event_name}.\n\n{portal_link}\n",
    {
      speaker_name: `${firstName} ${lastName}`.trim(),
      talk_title: title,
      event_name: event.name,
      portal_link: claimUrl,
    },
  );
  const safeSpeakerName = escapeHtml(`${firstName} ${lastName}`.trim());
  const safeTitle = escapeHtml(title);
  const safeEventName = escapeHtml(event.name);
  const safeClaimUrl = escapeHtml(claimUrl);
  const html = `<p>Hi ${safeSpeakerName},</p><p>We received your submission "${safeTitle}" for ${safeEventName}.</p><p><a href="${safeClaimUrl}">${safeClaimUrl}</a></p>`;
  await mailer.send({
    to: { email, name: `${firstName} ${lastName}`.trim() },
    subject: `We received your submission: ${title}`,
    text,
    html,
    eventId: event.id,
    contactId,
  });

  return c.html(
    <ConfirmationPage event={event} title={title} claimUrl={claimUrl} alreadyHasAccount={Boolean(existingUser)} />,
  );
});
