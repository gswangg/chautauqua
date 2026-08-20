# Meta-fidelity probe: phone clusters B + SSR — CRITICAL

(Split out of docs/probes/metafid-phoneB-ssr-2026-08-19.md by the
structure custodian, wave v12m-w16, to de-hotspot a file that had drawn
four merge conflicts. No content changed, only relocated; see that file's
short index header for the full split map.)

## CRITICAL (meta fix lane dispatched — engine must not duplicate)
1. Phone-CFP step-1 dead end (Public and Portal.dc.html:1014): step 1
   advances unvalidated (cfp-steps-script.tsx:33 setStep('2') unguarded);
   step-2 submit silently no-ops on hidden invalid step-1 controls
   (form-render.tsx:278 singular querySelector leaves radios 2..N required
   inside display:none). DEC-986's ruling prescribes reportValidity() +
   querySelectorAll — implement it for real.
   RESOLVED (DEC-986): cfp-steps-script.tsx's Next handler now walks the
   outgoing step's controls and calls `reportValidity()` on the first
   invalid one before it will call `setStep('2')` (src/routes/public/cfp-steps-script.tsx
   `setStep(`, guarded by the invalid-control check a few lines
   earlier in the same function's walk); form-render.tsx's radio-group required-state
   pass now uses `data-field-id`, not a singular querySelector, so every
   radio in the group gets its required state applied, not just the first
   (drift-proof citations, DEC-967 wave-115 -- both statements have drifted
   from the lines originally cited here, and quote a stable identifier
   rather than the full call so the citation survives concurrent edits to
   these two files).
   CLOSED (wave 115): src/routes/public/cfp-steps-script.tsx `reportValidity()`
   CLOSED (wave 115): src/views/form-render.tsx `data-field-id`
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
