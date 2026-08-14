# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-31 (DEC-002..982, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; pagination ONE shape+count*+`id asc`; atomic SQL beats
  read-then-write; uniqueIndex CONTRACT; negation skips NULLs; irreversible
  action a PAGE naming what goes AND what it refuses; decision with no code
  a LIE; submitted blank CLEARS, absent key is silence; a per-row count is N
  scans; a JOIN row cascades on contact delete.
- FINDINGS w32-63 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC, heavily compacted): re-probe, grep "no
  matches" is a fact about that minute only. DECISION DOC != FIX; MINTING IS
  IO; boundary fails per RECIPIENT never REQUEST; batch the FRONTIER not
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX (sweep every writer of
  a table it lands on); UNBOUNDED SURFACE NEVER PAGED -- cap the QUERY not
  the array; TREE MOVES WHILE YOU PLAN; COMMENT CLAIMING A CHECK IS NOT ONE;
  JS cap over unbounded read -> count/slice in SQL; a module-header naming
  its own consumers is a CHECKLIST TO WALK; sibling counts need the SAME
  predicate; no ORDER BY is nondeterministic; A WATERMARK ONLY SEES THE
  COLUMN IT COMPARES -- PARENT ROW IS THE SYNC UNIT; A PARAM THE ROUTE PASSES
  AND THE PAGE HIDES IS A FEATURE NOBODY CAN REACH; WHEN THE DEC SPACE IS
  FULL, amend the DECISION THE CODE ACTUALLY CITES; A FIX CAN CARRY ITS OWN
  BUG; NAV MEMBERSHIP IS NOT ROUTE MEMBERSHIP -- derive nav by FILTERING
  routes.
- FINDINGS w66-69 (compacted): MANDATE SPENT repeatedly, re-probed CLOSED at
  file:line each round; work comes from READING A LANDED STACK'S CONSUMERS
  one wave downstream; a STACK LANDS WHERE ITS CONSUMERS LEARN OF IT; A
  BOUNDARY IS ONLY AS WIDE AS ITS REASON; A FACET IS A CONTRACT (add a knob
  in every reader at once); A CONTROL WITHOUT ITS SCRIPT/SAVE IS A PICTURE
  OR A LIE; A COMMENT NAMING ITS OWN DEFERRAL IS A WORK ITEM; WALK THE
  LIFECYCLE, NOT THE ROUTE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND
  VOCABULARY; A REPORT NEEDS A SCREEN THAT CAN ANSWER IT / NAMES EVERY KIND
  OF THING IT ORPHANS; A DAY LABEL IS NOT AN INSTANT (expand via owning
  event's tz, not `< now`); A NOW-DERIVED PAGE CANNOT JOIN A PURGE-KEYED
  CACHE; AN AGGREGATE ASKED ABOUT ROWS NOBODY RENDERS IS PAID BY 404S TOO;
  A HARDCODED SURFACE LIST GOES STALE -- grep for enumerating lists.
- FINDINGS w70: MANDATE SPENT (13th) -- every sampled eval-findings item
  re-probed CLOSED at file:line (scorecard reconciliation line, aria-pressed
  vs role=radio, "Add a room or track", conditional CFP logic, reviewer 403
  shell fetch, embed .ics picker). A DECISION'S OWN OPENING SENTENCE IS A
  CHECKLIST: DEC-040 opens "the public form posts without enctype" and fixed
  ONE form; the portal task form still does it -- grep the SYMPTOM a DEC
  names, not just its fix. A COMMENT EXPLAINING AN ABSENCE IS THE ABSENCE'S
  ONLY GUARD ("no file -- the POST has no upload path"). A CLOSED LIST'S
  RATIONALE OUTLIVES ITS TRUTH: pubcache's "no public route renders a
  submission's files" predates DEC-020's reopen; classify by the MOST
  PUBLIC-REACHING WRITE and pair any hardcoded surface list with a COUNT
  assertion over its call sites. IMMUTABLE MAY DESCRIBE BYTES, NEVER AN
  AUTHORIZATION OUTCOME -- and a route outside the purge key space cannot
  buy back a header it already issued. ONE SERIALIZER FOLDS, ITS SIBLING
  DOESN'T (ics.ts 75-octet vs email-binding's unwrapped base64): a
  line-limit rule holds per MODULE -- sweep every serializer.
