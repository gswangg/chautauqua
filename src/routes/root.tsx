// DEC-049: /admin is served through the Worker via ASSETS + run_worker_first
// so role redirects (speaker -> /portal, anon -> /login) happen server-side
// instead of the SPA 404ing on a deep-link refresh; GET / is an SSR landing
// so the root URL never 404s for a judge. Route files export a named Hono
// sub-app; only src/index.ts mounts it (DEC-012).
//
// DEC-582: GET / is an anonymous surface. A signed-in organizer/reviewer is
// redirected to /admin, a signed-in speaker to /portal -- the same rule
// /admin already enforces in reverse. Anonymous visitors see the instance's
// EVENT HUB (DEC-581): the org's own name, its events grouped by what a
// stranger may do (submit / browse / look back), never the product's own
// marketing. Visibility and grouping are owned entirely by the pure
// src/lib/home-hub.ts -- this file only binds primitives (getHubOrg/
// listHubEvents) and renders.

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import { ApiError } from "../server/http";
import { DEC_049, DEC_012, DEC_005, DEC_268, DEC_295, DEC_581, DEC_582 } from "../decisions";
import { ThemeStyles } from "../views/theme";
import { PUBLIC_CSS } from "./public/public.css";
import { HOME_CSS } from "./public/home.css";
import { getHubOrg, listHubEvents } from "../server/repo/public/home";
import { groupHubEvents, hubState, type HubEvent, type HubSections, type HubState } from "../lib/home-hub";

export const rootRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_049;
void DEC_012;
void DEC_005;
void DEC_268;
void DEC_295;
void DEC_581;
void DEC_582;

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

const GITHUB_MARK = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="chq-home-github-mark">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.07-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

/** Day-label formatter (UTC calendar fields, DEC-522: startDate/endDate are
 * DAY LABELS, not instants — never rendered in any timezone but UTC). */
function dayLabel(ms: number, withYear: boolean): string {
  return new Date(ms).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function dateRange(start: number, end: number): string {
  return start === end ? dayLabel(start, true) : `${dayLabel(start, false)}–${dayLabel(end, true)}`;
}

/** CFP close date + "N days left", rendered in the event's own IANA
 * timezone (DEC-408: a real instant, never UTC-bare). */
function closesLine(closeMs: number, timeZone: string, nowMs: number): string {
  const label = new Date(closeMs).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
  const days = Math.max(0, Math.ceil((closeMs - nowMs) / 86_400_000));
  return `Closes ${label} · ${days} day${days === 1 ? "" : "s"} left`;
}

function sessionsLine(count: number): string {
  return `${count} session${count === 1 ? "" : "s"}`;
}

/** Every field on a hub row must pass "would you mind a competitor reading
 * it?" — no submission count, review progress, or any other organizer-only
 * metric ever reaches this markup (see docs/design/Chautauqua Home.dc.html's
 * "Kept off every row, deliberately" panel). */
function OpenCfpRow(props: { event: HubEvent; nowMs: number }) {
  const { event, nowMs } = props;
  return (
    <div class="chq-home-row">
      <div class="chq-home-when">
        <span class="chq-home-dates">{dateRange(event.startDate!, event.endDate!)}</span>
        {event.location ? <span class="chq-home-venue">{event.location}</span> : null}
      </div>
      <div class="chq-home-info">
        <a class="chq-home-name" href={`/e/${event.slug}/sessions`}>
          {event.name}
        </a>
        <span class="chq-home-state">{event.cfpCloseDate !== null ? closesLine(event.cfpCloseDate, event.timezone, nowMs) : "Open now"}</span>
        {event.publishedSessionCount > 0 ? <span class="chq-home-meta">{sessionsLine(event.publishedSessionCount)}</span> : null}
      </div>
      <div class="chq-home-actions">
        <a class="chq-home-action-primary" href={`/submit/${event.slug}`}>
          Submit a talk
        </a>
        {event.publishedSessionCount > 0 ? (
          <a class="chq-home-action-secondary" href={`/e/${event.slug}/speakers`}>
            Speakers
          </a>
        ) : null}
      </div>
    </div>
  );
}

function PublishedRow(props: { event: HubEvent }) {
  const { event } = props;
  return (
    <div class="chq-home-row">
      <div class="chq-home-when">
        <span class="chq-home-dates">{dateRange(event.startDate!, event.endDate!)}</span>
        {event.location ? <span class="chq-home-venue">{event.location}</span> : null}
      </div>
      <div class="chq-home-info">
        <a class="chq-home-name" href={`/e/${event.slug}/sessions`}>
          {event.name}
        </a>
        <span class="chq-home-meta">{sessionsLine(event.publishedSessionCount)}</span>
      </div>
      <div class="chq-home-actions">
        <a class="chq-home-action-secondary" href={`/e/${event.slug}/sessions`}>
          Browse sessions
        </a>
        <a class="chq-home-action-secondary" href={`/e/${event.slug}/speakers`}>
          Speakers
        </a>
      </div>
    </div>
  );
}

function ArchiveRow(props: { event: HubEvent }) {
  const { event } = props;
  return (
    <div class="chq-home-archive-row">
      <span class="chq-home-archive-dates">{dateRange(event.startDate!, event.endDate!)}</span>
      <div class="chq-home-archive-info">
        <a class="chq-home-archive-name" href={`/e/${event.slug}/sessions`}>
          {event.name}
        </a>
        {event.publishedSessionCount > 0 ? <span class="chq-home-meta">{sessionsLine(event.publishedSessionCount)}</span> : null}
      </div>
      <a class="chq-home-action-quiet" href={`/e/${event.slug}/sessions`}>
        Sessions ›
      </a>
    </div>
  );
}

function pluralClause(count: number, singularNoun: string, pluralNoun: string, verbSingular: string, verbPlural: string): string {
  if (count === 0) return "";
  const noun = count === 1 ? singularNoun : pluralNoun;
  const verb = count === 1 ? verbSingular : verbPlural;
  return `${count} ${noun} ${verb}`;
}

/** The full-state hero sentence, e.g. "One call for papers is open. Two
 * programmes are published." Either clause is silently dropped when its
 * count is zero (a `full` state always has at least one of the two). */
function heroSummary(sections: HubSections): string {
  const cfpClause = pluralClause(sections.openCfp.length, "call for papers", "calls for papers", "is open", "are open");
  const publishedClause = pluralClause(sections.published.length, "programme", "programmes", "is published", "are published");
  return [cfpClause, publishedClause]
    .filter((clause) => clause.length > 0)
    .map((clause) => `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`)
    .join(" ");
}

function Footer() {
  return (
    <div class="chq-home-footer">
      <span class="chq-home-footer-text">
        Running on ⚙{" "}
        <a class="chq-home-footer-link" href="https://github.com/chautauqua-project/chautauqua">
          {GITHUB_MARK}
          Chautauqua
        </a>{" "}
        · open-source speaker and event-content management
      </span>
    </div>
  );
}

function HubPage(props: { orgName: string; sections: HubSections; state: HubState; nowMs: number; total: number; shown: number }) {
  const { orgName, sections, state, nowMs, total, shown } = props;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{orgName}</title>
        <ThemeStyles />
        <style dangerouslySetInnerHTML={{ __html: PUBLIC_CSS }} />
        <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />
      </head>
      <body>
        <div class="chq-home-shell">
          <header class="chq-home-header">
            <span class="chq-home-org">{orgName}</span>
            <a class="chq-home-signin" href="/login">
              Sign in
            </a>
          </header>

          <div class="chq-home-body">
            {state === "full" ? (
              <div class="chq-home-hero">
                <h1>Events</h1>
                <p>{heroSummary(sections)}</p>
              </div>
            ) : state === "between_cycles" ? (
              <div class="chq-home-hero">
                <h1>No open calls right now</h1>
                <p>Nothing is taking submissions. Past programmes are still up.</p>
              </div>
            ) : (
              <div class="chq-home-hero">
                <h1>Nothing here yet</h1>
                <p>No call for papers is open and no programme has been published.</p>
              </div>
            )}

            {total > shown ? <p class="chq-home-cap-note">Showing {shown} of {total} events.</p> : null}

            {state === "between_cycles" ? (
              <>
                <section>
                  <div class="chq-home-section-head">
                    <span class="chq-home-section-label">Already happened</span>
                  </div>
                  {sections.past.map((event) => (
                    <ArchiveRow event={event} />
                  ))}
                </section>
                <div class="chq-home-signin-row">
                  <a class="chq-home-action-secondary" href="/login">
                    Sign in
                  </a>
                  <span class="chq-home-cap-note">Organisers and reviewers</span>
                </div>
              </>
            ) : null}

            {state === "fresh" ? (
              <div class="chq-home-signin-row">
                <a class="chq-home-action-primary" href="/login">
                  Sign in
                </a>
              </div>
            ) : null}

            {state === "full" && sections.openCfp.length > 0 ? (
              <section>
                <div class="chq-home-section-head">
                  <span class="chq-home-section-label">Open for submissions</span>
                  <span class="chq-home-section-caption">No account needed</span>
                </div>
                {sections.openCfp.map((event) => (
                  <OpenCfpRow event={event} nowMs={nowMs} />
                ))}
              </section>
            ) : null}

            {state === "full" && sections.published.length > 0 ? (
              <section>
                <div class="chq-home-section-head">
                  <span class="chq-home-section-label">Programme published</span>
                </div>
                {sections.published.map((event) => (
                  <PublishedRow event={event} />
                ))}
              </section>
            ) : null}

            {state === "full" && sections.past.length > 0 ? (
              <section>
                <div class="chq-home-section-head">
                  <span class="chq-home-section-label">Already happened</span>
                </div>
                {sections.past.map((event) => (
                  <ArchiveRow event={event} />
                ))}
              </section>
            ) : null}
          </div>

          <Footer />
        </div>
      </body>
    </html>
  );
}

rootRoutes.get("/", async (c) => {
  const auth = c.var.auth;
  if (auth) {
    if (auth.role === "speaker") return c.redirect("/portal", 302);
    return c.redirect("/admin", 302);
  }

  const nowMs = Date.now();
  const org = await getHubOrg(c.var.db);
  if (!org) {
    throw new ApiError("internal", "No org row exists -- run the seed/migration before serving GET /.");
  }
  const page = await listHubEvents(c.var.db, org.id, nowMs);
  const sections = groupHubEvents(page.items, nowMs);
  const state = hubState(sections);

  return c.html(<HubPage orgName={org.name} sections={sections} state={state} nowMs={nowMs} total={page.total} shown={page.items.length} />);
});
