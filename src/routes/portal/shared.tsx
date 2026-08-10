// Shared portal chrome, per DEC-028: two wave-4 tasks (w4-a profile, w4-b
// tasks) deepen /portal in parallel, each as its own Hono sub-app (DEC-012:
// only src/index.ts mounts). This file is create-if-missing — both tasks
// create it with this exact contract; a merge dedupes identical content.
// src/routes/portal/index.tsx is now rewired onto it.

import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../../server/env";

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
export function PortalLayout(props: { branding: PortalBrandingChrome; children: unknown }) {
  const accent = props.branding.accentColor ?? "#2b2b2b";
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>{props.branding.eventName} - Speaker Portal</title>
        <style>{`:root { --accent: ${accent}; } h1 { color: var(--accent); }`}</style>
      </head>
      <body>
        <header>
          {props.branding.logoUrl ? <img src={props.branding.logoUrl} alt="" height={40} /> : null}
          <h1>{props.branding.eventName}</h1>
          {props.branding.welcomeMessage ? <p>{props.branding.welcomeMessage}</p> : null}
        </header>
        <main>{props.children as any}</main>
      </body>
    </html>
  );
}
