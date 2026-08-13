// API error envelope + Hono error registration, per DEC-013.
// Errors: non-2xx bodies are { error: { code, message, fields? } }.
// Unexpected exceptions become a 500 with code 'internal' — fail loudly, no
// swallowing; they are logged to the console, never hidden.

import type { Hono } from "hono";
import type { AppEnv } from "./env";

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
/**
 * Validates and returns a bounded array of non-empty string ids.
 * Fails loudly (no silent filtering) on: non-array input, empty array,
 * more than `opts.maxCount` (default 1000) elements, any non-string
 * element, or any element with length 0 or > 64.
 */
export function parseBoundedIdArray(
  value: unknown,
  field: string,
  opts?: { maxCount?: number },
): string[] {
  const maxCount = opts?.maxCount ?? 1000;
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

// DEC-626/DEC-841: a minimal self-contained HTML error page for requests
// that want an HTML surface -- either marked htmlSurface (plain form posts,
// including a form post to an /api/v1 path) or any non-API-path GET
// navigation -- an HTML navigation never ends as a JSON blob. Same status as
// the JSON envelope would have used; message is the visible text; 'Go back'
// links to the referring path (same-origin only) or '/'.
function renderHtmlError(message: string, referer: string | undefined): string {
  const safeMessage = escapeHtmlText(message);
  const backHref = safeReferrerPath(referer);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body><p role="alert">${safeMessage}</p><p><a href="${backHref}">Go back</a></p></body></html>`;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only a same-origin path is ever used as the back link -- an absolute or
// cross-origin referer is discarded in favor of '/', never interpolated
// unchecked into an href.
function safeReferrerPath(referer: string | undefined): string {
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    return url.pathname + url.search || "/";
  } catch {
    return "/";
  }
}

/** Registers the shared onError handler; call once on the top-level app. */
export function registerErrorHandler(app: Hono<AppEnv>): void {
  app.onError((err, c) => {
    const wantsHtml = c.var.htmlSurface === true || !isApiPath(new URL(c.req.url).pathname);
    if (err instanceof ApiError) {
      if (wantsHtml) {
        return c.html(
          renderHtmlError(err.message, c.req.header("referer") ?? undefined),
          err.status as 400 | 401 | 403 | 404 | 409,
        );
      }
      return c.json(errorEnvelope(err), err.status as 400 | 401 | 403 | 404 | 409);
    }
    // Fail loudly: unexpected errors are never swallowed, always logged.
    console.error("unhandled error", err);
    if (wantsHtml) {
      return c.html(
        renderHtmlError("Internal server error", c.req.header("referer") ?? undefined),
        500,
      );
    }
    return c.json({ error: { code: "internal", message: "Internal server error" } }, 500);
  });
}
