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
- FINDINGS w55-63 (compacted): re-read before reserve; mandate can run out ->
  read repos; sweep every writer of a table a unique index lands on; JS cap
  over unbounded read -> count/slice in SQL; a decision/module-header naming
  its own consumers/cascade is a checklist to WALK, not a guard itself;
  MANDATE SPENT repeatedly, re-probed CLOSED at file:line each wave; sibling
  counts need the SAME predicate; no ORDER BY is nondeterministic; A
  WATERMARK ONLY SEES THE COLUMN IT COMPARES -- PARENT ROW IS THE SYNC UNIT;
  eval-findings re-probed CLOSED repeatedly, open work found in docs/design/
  read as a CHECKLIST; A PARAM THE ROUTE PASSES AND THE PAGE HIDES IS A
  FEATURE NOBODY CAN REACH; WHEN THE DEC SPACE IS FULL, amend the DECISION
  THE CODE ACTUALLY CITES; A PACK THAT ARRIVES MID-WAVE IS NOT
  SELF-APPLYING -- re-read vendored packs, don't trust "landed"; A DEC
  NAMING A MEASUREMENT NAMES THE FRAME IT WAS MEASURED FROM -- amend when a
  new frame arrives; A FIX CAN CARRY ITS OWN BUG; THE WAY IN IS PART OF THE
  FEATURE -- breaks shipped schema/repo/API/docs and zero UI; NAV
  MEMBERSHIP IS NOT ROUTE MEMBERSHIP -- derive nav by FILTERING routes.
- FINDINGS w66: MANDATE SPENT A NINTH TIME — re-probed CLOSED at file:line
  (MIME Date/Message-ID/mixed, conditional minting, MAX_PLAN_*_SCAN, merge
  Keeping/Discarding + Labels/Notes, create-time dup hint, DateField scan-lock,
  reviewer-shell 403 skip, pubcache two-list incl. breaks, exports csv+json,
  clone, cron, fit/rationale, .ics SEQUENCE on every writer). New work came
  from READING A LANDED STACK'S CONSUMERS, not from the mandate. A STACK
  LANDS WHERE ITS CONSUMERS LEARN OF IT: breaks shipped schema/repo/API/
  public render, and the SCHEDULER never heard — autoSchedule and
  nextFreeSlot share scanForFreeSlot and neither sees a break, so the machine
  places a keynote at lunch. A BOUNDARY IS ONLY AS WIDE AS ITS REASON:
  DEC-022's "never in export machinery" was aimed at PUBLIC SESSION FEEDS;
  the producer's run-of-show is where a break belongs. A LAYOUT CASE NEEDS
  DATA TO EXIST — the v7 agenda's 1/2/3/4-up auto-fit is undemoable on a seed
  that places five sessions with no two sharing a start time; seed the
  concurrency in the same round as the grid. WALK THE LIFECYCLE, NOT THE
  ROUTE: create -> see it anonymously -> delete would have caught the missing
  UI a wave earlier; assert on LABEL TEXT when another lane owns the markup.
