// API error envelope + Hono error registration, per DEC-013.
// Errors: non-2xx bodies are { error: { code, message, fields? } }.
// Unexpected exceptions become a 500 with code 'internal' — fail loudly, no
// swallowing; they are logged to the console, never hidden.

import type { Context, Hono } from "hono";
import type { AppEnv } from "./env";
import { escapeHtml } from "../lib/html-escape";

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
  | "internal";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  internal: 500,
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

/**
 * Validates and returns a bounded array of non-empty string ids.
 * Fails loudly (no silent filtering) on: non-array input, empty array,
 * more than `opts.maxCount` (default DEFAULT_BOUNDED_ID_ARRAY_MAX) elements,
 * any non-string element, or any element with length 0 or > 64.
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
      [field]: `Max ${maxCount}`,
    });
  }
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0 || item.length > 64) {
      throw new ApiError("invalid", `${field} must be an array of id strings (1-64 chars)`, {
        [field]: "Invalid id",
      });
    }
  }
  return value;
}

// DEC-417
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
  if (typeof value !== "string") {
    throw new ApiError("invalid", `${field} must be a string`, { [field]: "Invalid" });
  }
  const result = opts.trim !== false ? value.trim() : value;
  if (opts.required && result.length === 0) {
    throw new ApiError("invalid", `${field} is required`, { [field]: "Required" });
  }
  if (result.length > opts.max) {
    throw new ApiError("invalid", `${field} must be at most ${opts.max} characters`, {
      [field]: `Max ${opts.max}`,
    });
  }
  return result;
}

// DEC-417
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

// DEC-626/DEC-841: a minimal self-contained HTML error page for requests
// that want an HTML surface -- either marked htmlSurface (plain form posts,
// including a form post to an /api/v1 path) or any non-API-path GET
// navigation -- an HTML navigation never ends as a JSON blob. Same status as
// the JSON envelope would have used; message is the visible text; 'Go back'
// links to the referring path (same-origin only) or '/'.
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
        err.status as 400 | 401 | 403 | 404 | 409,
      );
    }
    return c.json(errorEnvelope(err), err.status as 400 | 401 | 403 | 404 | 409);
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
