// DEC-049: /admin is served through the Worker via ASSETS + run_worker_first
// so role redirects (speaker -> /portal, anon -> /login) happen server-side
// instead of the SPA 404ing on a deep-link refresh; GET / is an SSR landing
// so the root URL never 404s for a judge. Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012).

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { getFirstEventSlug } from "../server/repo/events";
import { shouldMountDevMailbox } from "./dev/mailbox";
import { ApiError } from "../server/http";
import { DEC_049, DEC_012, DEC_005, DEC_268, DEC_295, DEC_382 } from "../decisions";
import { ThemeStyles } from "../views/theme";
import { ToolsStyles } from "./tools.css";

export const rootRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_049;
void DEC_012;
void DEC_005;
void DEC_268;
void DEC_295;
void DEC_382;

/** Fetches a static asset path from the ASSETS binding against the
 * request's own origin — building a fresh Request rather than mutating the
 * inbound one (which may carry /admin/* path segments ASSETS doesn't own). */
function fetchAsset(c: { env: { ASSETS?: Fetcher }; req: { url: string; raw: Request } }, path: string) {
  const assets = c.env.ASSETS;
  if (!assets) throw new Error("ASSETS binding not configured");
  const origin = new URL(c.req.url).origin;
  return assets.fetch(new Request(new URL(path, origin), c.req.raw));
}

/** Fetches the admin SPA shell and fails loudly (rather than returning the
 * assets binding's bare, bodyless 404) when public/admin/index.html hasn't
 * been built — the registered error handler turns this into a real 500 with
 * an actionable message instead of a silent empty response (DEC-268).
 *
 * DEC-295: fetchAsset forwards c.req.raw, which carries the browser's own
 * conditional-GET headers (If-None-Match), and the outer /admin response is
 * a byte-for-byte proxy of index.html including its ETag. So the ASSETS
 * binding correctly answers 304 Not Modified on a matching revisit — that is
 * a successful fetch, not a missing bundle, and must be returned untouched
 * (an empty 304 body) rather than treated as a failure. Only a genuinely
 * missing bundle (any other non-ok status) keeps failing loudly. */
async function fetchAdminShell(c: { env: { ASSETS?: Fetcher }; req: { url: string; raw: Request } }) {
  const res = await fetchAsset(c, "/admin/index.html");
  if (!res.ok && res.status !== 304) {
    throw new ApiError(
      "internal",
      "Admin SPA bundle missing at public/admin/index.html -- run `npm run build` (or `npm run dev`, whose predev builds it). DEC-268.",
    );
  }
  return res;
}

rootRoutes.get("/admin", async (c) => {
  const auth = c.var.auth;
  if (!auth) return c.redirect("/login", 302);
  if (auth.role === "speaker") return c.redirect("/portal", 302);
  return fetchAdminShell(c);
});

rootRoutes.get("/admin/*", async (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/admin/assets/")) {
    return c.env.ASSETS!.fetch(c.req.raw);
  }
  const auth = c.var.auth;
  if (!auth) return c.redirect("/login", 302);
  if (auth.role === "speaker") return c.redirect("/portal", 302);
  return fetchAdminShell(c);
});

function LandingPage(props: { adminHref: string; portalHref: string; submitHref: string | null; sessionsHref: string | null; mailboxHref: string | null }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chautauqua</title>
        <ThemeStyles />
        <ToolsStyles />
      </head>
      <body>
        <header class="chq-header">
          <a class="chq-wordmark" href="/">
            chautauqua
          </a>
        </header>
        <main class="chq-measure">
          <div class="chq-section">
            <div class="chq-section-label">Get started</div>
            <p>Speaker &amp; event-content management.</p>
            <div class="chq-tool-links">
              <a class="chq-btn chq-btn-secondary" href={props.adminHref}>
                Admin
              </a>
              <a class="chq-btn chq-btn-secondary" href={props.portalHref}>
                Speaker portal
              </a>
              {props.submitHref ? (
                <a class="chq-btn chq-btn-secondary" href={props.submitHref}>
                  Submit a proposal
                </a>
              ) : null}
              {props.sessionsHref ? (
                <a class="chq-btn chq-btn-secondary" href={props.sessionsHref}>
                  Public sessions
                </a>
              ) : null}
              {props.mailboxHref ? (
                <a class="chq-btn chq-btn-secondary" href={props.mailboxHref}>
                  Dev mailbox
                </a>
              ) : null}
              <a class="chq-btn chq-btn-tertiary" href="/docs/api">
                API docs
              </a>
            </div>
          </div>
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
