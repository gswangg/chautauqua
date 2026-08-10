// Speaker submission editing (J2/CFP-06, DEC-041): edit until close date,
// accepted speakers keep editing, server-side edit lock (never trust the
// hidden form). Route files export a named Hono sub-app; only src/index.ts
// mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { speakerGate, PortalLayout } from "./shared";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import {
  assertSpeakerContactId,
  getPortalData,
} from "../../server/repo/portal";
import {
  loadEditableSubmission,
  saveSubmissionEdits,
  type EditableSubmissionData,
} from "../../server/repo/portal-edit";
import { canEditSubmission, canEditTracks } from "../../domain/edit-lock";
import { validateAnswers } from "../../forms/validate";
import { isVisible } from "../../forms/visibility";
import type { AnswerMap } from "../../forms/types";
import { FormFieldsSection, FieldRulesScript, fieldInputName } from "../../views/form-render";
import { parseCookies, newCsrfToken, CSRF_COOKIE_NAME } from "../../auth/cookies";
import { DEC_041, DEC_074 } from "../../decisions";
import { validateTrackChoice } from "../../lib/submit-core";

export const portalEditRoutes = new Hono<AppEnv>();

// touch DEC constant so the dependency is compile-checked (field guide convention)
void DEC_041;
void DEC_074;

portalEditRoutes.use("*", speakerGate);

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

function extractAnswers(fields: EditableSubmissionData["fields"], body: Record<string, unknown>): AnswerMap {
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

function EditPage(props: {
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
}) {
  const { data, answers, selectedTrackIds, csrfToken, errors, trackError, editable, tracksEditable } = props;
  if (!editable) {
    return (
      <PortalLayout branding={props.branding}>
        <a href={`/portal/submissions/${props.submissionId}`}>&larr; Back to submission</a>
        <h2>Editing closed</h2>
        <p role="alert">
          This submission can no longer be edited — the form's submission window has closed.
        </p>
      </PortalLayout>
    );
  }
  const offeredTracks = data.allTracks.filter((t) => data.offeredTrackIds.includes(t.id));
  return (
    <PortalLayout branding={props.branding}>
      <a href={`/portal/submissions/${props.submissionId}`}>&larr; Back to submission</a>
      <h2>Edit submission</h2>
      <form method="post" action={`/portal/submissions/${props.submissionId}/edit`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
        <h3>Session</h3>
        <FormFieldsSection fields={data.fields} section="session" answers={answers} errors={errors} isVisible={isVisible} />
        {tracksEditable ? (
          <fieldset>
            <legend>Track *</legend>
            {offeredTracks.map((track) => (
              <label>
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
          <p>
            Tracks: {data.allTracks.filter((t) => selectedTrackIds.includes(t.id)).map((t) => t.name).join(", ") || "None"}{" "}
            (editing closed)
          </p>
        )}
        <h3>Speaker</h3>
        <FormFieldsSection fields={data.fields} section="speaker" answers={answers} errors={errors} isVisible={isVisible} />
        {data.fields
          .filter((f) => f.kind === "file")
          .map((f) => (
            <p>
              {f.label}: {String(answers[f.id] ?? "No file uploaded")} (read-only)
            </p>
          ))}
        <button type="submit">Save changes</button>
      </form>
      <FieldRulesScript fields={data.fields} />
    </PortalLayout>
  );
}

portalEditRoutes.get("/submissions/:id/edit", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const submissionId = c.req.param("id");
  const data = await loadEditableSubmission(c.var.db, contactId, submissionId);
  if (!data) return c.text("Not found", 404);

  const editable = canEditSubmission(data.submission.status, data.form.closeDate, Date.now());
  const tracksEditable = canEditTracks(data.form.closeDate, Date.now());
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  const portalData = await getPortalData(c.var.db, contactId, auth.orgId);

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
  const editable = canEditSubmission(data.submission.status, data.form.closeDate, Date.now());
  if (!editable) {
    throw new ApiError("forbidden", "This submission can no longer be edited");
  }
  const tracksEditable = canEditTracks(data.form.closeDate, Date.now());

  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  const answers = extractAnswers(data.fields, body);
  const validation = validateAnswers(data.fields, answers);

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
      />,
      400,
    );
  }

  await saveSubmissionEdits(c.var.db, submissionId, validation.cleaned, tracksEditable ? selectedTrackIds : null);
  return c.redirect(`/portal/submissions/${submissionId}`, 302);
});
