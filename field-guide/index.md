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
- REDESIGN w6-10 (DEC-392..419): 393 tap floor 44px; 397 preview never
  mints creds; 399/427 pubcache scope CLOSED; 401/414/424 390px overflow
  via scroller/wrap (excl. ancestor overflow-x:auto|scroll, real spill =
  scrollWidth>clientWidth); 404/405 overflow-wrap:anywhere never
  overflow-x:hidden; 409 2px olive focus ring, outline:none banned; 411
  addInitScript shim FIRST every Playwright page (keepNames breaks
  page.evaluate); 413/408/420 dates via event-time.ts/formatEventDate,
  OWNING EVENT's tz, throws (never toISOString); 415 portal-edit writes
  job_title/company/bio to contact only; 416 unknown track id rejected
  w/ zero tracks; 417/425/433 ONE parseBoundedText in src/server/http.ts,
  caps NAME/TEXT/LONG/RICH, oversized=400 never 500; 418 public lists
  LIMIT+separate COUNT(DISTINCT); 419/429 gates log-only, never a number.
- STAGE1-CLOSE w11-13 (DEC-420..432): 421 10px floor advisory (DEC-387
  flip); 422 caps+rate limits public save-draft/portal-profile; 423/429
  verification-log filenames ALREADY TAKEN by campaign 1 (DEC-129) --
  suffix -stage1; 426 WCAG AA THIRD mandate, desktop-only advisory, own
  module render-sweep-contrast.ts; 428 SPEC.md:308 >=600k amended to
  100k; 430 contrast remedies change PIXELS never the instrument (NEVER
  add aria-hidden/decorative exemptions to the sweep script); 431 flip
  fires only in the flipping lane's OWN re-run, never a prior transcript;
  432 scope in the WHERE (inArray+chunkIds; GROUP BY/HAVING counts).
  goalComplete decided by task-wN-f-spec-audit-stage1.md citations only.
- STAGE1-CLOSE w14 (DEC-433..438): at plan time w13 had NOT merged (reflog
  tip=task-custodian-w12-3, all 3 BLOCKING flags still false) -- VERIFY the
  tree, never a summary. 433 public ?page= takes TWO bounds: parsePage clamps
  1..MAX_PUBLIC_PAGE=50 (cache-key cardinality; Number.isInteger(1e308) is
  TRUE so LIMIT Infinity reached SQL) and boundedRowLimit(page,perPage) caps
  MAX_PUBLIC_ROWS=600 and THROWS on non-finite (bytes, survives ?limit=100);
  Show more stops rendering at the cap. 434 ONE isDevMode(env) in
  src/server/env.ts (DEV_MODE==="1", nothing else) -- makeMailer's truthiness
  made DEV_MODE="0" a silent sink; NO new throw, test envs omit DEV_MODE. 435
  formatRef is the ONLY ref builder; airtable.ts's `SES-` hardcode broke SPEC
  §5 per-event prefixes (code repair only -- live sync/creds stay stage-2).
  436 CONTRAST_BLOCKING flips only from the flipping lane's OWN all-PASS run;
  the lane that flips a constant owns the test asserting its old value. 437
  SPEC §10 #2/#3/#4 are DEFERRED-BY-DECISION, not gaps (#1/#5/#6/#7 shipped).
  438 the ledger names its sha S and splits open items FAIL-unowned vs
  PENDING-OWNED(DEC+branch); goalComplete needs BOTH empty. All w14 logs carry
  the -stage1 suffix (campaign-1 task-w14-*.md homonyms already exist).
