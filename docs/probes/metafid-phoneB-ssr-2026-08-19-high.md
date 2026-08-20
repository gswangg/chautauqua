# Meta-fidelity probe: phone clusters B + SSR — HIGH

(Split out of docs/probes/metafid-phoneB-ssr-2026-08-19.md by the
structure custodian, wave v12m-w16, to de-hotspot a file that had drawn
four merge conflicts. No content changed, only relocated; see that file's
short index header for the full split map.)

## HIGH
- Reviewer scorecard +31px overflow (chq-user-identity nowrap in a header
  the frame deletes on this screen — Review.dc.html:276 draws no shell
  header; fix per frame).
  CLOSED (wave 120): app/src/styles.css`.chq-header-identity .chq-user-identity {`
  CLOSED (wave 120): app/src/styles.css`.chq-shell:not(:has(.chq-tabbar)):not(:has([data-chq-phone-signout])) .chq-header-identity .chq-user-identity {`
  (drift-proof citations, DEC-967 wave-115 shape -- both declarations have
  drifted from the line numbers originally cited here) (a reviewer's shell
  has no tab bar so the first rule hides the header identity's user block
  outright, avoiding the nowrap overflow; the second, `:not()`-qualified
  drill-in exception re-shows exactly one Sign out, per
  app/src/pages/review/Scorecard.tsx:525 and the pin at
  app/src/pages/review/scorecard-phone-frames.test.ts:182.)
- Docs site 390 header collapses to vertical text (search takes 260px;
  overflow-wrap:anywhere lets wordmark shrink to 23px wide). Docs.dc.html:162.
  CLOSED (wave 115): src/routes/docs-site.css.ts`.chq-docs-header { padding: 14px 16px; gap: 12px; flex-wrap: wrap; }`
- Docked action bars absent where frames draw them: public agenda,
  my-schedule, portal tasks/hotel-form/session/edit, CFP wizard.
  /account/password is the model implementation — reuse its pattern.
  CLOSED (wave 118, "portal tasks/hotel-form/session/edit" clause only —
  the public agenda/my-schedule and CFP wizard docks are unverified and
  remain open): src/routes/portal/shared.tsx `{props.dock ? <div class="chq-portal-dock">{props.dock as any}</div> : null}`
  (drift-proof citation, DEC-967 wave-115).
  CLOSED (re-verified wave-140/w15-ff): the CFP wizard clause is now also
  closed — `src/routes/public/cfp.css.ts`'s task-w13-k terminal phone
  block comment states `.chq-cfp-actions` IS the frame's sticky dock band
  ("the dock IS the sticky band, no `data-chq-phone-dock` declaration
  needed. Every control..."), reusing the same SSR phone-dock footer band
  every other SSR phone dock shares (DEC-576 wave-110 amendment cited in
  the same comment). The public agenda/my-schedule docks clause was NOT
  re-verified this wave (no `data-chq-phone-dock`/dock prop found under
  `src/routes/public/agenda*` by grep) and stays open.
- SCAN POPULATION: widen phone-tap-target.scan + the 390-overflow scan roots
  from app/src to include src/routes/** (public/portal/docs/auth were never
  scanned; most §5 floor misses would have been caught).
  CLOSED (wave 115): app/src/phone-tap-target-ssr.scan.test.ts`for (const family of ['src/routes/public/', 'src/routes/portal/', 'src/routes/docs-site.css.ts', 'src/routes/auth.css.ts']) {`
  (drift-proof citation, DEC-967 wave-115 -- moved to its own file in the
  wave-v12m-w12 custodian decomposition of phone-tap-target.scan.test.ts).
  CLOSED (wave 115): test/ssr-phone-overflow.test.ts `const HOME_CSS = readFileSync(join(__dirname, "..", "src", "routes", "public", "home.css.ts"), "utf8");`
  (drift-proof citation, DEC-967 wave-115).
