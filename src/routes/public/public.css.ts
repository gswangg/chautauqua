// DEC-373: co-located SSR surface stylesheet for the public event family
// (sessions/speakers/agenda/schedule/gallery + drill-in detail pages).
// Tokens live only in THEME_CSS (src/views/theme.ts) -- this file only adds
// .chq-pub-* component classes layered on top of the shared reset/tokens.
//
// PUBLIC_CSS is a fixed, value-free module constant (DEC-374) -- never
// interpolated with request/user data. BaseStyles (shell.tsx) inlines it via
// `<style dangerouslySetInnerHTML={{ __html: PUBLIC_CSS }} />`, exactly like
// ThemeStyles() inlines THEME_CSS, so hono/jsx never HTML-escapes it (no
// stray &#39;/&quot;/&gt; entities in the rendered <style> text).

import { DEC_367, DEC_373, DEC_374 } from "../../decisions";

void DEC_367;
void DEC_373;
void DEC_374;

export const PUBLIC_CSS = `
  /* DEC-253: mobile bar (390x844) -- nav/filter/submit controls stay
     reachable and tap-target-sized, and wrap instead of overflowing.
     Unquoted attribute selectors: dangerouslySetInnerHTML writes this
     string to the DOM verbatim, so quoting would be safe here too, but we
     keep the unquoted convention from THEME_CSS/shell.tsx for consistency
     across every SSR surface stylesheet. */
  form[role=search] { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
  form[role=search] label { display: flex; flex-direction: column; gap: 0.2rem; flex: 1 1 200px; }

  /* Public event chrome (DEC-369/DEC-366: header carries the event's own
     dates/venue + name, above the shared .chq-nav from THEME_CSS). */
  .chq-pub-header {
    border-bottom: 1px solid var(--chq-ink);
    padding: 22px 34px 18px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    background: var(--chq-paper);
  }
  .chq-pub-header-meta { display: flex; flex-direction: column; gap: 6px; }
  .chq-pub-header-dates {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--chq-muted);
  }
  .chq-pub-header-title {
    font-family: var(--chq-font-display);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--chq-ink);
  }
  .chq-pub-header-logo { height: 40px; }

  main.chq-pub-main { padding: 26px 34px 34px; }

  .chq-pub-filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--chq-rule);
    padding-bottom: 14px;
    flex-wrap: wrap;
  }
  .chq-pub-pill {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-pill);
    padding: 0 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--chq-ink-2);
    text-decoration: none;
  }
  .chq-pub-pill[aria-current=true] {
    background: var(--chq-ink);
    color: var(--chq-on-ink);
    border-color: var(--chq-ink);
    font-weight: 600;
  }

  /* Session rows (sessions.tsx SessionCard). */
  .chq-pub-session-row {
    display: grid;
    grid-template-columns: 126px 1fr auto;
    gap: 22px;
    align-items: baseline;
    padding: 20px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-pub-session-when { display: flex; flex-direction: column; gap: 2px; }
  .chq-pub-session-time { font-family: var(--chq-font-display); font-size: 15px; font-weight: 700; color: var(--chq-ink); }
  .chq-pub-session-room { font-size: 12px; color: var(--chq-muted); }
  .chq-pub-session-body { display: flex; flex-direction: column; gap: 7px; }
  .chq-pub-session-title {
    font-family: var(--chq-font-display);
    font-size: 21px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.3;
    color: var(--chq-ink);
    text-decoration: none;
  }
  .chq-pub-session-speaker { font-size: 14px; color: var(--chq-ink-2); margin: 0; }
  .chq-pub-session-tags { display: flex; gap: 8px; align-items: center; }
  .chq-pub-session-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--chq-muted); }
  /* w3-h: chip text sits on a per-event accent background set inline (safeExternalUrl-
     free style attribute, DEC-322 territory but not colour palette); no token models
     "text on an arbitrary accent fill", so on-brand (the closest light/on-dark ink) is
     the nearest DEC-367 substitute for the removed literal #fff. */
  .chq-pub-track-chip { display: inline-block; padding: 0.1rem 0.5rem; border-radius: var(--chq-r-pill); color: var(--chq-on-brand); font-size: 0.8rem; margin-right: 0.25rem; }
  .chq-pub-session-action { white-space: nowrap; align-self: center; }

  /* Speaker grid (speakers.tsx / gallery). */
  .chq-pub-speaker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 20px; }
  .chq-pub-speaker-card { display: flex; flex-direction: column; gap: 9px; }
  .chq-pub-speaker-grid img, .chq-pub-headshot-fallback {
    width: 100%;
    aspect-ratio: 1/1;
    object-fit: cover;
    border-radius: var(--chq-r-card);
    background: var(--chq-surface-sunk);
  }
  .chq-pub-speaker-name {
    font-family: var(--chq-font-display);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--chq-ink);
    text-decoration: none;
  }
  .chq-pub-speaker-role { font-size: 13px; color: var(--chq-muted); line-height: 1.45; margin: 0; }
  .chq-pub-speaker-sessions { font-size: 13px; line-height: 1.45; margin: 0; padding-left: 1.1em; }

  /* Gallery (headshots only, no session details). */
  .chq-pub-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 10px; }
  .chq-pub-gallery-tile { aspect-ratio: 1; border-radius: var(--chq-r-ctl); overflow: hidden; background: var(--chq-surface-sunk); }
  .chq-pub-gallery-tile img { width: 100%; height: 100%; object-fit: cover; }
  .chq-pub-gallery-name { display: block; margin-top: 4px; font-size: 12px; color: var(--chq-muted); text-align: center; }

  /* Agenda day grid (DEC-253: the day grid itself keeps its legible
     per-room minmax columns and scrolls sideways in its own container
     rather than collapsing the whole page or blowing out page-level
     width). */
  .chq-pub-agenda-day-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 1.5rem; }
  .chq-pub-agenda-day { display: grid; gap: 1px; background: var(--chq-hairline); margin-bottom: 0; }
  .chq-pub-agenda-block {
    background: var(--chq-surface);
    border-left: 3px solid var(--chq-brandable-accent);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
  }
  .chq-pub-day-switcher { display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
  .chq-pub-day-pill {
    flex-shrink: 0;
    border-radius: var(--chq-r-pill);
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 0 15px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--chq-border);
    color: var(--chq-ink-2);
    text-decoration: none;
  }

  /* Itinerary (schedule surface, DEC-022 localStorage-driven -- class name
     ".chq-itinerary-toggle" itself is behavior-critical, read by inline JS
     in agenda.tsx's ItineraryScript, and stays unchanged). */
  .chq-pub-itinerary-row { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }
  .chq-pub-itinerary-cta {
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-card);
    background: var(--chq-surface-sunk);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    color: var(--chq-ink-2);
  }
  .chq-pub-itinerary-cta[aria-disabled=true] { opacity: 0.5; pointer-events: none; }
`;
