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
- STAGE1-CLOSE w11-14 (DEC-420..438, compacted): 426 WCAG AA THIRD
  mandate, desktop-only advisory; 430 contrast remedies change PIXELS
  never the instrument; 431/436 flip fires only in the flipping lane's
  OWN re-run; 428 SPEC.md:308 >=600k amended to 100k; 433 public ?page=
  TWO bounds (parsePage 1..50, boundedRowLimit 600, throws non-finite);
  434 ONE isDevMode(env) DEV_MODE==="1"; 435 formatRef ONLY ref builder;
  437/446 SPEC §10 items DEFERRED/CLOSED; 438 ledger names its sha,
  splits FAIL-unowned vs PENDING-OWNED, goalComplete needs both empty.
- STAGE1-CLOSE w15-16 (DEC-439..448, compacted): 439 perf-smoke FAILs
  are STAGE-1 defects, fix by loading less never restructuring. 440
  buildResults keeps JS aggregation; NEVER launder a throwing invariant
  into SQL. 441/446 SPEC §10 #3 shipped, #2/#4 CLOSED out-of-stage-1.
  442 cacheability REQUEST-shaped: skip cache only when URL HAS ?ids=.
  444 WCAG remedy = re-point CSS to var(--chq-muted); NEVER redefine
  --chq-disabled or touch the checker. 445 CONTRAST_BLOCKING flip: own
  run, all-PASS, flipping lane owns old-value test. 447 THE LEDGER
  TRAP: closing wave = exactly ONE source-changing lane, ledger behind
  it via dependsOn, other lanes log-only. 448 `npm run dev` + predev
  ensure-dev-vars is the ONLY zero-setup entrypoint -- never hand-`cp`
  .dev.vars or bare `npx wrangler dev`.
- STAGE1-CLOSE w17 (DEC-449..453): w16's ledger read PASS at S=235d677
  but w16-c's perf log (FAIL, reviewer queue 54-88ms vs 50ms budget)
  merged AFTER S -- a PASS ledger is evidence about ITS OWN sha only.
  453: never grade a MEASURED budget row from code presence; cite a
  perf run whose sha is an ancestor-or-equal of S, and re-read every
  evidence log that landed since the last ledger. 449: reviewer queue
  fixed by DELETING chunked per-90-id round-trips (track lookup gone --
  its one caller never read trackIds; countEvaluationsBySubmission
  loses its submissionIds param), never by paging/reshaping; a
  count(*) GROUP BY is NOT DEC-440 laundering (score aggregation only).
  450: airtable sync = ONE org, AIRTABLE_ORG_ID required, throws if
  token+base set without it; sync CODE correctness is stage-1 (DEC-435
  precedent), only its wiring is stage-2. 451: test/query-scoping-
  invariant.test.ts scans src for where-less Drizzle reads, allowlist
  ships EMPTY. 452: w17 is a FIX wave, two source lanes, NO ledger (a
  ledger behind one fix reports the other PENDING-OWNED); w18 closes
  under DEC-447, ledger cut behind the evidence lanes too.
