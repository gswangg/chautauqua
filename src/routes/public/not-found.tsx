// DEC-635 (amendment): the public surface's 404 is the SAME card component
// as the admin SPA catch-all's -- not a re-skinned second copy. Both call
// sites now render src/server/not-found.tsx's NotFoundDocument directly,
// varying only the body copy (this module's caller-supplied message) and
// the eyebrow (resolved fresh per-request via resolveNotFoundEyebrow, the
// same reader the app.notFound() handler uses -- no second getHubOrg/
// listHubEvents reader).
//
// Split out of ./index.tsx (DEC-785): the saved-embed sub-app (./saved-
// embed.tsx) also needs this exact 404, and importing it straight from
// ./index.tsx would be a circular import (index.tsx mounts saved-embed's
// sub-app). This module has no dependents that create a cycle.
import type { Context } from "hono";
import type { AppEnv } from "../../server/env";
import {
  ANONYMOUS_NOT_FOUND_LINKS,
  NotFoundDocument,
  resolveNotFoundEyebrow,
} from "../../server/not-found";

// DEC-297: public surfaces must never emit a cacheable non-200. A 404 (or
// any other non-200) response must always carry Cache-Control: no-store,
// even though setCacheHeaders(c) has already set the 60s client cache
// header earlier in the same handler — c.header() overwrites rather than
// appends, so calling this last wins. Without this, a stale "not found"
// page (e.g. before an organizer approves a session) could be cached by a
// browser/proxy for up to max-age=60 after the underlying data changes.
export async function publicNotFound(c: Context<AppEnv>, message: string): Promise<Response> {
  c.header("Cache-Control", "no-store");
  const eyebrow = await resolveNotFoundEyebrow(c.var.db);
  return await c.html(
    <NotFoundDocument eyebrow={eyebrow} body={message} links={ANONYMOUS_NOT_FOUND_LINKS} />,
    404,
  );
}
