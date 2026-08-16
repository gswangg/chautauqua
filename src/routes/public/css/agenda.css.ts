// Part of PUBLIC_CSS (DEC-373/DEC-374, see public.css.ts) -- split out by
// the structure custodian (contention decomposition). This fragment: the
// agenda day time-row sequence + blocks (DEC-584/DEC-999/DEC-851), the
// phone list markup, the day switcher/heading row/footer, and the
// 900px/700px breakpoint overrides through the gallery grid.
//
// AGENDA_CSS is a fixed, value-free module constant, exactly like the
// PUBLIC_CSS it composes into (DEC-374) -- never interpolated with
// request/user data. Two of its selectors (.chq-pub-agenda-block,
// .chq-pub-day-pill) are accent-bound (DEC-838) -- ACCENT_BOUND_CLASSES is
// imported rather than re-declared so this fragment and css/rail.css.ts share
// one source array.
import { ACCENT_BOUND_CLASSES } from "./accent-classes";

export const AGENDA_CSS = `  /* Agenda day (DEC-584 wave-64 amendment): a time-row SEQUENCE, not a
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
     block, which fills the row at 1fr. DEC-683 amendment (wave 1, task
     w1-a): gap 8 -> 16, matching the PUBLIC PAIR spacing move elsewhere in
     this wave -- still three 228px+ tracks across the 820px list column
     (repeat(auto-fit, minmax(228px, 1fr)) with a 16px gap fits 3 without a
     degenerate 0px track). */
  .chq-pub-agenda-day-blocks {
    flex: 1 1 auto;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(228px, 1fr));
    gap: 16px;
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
    /* DEC-838: this class stays accent-bound (ACCENT_BOUND_CLASSES[0]) --
       the custom property carries the per-event accent forward for
       .chq-pub-agenda-block-highlight below to spend, WITHOUT the base rule
       itself painting a pixel with it (DEC-851 amendment wave 5: the 3px
       olive edge is one of the highlight's three visible consequences and
       must read neutral at rest). The resting edge is a plain 1px hairline
       instead, same token every other quiet card border uses. */
    --chq-agenda-block-accent: var(--chq-brandable-accent);
    border-left: 1px solid var(--chq-hairline);
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
  /* DEC-851 amendment (wave 5): restructured desktop grid context -- the
     break is now its own .chq-pub-agenda-day-row (time gutter cell + band),
     same row shape every session row uses, so the start time lives in the
     SAME time gutter (.chq-pub-agenda-day-time) rather than inside the band
     text. The band itself is a quiet rule, left-aligned (not centered) so
     the label starts flush with the block column every session row's cards
     start at, and grows to fill that column exactly like
     .chq-pub-agenda-day-blocks does. */
  .chq-pub-agenda-break-row .chq-pub-agenda-break {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    /* G13 (frames 10--01/03, MINOR): the frame sets break rows as caps text
       on the page ground -- no surface fill. The row's own hairline (the
       shared .chq-pub-agenda-day-row border) is the only rule drawn. */
    background: none;
    border-bottom: none;
    font-size: 11px;
    padding: 2px 0;
  }
  /* DEC-851 amendment (wave 5): the matching block's own highlight state --
     the 3px olive (--chq-brandable-accent) left edge is spent HERE ONLY,
     never at rest, so choosing a track is what makes an edge appear rather
     than un-hiding one that was already drawn. */
  .chq-pub-agenda-block-highlight {
    border-left: 3px solid var(--chq-agenda-block-accent);
  }
  /* DEC-851 (wave 64 amendment): track is a HIGHLIGHT on the grid, never a
     filter -- every block above still renders (the grid never reflows). A
     block whose session does NOT match the highlighted track gets this ONE
     extra class (applied to the same element that already carries
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

  /* DEC-768 (wave 67 amendment): the agenda's heading row -- the day-named
     h1 at the left, the day switcher right-aligned on the SAME row rather
     than stacked beneath it (docs/design's "Tuesday 12 May · 9 sessions ·
     4 rooms" left, "Tue 12 | Wed 13 | Thu 14" right). Reuses
     .chq-pub-title-row's flex/space-between shape (already shared by the
     speaker directory's List/Grid toggle row); the day switcher itself
     keeps its own horizontal-scroll rule below for the phone width where
     the row wraps. */
  .chq-pub-agenda-heading-row .chq-pub-day-switcher { flex: 0 0 auto; }

  /* DEC-768 (wave 67 amendment): the single-day agenda's footer line --
     "Last session ends HH:MM · <next day> ›" -- a quiet hairline-topped
     hint pointing at the next scheduled day, matching the design handoff's
     footer rule. */
  .chq-pub-agenda-day-footer {
    border-top: 1px solid var(--chq-border);
    margin-top: 16px;
    padding-top: 16px;
    font-size: 13px;
    color: var(--chq-muted);
  }
  .chq-pub-agenda-day-footer a { font-weight: 700; }

  /* w1-b: ONE joined bordered group (~210px) with hairline-divided
     segments -- replaces the former gapped, individually-pill-radiused
     <a> row. overflow-x:auto keeps a >3-day event's extra segments
     reachable by scroll instead of shrinking the group past 210px. */
  .chq-pub-day-switcher {
    display: flex;
    width: 210px;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-card);
  }
  /* DEC-838: the day pill (agenda + schedule's shared DaySwitcher, agenda.tsx)
     was an unclassed-color <a> before this rule -- it rendered at
     var(--chq-brand) purely via theme.ts's global a-tag colour cascade.
     This makes that inherited colour an explicit, per-event-accent-bound
     declaration instead: byte-identical by default (both tokens share the
     #4E5C31 default), customizable once an organizer sets a branding
     accentColor. w1-b: the pill is now one segment of the joined group --
     no per-segment radius, a hairline border-right divides segments
     (last segment's is dropped) instead of the old gap+full-border pill. */
  .${ACCENT_BOUND_CLASSES[1]} {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    /* G13 (frame 10--01, BROKEN): with no vertical padding the segment
       collapsed to the 17px line box and the active fill clipped to the
       cap height. The frame draws ~38px segments with the active one
       filled to full height. */
    min-height: 38px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-right: 1px solid var(--chq-border);
    color: var(--chq-brandable-accent);
    text-decoration: none;
    white-space: nowrap;
  }
  .${ACCENT_BOUND_CLASSES[1]}:last-child { border-right: none; }
  /* DEC-885: the day pill in view carries aria-current="page" (agenda.tsx
     DaySwitcher) on BOTH the default and the day-filtered view -- this is
     the paired visual treatment so the "current" day reads as chosen, not
     just accessibly marked. w1-b: the active segment fills near-black
     (--chq-ink) rather than the accent -- DEC-838 only binds accent where
     the DEFAULT already rendered it, and the default active fill was never
     accent-visible content the organizer owns; the accent binding stays on
     the base .chq-pub-day-pill rule's idle-state text colour above. */
  .chq-pub-day-pill-active {
    background: var(--chq-ink);
    color: var(--chq-on-brand);
    border-color: var(--chq-ink);
  }
  /* DEC-383 (wave-66 amendment): anchor-qualified so it beats theme.ts's
     a:not(.chq-btn):hover (0,2,1 > 0,2,0) -- the fill has no dedicated hover
     token here, so hover simply holds the resting on-brand label on the
     unchanged near-black fill instead of letting the generic rule darken
     the label onto it. */
  a.chq-pub-day-pill-active:hover {
    color: var(--chq-on-brand);
  }

  /* Itinerary (schedule surface, DEC-022 localStorage-driven -- class name
     ".chq-itinerary-toggle" itself is behavior-critical, read by inline JS
     in agenda.tsx's ItineraryScript, and stays unchanged). */
  .chq-pub-itinerary-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  /* G13 (frames 10--00/01/12, MAJOR): Download .ics is the rail's one
     action and the frames draw it as the filled olive PRIMARY at natural
     width (~112x33), not a full-rail-width sunk secondary with a 17px line
     box. align-self keeps it at content width inside the rail's column
     flexbox. Hover re-asserts color (a:hover-proof, B8: fill darkens, the
     label never repaints). */
  .chq-pub-itinerary-cta {
    border: none;
    border-radius: var(--chq-r-ctl);
    background: var(--chq-brand);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    color: var(--chq-on-brand);
  }
  /* Anchor-qualified (a.…) so it outranks theme.ts's generic
     a:not(.chq-btn):hover -- the label must never repaint link-olive on
     the darkening fill (test/on-brand-anchor-hover.scan.test.ts). */
  a.chq-pub-itinerary-cta:hover {
    background: var(--chq-brand-hover);
    color: var(--chq-on-brand);
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
    /* DEC-367 (wave 50 amendment): the phone tap floor -- the day-switcher
       pill and itinerary row size to padding on desktop, per
       docs/design/README.md §Controls. */
    .${ACCENT_BOUND_CLASSES[1]} { min-height: 44px; }
    .chq-pub-itinerary-row { min-height: 44px; }
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

  /* DEC-851 amendment (wave 5): the "Highlight a track" control is one of
     the highlight's three visible consequences -- it inverts dark (near-
     black fill, cream text) whenever a track is set, matching the same
     ink/on-brand pair the day-pill's active state already uses
     (.chq-pub-day-pill-active above), and reads neutral (chrome.css.ts's
     plain .chq-pub-select) at rest. This selector composes AFTER
     chrome.css.ts's base rule in PUBLIC_CSS (public.css.ts concatenates
     CHROME_CSS then AGENDA_CSS), so it wins at equal specificity without
     that file needing a change. */
  .chq-pub-select-active {
    background-color: var(--chq-ink);
    /* Same chevron as theme.ts's shared select rule but stroked in cream
       (%23F4F1E8): the base ink-stroke chevron would vanish on the ink
       fill. background-COLOR above, never the shorthand, so this image
       survives. */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5L6 8l3.5-3.5' fill='none' stroke='%23F4F1E8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    color: var(--chq-on-brand);
    border-color: var(--chq-ink);
  }

  /* DEC-851 amendment (wave 5): track chips inside the agenda surface's own
     blocks/list drop the organizer-colour swatch dot (cards.css.ts's
     .chq-pub-track-chip::before, shared by every OTHER surface's chip) --
     scoped to the agenda block/list context rather than changing the shared
     rule, which every session card and the detail page still render with
     the dot. */
  .chq-pub-agenda-block-meta .chq-pub-track-chip::before,
  .chq-pub-agenda-list-item .chq-pub-track-chip::before {
    display: none;
  }

  /* DEC-851 amendment (wave 5), w1-i: the per-block Save control is an
     uppercase SAVE/SAVED text link, not the sessions list's bordered pill
     (.chq-pub-save, rail.css.ts) -- reuses the exact same shared
     ItineraryToggle markup/behaviour (cards.tsx), only this wrapper class
     and its own scoped :checked flip rules differ, so it doesn't drag the
     pill's box styling into the block head. */
  .chq-pub-agenda-block-save {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--chq-ink-2);
    cursor: pointer;
  }
  .chq-pub-agenda-block-save input.chq-itinerary-toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    margin: 0;
  }
  .chq-pub-agenda-block-save .chq-pub-save-on { display: none; }
  .chq-pub-agenda-block-save input.chq-itinerary-toggle:checked ~ .chq-pub-save-off { display: none; }
  .chq-pub-agenda-block-save input.chq-itinerary-toggle:checked ~ .chq-pub-save-on { display: inline; }

`;
