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
- FINDINGS w32-54 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC, compacted): re-probe, grep "no matches"
  is a fact about that minute only. DECISION DOC != FIX; MINTING IS IO;
  boundary fails per RECIPIENT never REQUEST; batch the FRONTIER not
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE
  NEVER PAGED -- cap the QUERY not the array; TREE MOVES WHILE YOU PLAN;
  COMMENT CLAIMING A CHECK IS NOT ONE.
- FINDINGS w55-63 (compacted): re-read before reserve; sweep every writer of a
  table a unique index lands on; JS cap over unbounded read -> count/slice in
  SQL; a decision/module-header naming its own consumers is a checklist to
  WALK; MANDATE SPENT repeatedly; sibling counts need the SAME predicate; no
  ORDER BY is nondeterministic; A WATERMARK ONLY SEES THE COLUMN IT COMPARES
  -- PARENT ROW IS THE SYNC UNIT; open work found in docs/design/ read as a
  CHECKLIST; A PARAM THE ROUTE PASSES AND THE PAGE HIDES IS A FEATURE NOBODY
  CAN REACH; WHEN THE DEC SPACE IS FULL, amend the DECISION THE CODE ACTUALLY
  CITES; A PACK THAT ARRIVES MID-WAVE IS NOT SELF-APPLYING; A FIX CAN CARRY
  ITS OWN BUG; THE WAY IN IS PART OF THE FEATURE; NAV MEMBERSHIP IS NOT ROUTE
  MEMBERSHIP -- derive nav by FILTERING routes.
- FINDINGS w66-68 (compacted): MANDATE SPENT repeatedly, re-probed CLOSED at
  file:line each round; work comes from READING A LANDED STACK'S CONSUMERS,
  one wave downstream. A STACK LANDS WHERE ITS CONSUMERS LEARN OF IT (breaks
  shipped schema/repo/API/render but scheduler/printable-programme/public-read
  each learned late). A BOUNDARY IS ONLY AS WIDE AS ITS REASON. A FACET IS A
  CONTRACT -- add a knob in every reader (SQL+HTML+.json/.xml+embed) at once.
  A CONTROL WITHOUT ITS SCRIPT IS A PICTURE OF A CONTROL. A COMMENT NAMING ITS
  OWN DEFERRAL IS A WORK ITEM. CHECK THE TEST BEFORE FILING THE BUG. WALK THE
  LIFECYCLE, NOT THE ROUTE. A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND
  VOCABULARY (dropped `total`, bypassed publicRoomLabel). A REPORT NAMES EVERY
  KIND OF THING IT ORPHANS -- create-time validation cannot cover a range that
  MOVES. A HARDCODED SURFACE LIST GOES STALE -- grep for enumerating lists.
- FINDINGS w69: w68 a-d LANDED MID-PLAN (programme total+room grammar,
  breaksOutsideWindow) -- re-read after every merge window, not once per
  wave. A REPORT NEEDS A SCREEN THAT CAN ANSWER IT: DEC-844 names breaks
  stranded by a date move, but the only panel that can delete one is scoped
  to a day inside the window -- naming a thing the product cannot reach is
  half a feature. A CONTROL THAT LIES IS WORSE THAN A DEAD ONE: embedded
  agenda's Save flips to "Saved" by CSS with no script; phone list has no
  Save while its desktop twin has one -- one rule (itinerary = !embed, both
  renderings) settles both. A DAY LABEL IS NOT AN INSTANT: `endDate < now`
  archives a running event on its own final morning; expand via
  dayLabelEndInstant in the OWNING event's tz. TWO IMPLEMENTATIONS OF ONE
  SENTENCE: SPA daysUntil vs root.tsx's ms division disagree on "N days
  left". A NOW-DERIVED PAGE CANNOT JOIN A PURGE-KEYED CACHE -- bounded TTL
  instead. AN AGGREGATE ASKED ABOUT ROWS NOBODY RENDERS IS PAID BY 404S TOO.
