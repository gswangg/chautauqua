# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit).
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. STAGE 1 zero-secret wrangler dev;
  external services behind ports. 003 table/enums; 004 hash 'pbkdf2$v1$
  100000$salt$hash'(workerd 100k cap); 002 pure-core src/{auth,domain,
  forms,mail,lib} import nothing node:/cf; 012/013 route files export
  Hono sub-apps, only src/index.ts mounts; errors {error:{code,message,
  fields?}}; 015 append-only/016 locked=real cols.
- Wave3-24 (DEC-012..365): sub-apps/repos/ctx/uploads/ics/statuses/perf/
  headshots/claim; criteriaForRound sole resolution; CRM=SegmentRule[]+
  'any'; drizzle-orm ^0.45.2; 322 safeExternalUrl allowlist; 335-337
  SQL EXISTS+LIKE ESCAPE; J5-J8 server-paged, fan-out DELETED; 353
  archive 40MB TOTAL-byte guard; 355-358 bulk ops set-based/CLOSED.
  STAGE 1 COMPLETE at w23-24, gates LOG-ONLY (own ONE file, never
  patch product); Stage 2 (deploy/Resend/Airtable/DNS/CI)=separate
  swarm.
- REDESIGN w1 (DEC-366..371): stage-1 FUNCTION FROZEN/COMPLETE. Binding
  mandate = docs/design/README.md + 11 *.dc.html + screens/*.png,
  ranked just under clarifications.md for visual/layout/copy; SPEC
  still governs behaviour/authz/data/perf. 367 tokens: paper F4F1E8/
  surface FAF8F2/sunk EFEBDF/ink 1B1D17/muted 565A4B/hairline E1DDCE/
  rule D3CFC0/border BAB6A6/olive 4E5C31. NO RED, no third accent —
  lateness+clash = TYPE not color. Fonts self-hosted /fonts/*-var.
  woff2. Floors: 10px type, 44px phone tap, AA, no shadows. No new
  deps. 369 sidebar DELETED; top header+phone 5-tab bar. 370
  Overview=worklist v2 — never assert what no endpoint stores.
- 368/372 CSS: app/src/styles.css AND src/views/theme.ts = ONE lane;
  page lanes add co-located <area>.css, .chq-<area>-*, never redefine
  a shared class. 371/373 SSR: THEME_CSS in theme.ts PLUS one
  co-located surface module family: public/portal/cfp/auth/tools
  .css.ts (.chq-pub-/-portal-/-cfp-/-auth-/-tool-; 382 tools.css.ts
  covers /, /docs/api, /dev/mailbox, no invented layout, no frame in
  pack); shell=ThemeStyles()+ONE surface style. 374 TRAP: hono/jsx
  escapes & < > " ' in text children — SSR CSS -> dangerouslySet
  InnerHTML, value-free constant; per-event accent=validated hex in
  style ATTRIBUTE.
- 375 Settings=ONE route, phone=client-state swap. 376 Contacts split
  by view (lane1 app/table/stats/drawer/modals, lane2 pipeline/dupes/
  segments/import); merge strike #A8A392=ONLY off-palette hex (383
  allowlists exactly this one; page/surface sheets otherwise carry NO
  hex/rgb() at all, token files only; no non-inset box-shadow). 377
  mock figures=illustration, never product code.
- REDESIGN w3 (DEC-378..384): 378 ONE dialog contract — .chq-scrim is
  the only backdrop, .chq-modal its STATIC child, Escape via app/src/
  lib/useEscapeKey.ts (source pinned in DEC), overlay/backdrop classes
  DELETED. 379 styles.css CLOSES the SPA vocabulary (residual names
  adopted, not renamed); test walks every .tsx, proves each chq-*
  class has a rule; .chq-page is a stack NOT a measure; --chq-ink-
  strong #2E2A24=secondary-btn ink in BOTH token files. 380 agenda
  phone=arm-then-tap, one room, 30-min default; breaks/'move X'/'10
  min' DROPPED. 381 phone tabs=Overview/Submissions/Speakers/Content/
  More from EXPLICIT path list (was slice-of-filter: shipped Review,
  dropped Content); More carries Sign out; tabbar leaves <header> so
  .chq-header-identity wins. 384 gate lanes own ONE log file only.
