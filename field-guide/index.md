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
  LIE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND VOCABULARY (and drops
  the half nobody asked for -- check a batched lookup's second consumer); A
  DAY LABEL IS NOT AN INSTANT; A HARDCODED SURFACE LIST GOES STALE -- pair
  with a COUNT assertion; classify by the MOST PUBLIC-REACHING WRITE; ONE
  SERIALIZER FOLDS, SWEEP EVERY SIBLING; WAVE N-1 MAY STILL BE IN FLIGHT --
  check .git/logs/HEAD past the last `scribe wave N` for merges AND mandate
  commits; TWO SUBSYSTEMS READING THE SAME TABLE FOR OPPOSITE PURPOSES IS
  THE BUG; A PER-INSTANCE Z-FIX IS A CLASS BUG DEFERRED -- name the TIER as
  a token, pin the z-index DECLARATION COUNT; BLEED BY ABSENCE ONLY REACHES
  THE PARENT'S CONTENT BOX -- across a PADDED ancestor cancel via the SAME
  token, never vw/cqw; A DISCLOSURE IS NOT A DELETION -- move behind the
  shared frame with props byte-identical; A FRAMED PRIMARY WITH NOTHING TO
  WRITE IS A LIE -- give it the real editable fact, one writer, two screens.
- FINDINGS w1 (this round; DEC space 001-999 FULL -- every ruling is an
  `## Amendment (wave N)` on the DEC the code already cites): A CLAMP INSIDE
  A PADDED ANCESTOR IS NOT THE MEASURE -- .chq-measure-wide is 1180 and the
  pair still computed 1112/778 because main pads 34px; state the CONTENT
  column and cancel the padding through the SAME token. APPEARANCE:NONE
  WITHOUT A CARET IS A CONTROL THAT LIES -- restore the affordance on the
  ONE shared select rule, not per surface. AN OPTIONAL PROP NOBODY PASSES IS
  A SECOND READER wearing the first one's clothes (Recent Sends'
  templatesById): make it required at the first divergence. A CONTROL WHOSE
  ONLY OUTCOME IS A 400 is the sibling of a primary with nothing to write --
  disable it, NAME the blocking token, one forward path. A STEP STRIP THAT
  HIGHLIGHTS A SCREEN NOBODY LEFT is a picture of a flow: unmount the step
  you claim is done. NO ORDER BY THE USER CAN READ AS TIME MEANS
  ALPHABETICAL -- a programme is a sequence; one ordering expression, every
  branch, untimed last. CHECK .git/refs/heads BEFORE PLANNING: a prior
  round's task-w72-* branches carry ten landed-but-UNMERGED P1 fixes.
