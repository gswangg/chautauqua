// DEC-020 amendment (wave 30): a request-body ceiling enforced BEFORE
// anything reads the body. Today every upload path (src/routes/files.ts,
// src/routes/public/submit.tsx) calls c.req.parseBody() and buffers the
// whole multipart body before any per-kind size check runs; csrfForm
// (src/server/middleware.ts) parses the body even earlier, in MIDDLEWARE,
// ahead of every handler. A per-route check after parseBody cannot help --
// the buffering has already happened. This module is the one place that
// refuses an oversized request from its Content-Length header, ahead of any
// body read.
//
// MAX_REQUEST_BODY_BYTES is set comfortably above VIDEO_MAX_BYTES (95 MB,
// src/domain/files.ts) plus multipart framing overhead, and comfortably
// below ISOLATE_MEMORY_BUDGET_BYTES (128 MB, src/routes/files.ts) so a
// request that clears this ceiling can still be safely buffered within the
// isolate's memory budget.
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./env";
import { ApiError } from "./http";
import { DEC_020 } from "../decisions";

void DEC_020;

export const MAX_REQUEST_BODY_BYTES = 100 * 1024 * 1024;

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD", "OPTIONS"]);

export type BodyCheckResult = { ok: true } | { ok: false; message: string };

/**
 * Pure predicate: given a method, content-type, and content-length header
 * value, decide whether the request body should be refused before it is
 * ever read.
 *
 * - GET/HEAD/OPTIONS: always ok (no body expected).
 * - A parseable Content-Length over MAX_REQUEST_BODY_BYTES: refused, naming
 *   both the ceiling and the declared size.
 * - A non-numeric (unparseable) Content-Length: refused.
 * - An absent Content-Length: refused ONLY when the content-type declares a
 *   multipart/form-data body (chunked/streamed multipart uploads are exactly
 *   the case parseBody() will buffer whole with no size check otherwise);
 *   any other absent-Content-Length request (e.g. a small JSON POST relying
 *   on chunked transfer-encoding) is left to the handler.
 * - Everything else: ok.
 */
export function checkRequestBody(
  method: string,
  contentType: string | null,
  contentLength: string | null,
): BodyCheckResult {
  if (METHODS_WITHOUT_BODY.has(method.toUpperCase())) {
    return { ok: true };
  }

  if (contentLength === null) {
    if (contentType !== null && contentType.toLowerCase().startsWith("multipart/form-data")) {
      return {
        ok: false,
        message: "Request is missing a Content-Length header required for multipart uploads",
      };
    }
    return { ok: true };
  }

  if (!/^\d+$/.test(contentLength)) {
    return { ok: false, message: "Content-Length header is not a valid number" };
  }

  const declaredBytes = Number(contentLength);
  if (declaredBytes > MAX_REQUEST_BODY_BYTES) {
    return {
      ok: false,
      message: `Request body exceeds the ${MAX_REQUEST_BODY_BYTES} byte limit (declared ${declaredBytes} bytes)`,
    };
  }

  return { ok: true };
}

/**
 * Hono middleware: refuses an oversized/malformed-length request with a 413
 * `payload_too_large` before any downstream middleware or handler reads the
 * body (must be registered first in createBaseApp, ahead of csrfForm and
 * every route).
 */
export const requestBodyLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const result = checkRequestBody(
    c.req.method,
    c.req.header("content-type") ?? null,
    c.req.header("content-length") ?? null,
  );
  if (!result.ok) {
    throw new ApiError("payload_too_large", result.message);
  }
  await next();
};
