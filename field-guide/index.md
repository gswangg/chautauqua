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
  page lanes add .chq-<area>.css only; ONE dialog contract, phone
  switch @700px, 44px controls; D1 binds PRIMITIVES (epoch-ms NUMBER);
  overflow via scroller/wrap not overflow-x:hidden; 2px olive focus
  ring, outline:none banned; addInitScript shim FIRST Playwright page;
  dates via event-time.ts, OWNING EVENT's tz, never toISOString; ONE
  parseBoundedText, 400 never 500; public lists LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-17 (DEC-420..453, compacted): 426 WCAG AA THIRD;
  428 SPEC.md:308 >=600k amended to 100k; 433 public ?page= TWO
  bounds; 434 ONE isDevMode(env); 438 ledger names its sha, splits
  FAIL-unowned vs PENDING-OWNED; 440 buildResults JS aggregation never
  SQL; 444/445 WCAG remedy re-points CSS vars only; 447 LEDGER TRAP:
  closing wave = exactly ONE source-changing lane, ledger behind it;
  448 `npm run dev` ONLY zero-setup entrypoint; a PASS ledger is
  evidence about ITS OWN sha only; 453 never grade a MEASURED budget
  row from code presence, cite a perf run sha ancestor-or-equal of S;
  449 fix perf by DELETING chunked round-trips not paging; 450
  airtable sync = ONE org via AIRTABLE_ORG_ID; 451 query-scoping-
  invariant allowlist ships EMPTY; 452 fix waves cut NO ledger.
- STAGE1-CLOSE w18 (DEC-454..459, compacted): CALL-SITE PRESENCE !=
  coverage -- three unowned defects survived a PASS ledger graded that
  way. 454 ONE email rule, src/domain/email.ts normalizeEmail+
  isValidEmail, at EVERY contact.email write/lookup. 455 required =
  NON-BLANK, trim()==="" is ABSENT. 456 account lookup is
  findAccountUserId(contactId OR email) NEVER email alone; old lookups
  DELETED; patchContact cascades user.email or conflicts. 457 KV keys
  never carry raw external input -- boundRateLimitId. 459 "all"/
  "every"/"never" rows graded from an ENUMERATION, never a sample.
- STAGE1-CLOSE w19 (DEC-460..464): w18 landed all five lanes (email
  rule, findAccountUserId+cascade, bounded KV keys, 157-route authz
  enumeration 0 GAP, 214-probe hostile-input sweep 0 findings) --
  verify in the TREE, branch refs survive merges and say nothing. 460:
  "server pagination on all admin lists" was graded from clampPage's
  unit test for 16 waves; w17-f's enumeration found 14 /api/v1 list
  envelopes with no LIMIT -- all get a real bound, NO "naturally
  small" exemptions. 461: ONE shape -- optional `page?:{limit,offset}`
  on the existing repo fn (absent = unbounded, internal callers
  unchanged), sibling count* for total, ORDER BY ending `id asc`,
  route default perPage 200; MANDATORY limit on listPlansForEvent
  would break files-authz. 462: last unvalidated contact.email write
  is manual session creation. 463: react-router v6 advisories =
  NOT-APPLICABLE (client-only SPA, no RouterProvider/SSR) -- closed.
  464: w19 has five source lanes so NO ledger; w20 closes under
  DEC-447's shape, grades pagination from 460's list, authz/input from
  w18's enumerations.
