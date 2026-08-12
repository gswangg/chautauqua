// DEC-636: framing is a closed two-list. /embed/* is the ONLY family
// designed to be iframed (Settings' embed-generator snippet, plus any
// third-party embedder); every other surface denies framing outright.
// Deny-by-default beats an allowlist maintained per-surface: a new page
// added anywhere else in the app is framing-denied for free, with no
// per-route opt-out to forget.

import type { Hono, Context, Next } from "hono";
import type { AppEnv } from "./env";
import { DEC_636 } from "../decisions";
import { setResponseHeaders } from "./response-headers";

void DEC_636;

/** The one family designed to be iframed. Anything not under one of these
 * prefixes gets X-Frame-Options: DENY + a frame-ancestors 'none' CSP. */
export const FRAMABLE_PREFIXES = ["/embed"] as const;

function isFramable(pathname: string): boolean {
  return FRAMABLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Registered once in createBaseApp, mounted on '*' ahead of every route
 * sub-app. Runs `next()` first (so it decorates whatever response the
 * route produced) then, unless the request path is framable, sets both
 * frame-denying headers. A framable request is left untouched — no header
 * is set in either direction, matching the walkthrough's assertion that
 * /embed/* responses carry neither header. */
export function registerFramingHeaders(app: Hono<AppEnv>): void {
  app.use("*", async (c: Context<AppEnv>, next: Next) => {
    await next();
    const pathname = new URL(c.req.url).pathname;
    if (isFramable(pathname)) return;
    setResponseHeaders(c, [
      ["X-Frame-Options", "DENY"],
      ["Content-Security-Policy", "frame-ancestors 'none'"],
    ]);
  });
}
