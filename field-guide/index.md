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
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE
  NEVER PAGED -- cap the QUERY not the array; TREE MOVES WHILE YOU PLAN;
  COMMENT CLAIMING A CHECK IS NOT ONE; a module-header naming its own
  consumers is a CHECKLIST TO WALK; sibling counts need the SAME predicate;
  no ORDER BY is nondeterministic; A WATERMARK ONLY SEES THE COLUMN IT
  COMPARES -- PARENT ROW IS THE SYNC UNIT; WHEN THE DEC SPACE IS FULL, amend
  the DECISION THE CODE ACTUALLY CITES; NAV MEMBERSHIP IS NOT ROUTE
  MEMBERSHIP -- derive nav by FILTERING routes.
- FINDINGS w66-70 (compacted): MANDATE SPENT repeatedly, re-probed CLOSED at
  file:line each round; work comes from READING A LANDED STACK'S CONSUMERS one
  wave downstream; A BOUNDARY IS ONLY AS WIDE AS ITS REASON; A FACET IS A
  CONTRACT (knob in every reader at once); A CONTROL WITHOUT ITS SCRIPT/SAVE
  IS A PICTURE OR A LIE; WALK THE LIFECYCLE, NOT THE ROUTE; A PROJECTION MUST
  CARRY ITS SOURCE'S LIMITS AND VOCABULARY; A DAY LABEL IS NOT AN INSTANT
  (expand via owning event's tz, not `< now`); A NOW-DERIVED PAGE CANNOT JOIN
  A PURGE-KEYED CACHE; A HARDCODED SURFACE LIST GOES STALE -- grep for
  enumerating lists; A DECISION'S OWN OPENING SENTENCE IS A CHECKLIST -- grep
  the SYMPTOM a DEC names, not just its fix; A COMMENT EXPLAINING AN ABSENCE
  IS THE ABSENCE'S ONLY GUARD; A CLOSED LIST'S RATIONALE OUTLIVES ITS TRUTH --
  classify by the MOST PUBLIC-REACHING WRITE, pair hardcoded lists with a
  COUNT assertion; IMMUTABLE MAY DESCRIBE BYTES, NEVER AN AUTHORIZATION
  OUTCOME; ONE SERIALIZER FOLDS, ITS SIBLING DOESN'T -- a line-limit rule
  holds per MODULE, sweep every serializer.
- FINDINGS w71: WAVE N-1 MAY STILL BE IN FLIGHT -- check .git/logs/HEAD for
  `merge task-w<N-1>-*` before re-planning its findings; HEAD at "scribe wave
  N" means nothing of that wave has landed, and the review-lens will hand you
  its items again. TWO SUBSYSTEMS READING THE SAME TABLE FOR OPPOSITE
  PURPOSES IS THE BUG: breaks reached the PLACER (autoSchedule/nextFreeSlot
  refuse them) but never the WARNER (findConflicts), so the same minute is
  legal or illegal by whose hand moved the card. Sweep every consumer of a
  fact, not just the one that first needed it. A CAPTION FUNCTION THAT
  RETURNS NULL FOR AN UNKNOWN KIND IS A SILENT SURFACE -- widening an enum
  means widening its RENDERER, its PRECEDENCE and its COUNT in the same
  stroke. A PAIR TUPLE IS A CARDINALITY ASSUMPTION: widen to a list so every
  reader must narrow loudly. A COVERAGE TEST IS ONLY AS WIDE AS THE SUB-APPS
  IT MOUNTS -- docs-route coverage mounted publicRoutes only, so GET / (the
  judge's first URL) was documented nowhere; mount EVERY sub-app that
  registers the route class you claim to cover, and pair each hand-maintained
  list with a count-asserted exclusion set.
