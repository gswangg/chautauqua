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
   cfp-steps-script.tsx:67); form-render.tsx:284 now uses
   `wrap.querySelectorAll('[data-field-id="' + r.fieldId + '"]')`, not a
   singular querySelector, so every radio in the group gets its required
   state applied, not just the first.
   CLOSED (wave 115): src/routes/public/cfp-steps-script.tsx:87 `if (typeof invalid.reportValidity === 'function') invalid.reportValidity();`
   CLOSED (wave 115): src/views/form-render.tsx:284 `wrap.querySelectorAll('[data-field-id="' + r.fieldId + '"]').forEach(function(input){`
2. Admin agenda 390 renders nothing (Agenda.dc.html:123): agenda.css
   :1074-1104 display:none leak-guard for 24 .chq-phone-* classes; the 700px
   block restores only 14 — missing: -slot-time, -slot-card-title,
   -slot-card-meta, -slot-clash, -slot-free-label, -slot-free-length,
   -room-chip, -sheet, -footer-armed-title, -footer-armed-ref.
   RESOLVED: agenda.css:1118's terminal `@media (max-width: 700px)` block
   now restores all 24 classes named in the agenda.css:1074-1104 leak-guard
   list, including the ten named missing here, each a top-level rule inside
   the terminal block: agenda.css:1294 `.chq-phone-slot-time {`;
   agenda.css:1318 `.chq-phone-slot-card-meta {`; agenda.css:1326
   `.chq-phone-slot-card-title {`; agenda.css:1340 `.chq-phone-slot-clash {`;
   agenda.css:1389 `.chq-phone-slot-free-label {`; agenda.css:1396
   `.chq-phone-slot-free-length {`; agenda.css:1257
   `.chq-phone-room-chip {`; agenda.css:1497 `.chq-phone-sheet {`;
   agenda.css:1453 `.chq-phone-footer-armed-title {`; agenda.css:1464
   `.chq-phone-footer-armed-ref {`.

## HIGH
- Reviewer scorecard +31px overflow (chq-user-identity nowrap in a header
  the frame deletes on this screen — Review.dc.html:276 draws no shell
  header; fix per frame).
- Docs site 390 header collapses to vertical text (search takes 260px;
  overflow-wrap:anywhere lets wordmark shrink to 23px wide). Docs.dc.html:162.
  CLOSED (wave 115): src/routes/docs-site.css.ts:229 `.chq-docs-header { padding: 14px 16px; gap: 12px; flex-wrap: wrap; }`
- Docked action bars absent where frames draw them: public agenda,
  my-schedule, portal tasks/hotel-form/session/edit, CFP wizard.
  /account/password is the model implementation — reuse its pattern.
- SCAN POPULATION: widen phone-tap-target.scan + the 390-overflow scan roots
  from app/src to include src/routes/** (public/portal/docs/auth were never
  scanned; most §5 floor misses would have been caught).
  CLOSED (wave 115): app/src/phone-tap-target.scan.test.ts:380 `for (const family of ['src/routes/public/', 'src/routes/portal/', 'src/routes/docs-site.css.ts', 'src/routes/auth.css.ts']) {`
  CLOSED (wave 115): test/ssr-phone-overflow.test.ts:19 `const HOME_CSS = readFileSync(join(__dirname, "..", "src", "routes", "public", "home.css.ts"), "utf8");`

## MEDIUM (see probe evidence for full list)
- 44px floor misses across public/portal (+ app/src stragglers incl.
  .chq-review-queue-footer-showall 52x30 button).
- Zero/negative control gaps: /login password↔button 0px + focus ring
  through the PASSWORD label on load; overview + speakers row pairs overlap
  (-6px); portal session edit↔label 0px.
- CFP content column 290px vs 358 budget; counters on every field incl.
  dates/emails (frames: ABSTRACT only); portal footer 93px ink stub +
  duplicate Sign out; overview remind-all breaks gutters; tab-bar dot
  flow/baseline defects (dot above label, all five items, per frames);
  pub-empty-what 36px > page H1; speakers Remind-outstanding wraps in 107px
  box; OVERDUE filled chip vs frame's weighted text at 390; portal edit
  scope (frame :597 scopes to title/abstract, live ships full CFP);
  scorecard copy drift (Read-full absent, recuse wording, "—" vs "Not yet").
