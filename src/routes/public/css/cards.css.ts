// Part of PUBLIC_CSS (DEC-373/DEC-374, see public.css.ts) -- split out by
// the structure custodian (contention decomposition). This fragment: the
// sessions list row, track/format chip anatomy, and the speaker
// directory's List/Grid view toggle + list/grid anatomies.
//
// CARDS_CSS is a fixed, value-free module constant, exactly like the
// PUBLIC_CSS it composes into (DEC-374) -- never interpolated with
// request/user data.
//
// GOTCHA: PUBLIC_CSS is inlined verbatim into GET /'s <style> (root.tsx),
// and test/root.test.ts asserts that everything above .chq-home-footer
// never spells the product name -- only the GitHub attribution footer may.
// COMMENTS SHIP. Cite design docs as docs/design's "<sheet>" sheet rather
// than by their product-name-bearing filename.
export const CARDS_CSS = `  /* Session rows (sessions.tsx SessionCard). */
  .chq-pub-session-row {
    display: grid;
    /* w4-g (DEC-534 amendment): the time-over-room stack draws two lines
       (start time, then room) per docs/design's "Public and Portal" sheet
       (.dc.html:67 \`grid-template-columns:126px 1fr auto\`), at a single
       shared gutter measure -- see
       --chq-pub-when-gutter (declared once in app/src/styles.css /
       src/views/theme.ts, also consumed by .chq-pub-schedule-row in
       rail.css.ts so the two renderings of one stack can't drift). */
    grid-template-columns: var(--chq-pub-when-gutter) 1fr auto;
    gap: 22px;
    align-items: baseline;
    padding: 20px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  /* DEC-698: the /embed field toggles can drop the time field entirely --
     the row then carries no .chq-pub-session-when cell at all, so the
     --chq-pub-when-gutter column must not exist either or the body lands
     in it and wraps word-per-word. */
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
  /* DEC-968 (wave 8 amendment, EMB-01/EMB-09): one <span> line per speaker,
     name plus an optional muted identity clause -- no new size/weight token,
     the frame's 14px/ink-2 speaker-line rule above stays untouched. */
  .chq-pub-speaker-line { display: block; }
  .chq-pub-speaker-identity { color: var(--chq-muted); }
  /* w1-c (DEC-534): the day heading rendered before the first card of each
     scheduled day once the gutter drops the day (sessions.tsx). */
  .chq-pub-sessions-day-heading {
    font-family: var(--chq-font-display);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--chq-ink);
    margin: 28px 0 4px;
  }
  .chq-pub-sessions-day-heading:first-child { margin-top: 0; }
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
    /* G13 (frames 10--10/11, MAJOR): the frame draws the control-radius
       box (~5px), not a pill, at the toolbar's 40px control height with
       the active segment filled to full height. */
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-ctl);
    overflow: hidden;
  }
  .chq-pub-view-toggle-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    min-height: 42px;
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
     76px square headshot (card-radius, matching the grid tile) | name +
     role/company | that speaker's session titles pinned to a 280px
     right-hand column, one hairline rule per row. */
  .chq-pub-speaker-list { list-style: none; margin: 0; padding: 0; }
  .chq-pub-speaker-list-row {
    display: grid;
    grid-template-columns: 76px 1fr 280px;
    gap: 20px;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-pub-speaker-list-photo { width: 76px; }
  .chq-pub-speaker-list-photo img,
  .chq-pub-speaker-list-photo .chq-pub-headshot-fallback {
    width: 76px;
    height: 76px;
    aspect-ratio: 1/1;
    object-fit: cover;
    border-radius: var(--chq-r-card);
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

  /* G13 (frames 10--10/11, MINOR): the headshot link must not propagate the
     UA underline onto a photo-less card's initials monogram -- the frame
     draws the placeholder with no underline. */
  .chq-pub-headshot-link { text-decoration: none; }

  /* w9-b: SpeakerDetailContent's headshot/fallback box (detail.tsx) -- the
     shared .chq-pub-headshot-fallback rule above already supplies
     aspect-ratio/border-radius/centering, so this rule only fixes the
     width both the <img> and the fallback <div> share, replacing the old
     inline style="width:160px" that only applied to the fallback branch. */
  .chq-pub-detail-headshot { width: 160px; }

  /* w8-h (DEC-989 wave-90 amendment): 390-overflow sweep, budget 358px
     (390 minus .chq-main's 16px phone gutter on each side, src/views/
     theme.ts). .chq-pub-speaker-list-row's three fixed tracks (76px photo +
     280px sessions column = 356px) plus its two 20px gaps (40px) total
     396px -- over budget with no fluid track to absorb it. DEC-919: a 390
     frame re-lines, it never removes -- the sessions list keeps its content
     and moves to its own full-width row below the photo/info pair instead
     of claiming a fixed 280px column that can't fit. Appended at the true
     end of this module, after every top-level rule, per DEC-385
     single-direction responsive. */
  /* DEC-385 wave-102 amendment: this sheet's earlier ≤700px block (DEC-367
     wave-50, the List | Grid toggle's phone tap floor) is consolidated
     HERE, in ascending source order, ahead of the w8-h overflow-sweep
     rules that already lived in this terminal block -- a non-terminal
     phone block can be silently shadowed by a later desktop rule
     (phone-terminal-block.scan.test.ts). No selector/declaration/value is
     reordered, reworded or deduped; .chq-pub-view-toggle-option does not
     recur below, so no collapse is needed. */
  @media (max-width: 700px) {
    .chq-pub-view-toggle-option { min-height: 44px; }
    .chq-pub-speaker-list-row {
      grid-template-columns: 76px 1fr;
      row-gap: 8px;
    }
    .chq-pub-speaker-list-row .chq-pub-speaker-sessions {
      grid-column: 1 / -1;
    }
  }
`;
