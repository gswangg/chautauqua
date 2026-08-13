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

import { DEC_367, DEC_373, DEC_374, DEC_838 } from "../../decisions";

void DEC_367;
void DEC_373;
void DEC_374;
void DEC_838;

// DEC-838: the ONE list of classes whose colour is bound to
// --chq-brandable-accent -- interpolated into the selectors below (never
// hand-listed a second time) so test/embed-accent-surfaces.test.ts's
// enumeration reads the exact same set the CSS text actually uses. Every
// entry here was, before this change, ALREADY rendering at var(--chq-brand)
// (either directly or via the plain-<a> global `a { color: var(--chq-brand)
// }` rule in theme.ts) -- and --chq-brand's default (#4E5C31) equals
// --chq-brandable-accent's default (#4E5C31), so repointing these specific
// rules to the per-event custom property changes NOTHING about the default
// render; only a non-default accent becomes visible. No other rule in this
// file qualifies (body text, filled buttons, and fg/bg pairs like the track
// chip are excluded on purpose -- contrast is not the organizer's to break).
export const ACCENT_BOUND_CLASSES = ["chq-pub-agenda-block", "chq-pub-day-pill", "chq-pub-accent-link"] as const;

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
  /* DEC-698: the /embed field toggles can drop the time field entirely --
     the row then carries no .chq-pub-session-when cell at all, so the
     126px gutter column must not exist either or the body lands in it
     and wraps word-per-word. */
  .chq-pub-session-row-notime { grid-template-columns: 1fr auto; }
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
  /* w4-k: the description snippet lives inside the summary alongside "Show
     more" so it doubles as the collapsed preview -- once the disclosure is
     opened the snippet must disappear or the full description prints
     twice (snippet, then full text). */
  details[open] .chq-pub-desc-snippet { display: none; }
  .chq-pub-session-tags { display: flex; gap: 8px; align-items: center; }
  .chq-pub-session-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--chq-muted); }
  /* DEC-430: organizer-supplied track colour is untrusted for text-on-fill contrast
     (measured 3.00-3.10:1 against --chq-on-brand) -- the chip now renders ink-on-
     surface always, and carries the track colour only as a bounded swatch dot fed
     by the --chq-track-color custom property (strict hex-guarded, cards.tsx). */
  .chq-pub-track-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.1rem 0.5rem;
    border-radius: var(--chq-r-pill);
    color: var(--chq-ink);
    background: var(--chq-surface);
    border: 1px solid var(--chq-hairline);
    font-size: 0.8rem;
    margin-right: 0.25rem;
  }
  .chq-pub-track-chip::before {
    content: "";
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--chq-track-color, var(--chq-hairline));
  }
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
  .${ACCENT_BOUND_CLASSES[0]} {
    background: var(--chq-surface);
    border-left: 3px solid var(--chq-brandable-accent);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
  }
  /* DEC-584: phone (<700px) list markup for a single agenda day, rendered
     from the SAME items array as AgendaDayGrid and switched with the
     desktop grid purely via display:none below (breakpoint block) so
     exactly one copy is in the accessibility tree at a time. Hidden by
     default (desktop-first source order); the 700px breakpoint flips
     which of the two is visible. */
  .chq-pub-agenda-list { display: none; list-style: none; margin: 0 0 1.5rem; padding: 0; }
  .chq-pub-agenda-list-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-pub-agenda-list-time { font-family: var(--chq-font-display); font-size: 15px; font-weight: 700; color: var(--chq-ink); }
  .chq-pub-agenda-list-title {
    font-family: var(--chq-font-display);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--chq-ink);
    text-decoration: none;
  }
  /* Room name is rendered as text (not colour alone) so it stays legible
     without relying on the track swatch dot. */
  .chq-pub-agenda-list-room {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--chq-muted);
  }
  .chq-pub-agenda-list-speakers { font-size: 13px; color: var(--chq-ink-2); }

  .chq-pub-day-switcher { display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
  /* DEC-838: the day pill (agenda + schedule's shared DaySwitcher, agenda.tsx)
     was an unclassed-color <a> before this rule -- it rendered at
     var(--chq-brand) purely via theme.ts's global a-tag colour cascade.
     This makes that inherited colour an explicit, per-event-accent-bound
     declaration instead: byte-identical by default (both tokens share the
     #4E5C31 default), customizable once an organizer sets a branding
     accentColor. */
  .${ACCENT_BOUND_CLASSES[1]} {
    flex-shrink: 0;
    border-radius: var(--chq-r-pill);
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 0 15px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--chq-border);
    color: var(--chq-brandable-accent);
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

  /* DEC-385: single phone switch shared by every stylesheet. Collapses
     the header/main gutters, stacks the session row's when/room line
     above the title instead of a fixed 126px column, and keeps the
     agenda day grid scrolling inside its own box rather than widening
     the document. */
  @media (max-width: 700px) {
    .chq-pub-header { padding: 16px; }
    main.chq-pub-main { padding: 16px; }
    .chq-pub-header-title { font-size: 25px; }
    .chq-pub-session-row {
      grid-template-columns: 1fr;
      gap: 6px;
    }
    .chq-pub-session-when {
      flex-direction: row;
      gap: 8px;
      align-items: baseline;
      order: -1;
    }
    .chq-pub-speaker-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
    .chq-pub-session-action {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chq-pub-itinerary-cta { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
    .chq-pub-agenda-day-scroll { max-width: 100%; }

    /* DEC-584: exactly one of the two agenda markups is in the a11y tree
       at a time -- the desktop room-grid wrapper hides below 700px and the
       phone list takes over. */
    .chq-pub-agenda-desktop { display: none; }
    .chq-pub-agenda-list { display: block; }
  }

  /* DEC-593: gallery reuses the directory's SpeakerCard markup
     (.chq-pub-speaker-grid/-card/-name) but keeps its own tighter,
     headshot-first column width via the .chq-pub-gallery-grid modifier. */
  .chq-pub-gallery-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 10px; }

  /* EMB-01/EMB-08: Format chip, styled like a track chip but without the
     colour dot (format has no organizer-assigned colour). */
  .chq-pub-format-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.5rem;
    border-radius: var(--chq-r-pill);
    color: var(--chq-ink);
    background: var(--chq-surface);
    border: 1px solid var(--chq-hairline);
    font-size: 0.8rem;
    margin-right: 0.25rem;
  }

  /* ===== task-w4-a (DEC-602): agenda geometry + /schedule itinerary list =====
     Owned by task-w4-a; another lane may append its own labelled block
     below this one in the same file. */

  /* EMB-06 w3: AgendaDayGrid reserves a 70px first column for hour labels
     (grid-template-columns: 70px repeat(...)) but never rendered anything
     into it. Labels are positioned via the SAME rowForMinute math the
     session blocks use (agenda.tsx), so a label's row can never drift from
     the blocks around it. */
  .chq-pub-agenda-hour-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--chq-muted);
    padding: 2px 4px 0 0;
    text-align: right;
    background: var(--chq-surface-sunk);
  }

  /* DEC-768: a grid block's grid-row span used to be a fixed 22px * spanCount
     (overflow:hidden + line-clamp:2 to keep bleed contained), so a 15-minute
     session's title/speakers routinely clipped away entirely. The row track
     itself is now minmax(22px, auto) (agenda.tsx), so the block must grow
     to its content instead of clipping it -- no fixed height, no
     overflow:hidden, title wraps in full (mirrors app/src/pages/agenda/
     DayGrid.tsx's DEC-742 merged-card treatment). A grid block must never
     contain an interactive control (agenda.tsx no longer renders the
     itinerary checkbox inside AgendaDayGrid's blocks). */
  .chq-pub-agenda-block-title,
  .chq-pub-agenda-block-speakers {
    overflow-wrap: break-word;
  }

  /* EMB-09 w2: /schedule renders the shared item-list markup (.chq-pub-
     schedule-list) at EVERY width -- never AgendaDayGrid's room-column
     grid, unlike /agenda which still switches between the two at 700px.
     Reuses .chq-pub-agenda-list-item/-time/-title/-room/-speakers, so only
     the list container itself needs an always-visible rule. */
  .chq-pub-schedule-list {
    display: block;
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
  }

  /* EMB-10 w1: 'Show only my picks' toggle + honest empty state, handled by
     ItineraryScript's applyPicksFilter (agenda.tsx). */
  .chq-pub-picks-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .chq-pub-picks-empty {
    color: var(--chq-muted);
    font-size: 13px;
  }

  /* ===== task-w14-d (DEC-683): sessions list + rail =====
     Two-column grid (list, then a 300px <aside>) above 700px, single column
     below it — same breakpoint the rest of this stylesheet already uses. */
  .chq-pub-sessions-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 34px;
    align-items: start;
  }
  .chq-pub-sessions-rail { display: flex; flex-direction: column; gap: 26px; }
  .chq-pub-rail-section { display: flex; flex-direction: column; }
  .chq-pub-rail-heading {
    font-family: var(--chq-font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border-bottom: 2px solid var(--chq-ink);
    padding-bottom: 8px;
    margin: 0;
  }
  .chq-pub-rail-body { padding-top: 14px; display: flex; flex-direction: column; gap: 11px; }
  .chq-pub-rail-caption { font-size: 14px; line-height: 1.6; color: var(--chq-ink-2); }
  .chq-pub-rail-day-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: baseline;
    padding: 12px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-pub-rail-day-row a { font-size: 14px; font-weight: 600; color: var(--chq-ink); text-decoration: none; }
  .chq-pub-rail-day-count { font-size: 13px; color: var(--chq-muted); }
  .chq-pub-rail-cfp-link { font-size: 14px; font-weight: 700; color: var(--chq-ink); align-self: flex-start; }

  /* DEC-683: per-row Save/Saved pill. The checkbox itself is visually
     hidden (never display:none -- that would drop it from the a11y tree)
     and its accessible name comes from the <label> wrapping both spans;
     :checked swaps which span shows, same pattern as ONE dialog contract
     elsewhere in this codebase, no new JS. */
  .chq-pub-save {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-ctl);
    background: var(--chq-surface-sunk);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    align-self: center;
    cursor: pointer;
  }
  .chq-pub-save input.chq-itinerary-toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    margin: 0;
  }
  .chq-pub-save-on { display: none; }
  .chq-pub-save input.chq-itinerary-toggle:checked ~ .chq-pub-save-off { display: none; }
  .chq-pub-save input.chq-itinerary-toggle:checked ~ .chq-pub-save-on { display: inline; }

  @media (max-width: 700px) {
    .chq-pub-sessions-layout { grid-template-columns: 1fr; gap: 20px; }
  }

  /* ===== task-w1-i: itinerary label flip on /schedule + /agenda's list row,
     and the session detail-page itinerary control =====
     Owned by task-w1-i; another lane may append its own labelled block
     below this one in the same file.

     The schedule/agenda list row (.chq-pub-itinerary-row, agenda.tsx) now
     renders the SAME shared ItineraryToggle markup as the sessions list's
     Save/Saved pill (.chq-pub-save-off/-on spans, cards.tsx), but keeps its
     own row layout instead of the pill's box/border. These rules key off
     .chq-pub-itinerary-row specifically so the pill's box styling above
     isn't dragged along onto the row. */
  .chq-pub-itinerary-row .chq-pub-save-on { display: none; }
  .chq-pub-itinerary-row input.chq-itinerary-toggle:checked ~ .chq-pub-save-off { display: none; }
  .chq-pub-itinerary-row input.chq-itinerary-toggle:checked ~ .chq-pub-save-on { display: inline; }

  /* Session detail page's itinerary control reuses the sessions list's
     Save/Saved pill styling (.chq-pub-save) as-is; this just gives it its
     own top margin so it doesn't crowd the description paragraph above it. */
  .chq-pub-detail-itinerary { margin-top: 12px; }

  /* ===== task-w9-b (DEC-838): per-event accent visible on every public/
     embed surface, without moving a default pixel =====
     .chq-pub-accent-link is applied (shell.tsx/sessions.tsx/speakers.tsx/
     detail.tsx) to a handful of plain <a> elements -- "Show more"
     (sessions/speakers/gallery) and the drill-in "Back to <surface>" link
     (session/speaker detail) -- that carried NO class and NO explicit
     colour rule before this change, so their rendered colour already came
     from theme.ts's global a-tag colour cascade. Same rationale as
     .chq-pub-day-pill above: default value unchanged (#4E5C31 === #4E5C31),
     only a non-default accentColor becomes visible. */
  .${ACCENT_BOUND_CLASSES[2]} {
    color: var(--chq-brandable-accent);
  }
`;
