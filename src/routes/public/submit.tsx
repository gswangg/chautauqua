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
  fillContactProfileIfBlank,
  createSubmission,
  createParticipant,
  createSubmissionTracks,
  createSubmissionAnswers,
  insertAttachmentFile,
  type EventRow,
  type FormRow,
  type TrackRow,
} from "../../server/repo/submit";
import { findAccountUserId } from "../../server/repo/comms";
import { validateAnswers } from "../../forms/validate";
import { isVisible } from "../../forms/visibility";
import type { AnswerMap, FormFieldDef } from "../../forms/types";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS } from "../../forms/types";
import {
  formWindowState,
  validateTrackChoice,
  resolveOfferedTrackIds,
  extractFileAnswers,
} from "../../lib/submit-core";
import { checkAndIncrementScopedLimit, requestIpFromHeaders } from "../../lib/rate-limit";
import { MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../forms/validate";
import {
  saveDraft,
  readDraft,
  deleteDraft,
  newDraftToken,
  draftCookieName,
  type KVStore as DraftKVStore,
} from "../../lib/draft";
import { createClaimToken, type KVStore as ClaimKVStore } from "../../auth/claim";
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  buildDraftCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../auth/cookies";
import { renderTemplate, escapeHtml } from "../../mail/render";
import { formatEventDateTime } from "../../lib/event-time";
import { dayLabelEndInstant, dayLabelStartInstant } from "../../lib/timezone";
import { validateUpload, sanitizeFilenameForKey, type ValidUpload } from "../../domain/files";
import { newId } from "../../domain/ids";
import { FormFieldsSection, FieldRulesScript, fieldInputName } from "../../views/form-render";
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
import { ThemeStyles } from "../../views/theme";
import { CFP_CSS } from "./cfp.css";
import { validAccent } from "./shell";

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

function ensureCsrfCookie(c: {
  req: { header(name: string): string | undefined; url: string };
}): {
  token: string;
  setCookieIfNew: string | null;
} {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return {
    token,
    setCookieIfNew: buildCsrfCookie(token, { secure: isSecureRequest(c.req.url) }),
  };
}

function branding(event: EventRow): { logoUrl?: string; accentColor?: string } {
  if (!event.brandingJson) return {};
  const parsed = JSON.parse(event.brandingJson) as { logoUrl?: string; accentColor?: string };
  return { logoUrl: parsed.logoUrl, accentColor: parsed.accentColor };
}

// DEC-371/DEC-374: THEME_CSS (tokens/resets, shared by every SSR surface)
// followed by this surface's own CFP_CSS, both inlined via
// dangerouslySetInnerHTML as value-free module constants -- never the
// ad-hoc per-page <style> template literal this used to be. The per-event
// accent is the one piece of request data involved, and it lands in a
// validated style ATTRIBUTE on <body>, never interpolated into either CSS
// string (DEC-374).
function PageShell(props: { title: string; accentColor?: string; children: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <ThemeStyles />
        <style dangerouslySetInnerHTML={{ __html: CFP_CSS }} />
      </head>
      <body style={`--chq-brandable-accent: ${validAccent(props.accentColor)};`}>
        <main class="chq-measure">{props.children as any}</main>
      </body>
    </html>
  );
}

// DEC-366/DEC-377: the closed/not-yet-open copy is unchanged behavior, just
// re-skinned into the .chq-cfp-closed card frame from the design mock.
function ClosedPage(props: { event: EventRow; form: FormRow }) {
  return (
    <PageShell title={`Submissions closed - ${props.event.name}`} accentColor={branding(props.event).accentColor}>
      <div class="chq-cfp-closed">
        <span class="chq-cfp-meta">{props.event.name}</span>
        <h1>The call for papers has closed</h1>
        <p role="alert" class="chq-cfp-closed-body">
          Submissions for this event closed on{" "}
          {formatEventDateTime(
            props.form.closeDate ? dayLabelEndInstant(props.form.closeDate, props.event.timezone) : 0,
            props.event.timezone,
          )}
          . Thanks for your
          interest — please reach out to the organizers directly if you have questions.
        </p>
      </div>
    </PageShell>
  );
}

function NotYetOpenPage(props: { event: EventRow; form: FormRow }) {
  return (
    <PageShell title={`Submissions not yet open - ${props.event.name}`} accentColor={branding(props.event).accentColor}>
      <div class="chq-cfp-closed">
        <span class="chq-cfp-meta">{props.event.name}</span>
        <h1>Submissions aren't open yet</h1>
        <p role="alert" class="chq-cfp-closed-body">
          Submissions open{" "}
          {formatEventDateTime(
            props.form.openDate ? dayLabelStartInstant(props.form.openDate, props.event.timezone) : 0,
            props.event.timezone,
          )}
          . Please check back then.
        </p>
      </div>
    </PageShell>
  );
}

function DraftBanner(props: { formId: string; savedAt: number; timeZone: string }) {
  return (
    <p role="status" class="chq-cfp-actions-note">
      Resuming your saved draft from {formatEventDateTime(props.savedAt, props.timeZone)}.
    </p>
  );
}

// DEC-245: the save-draft POST redirects to ?draft=saved so the browser's
// address bar and back/forward history reflect the saved state, and the
// GET handler renders this distinct notice above the form — separate from
// the DraftBanner shown when merely resuming an earlier draft.
function DraftSavedNotice() {
  return (
    <p role="status" class="chq-cfp-actions-note">
      Draft saved — you can return later to finish and submit.
    </p>
  );
}

function TrackChoices(props: { tracks: TrackRow[]; selected: string[] }) {
  return (
    <fieldset class="chq-cfp-fieldset">
      <legend>Track *</legend>
      {props.tracks.map((track) => (
        <label class="chq-cfp-option">
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
  draftSavedNotice?: boolean;
}) {
  const { event, form, fields, tracks, answers, selectedTrackIds, csrfToken, errors, trackError } = props;
  const accentColor = branding(event).accentColor;
  const logoUrl = branding(event).logoUrl;
  return (
    <PageShell title={`Submit a session - ${event.name}`} accentColor={accentColor}>
      <div class="chq-cfp-shell">
        <header class="chq-cfp-header">
          {logoUrl ? <img src={logoUrl} alt={`${event.name} logo`} height={32} /> : null}
          <span class="chq-cfp-meta">{event.name}</span>
          <span class="chq-cfp-title">{form.title}</span>
          {form.closeDate ? (
            <span class="chq-cfp-sub">
              Call for papers · closes {formatEventDateTime(dayLabelEndInstant(form.closeDate, event.timezone), event.timezone)}
            </span>
          ) : null}
        </header>
        <div class="chq-cfp-body">
          <div class="chq-cfp-intro">
            <h1>Submit a talk</h1>
          </div>
          {props.draftSavedNotice ? (
            <DraftSavedNotice />
          ) : props.hasDraft && props.draftSavedAt !== undefined ? (
            <DraftBanner formId={form.id} savedAt={props.draftSavedAt} timeZone={event.timezone} />
          ) : null}
          <form method="post" action={`/submit/${event.slug}`} enctype="multipart/form-data">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
            <section>
              <div class="chq-cfp-section-label">Your talk</div>
              <div class="chq-cfp-fields">
                <FormFieldsSection
                  fields={fields}
                  section="session"
                  answers={answers}
                  errors={errors}
                  isVisible={isVisible}
                />
                {trackError ? (
                  <p role="alert" class="chq-field-error">
                    {trackError}
                  </p>
                ) : null}
                {/* DEC-301: a form offering zero tracks renders no Track
                    fieldset — once validateTrackChoice's membership check
                    clears (DEC-416: it runs even when nothing is offered,
                    rejecting any foreign track id), an empty offered set
                    only relaxes the "must pick one" requirement, so an
                    empty required-looking block would be unactionable and
                    misleading. */}
                {tracks.length > 0 ? <TrackChoices tracks={tracks} selected={selectedTrackIds} /> : null}
              </div>
            </section>
            <section>
              <div class="chq-cfp-section-label">You</div>
              <div class="chq-cfp-fields">
                <FormFieldsSection
                  fields={fields}
                  section="speaker"
                  answers={answers}
                  errors={errors}
                  isVisible={isVisible}
                />
              </div>
            </section>
            <div class="chq-cfp-actions">
              <button type="submit" class="chq-btn chq-btn-primary">
                Submit this talk
              </button>
              <button
                type="submit"
                class="chq-btn chq-btn-secondary"
                formaction={`/submit/${event.slug}/save-draft`}
                formnovalidate
              >
                Save draft
              </button>
              <span class="chq-cfp-actions-note">We email a confirmation with a link to your portal</span>
            </div>
          </form>
          <FieldRulesScript fields={fields} />
        </div>
      </div>
    </PageShell>
  );
}

// DEC-098: the on-screen claim link is only safe to render when the
// contact was freshly created by *this* submit request — anyone can type
// an existing CRM contact's email into the public form, so rendering that
// contact's claim URL on screen would let them take over the portal. Three
// states:
//  - "fresh": no user, contact created by this request -> claim link shown
//    (byte-compatible with the pre-DEC-098 markup: walkthrough/scale
//    scripts scrape `href="...(/claim/...)"` from this exact case).
//  - "pending-existing-contact": no user, but the contact already existed
//    -> no claim URL anywhere in the HTML; copy points at the emailed
//    password-setup link plus a /login fallback.
//  - "has-account": a user already exists for this email -> /login, as
//    before.
type ConfirmationState = "fresh" | "pending-existing-contact" | "has-account";

function ConfirmationPage(props: { event: EventRow; title: string; claimPath: string; state: ConfirmationState }) {
  return (
    <PageShell title={`Submission received - ${props.event.name}`}>
      <div class="chq-cfp-confirm">
        <span class="chq-cfp-confirm-flag">Submitted</span>
        <h1>Thanks for your submission!</h1>
        <div class="chq-cfp-confirm-card">
          <span class="chq-cfp-title" style="font-size:17px">
            {props.title}
          </span>
        </div>
        {/* DEC-377: no delivery-window or "check spam" timing promise here —
            the earlier copy asserted arrival timing the confirmation email
            send (a best-effort side effect) can't actually guarantee. */}
        <p class="chq-cfp-confirm-body">We've emailed a confirmation for "{props.title}" to the address you provided.</p>
        <div class="chq-cfp-confirm-actions">
          {props.state === "has-account" ? (
            <p>
              <a href="/login">Log in</a> to track your submission.
            </p>
          ) : props.state === "pending-existing-contact" ? (
            <p>
              A password-setup link was emailed to the address you submitted. <a href="/login">Log in</a> if you
              already have a password.
            </p>
          ) : (
            // DEC-252: same-origin on-page links are RELATIVE — they never
            // depend on origin inference. Only the emailed copy (built with
            // resolveBaseUrl below) is absolute.
            <p>
              <a href={props.claimPath}>Create a password to track your submission</a>
            </p>
          )}
        </div>
      </div>
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
  if (!event) return c.text("Event not found.", 404);
  const form = await getDefaultForm(db, event.id);
  if (!form) return c.text("This event is not accepting submissions yet.", 404);

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
  const rate = await checkAndIncrementScopedLimit(kv, "draft", ip, Date.now(), {
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

publicSubmitRoutes.post("/submit/:eventSlug", csrfForm, async (c) => {
  const db = c.var.db;
  const event = await getEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const form = await getDefaultForm(db, event.id);
  if (!form) return c.text("This event is not accepting submissions yet.", 404);

  const windowState = formWindowState(form.openDate, form.closeDate, Date.now(), event.timezone);
  if (windowState === "not_yet_open") {
    return c.html(<NotYetOpenPage event={event} form={form} />);
  }
  if (windowState === "closed") {
    return c.html(<ClosedPage event={event} form={form} />);
  }

  // DEC-072: per-IP rate limit, raised from 10 to 60/hour — shared IPs
  // (offices, conference wifi, NAT) legitimately produce bursts of
  // submissions from distinct speakers; the cap exists to stop abuse, not
  // to punish shared addresses. DEC-057: uses the canonical scoped limiter
  // (DEC-038).
  const kv = c.env.KV as unknown as DraftKVStore;
  const ip = requestIpFromHeaders((name) => c.req.header(name));
  const rate = await checkAndIncrementScopedLimit(kv, "submit", ip, Date.now(), {
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
    // DEC-132: rule-hidden file fields are ignored entirely — no upload
    // validation, no error, no "pending" placeholder — so a hidden field
    // never blocks submit and never leaves any trace of an attempted file.
    if (!isVisible(field, answers)) continue;
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
    // DEC-321(b): never overwrite a non-empty stored profile value — only
    // fill columns that are currently null/empty.
    const filled = await fillContactProfileIfBlank(
      db,
      contactId,
      { title: existingContact.title, company: existingContact.company, bio: existingContact.bio },
      { title: jobTitle, company, bio },
    );
    resolvedTitle = filled.title;
    resolvedCompany = filled.company;
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

  const submission = await createSubmission(db, { eventId: event.id, formId: form.id, title, description });
  await createParticipant(db, {
    submissionId: submission.id,
    contactId,
    titleAtTime: resolvedTitle,
    orgAtTime: resolvedCompany,
  });
  await createSubmissionTracks(db, submission.id, selectedTrackIds);

  // Upload each valid file answer now that the submission exists, and swap
  // the "pending" placeholder for the real file id (DEC-040: the answer
  // value is the file.id string).
  const fileStore = makeFileStore(c.env.FILES);
  for (const field of fileFields) {
    // DEC-132: only proceed for fields that survived validation with the
    // "pending" placeholder (visible + valid upload) — hidden fields never
    // reach `answers[field.id] = "pending"` above, so `cleaned[field.id]`
    // is undefined here and this loop skips them entirely.
    if (cleaned[field.id] !== "pending") continue;
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

  const mailer = makeMailer(db, c.env);
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
  // The submission is already persisted; the confirmation email is a
  // best-effort side effect at an IO boundary (a real provider can reject a
  // recipient or transiently fail). A send failure must NOT 500 the submit —
  // that showed the speaker an error page while the row persisted, so every
  // retry created a duplicate. Log it (the send attempt is recorded in
  // email_log with status 'error' by the mailer) and still show success.
  try {
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
    <ConfirmationPage event={event} title={title} claimPath={claimPath} state={confirmationState} />,
  );
});
