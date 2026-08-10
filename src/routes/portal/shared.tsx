// Shared portal chrome (DEC-028): speakerGate + PortalLayout, created
// if-missing by either wave-4 portal task with exactly this contract
// (declared identical-content overlap — merge dedupes; a later cleanup
// rewires index.tsx onto it).
//
// speakerGate is an exact copy of index.tsx's redirect gate: no session ->
// /login, non-speaker session (organizer, reviewer) -> /admin. Deliberately
// distinct from the JSON-error requireSpeaker middleware (DEC-012), which is
// built for /api/v1 — an SSR surface redirects instead of returning a
// 401/403 body.

import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../../server/env";

export const speakerGate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.var.auth;
  if (!auth) return c.redirect("/login", 302);
  if (auth.role !== "speaker") return c.redirect("/admin", 302);
  await next();
};

export interface PortalBrandingChrome {
  eventName: string;
  welcomeMessage: string | null;
  accentColor: string | null;
  logoUrl: string | null;
}

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
