// J10 public surfaces: shared shell (PublicShell/EmbedShell), branding, and
// surface/path helpers used by every surface module and by src/routes/
// public/index.tsx's route handlers. Split out of the former monolithic
// src/routes/public.tsx (contention decomposition) — no behavior change.

import type { PublicEvent } from "../../server/repo/public";

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

export function BaseStyles(props: { accentColor?: string }) {
  return (
    <style>{`
      :root { --chq-accent: ${props.accentColor ?? "#2b2b2b"}; }
      body { font-family: system-ui, sans-serif; margin: 0; color: #1a1a1a; }
      main { max-width: 960px; margin: 0 auto; padding: 1rem; }
      a { color: var(--chq-accent); }
      .chq-nav a { margin-right: 1rem; }
      .chq-track-chip { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; color: #fff; font-size: 0.8rem; margin-right: 0.25rem; }
      .chq-card { border: 1px solid #ddd; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; }
      .chq-speaker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
      .chq-speaker-grid img, .chq-speaker-grid .chq-headshot-fallback { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; background: #eee; }
      .chq-agenda-day { display: grid; gap: 1px; background: #eee; margin-bottom: 1.5rem; }
      .chq-agenda-block { background: #fff; border-left: 3px solid var(--chq-accent); padding: 0.4rem 0.6rem; font-size: 0.85rem; }
    `}</style>
  );
}

/** Mobile-first shared layout with event branding + surface nav (DEC-022). */
export function PublicShell(props: { event: PublicEvent; active: Surface; title: string; children: unknown }) {
  const { event, active } = props;
  const b = branding(event);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <BaseStyles accentColor={b.accentColor} />
      </head>
      <body>
        <header>
          <main style="padding-bottom:0">
            {b.logoUrl ? <img src={b.logoUrl} alt="" height={40} /> : null}
            <h1>{event.name}</h1>
            <nav class="chq-nav">
              {SURFACES.map((s) => (
                <a href={surfacePath(event, s)} aria-current={s === active ? "page" : undefined}>
                  {SURFACE_LABELS[s]}
                </a>
              ))}
            </nav>
          </main>
        </header>
        <main>{props.children as any}</main>
      </body>
    </html>
  );
}

/** Chromeless embed shell (DEC-022): same surface content, no nav/header, no
 * frame-blocking headers set anywhere in this file so iframes work. */
export function EmbedShell(props: { event: PublicEvent; title: string; children: unknown }) {
  const b = branding(props.event);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <BaseStyles accentColor={b.accentColor} />
      </head>
      <body>
        <main>{props.children as any}</main>
      </body>
    </html>
  );
}
