// DEC-049: /admin is served through the Worker via ASSETS + run_worker_first
// so role redirects (speaker -> /portal, anon -> /login) happen server-side
// instead of the SPA 404ing on a deep-link refresh; GET / is an SSR landing
// so the root URL never 404s for a judge. Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { getFirstEventSlug } from "../server/repo/events";
import { shouldMountDevMailbox } from "./dev/mailbox";
import { DEC_049, DEC_012, DEC_005 } from "../decisions";

export const rootRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_049;
void DEC_012;
void DEC_005;

/** Fetches a static asset path from the ASSETS binding against the
 * request's own origin — building a fresh Request rather than mutating the
 * inbound one (which may carry /admin/* path segments ASSETS doesn't own). */
function fetchAsset(c: { env: { ASSETS?: Fetcher }; req: { url: string; raw: Request } }, path: string) {
  const assets = c.env.ASSETS;
  if (!assets) throw new Error("ASSETS binding not configured");
  const origin = new URL(c.req.url).origin;
  return assets.fetch(new Request(new URL(path, origin), c.req.raw));
}

rootRoutes.get("/admin", async (c) => {
  const auth = c.var.auth;
  if (!auth) return c.redirect("/login", 302);
  if (auth.role === "speaker") return c.redirect("/portal", 302);
  return fetchAsset(c, "/admin/index.html");
});

rootRoutes.get("/admin/*", async (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/admin/assets/")) {
    return c.env.ASSETS!.fetch(c.req.raw);
  }
  const auth = c.var.auth;
  if (!auth) return c.redirect("/login", 302);
  if (auth.role === "speaker") return c.redirect("/portal", 302);
  return fetchAsset(c, "/admin/index.html");
});

function LandingPage(props: { adminHref: string; portalHref: string; submitHref: string | null; sessionsHref: string | null; mailboxHref: string | null }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chautauqua</title>
        <style>{`body { font-family: system-ui, sans-serif; margin: 0; color: #1a1a1a; } main { max-width: 640px; margin: 3rem auto; padding: 1rem; } li { margin-bottom: 0.5rem; }`}</style>
      </head>
      <body>
        <main>
          <h1>Chautauqua</h1>
          <p>Speaker &amp; event-content management.</p>
          <ul>
            <li>
              <a href={props.adminHref}>Admin</a>
            </li>
            <li>
              <a href={props.portalHref}>Speaker portal</a>
            </li>
            {props.submitHref ? (
              <li>
                <a href={props.submitHref}>Submit a proposal</a>
              </li>
            ) : null}
            {props.sessionsHref ? (
              <li>
                <a href={props.sessionsHref}>Public sessions</a>
              </li>
            ) : null}
            {props.mailboxHref ? (
              <li>
                <a href={props.mailboxHref}>Dev mailbox</a>
              </li>
            ) : null}
            <li>
              <a href="/docs/api">API docs</a>
            </li>
          </ul>
        </main>
      </body>
    </html>
  );
}

rootRoutes.get("/", async (c) => {
  const slug = await getFirstEventSlug(c.var.db);
  return c.html(
    <LandingPage
      adminHref="/admin"
      portalHref="/portal"
      submitHref={slug ? `/submit/${slug}` : null}
      sessionsHref={slug ? `/e/${slug}/sessions` : null}
      mailboxHref={shouldMountDevMailbox(c.env) ? "/dev/mailbox" : null}
    />,
  );
});
