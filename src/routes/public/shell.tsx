// J10 public surfaces: shared shell (PublicShell/EmbedShell), branding, and
// surface/path helpers used by every surface module and by src/routes/
// public/index.tsx's route handlers. Split out of the former monolithic
// src/routes/public.tsx (contention decomposition) — no behavior change.

import type { PublicEvent } from "../../server/repo/public";
import { ThemeStyles } from "../../views/theme";
import { PUBLIC_CSS } from "./public.css";
import { DEC_374 } from "../../decisions";
import { formatEventDayRange } from "../../lib/event-time";

void DEC_374;

export const SURFACES = ["sessions", "speakers", "agenda", "schedule", "gallery"] as const;
export type Surface = (typeof SURFACES)[number];

export function isSurface(value: string): value is Surface {
  return (SURFACES as readonly string[]).includes(value);
}

/** DEC-990: "Speakers: one page, two views" -- the gallery is still a live
 * surface (its own URL, its own route, and the embed builder can still pick
 * it), it just stops being a nav destination now that /speakers offers a
 * List/Grid toggle to reach it. NAV_SURFACES is derived from SURFACES (never
 * hand-listed) so a future surface addition can't silently desync the two. */
export const NAV_SURFACES = SURFACES.filter((s) => s !== "gallery");

// DEC-477/DEC-487: PER_PAGE moved to src/server/repo/public/bounds.ts as
// PUBLIC_PER_PAGE — this is the ONE home for public paging constants.

// DEC-022: stage-1 caching, every public/embed GET — bounded 60s staleness
// is the accepted stage-1 behavior; no purge machinery.
//
// DEC-553: these surfaces are already anonymous and already deliberately
// frameable (DEC-022), so a wildcard Access-Control-Allow-Origin exposes
// nothing an <iframe> doesn't already render -- it's what makes the JSON
// feed the embed builder advertises (/embed/:slug/sessions.json) actually
// fetchable cross-origin from a page like ai.engineer. Set here (rather
// than in a middleware) so it's present on the copy publicCacheMiddleware
// stores in caches.default too, so cache hits carry it. A simple
// cross-origin GET never preflights, so no OPTIONS handler / Allow-
// Credentials / Allow-Headers is needed.
export function setCacheHeaders(c: { header(name: string, value: string): void }): void {
  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  c.header("Access-Control-Allow-Origin", "*");
}

export function branding(event: PublicEvent): { logoUrl?: string; accentColor?: string } {
  if (!event.brandingJson) return {};
  const parsed = JSON.parse(event.brandingJson) as { logoUrl?: string; accentColor?: string };
  return { logoUrl: parsed.logoUrl, accentColor: parsed.accentColor };
}

const DEFAULT_ACCENT = "#4E5C31";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** DEC-374: the per-event accent is never interpolated into CSS text (that
 * was the pre-redesign approach, and it's how untrusted branding JSON could
 * have injected arbitrary CSS/markup into a `<style>` block). Instead it's
 * validated against a strict hex pattern and applied as a `style` attribute
 * on <body> -- exported so a non-hex brandingJson value can be asserted to
 * fall back to DEFAULT_ACCENT in tests. */
export function validAccent(color: string | undefined): string {
  return color && HEX_COLOR_RE.test(color) ? color : DEFAULT_ACCENT;
}

// DEC-594: every path helper below takes an explicit `base` ("/e" or
// "/embed"), defaulting to "/e" so every existing call site (PublicShell nav,
// agenda/speakers/detail surfaces) keeps producing full-chrome links
// unchanged. The chromeless /embed dispatch is the only caller that passes
// "/embed" — an embed's own links must never break out of its iframe.
export type SurfaceBase = "/e" | "/embed";

export function surfacePath(event: PublicEvent, surface: Surface, base: SurfaceBase = "/e"): string {
  return `${base}/${event.slug}/${surface}`;
}

/** Drill-in detail links (DEC-151) carry ?from=<surface> so the detail
 * page's Back link returns to whichever surface it was reached from. */
export function sessionDetailPath(event: PublicEvent, sessionId: string, from?: Surface, base: SurfaceBase = "/e"): string {
  return `${base}/${event.slug}/sessions/${sessionId}${from ? `?from=${from}` : ""}`;
}

export function speakerDetailPath(event: PublicEvent, contactId: string, from?: Surface, base: SurfaceBase = "/e"): string {
  return `${base}/${event.slug}/speakers/${contactId}${from ? `?from=${from}` : ""}`;
}

export function isValidFrom(raw: string | undefined, fallback: Surface): Surface {
  return raw && isSurface(raw) ? raw : fallback;
}

export const SURFACE_LABELS: Record<Surface, string> = {
  sessions: "Sessions",
  speakers: "Speakers",
  agenda: "Agenda",
  schedule: "Schedule",
  gallery: "Gallery",
};

/** DEC-374: THEME_CSS then one PUBLIC_CSS `<style>` element, both inlined
 * via dangerouslySetInnerHTML so hono/jsx never HTML-escapes the CSS text
 * (no stray &#39;/&quot;/&gt; entities). PUBLIC_CSS is a value-free module
 * constant -- the per-event accent is never interpolated here; see
 * validAccent() and the `style` attribute on <body> in PublicShell/
 * EmbedShell below instead. */
export function BaseStyles() {
  return (
    <>
      <ThemeStyles />
      <style dangerouslySetInnerHTML={{ __html: PUBLIC_CSS }} />
    </>
  );
}

/** Parses a 'YYYY-MM-DD' day field (DEC-010) to a UTC-midnight epoch ms —
 * no formatting here, just field extraction; the rendering itself is
 * formatEventDayRange in src/lib/event-time.ts (DEC-918: one server-side
 * calendar-day grammar). Malformed input falls back to NaN, which
 * formatEventDayRange's Date arithmetic will surface as "Invalid Date"
 * rather than throwing mid-render — matching this surface's fail-soft
 * contract for organizer-entered scheduling data. */
function dayMs(iso: string): number {
  const [year, month, date] = iso.split("-").map(Number);
  if (!year || !month || !date) return NaN;
  return Date.UTC(year, month - 1, date);
}

/** "12-14 May 2027 · Moscone West, San Francisco" style meta line for the
 * public header (DEC-377: every field here traces to PublicEvent's own
 * startDate/endDate/location columns, nothing illustrative; DEC-918: the
 * range itself renders through formatEventDayRange, the ONE server-side
 * calendar-day grammar). */
function eventDatesLine(event: PublicEvent): string {
  const dates = formatEventDayRange(dayMs(event.startDate), dayMs(event.endDate));
  return event.location ? `${dates} · ${event.location}` : dates;
}

/** Mobile-first shared layout with event branding + surface nav (DEC-022,
 * DEC-366 chrome from docs/design/Chautauqua Public and Portal.dc.html). */
export function PublicShell(props: { event: PublicEvent; active: Surface; title: string; children: unknown }) {
  const { event, active } = props;
  const b = branding(event);
  const accent = validAccent(b.accentColor);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <BaseStyles />
      </head>
      <body style={`--chq-brandable-accent: ${accent};`}>
        <header class="chq-pub-header">
          <div class="chq-pub-header-meta">
            <span class="chq-pub-header-dates">{eventDatesLine(event)}</span>
            <span class="chq-pub-header-title">
              {b.logoUrl ? <img class="chq-pub-header-logo" src={b.logoUrl} alt="" /> : null}
              {event.name}
            </span>
          </div>
          <nav class="chq-nav">
            {NAV_SURFACES.map((s) => (
              <a href={surfacePath(event, s)} aria-current={s === active ? "page" : undefined}>
                {SURFACE_LABELS[s]}
              </a>
            ))}
          </nav>
        </header>
        <main class="chq-pub-main">{props.children as any}</main>
      </body>
    </html>
  );
}

/** Chromeless embed shell (DEC-022): same surface content, no nav/header, no
 * frame-blocking headers set anywhere in this file so iframes work. Keeps
 * the identical BaseStyles() style pair as PublicShell (DEC-374). */
export function EmbedShell(props: { event: PublicEvent; title: string; children: unknown; accentOverride?: string }) {
  const b = branding(props.event);
  const accent = validAccent(props.accentOverride ?? b.accentColor);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <BaseStyles />
      </head>
      <body style={`--chq-brandable-accent: ${accent};`}>
        <main class="chq-pub-main">{props.children as any}</main>
        {/* DEC-617: pairs with public/embed.js -- posts this document's
            height to window.parent on load/resize, echoing back the
            `embed_id` query param the <chq-embed> element appended to this
            page's own src, so a resize message can be matched to instance. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var id=new URLSearchParams(location.search).get("embed_id");if(!id)return;function post(){parent.postMessage({type:"chq-embed-height",id:id,height:document.documentElement.scrollHeight},"*");}window.addEventListener("load",post);window.addEventListener("resize",post);post();})();`,
          }}
        />
      </body>
    </html>
  );
}
