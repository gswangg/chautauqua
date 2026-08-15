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
//
// DEC-099 wave-35 amendment: setCacheHeaders(c) also sets Vary: Cookie
// earlier in the same handler, and c.header() only overwrites the header it
// names -- Cache-Control: no-store above does NOT clear a Vary: Cookie set
// moments earlier, so without the line below this response would carry both
// "never cache this" and "cache-key on Cookie", violating the closed rule
// test/public-cacheability-enumeration.test.ts asserts (a response carrying
// Vary: Cookie must be cacheable). c.header(name, undefined) deletes the
// header (src/../node_modules/hono/dist/context.js) rather than setting it
// to an empty string.
export async function publicNotFound(c: Context<AppEnv>, message: string): Promise<Response> {
  c.header("Cache-Control", "no-store");
  c.header("Vary", undefined);
  const eyebrow = await resolveNotFoundEyebrow(c.var.db);
  return await c.html(
    <NotFoundDocument eyebrow={eyebrow} body={message} links={ANONYMOUS_NOT_FOUND_LINKS} />,
    404,
  );
}

// DEC-841 (wave 16 amendment): a thrown error on the public surfaces (an
// ApiError or an unexpected 5xx) used to fall through to http.ts's
// renderHtmlError -- a bare <p role=alert> + "Go back" document with none of
// the public chrome. That mismatched publicNotFound above, which renders the
// SAME NotFoundDocument card the app's other 404 does. This is the error
// twin: same card (same eyebrow/measure/event-resolution helpers, no forked
// second shell), role="alert" on the message, and a link back to the
// event's own surfaces (derived from the :eventSlug route param already on
// this request -- no extra event query) ahead of the anonymous home/login
// pair. Called from publicRoutes.onError in ./index.tsx for HTML
// navigations only; feed/file-extension paths (.ics/.xml) and API paths
// keep going through http.ts's errorResponse unchanged.
//
// DEC-635 (wave 17 amendment): unlike publicNotFound above, this document
// must render with ZERO database reads. It is reached from onError, which
// means the thrown error MAY BE a database failure itself; awaiting
// resolveNotFoundEyebrow(c.var.db) here re-issues the same two D1 reads
// (getHubOrg + listHubEvents) that may have just thrown, so a DB outage
// turned this card into a rejected promise and the visitor got the
// runtime's bare 500 instead. The rule: the error document must not depend
// on the subsystem that may have failed. Its eyebrow is therefore a fixed
// module-level constant, not a per-request DB read.
const ERROR_EYEBROW = "Error";

export async function publicErrorDocument(
  c: Context<AppEnv>,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500,
): Promise<Response> {
  c.header("Cache-Control", "no-store");
  // DEC-099 wave-35 amendment: see publicNotFound above -- clears a
  // Vary: Cookie set earlier in the same handler by setCacheHeaders(c) so a
  // forced-no-store response never also carries the cache-key hint.
  c.header("Vary", undefined);
  const eventSlug = c.req.param("eventSlug");
  const links = eventSlug
    ? [{ href: `/e/${eventSlug}/sessions`, label: "Back to the event" }, ...ANONYMOUS_NOT_FOUND_LINKS]
    : ANONYMOUS_NOT_FOUND_LINKS;
  return await c.html(
    <NotFoundDocument
      eyebrow={ERROR_EYEBROW}
      title="Error - Chautauqua"
      heading="Something went wrong"
      body={message}
      links={links}
      alert
    />,
    status,
  );
}
