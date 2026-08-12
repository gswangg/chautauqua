// DEC-635: one 404 handler for the whole app, registered via app.notFound()
// (Hono's catch-all for "no route matched" — distinct from the ApiError-
// driven onError handler in http.ts, which fires when a matched route
// itself throws not_found). Classification is by pathname prefix only: an
// '/api/v1' path gets the same { error: { code, message } } envelope shape
// http.ts produces for ApiError, so an API client parses one shape
// everywhere; every other path gets an HTML page, never a JSON blob a
// person would have to read.

import type { Hono } from "hono";
import type { AppEnv } from "./env";
import { ThemeStyles } from "../views/theme";
import { PUBLIC_CSS } from "../routes/public/public.css";

const API_PREFIX = "/api/v1";

function NotFoundPage() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>Page not found</title>
        <ThemeStyles />
        <style dangerouslySetInnerHTML={{ __html: PUBLIC_CSS }} />
      </head>
      <body>
        <main class="chq-measure">
          <h1>Page not found</h1>
          <p>There is no page at this address.</p>
          <p>
            <a href="/">Go to the homepage</a> or <a href="/login">log in</a>.
          </p>
        </main>
      </body>
    </html>
  );
}

/** Registers the shared app.notFound() handler; call once on the top-level
 * app (src/server/app.ts's createBaseApp). Fires only when no route
 * matched the request at all -- a matched route that itself throws
 * ApiError('not_found', ...) is handled separately by http.ts's onError. */
export function registerNotFoundHandler(app: Hono<AppEnv>): void {
  app.notFound((c) => {
    const path = new URL(c.req.url).pathname;
    if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
      return c.json(
        { error: { code: "not_found", message: `No route matches ${c.req.method} ${path}` } },
        404,
      );
    }
    return c.html(<NotFoundPage />, 404);
  });
}
