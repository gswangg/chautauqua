// J10 public surfaces: shared shell (PublicShell/EmbedShell), branding, and
// surface/path helpers used by every surface module and by src/routes/
// public/index.tsx's route handlers. Split out of the former monolithic
// src/routes/public.tsx (contention decomposition) — no behavior change.

import type { PublicEvent } from "../../server/repo/public";
import { ThemeStyles } from "../../views/theme";
import { PUBLIC_CSS } from "./public.css";
import { DEC_374, DEC_371, DEC_593, DEC_322 } from "../../decisions";
import { formatEventDayRange } from "../../lib/event-time";
import { normalizeHexColor } from "../../domain/color";
import { safeImageSrc } from "../../domain/brand-url";

void DEC_371;

void DEC_374;

void DEC_593;

void DEC_322;

export const SURFACES = ["sessions", "speakers", "agenda", "schedule", "gallery"] as const;
export type Surface = (typeof SURFACES)[number];

export function isSurface(value: string): value is Surface {
  return (SURFACES as readonly string[]).includes(value);
}

/** DEC-989 Amendment (wave 37), further amended DEC-990 (wave 40) and DEC-683
 * (wave 67, wave 1 task w1-a, and wave 5 task w5-a, this amendment): the SSR
 * public surfaces take their container class from the CONTENT, not the
 * route. sessions is the WIDE pair (list + 300px rail, the 1180 measure
 * DEC-989 itself names); gallery (six ~184px tiles + gaps is ~1180, DEC-990
 * wave-40 amendment) is WIDE too; agenda is the SAME 1180 pair as sessions
 * (list + rail) -- the wave-64 desktop room-lane matrix that justified
 * CANVAS is gone (DEC-584: agenda is a time-row sequence, not room columns),
 * and the agenda surface has its own rail (AgendaRail, agenda-rail.tsx) as
 * of the wave-67 amendment, so the "canvas" measure has no remaining surface
 * and is removed rather than left dead. DEC-683 amendment (wave 1, task
 * w1-a): speakers moves from READING to WIDE here too, so its List and Grid
 * views share the SAME 1180 column gallery already renders at -- a view
 * switch on one surface no longer resizes the page around it. DEC-555
 * amendment (wave 5, task w5-a): schedule joins the WIDE pair too (its own
 * list + rail, .chq-pub-schedule-layout) -- there is no longer a READING
 * surface, but the "reading" PublicMeasure value is left in place (unused
 * by any surface today) rather than deleted, since EmbedShell never
 * consumes this at all: an embed fills its host iframe. */
export type PublicMeasure = "reading" | "wide";

export function measureClassForSurface(surface: Surface): PublicMeasure {
  switch (surface) {
    case "sessions":
    case "gallery":
    case "agenda":
    case "speakers":
    case "schedule":
      return "wide";
  }
}

/** DEC-593 Amendment (wave 65), superseding DEC-990's wave-53 nav clause on
 * this one point: a photo-led twin is not a nav destination -- a view switch
 * (the /speakers List/Grid toggle) must not present as leaving the section.
 * NAV_SURFACES is derived from SURFACES (never hand-listed) by filtering out
 * "gallery"; SURFACES itself stays unchanged so the route, feeds, embeds and
 * the Settings surface-count rows are untouched. Every PublicShell call site
 * routes its `active` Surface through navActiveFor() below so /gallery (and
 * a speaker-detail page reached with ?from=gallery) highlight Speakers --
 * exactly one nav <a> ever carries aria-current. */
export const NAV_SURFACES: readonly Surface[] = SURFACES.filter((s) => s !== "gallery");

/** DEC-593 wave-65: maps any Surface (including "gallery", which has no nav
 * entry) to the Surface whose nav <a> should carry aria-current. */
export function navActiveFor(surface: Surface): Surface {
  return surface === "gallery" ? "speakers" : surface;
}

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
//
// DEC-099 wave-34 amendment: also sets Vary: Cookie. Every serving path this
// header covers branches on the chq_session cookie (publicCacheMiddleware
// skips both cache.match and cache.put for any cookie-carrying request — see
// pubcache.ts), so a shared/proxy cache downstream of this response must key
// on Cookie too or it can hand a signed-in organiser's dynamic render to the
// next anonymous visitor (or vice versa). This is the ONE door for that
// header on every public/embed GET; servePublicGet strips it back off the
// stored (anonymous-only-by-construction) copy in caches.default and restores
// it on every cache-hit response — see pubcache.ts's servePublicGet.
export function setCacheHeaders(c: { header(name: string, value: string): void }): void {
  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Vary", "Cookie");
}

export function branding(event: PublicEvent): { logoUrl?: string; accentColor?: string } {
  if (!event.brandingJson) return {};
  const parsed = JSON.parse(event.brandingJson) as { logoUrl?: string; accentColor?: string };
  // DEC-322 wave-30 amendment: sanitize at the read so a legacy stored value
  // (written before this gate existed) can never reach an <img src>.
  return { logoUrl: safeImageSrc(parsed.logoUrl) ?? undefined, accentColor: parsed.accentColor };
}

const DEFAULT_ACCENT = "#4E5C31";

/** DEC-374: the per-event accent is never interpolated into CSS text (that
 * was the pre-redesign approach, and it's how untrusted branding JSON could
 * have injected arbitrary CSS/markup into a `<style>` block). Instead it's
 * validated against the ONE hex-colour grammar (src/domain/color.ts, DEC-371
 * amendment wave 43) and applied as a `style` attribute on <body> --
 * exported so a non-hex brandingJson value can be asserted to fall back to
 * DEFAULT_ACCENT in tests. */
export function validAccent(color: string | undefined): string {
  return normalizeHexColor(color) ?? DEFAULT_ACCENT;
}

// DEC-594: every path helper below takes an explicit `base` ("/e" or
// "/embed"), defaulting to "/e" so every existing call site (PublicShell nav,
// agenda/speakers/detail surfaces) keeps producing full-chrome links
// unchanged. The chromeless /embed dispatch is the only caller that passes
// "/embed" — an embed's own links must never break out of its iframe.
export type SurfaceBase = "/e" | "/embed";

/** DEC-151 (wave-59 amendment): `carry`, when supplied, is an already-
 * encoded `k=v&k=v` fragment (an embedKnobQuery result) appended as this
 * path's query string -- the same idiom detailQs below uses for a drill-in
 * link. Used by BackLink (src/routes/public/detail.tsx) to restore a
 * surface's active narrowing (day/q/trackId/format/roomId, or the embed
 * accent/fields knobs) when a visitor returns from a session/speaker
 * detail page, on both the /e and /embed bases. */
export function surfacePath(event: PublicEvent, surface: Surface, base: SurfaceBase = "/e", carry?: string): string {
  const qs = carry ? `?${carry}` : "";
  return `${base}/${event.slug}/${surface}${qs}`;
}

/** Drill-in detail links (DEC-151) carry ?from=<surface> so the detail
 * page's Back link returns to whichever surface it was reached from.
 * DEC-489 (wave-54 amendment), DEC-151 (wave-59 amendment): `carry`, when
 * supplied, is an already-encoded `k=v&k=v` fragment (an embedKnobQuery
 * result, e.g. the surface's active `accent`/`fields` embed knobs, or its
 * day/q/trackId/format/roomId narrowing) appended after `?from=` so a click
 * into a session/speaker detail keeps the visitor's active surface state --
 * on BOTH bases, /e and /embed -- instead of reverting to defaults. */
function detailQs(from: Surface | undefined, carry: string | undefined): string {
  const parts: string[] = [];
  if (from) parts.push(`from=${from}`);
  if (carry) parts.push(carry);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function sessionDetailPath(
  event: PublicEvent,
  sessionId: string,
  from?: Surface,
  base: SurfaceBase = "/e",
  carry?: string,
): string {
  return `${base}/${event.slug}/sessions/${sessionId}${detailQs(from, carry)}`;
}

export function speakerDetailPath(
  event: PublicEvent,
  contactId: string,
  from?: Surface,
  base: SurfaceBase = "/e",
  carry?: string,
): string {
  return `${base}/${event.slug}/speakers/${contactId}${detailQs(from, carry)}`;
}

export function isValidFrom(raw: string | undefined, fallback: Surface): Surface {
  return raw && isSurface(raw) ? raw : fallback;
}

export const SURFACE_LABELS: Record<Surface, string> = {
  sessions: "Sessions",
  speakers: "Speakers",
  agenda: "Agenda",
  schedule: "My schedule",
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
export function dayMs(iso: string): number {
  const [year, month, date] = iso.split("-").map(Number);
  if (!year || !month || !date) return NaN;
  return Date.UTC(year, month - 1, date);
}

/** "12-14 May 2027 · Moscone West, San Francisco" style meta line for the
 * public header (DEC-377: every field here traces to PublicEvent's own
 * startDate/endDate/location columns, nothing illustrative; DEC-918: the
 * range itself renders through formatEventDayRange, the ONE server-side
 * calendar-day grammar). */
export function eventDatesLine(event: PublicEvent): string {
  const dates = formatEventDayRange(dayMs(event.startDate), dayMs(event.endDate));
  return event.location ? `${dates} · ${event.location}` : dates;
}

/** Mobile-first shared layout with event branding + surface nav (DEC-022,
 * DEC-366 chrome from docs/design/Chautauqua Public and Portal.dc.html). */
export function PublicShell(props: { event: PublicEvent; active: Surface; title: string; measure: PublicMeasure; children: unknown }) {
  const { event, active, measure } = props;
  const b = branding(event);
  const accent = validAccent(b.accentColor);
  const measureClass = measure === "wide" ? " chq-measure-wide" : measure === "reading" ? " chq-measure" : "";
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
        <main class={`chq-pub-main${measureClass}`}>{props.children as any}</main>
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
