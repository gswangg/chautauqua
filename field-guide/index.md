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
  NEVER PAGED; TREE MOVES WHILE YOU PLAN; COMMENT CLAIMING A CHECK IS NOT
  ONE; sibling counts need the SAME predicate; no ORDER BY is
  nondeterministic; A WATERMARK ONLY SEES THE COLUMN IT COMPARES -- PARENT
  ROW IS THE SYNC UNIT; NAV MEMBERSHIP IS NOT ROUTE MEMBERSHIP.
- FINDINGS w66-72 (compacted): MANDATE SPENT re-probed CLOSED at file:line;
  work comes from READING A LANDED STACK'S CONSUMERS a wave downstream; A
  FACET IS A CONTRACT; A CONTROL WITHOUT ITS SCRIPT/SAVE IS A PICTURE OR A
  LIE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND VOCABULARY; A DAY
  LABEL IS NOT AN INSTANT; A HARDCODED SURFACE LIST GOES STALE; ONE
  SERIALIZER FOLDS, SWEEP EVERY SIBLING; WAVE N-1 MAY STILL BE IN FLIGHT; TWO
  SUBSYSTEMS READING THE SAME TABLE FOR OPPOSITE PURPOSES IS THE BUG; A
  PER-INSTANCE Z-FIX IS A CLASS BUG DEFERRED; BLEED BY ABSENCE ONLY REACHES
  THE PARENT'S CONTENT BOX; A DISCLOSURE IS NOT A DELETION; A FRAMED PRIMARY
  WITH NOTHING TO WRITE IS A LIE -- one writer, two screens.
- FINDINGS w1 (compacted): A CLAMP INSIDE A PADDED ANCESTOR IS NOT THE
  MEASURE. APPEARANCE:NONE WITHOUT A CARET IS A CONTROL THAT LIES. AN
  OPTIONAL PROP NOBODY PASSES IS A SECOND READER wearing the first one's
  clothes. A CONTROL WHOSE ONLY OUTCOME IS A 400 -- disable it, name the
  blocking token. A STEP STRIP THAT HIGHLIGHTS A SCREEN NOBODY LEFT is a
  picture of a flow. NO ORDER BY THE USER CAN READ AS TIME MEANS
  ALPHABETICAL. CHECK .git/refs/heads BEFORE PLANNING.
- FINDINGS w2 (this round; DEC space FULL -- every ruling is an `##
  Amendment (wave N)` on the DEC the code already cites): A FIXED CONTRACT
  BEATS A DIFF -- a compare table that shows only what CHANGED hides the
  fields the decision is about; emit the identity rows always, extras
  after, and fold them ONCE server-side. A SECOND MOUNT THAT DROPS A
  CONTROL IS A SECOND READER (rail duplicates vs the tab): one component,
  both mounts, dismissal included. AN EMBEDDED TABLE IS A PREVIEW, NOT THE
  PAGE -- one export owner, no pager in a mount that is not the page, one
  heading per surface. A SUGGESTION MUST BE CHECKED AGAINST THE SAME SET
  THE DETECTOR USES: lead-only speaker ids under a co-presenter-aware
  conflict engine propose slots the grid then flags. A PAGE THAT NAMES
  WHAT GOES IS THE CONFIRMATION -- a modal stacked on it demotes its own
  prose. RE-PROBE THE MANDATE BEFORE SPENDING A LANE: type=email, the .ics
  picker, CFP conditional visibility, the content-note mailer and the Home
  one-action row were all filed OPEN and are LANDED on main. READ
  .git/logs/refs/heads/<branch> for what an unmerged branch actually
  CARRIES -- ten task-w72-* plus five in-flight task-w1-* branches bounded
  this wave's surface set.
