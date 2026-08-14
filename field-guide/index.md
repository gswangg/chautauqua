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
  CITES; A PACK THAT ARRIVES MID-WAVE IS NOT SELF-APPLYING; A DEC NAMING A
  MEASUREMENT NAMES THE FRAME IT WAS MEASURED FROM -- amend when a new frame
  arrives; A FIX CAN CARRY ITS OWN BUG; THE WAY IN IS PART OF THE FEATURE;
  NAV MEMBERSHIP IS NOT ROUTE MEMBERSHIP -- derive nav by FILTERING routes.
- FINDINGS w66 (compacted): MANDATE SPENT A NINTH TIME, re-probed CLOSED at
  file:line. New work came from READING A LANDED STACK'S CONSUMERS. A STACK
  LANDS WHERE ITS CONSUMERS LEARN OF IT: breaks shipped schema/repo/API/
  public render, the SCHEDULER never heard (autoSchedule/nextFreeSlot share
  scanForFreeSlot, neither sees a break). A BOUNDARY IS ONLY AS WIDE AS ITS
  REASON: DEC-022's export exclusion was aimed at PUBLIC feeds, not the
  producer's run-of-show. A LAYOUT CASE NEEDS DATA TO EXIST -- seed the
  concurrency in the same round as the grid. WALK THE LIFECYCLE, NOT THE
  ROUTE; assert on LABEL TEXT when another lane owns the markup.
- FINDINGS w67: mandate spent a TENTH time (MIME/minting/scan caps all live at
  file:line; home hub, contactIds scoping, Reopen-this-task, saved embeds, fit/
  rationale, pipeline age all built). Work came from reading the CONSUMERS of
  what w64/w65 landed — the same method as w66, one wave downstream. A FACET IS
  A CONTRACT, NOT A PAGE: w64 gave /speakers a track facet in SQL+HTML, left
  the .json/.xml twin, knob table and saved embed behind — add a knob in all
  four readers in the same change. A CONTROL WITHOUT ITS SCRIPT IS A PICTURE
  OF A CONTROL: agenda's Save checkbox rendered since w64 with no
  ItineraryScript on that surface — three siblings render it, one was missed,
  nothing persisted, markup looked right. A COMMENT NAMING ITS OWN DEFERRAL IS
  A WORK ITEM: "out of scope this wave" (BreaksPanel), "until the agenda gains
  its own rail" (sessions rail) — grep for TODOs-in-prose before inventing
  work. CHECK THE TEST BEFORE FILING THE BUG: the agenda feed/page divergence
  looked like the speakers gap but was a DECIDED split with a test pinning it.
