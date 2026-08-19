// API error envelope + Hono error registration, per DEC-013.
// Errors: non-2xx bodies are { error: { code, message, fields? } }.
// Unexpected exceptions become a 500 with code 'internal' — fail loudly, no
// swallowing; they are logged to the console, never hidden.

import type { Context, Hono } from "hono";
import type { AppEnv } from "./env";
import { escapeHtml } from "../lib/html-escape";
import { overCapFieldMessage, overCapCountMessage } from "../domain/cap-copy";

// DEC-841: the one place the "/api/v1 vs everything else" rule lives. Both
// the notFound handler (not-found.tsx) and the onError handler below
// classify a request the same way -- an HTML navigation always gets an HTML
// error, an API call always gets the JSON envelope, regardless of which
// handler happens to fire.
export const API_PREFIX = "/api/v1";

export function isApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "conflict"
  | "internal"
  | "payload_too_large";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  internal: 500,
  payload_too_large: 413,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fields = fields;
  }
}

export function errorEnvelope(err: ApiError): {
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string> };
} {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.fields ? { fields: err.fields } : {}),
    },
  };
}

// DEC-182
/** parseBoundedIdArray's default cap when the caller doesn't pass
 * opts.maxCount — the single source for that literal, so callers (like
 * scripts/perf-smoke.ts's bulk status change probe) can size a batch off
 * the real enforced cap instead of hardcoding a second copy of 1000. */
export const DEFAULT_BOUNDED_ID_ARRAY_MAX = 1000;
// The per-item length ceiling for parseBoundedIdArray -- ids are ULIDs/UUIDs
// (26-36 chars) but this stays generous rather than coupling to one id
// scheme; the message below cites this constant, not a hand-typed '64'.
export const BOUNDED_ID_ARRAY_ITEM_MAX_LENGTH = 64;

/**
 * Validates and returns a bounded array of non-empty string ids.
 * Fails loudly (no silent filtering) on: non-array input, empty array,
 * more than `opts.maxCount` (default DEFAULT_BOUNDED_ID_ARRAY_MAX) elements,
 * any non-string element, or any element with length 0 or > 64.
 *
 * DEC-182 amendment: this is the ONE place bulk ids become a set. The cap
 * and per-element checks run against the raw (possibly-duplicated) input
 * first -- so e.g. 1000 copies of the same id still 400 on count -- and
 * only then is the array deduped, first-occurrence order preserved, before
 * being returned. Every downstream consumer (chunked IN() queries, bulk
 * status updates, compose recipient expansion, etc.) counts and iterates
 * off this returned array, so none of them can double-count or double-send
 * a repeated id.
 */
export function parseBoundedIdArray(
  value: unknown,
  field: string,
  opts?: { maxCount?: number },
): string[] {
  const maxCount = opts?.maxCount ?? DEFAULT_BOUNDED_ID_ARRAY_MAX;
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError("invalid", `${field} must be a non-empty array of ids`, {
      [field]: "Required",
    });
  }
  if (value.length > maxCount) {
    throw new ApiError("invalid", `${field} must not exceed ${maxCount} entries`, {
      [field]: overCapCountMessage(value.length, maxCount, "entry"),
    });
  }
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0 || item.length > BOUNDED_ID_ARRAY_ITEM_MAX_LENGTH) {
      throw new ApiError("invalid", `${field} must be an array of id strings (1-${BOUNDED_ID_ARRAY_ITEM_MAX_LENGTH} chars)`, {
        [field]: "Invalid id",
      });
    }
  }
  return Array.from(new Set(value));
}

// DEC-417
// Shared bounded-text check: single source of truth for the "must be a
// string" / "is required" / over-cap message strings, consumed by both the
// throwing (parseBoundedText) and accumulating (collectBoundedText) forms.
// Returns either the validated (trimmed) result or a { message, fieldValue }
// failure describing what to throw / accumulate.
function checkBoundedText(
  value: unknown,
  field: string,
  opts: { max: number; required?: boolean; trim?: boolean },
): { ok: true; value: string } | { ok: false; message: string; fieldValue: string } {
  if (typeof value !== "string") {
    return { ok: false, message: `${field} must be a string`, fieldValue: "Invalid" };
  }
  const result = opts.trim !== false ? value.trim() : value;
  if (opts.required && result.length === 0) {
    return { ok: false, message: `${field} is required`, fieldValue: "Required" };
  }
  if (result.length > opts.max) {
    return {
      ok: false,
      message: `${field} must be at most ${opts.max} characters`,
      fieldValue: overCapFieldMessage(result.length, opts.max),
    };
  }
  return { ok: true, value: result };
}

/**
 * Validates and returns a bounded, optionally-required, string field.
 * Fails loudly on non-string input, missing-when-required, or over-cap
 * length -- a clean 400 instead of a downstream D1 SQLITE_TOOBIG 500.
 * Cap constants live in ../forms/validate (single source of truth).
 */
export function parseBoundedText(
  value: unknown,
  field: string,
  opts: { max: number; required?: boolean; trim?: boolean },
): string {
  const result = checkBoundedText(value, field, opts);
  if (!result.ok) {
    throw new ApiError("invalid", result.message, { [field]: result.fieldValue });
  }
  return result.value;
}

/** Like parseBoundedText, but nullable columns: undefined/null/empty -> null. */
export function parseBoundedOptionalText(
  value: unknown,
  field: string,
  opts: { max: number },
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = parseBoundedText(value, field, { max: opts.max, required: false, trim: true });
  return text.length === 0 ? null : text;
}

// DEC-417 (amendment, wave 14)
/**
 * Like parseBoundedText, but accumulates its failure message into `fields`
 * instead of throwing, so callers can report every invalid field on a
 * multi-field write in one 400 rather than stopping at the first problem.
 * Returns a safe fallback ('') on failure -- callers must check `fields`
 * for emptiness before treating the return value as valid.
 */
export function collectBoundedText(
  value: unknown,
  field: string,
  opts: { max: number; required?: boolean; trim?: boolean },
  fields: Record<string, string>,
): string {
  const result = checkBoundedText(value, field, opts);
  if (!result.ok) {
    fields[field] = result.fieldValue;
    return "";
  }
  return result.value;
}

// DEC-417 (amendment, wave 14)
/** Like parseBoundedOptionalText, but accumulates into `fields` instead of throwing. */
export function collectBoundedOptionalText(
  value: unknown,
  field: string,
  opts: { max: number },
  fields: Record<string, string>,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = collectBoundedText(value, field, { max: opts.max, required: false, trim: true }, fields);
  if (fields[field] !== undefined) {
    return null;
  }
  return text.length === 0 ? null : text;
}

// DEC-635 (amendment, wave 50): the ONE sanctioned way to read an OPTIONAL
// JSON request body -- an absent/empty body is a valid "use the defaults"
// signal (not an error), but a present-and-malformed body must still land
// on the house 400 `invalid` envelope instead of an uncaught SyntaxError
// producing a 500 `internal`. Every route with an optional body (empty ==
// defaults, present == parsed) must call this instead of a bare
// `c.req.text()` + `JSON.parse` -- see test/request-body-envelope.scan.test.ts,
// which fails the build if a new bare pattern appears.
export async function readOptionalJsonBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const raw = await c.req.text();
  if (raw.trim().length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new ApiError("invalid", "Invalid JSON body");
    }
    throw err;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ApiError("invalid", "Invalid JSON body");
  }
  return parsed as Record<string, unknown>;
}

// DEC-635 (amendment, wave 52): the REQUIRED-body twin of readOptionalJsonBody
// above -- a route whose body is genuinely optional (empty == defaults) must
// keep using readOptionalJsonBody; this one is for routes where a blank or
// absent body is itself an error (create/update payloads). A blank/absent
// body, a JSON.parse SyntaxError, or a parsed value that isn't a non-array
// object each throw the house 400 `invalid` envelope; any other error
// rethrows -- fail loudly, never swallowed.
export async function readJsonBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const raw = await c.req.text();
  if (raw.trim().length === 0) {
    throw new ApiError("invalid", "Invalid JSON body");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new ApiError("invalid", "Invalid JSON body");
    }
    throw err;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ApiError("invalid", "Invalid JSON body");
  }
  return parsed as Record<string, unknown>;
}

// DEC-627 (amendment, wave 6): the ONE place an all-optional PATCH refuses
// an empty/no-op body. `supplied` is whatever the caller has already
// resolved for each recognised field -- either the raw parsed body (when
// every key maps 1:1 to a body property) or a small record the caller
// assembles from its own derived values (e.g. a validated sub-object) --
// and `names` is the closed list of fields this route recognises. A field
// counts as "supplied" iff its value in `supplied` is not `undefined`;
// every route calling this must therefore only ever store `undefined` for
// an absent/not-provided field, never for "present but invalid" (those are
// caught by the route's own per-field validation, which always runs
// first). Mirrors the shape submissions.ts's PATCH originated (DEC-627
// wave-6 amendment): a single shared helper instead of N hand-written
// "Object.keys(fields).length === 0" ladders (DEC-613's delay-fuse trap).
export function requireAtLeastOneField(supplied: Record<string, unknown>, names: readonly string[]): void {
  if (names.length === 0) {
    throw new Error("requireAtLeastOneField: names must be non-empty");
  }
  const anyProvided = names.some((name) => supplied[name] !== undefined);
  if (anyProvided) return;
  const first: string = names[0] as string;
  const last: string = names[names.length - 1] as string;
  const list = names.length === 1 ? first : `${names.slice(0, -1).join(", ")}, or ${last}`;
  throw new ApiError("invalid", `At least one of ${list} is required`, {
    [first]: `Provide ${list}`,
  });
}

// DEC-626/DEC-841: a minimal self-contained HTML error page for requests
// that want an HTML surface -- either marked htmlSurface (plain form posts,
// including a form post to an /api/v1 path) or any non-API-path GET
// navigation -- an HTML navigation never ends as a JSON blob. Same status as
// the JSON envelope would have used; message is the visible text; 'Go back'
// links to the referring path (same-origin only) or '/'.
//
// focus-treatment-exempt: this is the last-resort error document, emitted
// from the error handler itself. It carries no stylesheet at all -- not
// THEME_CSS, not a link -- deliberately, because it must render when the
// failure that produced it may be in the very module a shell would import.
// Its one interactive element is a plain anchor, which wears the browser's
// own focus mark on an unstyled page rather than a house ring that is not
// there to give.
function renderHtmlError(message: string, referer: string | undefined, requestUrl: string): string {
  const safeMessage = escapeHtml(message);
  const backHref = safeReferrerPath(referer, requestUrl);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body><p role="alert">${safeMessage}</p><p><a href="${backHref}">Go back</a></p></body></html>`;
}

// Only a same-origin path is ever used as the back link -- an absolute or
// cross-origin referer is discarded in favor of '/', never interpolated
// unchecked into an href. DEC-841 wave 54 amendment: origins are compared
// (not just parsed), and any pathname beginning with '//' is refused even
// when same-origin, since '//host/path' renders as a protocol-relative,
// off-site href.
function safeReferrerPath(referer: string | undefined, requestUrl: string): string {
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    const reqOrigin = new URL(requestUrl).origin;
    if (url.origin !== reqOrigin) return "/";
    const path = url.pathname + url.search;
    if (path.startsWith("//")) return "/";
    return path || "/";
  } catch {
    return "/";
  }
}

// DEC-841: the ONE predicate deciding HTML-vs-JSON for an error response --
// exported so a sub-app's onError (e.g. public routes, wave 16 amendment)
// can decide whether to render its OWN html chrome around the message
// without re-deriving a second copy of this classification.
export function wantsHtmlResponse(c: Context<AppEnv>): boolean {
  return c.var.htmlSurface === true || !isApiPath(new URL(c.req.url).pathname);
}

// The one error responder: a sub-app's onError may override headers (e.g.
// Cache-Control), but never the body shape -- everything renders through
// this function so HTML vs JSON classification and body construction stay
// in exactly one place. DEC-841.
export function errorResponse(c: Context<AppEnv>, err: unknown): Response {
  const wantsHtml = wantsHtmlResponse(c);
  if (err instanceof ApiError) {
    if (wantsHtml) {
      return c.html(
        renderHtmlError(err.message, c.req.header("referer") ?? undefined, c.req.url),
        err.status as 400 | 401 | 403 | 404 | 409 | 413,
      );
    }
    return c.json(errorEnvelope(err), err.status as 400 | 401 | 403 | 404 | 409 | 413);
  }
  // Fail loudly: unexpected errors are never swallowed, always logged.
  console.error("unhandled error", err);
  if (wantsHtml) {
    return c.html(
      renderHtmlError("Internal server error", c.req.header("referer") ?? undefined, c.req.url),
      500,
    );
  }
  return c.json({ error: { code: "internal", message: "Internal server error" } }, 500);
}

/** Registers the shared onError handler; call once on the top-level app. */
export function registerErrorHandler(app: Hono<AppEnv>): void {
  app.onError((err, c) => errorResponse(c, err));
}
