// Request-parsing helpers for the public CFP submit flow
// (src/routes/public/submit.tsx). Split out of submit.tsx purely to reduce
// merge contention on that file — no behavior change. DEC-040 (file-kind
// answers are handled separately, never stringified here).

import { parseCookies, newCsrfToken, buildCsrfCookie, isSecureRequest, CSRF_COOKIE_NAME } from "../../auth/cookies";
import type { AnswerMap, FormFieldDef } from "../../forms/types";
import { fieldInputName } from "../../views/form-render";

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

export function extractAnswers(fields: FormFieldDef[], body: Record<string, unknown>): AnswerMap {
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

export function extractTrackIds(body: Record<string, unknown>): string[] {
  const raw = body.trackIds;
  if (raw === undefined) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}
