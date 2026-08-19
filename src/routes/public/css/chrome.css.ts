// Part of PUBLIC_CSS (DEC-373/DEC-374, see public.css.ts) -- split out by
// the structure custodian (contention decomposition, was 920 lines in one
// file) into cohesive fragments assembled back together in public.css.ts.
// This fragment: page chrome -- the search/filter row, the event header,
// main gutter, and the shared filter-bar/pill controls.
//
// CHROME_CSS is a fixed, value-free module constant, exactly like the
// PUBLIC_CSS it composes into (DEC-374) -- never interpolated with
// request/user data.
export const CHROME_CSS = `
  /* DEC-253: mobile bar (390x844) -- nav/filter/submit controls stay
     reachable and tap-target-sized, and wrap instead of overflowing.
     Unquoted attribute selectors: dangerouslySetInnerHTML writes this
     string to the DOM verbatim, so quoting would be safe here too, but we
     keep the unquoted convention from THEME_CSS/shell.tsx for consistency
     across every SSR surface stylesheet. */
  /* DEC-919 amendment (wave 40; corrected wave 74): a .chq-visually-hidden
     element is off-screen but still in the a11y tree and still
     reachable/focusable -- used for PublicSearchBox's label (its submit
     button has been a real, visible, clickable button since wave 69, never
     visually-hidden -- a pointer must be able to hit it directly) and for
     the auto-submitting select forms' labels/submit buttons (PublicFilterSelectForm,
     agenda-controls.tsx), which must announce themselves to assistive tech
     and keep the form usable without JS while never drawing a visible
     label/button next to the select -- their onchange="this.form.submit()"
     is the visible/pointer-reachable path (DEC-919's hidden-submit
     exemption).
     DEC-919 amendment (wave 59): the old recipe (position:absolute with no
     offset) keeps its STATIC in-flow position -- for the search submit that
     landed it one pixel inside #chq-pub-search-q's right edge, intercepting
     every pointer aimed at the input. left:-9999px + top:auto is the
     standard off-screen recipe: it removes the element from the visible
     viewport entirely (never over or under a visible control) while
     leaving it in the a11y tree and focusable (unlike display:none/
     visibility:hidden, which drop it from both). */
  .chq-visually-hidden {
    position: absolute;
    left: -9999px;
    top: auto;
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
     first, then every PublicFilterBar pill nav for that surface, inline.
     task-w5-a: with .chq-pub-search/.chq-pub-select's fixed widths above,
     the row's worst case (all five controls) fits in one row at <= 820, so
     wrapping is now a <=700px-only fallback (below) rather than the
     unconditional default -- ONE row at 820, per docs/design/README.md
     "Public filter bar -- one idiom, four surfaces". */
  .chq-pub-filter-row {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--chq-rule);
    padding-bottom: 14px;
    margin-bottom: 14px;
  }
  @media (max-width: 700px) {
    .chq-pub-filter-row {
      flex-wrap: wrap;
    }
  }
  .chq-pub-searchform {
    display: flex;
    align-items: center;
  }
  /* v7 active-filter line: renders only when a filter is set — count,
     one removable chip per active filter, Clear. Zero height at rest. */
  .chq-pub-activefilters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: -4px 0 14px;
    font-size: 13px;
  }
  .chq-pub-activefilters-count {
    color: var(--chq-muted);
  }
  /* DEC-919 amendment (wave 4, task-w4-f): the active-filter chip is the
     SELECTED treatment (docs/design's public+portal frame pack, line 61)
     -- ink fill, paper text, its remove glyph muted-on-ink -- not an
     outlined chip on the surface tint the filter-bar controls use.
     (This comment ships inside the inlined <style>; test/root.test.ts
     forbids the product name above the footer, so the pack is cited the
     way every other rule in this file cites docs/design.) */
  .chq-pub-activefilters-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: var(--chq-r-pill);
    background: var(--chq-ink);
    padding: 6px 13px;
    font-size: 13px;
    font-weight: 600;
    color: var(--chq-paper);
    text-decoration: none;
  }
  .chq-pub-activefilters-chip span {
    color: var(--chq-on-ink-muted);
  }
  .chq-pub-activefilters-clear {
    font-weight: 700;
  }
  /* task-w5-a (docs/design/README.md "Public filter bar -- one idiom, four
     surfaces"): the filter row holds ONE row at 820. Gate-4 measured 837 of
     control widths at rest (search 259 + day 131 + track 149 + format 153 +
     room 105, + 4 * 10px gaps) -- 17px over. Both this box and .chq-pub-
     select below now declare a fixed width instead of sizing to content, so
     the row's worst case (all five controls present) sums to
     190 + 4*140 + 40 = 790, under 820 with margin.
     DEC-919 amendment (wave 69): .chq-pub-search narrowed 190px -> 150px to
     make room for the now-visible .chq-pub-search-submit button (40px)
     butted to its right edge -- the pair still spends exactly the 190px
     this budget already allotted, so the 790 total above (and the 820
     one-row ceiling) is unchanged. */
  /* DEC-919 amendment (wave 4, task-w4-f): the filter-bar controls (search
     input + every .chq-pub-select) share ONE control vocabulary with the
     rest of the frame -- var(--chq-r-ctl) radius, 1px var(--chq-border),
     var(--chq-surface) fill -- never the pill radius, which is reserved for
     the SELECTED state (.chq-pub-activefilters-chip below). */
  .chq-pub-search {
    width: 150px;
    height: 40px;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-ctl);
    background-color: var(--chq-surface);
    padding: 0 14px;
    font-size: 13px;
    color: var(--chq-ink);
  }

  /* DEC-919 amendment (wave 69): PublicSearchBox's submit is a real,
     clickable control now (see filters.tsx) -- butted flush to
     .chq-pub-search's right edge with no left border (one continuous seam,
     not two boxes with a gap), sharing the same 1px var(--chq-border) /
     var(--chq-r-ctl) / var(--chq-surface) vocabulary as every other filter
     control but rounding only the RIGHT corners (the input owns the left
     corners). The theme-wide button[type=submit]:not([class*="chq-btn-"])
     rule (theme.ts) would otherwise paint this brand-filled with square
     corners and a left border seam -- this selector matches its
     specificity (element + attribute + class) and wins on source order
     (PUBLIC_CSS is inlined after THEME_CSS, see shell.tsx) to override it.
     B8: colour-only hover, no size/border-width/shadow change. */
  button.chq-pub-search-submit[type=submit] {
    width: 40px;
    height: 40px;
    padding: 0;
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--chq-border);
    border-left: none;
    border-radius: 0 var(--chq-r-ctl) var(--chq-r-ctl) 0;
    background-color: var(--chq-surface);
    color: var(--chq-ink);
    transition: background-color var(--chq-motion-color);
  }
  button.chq-pub-search-submit[type=submit]:hover {
    background-color: var(--chq-surface-sunk);
  }
  button.chq-pub-search-submit[type=submit]:active {
    background-color: var(--chq-surface-sunk);
  }
  button.chq-pub-search-submit[type=submit] svg {
    width: 16px;
    height: 16px;
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
  /* task-w5-a: fixed width (was content-sized) -- see .chq-pub-search above
     for the 820 budget this and the search box together fit inside. */
  .chq-pub-select {
    width: 140px;
    height: 40px;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-ctl);
    /* right padding clears theme.ts's data-URI chevron (12px box + 12px
       inset); background-COLOR, never the shorthand -- the background shorthand resets
       background-image and silently erases the shared select caret (the
       exact bug this comment now guards against). */
    padding: 0 34px 0 10px;
    font-size: 13px;
    color: var(--chq-ink);
    background-color: var(--chq-surface);
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

  main.chq-pub-main { padding: 26px var(--chq-pub-main-pad-x) 34px; }
  /* DEC-683 amendment (wave 1, task w1-a): main.chq-pub-main is both the
     padded ancestor AND (via .chq-measure-wide) the element the 1180
     max-width clamps -- box-sizing:border-box would otherwise eat
     --chq-pub-main-pad-x's left+right padding out of that 1180, landing
     the content column at 1112 instead of the PUBLIC PAIR's 820+60+300.
     This overrides theme.ts's plain .chq-measure-wide rule (same
     specificity tier, later in cascade -- PUBLIC_CSS is inlined after
     THEME_CSS, see shell.tsx's BaseStyles) by adding the padding back via
     the SAME token that declares it, never a vw/cqw guess. */
  main.chq-pub-main.chq-measure-wide {
    max-width: calc(var(--chq-measure-wide) + (var(--chq-pub-main-pad-x) * 2));
  }

  /* B8 (DESIGN-RULINGS, DEC-808 wave-99 amendment): the search submit
     button above transitions background-color via var(--chq-motion-color).
     THEME_CSS's :root already re-binds --chq-motion-color to 0ms under
     prefers-reduced-motion (theme.ts:705-711) and is inlined ahead of this
     sheet on every page (shell.tsx), so the token itself is already
     reduced -- this local re-bind is the belt-and-suspenders form every
     sheet with its own transition carries (mirrors home.css.ts:89-95),
     kept independent of load order so this fragment stays correct even if
     it is ever inlined standalone. */
  @media (prefers-reduced-motion: reduce) {
    button.chq-pub-search-submit[type=submit] {
      transition-duration: 0ms;
    }
  }
`;
