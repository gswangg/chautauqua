// DEC-635: one 404 handler for the whole app, registered via app.notFound()
// (Hono's catch-all for "no route matched" — distinct from the ApiError-
// driven onError handler in http.ts, which fires when a matched route
// itself throws not_found). Classification is by pathname prefix only: an
// '/api/v1' path gets the same { error: { code, message } } envelope shape
// http.ts produces for ApiError, so an API client parses one shape
// everywhere; every other path gets an HTML page, never a JSON blob a
// person would have to read.
//
// DEC-693/DEC-740: the HTML page takes the design pack's "Not found ·
// /admin/*" panel copy verbatim -- an eyebrow naming the deployment's
// single event (falling back to "Not found" when there isn't exactly one),
// "That page isn't here", the "link may be old..." body line, then two
// tertiary links. Reuses the SAME getHubOrg/listHubEvents primitives the
// home hub and the login door (src/routes/auth.tsx) bind, rather than a
// third reader. Styled with AUTH_CSS's paper-card-narrow shape (the same
// module src/routes/auth.tsx and account.tsx already share) instead of a
// second ad hoc card layout.

import type { Hono } from "hono";
import type { AppEnv } from "./env";
import type { Db } from "./context";
import { ThemeStyles } from "../views/theme";
import { AUTH_CSS } from "../routes/auth.css";
import { getHubOrg, listHubEvents } from "./repo/public/home";
import { isApiPath } from "./http";

/** Resolves the shared 404 card's eyebrow: the deployment's single event
 * name, falling back to "Not found" when there isn't exactly one. Shared by
 * every 404 surface (the app.notFound() catch-all below and the public
 * routes' publicNotFound in src/routes/public/not-found.tsx) so there is
 * exactly one reader of getHubOrg/listHubEvents for this purpose. */
export async function resolveNotFoundEyebrow(db: Db): Promise<string> {
  const org = await getHubOrg(db);
  if (!org) return "Not found";
  const page = await listHubEvents(db, org.id, Date.now());
  if (page.items.length !== 1) return "Not found";
  const event = page.items[0];
  return event ? event.name : "Not found";
}

/** Default anonymous-visitor footer links: home + log in. */
export const ANONYMOUS_NOT_FOUND_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/", label: "Go to the homepage" },
  { href: "/login", label: "Log in" },
];

/** Signed-in organiser footer links (frame 11-02): the two admin landing
 * points, never the homepage/log-in pair an already-authenticated request
 * has no use for. */
export const ORGANIZER_NOT_FOUND_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/overview", label: "Overview" },
  { href: "/submissions", label: "Submissions" },
];

/** The ONE 404 card markup for the whole app (DEC-635 amendment): every
 * surface -- the app.notFound() catch-all and the public routes' 404 --
 * renders this exact document, varying only the eyebrow (resolved via
 * resolveNotFoundEyebrow), the body copy, and the footer links (required so
 * every call site states its own -- a signed-in organiser gets Overview/
 * Submissions, per frame 11-02, never the anonymous homepage/log-in pair).
 * The card element IS the <main> -- never wrap it in an extra <div>. */
export function NotFoundDocument(props: {
  eyebrow: string;
  body: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Not found - Chautauqua</title>
        <ThemeStyles />
        <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
      </head>
      <body>
        <main class="chq-auth-card chq-auth-card-narrow chq-auth-card-notice">
          <div class="chq-auth-titlerow">
            <span class="chq-auth-label">{props.eyebrow}</span>
            <h1 class="chq-auth-title">That page isn't here</h1>
          </div>
          <p class="chq-auth-body">{props.body}</p>
          <div class="chq-auth-footer-links">
            {props.links.map((link) => (
              <a href={link.href}>{link.label} &rsaquo;</a>
            ))}
          </div>
        </main>
      </body>
    </html>
  );
}

/** Registers the shared app.notFound() handler; call once on the top-level
 * app (src/server/app.ts's createBaseApp). Fires only when no route
 * matched the request at all -- a matched route that itself threw
 * ApiError('not_found', ...) is handled separately by http.ts's onError. */
export function registerNotFoundHandler(app: Hono<AppEnv>): void {
  app.notFound(async (c) => {
    const path = new URL(c.req.url).pathname;
    if (isApiPath(path)) {
      return c.json(
        { error: { code: "not_found", message: `No route matches ${c.req.method} ${path}` } },
        404,
      );
    }
    const eyebrow = await resolveNotFoundEyebrow(c.var.db);
    const links =
      c.var.auth?.role === "organizer" ? ORGANIZER_NOT_FOUND_LINKS : ANONYMOUS_NOT_FOUND_LINKS;
    return c.html(
      <NotFoundDocument
        eyebrow={eyebrow}
        body="The link may be old, or the event may have been switched since it was saved."
        links={links}
      />,
      404,
    );
  });
}
