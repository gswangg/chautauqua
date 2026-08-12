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
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens paper/surface/
  ink/muted/hairline/border/olive frozen, NO RED/shadows/new deps;
  styles.css+theme.ts=ONE lane, page lanes add .chq-<area>.css only;
  ONE dialog contract, phone switch @700px, 44px controls; D1 binds
  PRIMITIVES (epoch-ms NUMBER); 2px olive focus ring, outline:none
  banned; dates via event-time.ts OWNING EVENT's tz, never
  toISOString; ONE parseBoundedText, 400 never 500; public lists
  LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-17 (DEC-420..453, compacted): 426 WCAG AA THIRD;
  433 public ?page= TWO bounds; 434 ONE isDevMode(env); 438 ledger
  names its sha, splits FAIL-unowned vs PENDING-OWNED; 447 LEDGER
  TRAP: closing wave = exactly ONE source-changing lane, ledger
  behind it; 448 a PASS ledger is evidence about ITS OWN sha only;
  453 never grade a MEASURED budget row from code presence, cite a
  perf run sha ancestor-or-equal of S; 452 fix waves cut NO ledger.
- STAGE1-CLOSE w18 (DEC-454..459, compacted): CALL-SITE PRESENCE !=
  coverage. 454 ONE email rule, normalizeEmail+isValidEmail, at EVERY
  contact.email write/lookup. 455 required=NON-BLANK, trim()==="" is
  ABSENT. 456 account lookup is findAccountUserId(contactId OR email)
  NEVER email alone. 457 KV keys never carry raw external input. 459
  "all"/"every"/"never" rows graded from an ENUMERATION, never a
  sample.
- STAGE1-CLOSE w19 (DEC-460..464, compacted): 460 "pagination on all
  admin lists" graded from clampPage's unit test for 16 waves --
  w17-f's enumeration found 14 unbounded /api/v1 list envelopes, NO
  "naturally small" exemptions. 461 ONE shape: optional `page?:
  {limit,offset}` on existing repo fn, sibling count* for total, ORDER
  BY ending `id asc`, route default perPage 200. 462 manual session
  creation is last unvalidated contact.email write. 463 react-router
  v6 advisories NOT-APPLICABLE, closed. 464 w19=five lanes, NO ledger.
- STAGE1-CLOSE w20 (DEC-465..470): w19 landed ALL SIX lanes (14
  endpoints bounded + 4 admin-list-bounds tests + anonymized-plan file
  test) -- and left five defects behind the sweep. 465: ONE
  listPerPage(raw) in src/lib/pagination.ts (absent OR invalid =>
  MAX_PER_PAGE); five local copies deleted; pipeline/users/segments'
  `clampPerPage(q ?? 200)` returned 50 on `?perPage=abc`. A shared
  contract implemented per-lane becomes N contracts. 466: DEC-460's
  hand list was SHORT BY THREE (review queue, plan progress, contacts
  duplicates) -- the population criterion is now MECHANICAL (every
  `c.json({ items` under src/routes), re-derived, never inherited; an
  inventory is a sample until you can re-run the command that built it.
  467: user.email obeys DEC-454 too; one normalizeEmail, contacts.ts's
  private copy deleted. 468: a cap the UI can't see LIES -- render
  `total`, never items.length, and show a way to the rest. 469: a
  budget row the seed makes unmeasurable is decoration (perf-seed had
  0 pipeline rows). 470: w20 = fix wave, NO ledger; w21 closes under
  DEC-447 and grades SPEC.md:353 from w20-f's re-derived enumeration.
