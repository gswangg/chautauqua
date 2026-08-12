// Shared portal chrome, per DEC-028: two wave-4 tasks (w4-a profile, w4-b
// tasks) deepen /portal in parallel, each as its own Hono sub-app (DEC-012:
// only src/index.ts mounts). This file is create-if-missing — both tasks
// create it with this exact contract; a merge dedupes identical content.
// src/routes/portal/index.tsx is now rewired onto it.

import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../../server/env";
import { ThemeStyles } from "../../views/theme";
import { PORTAL_CSS } from "./portal.css";
import { DEC_374 } from "../../decisions";

void DEC_374;

// DEC-374: strict hex guard on the per-event accent before it ever reaches a
// rendered attribute — falls back to the brand olive on anything that isn't
// exactly #RRGGBB.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function safeAccent(accentColor: string | null): string {
  return accentColor && HEX_COLOR_RE.test(accentColor) ? accentColor : "#4E5C31";
}

export interface PortalBrandingChrome {
  eventName: string;
  welcomeMessage: string | null;
  accentColor: string | null;
  logoUrl: string | null;
}

/** Gate: no session -> /login; a session that isn't a speaker (organizer,
 * reviewer) -> /admin. Exact copy of src/routes/portal/index.tsx's redirect
 * gate — deliberately distinct from the JSON-error requireSpeaker
 * middleware (DEC-012), which is built for /api/v1: an SSR surface redirects
 * instead of returning a 401/403 body. */
export const speakerGate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.var.auth;
  if (!auth) return c.redirect("/login", 302);
  if (auth.role !== "speaker") return c.redirect("/admin", 302);
  await next();
};

/** Shared page chrome for every /portal/* SSR page — the existing Layout
 * markup from index.tsx, taking { branding, children }. */
export function PortalLayout(props: {
  branding: PortalBrandingChrome;
  csrfToken: string;
  children: unknown;
}) {
  const accent = safeAccent(props.branding.accentColor);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.branding.eventName} - Speaker Portal</title>
        <ThemeStyles />
        <style dangerouslySetInnerHTML={{ __html: PORTAL_CSS }} />
      </head>
      <body style={`--chq-brandable-accent: ${accent}`}>
        <header class="chq-header">
          <span class="chq-wordmark">
            {props.branding.logoUrl ? <img src={props.branding.logoUrl} alt="" height={40} /> : null}
            {props.branding.eventName}
          </span>
          {props.branding.welcomeMessage ? <p class="chq-meta">{props.branding.welcomeMessage}</p> : null}
          {/* DEC-154: sign-out control on every /portal/* page, via the
              shared layout so it's not duplicated per-page. */}
          {/* DEC-181: /logout now requires CSRF proof; the portal form uses
              the double-submit cookie pair. */}
          <form method="post" action="/logout" class="chq-portal-signout">
            <input type="hidden" name="chq_csrf" value={props.csrfToken} />
            <button type="submit" class="chq-btn chq-btn-secondary">Sign out</button>
          </form>
        </header>
        <main>{props.children as any}</main>
      </body>
    </html>
  );
}
