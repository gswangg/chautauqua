# Meta-fidelity probe: phone clusters B + SSR — MEDIUM

(Split out of docs/probes/metafid-phoneB-ssr-2026-08-19.md by the
structure custodian, wave v12m-w16, to de-hotspot a file that had drawn
four merge conflicts. No content changed, only relocated; see that file's
short index header for the full split map.)

## MEDIUM (see probe evidence for full list)
- 44px floor misses across public/portal (+ app/src stragglers incl.
  .chq-review-queue-footer-showall 52x30 button).
  Moved to Still Live below — the app/src straggler named in the finding
  is confirmed unfixed.
- Zero/negative control gaps: /login password↔button 0px + focus ring
  through the PASSWORD label on load; overview + speakers row pairs overlap
  (-6px); portal session edit↔label 0px.
  Partially re-derived: the /login card's fields-to-submit gap is 22px
  (src/routes/auth.css.ts `gap: 22px;`, on `.chq-auth-card`, its direct
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
  only): src/views/form-render.tsx `resolvedTextCap`
  (drift-proof citation, DEC-967 wave-115 -- quotes the imported identifier
  the counter-cap computation calls, not the whole statement, so the
  citation survives concurrent edits to this file).
  CLOSED (re-verified wave-140/w15-ff, task-w13-k, same evidence as
  round-2 WAVE B "CFP column 290px vs 358 budget"): the column-budget
  clause is now also closed —
  `src/routes/public/cfp.css.ts`'s terminal phone block declares
  `main.chq-measure:has(.chq-cfp-body) { padding-inline: 0; }` so the
  outer `<main class="chq-measure">`'s padding no longer stacks with
  `.chq-cfp-body`'s own 16px left/right (single gutter owner, per the
  rule's own comment).
  portal footer 93px ink stub +
  duplicate Sign out; overview remind-all breaks gutters; tab-bar dot
  flow/baseline defects (dot above label, all five items, per frames);
  speakers Remind-outstanding wraps in 107px
  box; OVERDUE filled chip vs frame's weighted text at 390; portal edit
  scope (frame :597 scopes to title/abstract, live ships full CFP);
  scorecard copy drift (Read-full absent, recuse wording, "—" vs "Not yet").
  CLOSED (wave v12m-w20-f, DEC-367): "pub-empty-what 36px > page H1" —
  `src/routes/public/css/empty.css.ts`'s terminal `@media (max-width:
  700px)` block now sets `.chq-pub-empty-block-fresh .chq-pub-empty-what`
  to `font-size: 26px`, the same value `src/routes/public/css/rail.css.ts`'s
  own terminal phone block gives `.chq-pub-surface-title` (the page's H1)
  at the same width — never a third hand-typed number, never by
  redefining `--chq-type-page-title-size` (frozen at desktop's 36px). The
  desktop rule this closes against is drawn by
  `docs/design/Chautauqua Public and Portal.dc.html`'s "Public sessions ·
  nothing published" frame, whose zero-state headline ("The programme is
  not out yet") sits below the surface title the same way this fix keeps
  them ordered at 390. The `.chq-pub-empty-reason` companion is brought
  into proportion in the same block, reusing this file's own 13px quiet
  register (the 'filtered' variant's reason size) rather than inventing a
  new number.
