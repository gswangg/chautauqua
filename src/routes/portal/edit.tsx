// Speaker submission editing (J2/CFP-06, DEC-041): edit until close date,
// accepted speakers keep editing, server-side edit lock (never trust the
// hidden form). Route files export a named Hono sub-app; only src/index.ts
// mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { speakerGate, PortalLayout, PortalBackLink } from "./shared";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import {
  assertSpeakerContactId,
  getPortalData,
} from "../../server/repo/portal";
import {
  loadEditableSubmission,
  saveSubmissionEdits,
  getPortalParticipants,
  addCoPresenter,
  type EditableSubmissionData,
  type PortalParticipant,
} from "../../server/repo/portal-edit";
import { canEditSubmission, canEditTracks } from "../../domain/edit-lock";
import { validateAnswers } from "../../forms/validate";
import { makeVisibilityPredicate } from "../../forms/visibility";
import type { AnswerMap } from "../../forms/types";
import { lockedFieldName } from "../../forms/types";
import { FormFieldsSection, FieldRulesScript, fieldInputName } from "../../views/form-render";
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../auth/cookies";
import { DEC_041, DEC_074, DEC_109, DEC_121, DEC_604 } from "../../decisions";
import { validateTrackChoice } from "../../lib/submit-core";
import { CO_PRESENTER_ROLE_VALUES, PARTICIPANT_ROLE_OPTIONS } from "../../domain/participant-roles";

export const portalEditRoutes = new Hono<AppEnv>();

// touch DEC constant so the dependency is compile-checked (field guide convention)
void DEC_041;
void DEC_074;
void DEC_109;
void DEC_121;
void DEC_604;

portalEditRoutes.use("*", speakerGate);

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

export function extractAnswers(
  fields: EditableSubmissionData["fields"],
  body: Record<string, unknown>,
  storedAnswers: AnswerMap,
): AnswerMap {
  const answers: AnswerMap = {};
  for (const field of fields) {
    const name = fieldInputName(field.id);
    if (field.kind === "checkbox") {
      answers[field.id] = body[name] !== undefined;
      continue;
    }
    if (field.kind === "file") {
      // File-kind answers are shown read-only per DEC-041 — the current
      // filename is displayed but never re-submitted or re-validated here.
      // Never read file inputs from body; carry over the stored answer
      // (if any) so validation sees the existing file (DEC-109).
      const stored = storedAnswers[field.id];
      if (typeof stored === "string" && stored.length > 0) {
        answers[field.id] = stored;
      }
      continue;
    }
    if (lockedFieldName(field.id) === "email") {
      // DEC-121: email is locked/read-only in the edit form — never read a
      // body-supplied field__email (a client could post one anyway), always
      // carry over the contact-sourced stored answer so required-validation
      // passes and the value can never be spoofed here.
      const stored = storedAnswers[field.id];
      if (typeof stored === "string" && stored.length > 0) {
        answers[field.id] = stored;
      }
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

// Exported so a render-parity test (DEC-696) can assert the track fieldset
// uses the same option-class vocabulary and copy as the public CFP form's
// TrackChoices (src/routes/public/submit-views.tsx) without going through a
// full HTTP round trip.
export function EditPage(props: {
  branding: { eventName: string; welcomeMessage: string | null; accentColor: string | null; logoUrl: string | null };
  submissionId: string;
  data: EditableSubmissionData;
  answers: AnswerMap;
  selectedTrackIds: string[];
  csrfToken: string;
  errors?: Record<string, string>;
  trackError?: string;
  editable: boolean;
  tracksEditable: boolean;
  participants: PortalParticipant[];
  participantErrors?: Record<string, string>;
  participantValues?: { firstName: string; lastName: string; email: string; role: string };
  speakerName: string;
}) {
  const { data, answers, selectedTrackIds, csrfToken, errors, trackError, editable, tracksEditable, participants, participantErrors, participantValues, speakerName } = props;
  if (!editable) {
    return (
      <PortalLayout branding={props.branding} csrfToken={csrfToken} speakerName={speakerName}>
        <PortalBackLink to={`/portal/submissions/${props.submissionId}`} />
        <h1 class="chq-portal-hero">Editing closed</h1>
        <p role="alert">
          This submission can no longer be edited — the form's submission window has closed.
        </p>
      </PortalLayout>
    );
  }
  const offeredTracks = data.allTracks.filter((t) => data.offeredTrackIds.includes(t.id));
  // DEC-532: one predicate built from the FULL field list (a session field
  // can gate a speaker field), shared by both sections below.
  const isVisible = makeVisibilityPredicate(data.fields, answers);
  return (
    <PortalLayout branding={props.branding} csrfToken={csrfToken} speakerName={speakerName}>
      <PortalBackLink to={`/portal/submissions/${props.submissionId}`} />
      <h1 class="chq-portal-hero">Edit submission</h1>
      <form method="post" action={`/portal/submissions/${props.submissionId}/edit`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <div class="chq-section-label">Session</div>
        <FormFieldsSection fields={data.fields} section="session" answers={answers} errors={errors} isVisible={isVisible} />
        {tracksEditable ? (
          <fieldset class="chq-cfp-fieldset">
            <legend>Tracks</legend>
            <p class="help">Choose all that apply.</p>
            {offeredTracks.map((track) => (
              <label class="chq-cfp-option">
                <input type="checkbox" name="trackIds" value={track.id} checked={selectedTrackIds.includes(track.id)} />
                {track.name}
              </label>
            ))}
            {trackError ? (
              <p role="alert" class="field-error">
                {trackError}
              </p>
            ) : null}
          </fieldset>
        ) : (
          <p class="chq-portal-sub">
            Tracks: {data.allTracks.filter((t) => selectedTrackIds.includes(t.id)).map((t) => t.name).join(", ") || "None"}{" "}
            (editing closed)
          </p>
        )}
        <div class="chq-section-label">Speaker</div>
        <FormFieldsSection
          fields={data.fields.filter((f) => lockedFieldName(f.id) !== "email")}
          section="speaker"
          answers={answers}
          errors={errors}
          isVisible={isVisible}
        />
        {data.fields
          .filter((f) => lockedFieldName(f.id) === "email")
          .map((f) => (
            <p class="chq-portal-sub">
              Email: {String(answers[f.id] ?? "")} (read-only)
            </p>
          ))}
        {data.fields
          .filter((f) => f.kind === "file")
          .map((f) => (
            <p class="chq-portal-sub">
              {f.label}: {String(answers[f.id] ?? "No file uploaded")} (read-only)
            </p>
          ))}
        <div class="chq-portal-actions">
          <button type="submit" class="chq-btn chq-btn-primary">Save changes</button>
        </div>
      </form>
      <FieldRulesScript fields={data.fields} />
      <ParticipantsSection
        submissionId={props.submissionId}
        csrfToken={csrfToken}
        participants={participants}
        errors={participantErrors}
        values={participantValues}
      />
    </PortalLayout>
  );
}

// DEC-604: a speaker may self-add a co-presenter to their own submission.
// Resolution against the org's contacts and the invite-free write are
// server-side only (src/server/repo/portal-edit.ts:addCoPresenter) — this
// component is presentation only.
function ParticipantsSection(props: {
  submissionId: string;
  csrfToken: string;
  participants: PortalParticipant[];
  errors?: Record<string, string>;
  values?: { firstName: string; lastName: string; email: string; role: string };
}) {
  const { submissionId, csrfToken, participants, errors, values } = props;
  return (
    <section aria-label="Participants" class="chq-section">
      <div class="chq-section-label">Participants</div>
      {participants.length === 0 ? (
        <p>No participants yet.</p>
      ) : (
        <ul>
          {participants.map((p) => (
            <li>
              {p.name} — <span class="chq-flag">{p.roleLabel}</span>
              {!p.visible ? (
                <span class="chq-portal-sub"> — Not yet on the public site. Your organiser publishes co-presenters.</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <h3 class="chq-portal-field-label">Add a co-presenter</h3>
      <p class="chq-portal-sub">
        Added to this session. Your organiser puts co-presenters on the public site. They will not receive an email
        or invitation.
      </p>
      <form method="post" action={`/portal/submissions/${submissionId}/participants`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <label class="chq-portal-field-label" for="cp-first-name">
          First name
        </label>
        <input id="cp-first-name" type="text" name="firstName" value={values?.firstName ?? ""} />
        {errors?.firstName ? (
          <p role="alert" class="field-error">
            {errors.firstName}
          </p>
        ) : null}
        <label class="chq-portal-field-label" for="cp-last-name">
          Last name
        </label>
        <input id="cp-last-name" type="text" name="lastName" value={values?.lastName ?? ""} />
        {errors?.lastName ? (
          <p role="alert" class="field-error">
            {errors.lastName}
          </p>
        ) : null}
        <label class="chq-portal-field-label" for="cp-email">
          Email
        </label>
        <input id="cp-email" type="email" name="email" value={values?.email ?? ""} />
        {errors?.email ? (
          <p role="alert" class="field-error">
            {errors.email}
          </p>
        ) : null}
        <label class="chq-portal-field-label" for="cp-role">
          Role
        </label>
        <select id="cp-role" name="role">
          {PARTICIPANT_ROLE_OPTIONS.filter((o) => CO_PRESENTER_ROLE_VALUES.includes(o.value)).map((o) => (
            <option value={o.value} selected={(values?.role ?? CO_PRESENTER_ROLE_VALUES[0]) === o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors?.role ? (
          <p role="alert" class="field-error">
            {errors.role}
          </p>
        ) : null}
        <div class="chq-portal-actions">
          <button type="submit" class="chq-btn chq-btn-secondary">Add co-presenter</button>
        </div>
      </form>
    </section>
  );
}

portalEditRoutes.get("/submissions/:id/edit", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const submissionId = c.req.param("id");
  const data = await loadEditableSubmission(c.var.db, contactId, submissionId);
  if (!data) return c.text("Not found", 404);

  const editable = canEditSubmission(data.submission.status, data.form.closeDate, Date.now(), data.form.timezone);
  const tracksEditable = canEditTracks(data.form.closeDate, Date.now(), data.form.timezone);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  const portalData = await getPortalData(c.var.db, contactId, auth.orgId);
  const participants = await getPortalParticipants(c.var.db, submissionId);

  return c.html(
    <EditPage
      branding={portalData.branding}
      submissionId={submissionId}
      data={data}
      answers={data.answers}
      selectedTrackIds={data.selectedTrackIds}
      csrfToken={csrfToken}
      editable={editable}
      tracksEditable={tracksEditable}
      participants={participants}
      speakerName={portalData.contactName}
    />,
  );
});

portalEditRoutes.post("/submissions/:id/edit", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const submissionId = c.req.param("id");
  const data = await loadEditableSubmission(c.var.db, contactId, submissionId);
  if (!data) return c.text("Not found", 404);

  // Server-side re-check — never trust the hidden form (DEC-041): a client
  // could POST here after the window closes even if the GET rendered the
  // read-only notice.
  const editable = canEditSubmission(data.submission.status, data.form.closeDate, Date.now(), data.form.timezone);
  if (!editable) {
    throw new ApiError("forbidden", "This submission can no longer be edited");
  }
  const tracksEditable = canEditTracks(data.form.closeDate, Date.now(), data.form.timezone);

  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const answers = extractAnswers(data.fields, body, data.answers);
  // File fields are read-only here (DEC-041): a missing stored file answer
  // must never be fatal, so required is forced false for file fields only.
  // Public submit's validateAnswers still enforces required files.
  const validation = validateAnswers(
    data.fields.map((f) => (f.kind === "file" ? { ...f, required: false } : f)),
    answers,
  );

  const selectedTrackIds = tracksEditable
    ? Array.from(new Set(extractTrackIds(body)))
    : data.selectedTrackIds;
  let trackError: string | undefined;
  if (tracksEditable) {
    const trackResult = validateTrackChoice(selectedTrackIds, data.offeredTrackIds);
    if (!trackResult.ok) trackError = trackResult.error;
  }

  if (!validation.ok || trackError) {
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
    const portalData = await getPortalData(c.var.db, contactId, auth.orgId);
    const participants = await getPortalParticipants(c.var.db, submissionId);
    return c.html(
      <EditPage
        branding={portalData.branding}
        submissionId={submissionId}
        data={data}
        answers={answers}
        selectedTrackIds={selectedTrackIds}
        csrfToken={csrfToken}
        errors={validation.ok ? undefined : validation.errors}
        trackError={trackError}
        editable={true}
        tracksEditable={tracksEditable}
        participants={participants}
        speakerName={portalData.contactName}
      />,
      400,
    );
  }

  await saveSubmissionEdits(
    c.var.db,
    submissionId,
    contactId,
    validation.cleaned,
    tracksEditable ? selectedTrackIds : null,
    validation.hiddenFieldIds,
    validation.clearedFieldIds,
  );
  return c.redirect(`/portal/submissions/${submissionId}`, 302);
});

interface AddCoPresenterBody {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  role?: unknown;
}

// POST /portal/submissions/:id/participants — DEC-604: a speaker self-adds
// a co-presenter to their own submission. Nothing here sends email; the
// page states that the co-presenter is recorded but not notified.
portalEditRoutes.post("/submissions/:id/participants", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const submissionId = c.req.param("id");
  const data = await loadEditableSubmission(c.var.db, contactId, submissionId);
  if (!data) return c.text("Not found", 404);

  // Server-side re-check — never trust the hidden form (DEC-041/DEC-604): a
  // client could POST here after the edit window closes.
  const editable = canEditSubmission(data.submission.status, data.form.closeDate, Date.now(), data.form.timezone);
  if (!editable) {
    throw new ApiError("forbidden", "This submission can no longer be edited");
  }
  const tracksEditable = canEditTracks(data.form.closeDate, Date.now(), data.form.timezone);

  const body = (await c.req.parseBody()) as AddCoPresenterBody;
  const firstName = typeof body.firstName === "string" ? body.firstName : "";
  const lastName = typeof body.lastName === "string" ? body.lastName : "";
  const email = typeof body.email === "string" ? body.email : "";
  const role = typeof body.role === "string" ? body.role : "";

  const result = await addCoPresenter(c.var.db, {
    submissionId,
    orgId: auth.orgId,
    firstName,
    lastName,
    email,
    role,
  });

  if (!result.ok) {
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
    const portalData = await getPortalData(c.var.db, contactId, auth.orgId);
    const participants = await getPortalParticipants(c.var.db, submissionId);
    return c.html(
      <EditPage
        branding={portalData.branding}
        submissionId={submissionId}
        data={data}
        answers={data.answers}
        selectedTrackIds={data.selectedTrackIds}
        csrfToken={csrfToken}
        editable={true}
        tracksEditable={tracksEditable}
        participants={participants}
        participantErrors={result.errors}
        participantValues={{ firstName, lastName, email, role }}
        speakerName={portalData.contactName}
      />,
      400,
    );
  }

  return c.redirect(`/portal/submissions/${submissionId}/edit`, 302);
});
