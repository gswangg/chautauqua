// API error envelope + Hono error registration, per DEC-013.
// Errors: non-2xx bodies are { error: { code, message, fields? } }.
// Unexpected exceptions become a 500 with code 'internal' — fail loudly, no
// swallowing; they are logged to the console, never hidden.

import type { Hono } from "hono";
import type { AppEnv } from "./env";

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

/** Registers the shared onError handler; call once on the top-level app. */
export function registerErrorHandler(app: Hono<AppEnv>): void {
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(errorEnvelope(err), err.status as 400 | 401 | 403 | 404 | 409);
    }
    // Fail loudly: unexpected errors are never swallowed, always logged.
    console.error("unhandled error", err);
    return c.json({ error: { code: "internal", message: "Internal server error" } }, 500);
  });
}
