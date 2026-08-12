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
- STAGE1-CLOSE w11-16 (DEC-420..448, compacted): 426 WCAG AA THIRD
  mandate; 428 SPEC.md:308 >=600k amended to 100k; 433 public ?page=
  TWO bounds; 434 ONE isDevMode(env); 438 ledger names its sha, splits
  FAIL-unowned vs PENDING-OWNED. 440 buildResults keeps JS aggregation,
  never launder a throwing invariant into SQL. 444/445 WCAG remedy
  re-points CSS vars, never the checker outside the flipping lane's
  own run. 447 THE LEDGER TRAP: closing wave = exactly ONE
  source-changing lane, ledger behind it, other lanes log-only. 448
  `npm run dev` is the ONLY zero-setup entrypoint.
- STAGE1-CLOSE w17 (DEC-449..453): w16's ledger read PASS at S=235d677
  but w16-c's perf log (FAIL, reviewer queue) merged AFTER S -- a PASS
  ledger is evidence about ITS OWN sha only. 453: never grade a
  MEASURED budget row from code presence; cite a perf run whose sha is
  an ancestor-or-equal of S. 449: reviewer queue fixed by DELETING
  chunked per-90-id round-trips, never by paging/reshaping. 450:
  airtable sync = ONE org, AIRTABLE_ORG_ID required. 451: query-
  scoping-invariant.test.ts allowlist ships EMPTY. 452: w17 is a FIX
  wave, NO ledger.
- STAGE1-CLOSE w18 (DEC-454..459): w16's PASS ledger graded input-
  validation and authz rows from CALL-SITE PRESENCE; three unowned
  defects survived it. 454: ONE email rule -- src/domain/email.ts
  normalizeEmail+isValidEmail (/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/,
  <=254, local<=64) at EVERY contact.email write and lookup. 455:
  required means NON-BLANK -- a string whose trim is "" is ABSENT in
  validateAnswers (a whitespace email became "" and bound two
  submitters to one contact). 456: "has this contact an account?" is
  findAccountUserId(contactId OR email), NEVER email alone;
  findUserIdByEmail/findUserByEmail DELETED; patchContact cascades
  user.email or throws conflict; merge deliberately excluded. 457: KV
  keys never carry raw external input -- scopedRateLimitKey bounds via
  boundRateLimitId (claim/draft keys already hash). 458: w18 has THREE
  fix lanes so it is NOT the closing wave (DEC-452 superseded); NO
  ledger before w19, and w19 cuts its own behind its own evidence. 459:
  a ledger row saying "all"/"every"/"never" is graded from an
  ENUMERATION of the whole population with a per-member citation, never
  a sample; the enumeration is its own lane.
