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

async function resolveEyebrow(db: Db): Promise<string> {
  const org = await getHubOrg(db);
  if (!org) return "Not found";
  const page = await listHubEvents(db, org.id, Date.now());
  if (page.items.length !== 1) return "Not found";
  const event = page.items[0];
  return event ? event.name : "Not found";
}

function NotFoundPage(props: { eyebrow: string }) {
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
        <main class="chq-auth-card chq-auth-card-narrow">
          <div>
            <span class="chq-auth-label">{props.eyebrow}</span>
            <h1 class="chq-auth-title">That page isn't here</h1>
          </div>
          <p class="chq-auth-body">The link may be old, or the event may have been switched since it was saved.</p>
          <div class="chq-auth-footer-links">
            <a href="/">Go to the homepage &rsaquo;</a>
            <a href="/login">Log in &rsaquo;</a>
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
    const eyebrow = await resolveEyebrow(c.var.db);
    return c.html(<NotFoundPage eyebrow={eyebrow} />, 404);
  });
}
