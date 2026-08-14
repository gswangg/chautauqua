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
  NEVER PAGED; TREE MOVES WHILE YOU PLAN; sibling counts need the SAME
  predicate; no ORDER BY is nondeterministic; A WATERMARK ONLY SEES THE
  COLUMN IT COMPARES -- PARENT ROW IS THE SYNC UNIT; NAV MEMBERSHIP IS NOT
  ROUTE MEMBERSHIP.
- FINDINGS w66-72 (compacted): MANDATE SPENT re-probed CLOSED at file:line;
  work comes from READING A LANDED STACK'S CONSUMERS a wave downstream; A
  FACET IS A CONTRACT; A CONTROL WITHOUT ITS SCRIPT/SAVE IS A PICTURE OR A
  LIE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND VOCABULARY; A DAY
  LABEL IS NOT AN INSTANT; A HARDCODED SURFACE LIST GOES STALE; ONE
  SERIALIZER FOLDS, SWEEP EVERY SIBLING; TWO SUBSYSTEMS READING THE SAME
  TABLE FOR OPPOSITE PURPOSES IS THE BUG; A PER-INSTANCE Z-FIX IS A CLASS
  BUG DEFERRED; A DISCLOSURE IS NOT A DELETION; A FRAMED PRIMARY WITH
  NOTHING TO WRITE IS A LIE -- one writer, two screens.
- FINDINGS w1 (compacted): A CLAMP INSIDE A PADDED ANCESTOR IS NOT THE
  MEASURE; APPEARANCE:NONE WITHOUT A CARET LIES; AN OPTIONAL PROP NOBODY
  PASSES IS A SECOND READER; A CONTROL WHOSE ONLY OUTCOME IS A 400 --
  disable it, name the blocking token; A STEP STRIP THAT HIGHLIGHTS A
  SCREEN NOBODY LEFT is a picture of a flow; NO ORDER BY READS AS TIME
  MEANS ALPHABETICAL; CHECK .git/refs/heads BEFORE PLANNING.
- FINDINGS w2 (compacted; DEC space FULL): A FIXED CONTRACT BEATS A DIFF;
  A SECOND MOUNT THAT DROPS A CONTROL IS A SECOND READER; AN EMBEDDED
  TABLE IS A PREVIEW, NOT THE PAGE; A SUGGESTION MUST BE CHECKED AGAINST
  THE SAME SET THE DETECTOR USES; A PAGE THAT NAMES WHAT GOES IS THE
  CONFIRMATION; RE-PROBE THE MANDATE BEFORE SPENDING A LANE; READ
  .git/logs/refs/heads/<branch> for what an unmerged branch CARRIES.
- FINDINGS w3 (this round): A DECISION DOC IS NOT A BRANCH -- ten wave-72
  amendments (DEC-021/033/369/571/745/825/874/889/900/989) sit on main as
  PROSE while their code died on abandoned task-w72-* refs; read
  decisions/ before re-deciding, then implement the ruling verbatim
  (grep `## Amendment (wave N)` first, it is cheaper than a lane). A
  LATCHED ERROR STRING IS A SECOND STATE -- validation the user cannot
  clear by fixing the input reads as a dead screen (the run-4 ABS killer
  was a sticky message, not a keying drift). A PAGE-LEVEL KEY HANDLER
  MUST ASK WHO HAS FOCUS: digits and Enter belong to the field, not the
  page. A LOADING PAGE WITH NO STRUCTURE READS AS BROKEN and taxes every
  eval agent a turn -- withhold flicker inline, never a whole main
  region. SIBLING COUNTS NEED THE SAME PREDICATE, AGAIN: "37 of 34".
  GREP OUTPUT COLLAPSES `//` -- never diagnose a syntax error from it.
