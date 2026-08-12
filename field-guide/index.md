# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/images/eval-rubric/*.yaml/fixtures never product code;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. STAGE 1 zero-secret wrangler dev;
  external services behind ports. 003 table/enums; 004 hash 'pbkdf2$v1$
  100000$salt$hash'(workerd 100k cap); 002 pure-core src/{auth,domain,
  forms,mail,lib} import nothing node:/cf; 012/013 route files export
  Hono sub-apps, only src/index.ts mounts, middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}; 015 append-only/016 locked=
  real cols; never hand-edit src/decisions.ts.
- Wave3-22 (DEC-012..358): sub-apps/repos/ctx/uploads/ics/statuses/
  perf/headshots/claim; criteriaForRound sole resolution; CRM=
  SegmentRule[]+'any'; battery FROZEN sha; drizzle-orm ^0.45.2; 322
  safeExternalUrl allowlist; 335-337 listSubmissions/contacts SQL
  EXISTS+LIKE ESCAPE; J5-J8 server-paged, fan-out DELETED; 353 archive
  40MB TOTAL-byte guard; 355-357 bulk ops set-based; 358 CLOSED.
- w23-24 (DEC-359..365): STAGE 1 COMPLETE. Six w23 gates OPEN ITEMS:0/
  PASS at FROZEN SHA e3d558e; gate lanes LOG-ONLY (own ONE file, never
  patch product). 364/365 discharge deferred+lens items, all non-
  defects. Stage 2 (deploy/Resend/Airtable/DNS/CI) = separate swarm.
- REDESIGN w1 (DEC-366..371): stage-1 FUNCTION FROZEN/COMPLETE. Binding
  mandate = docs/design/README.md + 11 *.dc.html + screens/*.png,
  ranked just under clarifications.md for visual/layout/copy; SPEC
  still governs behaviour/authz/data/perf. Settled items (pubcache
  201/333/348/358, ABS-14 272, stage-2 wiring) are NEVER open items.
- 367 tokens: paper F4F1E8/surface FAF8F2/sunk EFEBDF/ink 1B1D17/muted
  565A4B/hairline E1DDCE/rule D3CFC0/border BAB6A6/olive 4E5C31/on-
  brand F7F9F0. NO RED, no third accent — lateness+clash = TYPE not
  color. Fonts self-hosted /fonts/*-var.woff2. Floors: 10px type, 44px
  phone tap, AA, no shadows, nav underline=box-shadow inset. No new
  deps. 369 sidebar DELETED; top header+phone 5-tab bar; nav=
  destinations only. 370 Overview=worklist v2 (v1 keys RETAINED, rows
  capped 5) — never assert what no endpoint stores.
- 368/372 CSS: app/src/styles.css AND src/views/theme.ts = ONE lane
  (design-system); page lanes add co-located <area>.css, .chq-<area>-*
  — never redefine a shared class, may own >1 sheet/use not-yet-landed
  shared classes early. `.chq-pill` active=INK (olive fill is .chq-btn-
  primary only); token NAMES match SPA/SSR (--chq-ink-2, never
  -secondary); 9 shared classes: steps/bar/dot/bulkbar/rail/panel/kv/
  pager/scrim.
- 371/373 SSR: THEME_CSS in src/views/theme.ts PLUS one co-located
  surface module/family: public.css.ts .chq-pub-, portal.css.ts
  .chq-portal-, cfp.css.ts .chq-cfp-, auth.css.ts .chq-auth-; shell =
  ThemeStyles()+ONE surface style; tokens never restated. 374 TRAP:
  hono/jsx escapes & < > " ' in text children (DEC-110) — THEME_CSS's
  'Familjen Grotesk' shipped as &#39;, fonts never loaded. SSR CSS ->
  dangerouslySetInnerHTML, value-free constant; per-event accent =
  validated /^#[0-9a-fA-F]{6}$/ hex in style ATTRIBUTE on <body>.
- 375 Settings=ONE route; phone subscreens=client-state swap,
  routeManifest untouched. 376 Contacts split by view (lane1 app/
  table/stats/drawer/modals, lane2 pipeline/dupes/segments/import);
  merge strike #A8A392=ONLY off-palette hex. 377 mock figures/
  personas/emails=illustration, never in product code; drop captions
  no endpoint backs; keep constraint captions verbatim.
