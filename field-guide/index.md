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
  (wave N)` on nearest existing DEC, heavily compacted): grep "no matches"
  is a fact about that minute only. DECISION DOC != FIX; MINTING IS IO;
  boundary fails per RECIPIENT never REQUEST; batch the FRONTIER not
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE
  NEVER PAGED; TREE MOVES WHILE YOU PLAN; A WATERMARK ONLY SEES THE
  COLUMN IT COMPARES -- PARENT ROW IS THE SYNC UNIT; NAV MEMBERSHIP IS NOT
  ROUTE MEMBERSHIP.
- FINDINGS w66-72 (compacted): MANDATE SPENT re-probed CLOSED at file:line;
  A FACET IS A CONTRACT; A CONTROL WITHOUT ITS SCRIPT/SAVE IS A PICTURE OR
  A LIE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND VOCABULARY; A DAY
  LABEL IS NOT AN INSTANT; A HARDCODED SURFACE LIST GOES STALE; ONE
  SERIALIZER FOLDS, SWEEP EVERY SIBLING; TWO SUBSYSTEMS READING THE SAME
  TABLE FOR OPPOSITE PURPOSES IS THE BUG; A DISCLOSURE IS NOT A DELETION;
  A FRAMED PRIMARY WITH NOTHING TO WRITE IS A LIE -- one writer, two
  screens.
- FINDINGS w1-3 (compacted; DEC space FULL): A CLAMP INSIDE A PADDED
  ANCESTOR IS NOT THE MEASURE; A CONTROL WHOSE ONLY OUTCOME IS A 400 --
  disable it, name the blocking token; NO ORDER BY READS AS TIME MEANS
  ALPHABETICAL; A FIXED CONTRACT BEATS A DIFF; AN EMBEDDED TABLE IS A
  PREVIEW, NOT THE PAGE; RE-PROBE THE MANDATE BEFORE SPENDING A LANE;
  CHECK .git/refs/heads and .git/logs/refs/heads/<branch> BEFORE
  PLANNING. A DECISION DOC IS NOT A BRANCH -- wave-72 amendments sat on
  main as PROSE while their code died on abandoned refs; read decisions/
  before re-deciding, implement verbatim (grep `## Amendment (wave N)`
  first). A LATCHED ERROR STRING IS A SECOND STATE. A PAGE-LEVEL KEY
  HANDLER MUST ASK WHO HAS FOCUS. A LOADING PAGE WITH NO STRUCTURE READS
  AS BROKEN. SIBLING COUNTS NEED THE SAME PREDICATE, AGAIN. GREP OUTPUT
  COLLAPSES `//`.
- FINDINGS w4 (this round): A MANDATE IS A SNAPSHOT, NOT A STATE -- gate-4
  reds were measured on 33fbc724 and waves 1-3 closed many silently
  (/schedule rebuilt, auth box-math 820/888, .ics in the embed picker,
  ?day= pills, create-time duplicate check, headshot download). Re-read
  the CODE before spending a lane; a mandate clause is a hypothesis.
  THE PAIR REPORTS OUTLIVE THE MANDATE: chautauqua-research/fidelity-
  gate4/*/report.md carry per-surface STILL-PRESENT + MINOR lists the
  mandate never promoted -- mine them when the P1s are taken. A FRAME NIT
  CAN CONTRADICT A LANDED DECISION: "one chip per kind" vs DEC-971, "drop
  per-version Delete" vs DEC-713, "add a spam-folder line" vs DEC-377 --
  grep decisions/ before filing a frame observation as work. A READ VIEW
  THAT DESCRIBES A LIST IS A WRITE-MODE CLICK TO READ. A CONTROL ON EVERY
  CARD IS A LAYOUT DECISION: one select per pipeline card cost 40% of the
  card height. A PRIVATE COPY OF A TRANSFORM IS A SECOND GRAMMAR waiting
  to be measured ("Talk (30 min)" vs "Talk, 30 min").
