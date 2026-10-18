// The participant home's styles (Portals frame, flow 6), composed into
// PORTAL_CSS (./portal.css.ts) the way that module composes ERROR_STATES_CSS
// and EMPTY_CSS. Value-free (DEC-374): no request data is ever interpolated.
// No semantic red (DEC-367): overdue and closed are carried by an ink pill
// and the words, never a colour.

export const HOME_CSS = `
  .chq-home-hero { margin: 6px 0 18px; }
  .chq-home-callout {
    border: 1px solid var(--chq-ink);
    border-radius: var(--chq-r-card);
    background: var(--chq-surface-sunk);
    padding: 12px 14px;
    margin: 0 0 20px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }
  .chq-home-callout strong { font-weight: 700; }
  .chq-home-event + .chq-home-event { margin-top: 28px; }
  .chq-home-event-name {
    font-family: var(--chq-font-display);
    font-size: 17px;
    font-weight: 700;
    margin: 0 0 10px;
  }
  .chq-home-grid { display: block; }
  .chq-home-section { margin: 0 0 26px; break-inside: avoid; }
  .chq-home-label {
    font-size: var(--chq-type-section-label-size);
    font-weight: var(--chq-type-section-label-weight);
    letter-spacing: var(--chq-type-section-label-tracking);
    text-transform: uppercase;
    color: var(--chq-muted);
    margin: 0 0 4px;
  }
  .chq-home-title {
    font-family: var(--chq-font-display);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.015em;
    margin: 0;
    line-height: 1.3;
  }
  .chq-home-meta { font-size: 12px; color: var(--chq-muted); margin: 3px 0 0; }
  .chq-home-note { font-size: 12px; color: var(--chq-ink-2); margin: 6px 0 0; line-height: 1.5; }
  .chq-home-rows { border-top: 2px solid var(--chq-ink); margin-top: 10px; }
  .chq-home-rows-first { margin-top: 0; }
  .chq-home-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 0;
    border-bottom: 1px solid var(--chq-hairline);
  }
  .chq-home-row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  /* a row's action (the team's Remove or Withdraw) keeps its word whole
     beside a state tag at 390 */
  .chq-home-row > form { flex-shrink: 0; }
  .chq-home-row > form .chq-btn { white-space: nowrap; }
  .chq-home-row-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--chq-ink);
    text-decoration: none;
  }
  a.chq-home-row-title:hover { text-decoration: underline; }
  .chq-home-row-line { font-size: 12px; color: var(--chq-muted); }
  .chq-home-lock { font-size: 12px; color: var(--chq-ink-2); }
  .chq-home-lock-word {
    font-size: var(--chq-type-micro-size);
    font-weight: 700;
    letter-spacing: var(--chq-type-micro-tracking);
    text-transform: uppercase;
    color: var(--chq-ink);
  }
  .chq-home-state {
    flex-shrink: 0;
    font-size: var(--chq-type-micro-size);
    font-weight: 700;
    letter-spacing: var(--chq-type-micro-tracking);
    text-transform: uppercase;
    color: var(--chq-ink);
    text-align: right;
  }
  .chq-home-row-done .chq-home-state { color: var(--chq-muted); }
  .chq-home-pill {
    flex-shrink: 0;
    font-size: var(--chq-type-micro-size);
    font-weight: 700;
    letter-spacing: var(--chq-type-micro-tracking);
    text-transform: uppercase;
    background: var(--chq-ink);
    color: var(--chq-on-ink);
    border-radius: 3px;
    padding: 3px 7px;
  }
  .chq-home-done { margin: 0; }
  .chq-home-done-summary { display: none; }
  .chq-home-then { font-size: 12px; color: var(--chq-muted); margin: 12px 0 0; }
  .chq-home-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
  .chq-home-actions form { margin: 0; }
  .chq-home-links { margin: 6px 0 0; }
  .chq-home-extras { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .chq-home-title-link { color: inherit; text-decoration: none; }
  .chq-home-title-link:hover { text-decoration: underline; }
  /* profile field permissions (Your profile page) */
  .chq-portal-field-help { font-size: 12px; color: var(--chq-muted); margin: 4px 0 0; line-height: 1.5; }
  .chq-portal-field-lock { font-size: 12px; color: var(--chq-ink-2); margin: 4px 0 0; }
  .chq-input[readonly], .chq-textarea[readonly] { background: var(--chq-surface-sunk); color: var(--chq-ink-2); }

  /* sponsor pages: the session editor beside the package panel */
  .chq-sponsor-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 34px; align-items: start; margin-top: 14px; }
  .chq-sponsor-main { min-width: 0; }
  /* a sponsor page with no package panel (the team) keeps the portal
     measure, filled even when its lines are short */
  .chq-sponsor-single { margin-top: 14px; }
  .chq-portal-shell > .chq-measure:has(.chq-sponsor-single) { width: 100%; box-sizing: border-box; }
  /* the package panel is a card beside the editor (frame: "Your Gold
     package"), rows under a hairline rather than the page's 2px rule */
  .chq-sponsor-panel {
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-card);
    background: var(--chq-surface);
    padding: 16px 16px 4px;
  }
  .chq-sponsor-panel .chq-home-rows { border-top: 1px solid var(--chq-hairline); margin-top: 10px; }
  .chq-sponsor-panel .chq-home-row:last-child { border-bottom: 0; }
  /* a long state word wraps under itself, the way the frame draws it,
     instead of squeezing the slot name */
  .chq-sponsor-panel .chq-home-state { max-width: 110px; }
  .chq-sponsor-slots { border: 0; margin: 12px 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .chq-sponsor-slot {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid var(--chq-border);
    border-radius: var(--chq-r-card);
    padding: 10px 12px;
    cursor: pointer;
  }
  .chq-sponsor-slot-used { color: var(--chq-muted); cursor: default; }
  /* tap-floor-exempt: composition -- this class only ever appears inside its label.chq-sponsor-slot, the floored tap surface (min-height: 44px at phone); the label's own semantics make the whole row the target */
  .chq-sponsor-slot-input { flex-shrink: 0; margin: 0; accent-color: var(--chq-ink); }
  .chq-sponsor-add { margin-top: 16px; }
  /* invitation page: no back link above it, so it takes its own top room,
     and it holds the portal measure even when its lines are short */
  .chq-invite-page { padding-top: 24px; }
  .chq-portal-shell > .chq-measure:has(.chq-invite-page),
  .chq-portal-shell > .chq-measure:has(.chq-share-page) { width: 100%; box-sizing: border-box; }
  .chq-share-page { min-width: 0; }
  .chq-invite-quote { font-size: 14px; color: var(--chq-ink-2); margin: 10px 0 16px; line-height: 1.5; }
  .chq-invite-note { margin-top: 16px; }
  /* preview as participant: fixed ink bar that can't be scrolled away */
  .chq-preview-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--chq-ink);
    color: var(--chq-on-ink);
    font-size: 13px;
  }
  .chq-preview-bar-label {
    font-size: var(--chq-type-micro-size);
    font-weight: 700;
    letter-spacing: var(--chq-type-micro-tracking);
    text-transform: uppercase;
  }
  .chq-preview-bar-text { flex: 1; min-width: 0; }
  .chq-preview-bar-exit {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--chq-on-ink);
    border-radius: var(--chq-r-ctl);
    padding: 6px 12px;
    color: var(--chq-on-ink);
    font-weight: 700;
    text-decoration: none;
  }
  /* the shell starts below the fixed bar, so the portal's own header (event,
     the person's name) stays visible under it */
  .chq-portal-shell:has(.chq-preview-bar) { padding-top: 52px; }

  /* desktop: one participation sits at the reading measure; three or more
     blocks (the profile counts) flow into two columns, column-major, the
     way the frame stacks Profile + Talk left and Panel + Sponsor right.
     HOME_PHONE_CSS returns the grid to a single column. */
  .chq-home-wide .chq-home-grid { column-count: 2; column-gap: 34px; }
  /* ...and a two-column home takes the wide measure the frame draws it at
     (1180px), where a one-column portal keeps the portal measure. */
  .chq-portal-shell > .chq-measure:has(.chq-home-wide),
  .chq-portal-shell > .chq-measure:has(.chq-sponsor-grid) { max-width: var(--chq-measure-wide); width: 100%; box-sizing: border-box; }
`;

// The home's phone rules: their own @media (max-width: 700px) block, which
// the host sheet composes into its one contiguous trailing phone region
// (DEC-385 single-direction, terminal-block contract), the way it composes
// EMPTY_PHONE_CSS and ERROR_STATES_PHONE_CSS.
export const HOME_PHONE_CSS = `
  @media (max-width: 700px) {
    .chq-home-wide .chq-home-grid { column-count: 1; }
    .chq-sponsor-grid { grid-template-columns: minmax(0, 1fr); }
    .chq-sponsor-slot { min-height: 44px; }
    .chq-preview-bar { flex-wrap: wrap; }
    .chq-preview-bar-exit { min-height: 44px; }
    .chq-portal-shell:has(.chq-preview-bar) { padding-top: 68px; }
    .chq-home-required { display: none; }
    /* done items collapse behind a "2 done" line (frame, 390) */
    .chq-home-done-summary {
      display: flex;
      align-items: center;
      min-height: 44px;
      font-size: 12px;
      font-weight: 600;
      color: var(--chq-muted);
      cursor: pointer;
      border-bottom: 1px solid var(--chq-hairline);
    }
    .chq-home-row { min-height: 44px; }
    /* every row and section title is a link: a real 44px tap floor */
    .chq-home-row-title,
    .chq-home-title-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      /* a one-word title ("Bio") is narrower than the floor */
      min-width: 44px;
    }
    .chq-home-actions { flex-direction: column; }
    .chq-home-actions .chq-btn { width: 100%; min-height: 44px; }
  }
`;

// Closes the done fold on a phone-width first paint; desktop keeps it open
// (its summary is hidden there). Value-free.
export const HOME_DONE_FOLD_JS = `(function(){if(!window.matchMedia||!window.matchMedia("(max-width: 700px)").matches)return;var d=document.querySelectorAll("details.chq-home-done");for(var i=0;i<d.length;i++)d[i].removeAttribute("open");})();`;
