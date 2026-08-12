# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 004 hash 'pbkdf2$v1$100000$salt$
  hash'; 012/013 route files export Hono sub-apps, errors
  {error:{code,message,fields?}}; 353 archive 40MB TOTAL-byte guard;
  bulk ops set-based/CLOSED. Gates LOG-ONLY.
- REDESIGN w1-5 (DEC-366..391): FUNCTION FROZEN. Tokens: paper F4F1E8/
  surface FAF8F2/ink 1B1D17/muted 565A4B/hairline E1DDCE/border BAB6A6/
  olive 4E5C31, NO RED/shadows/new deps. styles.css+theme.ts=ONE lane;
  page lanes add .chq-<area>.css, never redefine shared class. ONE
  dialog contract, ONE phone switch @700px, 44px controls. D1 binds
  PRIMITIVES -- epoch-ms NUMBER not `new Date()`.
- REDESIGN w6-10 (DEC-392..419): 393 tap floor 44px. 397 preview never
  mints creds. 399 pubcache scope CLOSED. 401/414 390px overflow via
  scroller/wrap (refined by 424). 404/405 overflow-wrap:anywhere, never
  overflow-x:hidden. 409 2px olive focus ring, outline:none banned. 411
  tsx/esbuild keepNames breaks page.evaluate -- addInitScript shim
  FIRST every Playwright page; 413/408 dates via src/lib/event-time.ts,
  OWNING EVENT's tz, throws; 415 portal-edit writes job_title/company/
  bio to contact only; 416 unknown track id rejected w/ zero tracks;
  417 ONE parseBoundedText in src/server/http.ts, caps NAME 200/TEXT
  2000/LONG 20000/RICH 100000, oversized=400 never 500 (extended by
  422, 425); 418 public lists LIMIT+separate COUNT(DISTINCT) in SQL;
  419 gates log-only, failure never written as a number.
- STAGE1-CLOSE w11 (DEC-420..423): 420 reminders via formatEventDate
  (ms, event.timezone), never toISOString. 421 10px type-floor sweep,
  ADVISORY (FONT_FLOOR_BLOCKING=false, DEC-387 flip). 422 caps+rate
  limits: public save-draft, POST /portal/profile SSR own page 400.
  423 verification-log/task-w11-*.md filenames ALREADY TAKEN by
  campaign 1 (DEC-129); spec-audit emits J1-J12+§5-§8 ledger.
- STAGE1-CLOSE w12 (DEC-424..429): 424 390px pass excludes elements
  held by ancestor overflow-x:auto|scroll (DEC-414's remedy, not a
  bug); scrollWidth>clientWidth = real spill. 425 caps reach scorecard
  comment/text-criterion, api-token name, upload filename --
  MAX_NAME/MAX_LONG. 426 WCAG AA THIRD mandate invariant; desktop-only,
  advisory (CONTRAST_BLOCKING=false), own module render-sweep-contrast.
  ts. 427 pubcache purge scope STAYS CLOSED; kv.put rejection after
  commit logged not 500'd. 428 SPEC.md:308 >=600k amended to
  DEC-004/237 100k. 429 devDeps closed in gate log; runtime-dep=lane.
- STAGE1-CLOSE w13 (DEC-430..432): w12 FULLY merged (424 instrument+review.css,
  425 caps, 426 contrast module, 427 pubcache, 428 SPEC:308=100k). 430 contrast
  remedies change PIXELS, never the instrument: drag glyph --chq-border ->
  --chq-muted; .chq-pub-track-chip stops using the DATA-supplied track colour as
  a text background (ink-on-surface + swatch via --chq-track-color behind the
  DEC-374 hex guard) -- NEVER add aria-hidden/decorative exemptions to
  render-sweep-contrast. 431 DEC-387 flip fires: ADMIN_MOBILE_PASS_BLOCKING +
  FONT_FLOOR_BLOCKING true (all-PASS at w12-a Reading 2, re-confirmed in the
  flipping lane's OWN run -- never flip on a prior wave's transcript);
  CONTRAST_BLOCKING stays false, its first all-PASS is w13's. 432 scope belongs
  in the WHERE: getMyResources inArray+chunkIds, getContactStats
  returningSpeakers = count over GROUP BY/HAVING. All w13 log filenames carry a
  -stage1 suffix (DEC-423 campaign-1 homonyms). goalComplete is decided by
  task-w13-f-spec-audit-stage1.md on citations, never by a wave summary.
