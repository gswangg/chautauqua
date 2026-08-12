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
  bulk ops set-based/CLOSED, gates LOG-ONLY.
- REDESIGN w1-5 (DEC-366..391): FUNCTION FROZEN. Tokens: paper F4F1E8/
  surface FAF8F2/ink 1B1D17/muted 565A4B/hairline E1DDCE/border BAB6A6/
  olive 4E5C31, NO RED/shadows/new deps. styles.css+theme.ts=ONE lane;
  page lanes add .chq-<area>.css, never redefine shared class. ONE dialog
  contract, ONE phone switch @700px, 44px controls, D1 binds PRIMITIVES
  -- epoch-ms NUMBER not `new Date()`.
- REDESIGN w6-10 (DEC-392..419): 393 tap floor 44px; 397 preview never
  mints creds; 399/427 pubcache scope CLOSED; 401/414/424 390px overflow
  via scroller/wrap (real spill = scrollWidth>clientWidth); 404/405
  overflow-wrap:anywhere never overflow-x:hidden; 409 2px olive focus
  ring, outline:none banned; 411 addInitScript shim FIRST every
  Playwright page (keepNames breaks page.evaluate); 413/408/420 dates via
  event-time.ts/formatEventDate, OWNING EVENT's tz, throws (never
  toISOString); 415 portal-edit writes job_title/company/bio to contact
  only; 416 unknown track id rejected w/ zero tracks; 417/425/433 ONE
  parseBoundedText in src/server/http.ts, oversized=400 never 500; 418
  public lists LIMIT+separate COUNT(DISTINCT); 419/429 gates log-only.
- STAGE1-CLOSE w11-13 (DEC-420..432): 421 10px floor advisory (DEC-387
  flip); 422 caps+rate limits public save-draft/portal-profile; 423/429
  verification-log filenames ALREADY TAKEN by campaign 1 -- suffix -stage1;
  426 WCAG AA THIRD mandate, desktop-only advisory, own module
  render-sweep-contrast.ts; 428 SPEC.md:308 >=600k amended to 100k; 430
  contrast remedies change PIXELS never the instrument; 431 flip fires
  only in the flipping lane's OWN re-run; 432 scope in the WHERE
  (inArray+chunkIds). goalComplete decided by spec-audit citations only.
- STAGE1-CLOSE w14 (DEC-433..438): 433 public ?page= takes TWO bounds:
  parsePage clamps 1..MAX_PUBLIC_PAGE=50, boundedRowLimit caps
  MAX_PUBLIC_ROWS=600, THROWS on non-finite. 434 ONE isDevMode(env) in
  src/server/env.ts (DEV_MODE==="1" only). 435 formatRef is the ONLY ref
  builder. 436 CONTRAST_BLOCKING flips only from the flipping lane's OWN
  all-PASS run; that lane owns the old-value test. 437 SPEC §10 #2/#3/#4
  DEFERRED-BY-DECISION. 438 ledger names its sha, splits FAIL-unowned vs
  PENDING-OWNED; goalComplete needs both empty.
- STAGE1-CLOSE w15 (DEC-439..443): w14 merged DURING planning (a-d landed
  mid-read) -- 433/434/435 are IN main, re-read before touching. Real
  unowned work was task-w13-d-perf-smoke-stage1.md RESULT:FAIL, 3 items:
  all "load the whole plan/event, then slice". 439 those are STAGE-1
  defects (SPEC:331 over-budget route IS a bug; perf ranks FIRST SPEC:36),
  fix by loading less, never restructuring. 440 buildResults keeps JS
  aggregation -- aggregateSubmission/aggregateDropdownCriterion THROW on
  missing scores, SQL aggregates silently coerce NULL; NEVER launder a
  throwing invariant into SQL. 441 §10 #3 ships, #2 waits one wave (would
  reuse buildResults while w15-b rewrites it), #4 stays deferred. 442
  cacheability is REQUEST-shaped not path-shaped: bare schedule.ics ==
  agenda.ics work but uncached (80-216ms vs 4-11ms) -- skip cache only
  when URL HAS ?ids=. 443 CONTRAST_BLOCKING flip passes to w15 build/test
  lane, DEC-436 rule unchanged. New /api/v1 routes ship docs.tsx rows
  (BLOCKING test); new SPA routes ship routeManifest.ts rows.
