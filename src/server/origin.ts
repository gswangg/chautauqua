// DEC-252: the ONLY source of absolute link bases for user-facing links
// (emailed claim/portal links etc). Under local `wrangler dev`,
// wrangler.jsonc's `routes`/`custom_domain: chautauqua.cc` entry (human
// stage-2 wiring, untouchable) makes `new URL(c.req.url).origin` resolve to
// the LIVE production host rather than the local dev server, so a naive
// `origin` computation poisons emailed links in dev. Fix lives entirely in
// app code: resolveBaseUrl() implements a strict precedence so links are
// correct in dev (loopback sniffing, dev-only) and safe in production (an
// attacker-supplied Origin/Referer header must never end up in a mailed
// claim link — the loopback branch is gated on DEV_MODE === "1").
import { DEC_252 } from "../decisions";

void DEC_252;

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isLoopbackOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return LOOPBACK_HOSTNAMES.has(url.hostname);
}

/** Parses `value` as an absolute http(s) URL and returns its origin with no
 * trailing slash. Throws (fail loudly) on anything malformed — DEC-252
 * requires PUBLIC_BASE_URL to be either unset or a valid absolute URL. */
function parseAbsoluteHttpOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`resolveBaseUrl: PUBLIC_BASE_URL is not a valid absolute URL: ${JSON.stringify(value)}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`resolveBaseUrl: PUBLIC_BASE_URL must be http(s), got ${JSON.stringify(value)}`);
  }
  return url.origin;
}

/** Extracts the origin from a header value that may be a full URL (Referer)
 * or already just an origin (Origin), returning null if it can't be parsed
 * as an absolute URL. */
function originFromHeaderValue(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export type OriginRequestLike = {
  req: {
    url: string;
    header(name: string): string | undefined;
  };
  env: {
    PUBLIC_BASE_URL?: string;
    DEV_MODE?: string;
  };
};

/**
 * Resolves the absolute base URL (origin, no trailing slash) to use for
 * user-facing links, per DEC-252's precedence:
 *   1. `env.PUBLIC_BASE_URL` when non-empty — must be an absolute http(s)
 *      URL; throws on anything malformed.
 *   2. When `env.DEV_MODE === "1"`, the first LOOPBACK origin among
 *      [request URL origin, `Origin` header, `Referer` origin]. Header
 *      sniffing is gated to dev + loopback only so it can never be used to
 *      poison a production link with an attacker-supplied header.
 *   3. The request URL origin (production default; also the dev fallback
 *      when none of the loopback candidates apply, e.g. `wrangler dev`'s
 *      route-shadowed request whose own URL origin isn't loopback but no
 *      loopback header exists either — see the `routes` note below).
 */
export function resolveBaseUrl(c: OriginRequestLike): string {
  const publicBaseUrl = c.env.PUBLIC_BASE_URL;
  if (publicBaseUrl) {
    return parseAbsoluteHttpOrigin(publicBaseUrl);
  }

  const requestOrigin = new URL(c.req.url).origin;

  if (c.env.DEV_MODE === "1") {
    if (isLoopbackOrigin(requestOrigin)) return requestOrigin;

    const originHeader = originFromHeaderValue(c.req.header("Origin"));
    if (originHeader && isLoopbackOrigin(originHeader)) return originHeader;

    const refererOrigin = originFromHeaderValue(c.req.header("Referer"));
    if (refererOrigin && isLoopbackOrigin(refererOrigin)) return refererOrigin;
  }

  return requestOrigin;
}
