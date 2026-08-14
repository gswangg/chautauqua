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

import { DEC_367, DEC_373, DEC_374, DEC_838, DEC_851 } from "../../decisions";

void DEC_367;
void DEC_373;
void DEC_374;
void DEC_838;
void DEC_851;

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
  /* DEC-919 amendment (wave 40): a .chq-visually-hidden element is off-
     screen but still in the a11y tree and still reachable/focusable -- used
     for PublicSearchBox's label and submit button, which must announce
     themselves to assistive tech and keep the form usable without JS while
     never drawing a visible label/button next to the compact input. */
  .chq-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* DEC-919 amendment (wave 40): the ONE row every public list surface
     stacks its narrowing controls into -- PublicSearchBox's compact input
     first, then every PublicFilterBar pill nav for that surface, inline,
     wrapping instead of three separately ruled rows. */
  .chq-pub-filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--chq-rule);
    padding-bottom: 14px;
    margin-bottom: 14px;
  }
  .chq-pub-filter-row .chq-pub-filter-bar {
    border-bottom: none;
    padding-bottom: 0;
  }
  .chq-pub-searchform {
    display: flex;
    align-items: center;
  }
  .chq-pub-search {
    width: 259px;
    height: 40px;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-pill);
    padding: 0 14px;
    font-size: 13px;
    color: var(--chq-ink);
  }

  /* DEC-990 amendment (wave 64): the speakers surface's ONE facet -- a
     quiet 'All tracks' select on the title row. Minimal styling only;
     w64-b's shared PublicFilterSelects component is expected to supersede
     this rule set (same class names) once it lands. */
  .chq-pub-select-form {
    display: flex;
    align-items: center;
  }
  /* DEC-851 (wave 64 amendment): the agenda/schedule control row's track
     control -- a real select element (the shared .chq-pub-select rule just
     below) plus a Clear link shown only while a track is selected,
     replacing the pill-bar track filter these two surfaces used to render
     (track is a highlight on these surfaces now, never a filter -- see the
     DEC-851 amendment). */
  .chq-pub-track-highlight {
    display: inline-flex;
    align-items: center;
  }
  .chq-pub-select {
    height: 40px;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-ctl);
    padding: 0 10px;
    font-size: 13px;
    color: var(--chq-ink);
    background: var(--chq-surface);
  }
  .chq-pub-select-clear {
    font-size: 13px;
    font-weight: 600;
    color: var(--chq-ink-2);
    text-decoration: underline;
    margin-left: 8px;
  }

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
    line-height: 1.2;
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
  /* DEC-968: the sessions-list row's track/format meta line separates its two
     clauses with a small dot, never rendered when either clause is absent. */
  .chq-pub-session-tag-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--chq-border); }
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
  /* ===== task-w40-f (DEC-990 Amendment, wave 40): List/Grid are two
     anatomies, not one grid with a modifier =====
     Title row: h1 left, the joined List/Grid toggle right-flushed beside
     it; PublicSearchBox renders immediately below (task-w40-e owns the
     search box's own internals, not this row). */
  .chq-pub-title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }
  .chq-pub-title-row .chq-pub-surface-title { margin-bottom: 0; }

  /* Joined segmented control (replaces the two-separate-pills toggle DEC-990
     shipped wave 37): one bordered wrapper, two halves sharing the middle
     border, the active half filled --chq-ink with --chq-paper text. */
  .chq-pub-view-toggle {
    display: inline-flex;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-pill);
    overflow: hidden;
  }
  .chq-pub-view-toggle-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--chq-ink-2);
    text-decoration: none;
  }
  .chq-pub-view-toggle-option + .chq-pub-view-toggle-option {
    border-left: 1px solid var(--chq-border);
  }
  .chq-pub-view-toggle-option[aria-current=page] {
    background: var(--chq-ink);
    color: var(--chq-paper);
    font-weight: 600;
  }

  /* List view (SpeakersContent/SpeakerListRow): a ruled list, not a grid --
     ~80px rounded headshot | name + role/company | that speaker's session
     titles in a right-hand column, one hairline rule per row. */
  .chq-pub-speaker-list { list-style: none; margin: 0; padding: 0; }
  .chq-pub-speaker-list-row {
    display: grid;
    grid-template-columns: 80px 1fr 1fr;
    gap: 20px;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-pub-speaker-list-photo { width: 80px; }
  .chq-pub-speaker-list-photo img,
  .chq-pub-speaker-list-photo .chq-pub-headshot-fallback {
    width: 80px;
    height: 80px;
    aspect-ratio: 1/1;
    object-fit: cover;
    border-radius: 50%;
    background: var(--chq-surface-sunk);
  }
  .chq-pub-speaker-list-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .chq-pub-speaker-list-row .chq-pub-speaker-sessions {
    font-size: 13px;
    line-height: 1.45;
    margin: 0;
    padding-left: 1.1em;
    color: var(--chq-ink-2);
  }

  /* Grid view (GalleryContent/SpeakerGridTile). DEC-885/DEC-385: this
     codebase is single-direction (narrow overrides wide via max-width only,
     never min-width -- see test/breakpoint-conformance.test.ts) so the WIDE
     desktop frame is the unprefixed default -- six ~184px square tiles,
     COUNTED rather than left to an auto-fill floor -- and the two max-width
     blocks below narrow it down for the 900px/700px steps. */
  .chq-pub-speaker-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .chq-pub-speaker-card { display: flex; flex-direction: column; gap: 9px; }
  .chq-pub-speaker-grid img, .chq-pub-headshot-fallback {
    width: 100%;
    aspect-ratio: 1/1;
    object-fit: cover;
    border-radius: var(--chq-r-card);
    background: var(--chq-surface-sunk);
  }
  /* DEC-885: an absent headshot is a DRAWN placeholder, not an empty sunk
     box that reads as a broken image -- a repeating hatch built from the
     existing hairline/surface-sunk tokens, with the speaker's initials
     (speakers.tsx SpeakerCard fallback branch, via cards.tsx's
     speakerInitials) centered on top. Same aspect-ratio/border-radius as
     the shared rule above; this rule only overrides background + adds the
     centering/typography for the initials text node. */
  .chq-pub-headshot-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: repeating-linear-gradient(
      45deg,
      var(--chq-surface-sunk),
      var(--chq-surface-sunk) 8px,
      var(--chq-hairline) 8px,
      var(--chq-hairline) 9px
    );
    color: var(--chq-muted);
    font-family: var(--chq-font-display);
    font-weight: 600;
    font-size: 1.3rem;
    letter-spacing: 0.02em;
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

  /* Agenda day (DEC-584 wave-64 amendment): a time-row SEQUENCE, not a
     room-lane matrix -- one row per distinct start minute, an 88px time
     cell beside a wrapping blocks container. No horizontal scroll is
     needed anymore (no room columns to overflow), but the scroll
     container is kept as a harmless no-op wrapper so a future wide-row
     addition (e.g. a spanning break rule) has somewhere to sit without
     widening the page. */
  .chq-pub-agenda-day-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 1.5rem; }
  .chq-pub-agenda-day { display: flex; flex-direction: column; gap: 18px; margin-bottom: 0; }
  /* DEC-584 (wave 64): one row = a fixed-width time cell + a wrapping
     blocks container. align-items: flex-start keeps the time label
     pinned to the row's first line even when a row's blocks wrap to
     several lines of cards. */
  .chq-pub-agenda-day-row {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-pub-agenda-day-time {
    flex: 0 0 88px;
    width: 88px;
    padding-top: 2px;
    font-family: var(--chq-font-display);
    font-weight: 700;
    font-size: 14px;
    color: var(--chq-ink);
  }
  /* DEC-584 (wave 64): at public density (<=10 sessions/day over 1-4
     rooms) the blocks sharing a start time wrap into a fluid grid rather
     than reserving a fixed column per room -- most rows have exactly one
     block, which fills the row at 1fr. */
  .chq-pub-agenda-day-blocks {
    flex: 1 1 auto;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(228px, 1fr));
    gap: 8px;
  }
  /* DEC-999: a block is a content-sized card -- column flexbox so
     head/title/speakers/chips stack and the box's own height is the
     content's height. min-width:0 overrides the flex-item default
     min-size:auto, which would otherwise refuse to shrink below its
     content's intrinsic size inside the auto-fit grid track. NO overflow
     clipping, NO -webkit-line-clamp: DEC-768 already established that a
     fixed-height clipped block was the bug, not the fix. Lane geometry
     (DEC-999's original --chq-lane/--chq-lane-count custom properties) is
     gone with the room-lane matrix (wave 64) -- the block is always full
     width of its own grid cell now. */
  .${ACCENT_BOUND_CLASSES[0]} {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-width: 0;
    box-sizing: border-box;
    width: 100%;
    background: var(--chq-surface);
    border-left: 3px solid var(--chq-brandable-accent);
    border-radius: var(--chq-r-card);
    padding: 0.5rem 0.7rem;
    font-size: 0.85rem;
  }
  /* DEC-584 (wave 64): the block's top row -- the room eyebrow label left,
     the Save/Saved toggle right -- needs the full card width to split the
     two ends, unlike the column flexbox's content-hugging default. */
  .chq-pub-agenda-block-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
  }
  /* DEC-584 (wave 64): room becomes an eyebrow LABEL on the block, never a
     column header -- small-caps treatment matching the phone list's own
     room text (.chq-pub-agenda-list-room) so the two markups read
     consistently. */
  .chq-pub-agenda-block-room {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chq-muted);
  }
  /* DEC-999 Amendment (wave 53, kept wave 64): the track-chip/format-chip
     trio share one flex-wrap row instead of each occupying their own line
     in the column flexbox above -- align-items: flex-start on the block
     itself is what stops the inline-flex chip children being stretched
     full-width by the block's own column-flex default (stretch). This is
     also what keeps TrackChips/FormatChip INLINE pills inside a block
     (closing the 622px full-width-strip finding) rather than each chip
     computing its own full-row width. */
  .chq-pub-agenda-block-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  /* DEC-022 amendment (wave 63): a break is a spanning QUIET row -- lower
     visual weight than a session block (no left accent border, muted
     surface), small-caps-style label via text-transform so 'Lunch · Foyer
     · 60 min' reads as 'LUNCH · FOYER · 60 MIN' the way docs/design's copy
     shape specifies, without duplicating the wording in uppercase at the
     source (agenda.tsx keeps the natural-case DOM text). In the desktop
     day (a column flexbox since DEC-584's wave-64 time-row sequence) it is
     a full-width row of its own, sequenced by start time between the
     session rows and needing no inline geometry to span (the wave-63 room-
     lane grid said the same thing as grid-column:1/-1); in the list it is a plain
     <li> among session rows (reusing .chq-pub-agenda-list's ol, never
     .chq-pub-agenda-list-item's card layout -- a break has no title link,
     speakers or itinerary toggle). */
  .chq-pub-agenda-break {
    display: block;
    padding: 8px 0;
    border-bottom: 1px solid var(--chq-hairline);
    color: var(--chq-muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
  }
  /* Desktop grid context (a <div> grid item, not a list <li>) overrides the
     list-row look above -- centered inside its full-width spanning row. */
  .chq-pub-agenda-day .chq-pub-agenda-break {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    background: var(--chq-surface-sunk);
    border-bottom: none;
    font-size: 11px;
    padding: 2px 6px;
  }
  /* DEC-851 (wave 64 amendment): track is a HIGHLIGHT on the grid, never a
     filter -- every block above still renders (the grid never reflows) and
     already carries the default 3px olive (--chq-brandable-accent) left
     edge from .chq-pub-agenda-block above. A block whose session does
     NOT match the highlighted track instead gets this ONE extra class
     (applied to the same element that already carries
     .chq-pub-agenda-block) -- lighter card, lighter border, muted
     ink -- so the matching subset visually reads as "kept" rather than
     needing its own separate highlight rule. The Save/Saved control inside
     a muted block is never dimmed or disabled by this rule (it carries no
     opacity/pointer-events, only colour). */
  .chq-pub-agenda-block-muted {
    background: var(--chq-paper);
    border-left-color: var(--chq-border);
    color: var(--chq-muted);
  }
  .chq-pub-agenda-block-muted .chq-pub-agenda-block-title a,
  .chq-pub-agenda-block-muted .chq-pub-agenda-block-speakers {
    color: var(--chq-muted);
  }
  /* Track chip on a MATCHING (non-muted) block, once the block markup
     names the matching chip -- filled olive instead of ink-on-surface. */
  .chq-pub-track-chip-inverted {
    color: var(--chq-on-brand);
    background: var(--chq-brandable-accent);
    border-color: var(--chq-brandable-accent);
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
  /* DEC-783/DEC-970: the per-start-time sub-header rendered above a group
     of rows that share a start time (AgendaItemList's groupByStart) --
     was previously rendering with no declared style at all. */
  .chq-pub-schedule-time-subhead {
    font-family: var(--chq-font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--chq-muted);
    padding: 10px 0 2px;
    list-style: none;
  }

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
  /* DEC-885: the day pill in view carries aria-current="page" (agenda.tsx
     DaySwitcher) on BOTH the default and the day-filtered view -- this is
     the paired visual treatment so the "current" day reads as chosen, not
     just accessibly marked. */
  .chq-pub-day-pill-active {
    background: var(--chq-brandable-accent);
    color: var(--chq-on-brand);
    border-color: var(--chq-brandable-accent);
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

  /* DEC-885/DEC-385: the 900px sanctioned intermediate breakpoint --
     max-width only, this codebase is single-direction. Below 900px there
     isn't room for 3 fixed columns to stay legible, so this narrows the
     desktop default (repeat(3, 1fr), set above) back down to the
     auto-fill floor the phone rule at 700px further narrows again. This
     block sits ahead of the 700px block below so the (later, more
     specific to width) 700px override still wins there. */
  @media (max-width: 900px) {
    .chq-pub-speaker-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  }

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
    .chq-pub-itinerary-cta { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
    .chq-pub-agenda-day-scroll { max-width: 100%; }

    /* DEC-584: exactly one of the two agenda markups is in the a11y tree
       at a time -- the desktop room-grid wrapper hides below 700px and the
       phone list takes over. */
    .chq-pub-agenda-desktop { display: none; }
    .chq-pub-agenda-list { display: block; }
  }

  /* DEC-990 Amendment (wave 40): the grid view is six COUNTED ~184px square
     tiles at the WIDE desktop measure (repeat(6, 1fr) + 16px gaps is
     ~1180, matching the 'wide' measure class shell.tsx now assigns this
     surface) -- reusing .chq-pub-speaker-grid/-card for the shared
     headshot/name/role markup (DEC-593), only the column count/caption
     type scale differ. Narrower steps fall back to an auto-fill floor,
     same idiom as .chq-pub-speaker-grid's own 900px/700px overrides
     above. */
  .chq-pub-gallery-grid { grid-template-columns: repeat(6, 1fr); gap: 16px; }
  /* Caption type scale tuned down from the directory's (DEC-990: names
     stop wrapping to 2-4 lines inside a 184px tile without truncating the
     text). */
  .chq-pub-gallery-grid .chq-pub-speaker-name { font-size: 13px; line-height: 1.25; }
  .chq-pub-gallery-grid .chq-pub-speaker-role { font-size: 11px; line-height: 1.3; }

  @media (max-width: 900px) {
    .chq-pub-gallery-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  }
  @media (max-width: 700px) {
    .chq-pub-gallery-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
    .chq-pub-speaker-list-row {
      grid-template-columns: 64px 1fr;
      grid-template-areas: "photo info" "sessions sessions";
    }
    .chq-pub-speaker-list-photo { grid-area: photo; width: 64px; }
    .chq-pub-speaker-list-photo img,
    .chq-pub-speaker-list-photo .chq-pub-headshot-fallback { width: 64px; height: 64px; }
    .chq-pub-speaker-list-info { grid-area: info; }
    .chq-pub-speaker-list-row .chq-pub-speaker-sessions { grid-area: sessions; padding-left: 84px; }
  }

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

  /* DEC-768: a block used to be clipped to a fixed 22px * spanCount grid-row
     span (overflow:hidden + line-clamp:2), so a 15-minute session's
     title/speakers routinely clipped away entirely. The block is now a
     content-sized card (DEC-584 wave 64) so it grows to its content
     instead of clipping it -- no fixed height, no overflow:hidden, title
     wraps in full (mirrors app/src/pages/agenda/
     DayGrid.tsx's DEC-742 merged-card treatment). DEC-584 (wave 64) now DOES put an interactive
     control (the Save/Saved ItineraryToggle) inside the block's head row
     -- the prior "never" here was the room-lane matrix's own constraint,
     superseded by the amendment. */
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
  /* DEC-683 amendment (wave 65): the printable programme's one rail link --
     same weight/alignment as the CFP link above (both are the rail's
     "leave this page for that one" affordances), kept visibly underlined so
     it does not read as body copy in a section of plain day rows. */
  .chq-pub-rail-programme-link {
    font-size: 14px;
    font-weight: 700;
    color: var(--chq-ink);
    align-self: flex-start;
    margin-top: 14px;
  }

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

  /* ===== task-w27-a (DEC-952): public event surfaces name themselves =====
     No element-level h1/h2/h3 rule exists anywhere in this file, so
     promoting the top-of-content heading on each surface up a level (and
     stepping the level below it down one) would otherwise resize the
     page. These two classes pin the same sizes the former headings
     already rendered at (the browser UA default for those tags), so the
     tag change is invisible. */
  .chq-pub-surface-title {
    font-family: var(--chq-font-display);
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin: 0 0 18px;
  }
  .chq-pub-section-title {
    font-family: var(--chq-font-display);
    font-size: 19px;
    font-weight: 700;
    margin: 0 0 10px;
  }

  /* ===== task-w67-d (DEC-683 amendment): agenda's own list + rail pair =====
     Same two-column idiom as .chq-pub-sessions-layout/-list/-rail above
     (list, then a 300px <aside>, single column below 700px) -- an
     agenda-named twin rather than reusing the sessions classes directly,
     since .chq-pub-agenda-list wraps the search form + day switcher + day
     sections, not a list of cards. .chq-pub-agenda-rail reuses every
     .chq-pub-rail-* section/heading/body rule already defined above (no
     new rules needed there -- AgendaRail's markup emits the same classes
     ScheduleRailSection/DayIndexRailSection do). */
  .chq-pub-agenda-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 34px;
    align-items: start;
  }
  .chq-pub-agenda-rail { display: flex; flex-direction: column; gap: 26px; }
  @media (max-width: 700px) {
    .chq-pub-agenda-layout { grid-template-columns: 1fr; gap: 20px; }
  }
`;
