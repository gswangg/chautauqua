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
  hash' (SPEC.md prose amended to match, see 428); 012/013 route files
  export Hono sub-apps, errors {error:{code,message,fields?}}; 353
  archive 40MB TOTAL-byte guard; bulk ops set-based/CLOSED. Gates LOG-ONLY.
- REDESIGN w1-5 (DEC-366..391, docs/design/README.md): FUNCTION FROZEN.
  Tokens: paper F4F1E8/surface FAF8F2/ink 1B1D17/muted 565A4B/hairline
  E1DDCE/border BAB6A6/olive 4E5C31, NO RED/shadows/new deps. styles.css+
  theme.ts=ONE lane; page lanes add .chq-<area>.css, never redefine
  shared class. ONE dialog contract, ONE phone switch @700px, 44px
  controls. D1 binds PRIMITIVES -- epoch-ms NUMBER not `new Date()`.
- REDESIGN w6-10 (DEC-392..419): 393 tap floor 44px. 397 preview never
  mints credentials. 399 pubcache bump scope CLOSED (still '*'; kv.put
  failure handling in 427). 401/414 390px overflow via scroller/wrap,
  max-right/scrollWidth (scoring refined by 424). 404/405
  overflow-wrap:anywhere on shell, never overflow-x:hidden. 409 2px
  olive focus ring, outline:none banned. 411 tsx/esbuild keepNames
  breaks page.evaluate closures -- every Playwright page gets
  addInitScript shim FIRST; 413/408 dates via src/lib/event-time.ts,
  OWNING EVENT's tz, throws (no UTC fallback); 415 portal-edit writes
  job_title/company/bio to contact only (DEC-258 frozen); 416 unknown
  track id rejected w/ zero tracks offered; 417 ONE parseBoundedText in
  src/server/http.ts, caps NAME 200/TEXT 2000/LONG 20000/RICH 100000 in
  src/forms/validate.ts, oversized=400 never SQLITE_TOOBIG 500
  (extended by 422, 425); 418 public lists LIMIT+separate
  COUNT(DISTINCT) in SQL; 419 gates log-only, instrument failure never
  written as a number.
- STAGE1-CLOSE w11 (DEC-420..423): 420 reminder emails: one line/task,
  formatEventDate(ms, event.timezone), never toISOString/aggregate
  date. 421 10px type-floor render-sweep pass, ADVISORY
  (FONT_FLOOR_BLOCKING=false, DEC-387 flip), desktop+390px, after
  DEC-411 shim. 422 caps+rate limits: public save-draft, POST
  /portal/profile -- SSR reports oversize via its OWN page 400. 423
  verification-log/task-w11-*.md filenames ALREADY TAKEN by campaign 1
  (DEC-129 homonyms); use exact filename in task text; spec-audit emits
  J1-J12+§5-§8 ledger deciding goalComplete.
- STAGE1-CLOSE w12 (DEC-424..429): 424 390px pass no longer counts
  elements held by an ancestor overflow-x:auto|scroll -- that IS
  DEC-414's remedy; 5 of wave-10's 6 admin FAILs were the fix scored as
  the bug. Document scrollWidth still fails hard; when it fails with no
  escaping box, offenders come from el.scrollWidth>clientWidth (content
  spill). 425 caps reach reviewer scorecard comment + text-criterion
  values (cap in pure-core validateEvaluationScores), api-token name,
  upload filename -- same MAX_NAME/MAX_LONG constants. 426 WCAG AA is
  the THIRD mandate invariant (eval-findings:51); desktop-only,
  advisory (CONTRAST_BLOCKING=false), own module
  scripts/render-sweep-contrast.ts, never restructures render-sweep-lib.
  427 pubcache: DEC-399's global purge scope STAYS CLOSED; a kv.put
  rejection after a committed write is now logged not 500'd -- missing
  BINDING still throws. 428 SPEC.md:308's >=600k amended to binding
  DEC-004/237 100k. 429 npm audit: devDeps classified/closed in gate
  log, never carried; runtime-dep (hono/drizzle) advisory gets a lane.
