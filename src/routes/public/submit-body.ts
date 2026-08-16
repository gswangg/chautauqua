// Request-parsing helpers for the public CFP submit flow
// (src/routes/public/submit.tsx). Split out of submit.tsx purely to reduce
// merge contention on that file — no behavior change. DEC-040 (file-kind
// answers are handled separately, never stringified here).

import { parseCookies, newCsrfToken, buildCsrfCookie, isSecureRequest, CSRF_COOKIE_NAME } from "../../auth/cookies";
import type { AnswerMap, FormFieldDef } from "../../forms/types";
import { lockedFieldName } from "../../forms/types";
import { fieldInputName } from "../../views/form-render";
import { splitSubmittedName, readSingleFormValue } from "../../lib/submit-core";

// DEC-986 (wave 45 amendment): the public CFP's single Name control posts
// under this literal name, deliberately NOT `fieldInputName(<a locked field
// id>)` — neither locked speaker field id (first_name/last_name) may appear
// as its own input on the public form any more.
export const SPEAKER_NAME_FIELD = "speaker_name";
export const NAME_REQUIRED_MESSAGE = "Enter your name";

export function ensureCsrfCookie(c: {
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

// DEC-422/DEC-598 (wave-10 amendment): a repeated `field_<id>` part (an
// array under parseBody({all:true})) is refused, never merged into "a,b" —
// its field id is collected in `repeatedFieldIds` rather than stringified
// into `answers`, so callers can surface REPEATED_ANSWER_MESSAGE as a
// per-field error. Checkbox handling is unchanged (a checkbox's presence,
// not its value, is the answer).
export function extractAnswers(
  fields: FormFieldDef[],
  body: Record<string, unknown>,
): { answers: AnswerMap; repeatedFieldIds: string[] } {
  const answers: AnswerMap = {};
  const repeatedFieldIds: string[] = [];
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
    const result = readSingleFormValue(raw);
    if (!result.ok) {
      repeatedFieldIds.push(field.id);
      continue;
    }
    if (result.value === undefined) continue;
    answers[field.id] = result.value;
  }
  return { answers, repeatedFieldIds };
}

/** DEC-986 (wave 45 amendment): splits the submitted single Name control
 * into the two locked speaker fields (first_name/last_name) and writes the
 * result directly onto `answers`, keyed by whichever field ids THIS form's
 * speaker fields actually carry (DEC-050 per-form-prefixed ids) — must run
 * before validateAnswers so the derived values are what's validated/
 * persisted, and before any re-render so the control round-trips what was
 * typed. Mutates `answers` in place (mirrors extractAnswers' answers being
 * built up field-by-field). */
export function applyNameSplit(fields: FormFieldDef[], body: Record<string, unknown>, answers: AnswerMap): void {
  const firstNameField = fields.find((f) => lockedFieldName(f.id) === "first_name");
  const lastNameField = fields.find((f) => lockedFieldName(f.id) === "last_name");
  const raw = body[SPEAKER_NAME_FIELD];
  const { firstName, lastName } = splitSubmittedName(typeof raw === "string" ? raw : "");
  if (firstNameField) answers[firstNameField.id] = firstName;
  if (lastNameField) answers[lastNameField.id] = lastName;
}

// DEC-598 (wave-10 amendment): trackIds are a SET at every boundary — a
// repeated id here must not become two submission_track rows downstream
// (createSubmissionTracks/replaceSubmissionTracks primary-key on
// [submissionId, trackId]), so this boundary dedupes before returning.
export function extractTrackIds(body: Record<string, unknown>): string[] {
  const raw = body.trackIds;
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw.map(String) : [String(raw)];
  return Array.from(new Set(list));
}
