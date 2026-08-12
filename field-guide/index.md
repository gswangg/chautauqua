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
  {error:{code,message,fields?}}; bulk ops set-based/CLOSED, gates
  LOG-ONLY.
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens paper F4F1E8/
  surface FAF8F2/ink 1B1D17/muted 565A4B/hairline E1DDCE/border BAB6A6/
  olive 4E5C31, NO RED/shadows/new deps; styles.css+theme.ts=ONE lane,
  page lanes add .chq-<area>.css only; ONE dialog contract, phone switch
  @700px, 44px controls; D1 binds PRIMITIVES (epoch-ms NUMBER); overflow
  via scroller/wrap not overflow-x:hidden; 2px olive focus ring,
  outline:none banned; addInitScript shim FIRST every Playwright page;
  dates via event-time.ts, OWNING EVENT's tz, throws never toISOString;
  ONE parseBoundedText, oversized=400 never 500; public lists
  LIMIT+separate COUNT(DISTINCT).
- STAGE1-CLOSE w11-14 (DEC-420..438): 426 WCAG AA THIRD mandate,
  desktop-only advisory, render-sweep-contrast.ts; 430 contrast
  remedies change PIXELS never the instrument; 431/436 flip fires only
  in the flipping lane's OWN re-run, that lane owns the old-value test;
  428 SPEC.md:308 >=600k amended to 100k; 433 public ?page= TWO bounds
  (parsePage clamps 1..50, boundedRowLimit caps 600, throws on
  non-finite); 434 ONE isDevMode(env) DEV_MODE==="1" only; 435
  formatRef ONLY ref builder; 437/446 SPEC §10 items DEFERRED-BY-
  DECISION/CLOSED; 438 ledger names its sha, splits FAIL-unowned vs
  PENDING-OWNED, goalComplete needs both empty.
- STAGE1-CLOSE w15 (DEC-439..443): w14 merged DURING planning -- re-
  read before touching. 439 the 3 perf-smoke FAILs are STAGE-1 defects,
  fix by loading less never restructuring. 440 buildResults keeps JS
  aggregation (throws on missing scores); NEVER launder a throwing
  invariant into SQL. 441 §10 #3 ships, #2/#4 deferred (CLOSED by 446).
  442 cacheability REQUEST-shaped not path-shaped: skip cache only when
  URL HAS ?ids=. New /api/v1 routes ship docs.tsx rows; new SPA routes
  ship routeManifest.ts rows.
- STAGE1-CLOSE w16 (DEC-444..448): tree moved TWICE mid-plan -- w15
  b/c/d/e/f landed while reading, only task-w15-a still in flight;
  re-read before touching anything w15 owned. Only real unowned FAIL
  left on main was the WCAG offender w15-e named: /admin/submissions/
  forms td, --chq-disabled #8E8A7A on paper, 3.06 < 4.5. 444 remedy =
  re-point .chq-forms-field-locked (app/src/styles.css ~1147) and
  .chq-forms-settings-title (forms.css ~130) to var(--chq-muted)
  (~6.2:1); NEVER redefine --chq-disabled (frozen, WCAG-exempt), NEVER
  touch the checker. 445 flip passes to w16 build/test lane, DEC-436
  rule unchanged: own run, all-PASS, flipping lane owns old-value test.
  446 SPEC §10 #2 + #4 CLOSED out-of-stage-1 (schema changes -- no track
  capacity column, status set frozen at five literals); ledgers score
  them DEFERRED-BY-DECISION forever. 447 THE LEDGER TRAP: 3 ledgers in
  a row read NOT PASS only because cut before their own wave's fix --
  a closing wave dispatches exactly ONE source-changing lane, orders
  the ledger behind it with dependsOn; all other lanes log-only (own no
  SPEC item, can never be PENDING-OWNED). 448 `npm run dev` + predev
  ensure-dev-vars is the ONLY zero-setup entrypoint -- prior
  walkthroughs did `cp .dev.vars.example` + bare `npx wrangler dev`,
  bypassing SPEC:44; lanes needing a port pass it through npm run dev.
