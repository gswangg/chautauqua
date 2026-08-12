// J10 public surfaces: shared shell (PublicShell/EmbedShell), branding, and
// surface/path helpers used by every surface module and by src/routes/
// public/index.tsx's route handlers. Split out of the former monolithic
// src/routes/public.tsx (contention decomposition) — no behavior change.

import type { PublicEvent } from "../../server/repo/public";
import { ThemeStyles } from "../../views/theme";
import { PUBLIC_CSS } from "./public.css";
import { DEC_374 } from "../../decisions";

void DEC_374;

export const SURFACES = ["sessions", "speakers", "agenda", "schedule", "gallery"] as const;
export type Surface = (typeof SURFACES)[number];

export function isSurface(value: string): value is Surface {
  return (SURFACES as readonly string[]).includes(value);
}

export const PER_PAGE = 12;

// DEC-022: stage-1 caching, every public/embed GET — bounded 60s staleness
// is the accepted stage-1 behavior; no purge machinery.
export function setCacheHeaders(c: { header(name: string, value: string): void }): void {
  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
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

export function surfacePath(event: PublicEvent, surface: Surface): string {
  return `/e/${event.slug}/${surface}`;
}

/** Drill-in detail links (DEC-151) carry ?from=<surface> so the detail
 * page's Back link returns to whichever surface it was reached from. */
export function sessionDetailPath(event: PublicEvent, sessionId: string, from?: Surface): string {
  return `/e/${event.slug}/sessions/${sessionId}${from ? `?from=${from}` : ""}`;
}

export function speakerDetailPath(event: PublicEvent, contactId: string, from?: Surface): string {
  return `/e/${event.slug}/speakers/${contactId}${from ? `?from=${from}` : ""}`;
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

/** "12–14 May 2027 · Moscone West, San Francisco" style meta line for the
 * public header (DEC-377: every field here traces to PublicEvent's own
 * startDate/endDate/location columns, nothing illustrative). */
function eventDatesLine(event: PublicEvent): string {
  const fmt = (iso: string, withYear: boolean) => {
    const [year, month, date] = iso.split("-").map(Number);
    if (!year || !month || !date) return iso;
    const d = new Date(Date.UTC(year, month - 1, date));
    return d.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    });
  };
  const dates =
    event.startDate === event.endDate
      ? fmt(event.startDate, true)
      : `${fmt(event.startDate, false)}–${fmt(event.endDate, true)}`;
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
            {SURFACES.map((s) => (
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
      </body>
    </html>
  );
}
