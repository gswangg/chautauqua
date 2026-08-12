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
  hash'; 012/013 route files export Hono sub-apps, errors {error:
  {code,message,fields?}}; 353 archive 40MB TOTAL-byte guard; bulk ops
  set-based/CLOSED. Gates LOG-ONLY.
- REDESIGN w1-5 (DEC-366..391, docs/design/README.md): FUNCTION FROZEN.
  Tokens: paper F4F1E8/surface FAF8F2/ink 1B1D17/muted 565A4B/hairline
  E1DDCE/border BAB6A6/olive 4E5C31, NO RED/shadows/new deps. styles.css+
  theme.ts=ONE lane; page lanes add .chq-<area>.css, never redefine
  shared class. ONE dialog contract, ONE phone switch @700px, 44px
  controls. D1 binds PRIMITIVES — epoch-ms NUMBER not `new Date()`.
- REDESIGN w6-8 (DEC-392..409): 393 tap floor 44px. 397 preview never
  mints credentials. 399 pubcache bump CLOSED. 400 overview wire:
  `triage`=v2 rows, `triage-counts`=v1 aggregate. 401 mobile pass
  measures max right edge+scrollWidth, names offenders. 402 every
  chq-table carries a page-prefixed 2nd class. 403 desktop sweep = SPA
  routes UNION no-login surfaces. 404/405 overflow-wrap:anywhere on
  shell, never document-level overflow-x:hidden. 408 public dates via
  src/lib/event-time.ts (throws, no UTC fallback). 409 2px olive focus
  ring in both stylesheet roots, outline:none banned.
- REDESIGN w9-10 (DEC-410..419): 410 control-class guard repo-wide
  (app/src only). 411 tsx/esbuild keepNames breaks page.evaluate
  closures -- every Playwright page gets addInitScript raw-string shim
  FIRST; gates log-only, never flip ADMIN_MOBILE_PASS_BLOCKING. 413
  portal dates use the OWNING EVENT's tz per ROW. 414 390px overflow:
  scroller or wrap, never hidden/sub-44px. 415 portal-edit writes
  job_title/company/bio to contact; never submission_answer/
  participant.*_at_time (DEC-258 frozen). 416 unknown track id rejected
  even with zero tracks offered. 417 ONE parseBoundedText in
  src/server/http.ts; caps NAME 200/TEXT 2000/LONG 20000/RICH 100000 in
  src/forms/validate.ts; oversized=400 naming field, never SQLITE_TOOBIG
  500. 418 public list queries: LIMIT+separate COUNT(DISTINCT) in SQL.
  419 gates re-run log-only; instrument failure never written as a
  number.
- STAGE1-CLOSE w11 (DEC-420..423): 420 reminder emails format due dates
  via formatEventDate(ms, event.timezone) and carry ONE LINE PER TASK
  with its own date -- never toISOString, never one aggregate date for
  a group. 421 the 10px type-floor is the mandate's SECOND render-sweep
  invariant (eval-findings:73) and never shipped; lands ADVISORY
  (FONT_FLOOR_BLOCKING=false, DEC-387 flip rule), desktop+390px, names
  offenders like DEC-401, runs only after the DEC-411 shim. 422 caps +
  public rate limits reach the two paths DEC-417's scope misses: public
  save-draft (no limiter at all, unmetered KV write) and POST
  /portal/profile (bio/title/company/socials unbounded -> SQLITE_TOOBIG
  500); reuse MAX_TEXT_LENGTH/MAX_LONG_TEXT_LENGTH, SSR reports oversize
  by re-rendering its OWN page 400 naming the field. 423 docs/
  verification-log/task-w11-{a..f}-*.md are ALREADY TAKEN by campaign 1
  (DEC-129 homonyms) -- a lane using the obvious name destroys another
  campaign's evidence; use the exact filename in your task text.
  Spec-audit emits the J1-J12 + §5-§8 ledger (VERIFIED file:line / GAP /
  STAGE-2 + OPEN ITEMS) that decides goalComplete.
