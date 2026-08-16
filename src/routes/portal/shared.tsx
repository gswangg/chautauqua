// Shared portal chrome, per DEC-028: two wave-4 tasks (w4-a profile, w4-b
// tasks) deepen /portal in parallel, each as its own Hono sub-app (DEC-012:
// only src/index.ts mounts). This file is create-if-missing — both tasks
// create it with this exact contract; a merge dedupes identical content.
// src/routes/portal/index.tsx is now rewired onto it.

import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../../server/env";
import { ThemeStyles } from "../../views/theme";
import { PORTAL_CSS } from "./portal.css";
import { DEC_374, DEC_884, DEC_371, DEC_945 } from "../../decisions";
import { normalizeHexColor } from "../../domain/color";
import { matchesPortalRoute } from "../../lib/portal-routes";
import { CSRF_COOKIE_NAME } from "../../auth/cookies";
import {
  ANONYMOUS_NOT_FOUND_LINKS,
  NotFoundDocument,
  ORGANIZER_NOT_FOUND_LINKS,
  resolveNotFoundEyebrow,
} from "../../server/not-found";

void DEC_374;
void DEC_884;
void DEC_371;
void DEC_945;

// DEC-374: strict hex guard on the per-event accent before it ever reaches a
// rendered attribute — falls back to the brand olive on anything that isn't
// a valid hex colour, per the ONE grammar in src/domain/color.ts (DEC-371
// amendment, wave 43).
function safeAccent(accentColor: string | null): string {
  return normalizeHexColor(accentColor) ?? "#4E5C31";
}

export interface PortalBrandingChrome {
  eventName: string;
  welcomeMessage: string | null;
  accentColor: string | null;
  logoUrl: string | null;
}

/** Gate: no session -> /login; a session that isn't a speaker (organizer,
 * reviewer) -> /admin, but only once the path is known to be a real
 * /portal/* route. DEC-945 (wave-6 amendment): path existence is decided
 * BEFORE role redirection, exactly as the /admin/* handler already does
 * (src/routes/root.tsx) — otherwise a signed-in organizer at /portal/nope
 * is silently redirected into /admin/overview at HTTP 200, inventing a page
 * that never existed, while a speaker at the same URL correctly falls
 * through to the shared app.notFound() 404 card. The speaker branch below
 * is byte-identical to before: an unmatched path for a speaker is decided
 * entirely by the normal Hono route table + registerNotFoundHandler. */
export const speakerGate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.var.auth;
  if (!auth) return c.redirect("/login", 302);
  if (auth.role !== "speaker") {
    const path = new URL(c.req.url).pathname;
    const subPath = path.slice("/portal".length) || "/";
    if (!matchesPortalRoute(subPath)) {
      const eyebrow = await resolveNotFoundEyebrow(c.var.db);
      const links = auth.role === "organizer" ? ORGANIZER_NOT_FOUND_LINKS : ANONYMOUS_NOT_FOUND_LINKS;
      return c.html(
        <NotFoundDocument
          eyebrow={eyebrow}
          body="The link may be old, or the event may have been switched since it was saved."
          links={links}
        />,
        404,
      );
    }
    return c.redirect("/admin", 302);
  }
  await next();
};

// DEC-914: one table naming every portal back-link destination — a link's
// label must always agree with the route it lands on. A page linking
// somewhere new must add an entry here (or the render throws) rather than
// falling back to a generic "Back" that silently mismatches its href.
// Static destinations use exact-string matches; the per-submission detail
// page is matched by shape since its id varies per submission.
export const PORTAL_BACK_LINKS: ReadonlyArray<{
  readonly test: (to: string) => boolean;
  readonly label: string;
}> = [
  { test: (to) => to === "/portal", label: "Your portal" },
  { test: (to) => to === "/portal/submissions", label: "Your submissions" },
  { test: (to) => to === "/portal/tasks", label: "Your tasks" },
  { test: (to) => /^\/portal\/submissions\/[^/]+$/.test(to), label: "Your submission" },
];

function portalBackLinkLabel(to: string): string {
  const entry = PORTAL_BACK_LINKS.find((e) => e.test(to));
  if (!entry) {
    throw new Error(`PortalBackLink: no label registered in PORTAL_BACK_LINKS for destination "${to}"`);
  }
  return entry.label;
}

// DEC-945 (wave-65 amendment): a speaker who follows a stale in-portal link
// (a submission id that no longer resolves, a resources section the
// producer turned off, ...) gets the SAME branded 404 card the speakerGate
// above and /portal/preview already render, never a bare text/plain body.
// The link set takes its label from PORTAL_BACK_LINKS (DEC-914) so a
// signed-in speaker's 404 link can never disagree with the route it lands
// on — it is a single "/portal" href, resolved through the same vocabulary
// rather than a second hand-written label.
export const SPEAKER_NOT_FOUND_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/portal", label: portalBackLinkLabel("/portal") },
];

/** Renders the shared 404 card for an in-route speaker-portal refusal
 * (existence-hiding, not just an unmatched route — see speakerGate above).
 * Status stays 404 always; only the body copy is ever caller-supplied. */
export async function portalNotFound(
  c: Context<AppEnv>,
  body = "The link may be old, or the event may have been switched since it was saved.",
) {
  const eyebrow = await resolveNotFoundEyebrow(c.var.db);
  return c.html(<NotFoundDocument eyebrow={eyebrow} body={body} links={SPEAKER_NOT_FOUND_LINKS} />, 404);
}

/** One back-link renderer for every /portal/* page (DEC-914) — the label is
 * always resolved from PORTAL_BACK_LINKS above, so a link's text can never
 * drift from the route its href actually lands on. An unrecognised
 * destination throws rather than falling back to a generic "Back". */
export function PortalBackLink(props: { to: string }) {
  return (
    <a href={props.to} class="chq-portal-back">
      &lsaquo; {portalBackLinkLabel(props.to)}
    </a>
  );
}

/** Shared page chrome for every /portal/* SSR page — the existing Layout
 * markup from index.tsx, taking { branding, children }. */
export function PortalLayout(props: {
  branding: PortalBrandingChrome;
  csrfToken: string;
  children: unknown;
  // w15-b: the signed-in speaker's display name, right-aligned in the
  // header (docs/design mock's "Speaker portal" frame). Optional so pages
  // that haven't been rewired onto PortalData.contactName yet still render.
  speakerName?: string;
  // w15-b: extra footer content (name · company, Profile link) rendered
  // ahead of the sign-out control — placement only, never touching the
  // sign-out form/button below (a sibling task owns that cascade).
  footerExtra?: unknown;
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
        <div class="chq-portal-shell">
          <header class="chq-header">
            <span class="chq-eventmark">
              {props.branding.logoUrl ? <img src={props.branding.logoUrl} alt="" height={40} /> : null}
              {props.branding.eventName}
            </span>
            {props.speakerName ? <span class="chq-portal-header-name">{props.speakerName}</span> : null}
          </header>
          <main class="chq-measure">{props.children as any}</main>
          {/* DEC-154: sign-out control on every /portal/* page, via the
              shared layout so it's not duplicated per-page. w2-g demotes it
              to a quiet tertiary footer link — placement only, the POST
              semantics and CSRF proof (DEC-181) are unchanged. */}
          <footer class="chq-portal-footer">
            {props.footerExtra as any}
            <form method="post" action="/logout" class="chq-portal-signout">
              <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
              <button type="submit" class="chq-btn chq-btn-tertiary chq-portal-signout-btn">Sign out</button>
            </form>
          </footer>
        </div>
      </body>
    </html>
  );
}
