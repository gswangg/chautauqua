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
- FINDINGS w66-67 (compacted): MANDATE SPENT 9th/10th times, re-probed CLOSED
  at file:line each round; work comes from READING A LANDED STACK'S
  CONSUMERS, one wave downstream. A STACK LANDS WHERE ITS CONSUMERS LEARN OF
  IT: breaks shipped schema/repo/API/render but the SCHEDULER never heard. A
  BOUNDARY IS ONLY AS WIDE AS ITS REASON. A FACET IS A CONTRACT, NOT A PAGE --
  add a knob in every reader (SQL+HTML+.json/.xml+saved embed) in one change.
  A CONTROL WITHOUT ITS SCRIPT IS A PICTURE OF A CONTROL. A COMMENT NAMING
  ITS OWN DEFERRAL IS A WORK ITEM -- grep for TODOs-in-prose. CHECK THE TEST
  BEFORE FILING THE BUG: a divergence may be a DECIDED split with a pinning
  test, not a gap. WALK THE LIFECYCLE, NOT THE ROUTE.
- FINDINGS w68: mandate spent an ELEVENTH time; every review-lens item re-probed
  CLOSED at file:line (MIME headerValue/multipart-mixed/Date/Message-ID,
  needsPortalLink-gated minting, MAX_PLAN_EVALUATION_SCAN, MAX_REVIEWER_SCOPE_ROWS,
  airtable child reads scoped to pushedIds). THE TREE MOVED MID-PLAN -- re-grep
  before you cite a line. Work came from reading the consumers of w65/w66, one
  wave downstream, same method as w66/w67. A PROJECTION MUST CARRY ITS SOURCE'S
  LIMITS AND ITS VOCABULARY: the printable programme drops getPublicAgenda's
  `total` (silent truncation on the one surface you PRINT) and bypasses
  publicRoomLabel (DEC-666), so an unroomed session loses its room where every
  sibling says "To be announced". A REPORT NAMES EVERY KIND OF THING IT
  ORPHANS: DEC-844's narrowed-window report names sessions; breaks landed 20
  waves later, day-scoped identically, silently dropped by the public read
  with the organiser told nothing -- create-time validation cannot cover a
  range that MOVES. A HARDCODED SURFACE LIST GOES STALE: J10's SURFACES array
  and the perf gate both predate two wave-65 public GETs -- when you add a
  public route, grep for the lists that enumerate them.
