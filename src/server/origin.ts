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
import { DEC_252, DEC_296 } from "../decisions";
import { isDevMode } from "./env";

void DEC_252;
void DEC_296;

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

/** Parses `value` as an absolute http/https URL and returns its origin with no
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
    throw new Error(`resolveBaseUrl: PUBLIC_BASE_URL must be http/https, got ${JSON.stringify(value)}`);
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
 * user-facing links, per DEC-252/DEC-296's precedence:
 *   1. `env.PUBLIC_BASE_URL` when non-empty — must be an absolute http/https
 *      URL; throws on anything malformed.
 *   2. EXCEPTION (DEC-296, dev-only): when `env.DEV_MODE === "1"` AND the
 *      configured PUBLIC_BASE_URL itself parses to a LOOPBACK origin (the
 *      shipped `.dev.vars.example` default), the first LOOPBACK origin
 *      among [request URL origin, `Origin` header, `Referer` origin] wins
 *      instead — this lets a fixed `wrangler.jsonc` `routes`/`custom_domain`
 *      entry (which makes `new URL(c.req.url).origin` resolve to the
 *      production host under local `wrangler dev`) not poison emailed
 *      links when the operator is actually running on a different local
 *      port. A non-loopback PUBLIC_BASE_URL always wins outright — it can
 *      never be overridden by request/header sniffing.
 *   3. When `env.DEV_MODE === "1"` and no PUBLIC_BASE_URL is configured,
 *      the first LOOPBACK origin among [request URL origin, `Origin`
 *      header, `Referer` origin]. Header sniffing is gated to dev +
 *      loopback only so it can never be used to poison a production link
 *      with an attacker-supplied header.
 *   4. DEV-ONLY (`env.DEV_MODE === "1"`): the request URL origin, used as the
 *      dev fallback when none of the loopback candidates apply, e.g.
 *      `wrangler dev`'s route-shadowed request whose own URL origin isn't
 *      loopback but no loopback header exists either — see the `routes`
 *      note below.
 *
 * Outside dev mode (`env.DEV_MODE !== "1"`), behavior mirrors
 * resolveBaseUrlForCron: if `PUBLIC_BASE_URL` isn't set (or doesn't win per
 * the precedence above — it always wins outright when set), this throws
 * (fail loudly, DEC-252 amendment wave 18) rather than falling back to the
 * request's Host header, which a deployment might not control and which
 * would poison mailed links (e.g. `/claim/<token>` on the unauthenticated
 * public CFP submit path) with an attacker- or proxy-supplied origin.
 * `wrangler.jsonc`'s `vars` block must set `PUBLIC_BASE_URL` for every real
 * (non-dev) deployment.
 */
export function resolveBaseUrl(c: OriginRequestLike): string {
  const publicBaseUrl = c.env.PUBLIC_BASE_URL;
  const devMode = isDevMode(c.env);

  if (publicBaseUrl) {
    const parsedPublicBaseUrl = parseAbsoluteHttpOrigin(publicBaseUrl);
    if (!devMode || !isLoopbackOrigin(parsedPublicBaseUrl)) {
      return parsedPublicBaseUrl;
    }
    // DEC-296: dev-only exception — a loopback PUBLIC_BASE_URL is a
    // default/fallback, not an override; prefer a loopback candidate from
    // the actual request when one exists.
    const loopbackCandidate = firstLoopbackCandidate(c);
    return loopbackCandidate ?? parsedPublicBaseUrl;
  }

  if (!devMode) {
    // DEC-252 amendment (wave 18): outside dev, a mailed link needs a
    // configured base — refuse to guess from the request Host. Set
    // PUBLIC_BASE_URL in wrangler.jsonc's `vars` block for this deployment.
    throw new Error("resolveBaseUrl: PUBLIC_BASE_URL is not set — set it in wrangler.jsonc's `vars` block for this deployment");
  }

  const requestOrigin = new URL(c.req.url).origin;

  const loopbackCandidate = firstLoopbackCandidate(c);
  if (loopbackCandidate) return loopbackCandidate;

  return requestOrigin;
}

/**
 * Resolves the absolute base URL for links minted from a cron/scheduled
 * context (DEC-559), which has no incoming request to sniff a header or URL
 * origin from — unlike resolveBaseUrl, there is no dev-loopback fallback:
 * `env.PUBLIC_BASE_URL` must be set to a valid absolute http/https URL or this
 * throws (fail loudly) rather than inventing one.
 */
export function resolveBaseUrlForCron(env: { PUBLIC_BASE_URL?: string }): string {
  const publicBaseUrl = env.PUBLIC_BASE_URL;
  if (!publicBaseUrl) {
    throw new Error("resolveBaseUrlForCron: PUBLIC_BASE_URL is not set — a scheduled job has no request to fall back to");
  }
  return parseAbsoluteHttpOrigin(publicBaseUrl);
}

/** Returns the first LOOPBACK origin among [request URL origin, `Origin`
 * header, `Referer` origin], or null if none of them are loopback. */
function firstLoopbackCandidate(c: OriginRequestLike): string | null {
  const requestOrigin = new URL(c.req.url).origin;
  if (isLoopbackOrigin(requestOrigin)) return requestOrigin;

  const originHeader = originFromHeaderValue(c.req.header("Origin"));
  if (originHeader && isLoopbackOrigin(originHeader)) return originHeader;

  const refererOrigin = originFromHeaderValue(c.req.header("Referer"));
  if (refererOrigin && isLoopbackOrigin(refererOrigin)) return refererOrigin;

  return null;
}
