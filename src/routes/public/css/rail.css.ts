// Part of PUBLIC_CSS (DEC-373/DEC-374, see public.css.ts) -- split out by
// the structure custodian (contention decomposition). This fragment: the
// task-w4-a/-w14-d/-w1-i/-w9-b/-w27-a append tail -- block title wrapping,
// the /schedule item list + picks toggle, the sessions-list rail (DEC-683),
// the Save/Saved pill + its itinerary-row variant, the accent-bound
// "Show more"/"Back to" link (DEC-838), the surface/section title
// classes (DEC-952), and the agenda's list+rail column pair (DEC-683
// amendment, task-w67-d). Carries a trailing newline (matches the original
// single-literal PUBLIC_CSS's own trailing newline before its closing
// backtick) so the assembled PUBLIC_CSS in public.css.ts stays
// byte-identical to its pre-decomposition value.
//
// RAIL_CSS is a fixed, value-free module constant, exactly like the
// PUBLIC_CSS it composes into (DEC-374) -- never interpolated with
// request/user data. .chq-pub-accent-link is accent-bound (DEC-838) --
// ACCENT_BOUND_CLASSES is imported rather than re-declared so this fragment
// and css/agenda.css.ts share one source array.
import { ACCENT_BOUND_CLASSES } from "./accent-classes";

export const RAIL_CSS = `  /* ===== task-w4-a (DEC-602): agenda geometry + /schedule itinerary list =====
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
  /* G13 fix (frame 10--01, BROKEN): the card title carried NO typographic
     treatment -- it inherited the block's 13.6px body size and the UA's
     link underline, so title and speaker line were indistinguishable. The
     frame draws the title in the display face, ink, no underline, visibly
     larger than the speaker line -- same register the phone agenda list's
     own title already uses (.chq-pub-agenda-list-title, agenda.css.ts). */
  .chq-pub-agenda-block-title {
    font-family: var(--chq-font-display);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }
  .chq-pub-agenda-block-title a {
    color: var(--chq-ink);
    text-decoration: none;
  }
  .chq-pub-agenda-block-title a:hover {
    color: var(--chq-ink);
    text-decoration: underline;
  }

  /* DEC-919 (wave 51 amendment): the /schedule saved-sessions empty state
     (#chq-schedule-empty, shown/hidden by ItineraryScript's
     applyScheduleView once localStorage is read) no longer carries its own
     .chq-pub-picks-empty rule -- it now renders the SAME
     .chq-pub-empty-block/.chq-pub-empty-what anatomy as the SSR
     PublicEmptyState, so the one-off class is deleted rather than left
     dead (test/ssr-css-contract.scan.test.ts, DEC-970). */

  /* ===== task-w14-d (DEC-683): sessions list + rail =====
     Two-column grid (list, then a 300px <aside>) above 700px, single column
     below it — same breakpoint the rest of this stylesheet already uses.
     DEC-683 amendment (wave 1, task w1-a): the PUBLIC PAIR contract is
     820 (list) + 60 (gap) + 300 (rail) = 1180 of content -- 1fr already
     resolves to 820 once the 1180-wide ancestor's own padding is cancelled
     (theme.ts/chrome.css.ts), so only the gap moves, 34 -> 60. */
  .chq-pub-sessions-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 60px;
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
  /* DEC-683 amendment (wave 65), restyled G13 (frames 10--01/02): the
     printable programme's one rail link. The frames draw it in the B8
     tertiary register -- olive, NO rest-state underline (underline is the
     hover state) -- beneath the description, not above it. */
  .chq-pub-rail-programme-link {
    font-size: 14px;
    font-weight: 700;
    color: var(--chq-brand);
    text-decoration: none;
    align-self: flex-start;
  }
  .chq-pub-rail-programme-link:hover {
    text-decoration: underline;
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

  /* DEC-782 Amendment (wave 26, DESIGN-RULINGS A26): the session detail
     page's itinerary control now sits in the header beside the title
     (.chq-pub-detail-header), not under the description -- placement only,
     same ItineraryToggle markup/pill styling (.chq-pub-save) as before. */
  .chq-pub-detail-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .chq-pub-detail-header .chq-pub-surface-title { margin-bottom: 0; }
  .chq-pub-detail-itinerary { flex-shrink: 0; }

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
  /* task-w49-h (DEC-990 amendment): promoted to the shared public
     page-title register -- docs/design/README.md's typography table states
     exactly two customer-facing h1 registers (page title 36px/700/-0.04em
     desktop, 25-27px/phone; overview headline 44px, untouched here). This
     class now carries that register for every surface that uses it. */
  .chq-pub-surface-title {
    font-family: var(--chq-font-display);
    font-size: 36px;
    font-weight: 700;
    letter-spacing: -0.04em;
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
     since .chq-pub-agenda-col wraps the search form + day switcher + day
     sections, not a list of cards. (Deliberately NOT .chq-pub-agenda-list:
     that name is already taken by AgendaItemList's phone <ol>, which is
     display:none above 700px.) .chq-pub-agenda-rail reuses every
     .chq-pub-rail-* section/heading/body rule already defined above (no
     new rules needed there -- AgendaRail's markup emits the same classes
     ScheduleRailSection/DayIndexRailSection do).
     DEC-683 amendment (wave 1, task w1-a): same PUBLIC PAIR gap move as
     .chq-pub-sessions-layout above, 34 -> 60. */
  .chq-pub-agenda-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 60px;
    align-items: start;
  }
  .chq-pub-agenda-col { min-width: 0; }
  .chq-pub-agenda-rail { display: flex; flex-direction: column; gap: 26px; }

  /* ===== task-w1-d (DEC-555 amendment): /schedule rebuilt to frame 10--12
     =====
     The same list+rail column pair idiom as .chq-pub-sessions-layout/
     .chq-pub-agenda-layout above (list, then a 300px <aside>, single column
     below 700px) -- named for schedule rather than reused directly since
     the day-group/row shape here is unique to this surface (Remove control,
     clash marker, no search form). Server renders every candidate row
     display:none; ItineraryScript's applyScheduleView (agenda-itinerary-
     script.tsx) is what reveals the saved subset once localStorage is
     read -- see agenda.tsx's ScheduleContent for the load-bearing reason.
     DEC-555 amendment (wave 5, task w5-a): schedule joins the PUBLIC PAIR
     -- same 60px gap as .chq-pub-sessions-layout/.chq-pub-agenda-layout
     above (34 -> 60), since /schedule now shares the WIDE measure
     (shell.tsx's measureClassForSurface) with sessions/agenda/speakers/
     gallery instead of being the one remaining READING column. */
  .chq-pub-schedule-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 60px;
    align-items: start;
  }
  .chq-pub-schedule-col { min-width: 0; }
  .chq-pub-schedule-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    border-bottom: 1px solid var(--chq-hairline);
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .chq-pub-schedule-subtitle { display: block; font-size: 14px; color: var(--chq-ink-2); margin-top: 5px; }
  /* G13 (frame 10--12): B8 tertiary register -- olive at body size, no
     rest-state underline (underline is the hover state). */
  .chq-pub-schedule-browse-link { font-size: 14px; font-weight: 700; color: var(--chq-brand); white-space: nowrap; text-decoration: none; }
  .chq-pub-schedule-browse-link:hover { text-decoration: underline; }
  .chq-pub-schedule-day-group { padding-top: 22px; }
  .chq-pub-schedule-day-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 2px solid var(--chq-ink);
    padding-bottom: 8px;
    font-family: var(--chq-font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  /* G13 (frame 10--12, MAJOR): the day heading is the 11px/700/0.12em caps
     micro-label register -- but the h2 inside it carries
     .chq-pub-section-title (19px), which overrode the wrapper's size while
     inheriting its 1.32px tracking (0.12em of 11px, not of 19px). The
     heading text must render at the wrapper's own register. */
  .chq-pub-schedule-day-heading .chq-pub-section-title {
    font-size: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    margin: 0;
  }
  .chq-pub-schedule-day-count { font-size: 12px; font-weight: 700; color: var(--chq-muted); text-transform: none; letter-spacing: normal; }
  /* task-w1-d / w4-g (DEC-534 amendment): two-line time/room gutter
     matching the sessions row's own .chq-pub-session-when shape (cards.tsx's
     SessionSchedule) -- shares --chq-pub-when-gutter with
     .chq-pub-session-row in cards.css.ts so the two renderings of one
     stack can't drift. */
  .chq-pub-schedule-row {
    display: grid;
    grid-template-columns: var(--chq-pub-when-gutter) 1fr auto;
    gap: 22px;
    align-items: baseline;
    padding: 18px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-pub-schedule-row-gutter { display: flex; flex-direction: column; gap: 2px; }
  .chq-pub-schedule-row-time { font-family: var(--chq-font-display); font-size: 15px; font-weight: 700; }
  .chq-pub-schedule-row-room { font-size: 12px; color: var(--chq-ink-2); }
  .chq-pub-schedule-row-body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .chq-pub-schedule-row-title {
    font-family: var(--chq-font-display);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--chq-ink);
    /* G13 (frame 10--12): plain ink at rest, no UA underline -- underline
       is the hover state (B8). */
    text-decoration: none;
  }
  .chq-pub-schedule-row-title:hover { text-decoration: underline; }
  .chq-pub-schedule-row-speakers { font-size: 14px; color: var(--chq-ink-2); }
  .chq-pub-schedule-row-clash {
    font-family: var(--chq-font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .chq-pub-schedule-remove {
    font-size: 13px;
    font-weight: 700;
    color: var(--chq-ink-2);
    align-self: center;
    white-space: nowrap;
    cursor: pointer;
  }
  .chq-pub-schedule-remove input.chq-itinerary-toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    margin: 0;
  }
  /* ===== task-w3-y (DEC-745, wave-107 amendment): sessions "Last year"
     aside =====
     docs/design/Chautauqua Public and Portal.dc.html:1167
     \`Public sessions · nothing published\` -- the
     fresh-empty sessions frame's two-column grid: minmax(0, 820px) content
     column + a 300px aside, same 60px gap the sessions-list/-rail pair
     above already uses (DEC-683's "PUBLIC PAIR" contract), centered inside
     the 1268px measure. Frame anatomy for the aside: a rule-heading
     ("Last year", 11px/700/0.12em uppercase, 2px border-bottom -- IDENTICAL
     register to .chq-pub-rail-heading above, not re-declared as a second
     copy of that vocabulary, DEC-613), then one row -- prior event name at
     15px/600, "N sessions" at 12px muted, and a right-flushed
     "Sessions ›" link at 13px/700 that never wraps. */
  .chq-pub-sessions-fresh-layout {
    display: grid;
    grid-template-columns: minmax(0, 820px) 300px;
    gap: 60px;
    align-items: start;
    justify-content: center;
  }
  .chq-pub-lastyear-rail { display: flex; flex-direction: column; gap: 10px; }
  .chq-pub-lastyear-heading {
    border-bottom: 2px solid var(--chq-ink);
    padding-bottom: 8px;
  }
  .chq-pub-lastyear-heading span {
    font-family: var(--chq-font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .chq-pub-lastyear-row {
    padding: 13px 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .chq-pub-lastyear-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .chq-pub-lastyear-name {
    font-family: var(--chq-font-display);
    font-size: 15px;
    font-weight: 600;
  }
  .chq-pub-lastyear-count { font-size: 12px; color: var(--chq-muted); }
  .chq-pub-lastyear-link {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    color: var(--chq-ink);
    text-decoration: none;
  }

  /* DEC-385 (w85 amendment, superseded in shape by wave-102 below): this
     fragment's phone declarations are consolidated into ONE block at the
     true end of the file -- previously .chq-pub-surface-title's 26px
     phone override sat mid-file (after .chq-pub-sessions-layout) and was
     silently beaten by this file's OWN later top-level
     .chq-pub-surface-title rule (font-size 36px, task-w49-h, above): same
     selector, same specificity, later source position wins regardless of
     the earlier rule's @media condition matching. Moving every phone rule
     here (after every top-level rule RAIL_CSS declares) is what makes
     "last in source wins" agree with "narrow overrides wide" again -- the
     DEC-385 w85 finding's exact failure mode, closed for this file the
     same way content.css/comms.css were.

     DEC-385 wave-102 amendment: a second ≤700px block (the wave-7 cascade
     repair immediately below this one, historically) duplicated this
     block's own .chq-pub-surface-title { font-size: 26px; } rule
     byte-for-byte -- same selector, same property, same value. That
     repair block is collapsed into this one (its sole rule discarded as
     a redundant duplicate, named here) so the sheet carries exactly one
     terminal phone block, per phone-terminal-block.scan.test.ts. No other
     selector/declaration/value is reordered, reworded or deduped. */
  @media (max-width: 700px) {
    .chq-pub-sessions-layout { grid-template-columns: 1fr; gap: 20px; }
    /* task-w49-h (DEC-990 amendment): README's page-title phone register
       (25-27px/700/-0.04em) inside the surface's own ≤700px breakpoint.
       DEC-385 wave-102: this rule is what the wave-7 cascade-repair block
       (formerly appended after this one, now collapsed into it) existed
       to re-state -- same selector, same value -- so that duplicate is
       gone rather than kept as a second identical rule. */
    .chq-pub-surface-title { font-size: 26px; }
    /* DEC-367 (wave 50 amendment): the phone tap floor -- the Save/Saved
       pill above sizes to padding on desktop, per docs/design/README.md
       §Controls. */
    .chq-pub-save { min-height: 44px; }
    .chq-pub-agenda-layout { grid-template-columns: 1fr; gap: 20px; }
    .chq-pub-schedule-layout { grid-template-columns: 1fr; gap: 20px; }
    .chq-pub-schedule-row { grid-template-columns: 1fr auto; }
    .chq-pub-schedule-row-gutter { grid-column: 1 / -1; flex-direction: row; gap: 10px; }
    /* docs/design/Chautauqua Public and Portal.dc.html:880
       \`<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Remove</span>\`
       -- /schedule's Remove control is a bordered button at the 44px floor
       on the 390 frame, not the plain text link .chq-pub-schedule-remove
       renders at every other width. Phone-only per DEC-385
       single-direction. */
    .chq-pub-schedule-remove {
      border: 1px solid var(--chq-border);
      /* --chq-r-ctl-phone (theme.ts): the 6px phone control radius. */
      border-radius: var(--chq-r-ctl-phone);
      background: var(--chq-surface-sunk);
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
    }
    /* task-w3-y (DEC-745, wave-107 amendment): DEC-385 single-direction --
       the fresh-empty "Last year" two-column grid collapses to a single
       stacked column at the phone breakpoint, same treatment
       .chq-pub-sessions-layout already gets a few lines above. The row's
       "Sessions ›" link keeps its own text size but grows a 44px tap
       floor (the 44px floor applies to every interactive element on
       phone) via centered-flex + horizontal padding rather than a bare
       min-height, matching .chq-pub-schedule-remove's phone treatment
       above. */
    .chq-pub-sessions-fresh-layout { grid-template-columns: 1fr; gap: 20px; }
    .chq-pub-lastyear-link {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }
  }
`;
