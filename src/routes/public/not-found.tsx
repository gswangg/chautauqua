// DEC-366/367/368/w15-g: the same "That page isn't here" shell as the admin
// SPA's NotFound page (app/src/pages/NotFound.tsx), re-skinned for the
// public surface -- no PublicEvent is available at most call sites (the
// event itself is frequently what's missing), so this owns a minimal
// event-agnostic shell (ThemeStyles only, no PublicShell/EmbedShell nav)
// rather than requiring an event to render at all. Links back to the hub
// (GET /, src/routes/root.tsx) rather than into an unresolved event.
//
// Split out of ./index.tsx (DEC-785): the saved-embed sub-app (./saved-
// embed.tsx) also needs this exact 404, and importing it straight from
// ./index.tsx would be a circular import (index.tsx mounts saved-embed's
// sub-app). This module has no dependents that create a cycle.
import type { Context } from "hono";
import type { AppEnv } from "../../server/env";
import { BaseStyles } from "./shell";
import { AUTH_CSS } from "../auth.css";

// DEC-945: shares the design card src/server/not-found.tsx draws (task-
// w26-a owns that module and the AUTH_CSS numbers it references -- this
// only references the classes, never re-declares their values).
function PublicNotFoundShell(props: { message: string }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Not found</title>
        <BaseStyles />
        <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
      </head>
      <body>
        <main>
          <div class="chq-auth-card chq-auth-card-narrow">
            <div>
              <span class="chq-auth-label">Not found</span>
              <h1 class="chq-auth-title">That page isn't here</h1>
            </div>
            <p class="chq-auth-body">{props.message}</p>
            <div class="chq-auth-footer-links">
              <a href="/">Back to Chautauqua &rsaquo;</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

// DEC-297: public surfaces must never emit a cacheable non-200. A 404 (or
// any other non-200) response must always carry Cache-Control: no-store,
// even though setCacheHeaders(c) has already set the 60s client cache
// header earlier in the same handler — c.header() overwrites rather than
// appends, so calling this last wins. Without this, a stale "not found"
// page (e.g. before an organizer approves a session) could be cached by a
// browser/proxy for up to max-age=60 after the underlying data changes.
export async function publicNotFound(c: Context<AppEnv>, message: string): Promise<Response> {
  c.header("Cache-Control", "no-store");
  return await c.html(<PublicNotFoundShell message={message} />, 404);
}
