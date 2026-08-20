# Meta-fidelity probe: phone clusters B + SSR (verified, evidence in
# scratchpad/metafid-c/). Verdicts: Public/Portal FAIL (critical), Agenda
# admin FAIL (critical), Docs FAIL, Overview FAIL, Speakers FAIL, Review
# PARTIAL, Account PARTIAL→PASS, Home PARTIAL. Tier 0.

## CRITICAL (meta fix lane dispatched — engine must not duplicate)
1. Phone-CFP step-1 dead end (Public and Portal.dc.html:1014): step 1
   advances unvalidated (cfp-steps-script.tsx:33 setStep('2') unguarded);
   step-2 submit silently no-ops on hidden invalid step-1 controls
   (form-render.tsx:278 singular querySelector leaves radios 2..N required
   inside display:none). DEC-986's ruling prescribes reportValidity() +
   querySelectorAll — implement it for real.
   RESOLVED (DEC-986): cfp-steps-script.tsx's Next handler now walks the
   outgoing step's controls and calls `reportValidity()` on the first
   invalid one before it will call `setStep('2')` (cfp-steps-script.tsx:91
   `setStep('2');`, guarded by the invalid-control check starting at
   cfp-steps-script.tsx:67); form-render.tsx:314 now uses
   `wrap.querySelectorAll('[data-field-id="' + r.fieldId + '"]')`, not a
   singular querySelector, so every radio in the group gets its required
   state applied, not just the first.
   CLOSED (wave 115): src/routes/public/cfp-steps-script.tsx:87 `if (typeof invalid.reportValidity === 'function') invalid.reportValidity();`
   CLOSED (wave 115): src/views/form-render.tsx:314 `wrap.querySelectorAll('[data-field-id="' + r.fieldId + '"]').forEach(function(input){`
2. Admin agenda 390 renders nothing (Agenda.dc.html:123): agenda.css
   :1074-1104 display:none leak-guard for 24 .chq-phone-* classes; the 700px
   block restores only 14 — missing: -slot-time, -slot-card-title,
   -slot-card-meta, -slot-clash, -slot-free-label, -slot-free-length,
   -room-chip, -sheet, -footer-armed-title, -footer-armed-ref.
   RESOLVED: agenda.css's terminal `@media (max-width: 700px)` block
   now restores all 24 classes named in the agenda.css:1074-1104 leak-guard
   list, including the ten named missing here, each a top-level rule inside
   the terminal block (drift-proof citations, DEC-967 wave-115):
   agenda.css`.chq-phone-slot-time {`;
   agenda.css`.chq-phone-slot-card-meta {`;
   agenda.css`.chq-phone-slot-card-title {`; agenda.css`.chq-phone-slot-clash {`;
   agenda.css`.chq-phone-slot-free-label {`;
   agenda.css`.chq-phone-slot-free-length {`;
   agenda.css`.chq-phone-room-chip {`; agenda.css`.chq-phone-sheet {`;
   agenda.css`.chq-phone-footer-armed-title {`; agenda.css`.chq-phone-footer-armed-ref {`.

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
  remain open): src/routes/portal/shared.tsx:233 `{props.dock ? <div class="chq-portal-dock">{props.dock as any}</div> : null}`
- SCAN POPULATION: widen phone-tap-target.scan + the 390-overflow scan roots
  from app/src to include src/routes/** (public/portal/docs/auth were never
  scanned; most §5 floor misses would have been caught).
  CLOSED (wave 115): app/src/phone-tap-target-ssr.scan.test.ts`for (const family of ['src/routes/public/', 'src/routes/portal/', 'src/routes/docs-site.css.ts', 'src/routes/auth.css.ts']) {`
  (drift-proof citation, DEC-967 wave-115 -- moved to its own file in the
  wave-v12m-w12 custodian decomposition of phone-tap-target.scan.test.ts).
  CLOSED (wave 115): test/ssr-phone-overflow.test.ts:19 `const HOME_CSS = readFileSync(join(__dirname, "..", "src", "routes", "public", "home.css.ts"), "utf8");`

## MEDIUM (see probe evidence for full list)
- 44px floor misses across public/portal (+ app/src stragglers incl.
  .chq-review-queue-footer-showall 52x30 button).
  Moved to Still Live below — the app/src straggler named in the finding
  is confirmed unfixed.
- Zero/negative control gaps: /login password↔button 0px + focus ring
  through the PASSWORD label on load; overview + speakers row pairs overlap
  (-6px); portal session edit↔label 0px.
  Partially re-derived: the /login card's fields-to-submit gap is 22px
  (src/routes/auth.css.ts:79 `gap: 22px;`, on `.chq-auth-card`, its direct
  parent) and overview's wrapped section-header keeps its base 20px flex
  gap (app/src/pages/overview/overview.css`gap: 20px;`
  (drift-proof citation, DEC-967 wave-115 -- this declaration now sits at
  line 187, having drifted from the line originally cited here)) — neither
  reproduces a literal 0px/negative gap as measured. The focus-ring and
  portal session edit↔label clauses were not independently reproducible
  from the tree by static read (no focus-visible rule exists for
  `.chq-auth-card input[type=password]` either way) — moved to Still Live
  below rather than closed on an absence of contrary evidence.
- CFP content column 290px vs 358 budget; counters on every field incl.
  dates/emails (frames: ABSTRACT only);
  CLOSED (wave 118, "counters on every field incl. dates/emails" clause
  only): src/views/form-render.tsx:169 `const counterMax = field.kind === "long_text" ? resolvedTextCap(field) : undefined;`
  portal footer 93px ink stub +
  duplicate Sign out; overview remind-all breaks gutters; tab-bar dot
  flow/baseline defects (dot above label, all five items, per frames);
  pub-empty-what 36px > page H1; speakers Remind-outstanding wraps in 107px
  box; OVERDUE filled chip vs frame's weighted text at 390; portal edit
  scope (frame :597 scopes to title/abstract, live ships full CFP);
  scorecard copy drift (Read-full absent, recuse wording, "—" vs "Not yet").

## RESOLVED since wave 120 (re-derived wave v12m-w15-i)
- 44px floor misses across public/portal: `.chq-review-queue-footer-showall`
  (app/src/pages/review/review.css`.chq-review-queue-footer-showall {`, the
  base rule, still declares no `min-height`/`height`) is now floored inside
  the file's terminal phone block: app/src/pages/review/review.css`min-height: 44px;`
  sits directly under a re-declared showall rule there, alongside a
  `display: flex; align-items: center; justify-content: center;` centring
  triple and `padding: 0 14px;` -- the full 44px-floor triple this row
  originally found missing. Fixed per
  the analogous link-button pattern this row cited at
  app/src/pages/settings/settings.css
  `.chq-settings-edit-row-actions .chq-link-button {`.
- Zero/negative control gaps, the two clauses not reproducible from a
  static read: /login's focus ring on the PASSWORD field on load (no
  `focus-visible` rule targets `.chq-auth-card input[type=password]` in
  src/routes/auth.css.ts at all, positive or negative, so nothing in the
  tree confirms or denies the frame divergence) and portal's session
  edit↔label 0px gap (no rule pairing a session-edit label directly to its
  control gap was found -- the nearest candidate,
  src/routes/portal/portal.css.ts:594 `.chq-portal-session-label {`, styles
  a section label's own internal layout, not a label-to-control pairing).
  Left live rather than guessed closed — DEC-967 forbids receipting a fix
  that was not read.
